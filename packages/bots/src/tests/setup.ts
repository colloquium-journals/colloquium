import { beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';

// Set test environment
process.env.NODE_ENV = 'test';
process.env.BOT_EXECUTION_TIMEOUT = '5000'; // Shorter timeout for tests

beforeAll(() => {
  console.log('🤖 Setting up Bots test environment');
});

afterAll(() => {
  console.log('🧹 Cleaning up Bots test environment');
});

beforeEach(() => {
  jest.clearAllMocks();
});

// Global test utilities for bot testing (legacy support)
// Note: New testing utilities should be imported directly from '@colloquium/bots/testing'
global.testUtils = {
  // Mock bot context
  createMockBotContext: () => ({
    conversationId: 'test-conversation-id',
    manuscriptId: 'test-manuscript-id',
    triggeredBy: {
      messageId: 'test-message-id',
      userId: 'test-user-id',
      userRole: 'ADMIN',
      trigger: 'mention' // BotTrigger.MENTION value
    },
    journal: {
      id: 'test-journal',
      settings: {}
    },
    config: {
      isEnabled: true
    },
    serviceToken: 'test-service-token'
  }),

  // Mock command execution
  createMockParsedCommand: (botId: string, command: string, parameters: Record<string, any> = {}) => ({
    botId,
    command,
    parameters,
    rawText: `@${botId} ${command}`,
    isUnrecognized: false
  }),

  // Mock bot response
  createMockBotResponse: (content: string, actions: any[] = []) => ({
    messages: [{ content }],
    actions
  })
};

// Extend global namespace for TypeScript
declare global {
  var testUtils: {
    createMockBotContext: () => any;
    createMockParsedCommand: (botId: string, command: string, parameters?: Record<string, any>) => any;
    createMockBotResponse: (content: string, actions?: any[]) => any;
  };
}