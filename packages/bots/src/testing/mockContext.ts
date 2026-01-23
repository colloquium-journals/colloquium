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
export function createMockContext(options: MockContextOptions = {}): BotContext {
  return {
    manuscriptId: options.manuscriptId ?? 'test-manuscript-id',
    conversationId: options.conversationId ?? 'test-conversation-id',
    triggeredBy: {
      messageId: options.messageId ?? 'test-message-id',
      userId: options.userId ?? 'test-user-id',
      userRole: options.userRole ?? 'ADMIN',
      trigger: options.trigger ?? BotTrigger.MENTION
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
export function createContextForManuscript(manuscriptId: string, overrides: MockContextOptions = {}): BotContext {
  return createMockContext({
    ...overrides,
    manuscriptId
  });
}
