import { prisma } from "@colloquium/database";
import {
  BotManager,
  BotInstallation,
  BotInstallationSource,
  BotPluginError,
  BotPluginLoader,
} from "./plugin";
import { BotInstallationContext, CommandBot } from "@colloquium/types";
import { NodeBotPluginLoader } from "./pluginLoader";
import { BotExecutor } from "./BotExecutor";
import path from "path";
import fs from "fs-extra";
import crypto from "crypto";
import yaml from "js-yaml";

// YAML configuration utilities
function parseYamlConfig(yamlString: string): any {
  return yaml.load(yamlString);
}

function stringifyYamlConfig(obj: any): string {
  return yaml.dump(obj, {
    indent: 2,
    lineWidth: 80,
    quotingType: '"',
    forceQuotes: false
  });
}

function getPackagesDir(): string {
  return path.resolve(__dirname, "../../..");
}

function discoverLocalBotDirs(): string[] {
  const packagesDir = getPackagesDir();
  const entries = fs.readdirSync(packagesDir, { withFileTypes: true });
  return entries
    .filter((e) => e.isDirectory() && e.name.startsWith("bot-"))
    .map((e) => path.join(packagesDir, e.name));
}

export class DatabaseBotManager implements BotManager {
  private pluginLoader: BotPluginLoader;
  private botExecutor: BotExecutor;

  constructor(pluginLoader?: BotPluginLoader, botExecutor?: BotExecutor) {
    this.pluginLoader = pluginLoader || new NodeBotPluginLoader();
    this.botExecutor = botExecutor || new BotExecutor();
  }

  async install(
    source: BotInstallationSource,
    config: Record<string, any> | string = {}
  ): Promise<BotInstallation> {
    try {
      // Load the plugin
      const plugin = await this.pluginLoader.load(source);
      const { manifest, bot } = plugin;

      // Check if bot is already installed
      const existing = await this.get(bot.id);
      if (existing) {
        throw new BotPluginError(
          `Bot ${bot.id} is already installed`,
          "ALREADY_INSTALLED"
        );
      }

      // Create bot user in database
      const botEmail = `${bot.id}@colloquium.bot`;
      let botUser = await prisma.users.findUnique({
        where: { email: botEmail },
      });

      if (!botUser) {
        botUser = await prisma.users.create({
          data: {
            id: `bot-${bot.id}`,
            email: botEmail,
            username: bot.id,
            name: bot.name,
            role: "BOT",
            updatedAt: new Date(),
          },
        });
      }

      // Handle YAML default config - ONLY from default-config.yaml file
      let defaultConfig = {};
      let defaultYamlConfig = '';
      
      // Read default-config.yaml file from bot directory
      try {
        let configPath: string;
        if (source.type === 'local') {
          configPath = path.join(source.path, 'default-config.yaml');
        } else if (source.type === 'npm') {
          // For npm packages, we'd need to find the installed location
          const packagePath = path.join(process.cwd(), 'node_modules', source.packageName);
          configPath = path.join(packagePath, 'default-config.yaml');
        } else {
          // For git/url sources, assume they're extracted to a temp directory
          configPath = path.join(process.cwd(), 'temp', 'bots', 'default-config.yaml');
        }

        if (await fs.pathExists(configPath)) {
          defaultYamlConfig = await fs.readFile(configPath, 'utf-8');
          defaultConfig = parseYamlConfig(defaultYamlConfig);
          console.log(`✅ Loaded default-config.yaml for ${bot.id}`);
        } else {
          console.log(`⚠️  No default-config.yaml found for ${bot.id} at ${configPath}`);
          console.log(`   Bot will be installed with empty default configuration.`);
          console.log(`   Bot developers should create a default-config.yaml file with helpful comments.`);
        }
      } catch (error) {
        console.error(`❌ Error loading default-config.yaml for ${bot.id}:`, error instanceof Error ? error.message : error);
      }

      // Merge default config with provided config
      let finalConfig: Record<string, any>;
      let finalYamlConfig: string;
      
      if (typeof config === 'string') {
        finalYamlConfig = config;
        finalConfig = { ...defaultConfig, ...parseYamlConfig(config) };
      } else {
        finalConfig = { ...defaultConfig, ...config };
        // Use the default YAML config with comments if available, otherwise stringify
        finalYamlConfig = defaultYamlConfig || stringifyYamlConfig(finalConfig);
      }

      // Store package information in bot definition FIRST
      await prisma.bot_definitions.upsert({
        where: { id: bot.id },
        create: {
          id: bot.id,
          name: bot.name,
          description: bot.description,
          version: bot.version,
          author: manifest.author.name,
          isPublic: true,
          configSchema: this.generateConfigSchema(bot),
          supportsFileUploads: bot.supportsFileUploads || false,
        },
        update: {
          name: bot.name,
          description: bot.description,
          version: bot.version,
          author: manifest.author.name,
          supportsFileUploads: bot.supportsFileUploads || false,
          updatedAt: new Date(),
        },
      });

      // Create installation record AFTER bot definition exists
      const installation = await prisma.bot_installs.create({
        data: {
          id: `install-${bot.id}-${Date.now()}`,
          botId: bot.id,
          config: finalConfig,
          yamlConfig: finalYamlConfig,
          isEnabled: true,
        },
      });

      // Register bot with executor
      this.botExecutor.registerCommandBot(bot);
      this.botExecutor.setBotUserId(bot.id, botUser.id);
      this.botExecutor.installBot(bot.id, finalConfig);

      // Call bot's onInstall hook if it exists
      if (bot.onInstall) {
        await this.callBotInstallationHook(bot, botUser.id, finalConfig);
      }

      // Return installation record
      const installationRecord: BotInstallation = {
        id: installation.id,
        packageName: this.getPackageNameFromSource(source),
        version: manifest.version,
        manifest,
        config: finalConfig,
        isEnabled: installation.isEnabled,
        isDefault: manifest.colloquium.isDefault,
        installedAt: installation.installedAt,
        updatedAt: installation.updatedAt,
      };

      // console.log(`✅ Bot ${bot.name} (${bot.id}) installed successfully`);
      return installationRecord;
    } catch (error) {
      if (
        error instanceof BotPluginError &&
        error.code === "ALREADY_INSTALLED"
      ) {
        console.log(
          `ℹ️ Bot ${this.getSourceName(source)} is already installed`
        );
      } else {
        console.error(`❌ Failed to install bot:`, error);
      }
      throw error instanceof BotPluginError
        ? error
        : new BotPluginError(
            `Installation failed: ${
              error instanceof Error ? error.message : "Unknown error"
            }`,
            "INSTALL_FAILED",
            error
          );
    }
  }

  async uninstall(botId: string): Promise<void> {
    const installation = await this.get(botId);
    if (!installation) {
      throw new BotPluginError(
        `Bot ${botId} is not installed`,
        "NOT_INSTALLED"
      );
    }

    try {
      // Unload from plugin loader (only if loaded)
      try {
        await this.pluginLoader.unload(botId);
      } catch (error) {
        // Ignore "not loaded" errors since the plugin might not be in memory
        if (error instanceof BotPluginError && error.code === 'NOT_LOADED') {
          // Plugin wasn't loaded, which is fine for uninstall
        } else {
          throw error;
        }
      }

      // Unregister from bot executor
      this.botExecutor.unregisterBot(botId);

      // Remove from database
      await prisma.bot_installs.delete({
        where: { botId },
      });

      // Optionally remove bot definition if no other installations exist
      const otherInstalls = await prisma.bot_installs.findFirst({
        where: { botId },
      });

      if (!otherInstalls) {
        await prisma.bot_definitions
          .delete({
            where: { id: botId },
          })
          .catch(() => {
            // Ignore if bot definition doesn't exist
          });
      }

      // console.log(`✅ Bot ${botId} uninstalled successfully`);
    } catch (error) {
      throw new BotPluginError(
        `Failed to uninstall bot ${botId}: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        "UNINSTALL_FAILED",
        error
      );
    }
  }

  async update(botId: string, version?: string): Promise<BotInstallation> {
    const installation = await this.get(botId);
    if (!installation) {
      throw new BotPluginError(
        `Bot ${botId} is not installed`,
        "NOT_INSTALLED"
      );
    }

    try {
      // Create new installation source with updated version
      const source: BotInstallationSource = {
        type: "npm",
        packageName: installation.packageName,
        version,
      };

      // Preserve current config
      const currentConfig = installation.config;

      // Uninstall current version
      await this.uninstall(botId);

      // Install new version
      const newInstallation = await this.install(source, currentConfig);

      // console.log(`✅ Bot ${botId} updated to version ${newInstallation.version}`);
      return newInstallation;
    } catch (error) {
      throw new BotPluginError(
        `Failed to update bot ${botId}: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        "UPDATE_FAILED",
        error
      );
    }
  }

  async enable(botId: string): Promise<void> {
    const installation = await this.get(botId);
    if (!installation) {
      throw new BotPluginError(
        `Bot ${botId} is not installed`,
        "NOT_INSTALLED"
      );
    }

    if (installation.isEnabled) {
      return; // Already enabled
    }

    await prisma.bot_installs.update({
      where: { botId },
      data: { isEnabled: true },
    });

    // Re-enable in bot executor
    this.botExecutor.installBot(botId, installation.config);

    // console.log(`✅ Bot ${botId} enabled`);
  }

  async disable(botId: string): Promise<void> {
    const installation = await this.get(botId);
    if (!installation) {
      throw new BotPluginError(
        `Bot ${botId} is not installed`,
        "NOT_INSTALLED"
      );
    }

    if (!installation.isEnabled) {
      return; // Already disabled
    }

    await prisma.bot_installs.update({
      where: { botId },
      data: { isEnabled: false },
    });

    // Disable in bot executor
    this.botExecutor.uninstallBot(botId);

    // console.log(`✅ Bot ${botId} disabled`);
  }

  async configure(botId: string, configInput: Record<string, any> | string): Promise<void> {
    const installation = await this.get(botId);
    if (!installation) {
      throw new BotPluginError(
        `Bot ${botId} is not installed`,
        "NOT_INSTALLED"
      );
    }

    let yamlConfig: string;
    let parsedConfig: Record<string, any>;

    if (typeof configInput === 'string') {
      // Raw YAML string
      yamlConfig = configInput;
      parsedConfig = parseYamlConfig(configInput);
    } else {
      // Already parsed object
      parsedConfig = configInput;
      yamlConfig = stringifyYamlConfig(configInput);
    }

    // Update configuration in database
    await prisma.bot_installs.update({
      where: { botId },
      data: {
        config: parsedConfig,
        yamlConfig,
        updatedAt: new Date(),
      },
    });

    // Update configuration in bot executor if bot is enabled
    if (installation.isEnabled) {
      this.botExecutor.uninstallBot(botId);
      this.botExecutor.installBot(botId, parsedConfig);
    }

    // console.log(`✅ Bot ${botId} configuration updated`);
  }

  async list(): Promise<BotInstallation[]> {
    const installations = await prisma.bot_installs.findMany({
      include: {
        bot_definitions: true,
      },
    });

    // Convert to BotInstallation format
    return installations.map((install: any) => ({
      id: install.id,
      packageName: this.constructPackageNameFromBotId(install.botId),
      version: install.bot_definitions.version,
      manifest: this.createManifestFromBot(install.bot_definitions),
      config: install.config as Record<string, any>,
      yamlConfig: install.yamlConfig || undefined,
      isEnabled: install.isEnabled,
      isDefault: false, // Would need to store this in database
      installedAt: install.installedAt,
      updatedAt: install.updatedAt,
    }));
  }

  async get(botId: string): Promise<BotInstallation | null> {
    const installation = await prisma.bot_installs.findUnique({
      where: { botId },
      include: {
        bot_definitions: true,
      },
    });

    if (!installation) {
      return null;
    }

    return {
      id: installation.id,
      packageName: this.constructPackageNameFromBotId(installation.botId),
      version: installation.bot_definitions.version,
      manifest: this.createManifestFromBot(installation.bot_definitions),
      config: installation.config as Record<string, any>,
      yamlConfig: installation.yamlConfig || undefined,
      isEnabled: installation.isEnabled,
      isDefault: false,
      installedAt: installation.installedAt,
      updatedAt: installation.updatedAt,
    };
  }

  async installDefaults(): Promise<BotInstallation[]> {
    // In development, use local bot implementations
    // In production, use published npm packages
    const isDevelopment = process.env.NODE_ENV !== "production";

    const defaultBots = isDevelopment
      ? discoverLocalBotDirs().map((botPath) => ({
          source: {
            type: "local" as const,
            path: botPath,
          },
        }))
      : discoverLocalBotDirs().map((botPath) => ({
          source: {
            type: "npm" as const,
            packageName: `@colloquium/${path.basename(botPath)}`,
          },
        }));

    const installations: BotInstallation[] = [];

    for (const botConfig of defaultBots) {
      try {
        // Check if already installed
        const botId = this.extractBotIdFromSource(botConfig.source);
        const existing = await this.get(botId);

        if (!existing) {
          // Install with config if provided, otherwise use default-config.yaml
          const installation = await this.install(botConfig.source, (botConfig as any).config);
          installations.push(installation);
          // console.log(`✅ Default bot ${this.getSourceName(botConfig.source)} installed`);
        } else {
          // console.log(`ℹ️ Default bot ${this.getSourceName(botConfig.source)} already installed`);
        }
      } catch (error) {
        // Handle "already installed" errors gracefully
        if (
          error instanceof BotPluginError &&
          error.code === "ALREADY_INSTALLED"
        ) {
          console.log(
            `ℹ️ Bot ${this.getSourceName(botConfig.source)} is already installed`
          );
        } else {
          console.error(
            `❌ Failed to install default bot ${this.getSourceName(botConfig.source)}:`,
            error
          );
        }
      }
    }

    return installations;
  }

  private getPackageNameFromSource(source: BotInstallationSource): string {
    switch (source.type) {
      case "npm":
        return source.packageName;
      case "git":
        return source.url.split("/").pop()?.replace(".git", "") || "unknown";
      case "local":
        return source.path.split("/").pop() || "unknown";
      case "url":
        return source.url.split("/").pop() || "unknown";
      default:
        return "unknown";
    }
  }

  private extractBotIdFromSource(source: BotInstallationSource): string {
    switch (source.type) {
      case "npm":
        return this.extractBotIdFromPackageName(source.packageName);
      case "local": {
        // Folder names like "bot-editorial" are now the bot ID directly
        const folderName = path.basename(source.path);
        return folderName;
      }
      case "git":
        return path.basename(source.url, ".git");
      case "url":
        return path.basename(source.url, ".tgz");
      default:
        return "unknown-bot";
    }
  }

  private getSourceName(source: BotInstallationSource): string {
    switch (source.type) {
      case "npm":
        return source.packageName;
      case "local":
        return `local:${source.path}`;
      case "git":
        return `git:${source.url}`;
      case "url":
        return `url:${source.url}`;
      default:
        return "unknown-source";
    }
  }

  private extractBotIdFromPackageName(packageName: string): string {
    // Convert @colloquium/bot-editorial to bot-editorial
    const stripped = packageName.replace("@colloquium/", "");
    return stripped;
  }

  private constructPackageNameFromBotId(botId: string): string {
    // Convert bot-editorial to @colloquium/bot-editorial
    return `@colloquium/${botId}`;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private generateConfigSchema(bot: any): any {
    // Generate a basic JSON schema for bot configuration
    // This could be enhanced based on bot metadata
    return {
      type: "object",
      properties: {
        enabled: {
          type: "boolean",
          default: true,
          description: "Whether the bot is enabled",
        },
      },
    };
  }

  private createManifestFromBot(bot: any): any {
    // Create a manifest from bot database record
    return {
      name: bot.name,
      version: bot.version,
      description: bot.description,
      author: {
        name: bot.author,
      },
      colloquium: {
        botId: bot.id,
        apiVersion: "1.0.0",
        permissions: bot.permissions?.map((p: any) => p.permission) || [],
        isDefault: false,
        supportsFileUploads: bot.supportsFileUploads || false,
      },
    };
  }

  async getBotHelp(botId: string): Promise<string | null> {
    try {
      // First check if bot is installed
      const installation = await this.get(botId);
      if (!installation) {
        return null;
      }

      // Try to get help from the bot executor first (if bot is loaded)
      const helpFromExecutor = this.botExecutor.getBotHelp(botId);
      if (helpFromExecutor) {
        return helpFromExecutor;
      }

      // If not available from executor, load the bot temporarily to get help
      const isDevelopment = process.env.NODE_ENV !== "production";
      let source: BotInstallationSource;
      
      if (isDevelopment) {
        source = {
          type: "local",
          path: path.join(getPackagesDir(), botId)
        };
      } else {
        source = {
          type: "npm",
          packageName: installation.packageName
        };
      }

      // Load the plugin temporarily
      const plugin = await this.pluginLoader.load(source);
      if (!plugin || !plugin.bot) {
        return null;
      }

      // Generate help using the command parser
      const { commandParser } = await import('./commands');
      commandParser.registerBot(plugin.bot);
      return commandParser.generateBotHelp(plugin.bot.id);
    } catch (error) {
      console.error(`Failed to get help for bot ${botId}:`, error);
      return null;
    }
  }

  async reloadAllBots(): Promise<void> {
    console.log('🔄 Reloading all installed bots...');
    
    // Get all installed bots from database
    const installations = await this.list();
    
    for (const installation of installations) {
      if (!installation.isEnabled) {
        continue; // Skip disabled bots
      }
      
      try {
        // Reconstruct source based on environment
        const isDevelopment = process.env.NODE_ENV !== "production";
        const botId = installation.manifest.colloquium.botId;
        
        let source: BotInstallationSource;
        
        if (isDevelopment) {
          source = {
            type: "local",
            path: path.join(getPackagesDir(), botId)
          };
        } else {
          // In production, use npm packages
          source = {
            type: "npm",
            packageName: installation.packageName
          };
        }
        
        // Load the plugin
        const plugin = await this.pluginLoader.load(source);
        
        if (plugin && plugin.bot) {
          // Register with executor
          this.botExecutor.registerCommandBot(plugin.bot);
          this.botExecutor.installBot(plugin.bot.id, installation.config);
          
          // Ensure bot user exists (create user ID mapping)
          const botEmail = `${plugin.bot.id}@colloquium.bot`;
          const botUser = await prisma.users.findUnique({
            where: { email: botEmail }
          });
          
          if (botUser) {
            this.botExecutor.setBotUserId(plugin.bot.id, botUser.id);
          }
          
          // console.log(`✅ Reloaded bot: ${plugin.bot.name}`);
        }
      } catch (error) {
        console.error(`❌ Failed to reload bot ${installation.manifest?.colloquium?.botId}:`, error);
      }
    }
  }


  /**
   * Call a bot's onInstall hook with proper context
   */
  public async callBotInstallationHook(bot: CommandBot, uploadedBy: string, config: Record<string, any> | string): Promise<void> {
    try {
      console.log(`🔗 Calling onInstall hook for ${bot.id}...`);
      
      // Create upload function for the bot
      const uploadFile = async (filename: string, content: Buffer, mimetype: string, description?: string) => {
        const uploadDir = process.env.BOT_CONFIG_UPLOAD_DIR || './uploads/bot-config';
        await fs.ensureDir(uploadDir);

        // Generate unique stored filename
        const ext = path.extname(filename);
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const storedName = `file-${uniqueSuffix}${ext}`;
        const storedPath = path.join(uploadDir, storedName);

        // Save file to disk
        await fs.writeFile(storedPath, content);

        // Generate checksum
        const checksum = crypto.createHash('sha256').update(content).digest('hex');

        // Store in database
        const configFile = await prisma.bot_config_files.create({
          data: {
            id: crypto.randomUUID(),
            botId: bot.id,
            filename,
            storedName,
            path: storedPath,
            mimetype,
            size: content.length,
            checksum,
            category: 'template',
            description: description || `File: ${filename}`,
            uploadedBy,
            updatedAt: new Date(),
            metadata: {
              originalName: filename,
              source: 'built-in'
            }
          }
        });

        return {
          id: configFile.id,
          downloadUrl: `/api/bot-config-files/${configFile.id}/download`
        };
      };

      // Parse config if it's a string
      const parsedConfig = typeof config === 'string' ? parseYamlConfig(config) : config;
      
      // Create installation context
      const context: BotInstallationContext = {
        botId: bot.id,
        config: parsedConfig,
        uploadFile
      };

      // Call the hook
      await bot.onInstall!(context);
      
      console.log(`✅ Successfully completed onInstall hook for ${bot.id}`);
    } catch (error) {
      console.error(`❌ Failed to call onInstall hook for ${bot.id}:`, error);
      // Don't throw error to avoid breaking installation, just log it
    }
  }
}
