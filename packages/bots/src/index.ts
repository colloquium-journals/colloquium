// Export bot framework
export { BotExecutor, botExecutor } from './framework/BotExecutor';
export { createBotContext } from './framework/context';

// Export new command framework
export { 
  CommandParser, 
  commandParser
} from './framework/commands';

// Export help system
export {
  generateBotHelp,
  createDefaultHelpCommand,
  hasHelpCommand,
  injectHelpCommand,
  validateBotHelp
} from './framework/helpSystem';

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
// - @colloquium/bot-editorial
// - @colloquium/bot-reference
// - @colloquium/bot-markdown-renderer
// - @colloquium/bot-reviewer-checklist

// No legacy core bots remain

// Export testing utilities
// Note: Import from '@colloquium/bots/testing' for testing utilities
// This is exported as a namespace to avoid polluting the main export
export * as testing from './testing';

// Export types
export * from '@colloquium/types';