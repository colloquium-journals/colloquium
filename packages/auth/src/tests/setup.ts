import { beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';

// Set test environment
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-for-auth-package-testing-only';

beforeAll(() => {
  console.log('🔐 Setting up Auth test environment');
});

afterAll(() => {
  console.log('🧹 Cleaning up Auth test environment');
});

beforeEach(() => {
  jest.clearAllMocks();
});

// Global test utilities for auth testing
global.testUtils = {
  // Mock user data
  createMockUser: () => ({
    id: 'test-user-id',
    email: 'test@example.com',
    name: 'Test User',
    role: 'AUTHOR' as const,
    orcidId: null,
    createdAt: new Date()
  }),
  
  // Mock JWT payload
  createMockJwtPayload: () => ({
    userId: 'test-user-id',
    email: 'test@example.com',
    role: 'AUTHOR' as const,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600
  }),
  
  // Mock magic link token
  createMockMagicLinkToken: () => ({
    token: 'test-magic-link-token',
    email: 'test@example.com',
    expiresAt: new Date(Date.now() + 3600000) // 1 hour from now
  })
};

// Extend global namespace for TypeScript
declare global {
  var testUtils: {
    createMockUser: () => any;
    createMockJwtPayload: () => any;
    createMockMagicLinkToken: () => any;
  };
}