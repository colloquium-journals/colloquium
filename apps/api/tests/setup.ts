import { beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { GlobalRole, ManuscriptStatus } from '@colloquium/database';

// Global test timeout
jest.setTimeout(30000);

// Mock environment variables for testing
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/colloquium_test';

// Mock external services
beforeAll(async () => {
  // Setup test database connections, etc.
  console.log('🧪 Setting up API test environment');
});

afterAll(async () => {
  // Cleanup test database connections, etc.
  console.log('🧹 Cleaning up API test environment');
});

beforeEach(() => {
  // Reset mocks before each test
  jest.clearAllMocks();
});

afterEach(() => {
  // Additional cleanup after each test
});

// Global test utilities
global.testUtils = {
  // Helper functions that can be used across tests
  createMockUser: () => ({
    id: 'test-user-id',
    email: 'test@example.com',
    name: 'Test User',
    role: GlobalRole.USER,
    orcidId: null,
    createdAt: new Date()
  }),
  
  createMockManuscript: () => ({
    id: 'test-manuscript-id',
    title: 'Test Manuscript',
    status: ManuscriptStatus.SUBMITTED,
    submittedAt: new Date(),
    authorId: 'test-user-id'
  })
};

// Extend global namespace for TypeScript
declare global {
  var testUtils: {
    createMockUser: () => any;
    createMockManuscript: () => any;
  };
}