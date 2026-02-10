import { z } from 'zod';
import { CommandBot } from '@colloquium/types';

// Bot plugin manifest schema
export const botPluginManifestSchema = z.object({
  name: z.string().min(1).max(100),
  version: z.string().regex(/^\d+\.\d+\.\d+$/), // Semantic versioning
  description: z.string().min(1).max(500),
  author: z.object({
    name: z.string(),
    email: z.string().email().optional(),
    url: z.string().url().optional()
  }),
  license: z.string().optional().default('MIT'),
  keywords: z.array(z.string()).optional().default([]),
  homepage: z.string().url().optional(),
  repository: z.object({
    type: z.literal('git'),
    url: z.string().url()
  }).optional(),
  bugs: z.object({
    url: z.string().url()
  }).optional(),
  colloquium: z.object({
    botId: z.string().regex(/^[a-z0-9\-]+$/, 'Bot ID must be lowercase alphanumeric with hyphens'),
    apiVersion: z.string().default('1.0.0'), // legacy, use botApiVersion instead
    botApiVersion: z.number().int().min(1).default(1),
    permissions: z.array(z.string()).default([]),
    isDefault: z.boolean().default(false), // Whether this bot should be installed by default
    category: z.enum(['editorial', 'analysis', 'formatting', 'quality', 'integration', 'utility']).optional(),
    minColloquiumVersion: z.string().optional(),
    supportsFileUploads: z.boolean().optional().default(false)
  })
});

export type BotPluginManifest = z.infer<typeof botPluginManifestSchema>;

// Bot plugin interface
export interface BotPlugin {
  manifest: BotPluginManifest;
  bot: CommandBot;
  activate?(): Promise<void>;
  deactivate?(): Promise<void>;
}

// Bot installation record
export interface BotInstallation {
  id: string;
  packageName: string;
  version: string;
  manifest: BotPluginManifest;
  config: Record<string, any>;
  yamlConfig?: string; // YAML with comments for UI display
  isEnabled: boolean;
  isDefault: boolean;
  installedAt: Date;
  updatedAt: Date;
  installedBy?: string; // User ID who installed it
}

// Bot registry entry
export interface BotRegistryEntry {
  packageName: string;
  manifest: BotPluginManifest;
  downloads?: number;
  lastUpdated?: Date;
  verified?: boolean; // Whether the bot has been verified by Colloquium team
  rating?: number;
  tags?: string[];
}

// Bot installation source
export type BotInstallationSource = 
  | { type: 'npm'; packageName: string; version?: string }
  | { type: 'git'; url: string; ref?: string }
  | { type: 'local'; path: string }
  | { type: 'url'; url: string };

// Bot plugin loader interface
export interface BotPluginLoader {
  load(source: BotInstallationSource): Promise<BotPlugin>;
  unload(botId: string): Promise<void>;
  validate(plugin: BotPlugin): Promise<{ isValid: boolean; errors: string[] }>;
}

// Bot registry interface
export interface BotRegistry {
  search(query: string, options?: {
    category?: string;
    author?: string;
    tags?: string[];
    limit?: number;
    offset?: number;
  }): Promise<BotRegistryEntry[]>;
  
  get(packageName: string): Promise<BotRegistryEntry | null>;
  publish(plugin: BotPlugin): Promise<void>;
  unpublish(packageName: string, version: string): Promise<void>;
}

// Bot manager interface
export interface BotManager {
  install(source: BotInstallationSource, config?: Record<string, any>): Promise<BotInstallation>;
  uninstall(botId: string): Promise<void>;
  update(botId: string, version?: string): Promise<BotInstallation>;
  
  enable(botId: string): Promise<void>;
  disable(botId: string): Promise<void>;
  configure(botId: string, config: Record<string, any>): Promise<void>;
  
  list(): Promise<BotInstallation[]>;
  get(botId: string): Promise<BotInstallation | null>;
  getBotHelp(botId: string): Promise<string | null>;
  
  installDefaults(): Promise<BotInstallation[]>;
}

// Plugin validation errors
export class BotPluginError extends Error {
  constructor(message: string, public code: string, public details?: any) {
    super(message);
    this.name = 'BotPluginError';
  }
}

// Standard bot plugin validation
export function validateBotPlugin(plugin: any): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  try {
    // Validate manifest
    const manifestResult = botPluginManifestSchema.safeParse(plugin.manifest);
    if (!manifestResult.success) {
      errors.push(...manifestResult.error.errors.map(e => `Manifest ${e.path.join('.')}: ${e.message}`));
    }
    
    // Validate bot structure
    if (!plugin.bot) {
      errors.push('Plugin must export a bot property');
    } else {
      const bot = plugin.bot as CommandBot;
      
      if (!bot.id) {
        errors.push('Bot must have an id');
      } else if (bot.id !== plugin.manifest?.colloquium?.botId) {
        errors.push('Bot ID must match manifest colloquium.botId');
      }
      
      if (!bot.name) {
        errors.push('Bot must have a name');
      }
      
      if (!bot.version) {
        errors.push('Bot must have a version');
      }
      
      if (!Array.isArray(bot.commands) || bot.commands.length === 0) {
        errors.push('Bot must have at least one command');
      }
      
      // Validate commands
      bot.commands?.forEach((command, i) => {
        if (!command.name) {
          errors.push(`Command ${i}: name is required`);
        }
        if (!command.description) {
          errors.push(`Command ${i}: description is required`);
        }
        if (typeof command.execute !== 'function') {
          errors.push(`Command ${i}: execute must be a function`);
        }
      });
    }
    
    // Validate lifecycle methods if present
    if (plugin.activate && typeof plugin.activate !== 'function') {
      errors.push('activate must be a function if provided');
    }
    
    if (plugin.deactivate && typeof plugin.deactivate !== 'function') {
      errors.push('deactivate must be a function if provided');
    }
    
  } catch (error) {
    errors.push(`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

// Helper to create a bot plugin manifest
export function createBotManifest(options: {
  name: string;
  version: string;
  description: string;
  author: { name: string; email?: string; url?: string };
  botId: string;
  category?: BotPluginManifest['colloquium']['category'];
  keywords?: string[];
  permissions?: string[];
  license?: string;
  isDefault?: boolean;
  supportsFileUploads?: boolean;
}): BotPluginManifest {
  return {
    name: options.name,
    version: options.version,
    description: options.description,
    author: options.author,
    license: options.license || 'MIT',
    keywords: options.keywords || [],
    colloquium: {
      botId: options.botId,
      apiVersion: '1.0.0',
      botApiVersion: 1,
      permissions: options.permissions || [],
      category: options.category,
      isDefault: options.isDefault || false,
      supportsFileUploads: options.supportsFileUploads || false
    }
  };
}