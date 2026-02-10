import { beforeAll, afterAll, beforeEach } from '@jest/globals';

// Set test environment
process.env.NODE_ENV = 'test';

beforeAll(() => {
  console.log('📝 Setting up Types test environment');
});

afterAll(() => {
  console.log('🧹 Cleaning up Types test environment');
});

beforeEach(() => {
  jest.clearAllMocks();
});

// Global test utilities for type testing
global.testUtils = {
  // Mock data that conforms to our types
  createMockUserData: () => ({
    id: 'test-user-id',
    email: 'test@example.com',
    name: 'Test User',
    role: 'AUTHOR' as const,
    orcidId: null,
    createdAt: new Date()
  }),
  
  createMockManuscriptData: () => ({
    id: 'test-manuscript-id',
    title: 'Test Manuscript',
    abstract: 'Test abstract',
    status: 'SUBMITTED' as const,
    submittedAt: new Date(),
    authorId: 'test-user-id'
  }),
  
  createMockConversationData: () => ({
    id: 'test-conversation-id',
    type: 'PRIVATE_EDITORIAL' as const,
    manuscriptId: 'test-manuscript-id',
    participants: ['test-user-id'],
    privacy: 'AUTHOR_VISIBLE' as const
  })
};

// Extend global namespace for TypeScript
declare global {
  var testUtils: {
    createMockUserData: () => any;
    createMockManuscriptData: () => any;
    createMockConversationData: () => any;
  };
}