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

// Export plugin system
export {
  type BotPlugin,
  type BotPluginManifest,
  type BotInstallation,
  type BotInstallationSource,
  type BotManager,
  type BotPluginLoader,
  type BotRegistry,
  BotPluginError,
  validateBotPlugin,
  createBotManifest
} from './framework/plugin';

export { NodeBotPluginLoader } from './framework/pluginLoader';
export { DatabaseBotManager } from './framework/botManager';

// Export core bots (legacy)
export { statisticsBot } from './core/statisticsBot';
export { formattingBot } from './core/formattingBot';

// Export new command-based bots
export { plagiarismBot } from './core/plagiarismBot';
export { editorialBot } from './core/editorialBot';
export { referenceBot } from './core/referenceBot';
export { ReviewerChecklistBot } from './core/reviewerChecklistBot';

// Export types
export * from '@colloquium/types';