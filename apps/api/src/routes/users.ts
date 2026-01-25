import { Router } from 'express';
import { prisma, GlobalRole as PrismaGlobalRole } from '@colloquium/database';
import { authenticate, authenticateWithBots, requireRole, requirePermission, requireAnyRole } from '../middleware/auth';
import { Permission, Role } from '@colloquium/auth';
import { validateRequest, asyncHandler } from '../middleware/validation';
import { UserUpdateSchema, UserQuerySchema, IdSchema } from '../schemas/validation';
import { z } from 'zod';

const router = Router();

// Additional validation schemas specific to users
const updateRoleSchema = z.object({
  role: z.enum(['USER', 'ACTION_EDITOR', 'EDITOR_IN_CHIEF', 'ADMIN'])
});

const updateProfileSchema = z.object({
  name: z.string().optional(),
  username: z.string()
    .regex(/^[a-z][a-z0-9-]{2,29}$/, 'Username must be 3-30 characters, start with a letter, and contain only lowercase letters, numbers, and hyphens')
    .refine(val => !val.startsWith('bot-'), 'Usernames starting with "bot-" are reserved for system bots')
    .optional(),
  bio: z.string().optional(),
  affiliation: z.string().optional(),
  website: z.string().url().optional()
});


// GET /api/users - List users (for admin or bot service tokens)
router.get('/', authenticateWithBots, (req: any, res, next) => {
  // Bot service tokens can access user search
  if (req.botContext) return next();
  // Regular users need ADMIN role
  const { GlobalRole } = require('@colloquium/auth');
  return requireRole(GlobalRole.ADMIN)(req, res, next);
}, async (req, res, next) => {
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
      prisma.users.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          username: true,
          name: true,
          orcidId: true,
          orcidVerified: true,
          role: true,
          affiliation: true,
          createdAt: true,
          _count: {
            select: {
              manuscript_authors: true,
              review_assignments: true,
              messages: true
            }
          }
        }
      }),
      prisma.users.count({ where })
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

// GET /api/users/lookup - Look up user by email for author management
router.get('/lookup', authenticate, async (req, res, next) => {
  try {
    const { email } = req.query;
    
    if (!email || typeof email !== 'string') {
      return res.status(400).json({
        error: 'Email Required',
        message: 'Email parameter is required'
      });
    }
    
    const user = await prisma.users.findUnique({
      where: { email: email.toLowerCase() },
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        orcidId: true,
        orcidVerified: true,
        affiliation: true
      }
    });

    if (!user) {
      return res.status(404).json({
        error: 'User Not Found',
        message: 'No user found with this email address'
      });
    }
    
    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      orcidId: user.orcidId,
      affiliation: user.affiliation
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/users/check-username/:username - Check username availability
router.get('/check-username/:username', authenticate, async (req, res, next) => {
  try {
    const { username } = req.params;
    const usernameRegex = /^[a-z][a-z0-9-]{2,29}$/;

    if (!usernameRegex.test(username)) {
      return res.json({ available: false, reason: 'Invalid format' });
    }

    // Reject usernames starting with 'bot-' (reserved for system bots)
    if (username.startsWith('bot-')) {
      return res.json({ available: false, reason: 'Reserved prefix' });
    }

    const existing = await prisma.users.findUnique({
      where: { username },
      select: { id: true }
    });

    const available = !existing || existing.id === req.user!.id;
    res.json({ available });
  } catch (error) {
    next(error);
  }
});

// GET /api/users/me - Get current user profile
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const user = await prisma.users.findUnique({
      where: { id: req.user!.id },
      include: {
        manuscript_authors: {
          include: {
            manuscripts: {
              select: {
                id: true,
                title: true,
                status: true,
                submittedAt: true,
                publishedAt: true,
                conversations: {
                  select: { id: true },
                  orderBy: { createdAt: 'asc' },
                  take: 1
                },
                _count: {
                  select: {
                    conversations: true
                  }
                }
              }
            }
          },
          orderBy: { manuscripts: { submittedAt: 'desc' } }
        },
        review_assignments: {
          include: {
            manuscripts: {
              select: {
                id: true,
                title: true,
                status: true,
                submittedAt: true,
                conversations: {
                  select: { id: true },
                  orderBy: { createdAt: 'asc' },
                  take: 1
                }
              }
            }
          },
          orderBy: { assignedAt: 'desc' }
        },
        action_editors_action_editors_editorIdTousers: {
          include: {
            manuscripts: {
              select: {
                id: true,
                title: true,
                status: true,
                submittedAt: true,
                conversations: {
                  select: { id: true },
                  orderBy: { createdAt: 'asc' },
                  take: 1
                }
              }
            }
          },
          orderBy: { assignedAt: 'desc' }
        },
        _count: {
          select: {
            messages: true,
            conversation_participants: true
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
    const authoredPapers = user.manuscript_authors.map(am => ({
      id: am.manuscripts.id,
      conversationId: am.manuscripts.conversations[0]?.id ?? null,
      title: am.manuscripts.title,
      status: am.manuscripts.status,
      submittedAt: am.manuscripts.submittedAt,
      publishedAt: am.manuscripts.publishedAt,
      conversationCount: am.manuscripts._count.conversations,
      order: am.order,
      isCorresponding: am.isCorresponding
    }));

    // Format review assignments
    const reviewAssignments = user.review_assignments.map(ra => ({
      id: ra.id,
      conversationId: ra.manuscripts.conversations[0]?.id ?? null,
      manuscript: {
        id: ra.manuscripts.id,
        title: ra.manuscripts.title,
        status: ra.manuscripts.status,
        submittedAt: ra.manuscripts.submittedAt
      },
      status: ra.status,
      assignedAt: ra.assignedAt,
      dueDate: ra.dueDate,
      completedAt: ra.completedAt
    }));

    // Format editor assignments
    const editorAssignments = user.action_editors_action_editors_editorIdTousers.map(ae => ({
      id: ae.id,
      conversationId: ae.manuscripts.conversations[0]?.id ?? null,
      manuscript: {
        id: ae.manuscripts.id,
        title: ae.manuscripts.title,
        status: ae.manuscripts.status,
        submittedAt: ae.manuscripts.submittedAt
      },
      assignedAt: ae.assignedAt
    }));

    const profile = {
      id: user.id,
      email: user.email,
      username: user.username,
      name: user.name,
      orcidId: user.orcidId,
      orcidVerified: user.orcidVerified,
      bio: user.bio,
      affiliation: user.affiliation,
      website: user.website,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      stats: {
        authoredPapers: authoredPapers.length,
        reviewsCompleted: reviewAssignments.filter(r => r.status === 'COMPLETED').length,
        messagesPosted: user._count.messages,
        conversationsJoined: user._count.conversation_participants
      },
      authoredPapers,
      reviewAssignments,
      editorAssignments
    };

    res.json(profile);
  } catch (error) {
    next(error);
  }
});

// GET /api/users/profile/:identifier - Get user or bot profile for mentions
router.get('/profile/:identifier', authenticate, async (req, res, next) => {
  try {
    const identifier = req.params.identifier;
    
    // Check if it's a bot identifier (all bots use bot- prefix)
    const isBot = identifier.toLowerCase().startsWith('bot-');
    
    if (isBot) {
      // Return bot profile information
      const botInfo = getBotProfile(identifier.toLowerCase());
      if (!botInfo) {
        return res.status(404).json({
          error: 'Bot not found',
          message: 'The specified bot does not exist'
        });
      }
      
      return res.json({
        user: {
          id: identifier.toLowerCase(),
          name: botInfo.displayName,
          email: `${identifier.toLowerCase()}@colloquium.ai`,
          role: botInfo.role,
          bio: botInfo.description,
          affiliation: 'Colloquium AI Systems',
          isBot: true
        }
      });
    }
    
    // Look up user by ID, email, or username
    const user = await prisma.users.findFirst({
      where: {
        OR: [
          { id: identifier },
          { email: identifier },
          { username: identifier }
        ]
      },
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        orcidId: true,
        orcidVerified: true,
        bio: true,
        affiliation: true,
        website: true,
        role: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'The specified user does not exist'
      });
    }
    
    res.json({
      user: {
        ...user,
        isBot: false
      }
    });
  } catch (error) {
    next(error);
  }
});

// Helper function to get bot profile information
function getBotProfile(botId: string) {
  const botProfiles: Record<string, { displayName: string; description: string; role: string }> = {
    'bot-editorial': {
      displayName: 'Editorial Bot',
      description: 'Assists with manuscript editorial workflows and review processes',
      role: 'Editorial Assistant'
    },
    'bot-plagiarism-checker': {
      displayName: 'Plagiarism Checker',
      description: 'Checks manuscripts for potential plagiarism and citation issues',
      role: 'Content Reviewer'
    },
    'bot-statistics': {
      displayName: 'Statistics Bot',
      description: 'Reviews statistical analysis and methodology in manuscripts',
      role: 'Statistical Reviewer'
    },
    'bot-formatting': {
      displayName: 'Formatting Bot',
      description: 'Checks manuscript formatting and style guidelines',
      role: 'Style Checker'
    }
  };
  
  return botProfiles[botId];
}

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

    const { name, username, bio, affiliation, website } = validation.data;
    const updates: any = { updatedAt: new Date() };

    if (name !== undefined) updates.name = name;
    if (bio !== undefined) updates.bio = bio;
    if (affiliation !== undefined) updates.affiliation = affiliation;
    if (website !== undefined) updates.website = website;

    if (username !== undefined) {
      const existing = await prisma.users.findUnique({
        where: { username },
        select: { id: true }
      });
      if (existing && existing.id !== req.user!.id) {
        return res.status(409).json({
          error: 'Username Taken',
          message: 'This username is already in use'
        });
      }
      updates.username = username;
    }

    const updatedUser = await prisma.users.update({
      where: { id: req.user!.id },
      data: updates,
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        orcidId: true,
        orcidVerified: true,
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

    const user = await prisma.users.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        orcidId: true,
        orcidVerified: true,
        bio: true,
        affiliation: true,
        website: true,
        role: true,
        createdAt: true,
        manuscript_authors: {
          where: {
            manuscripts: {
              status: 'PUBLISHED' // Only show published papers in public view
            }
          },
          include: {
            manuscripts: {
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
          orderBy: { manuscripts: { publishedAt: 'desc' } }
        },
        _count: {
          select: {
            manuscript_authors: {
              where: {
                manuscripts: {
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
    const publishedPapers = user.manuscript_authors.map(am => ({
      id: am.manuscripts.id,
      title: am.manuscripts.title,
      abstract: am.manuscripts.abstract,
      publishedAt: am.manuscripts.publishedAt,
      conversationCount: am.manuscripts._count.conversations,
      order: am.order,
      isCorresponding: am.isCorresponding
    }));

    const publicProfile = {
      id: user.id,
      name: user.name,
      orcidId: user.orcidId,
      orcidVerified: user.orcidVerified,
      bio: user.bio,
      affiliation: user.affiliation,
      website: user.website,
      role: user.role,
      memberSince: user.createdAt,
      stats: {
        publishedPapers: user._count.manuscript_authors
      },
      publishedPapers
    };

    res.json(publicProfile);
  } catch (error) {
    next(error);
  }
});

// POST /api/users/:id/role - Update user role (admin or editor-in-chief only)
router.post('/:id/role', authenticate, (req, res, next) => {
  const { GlobalRole } = require('@colloquium/auth');
  return requireAnyRole([GlobalRole.ADMIN, GlobalRole.EDITOR_IN_CHIEF])(req, res, next);
}, async (req, res, next) => {
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

    // Map string role to PrismaGlobalRole enum
    const roleMapping: Record<string, PrismaGlobalRole> = {
      'ADMIN': PrismaGlobalRole.ADMIN,
      'EDITOR_IN_CHIEF': PrismaGlobalRole.EDITOR_IN_CHIEF,
      'ACTION_EDITOR': PrismaGlobalRole.ACTION_EDITOR,
      'USER': PrismaGlobalRole.USER
    };

    // Check if user has permission to assign this role
    const currentUserRole = req.user!.role;
    const targetRole = roleMapping[role];
    
    // Only ADMIN can assign ADMIN or EDITOR_IN_CHIEF roles
    if ((targetRole === PrismaGlobalRole.ADMIN || targetRole === PrismaGlobalRole.EDITOR_IN_CHIEF) && 
        currentUserRole !== PrismaGlobalRole.ADMIN) {
      return res.status(403).json({
        error: 'Insufficient Permissions',
        message: 'Only administrators can assign ADMIN or EDITOR_IN_CHIEF roles'
      });
    }
    
    // EDITOR_IN_CHIEF can assign ACTION_EDITOR and USER roles
    if (currentUserRole === PrismaGlobalRole.EDITOR_IN_CHIEF && 
        targetRole !== PrismaGlobalRole.ACTION_EDITOR && 
        targetRole !== PrismaGlobalRole.USER) {
      return res.status(403).json({
        error: 'Insufficient Permissions',
        message: 'Editors-in-Chief can only assign ACTION_EDITOR and USER roles'
      });
    }

    const mappedRole = roleMapping[role];
    if (!mappedRole) {
      return res.status(400).json({
        error: 'Invalid Role',
        message: `Role ${role} is not valid`
      });
    }

    // Prevent users from removing their own admin role
    if (id === req.user!.id && req.user!.role === PrismaGlobalRole.ADMIN && role !== 'ADMIN') {
      return res.status(400).json({
        error: 'Cannot Modify Own Role',
        message: 'Administrators cannot remove their own admin privileges'
      });
    }
    
    // Prevent users from removing their own editor-in-chief role unless they're also admin
    if (id === req.user!.id && req.user!.role === PrismaGlobalRole.EDITOR_IN_CHIEF && 
        role !== 'EDITOR_IN_CHIEF' && currentUserRole !== PrismaGlobalRole.ADMIN) {
      return res.status(400).json({
        error: 'Cannot Modify Own Role',
        message: 'Editors-in-Chief cannot remove their own role unless they are also administrators'
      });
    }

    const updatedUser = await prisma.users.update({
      where: { id },
      data: { role: mappedRole, updatedAt: new Date() },
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
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2025') {
      return res.status(404).json({
        error: 'User Not Found',
        message: 'User not found'
      });
    }
    next(error);
  }
});

export default router;