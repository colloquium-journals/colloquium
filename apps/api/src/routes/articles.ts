import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '@colloquium/database';
import { ManuscriptFileType, StorageType } from '@prisma/client';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { z } from 'zod';
import { authenticate, requirePermission, optionalAuth, authenticateWithBots } from '../middleware/auth';
import { Permission, hasManuscriptPermission, ManuscriptPermission, GlobalRole, GlobalPermission, hasGlobalPermission } from '@colloquium/auth';
import { fileStorage } from '../services/fileStorage';
import { formatDetection } from '../services/formatDetection';

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

// Basic file filter - detailed validation happens after upload
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Basic security check - reject obviously dangerous files
  const dangerousExtensions = ['.exe', '.bat', '.cmd', '.scr', '.js', '.vbs'];
  const fileExtension = path.extname(file.originalname).toLowerCase();
  
  if (dangerousExtensions.includes(fileExtension)) {
    cb(new Error(`Dangerous file type not allowed: ${fileExtension}`));
    return;
  }
  
  // Allow all other files - specific format validation happens after upload
  cb(null, true);
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
  title: z.string().min(1, 'Title is required'),
  abstract: z.string().min(1, 'Abstract is required'),
  content: z.string().optional(),
  authors: z.array(z.object({
    email: z.string().email('Valid email address is required'),
    name: z.string().min(1, 'Author name is required'),
    isCorresponding: z.boolean().default(false)
  })).min(1, 'At least one author is required')
    .refine(authors => {
      const correspondingCount = authors.filter(author => author.isCorresponding).length;
      return correspondingCount === 1;
    }, 'Exactly one corresponding author is required'),
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
      tag,
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

    // If user is not authenticated or not an editor/admin, only show published and retracted manuscripts
    if (!req.user || (req.user.role !== GlobalRole.EDITOR_IN_CHIEF && req.user.role !== GlobalRole.ACTION_EDITOR && req.user.role !== GlobalRole.ADMIN)) {
      where.status = { in: ['PUBLISHED', 'RETRACTED'] };
    }

    // Search functionality
    if (search) {
      where.OR = [
        { title: { contains: search as string, mode: 'insensitive' } },
        { abstract: { contains: search as string, mode: 'insensitive' } },
        // Search in the manuscript_authors -> user name for partial author name matches
        {
          manuscript_authors: {
            some: {
                users: {
                name: { contains: search as string, mode: 'insensitive' }
              }
            }
          }
        },
        // Also search in the legacy authors field for backward compatibility
        { authors: { hasSome: [search as string] } }
      ];
    }

    // Tag filtering
    if (tag && typeof tag === 'string' && tag.trim() !== '') {
      where.keywords = { has: tag };
    }

    // Get manuscripts with related data
    const [manuscripts, total] = await Promise.all([
      prisma.manuscripts.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { [orderBy as string]: order as 'asc' | 'desc' },
        include: {
          _count: {
            select: {
              conversations: true
            }
          },
          manuscript_authors: {
            include: {
                users: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  orcidId: true
                }
              }
            },
            orderBy: { order: 'asc' }
          }
        }
      }),
      prisma.manuscripts.count({ where })
    ]);

    // Format response
    const formattedManuscripts = manuscripts.map((manuscript: any) => ({
      id: manuscript.id,
      title: manuscript.title,
      abstract: manuscript.abstract,
      authors: manuscript.authors, // Legacy field
      authorDetails: manuscript.manuscript_authors.map((rel: any) => ({
        id: rel.users.id,
        name: rel.users.name,
        email: rel.users.email,
        orcidId: rel.users.orcidId,
        order: rel.order,
        isCorresponding: rel.isCorresponding
      })),
      keywords: manuscript.keywords,
      status: manuscript.status,
      submittedAt: manuscript.submittedAt,
      publishedAt: manuscript.publishedAt,
      doi: manuscript.doi,
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
    let authorsData = [];
    if (Array.isArray(req.body.authors)) {
      authorsData = req.body.authors.map((author: any) => {
        if (typeof author === 'string') {
          try {
            return JSON.parse(author);
          } catch {
            // If it's a plain string, treat as legacy format
            return { email: '', name: author, isCorresponding: false };
          }
        }
        return author;
      });
    }
    
    const manuscriptData = manuscriptSubmissionSchema.parse({
      title: req.body.title,
      abstract: req.body.abstract,
      content: req.body.content,
      authors: authorsData,
      keywords: Array.isArray(req.body.keywords) ? req.body.keywords : 
                typeof req.body.keywords === 'string' ? req.body.keywords.split(',').map((k: string) => k.trim()) : [],
      metadata: req.body.metadata ? JSON.parse(req.body.metadata) : {}
    });

    // Start a transaction to ensure data consistency
    const result = await prisma.$transaction(async (tx: any) => {
      // Process authors - find existing users or create new ones
      const processedAuthors = [];
      for (let i = 0; i < manuscriptData.authors.length; i++) {
        const authorData = manuscriptData.authors[i];
        
        // Look for existing user
        let user = await tx.users.findUnique({
          where: { email: authorData.email.toLowerCase() }
        });
        
        // Create new user if they don't exist
        if (!user) {
          user = await tx.users.create({
            data: {
              email: authorData.email.toLowerCase(),
              name: authorData.name,
              role: 'USER' // Default role for new authors
            }
          });
        }
        
        processedAuthors.push({
          userId: user.id,
          name: authorData.name,
          email: authorData.email,
          order: i,
          isCorresponding: authorData.isCorresponding
        });
      }
      
      // Create the manuscript
      const manuscript = await tx.manuscripts.create({
        data: {
          title: manuscriptData.title.trim(),
          abstract: manuscriptData.abstract.trim(),
          content: manuscriptData.content?.trim() || null,
          authors: processedAuthors.map(author => author.name),
          keywords: manuscriptData.keywords.map(keyword => keyword.trim()).filter(Boolean),
          status: 'SUBMITTED',
          metadata: {
            ...manuscriptData.metadata,
            submittedBy: req.user!.id,
            submittedAt: new Date().toISOString()
          }
        }
      });

      // Create author relationships
      for (const author of processedAuthors) {
        await tx.manuscriptAuthor.create({
          data: {
            manuscriptId: manuscript.id,
            userId: author.userId,
            order: author.order,
            isCorresponding: author.isCorresponding
          }
        });
      }

      // Process uploaded files with enhanced metadata
      const files = req.files as Express.Multer.File[];
      const manuscriptFiles = [];
      const fileValidationErrors = [];
      
      if (files && files.length > 0) {
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          
          try {
            // Detect format for the file
            const fileContent = fs.readFileSync(file.path);
            const formatDetectionResult = await formatDetection.detectFormat(
              file.originalname,
              file.mimetype,
              fileContent
            );

            // Calculate checksum
            const crypto = require('crypto');
            const checksum = crypto.createHash('sha256').update(fileContent).digest('hex');
            
            // Determine file type (first file is source, others are assets)
            const fileType = i === 0 ? ManuscriptFileType.SOURCE : ManuscriptFileType.ASSET;
            
            // Detect encoding for text files
            const encoding = file.mimetype.startsWith('text/') ? 'utf-8' : undefined;
            
            const manuscriptFile = await tx.manuscriptFile.create({
              data: {
                manuscriptId: manuscript.id,
                filename: file.filename,
                originalName: file.originalname,
                mimetype: file.mimetype,
                size: file.size,
                path: file.path,
                fileType,
                storageType: StorageType.LOCAL,
                checksum,
                encoding,
                detectedFormat: formatDetectionResult.detectedFormat,
                fileExtension: path.extname(file.originalname).toLowerCase()
              }
            });
            
            manuscriptFiles.push(manuscriptFile);
            
            // Log any format detection warnings
            if (formatDetectionResult.warnings.length > 0) {
              console.warn(`Format detection warnings for ${file.originalname}:`, formatDetectionResult.warnings);
            }
            
          } catch (error) {
            fileValidationErrors.push(`Failed to process file ${file.originalname}: ${error instanceof Error ? error.message : 'Unknown error'}`);
            
            // Clean up the uploaded file if processing failed
            if (fs.existsSync(file.path)) {
              fs.unlinkSync(file.path);
            }
          }
        }

        // Set the primary file URL (first uploaded file)
        if (manuscriptFiles.length > 0) {
          await tx.manuscripts.update({
            where: { id: manuscript.id },
            data: { 
              fileUrl: `/api/manuscripts/${manuscript.id}/files/${manuscriptFiles[0].id}/download`
            }
          });
        }
        
        // If there were validation errors but some files succeeded, include warnings in response
        if (fileValidationErrors.length > 0) {
          console.warn('File validation errors:', fileValidationErrors);
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

      return { manuscript, files: manuscriptFiles, conversation, authors: processedAuthors };
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

// Custom middleware that handles both optional user auth and bot auth for manuscript viewing
const optionalAuthWithBots = async (req: Request, res: Response, next: NextFunction) => {
  // Check for bot service token first
  const botToken = req.headers['x-bot-token'] as string;
  if (botToken) {
    try {
      const { verifyJWT } = require('@colloquium/auth');
      const botPayload = verifyJWT(botToken);
      if (botPayload.type === 'BOT_SERVICE_TOKEN') {
        req.botContext = {
          botId: botPayload.botId,
          manuscriptId: botPayload.manuscriptId,
          permissions: botPayload.permissions || [],
          type: 'BOT_SERVICE_TOKEN'
        };
        console.log(`DEBUG: Authenticated bot - botId: ${botPayload.botId}, manuscriptId: ${botPayload.manuscriptId}`);
        return next();
      }
    } catch (botError) {
      // Continue to optional user auth if bot token is invalid
    }
  }
  
  // Fall back to optional user authentication
  return optionalAuth(req, res, next);
};

// GET /api/manuscripts/:id - Get manuscript details
router.get('/:id', optionalAuthWithBots, async (req, res, next) => {
  try {
    const { id } = req.params;

    const manuscript = await prisma.manuscripts.findUnique({
      where: { id },
      include: {
        manuscript_files: {
          orderBy: { uploadedAt: 'asc' }
        },
        manuscript_authors: {
          include: {
            users: {
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
                conversation_participants: true
              }
            }
          }
        },
        action_editors: {
          select: {
            editorId: true
          }
        },
        review_assignments: {
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
    
    const isPublished = manuscript.status === 'PUBLISHED' || manuscript.status === 'RETRACTED';
    const isAuthor = req.user && manuscript.manuscript_authors.some((rel: any) => rel.userId === req.user!.id);
    const isActionEditor = req.user && manuscript.action_editors?.editorId === req.user.id;
    const isReviewer = req.user && manuscript.review_assignments.some((review: any) => review.reviewerId === req.user!.id);
    
    console.log('DEBUG: Permission context - isPublished:', isPublished, 'isAuthor:', isAuthor, 'isActionEditor:', isActionEditor, 'isReviewer:', isReviewer);
    console.log('DEBUG: Bot context:', req.botContext);
    
    // Check if this is a bot request for the same manuscript
    const isBotWithAccess = req.botContext && req.botContext.manuscriptId === id;
    console.log('DEBUG: Bot has access:', isBotWithAccess);
    
    const canView = isBotWithAccess || hasManuscriptPermission(
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
      authorDetails: manuscript.manuscript_authors.map((rel: any) => ({
        id: rel.users.id,
        name: rel.users.name,
        email: rel.users.email,
        orcidId: rel.users.orcidId,
        order: rel.order,
        isCorresponding: rel.isCorresponding
      })),
      keywords: manuscript.keywords,
      status: manuscript.status,
      submittedAt: manuscript.submittedAt,
      publishedAt: manuscript.publishedAt,
      updatedAt: manuscript.updatedAt,
      doi: manuscript.doi,
      fileUrl: manuscript.fileUrl,
      metadata: manuscript.metadata,
      conversationCount: manuscript._count.conversations,
      files: manuscript.manuscript_files.map((file: any) => ({
        id: file.id,
        originalName: file.originalName,
        mimetype: file.mimetype,
        size: file.size,
        uploadedAt: file.uploadedAt,
        downloadUrl: `/api/articles/${manuscript.id}/files/${file.id}/download`
      })),
      conversations: manuscript.conversations.map((conv: any) => ({
        id: conv.id,
        title: conv.title,
        type: conv.type,
        privacy: conv.privacy,
        messageCount: conv._count.messages,
        participantCount: conv._count.conversation_participants,
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


// Custom middleware that handles both user and bot authentication for file downloads
const authenticateForFileDownload = async (req: Request, res: Response, next: NextFunction) => {
  // Try bot authentication first
  const botToken = req.headers['x-bot-token'] as string;
  if (botToken) {
    return authenticateWithBots(req, res, next);
  }
  
  // Fall back to optional user authentication
  return optionalAuth(req, res, next);
};

// GET /api/manuscripts/:id/files/:fileId/download - Download specific file
router.get('/:id/files/:fileId/download', authenticateForFileDownload, async (req, res, next) => {
  try {
    const { id, fileId } = req.params;
    console.log(`DEBUG: Download endpoint hit - manuscriptId: ${id}, fileId: ${fileId}`);
    console.log(`DEBUG: User:`, req.user ? `${req.user.email} (${req.user.role})` : 'none');
    console.log(`DEBUG: Bot context:`, req.botContext ? `${req.botContext.botId} for ${req.botContext.manuscriptId}` : 'none');

    const file = await prisma.manuscriptFile.findFirst({
      where: {
        id: fileId,
        manuscriptId: id
      }
    });

    console.log(`DEBUG: File lookup result:`, file);

    if (!file) {
      console.log(`DEBUG: File not found in database - fileId: ${fileId}, manuscriptId: ${id}`);
      return res.status(404).json({
        error: 'File not found',
        message: 'The requested file does not exist or is not associated with this manuscript'
      });
    }

    // Check if user/bot has permission to download this file
    const isBotWithAccess = req.botContext && req.botContext.manuscriptId === id;
    
    if (!isBotWithAccess && !req.user) {
      // No authentication at all - check if file is from a published manuscript
      const manuscript = await prisma.manuscripts.findUnique({
        where: { id }
      });
      
      if (!manuscript || (manuscript.status !== 'PUBLISHED' && manuscript.status !== 'RETRACTED')) {
        return res.status(403).json({
          error: 'Access Denied',
          message: 'Authentication required to download this file'
        });
      }
    }
    
    console.log(`DEBUG: File download authorized - bot: ${!!isBotWithAccess}, user: ${!!req.user}`);

    // Check if file exists on disk
    // Handle both absolute and relative paths
    let filePath = file.path;
    if (filePath.startsWith('/uploads/')) {
      // Convert absolute path starting with /uploads/ to relative path
      filePath = '.' + filePath;
    }
    
    console.log(`DEBUG: Original path: ${file.path}`);
    console.log(`DEBUG: Resolved path: ${filePath}`);
    console.log(`DEBUG: Full absolute path: ${path.resolve(filePath)}`);
    console.log(`DEBUG: File exists check: ${fs.existsSync(filePath)}`);
    
    if (!fs.existsSync(filePath)) {
      console.log(`DEBUG: File not found on disk at: ${filePath}`);
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
    const fileStream = fs.createReadStream(filePath);
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
    const existingManuscript = await prisma.manuscripts.findUnique({
      where: { id },
      include: {
        manuscript_authors: {
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
    const isAuthor = existingManuscript.manuscript_authors.length > 0;
    const isEditor = req.user!.role === GlobalRole.EDITOR_IN_CHIEF || req.user!.role === GlobalRole.ADMIN;
    
    if (!isAuthor && !isEditor) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'You do not have permission to edit this manuscript'
      });
    }

    // Update manuscript
    const manuscript = await prisma.manuscripts.update({
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
    const manuscript = await prisma.manuscripts.findUnique({
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
            conversation_participants: true
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
      participantCount: conv._count.conversation_participants,
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

// GET /api/manuscripts/:id/files - List all files for a manuscript
router.get('/:id/files', authenticateWithBots, async (req, res, next) => {
  try {
    const { id } = req.params;

    // Get manuscript files
    const files = await prisma.manuscriptFile.findMany({
      where: { manuscriptId: id },
      orderBy: [
        { fileType: 'asc' }, // GROUP BY file type
        { originalName: 'asc' }
      ]
    });

    // Format files with download URLs
    const formattedFiles = files.map(file => ({
      id: file.id,
      originalName: file.originalName,
      filename: file.filename,
      mimetype: file.mimetype,
      size: file.size,
      fileType: file.fileType,
      detectedFormat: file.detectedFormat,
      fileExtension: file.fileExtension,
      uploadedAt: file.uploadedAt,
      downloadUrl: `/api/articles/${id}/files/${file.id}/download`
    }));

    res.json({
      files: formattedFiles,
      total: formattedFiles.length,
      byType: {
        source: formattedFiles.filter(f => f.fileType === 'SOURCE').length,
        asset: formattedFiles.filter(f => f.fileType === 'ASSET').length,
        rendered: formattedFiles.filter(f => f.fileType === 'RENDERED').length,
        supplementary: formattedFiles.filter(f => f.fileType === 'SUPPLEMENTARY').length
      }
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/manuscripts/:id/files - Upload additional files (for bots)
router.post('/:id/files', authenticateWithBots, upload.array('file', 5), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { fileType = 'SUPPLEMENTARY', renderedBy } = req.body;
    
    // Verify manuscript exists
    const manuscript = await prisma.manuscripts.findUnique({
      where: { id }
    });

    if (!manuscript) {
      return res.status(404).json({
        error: 'Manuscript not found',
        message: `No manuscript found with ID: ${id}`
      });
    }

    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({
        error: 'No files provided',
        message: 'At least one file must be uploaded'
      });
    }

    const uploadedFiles = [];

    for (const file of files) {
      try {
        // Calculate checksum
        const fileContent = fs.readFileSync(file.path);
        const crypto = require('crypto');
        const checksum = crypto.createHash('sha256').update(fileContent).digest('hex');
        
        // Detect format
        const formatDetectionResult = await formatDetection.detectFormat(
          file.originalname,
          file.mimetype,
          fileContent
        );

        // Create file record
        const manuscriptFile = await prisma.manuscriptFile.create({
          data: {
            manuscriptId: id,
            filename: file.filename,
            originalName: file.originalname,
            mimetype: file.mimetype,
            size: file.size,
            path: file.path,
            fileType: fileType as ManuscriptFileType,
            storageType: StorageType.LOCAL,
            checksum,
            encoding: file.mimetype.startsWith('text/') ? 'utf-8' : undefined,
            detectedFormat: formatDetectionResult.detectedFormat,
            fileExtension: path.extname(file.originalname).toLowerCase(),
            // metadata field doesn't exist in schema, removing
          }
        });

        uploadedFiles.push({
          id: manuscriptFile.id,
          originalName: manuscriptFile.originalName,
          filename: manuscriptFile.filename,
          mimetype: manuscriptFile.mimetype,
          size: manuscriptFile.size,
          fileType: manuscriptFile.fileType,
          downloadUrl: `/api/articles/${id}/files/${manuscriptFile.id}/download`
        });

      } catch (error) {
        console.error(`Failed to process file ${file.originalname}:`, error);
        // Clean up the uploaded file if processing failed
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
        
        return res.status(500).json({
          error: 'File processing failed',
          message: `Failed to process file: ${file.originalname}`
        });
      }
    }

    res.json({
      message: 'Files uploaded successfully',
      files: uploadedFiles,
      count: uploadedFiles.length
    });

  } catch (error) {
    next(error);
  }
});

// DELETE /api/manuscripts/:id/files/:fileId - Delete a specific file
router.delete('/:id/files/:fileId', authenticate, async (req, res, next) => {
  try {
    const { id: manuscriptId, fileId } = req.params;

    // Find the file
    const file = await prisma.manuscriptFile.findFirst({
      where: {
        id: fileId,
        manuscriptId: manuscriptId
      }
    });

    if (!file) {
      return res.status(404).json({
        error: 'File not found',
        message: 'File not found or does not belong to this manuscript'
      });
    }

    // Check permissions (authors and editors can delete files)
    const manuscript = await prisma.manuscripts.findUnique({
      where: { id: manuscriptId },
      include: {
        manuscript_authors: {
          where: { userId: req.user!.id }
        }
      }
    });

    const isAuthor = manuscript?.manuscript_authors.length ?? 0 > 0;
    const isEditor = req.user!.role === GlobalRole.EDITOR_IN_CHIEF || req.user!.role === GlobalRole.ADMIN;
    
    if (!isAuthor && !isEditor) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'You do not have permission to delete files from this manuscript'
      });
    }

    // Delete file from filesystem
    if (fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }

    // Delete file record from database
    await prisma.manuscriptFile.delete({
      where: { id: fileId }
    });

    res.json({
      message: 'File deleted successfully',
      deletedFile: {
        id: file.id,
        originalName: file.originalName
      }
    });

  } catch (error) {
    next(error);
  }
});

// Middleware to check action editor assignment permissions
const requireActionEditorPermission = (req: any, res: any, next: any) => {
  const userRole = req.user?.role as GlobalRole;
  if (!hasGlobalPermission(userRole, GlobalPermission.ASSIGN_ACTION_EDITORS)) {
    return res.status(403).json({
      error: 'Insufficient permissions',
      message: 'You do not have permission to assign action editors'
    });
  }
  next();
};

// POST /api/manuscripts/:id/action-editor - Assign action editor
router.post('/:id/action-editor', authenticate, requireActionEditorPermission, async (req, res, next) => {
  try {
    const { id: manuscriptId } = req.params;
    const { editorId } = req.body;

    // Validate input
    const assignmentSchema = z.object({
      editorId: z.string().min(1, 'Editor ID is required')
    });

    const validatedData = assignmentSchema.parse({ editorId });

    // Check if manuscript exists
    const manuscript = await prisma.manuscripts.findUnique({
      where: { id: manuscriptId },
      include: {
        action_editors: {
          include: {
            editor: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          }
        }
      }
    });

    if (!manuscript) {
      return res.status(404).json({
        error: 'Manuscript not found',
        message: `No manuscript found with ID: ${manuscriptId}`
      });
    }

    // Verify the editor exists and has appropriate role
    const editor = await prisma.users.findUnique({
      where: { id: validatedData.editorId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true
      }
    });

    if (!editor) {
      return res.status(404).json({
        error: 'Editor not found',
        message: `No user found with ID: ${validatedData.editorId}`
      });
    }

    // Verify the user has appropriate role to be an action editor
    const validEditorRoles = [GlobalRole.ADMIN, GlobalRole.EDITOR_IN_CHIEF, GlobalRole.MANAGING_EDITOR];
    if (!validEditorRoles.includes(editor.role as GlobalRole)) {
      return res.status(400).json({
        error: 'Invalid editor role',
        message: 'Only users with editor, managing editor, or admin roles can be assigned as action editors'
      });
    }

    // Check if action editor already assigned
    if (manuscript.action_editors) {
      // Update existing assignment
      const updatedAssignment = await prisma.action_editors.update({
        where: { manuscriptId },
        data: {
          editorId: validatedData.editorId,
          assignedAt: new Date()
        },
        include: {
          editor: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true
            }
          }
        }
      });

      return res.json({
        message: 'Action editor updated successfully',
        assignment: {
          manuscriptId,
          editor: updatedAssignment.editor,
          assignedAt: updatedAssignment.assignedAt,
          previousEditor: manuscript.action_editors.editor
        }
      });
    } else {
      // Create new assignment
      const newAssignment = await prisma.action_editors.create({
        data: {
          manuscriptId,
          editorId: validatedData.editorId,
          assignedAt: new Date()
        },
        include: {
          editor: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true
            }
          }
        }
      });

      return res.status(201).json({
        message: 'Action editor assigned successfully',
        assignment: {
          manuscriptId,
          editor: newAssignment.editor,
          assignedAt: newAssignment.assignedAt
        }
      });
    }

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Invalid assignment data',
        details: error.errors.reduce((acc, err) => {
          acc[err.path.join('.')] = err.message;
          return acc;
        }, {} as Record<string, string>)
      });
    }
    next(error);
  }
});

// PUT /api/manuscripts/:id/action-editor - Update action editor assignment
router.put('/:id/action-editor', authenticate, requireActionEditorPermission, async (req, res, next) => {
  try {
    const { id: manuscriptId } = req.params;
    const { editorId } = req.body;

    // Validate input
    const updateSchema = z.object({
      editorId: z.string().min(1, 'Editor ID is required')
    });

    const validatedData = updateSchema.parse({ editorId });

    // Check if assignment exists
    const existingAssignment = await prisma.action_editors.findUnique({
      where: { manuscriptId },
      include: {
        editor: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    if (!existingAssignment) {
      return res.status(404).json({
        error: 'Action editor assignment not found',
        message: 'No action editor is currently assigned to this manuscript'
      });
    }

    // Verify the new editor exists and has appropriate role
    const newEditor = await prisma.users.findUnique({
      where: { id: validatedData.editorId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true
      }
    });

    if (!newEditor) {
      return res.status(404).json({
        error: 'Editor not found',
        message: `No user found with ID: ${validatedData.editorId}`
      });
    }

    const validEditorRoles = [GlobalRole.ADMIN, GlobalRole.EDITOR_IN_CHIEF, GlobalRole.MANAGING_EDITOR];
    if (!validEditorRoles.includes(newEditor.role as GlobalRole)) {
      return res.status(400).json({
        error: 'Invalid editor role',
        message: 'Only users with editor, managing editor, or admin roles can be assigned as action editors'
      });
    }

    // Update assignment
    const updatedAssignment = await prisma.action_editors.update({
      where: { manuscriptId },
      data: {
        editorId: validatedData.editorId,
        assignedAt: new Date()
      },
      include: {
        editor: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        }
      }
    });

    res.json({
      message: 'Action editor assignment updated successfully',
      assignment: {
        manuscriptId,
        editor: updatedAssignment.editor,
        assignedAt: updatedAssignment.assignedAt,
        previousEditor: existingAssignment.editor
      }
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Invalid update data',
        details: error.errors.reduce((acc, err) => {
          acc[err.path.join('.')] = err.message;
          return acc;
        }, {} as Record<string, string>)
      });
    }
    next(error);
  }
});

// DELETE /api/manuscripts/:id/action-editor - Remove action editor assignment
router.delete('/:id/action-editor', authenticate, requireActionEditorPermission, async (req, res, next) => {
  try {
    const { id: manuscriptId } = req.params;

    // Check if assignment exists
    const existingAssignment = await prisma.action_editors.findUnique({
      where: { manuscriptId },
      include: {
        editor: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    if (!existingAssignment) {
      return res.status(404).json({
        error: 'Action editor assignment not found',
        message: 'No action editor is currently assigned to this manuscript'
      });
    }

    // Remove assignment
    await prisma.action_editors.delete({
      where: { manuscriptId }
    });

    res.json({
      message: 'Action editor assignment removed successfully',
      removedAssignment: {
        manuscriptId,
        editor: existingAssignment.editor,
        assignedAt: existingAssignment.assignedAt
      }
    });

  } catch (error) {
    next(error);
  }
});

// GET /api/manuscripts/:id/action-editor - Get current action editor assignment
router.get('/:id/action-editor', authenticate, async (req, res, next) => {
  try {
    const { id: manuscriptId } = req.params;

    // Check if user has permission to view manuscript
    const hasPermission = hasManuscriptPermission(
      req.user!.role as GlobalRole, 
      ManuscriptPermission.VIEW_MANUSCRIPT,
      {
        // TODO: Add proper context checking for isAuthor, isActionEditor, etc.
        isPublished: false // For now, assume not published since we're checking permissions
      }
    );

    if (!hasPermission) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'You do not have permission to view this manuscript'
      });
    }

    // Get assignment
    const assignment = await prisma.action_editors.findUnique({
      where: { manuscriptId },
      include: {
        editor: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            affiliation: true
          }
        }
      }
    });

    if (!assignment) {
      return res.json({
        assignment: null,
        message: 'No action editor is currently assigned to this manuscript'
      });
    }

    res.json({
      assignment: {
        manuscriptId,
        editor: assignment.editor,
        assignedAt: assignment.assignedAt
      }
    });

  } catch (error) {
    next(error);
  }
});

// NOTE: Manual conversation creation has been removed. 
// Conversations are now automatically created when manuscripts are submitted.
// This ensures all discussions are tied to specific manuscript submissions.

export default router;