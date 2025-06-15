// Export bot framework
export { BotExecutor, botExecutor } from './framework/BotExecutor';
export { createBotContext } from './framework/context';

// Export new command framework
export { 
  CommandParser, 
  commandParser,
  type CommandBot,
  type BotCommand,
  type BotCommandParameter,
  type ParsedCommand
} from './framework/commands';

// Export core bots (legacy)
export { statisticsBot } from './core/statisticsBot';
export { formattingBot } from './core/formattingBot';

// Export new command-based bots
export { plagiarismBot } from './core/plagiarismBot';
export { editorialBot } from './core/editorialBot';

// Export types
export * from '@colloquium/types';