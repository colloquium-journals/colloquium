import express from 'express';
import multer from 'multer';
import { prisma } from '@colloquium/database';
import { authenticate } from '../middleware/auth';
import path from 'path';
import fs from 'fs-extra';
import crypto from 'crypto';
import mime from 'mime-types';

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = process.env.BOT_CONFIG_UPLOAD_DIR || './uploads/bot-config';
    fs.ensureDirSync(uploadDir);
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename while preserving extension
    const ext = path.extname(file.originalname);
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow common config file types
    const allowedTypes = [
      'text/html',
      'text/css',
      'text/plain',
      'application/json',
      'text/javascript',
      'application/javascript',
      'image/png',
      'image/jpeg',
      'image/gif',
      'image/svg+xml'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} not allowed for bot configuration`));
    }
  }
});

// Upload bot configuration file
router.post('/:botId/files', authenticate, upload.single('file'), async (req, res, next) => {
  try {
    const { botId } = req.params;
    const { description } = req.body;
    const file = req.file;
    
    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Verify bot exists and user has permission
    const bot = await prisma.bot_definitions.findUnique({
      where: { id: botId },
      include: { install: true }
    });

    if (!bot) {
      // Clean up uploaded file
      await fs.remove(file.path);
      return res.status(404).json({ error: 'Bot not found' });
    }

    // Check if user has permission to configure this bot (admin or editor)
    if (!req.user || !['ADMIN', 'EDITOR_IN_CHIEF', 'MANAGING_EDITOR'].includes(req.user.role)) {
      await fs.remove(file.path);
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    // Generate file checksum
    const fileBuffer = await fs.readFile(file.path);
    const checksum = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    // Check for duplicate filename for this bot
    const existingFile = await prisma.bot_config_files.findFirst({
      where: {
        botId,
        filename: file.originalname
      }
    });

    if (existingFile) {
      await fs.remove(file.path);
      return res.status(409).json({ 
        error: `File '${file.originalname}' already exists for this bot` 
      });
    }

    // Store file metadata in database
    const configFile = await prisma.bot_config_files.create({
      data: {
        botId,
        filename: file.originalname,
        storedName: file.filename,
        path: file.path,
        mimetype: file.mimetype,
        size: file.size,
        checksum,
        category: 'general', // Default category for backwards compatibility
        description,
        uploadedBy: req.user!.id,
        metadata: {
          originalName: file.originalname,
          encoding: file.encoding
        }
      },
      include: {
        bot_definitions: {
          select: { id: true, name: true }
        },
        users: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    res.status(201).json({
      success: true,
      file: {
        id: configFile.id,
        filename: configFile.filename,
        description: configFile.description,
        mimetype: configFile.mimetype,
        size: configFile.size,
        checksum: configFile.checksum,
        uploadedAt: configFile.uploadedAt,
        uploadedBy: configFile.users,
        downloadUrl: `/api/bot-config-files/${configFile.id}/download`
      }
    });

  } catch (error) {
    // Clean up file on error
    if (req.file) {
      await fs.remove(req.file.path).catch(() => {});
    }
    next(error);
  }
});

// List bot configuration files
router.get('/:botId/files', authenticate, async (req, res, next) => {
  try {
    const { botId } = req.params;

    // Verify bot exists
    const bot = await prisma.bot_definitions.findUnique({
      where: { id: botId }
    });

    if (!bot) {
      return res.status(404).json({ error: 'Bot not found' });
    }

    const files = await prisma.bot_config_files.findMany({
      where: { botId },
      include: {
        users: {
          select: { id: true, name: true, email: true }
        }
      },
      orderBy: [
        { filename: 'asc' }
      ]
    });

    const formattedFiles = files.map(file => ({
      id: file.id,
      filename: file.filename,
      description: file.description,
      mimetype: file.mimetype,
      size: file.size,
      checksum: file.checksum,
      uploadedAt: file.uploadedAt,
      updatedAt: file.updatedAt,
      uploadedBy: file.users,
      downloadUrl: `/api/bot-config-files/${file.id}/download`
    }));

    res.json({
      success: true,
      files: formattedFiles,
      total: files.length
    });

  } catch (error) {
    next(error);
  }
});

// Download bot configuration file
router.get('/:fileId/download', authenticate, async (req, res, next) => {
  try {
    const { fileId } = req.params;

    const configFile = await prisma.bot_config_files.findUnique({
      where: { id: fileId },
      include: {
        bot_definitions: true
      }
    });

    if (!configFile) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Check if file exists on disk
    if (!await fs.pathExists(configFile.path)) {
      return res.status(404).json({ error: 'File not found on disk' });
    }

    // Set appropriate headers
    res.setHeader('Content-Type', configFile.mimetype);
    res.setHeader('Content-Disposition', `attachment; filename="${configFile.filename}"`);
    res.setHeader('Content-Length', configFile.size);

    // Stream the file
    const fileStream = fs.createReadStream(configFile.path);
    fileStream.pipe(res);

  } catch (error) {
    next(error);
  }
});

// Get file content (for text files)
router.get('/:fileId/content', authenticate, async (req, res, next) => {
  try {
    const { fileId } = req.params;

    const configFile = await prisma.bot_config_files.findUnique({
      where: { id: fileId },
      include: { bot: true }
    });

    if (!configFile) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Only allow content reading for text-based files
    const textTypes = ['text/', 'application/json', 'application/javascript'];
    if (!textTypes.some(type => configFile.mimetype.startsWith(type))) {
      return res.status(400).json({ 
        error: 'Content reading only supported for text-based files' 
      });
    }

    // Check if file exists on disk
    if (!await fs.pathExists(configFile.path)) {
      return res.status(404).json({ error: 'File not found on disk' });
    }

    const content = await fs.readFile(configFile.path, 'utf-8');

    res.json({
      success: true,
      file: {
        id: configFile.id,
        filename: configFile.filename,
        category: configFile.category,
        mimetype: configFile.mimetype,
        content
      }
    });

  } catch (error) {
    next(error);
  }
});

// Delete bot configuration file
router.delete('/:fileId', authenticate, async (req, res, next) => {
  try {
    const { fileId } = req.params;

    const configFile = await prisma.bot_config_files.findUnique({
      where: { id: fileId },
      include: { bot: true }
    });

    if (!configFile) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Check permissions
    if (!req.user || !['ADMIN', 'EDITOR_IN_CHIEF', 'MANAGING_EDITOR'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    // Delete file from disk
    if (await fs.pathExists(configFile.path)) {
      await fs.remove(configFile.path);
    }

    // Delete from database
    await prisma.bot_config_files.delete({
      where: { id: fileId }
    });

    res.json({
      success: true,
      message: 'File deleted successfully'
    });

  } catch (error) {
    next(error);
  }
});

// Update file metadata
router.patch('/:fileId', authenticate, async (req, res, next) => {
  try {
    const { fileId } = req.params;
    const { description, filename } = req.body;

    const configFile = await prisma.bot_config_files.findUnique({
      where: { id: fileId },
      include: { bot: true }
    });

    if (!configFile) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Check permissions
    if (!req.user || !['ADMIN', 'EDITOR_IN_CHIEF', 'MANAGING_EDITOR'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    // Check for filename conflicts if filename is being changed
    if (filename && filename !== configFile.filename) {
      const existingFile = await prisma.bot_config_files.findFirst({
        where: {
          botId: configFile.botId,
          filename,
          id: { not: fileId }
        }
      });

      if (existingFile) {
        return res.status(409).json({ 
          error: `File '${filename}' already exists for this bot` 
        });
      }
    }

    const updatedFile = await prisma.bot_config_files.update({
      where: { id: fileId },
      data: {
        description: description !== undefined ? description : configFile.description,
        filename: filename || configFile.filename
      },
      include: {
        users: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    res.json({
      success: true,
      file: {
        id: updatedFile.id,
        filename: updatedFile.filename,
        description: updatedFile.description,
        mimetype: updatedFile.mimetype,
        size: updatedFile.size,
        uploadedAt: updatedFile.uploadedAt,
        updatedAt: updatedFile.updatedAt,
        uploadedBy: updatedFile.users,
        downloadUrl: `/api/bot-config-files/${updatedFile.id}/download`
      }
    });

  } catch (error) {
    next(error);
  }
});

export default router;