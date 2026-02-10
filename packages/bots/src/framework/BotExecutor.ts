import { BotContext, BotResponse, BotTrigger, CommandBot, ParsedCommand, BotActionHandlerContext, BotActionHandlerResult } from '@colloquium/types';
import { CommandParser } from './commands';

export class BotExecutor {
  private commandBots: Map<string, CommandBot> = new Map();
  private installations: Map<string, any> = new Map();
  private commandParser: CommandParser = new CommandParser();
  private botUserIds: Map<string, string> = new Map();


  registerCommandBot(bot: CommandBot): void {
    this.commandParser.registerBot(bot);
    // Get the bot with help command injected from the command parser
    const botWithHelp = this.commandParser.getAllBots().find(b => b.id === bot.id);
    if (botWithHelp) {
      this.commandBots.set(bot.id, botWithHelp);
    } else {
      this.commandBots.set(bot.id, bot);
    }
  }

  setBotUserId(botId: string, userId: string): void {
    this.botUserIds.set(botId, userId);
  }

  getBotUserId(botId: string): string | undefined {
    return this.botUserIds.get(botId);
  }

  async executeActionHandler(
    botId: string,
    actionName: string,
    params: Record<string, any>,
    context: BotActionHandlerContext
  ): Promise<BotActionHandlerResult> {
    const bot = this.commandBots.get(botId);
    if (!bot) {
      return { success: false, error: `Bot ${botId} is not registered` };
    }

    const handler = bot.actionHandlers?.[actionName];
    if (!handler) {
      return { success: false, error: `Bot ${botId} has no handler for action ${actionName}` };
    }

    try {
      return await handler(params, context);
    } catch (error) {
      console.error(`Action handler ${botId}/${actionName} failed:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  unregisterBot(botId: string): void {
    this.commandBots.delete(botId);
    this.installations.delete(botId);
    this.botUserIds.delete(botId);
  }

  installBot(botId: string, config: any): void {
    if (!this.commandBots.has(botId)) {
      throw new Error(`Bot ${botId} is not registered`);
    }
    this.installations.set(botId, { ...config, isEnabled: true });
  }

  uninstallBot(botId: string): void {
    this.installations.delete(botId);
  }


  async executeCommandBot(parsedCommand: ParsedCommand, context: BotContext): Promise<BotResponse> {
    const bot = this.commandBots.get(parsedCommand.botId);
    if (!bot) {
      throw new Error(`Command bot ${parsedCommand.botId} is not registered`);
    }

    const installation = this.installations.get(parsedCommand.botId);
    if (!installation || !installation.isEnabled) {
      throw new Error(`Bot ${parsedCommand.botId} is not installed or is disabled`);
    }

    // Handle unrecognized commands by showing help
    if (parsedCommand.isUnrecognized) {
      return this.generateUnrecognizedCommandResponse(bot, parsedCommand.command);
    }

    const command = bot.commands.find(cmd => cmd.name === parsedCommand.command);
    if (!command) {
      return this.generateUnrecognizedCommandResponse(bot, parsedCommand.command);
    }

    // Validate parameters
    const validation = this.commandParser.validateParameters(parsedCommand.parameters, command);
    if (!validation.isValid) {
      let message = `❌ **Invalid Parameters for \`${command.name}\`**\n\n`;
      validation.errors.forEach(err => {
        message += `- ${err}\n`;
      });
      message += `\n**Usage:** \`${command.usage}\`\n`;
      if (command.examples.length > 0) {
        message += `\n**Examples:**\n`;
        command.examples.slice(0, 3).forEach(ex => {
          message += `- \`${ex}\`\n`;
        });
      }
      return {
        botId: parsedCommand.botId,
        messages: [{ content: message }],
        errors: validation.errors
      };
    }

    try {
      // Execute command with timeout
      const timeoutMs = process.env.BOT_EXECUTION_TIMEOUT ? 
        parseInt(process.env.BOT_EXECUTION_TIMEOUT) : 30000;

      const enhancedContext = {
        ...context,
        config: { ...context.config, ...installation }
      };

      const response = await Promise.race([
        command.execute(parsedCommand.parameters, enhancedContext),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Bot execution timeout')), timeoutMs)
        )
      ]);

      // Add bot ID to response
      return {
        ...response,
        botId: parsedCommand.botId
      };
    } catch (error) {
      console.error(`Command bot ${parsedCommand.botId} execution failed:`, error);
      return {
        botId: parsedCommand.botId,
        errors: [error instanceof Error ? error.message : 'Unknown error occurred']
      };
    }
  }

  async processMessage(messageContent: string, context: BotContext): Promise<BotResponse[]> {
    const responses: BotResponse[] = [];

    // Parse message for bot commands
    const parsedCommands = this.commandParser.parseMessage(messageContent);
    
    // Execute each parsed command
    for (const parsedCommand of parsedCommands) {
      try {
        const response = await this.executeCommandBot(parsedCommand, context);
        responses.push(response);
      } catch (error) {
        console.error(`Failed to execute command bot ${parsedCommand.botId}:`, error);
        responses.push({
          errors: [error instanceof Error ? error.message : 'Unknown error occurred']
        });
      }
    }

    return responses;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async executeBotsByTrigger(trigger: BotTrigger, context: BotContext): Promise<BotResponse[]> {
    const responses: BotResponse[] = [];

    // Execute command bots that have matching triggers
    for (const [botId, bot] of this.commandBots.entries()) {
      const installation = this.installations.get(botId);
      
      if (!installation || !installation.isEnabled) {
        continue;
      }

      if (bot.triggers.includes(trigger.toString() as any)) {
        // For command bots with triggers, we could execute an auto-trigger command
        // For now, command bots are primarily mention-based, so we skip auto-execution
        // console.log(`Bot ${bot.name} triggered by ${trigger}, but no auto-execution implemented`);
      }
    }

    return responses;
  }

  getInstalledBots(): Array<{ botId: string; bot: CommandBot; config: any }> {
    const installed: Array<{ botId: string; bot: CommandBot; config: any }> = [];

    for (const [botId, config] of this.installations.entries()) {
      const commandBot = this.commandBots.get(botId);
      
      if (commandBot) {
        installed.push({ botId, bot: commandBot, config });
      }
    }

    return installed;
  }

  getAvailableBots(): CommandBot[] {
    return Array.from(this.commandBots.values());
  }

  getCommandBots(): CommandBot[] {
    return Array.from(this.commandBots.values());
  }

  getCommandParser(): CommandParser {
    return this.commandParser;
  }

  getBotHelp(botId: string): string | null {
    const bot = this.commandBots.get(botId);
    if (!bot) {
      return null;
    }
    
    return this.commandParser.generateBotHelp(botId);
  }

  private generateUnrecognizedCommandResponse(bot: CommandBot, unrecognizedCommand: string): BotResponse {
    let message = `❌ **Unrecognized Command:** \`${unrecognizedCommand}\`\n\n`;
    message += `I don't recognize the command \`${unrecognizedCommand}\` for **${bot.name}**.\n\n`;
    
    // Special case for common naming mistakes
    if (unrecognizedCommand.toLowerCase() === 'bot') {
      message += `💡 **Tip:** It looks like you might have typed the bot name with spaces. Use \`@${bot.id}\` instead of \`@${bot.name}\`.\n\n`;
    }
    
    message += `**Available Commands:**\n`;
    bot.commands.forEach(cmd => {
      message += `• \`${cmd.name}\` - ${cmd.description}\n`;
    });
    
    message += `\n**Usage Examples:**\n`;
    const exampleCommands = bot.commands.slice(0, 3); // Show first 3 commands as examples
    exampleCommands.forEach(cmd => {
      if (cmd.examples.length > 0) {
        message += `• \`${cmd.examples[0]}\`\n`;
      }
    });
    
    message += `\n💡 **Need more help?** Try \`@${bot.id} help\` for detailed documentation.`;
    
    return {
      botId: bot.id,
      messages: [{
        content: message
      }]
    };
  }
}

// Global bot executor instance
export const botExecutor = new BotExecutor();