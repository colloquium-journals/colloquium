import { z } from 'zod';

// Command parameter types
export interface BotCommandParameter {
  name: string;
  description: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'enum';
  required: boolean;
  defaultValue?: any;
  enumValues?: string[];
  validation?: z.ZodSchema;
  examples?: string[];
}

// Command definition
export interface BotCommand {
  name: string;
  description: string;
  usage: string;
  parameters: BotCommandParameter[];
  examples: string[];
  permissions: string[];
  execute: (params: Record<string, any>, context: any) => Promise<any>;
}

// Bot command registry
export interface CommandBot {
  id: string;
  name: string;
  description: string;
  version: string;
  commands: BotCommand[];
  keywords: string[]; // Keywords that trigger this bot
  triggers: string[];
  permissions: string[];
  help: {
    overview: string;
    quickStart: string;
    examples: string[];
  };
}

// Command parsing result
export interface ParsedCommand {
  botId: string;
  command: string;
  parameters: Record<string, any>;
  rawText: string;
  isUnrecognized?: boolean;
}

// Command parser utility
export class CommandParser {
  private bots: Map<string, CommandBot> = new Map();

  registerBot(bot: CommandBot): void {
    this.bots.set(bot.id, bot);
  }

  // Parse a message for bot commands
  parseMessage(text: string): ParsedCommand[] {
    const commands: ParsedCommand[] = [];
    
    // Look for @bot-name command patterns
    const mentionPattern = /@([a-zA-Z0-9-]+)\s+([a-zA-Z0-9-]+)(?:\s+([^@]*))?/g;
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

    // Parse positional arguments
    const positionalArgs = remainingText.trim().split(/\s+/).filter(arg => arg.length > 0);
    const positionalParams = paramDefs.filter(p => !params.hasOwnProperty(p.name));

    for (let i = 0; i < Math.min(positionalArgs.length, positionalParams.length); i++) {
      const param = positionalParams[i];
      params[param.name] = this.convertValue(positionalArgs[i], param);
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

  // Generate help text for a bot
  generateBotHelp(botId: string): string {
    const bot = this.bots.get(botId);
    if (!bot) return 'Bot not found';

    let help = `# ${bot.name}\n\n`;
    help += `${bot.description}\n\n`;
    help += `**Version:** ${bot.version}\n\n`;
    
    if (bot.help.overview) {
      help += `## Overview\n${bot.help.overview}\n\n`;
    }

    if (bot.help.quickStart) {
      help += `## Quick Start\n${bot.help.quickStart}\n\n`;
    }

    help += `## Available Commands\n\n`;
    
    for (const command of bot.commands) {
      help += `### @${bot.name.toLowerCase().replace(/\s+/g, '-')} ${command.name}\n`;
      help += `${command.description}\n\n`;
      help += `**Usage:** \`${command.usage}\`\n\n`;
      
      if (command.parameters.length > 0) {
        help += `**Parameters:**\n`;
        for (const param of command.parameters) {
          help += `- \`${param.name}\` (${param.type}${param.required ? ', required' : ', optional'})`;
          if (param.defaultValue !== undefined) {
            help += ` - Default: \`${param.defaultValue}\``;
          }
          help += `\n  ${param.description}\n`;
          
          if (param.enumValues && param.enumValues.length > 0) {
            help += `  Valid values: ${param.enumValues.map(v => `\`${v}\``).join(', ')}\n`;
          }
          
          if (param.examples && param.examples.length > 0) {
            help += `  Examples: ${param.examples.map(v => `\`${v}\``).join(', ')}\n`;
          }
        }
        help += '\n';
      }

      if (command.examples.length > 0) {
        help += `**Examples:**\n`;
        for (const example of command.examples) {
          help += `- \`${example}\`\n`;
        }
        help += '\n';
      }
    }

    if (bot.keywords.length > 0) {
      help += `## Keywords\n`;
      help += `This bot also responds to these keywords: ${bot.keywords.map(k => `\`${k}\``).join(', ')}\n\n`;
    }

    if (bot.help.examples.length > 0) {
      help += `## Complete Examples\n`;
      for (const example of bot.help.examples) {
        help += `\`\`\`\n${example}\n\`\`\`\n\n`;
      }
    }

    return help;
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