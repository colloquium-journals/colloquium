import { Router } from 'express';
import { prisma } from '@colloquium/database';
import { authenticate, requireRole, requirePermission } from '../middleware/auth';
import { Permission, Role } from '@colloquium/auth';
import { z } from 'zod';
import axios from 'axios';

const router = Router();

// Validation schemas
const updateProfileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100, 'Name too long').optional(),
  orcidId: z.string().regex(/^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/, 'Invalid ORCID ID format').optional(),
  bio: z.string().max(1000, 'Bio too long').optional(),
  affiliation: z.string().max(200, 'Affiliation too long').optional(),
  website: z.string().url('Invalid website URL').optional()
});

const updateRoleSchema = z.object({
  role: z.enum(['AUTHOR', 'REVIEWER', 'EDITOR', 'ADMIN'])
});

// ORCID API integration
async function fetchORCIDProfile(orcidId: string) {
  try {
    const cleanOrcidId = orcidId.replace(/[^0-9X-]/g, '');
    const response = await axios.get(
      `https://pub.orcid.org/v3.0/${cleanOrcidId}/person`,
      {
        headers: {
          'Accept': 'application/json'
        },
        timeout: 5000
      }
    );

    const profile = response.data;
    const name = profile.name;
    const affiliations = profile.addresses?.address || [];
    
    return {
      name: name ? `${name['given-names']?.value || ''} ${name['family-name']?.value || ''}`.trim() : null,
      affiliation: affiliations.length > 0 ? affiliations[0].country?.value : null,
      verified: true
    };
  } catch (error) {
    console.error('ORCID API error:', error);
    return { verified: false };
  }
}

// GET /api/users - List users (for admin)
router.get('/', authenticate, requireRole(Role.ADMIN), async (req, res, next) => {
  try {
    const { page = '1', limit = '20', search, role } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { email: { contains: search as string, mode: 'insensitive' } },
        { orcidId: { contains: search as string } }
      ];
    }
    if (role) {
      where.role = role as string;
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          name: true,
          orcidId: true,
          role: true,
          affiliation: true,
          createdAt: true,
          _count: {
            select: {
              authoredManuscripts: true,
              reviewAssignments: true,
              authoredMessages: true
            }
          }
        }
      }),
      prisma.user.count({ where })
    ]);

    res.json({
      users,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/users/me - Get current user profile
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: {
        authoredManuscripts: {
          include: {
            manuscript: {
              select: {
                id: true,
                title: true,
                status: true,
                submittedAt: true,
                publishedAt: true,
                _count: {
                  select: {
                    conversations: true
                  }
                }
              }
            }
          },
          orderBy: { manuscript: { submittedAt: 'desc' } }
        },
        reviewAssignments: {
          include: {
            manuscript: {
              select: {
                id: true,
                title: true,
                status: true,
                submittedAt: true
              }
            }
          },
          orderBy: { assignedAt: 'desc' }
        },
        _count: {
          select: {
            authoredMessages: true,
            conversationParticipants: true
          }
        }
      }
    });

    if (!user) {
      return res.status(404).json({
        error: 'User Not Found',
        message: 'User profile not found'
      });
    }

    // Format authored manuscripts
    const authoredPapers = user.authoredManuscripts.map(am => ({
      id: am.manuscript.id,
      title: am.manuscript.title,
      status: am.manuscript.status,
      submittedAt: am.manuscript.submittedAt,
      publishedAt: am.manuscript.publishedAt,
      conversationCount: am.manuscript._count.conversations,
      order: am.order,
      isCorresponding: am.isCorresponding
    }));

    // Format review assignments
    const reviewAssignments = user.reviewAssignments.map(ra => ({
      id: ra.id,
      manuscript: {
        id: ra.manuscript.id,
        title: ra.manuscript.title,
        status: ra.manuscript.status,
        submittedAt: ra.manuscript.submittedAt
      },
      status: ra.status,
      assignedAt: ra.assignedAt,
      dueDate: ra.dueDate,
      completedAt: ra.completedAt
    }));

    const profile = {
      id: user.id,
      email: user.email,
      name: user.name,
      orcidId: user.orcidId,
      bio: user.bio,
      affiliation: user.affiliation,
      website: user.website,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      stats: {
        authoredPapers: authoredPapers.length,
        reviewsCompleted: reviewAssignments.filter(r => r.status === 'COMPLETED').length,
        messagesPosted: user._count.authoredMessages,
        conversationsJoined: user._count.conversationParticipants
      },
      authoredPapers,
      reviewAssignments
    };

    res.json(profile);
  } catch (error) {
    next(error);
  }
});

// PUT /api/users/me - Update user profile
router.put('/me', authenticate, async (req, res, next) => {
  try {
    const validation = updateProfileSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Please check your input',
        details: validation.error.issues
      });
    }

    const { name, orcidId, bio, affiliation, website } = validation.data;
    const updates: any = { updatedAt: new Date() };

    // Only update provided fields
    if (name !== undefined) updates.name = name;
    if (bio !== undefined) updates.bio = bio;
    if (affiliation !== undefined) updates.affiliation = affiliation;
    if (website !== undefined) updates.website = website;

    // Handle ORCID ID update with verification
    if (orcidId !== undefined) {
      if (orcidId) {
        // Check if ORCID ID is already taken by another user
        const existingUser = await prisma.user.findFirst({
          where: {
            orcidId,
            id: { not: req.user!.id }
          }
        });

        if (existingUser) {
          return res.status(400).json({
            error: 'ORCID ID Already Used',
            message: 'This ORCID ID is already associated with another account'
          });
        }

        // Verify ORCID profile and optionally populate data
        const orcidProfile = await fetchORCIDProfile(orcidId);
        if (orcidProfile.verified) {
          updates.orcidId = orcidId;
          // Optionally auto-populate name and affiliation if not already set
          if (!name && orcidProfile.name && !req.user!.name) {
            updates.name = orcidProfile.name;
          }
          if (!affiliation && orcidProfile.affiliation && !req.user!.name) {
            updates.affiliation = orcidProfile.affiliation;
          }
        } else {
          return res.status(400).json({
            error: 'ORCID Verification Failed',
            message: 'Could not verify ORCID ID. Please check the ID and try again.'
          });
        }
      } else {
        // Remove ORCID ID
        updates.orcidId = null;
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id: req.user!.id },
      data: updates,
      select: {
        id: true,
        email: true,
        name: true,
        orcidId: true,
        bio: true,
        affiliation: true,
        website: true,
        role: true,
        updatedAt: true
      }
    });

    res.json({
      message: 'Profile updated successfully',
      user: updatedUser
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/users/:id - Get user profile by ID (public view)
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        orcidId: true,
        bio: true,
        affiliation: true,
        website: true,
        role: true,
        createdAt: true,
        authoredManuscripts: {
          where: {
            manuscript: {
              status: 'PUBLISHED' // Only show published papers in public view
            }
          },
          include: {
            manuscript: {
              select: {
                id: true,
                title: true,
                abstract: true,
                publishedAt: true,
                _count: {
                  select: {
                    conversations: true
                  }
                }
              }
            }
          },
          orderBy: { manuscript: { publishedAt: 'desc' } }
        },
        _count: {
          select: {
            authoredManuscripts: {
              where: {
                manuscript: {
                  status: 'PUBLISHED'
                }
              }
            }
          }
        }
      }
    });

    if (!user) {
      return res.status(404).json({
        error: 'User Not Found',
        message: 'User profile not found'
      });
    }

    // Format published papers for public view
    const publishedPapers = user.authoredManuscripts.map(am => ({
      id: am.manuscript.id,
      title: am.manuscript.title,
      abstract: am.manuscript.abstract,
      publishedAt: am.manuscript.publishedAt,
      conversationCount: am.manuscript._count.conversations,
      order: am.order,
      isCorresponding: am.isCorresponding
    }));

    const publicProfile = {
      id: user.id,
      name: user.name,
      orcidId: user.orcidId,
      bio: user.bio,
      affiliation: user.affiliation,
      website: user.website,
      role: user.role,
      memberSince: user.createdAt,
      stats: {
        publishedPapers: user._count.authoredManuscripts
      },
      publishedPapers
    };

    res.json(publicProfile);
  } catch (error) {
    next(error);
  }
});

// POST /api/users/:id/role - Update user role (admin only)
router.post('/:id/role', authenticate, requireRole(Role.ADMIN), async (req, res, next) => {
  try {
    const { id } = req.params;
    const validation = updateRoleSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Invalid role specified',
        details: validation.error.issues
      });
    }

    const { role } = validation.data;

    // Prevent admins from removing their own admin role
    if (id === req.user!.id && role !== 'ADMIN') {
      return res.status(400).json({
        error: 'Cannot Modify Own Role',
        message: 'Administrators cannot remove their own admin privileges'
      });
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: { role, updatedAt: new Date() },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        updatedAt: true
      }
    });

    res.json({
      message: 'User role updated successfully',
      user: updatedUser
    });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({
        error: 'User Not Found',
        message: 'User not found'
      });
    }
    next(error);
  }
});

export default router;