/**
 * Bot Test Harness - High-level wrapper for testing bot commands
 */
import { CommandBot, BotContext, BotResponse } from '@colloquium/types';
import { MockContextOptions } from './mockContext';
import { MockApiServer, MockManuscriptData } from './mockApiServer';
import { MockFile } from './mockFiles';
export interface TestHarnessOptions {
    context?: MockContextOptions;
    files?: MockFile[];
    manuscriptData?: MockManuscriptData;
    autoInstall?: boolean;
}
/**
 * High-level test harness for bot command testing
 */
export declare class BotTestHarness<T extends CommandBot> {
    private bot;
    private context;
    private mockServer;
    private installed;
    private files;
    constructor(bot: T, options?: TestHarnessOptions);
    /**
     * Sets up global mocks needed for testing
     */
    private setupGlobals;
    /**
     * Configures the test context
     */
    withContext(overrides: MockContextOptions): this;
    /**
     * Extracts current context options
     */
    private extractContextOptions;
    /**
     * Sets files available through the mock server
     */
    withFiles(files: MockFile[]): this;
    /**
     * Adds a single file to the mock server
     */
    addFile(file: Partial<MockFile> & {
        filename?: string;
        originalName?: string;
    }): this;
    /**
     * Sets manuscript data for the mock server
     */
    withManuscript(data: MockManuscriptData): this;
    /**
     * Sets bot configuration
     */
    withConfig(config: Record<string, any>): this;
    /**
     * Sets journal settings
     */
    withJournalSettings(settings: Record<string, any>): this;
    /**
     * Installs the mock server
     */
    install(): this;
    /**
     * Executes a bot command
     */
    executeCommand(commandName: string, params?: Record<string, any>): Promise<BotResponse>;
    /**
     * Gets the underlying mock server for custom setup
     */
    getMockServer(): MockApiServer;
    /**
     * Gets the current context
     */
    getContext(): BotContext;
    /**
     * Gets the current files
     */
    getFiles(): MockFile[];
    /**
     * Gets the request log from the mock server
     */
    getRequestLog(): import("./mockApiServer").MockRequest[];
    /**
     * Clears the request log
     */
    clearRequestLog(): void;
    /**
     * Cleanup - uninstalls mock server
     */
    cleanup(): void;
}
/**
 * Creates a test harness for a bot
 */
export declare function createTestHarness<T extends CommandBot>(bot: T, options?: TestHarnessOptions): BotTestHarness<T>;
//# sourceMappingURL=testHarness.d.ts.map