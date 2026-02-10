import { Router } from 'express';
import { authenticate, requireGlobalPermission, generateBotServiceToken, authenticateWithBots } from '../middleware/auth';
import { GlobalPermission } from '@colloquium/auth';
import { botExecutor, getBotPermissions } from '../bots';
import { requireBotPermission } from '../middleware/botPermissions';
import { BotApiPermission } from '@colloquium/types';

const router = Router();

// GET /api/bots - List all available and installed bots
router.get('/', authenticate, async (req, res, next) => {
  try {
    // Get all registered command-based bots
    const availableBots = botExecutor.getCommandBots();
    const installedBots = botExecutor.getInstalledBots();

    // Combine information
    const botsWithStatus = availableBots.map(bot => {
      const installation = installedBots.find(ib => ib.botId === bot.id);
      
      return {
        id: bot.id,
        name: bot.name,
        description: bot.description,
        version: bot.version,
        commands: bot.commands.map(cmd => ({
          name: cmd.name,
          description: cmd.description,
          usage: cmd.usage,
          parameters: cmd.parameters
        })),
        keywords: bot.keywords,
        permissions: bot.permissions,
        isInstalled: !!installation,
        isEnabled: installation ? installation.config.isEnabled : false,
        config: installation?.config || {},
        help: bot.help
      };
    });

    res.json({
      bots: botsWithStatus
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/bots/:id - Get specific bot details
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;

    const commandBots = botExecutor.getCommandBots();
    const bot = commandBots.find(b => b.id === id);
    
    if (!bot) {
      return res.status(404).json({
        error: 'Bot not found',
        message: `Bot with ID ${id} is not registered`
      });
    }

    const installedBots = botExecutor.getInstalledBots();
    const installation = installedBots.find(ib => ib.botId === id);

    const botDetails = {
      id: bot.id,
      name: bot.name,
      description: bot.description,
      version: bot.version,
      commands: bot.commands.map(cmd => ({
        name: cmd.name,
        description: cmd.description,
        usage: cmd.usage,
        parameters: cmd.parameters,
        examples: cmd.examples,
        permissions: cmd.permissions
      })),
      keywords: bot.keywords,
      triggers: bot.triggers,
      permissions: bot.permissions,
      help: bot.help,
      isInstalled: !!installation,
      isEnabled: installation ? installation.config.isEnabled : false,
      config: installation?.config || {}
    };

    res.json(botDetails);
  } catch (error) {
    next(error);
  }
});

// POST /api/bots/:id/install - Install a bot
router.post('/:id/install', authenticate, (req, res, next) => {
  return requireGlobalPermission(GlobalPermission.MANAGE_BOTS)(req, res, next);
}, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { config = {} } = req.body;

    const commandBots = botExecutor.getCommandBots();
    const bot = commandBots.find(b => b.id === id);
    
    if (!bot) {
      return res.status(404).json({
        error: 'Bot not found',
        message: `Bot with ID ${id} is not registered`
      });
    }

    botExecutor.installBot(id, config);

    res.json({
      message: `Bot ${bot.name} installed successfully`,
      botId: id
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/bots/:id/configure - Update bot configuration
router.put('/:id/configure', authenticate, (req, res, next) => {
  return requireGlobalPermission(GlobalPermission.MANAGE_BOTS)(req, res, next);
}, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { config, isEnabled } = req.body;

    const installedBots = botExecutor.getInstalledBots();
    const installation = installedBots.find(ib => ib.botId === id);

    if (!installation) {
      return res.status(404).json({
        error: 'Bot not installed',
        message: `Bot with ID ${id} is not installed`
      });
    }

    const updatedConfig = {
      ...installation.config,
      ...(config !== undefined ? config : {}),
      isEnabled: isEnabled !== undefined ? isEnabled : installation.config.isEnabled
    };

    // Reinstall with updated config
    botExecutor.installBot(id, updatedConfig);

    res.json({
      message: 'Bot configuration updated successfully',
      config: updatedConfig
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/bots/:id/execute/:command - Execute a bot command
router.post('/:id/execute/:command', authenticate, async (req, res, next) => {
  try {
    const { id: botId, command: commandName } = req.params;
    const { parameters = {}, manuscriptId, conversationId } = req.body;

    const commandBots = botExecutor.getCommandBots();
    const bot = commandBots.find(b => b.id === botId);
    
    if (!bot) {
      return res.status(404).json({
        error: 'Bot not found',
        message: `Bot with ID ${botId} is not registered`
      });
    }

    const command = bot.commands.find(cmd => cmd.name === commandName);
    if (!command) {
      return res.status(404).json({
        error: 'Command not found',
        message: `Command ${commandName} not found for bot ${botId}`
      });
    }

    // Generate service token for bot API calls
    const serviceToken = generateBotServiceToken(botId, manuscriptId || '', getBotPermissions(botId));

    // Execute the command
    const result = await botExecutor.executeCommandBot(
      {
        botId,
        command: commandName,
        parameters,
        rawText: `@${bot.name.toLowerCase().replace(/\s+/g, '-')} ${commandName}`
      },
      {
        conversationId: conversationId || '',
        manuscriptId: manuscriptId || '',
        triggeredBy: {
          messageId: '',
          userId: req.user!.id,
          userRole: req.user!.role,
          trigger: 'MENTION' as any
        },
        journal: {
          id: 'default',
          settings: {}
        },
        config: {},
        serviceToken
      }
    );

    if (result.errors && result.errors.length > 0) {
      res.status(400).json({
        error: 'Command execution failed',
        errors: result.errors
      });
    } else {
      res.json({
        message: 'Command executed successfully',
        result: result.messages,
        actions: result.actions
      });
    }
  } catch (error) {
    next(error);
  }
});

// GET /api/bots/:id/help - Get bot help information
router.get('/:id/help', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { command } = req.query;

    const commandBots = botExecutor.getCommandBots();
    const bot = commandBots.find(b => b.id === id);
    
    if (!bot) {
      return res.status(404).json({
        error: 'Bot not found',
        message: `Bot with ID ${id} is not registered`
      });
    }

    if (command) {
      // Get help for specific command
      const cmd = bot.commands.find(c => c.name === command);
      if (!cmd) {
        return res.status(404).json({
          error: 'Command not found',
          message: `Command ${command} not found for bot ${id}`
        });
      }

      res.json({
        command: cmd.name,
        description: cmd.description,
        usage: cmd.usage,
        parameters: cmd.parameters,
        examples: cmd.examples,
        permissions: cmd.permissions
      });
    } else {
      // Get general bot help
      const help = botExecutor.getCommandParser().generateBotHelp(id);
      
      res.json({
        help,
        bot: {
          id: bot.id,
          name: bot.name,
          description: bot.description,
          version: bot.version,
          commands: bot.commands.map(cmd => ({
            name: cmd.name,
            description: cmd.description,
            usage: cmd.usage
          })),
          keywords: bot.keywords,
          helpInfo: bot.help
        }
      });
    }
  } catch (error) {
    next(error);
  }
});

// POST /api/bots/invoke - Bot-to-bot invocation
router.post('/invoke', authenticateWithBots, requireBotPermission(BotApiPermission.INVOKE_BOTS), async (req, res, next) => {
  try {
    const ctx = req.botContext;
    if (!ctx) {
      return res.status(401).json({ error: 'Bot authentication required' });
    }

    const { botId: targetBotId, command, parameters = {} } = req.body;

    if (!targetBotId || !command) {
      return res.status(400).json({ error: 'botId and command are required' });
    }

    const commandBots = botExecutor.getCommandBots();
    const targetBot = commandBots.find(b => b.id === targetBotId);
    if (!targetBot) {
      return res.status(404).json({ error: `Bot ${targetBotId} not found` });
    }

    const installedBots = botExecutor.getInstalledBots();
    const installation = installedBots.find(ib => ib.botId === targetBotId);
    if (!installation || installation.config.isEnabled === false) {
      return res.status(400).json({ error: `Bot ${targetBotId} is not installed or enabled` });
    }

    const targetToken = generateBotServiceToken(targetBotId, ctx.manuscriptId, getBotPermissions(targetBotId));

    const result = await botExecutor.executeCommandBot(
      {
        botId: targetBotId,
        command,
        parameters,
        rawText: `@${targetBotId} ${command}`,
      },
      {
        conversationId: '',
        manuscriptId: ctx.manuscriptId,
        triggeredBy: {
          messageId: '',
          userId: ctx.botId,
          userRole: 'BOT',
          trigger: 'MENTION' as any,
        },
        journal: { id: 'default', settings: {} },
        config: { apiUrl: process.env.API_URL || 'http://localhost:4000', ...installation.config },
        serviceToken: targetToken,
      }
    );

    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;