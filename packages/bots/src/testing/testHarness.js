"use strict";
/**
 * Bot Test Harness - High-level wrapper for testing bot commands
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.BotTestHarness = void 0;
exports.createTestHarness = createTestHarness;
const mockContext_1 = require("./mockContext");
const mockApiServer_1 = require("./mockApiServer");
const mockFiles_1 = require("./mockFiles");
/**
 * High-level test harness for bot command testing
 */
class BotTestHarness {
    constructor(bot, options = {}) {
        this.installed = false;
        this.files = [];
        this.bot = bot;
        this.files = options.files ?? [];
        this.context = (0, mockContext_1.createMockContext)(options.context);
        this.mockServer = mockApiServer_1.MockApiServer.withManuscriptAndFiles(options.manuscriptData ?? {}, this.files);
        // Mock common browser/node globals for testing
        this.setupGlobals();
        if (options.autoInstall !== false) {
            this.install();
        }
    }
    /**
     * Sets up global mocks needed for testing
     */
    setupGlobals() {
        // Mock FormData if not available
        if (typeof global.FormData === 'undefined') {
            global.FormData = class MockFormData {
                constructor() {
                    this.data = new Map();
                }
                append(key, value) { this.data.set(key, value); }
                get(key) { return this.data.get(key); }
                has(key) { return this.data.has(key); }
                delete(key) { this.data.delete(key); }
                entries() { return this.data.entries(); }
            };
        }
        // Mock Blob if not available
        if (typeof global.Blob === 'undefined') {
            global.Blob = class MockBlob {
                constructor(content = [], options = {}) {
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
    withContext(overrides) {
        this.context = (0, mockContext_1.createMockContext)({
            ...this.extractContextOptions(),
            ...overrides
        });
        return this;
    }
    /**
     * Extracts current context options
     */
    extractContextOptions() {
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
    withFiles(files) {
        this.files = files;
        this.mockServer.setFiles(files);
        return this;
    }
    /**
     * Adds a single file to the mock server
     */
    addFile(file) {
        const mockFile = (0, mockFiles_1.createMockFile)(file);
        this.files.push(mockFile);
        this.mockServer.setFiles(this.files);
        return this;
    }
    /**
     * Sets manuscript data for the mock server
     */
    withManuscript(data) {
        this.mockServer.setManuscriptData(data);
        return this;
    }
    /**
     * Sets bot configuration
     */
    withConfig(config) {
        this.context = {
            ...this.context,
            config: { ...this.context.config, ...config }
        };
        return this;
    }
    /**
     * Sets journal settings
     */
    withJournalSettings(settings) {
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
    install() {
        if (!this.installed) {
            this.mockServer.install();
            this.installed = true;
        }
        return this;
    }
    /**
     * Executes a bot command
     */
    async executeCommand(commandName, params = {}) {
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
    getMockServer() {
        return this.mockServer;
    }
    /**
     * Gets the current context
     */
    getContext() {
        return this.context;
    }
    /**
     * Gets the current files
     */
    getFiles() {
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
    clearRequestLog() {
        this.mockServer.clearRequestLog();
    }
    /**
     * Cleanup - uninstalls mock server
     */
    cleanup() {
        if (this.installed) {
            this.mockServer.uninstall();
            this.installed = false;
        }
    }
}
exports.BotTestHarness = BotTestHarness;
/**
 * Creates a test harness for a bot
 */
function createTestHarness(bot, options = {}) {
    return new BotTestHarness(bot, options);
}
