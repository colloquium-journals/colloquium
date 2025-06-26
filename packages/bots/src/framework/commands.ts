import { z } from 'zod';
import { CommandBot, BotCommand, BotCommandParameter, ParsedCommand } from '@colloquium/types';
import { generateBotHelp, injectHelpCommand } from './helpSystem';

// Command parser utility
export class CommandParser {
  private bots: Map<string, CommandBot> = new Map();

  registerBot(bot: CommandBot): void {
    // Inject help command if bot doesn't have one
    const botWithHelp = injectHelpCommand(bot);
    this.bots.set(botWithHelp.id, botWithHelp);
  }

  // Parse a message for bot commands
  parseMessage(text: string): ParsedCommand[] {
    const commands: ParsedCommand[] = [];
    
    // Look for @bot-name command patterns
    const mentionPattern = /@([a-zA-Z0-9-]+)\s+([a-zA-Z0-9-]+)(?:\s+(.*))?/g;
    let match;

    while ((match = mentionPattern.exec(text)) !== null) {
      const [, botName, commandName, paramText] = match;
      
      // Find bot by name or ID
      const bot = this.findBotByName(botName);
      if (!bot) continue;

      // Find command
      const command = bot.commands.find(cmd => cmd.name === commandName);
      
      if (command) {
        // Parse parameters for recognized command
        const parameters = this.parseParameters(paramText || '', command.parameters);

        commands.push({
          botId: bot.id,
          command: commandName,
          parameters,
          rawText: match[0]
        });
      } else {
        // Handle unrecognized command
        commands.push({
          botId: bot.id,
          command: commandName,
          parameters: { originalText: paramText || '' },
          rawText: match[0],
          isUnrecognized: true
        });
      }
    }

    // Also look for simple bot mentions without commands (e.g., just "@editorial-bot")
    const simpleMentionPattern = /@([a-zA-Z0-9-]+)(?![\s\w])/g;
    let simpleMentionMatch;
    
    while ((simpleMentionMatch = simpleMentionPattern.exec(text)) !== null) {
      const [, botName] = simpleMentionMatch;
      
      // Find bot by name or ID
      const bot = this.findBotByName(botName);
      if (!bot) continue;
      
      // Check if this mention was already processed as a command
      const alreadyProcessed = commands.some(cmd => 
        cmd.rawText.includes(`@${botName}`)
      );
      
      if (!alreadyProcessed) {
        // Trigger help command for simple mentions
        commands.push({
          botId: bot.id,
          command: 'help',
          parameters: {},
          rawText: simpleMentionMatch[0]
        });
      }
    }

    // Also check for keyword triggers
    for (const [botId, bot] of this.bots.entries()) {
      for (const keyword of bot.keywords) {
        if (text.toLowerCase().includes(keyword.toLowerCase())) {
          // Check if bot has an auto-trigger command
          const autoCommand = bot.commands.find(cmd => cmd.name === 'auto-trigger');
          if (autoCommand) {
            commands.push({
              botId,
              command: 'auto-trigger',
              parameters: { keyword, fullText: text },
              rawText: keyword
            });
          }
        }
      }
    }

    return commands;
  }

  // Parse parameters from text
  private parseParameters(text: string, paramDefs: BotCommandParameter[]): Record<string, any> {
    const params: Record<string, any> = {};
    
    if (!text.trim()) {
      // Use default values
      for (const param of paramDefs) {
        if (param.defaultValue !== undefined) {
          params[param.name] = param.defaultValue;
        }
      }
      return params;
    }

    // Special handling for help command - first word might be a command name
    if (paramDefs.length === 1 && paramDefs[0].name === 'command') {
      const firstWord = text.trim().split(/\s+/)[0];
      if (firstWord && !firstWord.includes('=')) {
        params.command = firstWord;
        return params;
      }
    }

    // Parse key=value pairs and positional arguments
    const keyValuePattern = /(\w+)=([^\s]+)/g;
    const keyValueMatches = Array.from(text.matchAll(keyValuePattern));
    
    // Extract key=value parameters
    for (const [, key, value] of keyValueMatches) {
      const paramDef = paramDefs.find(p => p.name === key);
      if (paramDef) {
        params[key] = this.convertValue(value, paramDef);
      }
    }

    // Remove key=value pairs to get positional arguments
    let remainingText = text;
    for (const [fullMatch] of keyValueMatches) {
      remainingText = remainingText.replace(fullMatch, '');
    }

    // Parse positional arguments with special handling for @mentions
    const positionalParams = paramDefs.filter(p => !params.hasOwnProperty(p.name));
    let remainingForPositional = remainingText.trim();
    
    for (let i = 0; i < positionalParams.length && remainingForPositional.length > 0; i++) {
      const param = positionalParams[i];
      let value: string;
      
      // Special handling for @mentions - capture everything starting with @ until next parameter or end
      if (remainingForPositional.startsWith('@')) {
        // Look for the next key=value parameter or end of string
        const nextParamMatch = remainingForPositional.match(/^(@[^=]*?)(?:\s+\w+=|$)/);
        if (nextParamMatch) {
          value = nextParamMatch[1].trim();
          remainingForPositional = remainingForPositional.slice(nextParamMatch[1].length).trim();
        } else {
          // If no clear boundary found, take everything starting with @
          value = remainingForPositional.match(/^@\S+/)?.[0] || remainingForPositional;
          remainingForPositional = remainingForPositional.slice(value.length).trim();
        }
      } else {
        // Normal space-separated argument
        const spaceIndex = remainingForPositional.search(/\s/);
        if (spaceIndex === -1) {
          value = remainingForPositional;
          remainingForPositional = '';
        } else {
          value = remainingForPositional.slice(0, spaceIndex);
          remainingForPositional = remainingForPositional.slice(spaceIndex).trim();
        }
      }
      
      params[param.name] = this.convertValue(value, param);
    }

    // Fill in default values for missing parameters
    for (const param of paramDefs) {
      if (!params.hasOwnProperty(param.name) && param.defaultValue !== undefined) {
        params[param.name] = param.defaultValue;
      }
    }

    return params;
  }

  // Convert string value to appropriate type
  private convertValue(value: string, paramDef: BotCommandParameter): any {
    switch (paramDef.type) {
      case 'number':
        const num = parseFloat(value);
        return isNaN(num) ? paramDef.defaultValue : num;
      case 'boolean':
        return ['true', '1', 'yes', 'on'].includes(value.toLowerCase());
      case 'array':
        return value.split(',').map(v => v.trim());
      case 'enum':
        return paramDef.enumValues?.includes(value) ? value : paramDef.defaultValue;
      default:
        return value;
    }
  }

  // Find bot by name or ID
  private findBotByName(name: string): CommandBot | undefined {
    // Try exact ID match first
    const byId = this.bots.get(name);
    if (byId) return byId;

    const lowerName = name.toLowerCase();

    // Try name matching with various formats
    for (const bot of this.bots.values()) {
      const botNameNormalized = bot.name.toLowerCase().replace(/\s+/g, '-');
      const botFirstWord = bot.name.toLowerCase().split(/\s+/)[0];
      
      // Exact match with normalized name (e.g., "editorial-bot")
      if (botNameNormalized === lowerName) {
        return bot;
      }
      
      // Match first word of bot name (e.g., "editorial" matches "Editorial Bot")
      if (botFirstWord === lowerName) {
        return bot;
      }
      
      // Match bot ID without suffix (e.g., "editorial" matches "editorial-bot")
      if (bot.id.toLowerCase().startsWith(lowerName + '-')) {
        return bot;
      }
    }

    return undefined;
  }

  // Generate help text for a bot using the unified help system
  generateBotHelp(botId: string, commandName?: string): string {
    const bot = this.bots.get(botId);
    if (!bot) return 'Bot not found';

    return generateBotHelp(bot, { 
      commandName,
      includeMetadata: true,
      format: 'markdown'
    });
  }

  // Get all registered bots
  getAllBots(): CommandBot[] {
    return Array.from(this.bots.values());
  }

  // Debug method to check bot registration
  debugFindBot(name: string): { found: boolean; botId?: string; botName?: string } {
    const bot = this.findBotByName(name);
    if (bot) {
      return { found: true, botId: bot.id, botName: bot.name };
    }
    return { found: false };
  }

  // Validate command parameters
  validateParameters(parameters: Record<string, any>, command: BotCommand): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    for (const paramDef of command.parameters) {
      const value = parameters[paramDef.name];
      
      // Check required parameters
      if (paramDef.required && (value === undefined || value === null || value === '')) {
        errors.push(`Required parameter '${paramDef.name}' is missing`);
        continue;
      }

      // Skip validation if parameter is not provided and not required
      if (value === undefined || value === null) continue;

      // Type validation
      if (paramDef.type === 'number' && isNaN(Number(value))) {
        errors.push(`Parameter '${paramDef.name}' must be a number`);
      }

      if (paramDef.type === 'enum' && paramDef.enumValues && !paramDef.enumValues.includes(value)) {
        errors.push(`Parameter '${paramDef.name}' must be one of: ${paramDef.enumValues.join(', ')}`);
      }

      // Custom validation
      if (paramDef.validation) {
        try {
          paramDef.validation.parse(value);
        } catch (error) {
          if (error instanceof z.ZodError) {
            errors.push(`Parameter '${paramDef.name}': ${error.errors[0].message}`);
          }
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

// Global command parser instance
export const commandParser = new CommandParser();