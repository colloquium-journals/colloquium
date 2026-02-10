import { beforeAll, afterAll, beforeEach } from '@jest/globals';

// Set test environment
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/colloquium_test';

// Mock Prisma client for testing
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    user: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    manuscript: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    conversation: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    message: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    $connect: jest.fn(),
    $disconnect: jest.fn(),
    $transaction: jest.fn(),
  }))
}));

beforeAll(() => {
  console.log('🗄️ Setting up Database test environment');
});

afterAll(() => {
  console.log('🧹 Cleaning up Database test environment');
});

beforeEach(() => {
  jest.clearAllMocks();
});

// Global test utilities for database testing
global.testUtils = {
  // Mock database records
  createMockUser: () => ({
    id: 'test-user-id',
    email: 'test@example.com',
    name: 'Test User',
    role: 'AUTHOR',
    orcidId: null,
    createdAt: new Date(),
    updatedAt: new Date()
  }),
  
  createMockManuscript: () => ({
    id: 'test-manuscript-id',
    title: 'Test Manuscript',
    abstract: 'Test abstract',
    status: 'SUBMITTED',
    submittedAt: new Date(),
    authorId: 'test-user-id',
    createdAt: new Date(),
    updatedAt: new Date()
  }),
  
  createMockConversation: () => ({
    id: 'test-conversation-id',
    type: 'PRIVATE_EDITORIAL',
    manuscriptId: 'test-manuscript-id',
    createdAt: new Date(),
    updatedAt: new Date()
  })
};

// Extend global namespace for TypeScript
declare global {
  var testUtils: {
    createMockUser: () => any;
    createMockManuscript: () => any;
    createMockConversation: () => any;
  };
}