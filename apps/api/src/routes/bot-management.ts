import express from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { DatabaseBotManager } from '@colloquium/bots/src/framework/botManager';
import { BotInstallationSource, BotPluginError } from '@colloquium/bots/src/framework/plugin';

const router = express.Router();
const botManager = new DatabaseBotManager();

// Helper function to check if a bot is required
const isRequiredBot = (botId: string): boolean => {
  const requiredBots = ['editorial-bot'];
  return requiredBots.includes(botId);
};

// Validation schemas
const installBotSchema = z.object({
  source: z.object({
    type: z.enum(['npm', 'git', 'local', 'url']),
    packageName: z.string().optional(),
    version: z.string().optional(),
    url: z.string().url().optional(),
    path: z.string().optional(),
    ref: z.string().optional()
  }),
  config: z.record(z.any()).optional().default({})
});

const updateBotConfigSchema = z.object({
  config: z.record(z.any())
});

const updateBotSchema = z.object({
  version: z.string().optional()
});

// Admin middleware - only admins can manage bots
const adminMiddleware = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (req.user?.role !== 'ADMIN') {
    return res.status(403).json({
      error: {
        message: 'Admin access required',
        type: 'forbidden'
      }
    });
  }
  next();
};

// List all installed bots
router.get('/', authenticate, adminMiddleware, async (req, res) => {
  try {
    const installations = await botManager.list();
    
    res.json({
      data: installations.map(installation => ({
        id: installation.id,
        botId: installation.manifest.colloquium.botId,
        name: installation.manifest.name,
        version: installation.version,
        description: installation.manifest.description,
        author: installation.manifest.author,
        category: installation.manifest.colloquium.category,
        isEnabled: installation.isEnabled,
        isDefault: installation.isDefault,
        installedAt: installation.installedAt,
        updatedAt: installation.updatedAt,
        packageName: installation.packageName,
        supportsFileUploads: installation.manifest.colloquium.supportsFileUploads || false
      }))
    });
  } catch (error) {
    console.error('Error listing bots:', error);
    res.status(500).json({
      error: {
        message: 'Failed to list bots',
        type: 'server_error'
      }
    });
  }
});

// Get specific bot details
router.get('/:botId', authenticate, adminMiddleware, async (req, res) => {
  try {
    const { botId } = req.params;
    const installation = await botManager.get(botId);
    
    if (!installation) {
      return res.status(404).json({
        error: {
          message: 'Bot not found',
          type: 'not_found'
        }
      });
    }

    res.json({
      data: {
        id: installation.id,
        botId: installation.manifest.colloquium.botId,
        name: installation.manifest.name,
        version: installation.version,
        description: installation.manifest.description,
        author: installation.manifest.author,
        category: installation.manifest.colloquium.category,
        permissions: installation.manifest.colloquium.permissions,
        keywords: installation.manifest.keywords,
        isEnabled: installation.isEnabled,
        isDefault: installation.isDefault,
        config: installation.config,
        installedAt: installation.installedAt,
        updatedAt: installation.updatedAt,
        packageName: installation.packageName,
        manifest: installation.manifest
      }
    });
  } catch (error) {
    console.error('Error getting bot:', error);
    res.status(500).json({
      error: {
        message: 'Failed to get bot details',
        type: 'server_error'
      }
    });
  }
});

// Install a new bot
router.post('/install', authenticate, adminMiddleware, async (req, res) => {
  try {
    const validation = installBotSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: {
          message: 'Invalid request data',
          type: 'validation_error',
          details: validation.error.errors
        }
      });
    }

    const { source, config } = validation.data;

    // Validate source has required fields
    if (source.type === 'npm' && !source.packageName) {
      return res.status(400).json({
        error: {
          message: 'packageName is required for npm sources',
          type: 'validation_error'
        }
      });
    }

    if ((source.type === 'git' || source.type === 'url') && !source.url) {
      return res.status(400).json({
        error: {
          message: 'url is required for git and url sources',
          type: 'validation_error'
        }
      });
    }

    if (source.type === 'local' && !source.path) {
      return res.status(400).json({
        error: {
          message: 'path is required for local sources',
          type: 'validation_error'
        }
      });
    }

    const installation = await botManager.install(source as BotInstallationSource, config);

    res.status(201).json({
      data: {
        id: installation.id,
        botId: installation.manifest.colloquium.botId,
        name: installation.manifest.name,
        version: installation.version,
        description: installation.manifest.description,
        isEnabled: installation.isEnabled,
        installedAt: installation.installedAt
      }
    });
  } catch (error) {
    console.error('Error installing bot:', error);
    
    if (error instanceof BotPluginError) {
      const statusCode = error.code === 'ALREADY_INSTALLED' ? 409 : 400;
      return res.status(statusCode).json({
        error: {
          message: error.message,
          type: error.code.toLowerCase(),
          details: error.details
        }
      });
    }

    res.status(500).json({
      error: {
        message: 'Failed to install bot',
        type: 'server_error'
      }
    });
  }
});

// Uninstall a bot
router.delete('/:botId', authenticate, adminMiddleware, async (req, res) => {
  try {
    const { botId } = req.params;
    
    // Prevent uninstalling required bots
    if (isRequiredBot(botId)) {
      return res.status(400).json({
        error: {
          message: 'Cannot uninstall required system bot',
          type: 'system_bot_protected'
        }
      });
    }
    
    await botManager.uninstall(botId);
    
    res.json({
      data: {
        message: 'Bot uninstalled successfully'
      }
    });
  } catch (error) {
    console.error('Error uninstalling bot:', error);
    
    if (error instanceof BotPluginError) {
      const statusCode = error.code === 'NOT_INSTALLED' ? 404 : 400;
      return res.status(statusCode).json({
        error: {
          message: error.message,
          type: error.code.toLowerCase()
        }
      });
    }

    res.status(500).json({
      error: {
        message: 'Failed to uninstall bot',
        type: 'server_error'
      }
    });
  }
});

// Update a bot
router.put('/:botId', authenticate, adminMiddleware, async (req, res) => {
  try {
    const { botId } = req.params;
    const validation = updateBotSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({
        error: {
          message: 'Invalid request data',
          type: 'validation_error',
          details: validation.error.errors
        }
      });
    }

    const { version } = validation.data;
    const installation = await botManager.update(botId, version);

    res.json({
      data: {
        id: installation.id,
        botId: installation.manifest.colloquium.botId,
        name: installation.manifest.name,
        version: installation.version,
        updatedAt: installation.updatedAt
      }
    });
  } catch (error) {
    console.error('Error updating bot:', error);
    
    if (error instanceof BotPluginError) {
      const statusCode = error.code === 'NOT_INSTALLED' ? 404 : 400;
      return res.status(statusCode).json({
        error: {
          message: error.message,
          type: error.code.toLowerCase()
        }
      });
    }

    res.status(500).json({
      error: {
        message: 'Failed to update bot',
        type: 'server_error'
      }
    });
  }
});

// Enable a bot
router.post('/:botId/enable', authenticate, adminMiddleware, async (req, res) => {
  try {
    const { botId } = req.params;
    await botManager.enable(botId);
    
    res.json({
      data: {
        message: 'Bot enabled successfully'
      }
    });
  } catch (error) {
    console.error('Error enabling bot:', error);
    
    if (error instanceof BotPluginError) {
      const statusCode = error.code === 'NOT_INSTALLED' ? 404 : 400;
      return res.status(statusCode).json({
        error: {
          message: error.message,
          type: error.code.toLowerCase()
        }
      });
    }

    res.status(500).json({
      error: {
        message: 'Failed to enable bot',
        type: 'server_error'
      }
    });
  }
});

// Disable a bot
router.post('/:botId/disable', authenticate, adminMiddleware, async (req, res) => {
  try {
    const { botId } = req.params;
    
    // Prevent disabling required bots
    if (isRequiredBot(botId)) {
      return res.status(400).json({
        error: {
          message: 'Cannot disable required system bot',
          type: 'system_bot_protected'
        }
      });
    }
    
    await botManager.disable(botId);
    
    res.json({
      data: {
        message: 'Bot disabled successfully'
      }
    });
  } catch (error) {
    console.error('Error disabling bot:', error);
    
    if (error instanceof BotPluginError) {
      const statusCode = error.code === 'NOT_INSTALLED' ? 404 : 400;
      return res.status(statusCode).json({
        error: {
          message: error.message,
          type: error.code.toLowerCase()
        }
      });
    }

    res.status(500).json({
      error: {
        message: 'Failed to disable bot',
        type: 'server_error'
      }
    });
  }
});

// Configure a bot
router.put('/:botId/config', authenticate, adminMiddleware, async (req, res) => {
  try {
    const { botId } = req.params;
    const validation = updateBotConfigSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({
        error: {
          message: 'Invalid configuration data',
          type: 'validation_error',
          details: validation.error.errors
        }
      });
    }

    const { config } = validation.data;
    await botManager.configure(botId, config);

    res.json({
      data: {
        message: 'Bot configuration updated successfully'
      }
    });
  } catch (error) {
    console.error('Error configuring bot:', error);
    
    if (error instanceof BotPluginError) {
      const statusCode = error.code === 'NOT_INSTALLED' ? 404 : 400;
      return res.status(statusCode).json({
        error: {
          message: error.message,
          type: error.code.toLowerCase()
        }
      });
    }

    res.status(500).json({
      error: {
        message: 'Failed to configure bot',
        type: 'server_error'
      }
    });
  }
});

// Get bot help
router.get('/:botId/help', authenticate, adminMiddleware, async (req, res) => {
  try {
    const { botId } = req.params;
    const helpContent = await botManager.getBotHelp(botId);
    
    if (!helpContent) {
      return res.status(404).json({
        error: {
          message: 'Bot not found or help not available',
          type: 'not_found'
        }
      });
    }

    res.json({
      data: {
        botId,
        helpContent,
        generatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error getting bot help:', error);
    res.status(500).json({
      error: {
        message: 'Failed to get bot help',
        type: 'server_error'
      }
    });
  }
});

// Install default bots
router.post('/install-defaults', authenticate, adminMiddleware, async (req, res) => {
  try {
    const installations = await botManager.installDefaults();
    
    res.json({
      data: {
        message: `Installed ${installations.length} default bots`,
        installations: installations.map(installation => ({
          botId: installation.manifest.colloquium.botId,
          name: installation.manifest.name,
          version: installation.version
        }))
      }
    });
  } catch (error) {
    console.error('Error installing default bots:', error);
    res.status(500).json({
      error: {
        message: 'Failed to install default bots',
        type: 'server_error'
      }
    });
  }
});

export default router;