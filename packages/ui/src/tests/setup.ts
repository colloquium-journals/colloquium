import '@testing-library/jest-dom';
import { beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';

// Set test environment
process.env.NODE_ENV = 'test';

// Mock Mantine's ColorSchemeScript (often causes issues in tests)
jest.mock('@mantine/core', () => ({
  ...jest.requireActual('@mantine/core'),
  ColorSchemeScript: () => null,
}));

beforeAll(() => {
  console.log('🎨 Setting up UI test environment');
});

afterAll(() => {
  console.log('🧹 Cleaning up UI test environment');
});

beforeEach(() => {
  jest.clearAllMocks();
});

// Global test utilities for UI component testing
global.testUtils = {
  // Mock component props
  createMockUser: () => ({
    id: 'test-user-id',
    name: 'Test User',
    email: 'test@example.com',
    role: 'AUTHOR' as const,
    orcidId: null
  }),
  
  createMockManuscript: () => ({
    id: 'test-manuscript-id',
    title: 'Test Manuscript',
    status: 'SUBMITTED' as const,
    submittedAt: new Date().toISOString(),
    authorName: 'Test Author'
  }),
  
  createMockMessage: () => ({
    id: 'test-message-id',
    content: 'Test message content',
    authorName: 'Test User',
    createdAt: new Date().toISOString(),
    isBot: false,
    privacy: 'AUTHOR_VISIBLE' as const
  })
};

// Extend global namespace for TypeScript
declare global {
  var testUtils: {
    createMockUser: () => any;
    createMockManuscript: () => any;
    createMockMessage: () => any;
  };
}