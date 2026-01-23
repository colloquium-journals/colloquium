"use strict";
/**
 * Mock context factory for bot testing
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMockContext = createMockContext;
exports.createContextForManuscript = createContextForManuscript;
const types_1 = require("@colloquium/types");
/**
 * Creates a mock BotContext for testing bot commands
 */
function createMockContext(options = {}) {
    return {
        manuscriptId: options.manuscriptId ?? 'test-manuscript-id',
        conversationId: options.conversationId ?? 'test-conversation-id',
        triggeredBy: {
            messageId: options.messageId ?? 'test-message-id',
            userId: options.userId ?? 'test-user-id',
            userRole: options.userRole ?? 'ADMIN',
            trigger: options.trigger ?? types_1.BotTrigger.MENTION
        },
        journal: {
            id: options.journalId ?? 'test-journal',
            settings: options.journalSettings ?? {}
        },
        config: options.config ?? {},
        serviceToken: options.serviceToken ?? 'test-service-token'
    };
}
/**
 * Creates a context with specific manuscript ID for testing
 */
function createContextForManuscript(manuscriptId, overrides = {}) {
    return createMockContext({
        ...overrides,
        manuscriptId
    });
}
