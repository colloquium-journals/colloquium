import { Router, Request, Response, NextFunction, RequestHandler } from 'express';
import { prisma } from '@colloquium/database';
import { ManuscriptFileType, StorageType } from '@prisma/client';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import fsPromises from 'fs/promises';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { authenticate, requireGlobalPermission, optionalAuth, authenticateWithBots } from '../middleware/auth';
import { hasManuscriptPermission, ManuscriptPermission, GlobalRole, GlobalPermission, hasGlobalPermission } from '@colloquium/auth';
import { fileStorage } from '../services/fileStorage';
import { formatDetection } from '../services/formatDetection';
import { addBotJob } from '../jobs';
import { BotEventName, BotApiPermission } from '@colloquium/types';
import { dispatchBotEvent } from '../services/botEventDispatcher';
import { requireBotPermission } from '../middleware/botPermissions';

const router = Router();

// File upload configuration
const uploadDir = path.join(process.cwd(), 'uploads', 'manuscripts');

// Ensure upload directory exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      const manuscriptId = req.params?.id || req.body?.manuscriptId || 'temp';
      const manuscriptDir = path.join(uploadDir, manuscriptId);
      await fsPromises.mkdir(manuscriptDir, { recursive: true });
      cb(null, manuscriptDir);
    } catch (err) {
      cb(err as Error, '');
    }
  },
  filename: async (req, file, cb) => {
    try {
      const originalName = file.originalname;
      const manuscriptId = req.params?.id || req.body?.manuscriptId || 'temp';
      const manuscriptDir = path.join(uploadDir, manuscriptId);

      let finalFilename = originalName;
      let counter = 1;

      while (true) {
        try {
          await fsPromises.access(path.join(manuscriptDir, finalFilename));
          const ext = path.extname(originalName);
          const baseName = path.basename(originalName, ext);
          finalFilename = `${baseName}_${counter}${ext}`;
          counter++;
        } catch {
          break; // File doesn't exist, use this name
        }
      }

      cb(null, finalFilename);
    } catch (err) {
      cb(err as Error, '');
    }
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
    files: 20 // Maximum 20 files per submission
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
    isCorresponding: z.boolean().default(false),
    creditRoles: z.array(z.string()).default([])
  })).min(1, 'At least one author is required')
    .refine(authors => {
      const correspondingCount = authors.filter(author => author.isCorresponding).length;
      return correspondingCount === 1;
    }, 'Exactly one corresponding author is required'),
  keywords: z.array(z.string()).default([]),
  funding: z.array(z.object({
    funderName: z.string().min(1, 'Funder name is required'),
    funderDoi: z.string().optional(),
    awardId: z.string().optional(),
    awardTitle: z.string().optional()
  })).default([]),
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
    
    // Articles page always shows only published articles - use /submissions for editorial workflow
    where.status = { in: ['PUBLISHED', 'RETRACTED'] };

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
                  orcidId: true,
                  orcidVerified: true
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
        orcidVerified: rel.users.orcidVerified,
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
router.post('/', authenticate, (req: Request, res: Response, next: NextFunction) => {
  const { GlobalPermission } = require('@colloquium/auth');
  return requireGlobalPermission(GlobalPermission.SUBMIT_MANUSCRIPT)(req, res, next);
}, upload.array('files', 20) as unknown as RequestHandler, async (req, res, next) => {
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
    } else if (typeof req.body.authors === 'string') {
      // Handle authors as JSON string (array or single object)
      try {
        const parsedAuthors = JSON.parse(req.body.authors);
        if (Array.isArray(parsedAuthors)) {
          authorsData = parsedAuthors;
        } else {
          // Single author object
          authorsData = [parsedAuthors];
        }
      } catch (error) {
        console.error('Failed to parse authors JSON string:', error);
        authorsData = [];
      }
    }
    
    // Parse funding data
    let fundingData: Array<{ funderName: string; funderDoi?: string; awardId?: string; awardTitle?: string }> = [];
    if (req.body.funding) {
      try {
        fundingData = typeof req.body.funding === 'string' ? JSON.parse(req.body.funding) : req.body.funding;
      } catch (error) {
        console.error('Failed to parse funding JSON:', error);
      }
    }

    const manuscriptData = manuscriptSubmissionSchema.parse({
      title: req.body.title,
      abstract: req.body.abstract,
      content: req.body.content,
      authors: authorsData,
      keywords: Array.isArray(req.body.keywords) ? req.body.keywords :
                typeof req.body.keywords === 'string' ? req.body.keywords.split(',').map((k: string) => k.trim()) : [],
      funding: fundingData,
      metadata: req.body.metadata ? JSON.parse(req.body.metadata) : {}
    });

    // Server-side validation: check supplemental file count limit
    const files = req.files as Express.Multer.File[];
    if (files && files.length > 0) {
      const assetFileCount = files.filter((file, index) => {
        if (index === 0) return false; // First file is SOURCE
        const ext = path.extname(file.originalname).toLowerCase();
        if (ext === '.bib' || ext === '.bibtex') return false; // Bibliography files
        return true;
      }).length;

      const settingsRecord = await prisma.journal_settings.findFirst({
        where: { id: 'singleton' }
      });
      const journalSettings = (settingsRecord?.settings as any) || {};
      const maxSupplementalFiles = journalSettings.maxSupplementalFiles ?? 10;

      if (maxSupplementalFiles > 0 && assetFileCount > maxSupplementalFiles) {
        // Clean up uploaded files
        await Promise.all(files.map(async (file) => {
          try { await fsPromises.unlink(file.path); } catch {}
        }));
        return res.status(400).json({
          error: 'Validation Error',
          message: `Too many supplemental files. Maximum allowed: ${maxSupplementalFiles}, received: ${assetFileCount}`
        });
      }
    }

    // Start a transaction to ensure data consistency
    const { randomUUID } = require('crypto');
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
          const now = new Date();
          user = await tx.users.create({
            data: {
              id: randomUUID(),
              email: authorData.email.toLowerCase(),
              name: authorData.name,
              role: 'USER', // Default role for new authors
              createdAt: now,
              updatedAt: now
            }
          });
        }
        
        processedAuthors.push({
          userId: user.id,
          name: authorData.name,
          email: authorData.email,
          order: i,
          isCorresponding: authorData.isCorresponding,
          creditRoles: authorData.creditRoles || []
        });
      }
      
      // Create the manuscript
      const manuscript = await tx.manuscripts.create({
        data: {
          id: randomUUID(),
          title: manuscriptData.title.trim(),
          abstract: manuscriptData.abstract.trim(),
          content: manuscriptData.content?.trim() || null,
          authors: processedAuthors.map(author => author.name),
          keywords: manuscriptData.keywords.map(keyword => keyword.trim()).filter(Boolean),
          status: 'SUBMITTED',
          receivedDate: new Date(),
          updatedAt: new Date(),
          metadata: {
            ...manuscriptData.metadata,
            submittedBy: req.user!.id,
            submittedAt: new Date().toISOString()
          }
        }
      });

      // Create author relationships
      for (const author of processedAuthors) {
        await tx.manuscript_authors.create({
          data: {
            id: randomUUID(),
            manuscriptId: manuscript.id,
            userId: author.userId,
            order: author.order,
            isCorresponding: author.isCorresponding,
            creditRoles: author.creditRoles
          }
        });
      }

      // Create funding records
      if (manuscriptData.funding && manuscriptData.funding.length > 0) {
        for (const funding of manuscriptData.funding) {
          await tx.manuscript_funding.create({
            data: {
              manuscriptId: manuscript.id,
              funderName: funding.funderName,
              funderDoi: funding.funderDoi || null,
              awardId: funding.awardId || null,
              awardTitle: funding.awardTitle || null
            }
          });
        }
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
            const fileContent = await fsPromises.readFile(file.path);
            let formatDetectionResult;
            try {
              formatDetectionResult = await formatDetection.detectFormat(
                file.originalname,
                file.mimetype,
                fileContent
              );
            } catch (formatError) {
              console.warn('Format detection failed, using fallback:', formatError instanceof Error ? formatError.message : formatError);
              // Fallback format detection based on file extension
              const ext = path.extname(file.originalname).toLowerCase();
              formatDetectionResult = {
                detectedFormat: ext === '.md' ? 'markdown' : ext === '.tex' ? 'latex' : 'unknown',
                confidence: 0.5,
                warnings: ['Format detection service unavailable, using extension-based detection'],
                errors: []
              };
            }

            // Calculate checksum
            const crypto = require('crypto');
            const checksum = crypto.createHash('sha256').update(fileContent).digest('hex');
            
            // Determine file type based on position and extension
            const ext = path.extname(file.originalname).toLowerCase();
            let fileType: ManuscriptFileType;
            if (i === 0) {
              fileType = ManuscriptFileType.SOURCE;
            } else if (ext === '.bib' || ext === '.bibtex') {
              fileType = ManuscriptFileType.BIBLIOGRAPHY;
            } else {
              fileType = ManuscriptFileType.ASSET;
            }
            
            // Correct MIME type for known academic formats
            let correctedMimeType = file.mimetype;

            if (file.mimetype === 'application/octet-stream') {
              switch (ext) {
                case '.md':
                case '.markdown':
                  correctedMimeType = 'text/markdown';
                  break;
                case '.bib':
                case '.bibtex':
                  correctedMimeType = 'text/plain';
                  break;
                case '.tex':
                case '.latex':
                  correctedMimeType = 'text/x-tex';
                  break;
                case '.txt':
                  correctedMimeType = 'text/plain';
                  break;
                case '.json':
                  correctedMimeType = 'application/json';
                  break;
                case '.xml':
                  correctedMimeType = 'text/xml';
                  break;
                case '.csv':
                  correctedMimeType = 'text/csv';
                  break;
              }
            }
            
            // Detect encoding for text files
            const encoding = (correctedMimeType.startsWith('text/') || correctedMimeType === 'application/json') ? 'utf-8' : undefined;
            
            const manuscriptFile = await tx.manuscript_files.create({
              data: {
                id: randomUUID(),
                manuscriptId: manuscript.id,
                filename: file.filename,
                originalName: file.originalname,
                mimetype: correctedMimeType,
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
            try { await fsPromises.unlink(file.path); } catch {}
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
      const conversation = await tx.conversations.create({
        data: {
          id: randomUUID(),
          title: `Discussion: ${manuscript.title}`,
          type: 'REVIEW',
          privacy: 'SEMI_PUBLIC', // Visible to journal members
          manuscriptId: manuscript.id,
          updatedAt: new Date(),
          conversation_participants: {
            create: [{
              id: randomUUID(),
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

    // Fire-and-forget: auto-invoke bot commands configured in journal settings
    setImmediate(async () => {
      try {
        const settingsRecord = await prisma.journal_settings.findFirst({
          where: { id: 'singleton' }
        });
        const journalSettings = (settingsRecord?.settings as any) || {};
        const autoCommands: string[] = journalSettings.autoSubmissionCommands || [];
        if (autoCommands.length === 0) return;

        const botUser = await prisma.users.findFirst({
          where: { email: 'editorial-bot@colloquium.bot' }
        });
        if (!botUser) return;

        for (const command of autoCommands) {
          const message = await prisma.messages.create({
            data: {
              id: randomUUID(),
              content: command,
              conversationId: result.conversation.id,
              authorId: botUser.id,
              privacy: 'AUTHOR_VISIBLE',
              isBot: false,
              updatedAt: new Date(),
              metadata: { type: 'auto_submission_command' }
            }
          });

          // Add job to the bot processing queue (uses PostgreSQL via graphile-worker)
          await addBotJob({
            messageId: message.id,
            conversationId: result.conversation.id,
            userId: botUser.id,
            manuscriptId: result.manuscript.id
          });
        }
      } catch (err) {
        console.error('Failed to auto-invoke submission commands:', err);
      }
    });

    // Fire-and-forget: dispatch manuscript.submitted event to bots
    setImmediate(async () => {
      try {
        await dispatchBotEvent(BotEventName.MANUSCRIPT_SUBMITTED, result.manuscript.id, {
          manuscriptId: result.manuscript.id,
        });
      } catch (err) {
        console.error('Failed to dispatch manuscript.submitted event:', err);
      }
    });
  } catch (error) {
    // Clean up uploaded files if manuscript creation failed
    if (req.files) {
      const files = req.files as Express.Multer.File[];
      await Promise.all(files.map(async (file) => {
        try { await fsPromises.unlink(file.path); } catch {}
      }));
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
                orcidId: true,
                orcidVerified: true
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
          include: {
            users_action_editors_editorIdTousers: {
              select: {
                id: true,
                name: true,
                email: true,
                affiliation: true
              }
            }
          }
        },
        review_assignments: {
          include: {
            users: {
              select: {
                id: true,
                name: true,
                email: true,
                affiliation: true
              }
            }
          },
          orderBy: { assignedAt: 'desc' }
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

    const isPublished = manuscript.status === 'PUBLISHED' || manuscript.status === 'RETRACTED';
    const isSubmitted = Boolean(manuscript.status); // Any manuscript with a status is considered submitted
    const isAuthor = req.user && manuscript.manuscript_authors.some((rel: any) => rel.userId === req.user!.id);
    const isActionEditor = req.user && manuscript.action_editors?.editorId === req.user.id;
    const isReviewer = req.user && manuscript.review_assignments.some((review: any) => review.reviewerId === req.user!.id);
    
    // Check if this is a bot request for the same manuscript
    const isBotWithAccess = req.botContext && req.botContext.manuscriptId === id;
    
    const canView = isBotWithAccess || hasManuscriptPermission(
      req.user?.role || GlobalRole.USER,
      ManuscriptPermission.VIEW_MANUSCRIPT,
      {
        isAuthor,
        isActionEditor,
        isReviewer,
        isPublished,
        isSubmitted
      }
    );
    
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
        orcidVerified: rel.users.orcidVerified,
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
        fileType: file.fileType,
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
      action_editors: manuscript.action_editors ? {
        id: manuscript.action_editors.id,
        editorId: manuscript.action_editors.editorId,
        assignedAt: manuscript.action_editors.assignedAt,
        users_action_editors_editorIdTousers: manuscript.action_editors.users_action_editors_editorIdTousers
      } : null,
      reviewAssignments: manuscript.review_assignments.map((assignment: any) => ({
        id: assignment.id,
        reviewer: {
          id: assignment.users.id,
          name: assignment.users.name,
          email: assignment.users.email,
          affiliation: assignment.users.affiliation
        },
        status: assignment.status,
        assignedAt: assignment.assignedAt,
        dueDate: assignment.dueDate,
        completedAt: assignment.completedAt
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

    const file = await prisma.manuscript_files.findFirst({
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

    // Check if user/bot has permission to download this file
    const isBotWithAccess = req.botContext && req.botContext.manuscriptId === id &&
      req.botContext.permissions.includes(BotApiPermission.READ_FILES);

    if (!isBotWithAccess && !req.user) {
      // No authentication at all - check if file is from a submitted, published, or retracted manuscript
      const manuscript = await prisma.manuscripts.findUnique({
        where: { id }
      });
      
      if (!manuscript || !manuscript.status) {
        return res.status(403).json({
          error: 'Access Denied',
          message: 'Authentication required to download this file'
        });
      }
      
    }

    // Check if file exists on disk
    // Handle both absolute and relative paths
    let filePath = file.path;
    if (filePath.startsWith('/uploads/')) {
      // Convert absolute path starting with /uploads/ to relative path
      filePath = '.' + filePath;
    }
    
    try {
      await fsPromises.access(filePath);
    } catch {
      return res.status(404).json({
        error: 'File not found',
        message: 'The file has been deleted or moved'
      });
    }

    // Set appropriate headers for file download or inline viewing
    const inline = req.query.inline === 'true';

    if (inline && (file.mimetype === 'application/pdf' || file.mimetype === 'text/html')) {
      res.setHeader('Content-Disposition', `inline; filename="${file.originalName}"`);
    } else if (file.mimetype === 'text/html') {
      res.setHeader('Content-Disposition', `inline; filename="${file.originalName}"`);
    } else if (inline && file.mimetype && file.mimetype.startsWith('image/')) {
      res.setHeader('Content-Disposition', `inline; filename="${file.originalName}"`);
    } else {
      res.setHeader('Content-Disposition', `attachment; filename="${file.originalName}"`);
    }

    res.setHeader('Content-Type', file.mimetype);

    const fileStats = await fsPromises.stat(filePath);
    res.setHeader('Content-Length', fileStats.size.toString());

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

    // Track changes for bot notification
    const changes: string[] = [];
    if (title && title.trim() !== existingManuscript.title) {
      changes.push(`**Title:** ${existingManuscript.title} → ${title.trim()}`);
    }
    if (abstract && abstract.trim() !== (existingManuscript.abstract || '')) {
      changes.push(`**Abstract:** Updated`);
    }
    if (keywords && JSON.stringify(keywords) !== JSON.stringify(existingManuscript.keywords || [])) {
      changes.push(`**Keywords:** ${(existingManuscript.keywords || []).join(', ') || 'None'} → ${keywords.join(', ') || 'None'}`);
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

    // Fire-and-forget: dispatch status change event if status was updated
    if (status && status !== existingManuscript.status) {
      setImmediate(async () => {
        try {
          await dispatchBotEvent(BotEventName.MANUSCRIPT_STATUS_CHANGED, id, {
            previousStatus: existingManuscript.status,
            newStatus: status,
          });
        } catch (err) {
          console.error('Failed to dispatch manuscript.statusChanged event:', err);
        }
      });
    }

    // Post bot notification if there were changes
    if (changes.length > 0) {
      try {
        // Find the main conversation for this manuscript
        const conversation = await prisma.conversations.findFirst({
          where: { 
            manuscriptId: id,
            type: 'EDITORIAL'
          }
        });

        if (conversation) {
          const changesList = changes.map(change => `- ${change}`).join('\n');
          await prisma.messages.create({
            data: {
              id: randomUUID(),
              content: `📝 **Manuscript Updated**\n\nThe following changes were made by ${req.user!.name || req.user!.email}:\n\n${changesList}\n\n*Updated: ${new Date().toLocaleString()}*`,
              conversationId: conversation.id,
              authorId: req.user!.id,
              privacy: 'AUTHOR_VISIBLE',
              isBot: true,
              updatedAt: new Date(),
              metadata: {
                type: 'manuscript_metadata_update',
                changes: changes,
                updatedBy: req.user!.id,
                via: 'manuscript_edit'
              }
            }
          });
        }
      } catch (botError) {
        // Don't fail the whole request if bot notification fails
        console.error('Failed to post bot notification:', botError);
      }
    }

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

    const conversations = await prisma.conversations.findMany({
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
router.get('/:id/files', authenticateWithBots, requireBotPermission(BotApiPermission.READ_FILES), async (req, res, next) => {
  try {
    const { id } = req.params;

    // Get manuscript files
    const files = await prisma.manuscript_files.findMany({
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
        supplementary: formattedFiles.filter(f => f.fileType === 'SUPPLEMENTARY').length,
        bibliography: formattedFiles.filter(f => f.fileType === 'BIBLIOGRAPHY').length
      }
    });
  } catch (error) {
    next(error);
  }
});

// Custom middleware that handles both user and bot authentication for file uploads
const authenticateForFileUpload = async (req: Request, res: Response, next: NextFunction) => {
  // Try bot authentication first
  const botToken = req.headers['x-bot-token'] as string;
  if (botToken) {
    return authenticateWithBots(req, res, next);
  }
  
  // Fall back to user authentication for revisions
  return authenticate(req, res, next);
};

// POST /api/manuscripts/:id/files - Upload additional files (for bots and author revisions)
router.post('/:id/files', authenticateForFileUpload, upload.array('files', 10) as unknown as RequestHandler, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { fileType, renderedBy, metadata } = req.body;
    
    // Verify manuscript exists and check permissions
    const manuscript = await prisma.manuscripts.findUnique({
      where: { id },
      include: {
        manuscript_authors: true,
        conversations: {
          orderBy: { createdAt: 'asc' },
          take: 1 // Get the main conversation for this manuscript
        }
      }
    });

    if (!manuscript) {
      return res.status(404).json({
        error: 'Manuscript not found',
        message: `No manuscript found with ID: ${id}`
      });
    }

    // Check permissions for user uploads (bots need upload_files permission)
    const isBotUpload = !!req.botContext;
    if (isBotUpload && !req.botContext!.permissions.includes(BotApiPermission.UPLOAD_FILES)) {
      return res.status(403).json({ error: `Missing permission: ${BotApiPermission.UPLOAD_FILES}` });
    }
    const isRevisionUpload = metadata && JSON.parse(metadata || '{}').uploadType === 'revision';
    
    if (!isBotUpload && req.user) {
      const isAuthor = manuscript.manuscript_authors.some((rel: any) => rel.userId === req.user!.id);
      const isAdmin = req.user.role === GlobalRole.ADMIN;
      
      const canUpload = hasManuscriptPermission(
        req.user.role as GlobalRole, 
        ManuscriptPermission.EDIT_MANUSCRIPT, 
        { isAuthor }
      ) || isAdmin;

      if (!canUpload) {
        return res.status(403).json({
          error: 'Access Denied',
          message: 'You do not have permission to upload files to this manuscript'
        });
      }
    }

    // Base file type: revisions are SOURCE files, bot uploads use provided type or default to SUPPLEMENTARY
    const baseFileType = isRevisionUpload ? 'SOURCE' : (fileType || 'SUPPLEMENTARY');

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
        const fileContent = await fsPromises.readFile(file.path);
        const crypto = require('crypto');
        const checksum = crypto.createHash('sha256').update(fileContent).digest('hex');

        // Correct MIME type for known academic formats
        let correctedMimeType = file.mimetype;
        const ext = path.extname(file.originalname).toLowerCase();

        // Auto-detect bibliography files unless explicitly specified otherwise
        let finalFileType = baseFileType;
        if (!fileType && (ext === '.bib' || ext === '.bibtex')) {
          finalFileType = 'BIBLIOGRAPHY';
        }
        
        if (file.mimetype === 'application/octet-stream') {
          switch (ext) {
            case '.md':
            case '.markdown':
              correctedMimeType = 'text/markdown';
              break;
            case '.bib':
            case '.bibtex':
              correctedMimeType = 'text/plain';
              break;
            case '.tex':
            case '.latex':
              correctedMimeType = 'text/x-tex';
              break;
            case '.txt':
              correctedMimeType = 'text/plain';
              break;
            case '.json':
              correctedMimeType = 'application/json';
              break;
            case '.xml':
              correctedMimeType = 'text/xml';
              break;
            case '.csv':
              correctedMimeType = 'text/csv';
              break;
          }
        }

        // Detect format
        const formatDetectionResult = await formatDetection.detectFormat(
          file.originalname,
          correctedMimeType,
          fileContent
        );

        // For RENDERED files, delete existing files with the same mimetype to avoid duplicates
        if (finalFileType === 'RENDERED') {
          const existingRenderedFiles = await prisma.manuscript_files.findMany({
            where: {
              manuscriptId: id,
              fileType: 'RENDERED',
              mimetype: correctedMimeType
            }
          });

          // Delete existing files from filesystem and database
          for (const existingFile of existingRenderedFiles) {
            try {
              try { await fsPromises.unlink(existingFile.path); } catch {}
              await prisma.manuscript_files.delete({
                where: { id: existingFile.id }
              });
            } catch (deleteError) {
              console.error(`Failed to delete existing file ${existingFile.originalName}:`, deleteError);
            }
          }
        }

        // For revision uploads (SOURCE files), replace files with the same name/extension
        if (isRevisionUpload && finalFileType === 'SOURCE') {
          const fileExtension = path.extname(file.originalname).toLowerCase();
          const existingSourceFiles = await prisma.manuscript_files.findMany({
            where: {
              manuscriptId: id,
              fileType: 'SOURCE',
              fileExtension: fileExtension
            }
          });

          // Delete existing source files with the same extension
          for (const existingFile of existingSourceFiles) {
            try {
              try { await fsPromises.unlink(existingFile.path); } catch {}
              await prisma.manuscript_files.delete({
                where: { id: existingFile.id }
              });
            } catch (deleteError) {
              console.error(`Failed to delete existing file ${existingFile.originalName}:`, deleteError);
            }
          }
        }

        // Create file record
        const manuscriptFile = await prisma.manuscript_files.create({
          data: {
            id: randomUUID(),
            manuscriptId: id,
            filename: file.filename,
            originalName: file.originalname,
            mimetype: correctedMimeType,
            size: file.size,
            path: file.path,
            fileType: finalFileType as ManuscriptFileType,
            storageType: StorageType.LOCAL,
            checksum,
            encoding: (correctedMimeType.startsWith('text/') || correctedMimeType === 'application/json') ? 'utf-8' : undefined,
            detectedFormat: formatDetectionResult.detectedFormat,
            fileExtension: path.extname(file.originalname).toLowerCase()
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
        try { await fsPromises.unlink(file.path); } catch {}

        return res.status(500).json({
          error: 'File processing failed',
          message: `Failed to process file: ${file.originalname}`
        });
      }
    }

    // Post notification to thread if this is a revision upload by a user
    if (isRevisionUpload && req.user && manuscript.conversations.length > 0) {
      try {
        // Find the editorial bot user
        const editorialBot = await prisma.users.findFirst({
          where: { 
            role: 'BOT',
            email: { contains: 'editorial' }
          }
        });

        if (editorialBot) {
          const conversation = manuscript.conversations[0];
          const fileNames = uploadedFiles.map(f => f.originalName).join(', ');
          const notificationContent = `📄 **File Revision Uploaded**\n\n**Author:** ${req.user.name}\n**Files:** ${fileNames}\n**Time:** ${new Date().toLocaleString()}`;

          await prisma.messages.create({
            data: {
              id: randomUUID(),
              content: notificationContent,
              conversationId: conversation.id,
              authorId: editorialBot.id,
              isBot: true,
              privacy: 'AUTHOR_VISIBLE',
              createdAt: new Date(),
              updatedAt: new Date(),
              metadata: {
                type: 'file_revision_notification',
                uploadedBy: req.user.id,
                uploadedByName: req.user.name,
                fileIds: uploadedFiles.map(f => f.id),
                uploadedAt: new Date().toISOString()
              }
            }
          });
        }
      } catch (notificationError) {
        console.error('Failed to post revision notification:', notificationError);
        // Don't fail the upload if notification posting fails
      }
    }

    res.json({
      message: 'Files uploaded successfully',
      files: uploadedFiles,
      count: uploadedFiles.length
    });

    // Fire-and-forget: dispatch file.uploaded events for each uploaded file
    for (const uploadedFile of uploadedFiles) {
      setImmediate(async () => {
        try {
          await dispatchBotEvent(BotEventName.FILE_UPLOADED, id, {
            file: {
              id: uploadedFile.id,
              name: uploadedFile.originalName,
              type: uploadedFile.fileType,
              mimetype: uploadedFile.mimetype,
            },
          });
        } catch (err) {
          console.error('Failed to dispatch file.uploaded event:', err);
        }
      });
    }

  } catch (error) {
    next(error);
  }
});

// DELETE /api/manuscripts/:id/files/:fileId - Delete a specific file
router.delete('/:id/files/:fileId', authenticate, async (req, res, next) => {
  try {
    const { id: manuscriptId, fileId } = req.params;

    // Find the file
    const file = await prisma.manuscript_files.findFirst({
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
    try { await fsPromises.unlink(file.path); } catch {}

    // Delete file record from database
    await prisma.manuscript_files.delete({
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
            users_action_editors_editorIdTousers: {
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
    const validEditorRoles = [GlobalRole.ADMIN, GlobalRole.EDITOR_IN_CHIEF, GlobalRole.ACTION_EDITOR];
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
          users_action_editors_editorIdTousers: {
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
          editor: updatedAssignment.users_action_editors_editorIdTousers,
          assignedAt: updatedAssignment.assignedAt,
          previousEditor: manuscript.action_editors.users_action_editors_editorIdTousers
        }
      });
    } else {
      // Create new assignment
      const newAssignment = await prisma.action_editors.create({
        data: {
          id: require('crypto').randomUUID(),
          manuscriptId,
          editorId: validatedData.editorId,
          assignedAt: new Date()
        },
        include: {
          users_action_editors_editorIdTousers: {
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
          editor: newAssignment.users_action_editors_editorIdTousers,
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
        users_action_editors_editorIdTousers: {
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

    const validEditorRoles = [GlobalRole.ADMIN, GlobalRole.EDITOR_IN_CHIEF, GlobalRole.ACTION_EDITOR];
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
        users_action_editors_editorIdTousers: {
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
        editor: updatedAssignment.users_action_editors_editorIdTousers,
        assignedAt: updatedAssignment.assignedAt,
        previousEditor: existingAssignment.users_action_editors_editorIdTousers
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
        users_action_editors_editorIdTousers: {
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
        editor: existingAssignment.users_action_editors_editorIdTousers,
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

    // Get manuscript to check permissions
    const manuscript = await prisma.manuscripts.findUnique({
      where: { id: manuscriptId },
      include: {
        manuscript_authors: true,
        action_editors: true,
        review_assignments: true
      }
    });

    if (!manuscript) {
      return res.status(404).json({ 
        error: 'Manuscript not found',
        message: `No manuscript found with ID: ${manuscriptId}`
      });
    }

    // Check if user has permission to view manuscript
    const isPublished = manuscript.status === 'PUBLISHED' || manuscript.status === 'RETRACTED';
    const isSubmitted = Boolean(manuscript.status);
    const isAuthor = manuscript.manuscript_authors.some((rel: any) => rel.userId === req.user!.id);
    const isActionEditor = manuscript.action_editors?.editorId === req.user!.id;
    const isReviewer = manuscript.review_assignments.some((review: any) => review.reviewerId === req.user!.id);

    const hasPermission = hasManuscriptPermission(
      req.user!.role as GlobalRole, 
      ManuscriptPermission.VIEW_MANUSCRIPT,
      {
        isAuthor,
        isActionEditor,
        isReviewer,
        isPublished,
        isSubmitted
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
        users_action_editors_editorIdTousers: {
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
        editor: assignment.users_action_editors_editorIdTousers,
        assignedAt: assignment.assignedAt
      }
    });

  } catch (error) {
    next(error);
  }
});

// POST /api/articles/:id/reviewers - Create reviewer assignment
router.post('/:id/reviewers', authenticateWithBots, requireBotPermission(BotApiPermission.MANAGE_REVIEWERS), async (req, res, next) => {
  try {
    const { id: manuscriptId } = req.params;
    const { reviewerId, status = 'PENDING', dueDate } = req.body;

    // Bot scope validation: bots can only manage reviewers for their assigned manuscript
    if ((req as any).botContext && (req as any).botContext.manuscriptId !== manuscriptId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Bot can only manage reviewers for its assigned manuscript'
      });
    }

    // Validate required fields
    if (!reviewerId) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'reviewerId is required'
      });
    }

    // Check if manuscript exists
    const manuscript = await prisma.manuscripts.findUnique({
      where: { id: manuscriptId },
      select: { id: true, status: true }
    });

    if (!manuscript) {
      return res.status(404).json({
        error: 'Manuscript not found',
        message: `No manuscript found with ID: ${manuscriptId}`
      });
    }

    // Check if reviewer exists
    const reviewer = await prisma.users.findUnique({
      where: { id: reviewerId },
      select: { id: true, name: true, email: true, affiliation: true }
    });

    if (!reviewer) {
      return res.status(404).json({
        error: 'Reviewer not found',
        message: `No user found with ID: ${reviewerId}`
      });
    }

    // Check if assignment already exists
    const existingAssignment = await prisma.review_assignments.findUnique({
      where: {
        manuscriptId_reviewerId: {
          manuscriptId,
          reviewerId
        }
      }
    });

    if (existingAssignment) {
      return res.status(409).json({
        error: 'Assignment already exists',
        message: 'This reviewer is already assigned to this manuscript'
      });
    }

    // Create the assignment with a response token for email-based auth
    const crypto = require('crypto');
    const responseToken = crypto.randomBytes(32).toString('hex');

    const assignment = await prisma.review_assignments.create({
      data: {
        id: crypto.randomUUID(),
        manuscriptId,
        reviewerId,
        status,
        assignedAt: new Date(),
        dueDate: dueDate ? new Date(dueDate) : null,
        responseToken
      },
      include: {
        users: {
          select: {
            id: true,
            name: true,
            email: true,
            affiliation: true
          }
        }
      }
    });

    res.status(201).json({
      message: 'Reviewer assignment created successfully',
      assignment: {
        id: assignment.id,
        responseToken: assignment.responseToken,
        reviewer: {
          id: assignment.users.id,
          name: assignment.users.name,
          email: assignment.users.email,
          affiliation: assignment.users.affiliation
        },
        status: assignment.status,
        assignedAt: assignment.assignedAt,
        dueDate: assignment.dueDate,
        completedAt: assignment.completedAt
      }
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/articles/:id/reviewers/:reviewerId - Update reviewer assignment
router.put('/:id/reviewers/:reviewerId', authenticateWithBots, requireBotPermission(BotApiPermission.MANAGE_REVIEWERS), async (req, res, next) => {
  try {
    const { id: manuscriptId, reviewerId } = req.params;
    const { status, dueDate, completedAt } = req.body;

    // Bot scope validation: bots can only manage reviewers for their assigned manuscript
    if ((req as any).botContext && (req as any).botContext.manuscriptId !== manuscriptId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Bot can only manage reviewers for its assigned manuscript'
      });
    }

    // Find the assignment
    const assignment = await prisma.review_assignments.findUnique({
      where: {
        manuscriptId_reviewerId: {
          manuscriptId,
          reviewerId
        }
      },
      include: {
        users: {
          select: {
            id: true,
            name: true,
            email: true,
            affiliation: true
          }
        }
      }
    });

    if (!assignment) {
      return res.status(404).json({
        error: 'Assignment not found',
        message: 'No reviewer assignment found for this manuscript and reviewer'
      });
    }

    // Update the assignment
    const updateData: any = {};
    if (status !== undefined) updateData.status = status;
    if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : null;
    if (completedAt !== undefined) updateData.completedAt = completedAt ? new Date(completedAt) : null;

    const updatedAssignment = await prisma.review_assignments.update({
      where: { id: assignment.id },
      data: updateData,
      include: {
        users: {
          select: {
            id: true,
            name: true,
            email: true,
            affiliation: true
          }
        }
      }
    });

    res.json({
      message: 'Reviewer assignment updated successfully',
      assignment: {
        id: updatedAssignment.id,
        reviewer: {
          id: updatedAssignment.users.id,
          name: updatedAssignment.users.name,
          email: updatedAssignment.users.email,
          affiliation: updatedAssignment.users.affiliation
        },
        status: updatedAssignment.status,
        assignedAt: updatedAssignment.assignedAt,
        dueDate: updatedAssignment.dueDate,
        completedAt: updatedAssignment.completedAt
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/articles/:id/reviewers/:reviewerId - Get specific reviewer assignment
router.get('/:id/reviewers/:reviewerId', authenticateWithBots, requireBotPermission(BotApiPermission.READ_MANUSCRIPT), async (req, res, next) => {
  try {
    const { id: manuscriptId, reviewerId } = req.params;

    const assignment = await prisma.review_assignments.findUnique({
      where: {
        manuscriptId_reviewerId: {
          manuscriptId,
          reviewerId
        }
      },
      include: {
        users: {
          select: {
            id: true,
            name: true,
            email: true,
            affiliation: true
          }
        }
      }
    });

    if (!assignment) {
      return res.status(404).json({
        error: 'Assignment not found',
        message: 'No reviewer assignment found for this manuscript and reviewer'
      });
    }

    res.json({
      assignment: {
        id: assignment.id,
        reviewer: {
          id: assignment.users.id,
          name: assignment.users.name,
          email: assignment.users.email,
          affiliation: assignment.users.affiliation
        },
        status: assignment.status,
        assignedAt: assignment.assignedAt,
        dueDate: assignment.dueDate,
        completedAt: assignment.completedAt
      }
    });
  } catch (error) {
    next(error);
  }
});

// NOTE: Manual conversation creation has been removed.
// Conversations are now automatically created when manuscripts are submitted.
// This ensures all discussions are tied to specific manuscript submissions.

// ===========================================
// JATS XML Export Endpoints
// ===========================================

import { jatsService } from '../services/jatsService';

// GET /api/articles/:id/export/jats - Generate and return JATS XML for a published manuscript
router.get('/:id/export/jats', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;

    // Verify manuscript exists and is published
    const manuscript = await prisma.manuscripts.findUnique({
      where: { id },
      select: { status: true, title: true }
    });

    if (!manuscript) {
      return res.status(404).json({
        error: 'Manuscript not found',
        message: `No manuscript found with ID: ${id}`
      });
    }

    if (manuscript.status !== 'PUBLISHED') {
      return res.status(400).json({
        error: 'Not published',
        message: 'Only published manuscripts can export JATS XML'
      });
    }

    const result = await jatsService.generateJatsXml(id);

    if (!result.success) {
      return res.status(500).json({
        error: 'JATS generation failed',
        message: result.error
      });
    }

    // Set headers for XML download
    const safeTitle = manuscript.title.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
    res.set('Content-Type', 'application/xml');
    res.set('Content-Disposition', `attachment; filename="${safeTitle}.jats.xml"`);
    res.send(result.xml);

  } catch (error) {
    next(error);
  }
});

// POST /api/articles/:id/export/jats/validate - Validate JATS XML against PMC requirements
router.post('/:id/export/jats/validate', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;

    // Verify manuscript exists
    const manuscript = await prisma.manuscripts.findUnique({
      where: { id },
      select: { status: true }
    });

    if (!manuscript) {
      return res.status(404).json({
        error: 'Manuscript not found',
        message: `No manuscript found with ID: ${id}`
      });
    }

    if (manuscript.status !== 'PUBLISHED') {
      return res.status(400).json({
        error: 'Not published',
        message: 'Only published manuscripts can validate JATS XML'
      });
    }

    // Generate JATS XML
    const result = await jatsService.generateJatsXml(id);

    if (!result.success) {
      return res.status(500).json({
        error: 'JATS generation failed',
        message: result.error
      });
    }

    // Validate the generated XML
    const validation = jatsService.validateForPmc(result.xml!);

    res.json({
      manuscriptId: id,
      validation: validation,
      xmlPreview: result.xml!.substring(0, 500) + '...',
      externalValidators: {
        pmcStyleChecker: 'https://pmc.ncbi.nlm.nih.gov/pub/validation/',
        jats4rValidator: 'https://jats4r.niso.org/jats4r-validator/',
        pmcArticlePreviewer: 'https://pmc.ncbi.nlm.nih.gov/tools/article-previewer-intro/'
      }
    });

  } catch (error) {
    next(error);
  }
});

// PUT /api/articles/:id/subjects - Update subject classifications
router.put('/:id/subjects', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { subjects } = req.body;

    // Validate input
    if (!Array.isArray(subjects)) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'subjects must be an array of strings'
      });
    }

    // Validate each subject is a string
    if (!subjects.every(s => typeof s === 'string')) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'All subjects must be strings'
      });
    }

    // Check if manuscript exists
    const manuscript = await prisma.manuscripts.findUnique({
      where: { id },
      include: {
        manuscript_authors: true,
        action_editors: true
      }
    });

    if (!manuscript) {
      return res.status(404).json({
        error: 'Manuscript not found',
        message: `No manuscript found with ID: ${id}`
      });
    }

    // Check permissions - authors, action editors, and admins can update subjects
    const isAuthor = manuscript.manuscript_authors.some((ma: any) => ma.userId === req.user!.id);
    const isActionEditor = manuscript.action_editors?.editorId === req.user!.id;
    const isAdmin = req.user!.role === GlobalRole.ADMIN || req.user!.role === GlobalRole.EDITOR_IN_CHIEF;

    if (!isAuthor && !isActionEditor && !isAdmin) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You do not have permission to update subject classifications'
      });
    }

    // Update subjects
    const updatedManuscript = await prisma.manuscripts.update({
      where: { id },
      data: {
        subjects: subjects.map(s => s.trim()).filter(Boolean),
        updatedAt: new Date()
      },
      select: {
        id: true,
        subjects: true,
        updatedAt: true
      }
    });

    res.json({
      message: 'Subject classifications updated successfully',
      manuscript: updatedManuscript
    });

  } catch (error) {
    next(error);
  }
});

// GET /api/articles/:id/workflow - Get workflow state (bot-accessible)
router.get('/:id/workflow', authenticateWithBots, requireBotPermission(BotApiPermission.READ_MANUSCRIPT), async (req, res, next) => {
  try {
    const { id } = req.params;

    if (req.botContext && req.botContext.manuscriptId !== id) {
      return res.status(403).json({ error: 'Bot can only access its assigned manuscript' });
    }

    const manuscript = await prisma.manuscripts.findUnique({
      where: { id },
      select: {
        workflowPhase: true,
        workflowRound: true,
        status: true,
        releasedAt: true,
        review_assignments: {
          select: {
            reviewerId: true,
            status: true,
            dueDate: true,
            assignedAt: true,
          },
        },
        action_editors: {
          select: {
            editorId: true,
            assignedAt: true,
          },
        },
      },
    });

    if (!manuscript) {
      return res.status(404).json({ error: 'Manuscript not found' });
    }

    res.json({
      phase: manuscript.workflowPhase,
      round: manuscript.workflowRound,
      status: manuscript.status,
      releasedAt: manuscript.releasedAt,
      reviewAssignments: manuscript.review_assignments.map(ra => ({
        reviewerId: ra.reviewerId,
        status: ra.status,
        dueDate: ra.dueDate,
        assignedAt: ra.assignedAt,
      })),
      actionEditor: manuscript.action_editors
        ? { editorId: manuscript.action_editors.editorId, assignedAt: manuscript.action_editors.assignedAt }
        : null,
    });
  } catch (error) {
    next(error);
  }
});

// Metadata update schema
const metadataUpdateSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  abstract: z.string().min(1).max(5000).optional(),
  keywords: z.array(z.string()).optional(),
  subjects: z.array(z.string()).optional(),
});

// PATCH /api/articles/:id/metadata - Update manuscript metadata (bot-accessible)
router.patch('/:id/metadata', authenticateWithBots, requireBotPermission(BotApiPermission.UPDATE_METADATA), async (req, res, next) => {
  try {
    const { id } = req.params;

    if (req.botContext && req.botContext.manuscriptId !== id) {
      return res.status(403).json({ error: 'Bot can only access its assigned manuscript' });
    }

    const parsed = metadataUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation error', details: parsed.error.issues });
    }

    const data = parsed.data;
    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: 'At least one field is required' });
    }

    const manuscript = await prisma.manuscripts.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!manuscript) {
      return res.status(404).json({ error: 'Manuscript not found' });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = { updatedAt: new Date() };
    if (data.title !== undefined) updateData.title = data.title;
    if (data.abstract !== undefined) updateData.abstract = data.abstract;
    if (data.keywords !== undefined) updateData.keywords = data.keywords;
    if (data.subjects !== undefined) updateData.subjects = data.subjects;

    const updated = await prisma.manuscripts.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        title: true,
        abstract: true,
        keywords: true,
        subjects: true,
        status: true,
        updatedAt: true,
      },
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
});

export default router;