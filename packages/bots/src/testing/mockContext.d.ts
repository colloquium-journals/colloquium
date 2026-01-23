/**
 * Mock context factory for bot testing
 */
import { BotContext, BotTrigger } from '@colloquium/types';
export interface MockContextOptions {
    manuscriptId?: string;
    conversationId?: string;
    userId?: string;
    userRole?: string;
    messageId?: string;
    trigger?: BotTrigger;
    journalId?: string;
    journalSettings?: Record<string, any>;
    config?: Record<string, any>;
    serviceToken?: string;
}
/**
 * Creates a mock BotContext for testing bot commands
 */
export declare function createMockContext(options?: MockContextOptions): BotContext;
/**
 * Creates a context with specific manuscript ID for testing
 */
export declare function createContextForManuscript(manuscriptId: string, overrides?: MockContextOptions): BotContext;
//# sourceMappingURL=mockContext.d.ts.map