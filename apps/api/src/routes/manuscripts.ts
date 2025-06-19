import { Router } from 'express';
import { prisma } from '@colloquium/database';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { z } from 'zod';
import { authenticate, requirePermission, optionalAuth } from '../middleware/auth';
import { Permission, hasManuscriptPermission, ManuscriptPermission, GlobalRole } from '@colloquium/auth';

const router = Router();

// File upload configuration
const uploadDir = path.join(process.cwd(), 'uploads', 'manuscripts');

// Ensure upload directory exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename with timestamp
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `manuscript-${uniqueSuffix}${ext}`);
  }
});

// File filter to accept only certain file types
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
    'application/msword', // .doc
    'text/plain', // .txt
    'application/x-latex', // .tex
    'text/x-tex' // .tex
  ];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type. Allowed types: PDF, Word documents, Text files, LaTeX files`));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
    files: 5 // Maximum 5 files per submission
  }
});

// Validation schemas
const manuscriptSubmissionSchema = z.object({
  title: z.string().min(10, 'Title must be at least 10 characters'),
  abstract: z.string().min(100, 'Abstract must be at least 100 characters'),
  content: z.string().optional(),
  authors: z.array(z.string()).min(1, 'At least one author is required'),
  keywords: z.array(z.string()).default([]),
  metadata: z.record(z.any()).default({})
});

// GET /api/manuscripts - List all manuscripts (public manuscripts don't require auth)
router.get('/', optionalAuth, async (req, res, next) => {
  try {
    const { 
      status = 'PUBLISHED', 
      page = '1', 
      limit = '20', 
      search,
      orderBy = 'publishedAt',
      order = 'desc'
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // Build where clause
    const where: any = {};
    
    // Filter by status - default to published for public feed
    if (status && status !== 'ALL') {
      where.status = status as string;
    }

    // If user is not authenticated or not an editor/admin, only show published manuscripts
    if (!req.user || (req.user.role !== GlobalRole.EDITOR_IN_CHIEF && req.user.role !== GlobalRole.MANAGING_EDITOR && req.user.role !== GlobalRole.ADMIN)) {
      where.status = 'PUBLISHED';
    }

    // Search functionality
    if (search) {
      where.OR = [
        { title: { contains: search as string, mode: 'insensitive' } },
        { abstract: { contains: search as string, mode: 'insensitive' } },
        { authors: { hasSome: [search as string] } }
      ];
    }

    // Get manuscripts with related data
    const [manuscripts, total] = await Promise.all([
      prisma.manuscript.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { [orderBy as string]: order as 'asc' | 'desc' },
        include: {
          _count: {
            select: {
              conversations: true
            }
          }
        }
      }),
      prisma.manuscript.count({ where })
    ]);

    // Format response
    const formattedManuscripts = manuscripts.map((manuscript: any) => ({
      id: manuscript.id,
      title: manuscript.title,
      abstract: manuscript.abstract,
      authors: manuscript.authors,
      keywords: manuscript.keywords,
      status: manuscript.status,
      submittedAt: manuscript.submittedAt,
      publishedAt: manuscript.publishedAt,
      conversationCount: manuscript._count.conversations,
      fileUrl: manuscript.fileUrl,
      metadata: manuscript.metadata
    }));

    res.json({
      manuscripts: formattedManuscripts,
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

// POST /api/manuscripts - Submit new manuscript (with file upload support)
router.post('/', authenticate, (req, res, next) => {
  // Check permissions dynamically
  const { Permission } = require('@colloquium/auth');
  return requirePermission(Permission.SUBMIT_MANUSCRIPT)(req, res, next);
}, upload.array('files', 5), async (req, res, next) => {
  try {
    // Parse and validate the manuscript data
    const manuscriptData = manuscriptSubmissionSchema.parse({
      title: req.body.title,
      abstract: req.body.abstract,
      content: req.body.content,
      authors: Array.isArray(req.body.authors) ? req.body.authors : 
               typeof req.body.authors === 'string' ? [req.body.authors] : [],
      keywords: Array.isArray(req.body.keywords) ? req.body.keywords : 
                typeof req.body.keywords === 'string' ? req.body.keywords.split(',').map((k: string) => k.trim()) : [],
      metadata: req.body.metadata ? JSON.parse(req.body.metadata) : {}
    });

    // Start a transaction to ensure data consistency
    const result = await prisma.$transaction(async (tx: any) => {
      // Create the manuscript
      const manuscript = await tx.manuscript.create({
        data: {
          title: manuscriptData.title.trim(),
          abstract: manuscriptData.abstract.trim(),
          content: manuscriptData.content?.trim() || null,
          authors: manuscriptData.authors.map(author => author.trim()),
          keywords: manuscriptData.keywords.map(keyword => keyword.trim()).filter(Boolean),
          status: 'SUBMITTED',
          metadata: {
            ...manuscriptData.metadata,
            submittedBy: req.user!.id,
            submittedAt: new Date().toISOString()
          }
        }
      });

      // Create author relationship for the submitting user
      await tx.manuscriptAuthor.create({
        data: {
          manuscriptId: manuscript.id,
          userId: req.user!.id,
          order: 0,
          isCorresponding: true
        }
      });

      // Process uploaded files
      const files = req.files as Express.Multer.File[];
      const manuscriptFiles = [];
      
      if (files && files.length > 0) {
        for (const file of files) {
          const manuscriptFile = await tx.manuscriptFile.create({
            data: {
              manuscriptId: manuscript.id,
              filename: file.filename,
              originalName: file.originalname,
              mimetype: file.mimetype,
              size: file.size,
              path: file.path
            }
          });
          manuscriptFiles.push(manuscriptFile);
        }

        // Set the primary file URL (first uploaded file)
        if (manuscriptFiles.length > 0) {
          await tx.manuscript.update({
            where: { id: manuscript.id },
            data: { 
              fileUrl: `/api/manuscripts/${manuscript.id}/files/${manuscriptFiles[0].id}/download`
            }
          });
        }
      }

      // Automatically create a conversation for this manuscript submission
      const conversation = await tx.conversation.create({
        data: {
          title: `Discussion: ${manuscript.title}`,
          type: 'REVIEW',
          privacy: 'SEMI_PUBLIC', // Visible to journal members
          manuscriptId: manuscript.id,
          participants: {
            create: [{
              userId: req.user!.id,
              role: 'MODERATOR'
            }]
          }
        }
      });

      return { manuscript, files: manuscriptFiles, conversation };
    });

    // Return the created manuscript with file information
    const formattedManuscript = {
      id: result.manuscript.id,
      title: result.manuscript.title,
      abstract: result.manuscript.abstract,
      content: result.manuscript.content,
      authors: result.manuscript.authors,
      keywords: result.manuscript.keywords,
      status: result.manuscript.status,
      submittedAt: result.manuscript.submittedAt,
      updatedAt: result.manuscript.updatedAt,
      metadata: result.manuscript.metadata,
      fileUrl: result.manuscript.fileUrl,
      files: result.files.map((file: any) => ({
        id: file.id,
        originalName: file.originalName,
        mimetype: file.mimetype,
        size: file.size,
        uploadedAt: file.uploadedAt
      }))
    };

    res.status(201).json({
      message: 'Manuscript submitted successfully',
      manuscript: formattedManuscript,
      conversation: {
        id: result.conversation.id,
        title: result.conversation.title,
        type: result.conversation.type,
        privacy: result.conversation.privacy
      }
    });
  } catch (error) {
    // Clean up uploaded files if manuscript creation failed
    if (req.files) {
      const files = req.files as Express.Multer.File[];
      files.forEach(file => {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      });
    }

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Invalid manuscript data',
        details: error.errors.reduce((acc, err) => {
          acc[err.path.join('.')] = err.message;
          return acc;
        }, {} as Record<string, string>)
      });
    }

    next(error);
  }
});

// GET /api/manuscripts/:id - Get manuscript details
router.get('/:id', optionalAuth, async (req, res, next) => {
  try {
    const { id } = req.params;

    const manuscript = await prisma.manuscript.findUnique({
      where: { id },
      include: {
        files: {
          orderBy: { uploadedAt: 'asc' }
        },
        authorRelations: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                orcidId: true
              }
            }
          },
          orderBy: { order: 'asc' }
        },
        conversations: {
          include: {
            _count: {
              select: {
                messages: true,
                participants: true
              }
            }
          }
        },
        actionEditor: {
          select: {
            editorId: true
          }
        },
        reviews: {
          select: {
            reviewerId: true
          }
        },
        _count: {
          select: {
            conversations: true
          }
        }
      }
    });

    if (!manuscript) {
      return res.status(404).json({ 
        error: 'Manuscript not found',
        message: `No manuscript found with ID: ${id}`
      });
    }

    // Check if user can access this manuscript using new permission system
    console.log('DEBUG: Checking manuscript permissions for manuscript:', id);
    console.log('DEBUG: User:', req.user?.email, 'Role:', req.user?.role);
    console.log('DEBUG: Manuscript status:', manuscript.status);
    
    const isPublished = manuscript.status === 'PUBLISHED';
    const isAuthor = req.user && manuscript.authorRelations.some((rel: any) => rel.userId === req.user!.id);
    const isActionEditor = req.user && manuscript.actionEditor?.editorId === req.user.id;
    const isReviewer = req.user && manuscript.reviews.some((review: any) => review.reviewerId === req.user!.id);
    
    console.log('DEBUG: Permission context - isPublished:', isPublished, 'isAuthor:', isAuthor, 'isActionEditor:', isActionEditor, 'isReviewer:', isReviewer);
    
    const canView = hasManuscriptPermission(
      req.user?.role || GlobalRole.USER,
      ManuscriptPermission.VIEW_MANUSCRIPT,
      {
        isAuthor,
        isActionEditor,
        isReviewer,
        isPublished
      }
    );
    
    console.log('DEBUG: Can view manuscript:', canView);
    
    if (!canView) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'You do not have permission to view this manuscript'
      });
    }

    // Format response
    const formattedManuscript = {
      id: manuscript.id,
      title: manuscript.title,
      abstract: manuscript.abstract,
      authors: manuscript.authors, // Legacy field
      authorDetails: manuscript.authorRelations.map((rel: any) => ({
        id: rel.user.id,
        name: rel.user.name,
        email: rel.user.email,
        orcidId: rel.user.orcidId,
        order: rel.order,
        isCorresponding: rel.isCorresponding
      })),
      keywords: manuscript.keywords,
      status: manuscript.status,
      submittedAt: manuscript.submittedAt,
      publishedAt: manuscript.publishedAt,
      updatedAt: manuscript.updatedAt,
      fileUrl: manuscript.fileUrl,
      metadata: manuscript.metadata,
      conversationCount: manuscript._count.conversations,
      files: manuscript.files.map((file: any) => ({
        id: file.id,
        originalName: file.originalName,
        mimetype: file.mimetype,
        size: file.size,
        uploadedAt: file.uploadedAt,
        downloadUrl: `/api/manuscripts/${manuscript.id}/files/${file.id}/download`
      })),
      conversations: manuscript.conversations.map((conv: any) => ({
        id: conv.id,
        title: conv.title,
        type: conv.type,
        privacy: conv.privacy,
        messageCount: conv._count.messages,
        participantCount: conv._count.participants,
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt
      })),
      permissions: {
        canEdit: isAuthor || (req.user?.role === GlobalRole.EDITOR_IN_CHIEF || req.user?.role === GlobalRole.ADMIN),
        canDelete: req.user?.role === GlobalRole.EDITOR_IN_CHIEF || req.user?.role === GlobalRole.ADMIN
      }
    };

    res.json(formattedManuscript);
  } catch (error) {
    next(error);
  }
});

// GET /api/manuscripts/:id/files - List files for manuscript
router.get('/:id/files', async (req, res, next) => {
  try {
    const { id } = req.params;

    const files = await prisma.manuscriptFile.findMany({
      where: { manuscriptId: id },
      orderBy: { uploadedAt: 'asc' }
    });

    const formattedFiles = files.map((file: any) => ({
      id: file.id,
      originalName: file.originalName,
      mimetype: file.mimetype,
      size: file.size,
      uploadedAt: file.uploadedAt,
      downloadUrl: `/api/manuscripts/${id}/files/${file.id}/download`
    }));

    res.json({ files: formattedFiles });
  } catch (error) {
    next(error);
  }
});

// GET /api/manuscripts/:id/files/:fileId/download - Download specific file
router.get('/:id/files/:fileId/download', async (req, res, next) => {
  try {
    const { id, fileId } = req.params;

    const file = await prisma.manuscriptFile.findFirst({
      where: {
        id: fileId,
        manuscriptId: id
      }
    });

    if (!file) {
      return res.status(404).json({
        error: 'File not found',
        message: 'The requested file does not exist or is not associated with this manuscript'
      });
    }

    // Check if file exists on disk
    if (!fs.existsSync(file.path)) {
      return res.status(404).json({
        error: 'File not found',
        message: 'The file has been deleted or moved'
      });
    }

    // Set appropriate headers for file download
    res.setHeader('Content-Disposition', `attachment; filename="${file.originalName}"`);
    res.setHeader('Content-Type', file.mimetype);
    res.setHeader('Content-Length', file.size.toString());

    // Stream the file
    const fileStream = fs.createReadStream(file.path);
    fileStream.pipe(res);
  } catch (error) {
    next(error);
  }
});

// PUT /api/manuscripts/:id - Update manuscript
router.put('/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, abstract, content, keywords, status } = req.body;

    // Validate that manuscript exists and check permissions
    const existingManuscript = await prisma.manuscript.findUnique({
      where: { id },
      include: {
        authorRelations: {
          where: { userId: req.user!.id }
        }
      }
    });

    if (!existingManuscript) {
      return res.status(404).json({
        error: 'Manuscript not found',
        message: `No manuscript found with ID: ${id}`
      });
    }

    // Check if user can edit this manuscript
    const isAuthor = existingManuscript.authorRelations.length > 0;
    const isEditor = req.user!.role === GlobalRole.EDITOR_IN_CHIEF || req.user!.role === GlobalRole.ADMIN;
    
    if (!isAuthor && !isEditor) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'You do not have permission to edit this manuscript'
      });
    }

    // Update manuscript
    const manuscript = await prisma.manuscript.update({
      where: { id },
      data: {
        ...(title && { title: title.trim() }),
        ...(abstract && { abstract: abstract.trim() }),
        ...(content && { content: content.trim() }),
        ...(keywords && { keywords: Array.isArray(keywords) ? keywords.map(k => k.trim()).filter(Boolean) : [] }),
        ...(status && { status })
      }
    });

    res.json({
      message: 'Manuscript updated successfully',
      manuscript: {
        id: manuscript.id,
        title: manuscript.title,
        abstract: manuscript.abstract,
        content: manuscript.content,
        authors: manuscript.authors,
        keywords: manuscript.keywords,
        status: manuscript.status,
        updatedAt: manuscript.updatedAt
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/manuscripts/:id/conversations - List conversations for manuscript
router.get('/:id/conversations', optionalAuth, async (req, res, next) => {
  try {
    const { id } = req.params;

    // Verify manuscript exists
    const manuscript = await prisma.manuscript.findUnique({
      where: { id }
    });

    if (!manuscript) {
      return res.status(404).json({
        error: 'Manuscript not found',
        message: `No manuscript found with ID: ${id}`
      });
    }

    const conversations = await prisma.conversation.findMany({
      where: { manuscriptId: id },
      include: {
        _count: {
          select: {
            messages: true,
            participants: true
          }
        }
      },
      orderBy: { updatedAt: 'desc' }
    });

    const formattedConversations = conversations.map((conv: any) => ({
      id: conv.id,
      title: conv.title,
      type: conv.type,
      privacy: conv.privacy,
      messageCount: conv._count.messages,
      participantCount: conv._count.participants,
      createdAt: conv.createdAt,
      updatedAt: conv.updatedAt
    }));

    res.json({
      conversations: formattedConversations,
      total: conversations.length
    });
  } catch (error) {
    next(error);
  }
});

// NOTE: Manual conversation creation has been removed. 
// Conversations are now automatically created when manuscripts are submitted.
// This ensures all discussions are tied to specific manuscript submissions.

export default router;