/**
 * Bot Test Harness - High-level wrapper for testing bot commands
 */

import { CommandBot, BotContext, BotResponse, BotTrigger } from '@colloquium/types';
import { createMockContext, MockContextOptions } from './mockContext';
import { MockApiServer, MockManuscriptData } from './mockApiServer';
import { MockFile, createMockFile } from './mockFiles';

export interface TestHarnessOptions {
  context?: MockContextOptions;
  files?: MockFile[];
  manuscriptData?: MockManuscriptData;
  autoInstall?: boolean;
}

/**
 * High-level test harness for bot command testing
 */
export class BotTestHarness<T extends CommandBot> {
  private bot: T;
  private context: BotContext;
  private mockServer: MockApiServer;
  private installed: boolean = false;
  private files: MockFile[] = [];

  constructor(bot: T, options: TestHarnessOptions = {}) {
    this.bot = bot;
    this.files = options.files ?? [];
    this.context = createMockContext(options.context);
    this.mockServer = MockApiServer.withManuscriptAndFiles(
      options.manuscriptData ?? {},
      this.files
    );

    // Mock common browser/node globals for testing
    this.setupGlobals();

    if (options.autoInstall !== false) {
      this.install();
    }
  }

  /**
   * Sets up global mocks needed for testing
   */
  private setupGlobals(): void {
    // Mock FormData if not available
    if (typeof global.FormData === 'undefined') {
      (global as any).FormData = class MockFormData {
        private data: Map<string, any> = new Map();
        append(key: string, value: any) { this.data.set(key, value); }
        get(key: string) { return this.data.get(key); }
        has(key: string) { return this.data.has(key); }
        delete(key: string) { this.data.delete(key); }
        entries() { return this.data.entries(); }
      };
    }

    // Mock Blob if not available
    if (typeof global.Blob === 'undefined') {
      (global as any).Blob = class MockBlob {
        private content: any[];
        readonly size: number;
        readonly type: string;
        constructor(content: any[] = [], options: { type?: string } = {}) {
          this.content = content;
          this.type = options.type ?? '';
          this.size = content.reduce((acc, c) => acc + (c.length ?? 0), 0);
        }
        async text() {
          return this.content.join('');
        }
        async arrayBuffer() {
          const text = this.content.join('');
          return new TextEncoder().encode(text).buffer;
        }
      };
    }
  }

  /**
   * Configures the test context
   */
  withContext(overrides: MockContextOptions): this {
    this.context = createMockContext({
      ...this.extractContextOptions(),
      ...overrides
    });
    return this;
  }

  /**
   * Extracts current context options
   */
  private extractContextOptions(): MockContextOptions {
    return {
      manuscriptId: this.context.manuscriptId,
      conversationId: this.context.conversationId,
      userId: this.context.triggeredBy.userId,
      userRole: this.context.triggeredBy.userRole,
      messageId: this.context.triggeredBy.messageId,
      trigger: this.context.triggeredBy.trigger,
      journalId: this.context.journal.id,
      journalSettings: this.context.journal.settings,
      config: this.context.config,
      serviceToken: this.context.serviceToken
    };
  }

  /**
   * Sets files available through the mock server
   */
  withFiles(files: MockFile[]): this {
    this.files = files;
    this.mockServer.setFiles(files);
    return this;
  }

  /**
   * Adds a single file to the mock server
   */
  addFile(file: Partial<MockFile> & { filename?: string; originalName?: string }): this {
    const mockFile = createMockFile(file);
    this.files.push(mockFile);
    this.mockServer.setFiles(this.files);
    return this;
  }

  /**
   * Sets manuscript data for the mock server
   */
  withManuscript(data: MockManuscriptData): this {
    this.mockServer.setManuscriptData(data);
    return this;
  }

  /**
   * Sets bot configuration
   */
  withConfig(config: Record<string, any>): this {
    this.context = {
      ...this.context,
      config: { ...this.context.config, ...config }
    };
    return this;
  }

  /**
   * Sets journal settings
   */
  withJournalSettings(settings: Record<string, any>): this {
    this.context = {
      ...this.context,
      journal: {
        ...this.context.journal,
        settings: { ...this.context.journal.settings, ...settings }
      }
    };
    return this;
  }

  /**
   * Installs the mock server
   */
  install(): this {
    if (!this.installed) {
      this.mockServer.install();
      this.installed = true;
    }
    return this;
  }

  /**
   * Executes a bot command
   */
  async executeCommand(
    commandName: string,
    params: Record<string, any> = {}
  ): Promise<BotResponse> {
    if (!this.installed) {
      this.install();
    }

    const command = this.bot.commands.find(cmd => cmd.name === commandName);
    if (!command) {
      throw new Error(`Command "${commandName}" not found on bot "${this.bot.id}"`);
    }

    return command.execute(params, this.context);
  }

  /**
   * Gets the underlying mock server for custom setup
   */
  getMockServer(): MockApiServer {
    return this.mockServer;
  }

  /**
   * Gets the current context
   */
  getContext(): BotContext {
    return this.context;
  }

  /**
   * Gets the current files
   */
  getFiles(): MockFile[] {
    return [...this.files];
  }

  /**
   * Gets the request log from the mock server
   */
  getRequestLog() {
    return this.mockServer.getRequestLog();
  }

  /**
   * Clears the request log
   */
  clearRequestLog(): void {
    this.mockServer.clearRequestLog();
  }

  /**
   * Cleanup - uninstalls mock server
   */
  cleanup(): void {
    if (this.installed) {
      this.mockServer.uninstall();
      this.installed = false;
    }
  }
}

/**
 * Creates a test harness for a bot
 */
export function createTestHarness<T extends CommandBot>(
  bot: T,
  options: TestHarnessOptions = {}
): BotTestHarness<T> {
  return new BotTestHarness(bot, options);
}
