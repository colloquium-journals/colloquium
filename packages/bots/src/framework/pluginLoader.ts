import { promises as fs } from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { BotPlugin, BotPluginLoader, BotInstallationSource, BotPluginError, validateBotPlugin } from './plugin';

export class NodeBotPluginLoader implements BotPluginLoader {
  private loadedPlugins = new Map<string, BotPlugin>();
  private pluginPaths = new Map<string, string>();

  async load(source: BotInstallationSource): Promise<BotPlugin> {
    let pluginPath: string;

    try {
      switch (source.type) {
        case 'npm':
          pluginPath = await this.loadFromNpm(source.packageName, source.version);
          break;
        
        case 'local':
          pluginPath = path.resolve(source.path);
          break;
        
        case 'git':
          pluginPath = await this.loadFromGit(source.url, source.ref);
          break;
        
        case 'url':
          pluginPath = await this.loadFromUrl(source.url);
          break;
        
        default:
          throw new BotPluginError('Unsupported installation source type', 'INVALID_SOURCE');
      }

      // Load the plugin module
      const plugin = await this.loadPluginFromPath(pluginPath);
      
      // Validate the plugin
      const validation = await this.validate(plugin);
      if (!validation.isValid) {
        throw new BotPluginError(
          `Plugin validation failed: ${validation.errors.join(', ')}`,
          'VALIDATION_FAILED',
          validation.errors
        );
      }

      // Store plugin reference
      const botId = plugin.bot.id;
      this.loadedPlugins.set(botId, plugin);
      this.pluginPaths.set(botId, pluginPath);

      // Call activate lifecycle if present
      if (plugin.activate) {
        await plugin.activate();
      }

      return plugin;
    } catch (error) {
      throw new BotPluginError(
        `Failed to load plugin: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'LOAD_FAILED',
        error
      );
    }
  }

  async unload(botId: string): Promise<void> {
    const plugin = this.loadedPlugins.get(botId);
    if (!plugin) {
      throw new BotPluginError(`Plugin ${botId} is not loaded`, 'NOT_LOADED');
    }

    try {
      // Call deactivate lifecycle if present
      if (plugin.deactivate) {
        await plugin.deactivate();
      }

      // Remove from cache
      this.loadedPlugins.delete(botId);
      this.pluginPaths.delete(botId);

      // Clear from require cache if it's a Node.js module
      const pluginPath = this.pluginPaths.get(botId);
      if (pluginPath && require.cache[pluginPath]) {
        delete require.cache[pluginPath];
      }
    } catch (error) {
      throw new BotPluginError(
        `Failed to unload plugin ${botId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'UNLOAD_FAILED',
        error
      );
    }
  }

  async validate(plugin: BotPlugin): Promise<{ isValid: boolean; errors: string[] }> {
    return validateBotPlugin(plugin);
  }

  private async loadFromNpm(packageName: string, version?: string): Promise<string> {
    const installTarget = version ? `${packageName}@${version}` : packageName;
    const tempDir = path.join(process.cwd(), 'temp', 'bots', Date.now().toString());
    
    try {
      await fs.mkdir(tempDir, { recursive: true });
      
      // Initialize a temporary package.json
      await fs.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify({ name: 'temp-bot-loader', version: '1.0.0' }, null, 2)
      );

      // Install the package
      execSync(`npm install ${installTarget}`, {
        cwd: tempDir,
        stdio: 'pipe'
      });

      return path.join(tempDir, 'node_modules', packageName);
    } catch (error) {
      // Clean up on failure
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch {}
      
      throw new BotPluginError(
        `Failed to install npm package ${installTarget}`,
        'NPM_INSTALL_FAILED',
        error
      );
    }
  }

  private async loadFromGit(url: string, ref?: string): Promise<string> {
    const tempDir = path.join(process.cwd(), 'temp', 'bots', Date.now().toString());
    
    try {
      await fs.mkdir(tempDir, { recursive: true });
      
      const cloneCommand = ref 
        ? `git clone --branch ${ref} --single-branch ${url} ${tempDir}`
        : `git clone ${url} ${tempDir}`;
      
      execSync(cloneCommand, { stdio: 'pipe' });

      // Install dependencies if package.json exists
      const packageJsonPath = path.join(tempDir, 'package.json');
      try {
        await fs.access(packageJsonPath);
        execSync('npm install', { cwd: tempDir, stdio: 'pipe' });
      } catch {
        // No package.json or npm install failed - continue anyway
      }

      return tempDir;
    } catch (error) {
      throw new BotPluginError(
        `Failed to clone git repository ${url}`,
        'GIT_CLONE_FAILED',
        error
      );
    }
  }

  private async loadFromUrl(url: string): Promise<string> {
    const tempDir = path.join(process.cwd(), 'temp', 'bots', Date.now().toString());
    const filename = path.basename(url);
    const filePath = path.join(tempDir, filename);
    
    try {
      await fs.mkdir(tempDir, { recursive: true });
      
      // Download the file
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const buffer = await response.arrayBuffer();
      await fs.writeFile(filePath, Buffer.from(buffer));

      // Extract if it's a tar.gz file
      if (filename.endsWith('.tgz') || filename.endsWith('.tar.gz')) {
        execSync(`tar -xzf ${filename}`, { cwd: tempDir, stdio: 'pipe' });
        // Look for extracted directory
        const files = await fs.readdir(tempDir);
        const extractedDir = files.find(f => f !== filename);
        if (extractedDir) {
          return path.join(tempDir, extractedDir);
        }
      }

      return tempDir;
    } catch (error) {
      throw new BotPluginError(
        `Failed to download from URL ${url}`,
        'URL_DOWNLOAD_FAILED',
        error
      );
    }
  }

  private async loadPluginFromPath(pluginPath: string): Promise<BotPlugin> {
    try {
      // Look for package.json to get the main entry point
      let entryPoint = 'index.js';
      try {
        const packageJsonPath = path.join(pluginPath, 'package.json');
        const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
        entryPoint = packageJson.main || packageJson.module || 'index.js';
      } catch {
        // No package.json or invalid - use default
      }

      const modulePath = path.join(pluginPath, entryPoint);
      
      // Clear from require cache to ensure fresh load
      if (require.cache[modulePath]) {
        delete require.cache[modulePath];
      }

      // Load the module (require needed for dynamic plugin loading)
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const loadedModule = require(modulePath);
      
      // Handle both default exports and named exports
      const plugin = loadedModule.default || loadedModule;
      
      if (!plugin.manifest || !plugin.bot) {
        throw new Error('Plugin must export manifest and bot properties');
      }

      return plugin as BotPlugin;
    } catch (error) {
      throw new BotPluginError(
        `Failed to load plugin module from ${pluginPath}`,
        'MODULE_LOAD_FAILED',
        error
      );
    }
  }

  private extractPackageNameFromGitUrl(url: string): string {
    const match = url.match(/\/([^\/]+?)(?:\.git)?$/);
    return match ? match[1] : 'unknown-git-package';
  }

  // Get loaded plugin by bot ID
  getLoadedPlugin(botId: string): BotPlugin | undefined {
    return this.loadedPlugins.get(botId);
  }

  // Get all loaded plugins
  getLoadedPlugins(): BotPlugin[] {
    return Array.from(this.loadedPlugins.values());
  }

  // Clean up temporary directories
  async cleanup(): Promise<void> {
    const tempDir = path.join(process.cwd(), 'temp', 'bots');
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  }
}