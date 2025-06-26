import { prisma } from "@colloquium/database/src";
import {
  BotManager,
  BotInstallation,
  BotInstallationSource,
  BotPluginError,
  BotPluginLoader,
} from "./plugin";
import { NodeBotPluginLoader } from "./pluginLoader";
import { BotExecutor } from "./BotExecutor";
import path from "path";

export class DatabaseBotManager implements BotManager {
  private pluginLoader: BotPluginLoader;
  private botExecutor: BotExecutor;

  constructor(pluginLoader?: BotPluginLoader, botExecutor?: BotExecutor) {
    this.pluginLoader = pluginLoader || new NodeBotPluginLoader();
    this.botExecutor = botExecutor || new BotExecutor();
  }

  async install(
    source: BotInstallationSource,
    config: Record<string, any> = {}
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
      let botUser = await prisma.user.findUnique({
        where: { email: botEmail },
      });

      if (!botUser) {
        botUser = await prisma.user.create({
          data: {
            email: botEmail,
            name: bot.name,
            role: "BOT",
          },
        });
      }

      // Merge default config with provided config
      const finalConfig = {
        ...manifest.colloquium.defaultConfig,
        ...config,
      };

      // Store package information in bot definition FIRST
      await prisma.botDefinition.upsert({
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
          permissions: {
            create: bot.permissions.map((permission) => ({
              permission,
              description: `Permission: ${permission}`,
            })),
          },
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
      const installation = await prisma.botInstall.create({
        data: {
          botId: bot.id,
          config: finalConfig,
          isEnabled: true,
        },
      });

      // Register bot with executor
      this.botExecutor.registerCommandBot(bot);
      this.botExecutor.setBotUserId(bot.id, botUser.id);
      this.botExecutor.installBot(bot.id, finalConfig);

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
      // Unload from plugin loader
      await this.pluginLoader.unload(botId);

      // Unregister from bot executor
      this.botExecutor.unregisterBot(botId);

      // Remove from database
      await prisma.botInstall.delete({
        where: { botId },
      });

      // Optionally remove bot definition if no other installations exist
      const otherInstalls = await prisma.botInstall.findFirst({
        where: { botId },
      });

      if (!otherInstalls) {
        await prisma.botDefinition
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

    await prisma.botInstall.update({
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

    await prisma.botInstall.update({
      where: { botId },
      data: { isEnabled: false },
    });

    // Disable in bot executor
    this.botExecutor.uninstallBot(botId);

    // console.log(`✅ Bot ${botId} disabled`);
  }

  async configure(botId: string, config: Record<string, any>): Promise<void> {
    const installation = await this.get(botId);
    if (!installation) {
      throw new BotPluginError(
        `Bot ${botId} is not installed`,
        "NOT_INSTALLED"
      );
    }

    // Update configuration in database
    await prisma.botInstall.update({
      where: { botId },
      data: {
        config,
        updatedAt: new Date(),
      },
    });

    // Update configuration in bot executor if bot is enabled
    if (installation.isEnabled) {
      this.botExecutor.uninstallBot(botId);
      this.botExecutor.installBot(botId, config);
    }

    // console.log(`✅ Bot ${botId} configuration updated`);
  }

  async list(): Promise<BotInstallation[]> {
    const installations = await prisma.botInstall.findMany({
      include: {
        bot: true,
      },
    });

    // Convert to BotInstallation format
    return installations.map((install: any) => ({
      id: install.id,
      packageName: `@colloquium/bot-${install.botId}`, // Default package name format
      version: install.bot.version,
      manifest: this.createManifestFromBot(install.bot),
      config: install.config as Record<string, any>,
      isEnabled: install.isEnabled,
      isDefault: false, // Would need to store this in database
      installedAt: install.installedAt,
      updatedAt: install.updatedAt,
    }));
  }

  async get(botId: string): Promise<BotInstallation | null> {
    const installation = await prisma.botInstall.findUnique({
      where: { botId },
      include: {
        bot: true,
      },
    });

    if (!installation) {
      return null;
    }

    return {
      id: installation.id,
      packageName: `@colloquium/bot-${installation.botId}`,
      version: installation.bot.version,
      manifest: this.createManifestFromBot(installation.bot),
      config: installation.config as Record<string, any>,
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
      ? [
          {
            source: {
              type: "local" as const,
              path: path.resolve(__dirname, "../../../editorial-bot"),
            },
            config: { autoStatusUpdates: true, notifyAuthors: true },
          },
          {
            source: {
              type: "local" as const,
              path: path.resolve(__dirname, "../../../reference-bot"),
            },
            config: { defaultTimeout: 30, includeMissingDoiReferences: true },
          },
          {
            source: {
              type: "local" as const,
              path: path.resolve(__dirname, "../../../markdown-renderer-bot"),
            },
            config: { 
              defaultTemplate: "academic-standard",
              customTemplates: {},
              enablePdfGeneration: true,
              maxFileSize: "50MB"
            },
          },
          {
            source: {
              type: "local" as const,
              path: path.resolve(__dirname, "../../../reviewer-checklist-bot"),
            },
            config: { 
              title: "Manuscript Review Checklist",
              criteria: []
            },
          },
        ]
      : [
          {
            source: {
              type: "npm" as const,
              packageName: "@colloquium/editorial-bot",
            },
            config: { autoStatusUpdates: true, notifyAuthors: true },
          },
          {
            source: {
              type: "npm" as const,
              packageName: "@colloquium/reference-bot",
            },
            config: { defaultTimeout: 30, includeMissingDoiReferences: true },
          },
          {
            source: {
              type: "npm" as const,
              packageName: "@colloquium/markdown-renderer-bot",
            },
            config: { 
              defaultTemplate: "academic-standard",
              customTemplates: {},
              enablePdfGeneration: true,
              maxFileSize: "50MB"
            },
          },
          {
            source: {
              type: "npm" as const,
              packageName: "@colloquium/reviewer-checklist-bot",
            },
            config: { 
              title: "Manuscript Review Checklist",
              criteria: []
            },
          },
        ];

    const installations: BotInstallation[] = [];

    for (const { source, config } of defaultBots) {
      try {
        // Check if already installed
        const botId = this.extractBotIdFromSource(source);
        const existing = await this.get(botId);

        if (!existing) {
          const installation = await this.install(source, config);
          installations.push(installation);
          // console.log(`✅ Default bot ${this.getSourceName(source)} installed`);
        } else {
          // console.log(`ℹ️ Default bot ${this.getSourceName(source)} already installed`);
        }
      } catch (error) {
        // Handle "already installed" errors gracefully
        if (
          error instanceof BotPluginError &&
          error.code === "ALREADY_INSTALLED"
        ) {
          console.log(
            `ℹ️ Bot ${this.getSourceName(source)} is already installed`
          );
        } else {
          console.error(
            `❌ Failed to install default bot ${this.getSourceName(source)}:`,
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
      case "local":
        return path.basename(source.path);
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
    // Convert @colloquium/editorial-bot to editorial-bot
    return packageName
      .replace("@colloquium/bot-", "")
      .replace("@colloquium/", "");
  }

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
        const folderName = botId.endsWith('-bot') ? botId : `${botId}-bot`;
        source = {
          type: "local",
          path: path.resolve(__dirname, `../../../${folderName}`)
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
          // In development, use local paths - correct the botId to match folder names
          const folderName = botId.endsWith('-bot') ? botId : `${botId}-bot`;
          source = {
            type: "local",
            path: path.resolve(__dirname, `../../../${folderName}`)
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
          let botUser = await prisma.user.findUnique({
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
}
