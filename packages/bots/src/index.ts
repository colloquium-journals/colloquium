// Export bot framework
export { BotExecutor, botExecutor } from './framework/BotExecutor';
export { createBotContext } from './framework/context';

// Export new command framework
export { 
  CommandParser, 
  commandParser
} from './framework/commands';

// Export types from @colloquium/types
export type {
  CommandBot,
  BotCommand,
  BotCommandParameter,
  ParsedCommand
} from '@colloquium/types';

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

// All core bots have been moved to standalone packages:
// - @colloquium/editorial-bot
// - @colloquium/reference-bot  
// - @colloquium/markdown-renderer-bot
// - @colloquium/reviewer-checklist-bot

// No legacy core bots remain

// Export types
export * from '@colloquium/types';