import express from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { BotInstallationSource, BotPluginError } from '@colloquium/bots';
import { parseYamlConfig, validateYamlConfig } from '../utils/yamlConfig';
import { botManager, botExecutor } from '../bots';

import { errors } from '../utils/errorResponse';

const router = express.Router();

// Helper function to check if a bot is required
const isRequiredBot = (botId: string): boolean => {
  const requiredBots = ['bot-editorial'];
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
  config: z.union([z.record(z.any()), z.string()])
});

const updateBotSchema = z.object({
  version: z.string().optional()
});

// Admin middleware - only admins can manage bots
const adminMiddleware = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (req.user?.role !== 'ADMIN') {
    return errors.forbidden(res, 'Admin access required');
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
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to list bots' });
  }
});

// Get specific bot details
router.get('/:botId', authenticate, adminMiddleware, async (req, res) => {
  try {
    const { botId } = req.params;
    const installation = await botManager.get(botId);
    
    if (!installation) {
      return errors.notFound(res, 'Bot not found');
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
        yamlConfig: installation.yamlConfig,
        installedAt: installation.installedAt,
        updatedAt: installation.updatedAt,
        packageName: installation.packageName,
        manifest: installation.manifest
      }
    });
  } catch (error) {
    console.error('Error getting bot:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to get bot details' });
  }
});

// Install a new bot
router.post('/install', authenticate, adminMiddleware, async (req, res) => {
  try {
    const validation = installBotSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: 'Validation Error', message: 'Invalid request data', details: validation.error.errors });
    }

    const { source, config } = validation.data;

    // Validate source has required fields
    if (source.type === 'npm' && !source.packageName) {
      return errors.validation(res, 'packageName is required for npm sources');
    }

    if ((source.type === 'git' || source.type === 'url') && !source.url) {
      return errors.validation(res, 'url is required for git and url sources');
    }

    if (source.type === 'local' && !source.path) {
      return errors.validation(res, 'path is required for local sources');
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
      return res.status(statusCode).json({ error: error.code.toLowerCase(), message: error.message, details: error.details });
    }

    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to install bot' });
  }
});

// Uninstall a bot
router.delete('/:botId', authenticate, adminMiddleware, async (req, res) => {
  try {
    const { botId } = req.params;
    
    // Prevent uninstalling required bots
    if (isRequiredBot(botId)) {
      return errors.validation(res, 'Cannot uninstall required system bot');
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
      return res.status(statusCode).json({ error: error.code.toLowerCase(), message: error.message });
    }

    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to uninstall bot' });
  }
});

// Update a bot
router.put('/:botId', authenticate, adminMiddleware, async (req, res) => {
  try {
    const { botId } = req.params;
    const validation = updateBotSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({ error: 'Validation Error', message: 'Invalid request data', details: validation.error.errors });
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
      return res.status(statusCode).json({ error: error.code.toLowerCase(), message: error.message });
    }

    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to update bot' });
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
      return res.status(statusCode).json({ error: error.code.toLowerCase(), message: error.message });
    }

    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to enable bot' });
  }
});

// Disable a bot
router.post('/:botId/disable', authenticate, adminMiddleware, async (req, res) => {
  try {
    const { botId } = req.params;
    
    // Prevent disabling required bots
    if (isRequiredBot(botId)) {
      return errors.validation(res, 'Cannot disable required system bot');
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
      return res.status(statusCode).json({ error: error.code.toLowerCase(), message: error.message });
    }

    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to disable bot' });
  }
});

// Configure a bot
router.put('/:botId/config', authenticate, adminMiddleware, async (req, res) => {
  try {
    const { botId } = req.params;
    const validation = updateBotConfigSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({ error: 'Validation Error', message: 'Invalid configuration data', details: validation.error.errors });
    }

    const { config } = validation.data;
    
    // Validate YAML if it's a string
    if (typeof config === 'string') {
      const validation = validateYamlConfig(config);
      if (!validation.valid) {
        return errors.validation(res, `Invalid YAML configuration: ${validation.error}`);
      }
    }
    
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
      return res.status(statusCode).json({ error: error.code.toLowerCase(), message: error.message });
    }

    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to configure bot' });
  }
});

// Get bot help
router.get('/:botId/help', authenticate, adminMiddleware, async (req, res) => {
  try {
    const { botId } = req.params;
    const helpContent = await botManager.getBotHelp(botId);
    
    if (!helpContent) {
      return errors.notFound(res, 'Bot not found or help not available');
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
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to get bot help' });
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
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to install default bots' });
  }
});

// Get bot executor status - shows which bots are actually registered and ready
router.get('/status/executor', authenticate, adminMiddleware, async (req, res) => {
  try {
    // Get all installed bots from database
    const installations = await botManager.list();

    // Get bots registered in the executor
    const registeredBots = botExecutor.getCommandBots();
    const registeredBotIds = new Set(registeredBots.map(bot => bot.id));

    // Build status for each installed bot
    const botStatuses = installations.map(installation => {
      const botId = installation.manifest.colloquium.botId;
      const isRegistered = registeredBotIds.has(botId);

      return {
        botId,
        name: installation.manifest.name,
        isEnabled: installation.isEnabled,
        isRegistered,
        status: !installation.isEnabled
          ? 'disabled'
          : isRegistered
            ? 'ready'
            : 'not_loaded'
      };
    });

    const allReady = botStatuses.every(bot => !bot.isEnabled || bot.isRegistered);

    res.json({
      data: {
        healthy: allReady,
        registeredCount: registeredBots.length,
        installedCount: installations.length,
        bots: botStatuses
      }
    });
  } catch (error) {
    console.error('Error getting bot executor status:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to get bot executor status' });
  }
});

// Reload all bots into the executor
router.post('/reload', authenticate, adminMiddleware, async (req, res) => {
  try {
    console.log('🔄 Manual bot reload triggered by admin...');

    await botManager.reloadAllBots();

    const registeredBots = botExecutor.getCommandBots();

    console.log(`✅ Manual bot reload complete: ${registeredBots.length} bot(s) loaded`);

    res.json({
      data: {
        message: 'Bots reloaded successfully',
        loadedCount: registeredBots.length,
        bots: registeredBots.map(bot => ({
          botId: bot.id,
          name: bot.name
        }))
      }
    });
  } catch (error) {
    console.error('Error reloading bots:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to reload bots' });
  }
});

export default router;