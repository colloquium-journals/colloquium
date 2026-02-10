import { CommandBot, BotCommand } from '@colloquium/types';

/**
 * Options for generating bot help
 */
export interface GenerateBotHelpOptions {
  commandName?: string; // Generate help for specific command
  includeMetadata?: boolean; // Include version, permissions, etc.
  format?: 'text' | 'markdown'; // Output format
}

/**
 * Generate standardized help content for a bot
 * This is the unified help generation system that works for both admin and user help
 */
export function generateBotHelp(bot: CommandBot, options: GenerateBotHelpOptions = {}): string {
  const { commandName, includeMetadata = true, format = 'markdown' } = options;

  // If specific command requested, generate command-specific help
  if (commandName) {
    return generateCommandHelp(bot, commandName, format);
  }

  // Generate general bot help
  return generateGeneralBotHelp(bot, includeMetadata, format);
}

/**
 * Generate help for a specific command
 */
function generateCommandHelp(bot: CommandBot, commandName: string, format: 'text' | 'markdown'): string {
  const command = bot.commands.find(cmd => cmd.name === commandName);
  
  if (!command) {
    return `❌ Command '${commandName}' not found. Use \`@${bot.id} help\` to see all available commands.`;
  }

  const h1 = format === 'markdown' ? '# ' : '';
  const h2 = format === 'markdown' ? '## ' : '';
  const bold = format === 'markdown' ? '**' : '';
  const code = format === 'markdown' ? '`' : '';
  
  let help = `${h1}Help: ${command.name}\n\n`;
  
  // Use custom help if available, otherwise generate from metadata
  if (command.help) {
    help += `${command.help}\n\n`;
  } else {
    // Auto-generate help from command metadata
    help += `${command.description}\n\n`;
    help += `${bold}Usage:${bold} ${code}${command.usage}${code}\n\n`;
    
    if (command.parameters.length > 0) {
      help += `${h2}Parameters\n\n`;
      for (const param of command.parameters) {
        help += `- ${code}${param.name}${code} (${param.type}${param.required ? ', required' : ', optional'})`;
        if (param.defaultValue !== undefined) {
          help += ` - Default: ${code}${param.defaultValue}${code}`;
        }
        help += `\n  ${param.description}\n`;
        
        if (param.enumValues && param.enumValues.length > 0) {
          help += `  Valid values: ${param.enumValues.map(v => `${code}${v}${code}`).join(', ')}\n`;
        }
        
        if (param.examples && param.examples.length > 0) {
          help += `  Examples: ${param.examples.map(v => `${code}${v}${code}`).join(', ')}\n`;
        }
      }
      help += '\n';
    }

    if (command.examples.length > 0) {
      help += `${h2}Examples\n\n`;
      for (const example of command.examples) {
        help += `- ${code}${example}${code}\n`;
      }
      help += '\n';
    }

    if (command.permissions.length > 0) {
      help += `${h2}Required Permissions\n\n`;
      help += `${command.permissions.map(p => `- ${p}`).join('\n')}\n\n`;
    }
  }

  return help.trim();
}

/**
 * Generate general help for the entire bot
 */
function generateGeneralBotHelp(bot: CommandBot, includeMetadata: boolean, format: 'text' | 'markdown'): string {
  const h1 = format === 'markdown' ? '# ' : '';
  const h2 = format === 'markdown' ? '## ' : '';
  const bold = format === 'markdown' ? '**' : '';
  const code = format === 'markdown' ? '`' : '';
  
  let help = `${h1}${bot.name}\n\n`;
  help += `${bot.description}\n\n`;
  
  if (includeMetadata) {
    help += `${bold}Version:${bold} ${bot.version}\n\n`;
  }

  // Add custom sections positioned "before" the command list
  if (bot.customHelpSections) {
    const beforeSections = bot.customHelpSections.filter(section => section.position === 'before');
    for (const section of beforeSections) {
      help += `${h2}${section.title}\n\n${section.content}\n\n`;
    }
  }

  // Add overview and quick start from existing help system
  if (bot.help?.overview) {
    help += `${h2}Overview\n\n${bot.help.overview}\n\n`;
  }

  if (bot.help?.quickStart) {
    help += `${h2}Quick Start\n\n${bot.help.quickStart}\n\n`;
  }

  // Commands section
  help += `${h2}Available Commands\n\n`;
  
  for (const command of bot.commands) {
    help += `${bold}${command.name}${bold} - ${command.description}\n`;
    help += `Usage: ${code}${command.usage}${code}\n\n`;
  }

  // Add keywords if present
  if (bot.keywords.length > 0) {
    help += `${h2}Keywords\n\n`;
    help += `This bot also responds to these keywords: ${bot.keywords.map(k => `${code}${k}${code}`).join(', ')}\n\n`;
  }

  // Add complete examples if present
  if (bot.help?.examples && bot.help.examples.length > 0) {
    help += `${h2}Complete Examples\n\n`;
    for (const example of bot.help.examples) {
      help += `${code}${example}${code}\n\n`;
    }
  }

  // Add custom sections positioned "after" the command list
  if (bot.customHelpSections) {
    const afterSections = bot.customHelpSections.filter(section => section.position === 'after');
    for (const section of afterSections) {
      help += `${h2}${section.title}\n\n${section.content}\n\n`;
    }
  }

  // Help footer
  help += `${h2}Getting Detailed Help\n\n`;
  help += `Use ${code}@${bot.id} help <command-name>${code} for detailed help on specific commands.`;

  return help.trim();
}

/**
 * Create a default help command that will be auto-injected into bots
 * This command handles both general help and command-specific help
 */
export function createDefaultHelpCommand(bot: CommandBot): BotCommand {
  return {
    name: 'help',
    description: 'Show help information for this bot',
    usage: `@${bot.id} help [command-name]`,
    parameters: [
      {
        name: 'command',
        description: 'Optional: Get detailed help for a specific command',
        type: 'string',
        required: false,
        examples: bot.commands.filter(cmd => cmd.name !== 'help').map(cmd => cmd.name)
      }
    ],
    examples: [
      `@${bot.id} help`,
      ...bot.commands.filter(cmd => cmd.name !== 'help').slice(0, 2).map(cmd => `@${bot.id} help ${cmd.name}`)
    ],
    permissions: [], // Help should be available to everyone
    async execute(params) {
      const { command: commandName } = params;
      
      const helpContent = generateBotHelp(bot, { 
        commandName: commandName as string,
        includeMetadata: true,
        format: 'markdown'
      });
      
      return {
        messages: [{ content: helpContent }]
      };
    }
  };
}

/**
 * Check if a bot already has a help command
 */
export function hasHelpCommand(bot: CommandBot): boolean {
  return bot.commands.some(cmd => cmd.name === 'help');
}

/**
 * Inject a default help command into a bot if it doesn't already have one
 * This is called during bot registration
 */
export function injectHelpCommand(bot: CommandBot): CommandBot {
  if (hasHelpCommand(bot)) {
    // Bot already has a help command, don't inject
    return bot;
  }
  
  // Create a copy of the bot with the injected help command
  const helpCommand = createDefaultHelpCommand(bot);
  
  return {
    ...bot,
    commands: [...bot.commands, helpCommand]
  };
}

/**
 * Utility to validate bot help configuration
 */
export function validateBotHelp(bot: CommandBot): { isValid: boolean; warnings: string[] } {
  const warnings: string[] = [];
  
  // Check if custom help sections are properly configured
  if (bot.customHelpSections) {
    for (const section of bot.customHelpSections) {
      if (!section.title.trim()) {
        warnings.push('Custom help section has empty title');
      }
      if (!section.content.trim()) {
        warnings.push(`Custom help section '${section.title}' has empty content`);
      }
      if (!['before', 'after'].includes(section.position)) {
        warnings.push(`Custom help section '${section.title}' has invalid position: ${section.position}`);
      }
    }
  }
  
  // Check for command help consistency
  for (const command of bot.commands) {
    if (command.help && command.help.trim().length < 10) {
      warnings.push(`Command '${command.name}' has very short help content`);
    }
  }
  
  return {
    isValid: warnings.length === 0,
    warnings
  };
}