import { Router } from 'express';
import { prisma } from '@colloquium/database';
import { authenticate, requireGlobalPermission } from '../middleware/auth';
import { GlobalPermission } from '@colloquium/auth';
import { z } from 'zod';
import { formatDetection } from '../services/formatDetection';

const router = Router();

// Validation schemas
const createFormatSchema = z.object({
  name: z.string().min(1).max(50).regex(/^[a-z][a-z0-9_-]*$/, 'Name must be lowercase alphanumeric with underscores/hyphens'),
  displayName: z.string().min(1).max(100),
  fileExtensions: z.array(z.string().regex(/^\.[a-z0-9]+$/, 'Extensions must start with . and be lowercase')).min(1),
  mimeTypes: z.array(z.string()).min(1),
  description: z.string().optional(),
  rendererBotId: z.string().optional(),
  validatorBotId: z.string().optional()
});

const updateFormatSchema = createFormatSchema.partial().omit({ name: true });

// GET /api/formats - List all supported formats
router.get('/', async (req, res, next) => {
  try {
    const { includeInactive = 'false' } = req.query;
    
    const whereClause = includeInactive === 'true' ? {} : { isActive: true };
    
    const formats = await prisma.supported_formats.findMany({
      where: whereClause,
      orderBy: { displayName: 'asc' }
    });

    const formattedFormats = formats.map(format => ({
      id: format.id,
      name: format.name,
      displayName: format.displayName,
      fileExtensions: format.fileExtensions,
      mimeTypes: format.mimeTypes,
      description: format.description,
      rendererBotId: format.rendererBotId,
      validatorBotId: format.validatorBotId,
      isActive: format.isActive,
      createdAt: format.createdAt,
      updatedAt: format.updatedAt
    }));

    res.json({
      formats: formattedFormats,
      total: formats.length
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/formats/:id - Get specific format details
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const format = await prisma.supported_formats.findUnique({
      where: { id }
    });

    if (!format) {
      return res.status(404).json({
        error: 'Format not found',
        message: `Format with ID ${id} does not exist`
      });
    }

    res.json({
      id: format.id,
      name: format.name,
      displayName: format.displayName,
      fileExtensions: format.fileExtensions,
      mimeTypes: format.mimeTypes,
      description: format.description,
      rendererBotId: format.rendererBotId,
      validatorBotId: format.validatorBotId,
      isActive: format.isActive,
      createdAt: format.createdAt,
      updatedAt: format.updatedAt
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/formats - Register new format (admin only)
router.post('/', authenticate, (req, res, next) => {
  return requireGlobalPermission(GlobalPermission.MANAGE_JOURNAL_SETTINGS)(req, res, next);
}, async (req, res, next) => {
  try {
    const formatData = createFormatSchema.parse(req.body);

    // Check if format name already exists
    const existingFormat = await prisma.supported_formats.findUnique({
      where: { name: formatData.name }
    });

    if (existingFormat) {
      return res.status(409).json({
        error: 'Format already exists',
        message: `A format with name '${formatData.name}' already exists`
      });
    }

    // Validate bot IDs if provided
    if (formatData.rendererBotId) {
      const rendererBot = await prisma.bot_definitions.findUnique({
        where: { id: formatData.rendererBotId }
      });
      if (!rendererBot) {
        return res.status(400).json({
          error: 'Invalid renderer bot',
          message: `Renderer bot with ID '${formatData.rendererBotId}' does not exist`
        });
      }
    }

    if (formatData.validatorBotId) {
      const validatorBot = await prisma.bot_definitions.findUnique({
        where: { id: formatData.validatorBotId }
      });
      if (!validatorBot) {
        return res.status(400).json({
          error: 'Invalid validator bot',
          message: `Validator bot with ID '${formatData.validatorBotId}' does not exist`
        });
      }
    }

    const format = await prisma.supported_formats.create({
      data: {
        id: require('crypto').randomUUID(),
        name: formatData.name,
        displayName: formatData.displayName,
        fileExtensions: formatData.fileExtensions,
        mimeTypes: formatData.mimeTypes,
        description: formatData.description,
        rendererBotId: formatData.rendererBotId,
        validatorBotId: formatData.validatorBotId,
        isActive: true,
        updatedAt: new Date()
      }
    });

    res.status(201).json({
      message: `Format '${format.displayName}' registered successfully`,
      format: {
        id: format.id,
        name: format.name,
        displayName: format.displayName,
        fileExtensions: format.fileExtensions,
        mimeTypes: format.mimeTypes,
        description: format.description,
        rendererBotId: format.rendererBotId,
        validatorBotId: format.validatorBotId,
        isActive: format.isActive,
        createdAt: format.createdAt,
        updatedAt: format.updatedAt
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Invalid format data',
        details: error.errors.reduce((acc, err) => {
          acc[err.path.join('.')] = err.message;
          return acc;
        }, {} as Record<string, string>)
      });
    }

    next(error);
  }
});

// PUT /api/formats/:id - Update format configuration
router.put('/:id', authenticate, (req, res, next) => {
  return requireGlobalPermission(GlobalPermission.MANAGE_JOURNAL_SETTINGS)(req, res, next);
}, async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = updateFormatSchema.parse(req.body);

    const existingFormat = await prisma.supported_formats.findUnique({
      where: { id }
    });

    if (!existingFormat) {
      return res.status(404).json({
        error: 'Format not found',
        message: `Format with ID ${id} does not exist`
      });
    }

    // Validate bot IDs if provided
    if (updateData.rendererBotId !== undefined) {
      if (updateData.rendererBotId && updateData.rendererBotId !== existingFormat.rendererBotId) {
        const rendererBot = await prisma.bot_definitions.findUnique({
          where: { id: updateData.rendererBotId }
        });
        if (!rendererBot) {
          return res.status(400).json({
            error: 'Invalid renderer bot',
            message: `Renderer bot with ID '${updateData.rendererBotId}' does not exist`
          });
        }
      }
    }

    if (updateData.validatorBotId !== undefined) {
      if (updateData.validatorBotId && updateData.validatorBotId !== existingFormat.validatorBotId) {
        const validatorBot = await prisma.bot_definitions.findUnique({
          where: { id: updateData.validatorBotId }
        });
        if (!validatorBot) {
          return res.status(400).json({
            error: 'Invalid validator bot',
            message: `Validator bot with ID '${updateData.validatorBotId}' does not exist`
          });
        }
      }
    }

    const updatedFormat = await prisma.supported_formats.update({
      where: { id },
      data: {
        ...updateData,
        updatedAt: new Date()
      }
    });

    res.json({
      message: `Format '${updatedFormat.displayName}' updated successfully`,
      format: {
        id: updatedFormat.id,
        name: updatedFormat.name,
        displayName: updatedFormat.displayName,
        fileExtensions: updatedFormat.fileExtensions,
        mimeTypes: updatedFormat.mimeTypes,
        description: updatedFormat.description,
        rendererBotId: updatedFormat.rendererBotId,
        validatorBotId: updatedFormat.validatorBotId,
        isActive: updatedFormat.isActive,
        createdAt: updatedFormat.createdAt,
        updatedAt: updatedFormat.updatedAt
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

// DELETE /api/formats/:id - Deactivate format
router.delete('/:id', authenticate, (req, res, next) => {
  return requireGlobalPermission(GlobalPermission.MANAGE_JOURNAL_SETTINGS)(req, res, next);
}, async (req, res, next) => {
  try {
    const { id } = req.params;

    const existingFormat = await prisma.supported_formats.findUnique({
      where: { id }
    });

    if (!existingFormat) {
      return res.status(404).json({
        error: 'Format not found',
        message: `Format with ID ${id} does not exist`
      });
    }

    // Instead of deleting, deactivate the format
    const deactivatedFormat = await prisma.supported_formats.update({
      where: { id },
      data: {
        isActive: false,
        updatedAt: new Date()
      }
    });

    res.json({
      message: `Format '${deactivatedFormat.displayName}' deactivated successfully`,
      format: {
        id: deactivatedFormat.id,
        name: deactivatedFormat.name,
        displayName: deactivatedFormat.displayName,
        isActive: deactivatedFormat.isActive,
        updatedAt: deactivatedFormat.updatedAt
      }
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/formats/detect - Detect format of uploaded file
router.post('/detect', authenticate, async (req, res, next) => {
  try {
    const { originalName, mimeType, content } = req.body;

    if (!originalName || !mimeType) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'originalName and mimeType are required'
      });
    }

    // Convert base64 content to buffer if provided
    let contentBuffer: Buffer | undefined;
    if (content) {
      try {
        contentBuffer = Buffer.from(content, 'base64');
      } catch (error) {
        return res.status(400).json({
          error: 'Invalid content',
          message: 'Content must be base64 encoded'
        });
      }
    }

    const detection = await formatDetection.detectFormat(
      originalName,
      mimeType,
      contentBuffer
    );

    res.json({
      detection: {
        detectedFormat: detection.detectedFormat,
        confidence: detection.confidence,
        suggestedFormat: detection.suggestedFormat,
        errors: detection.errors,
        warnings: detection.warnings
      }
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/formats/:formatName/validate - Validate file against specific format
router.post('/:formatName/validate', authenticate, async (req, res, next) => {
  try {
    const { formatName } = req.params;
    const { originalName, mimeType, content } = req.body;

    if (!originalName || !mimeType) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'originalName and mimeType are required'
      });
    }

    // Check if format exists
    const format = await prisma.supported_formats.findFirst({
      where: { name: formatName, isActive: true }
    });

    if (!format) {
      return res.status(404).json({
        error: 'Format not found',
        message: `Format '${formatName}' is not supported or not active`
      });
    }

    // Convert base64 content to buffer if provided
    let contentBuffer: Buffer | undefined;
    if (content) {
      try {
        contentBuffer = Buffer.from(content, 'base64');
      } catch (error) {
        return res.status(400).json({
          error: 'Invalid content',
          message: 'Content must be base64 encoded'
        });
      }
    }

    const validation = await formatDetection.validateFile(
      originalName,
      mimeType,
      formatName,
      contentBuffer
    );

    res.json({
      validation: {
        isValid: validation.errors.length === 0,
        confidence: validation.confidence,
        errors: validation.errors,
        warnings: validation.warnings
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;