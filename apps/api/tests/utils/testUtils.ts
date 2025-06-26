import { Request, Response } from 'express';
import { jest } from '@jest/globals';

// Define enum constants since mocked imports may not work
const GlobalRole = {
  ADMIN: 'ADMIN',
  EDITOR_IN_CHIEF: 'EDITOR_IN_CHIEF', 
  MANAGING_EDITOR: 'MANAGING_EDITOR',
  USER: 'USER',
  BOT: 'BOT'
} as const;

const ConversationType = {
  EDITORIAL: 'EDITORIAL',
  REVIEW: 'REVIEW', 
  SEMI_PUBLIC: 'SEMI_PUBLIC',
  PUBLIC: 'PUBLIC',
  AUTHOR_ONLY: 'AUTHOR_ONLY'
} as const;

const ManuscriptStatus = {
  SUBMITTED: 'SUBMITTED',
  UNDER_REVIEW: 'UNDER_REVIEW',
  REVISION_REQUESTED: 'REVISION_REQUESTED',
  REVISED: 'REVISED',
  ACCEPTED: 'ACCEPTED',
  REJECTED: 'REJECTED',
  PUBLISHED: 'PUBLISHED'
} as const;

// Mock Express Request/Response utilities
export const createMockRequest = (overrides: Partial<Request> = {}): Partial<Request> => ({
  body: {},
  query: {},
  params: {},
  headers: {},
  cookies: {},
  user: undefined,
  session: {} as any,
  file: undefined,
  files: undefined,
  ...overrides
});

export const createMockResponse = (): Partial<Response> => {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res) as any;
  res.json = jest.fn().mockReturnValue(res) as any;
  res.send = jest.fn().mockReturnValue(res) as any;
  res.cookie = jest.fn().mockReturnValue(res) as any;
  res.clearCookie = jest.fn().mockReturnValue(res) as any;
  res.redirect = jest.fn().mockReturnValue(res) as any;
  res.setHeader = jest.fn().mockReturnValue(res) as any;
  return res;
};

// Mock authenticated user
export const createMockUser = (overrides = {}) => ({
  id: 'test-user-id',
  email: 'test@example.com',
  name: 'Test User',
  role: GlobalRole.USER,
  orcidId: null,
  createdAt: new Date('2023-01-01T00:00:00.000Z'),
  ...overrides
});

// Mock admin user
export const createMockAdmin = (overrides = {}) => ({
  id: 'admin-user-id',
  email: 'admin@example.com',
  name: 'Admin User',
  role: GlobalRole.ADMIN,
  orcidId: null,
  createdAt: new Date('2023-01-01T00:00:00.000Z'),
  ...overrides
});

// Mock editor user
export const createMockEditor = (overrides = {}) => ({
  id: 'editor-user-id',
  email: 'editor@example.com',
  name: 'Editor User',
  role: GlobalRole.EDITOR_IN_CHIEF,
  orcidId: null,
  createdAt: new Date('2023-01-01T00:00:00.000Z'),
  ...overrides
});

// Mock manuscript
export const createMockManuscript = (overrides = {}) => ({
  id: 'test-manuscript-id',
  title: 'Test Manuscript Title',
  abstract: 'This is a test manuscript abstract.',
  status: ManuscriptStatus.SUBMITTED,
  manuscriptType: 'RESEARCH_ARTICLE' as const,
  submittedAt: new Date('2023-01-01T00:00:00.000Z'),
  authorId: 'test-user-id',
  authors: [{
    id: 'author-rel-id',
    name: 'Test Author',
    email: 'test@example.com',
    affiliation: 'Test University',
    orcidId: null,
    isPrimary: true
  }],
  keywords: ['test', 'manuscript'],
  conflictOfInterest: null,
  funding: null,
  ethicsStatement: null,
  createdAt: new Date('2023-01-01T00:00:00.000Z'),
  updatedAt: new Date('2023-01-01T00:00:00.000Z'),
  ...overrides
});

// Mock conversation
export const createMockConversation = (overrides = {}) => ({
  id: 'test-conversation-id',
  title: 'Test Conversation',
  type: ConversationType.REVIEW,
  status: 'ACTIVE' as const,
  manuscriptId: 'test-manuscript-id',
  createdById: 'test-user-id',
  participants: [{
    id: 'participant-rel-id',
    userId: 'test-user-id',
    role: GlobalRole.USER,
    joinedAt: new Date('2023-01-01T00:00:00.000Z')
  }],
  createdAt: new Date('2023-01-01T00:00:00.000Z'),
  updatedAt: new Date('2023-01-01T00:00:00.000Z'),
  ...overrides
});

// Mock message
export const createMockMessage = (overrides = {}) => ({
  id: 'test-message-id',
  content: 'This is a test message',
  type: 'TEXT' as const,
  conversationId: 'test-conversation-id',
  authorId: 'test-user-id',
  parentId: null,
  privacy: 'AUTHOR_VISIBLE' as const,
  mentions: [],
  botMentions: [],
  deleted: false,
  deletedAt: null,
  editedAt: null,
  author: createMockUser(),
  createdAt: new Date('2023-01-01T00:00:00.000Z'),
  updatedAt: new Date('2023-01-01T00:00:00.000Z'),
  ...overrides
});

// Mock bot
export const createMockBot = (overrides = {}) => ({
  id: 'test-bot-id',
  name: 'test-bot',
  displayName: 'Test Bot',
  description: 'A test bot for unit testing',
  version: '1.0.0',
  source: 'npm:test-bot',
  config: {},
  enabled: true,
  installedAt: new Date('2023-01-01T00:00:00.000Z'),
  installedById: 'admin-user-id',
  ...overrides
});

// Mock file upload
export const createMockFile = (overrides = {}) => ({
  fieldname: 'file',
  originalname: 'test-document.pdf',
  encoding: '7bit',
  mimetype: 'application/pdf',
  size: 1024 * 1024, // 1MB
  destination: '/tmp/uploads',
  filename: 'test-document-123.pdf',
  path: '/tmp/uploads/test-document-123.pdf',
  buffer: Buffer.from('test file content'),
  ...overrides
});

// JWT token utilities
export const createMockJWT = (payload = {}) => {
  const defaultPayload = {
    userId: 'test-user-id',
    email: 'test@example.com',
    role: GlobalRole.USER,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (60 * 60) // 1 hour
  };
  
  // In a real test, you'd use the actual JWT library
  // For mocking, we'll just return a base64 encoded JSON
  const tokenPayload = { ...defaultPayload, ...payload };
  return `mock.${Buffer.from(JSON.stringify(tokenPayload)).toString('base64')}.signature`;
};

// Database transaction mock
export const createMockTransaction = () => ({
  user: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn()
  },
  manuscript: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn()
  },
  conversation: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn()
  },
  message: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn()
  },
  bot: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn()
  },
  $transaction: jest.fn()
});

// Test data generators
export const generateTestUsers = (count: number) => {
  return Array.from({ length: count }, (_, index) => 
    createMockUser({
      id: `user-${index + 1}`,
      email: `user${index + 1}@example.com`,
      name: `User ${index + 1}`
    })
  );
};

export const generateTestManuscripts = (count: number, authorId = 'test-user-id') => {
  return Array.from({ length: count }, (_, index) => 
    createMockManuscript({
      id: `manuscript-${index + 1}`,
      title: `Test Manuscript ${index + 1}`,
      authorId
    })
  );
};

export const generateTestMessages = (count: number, conversationId = 'test-conversation-id') => {
  return Array.from({ length: count }, (_, index) => 
    createMockMessage({
      id: `message-${index + 1}`,
      content: `Test message ${index + 1}`,
      conversationId,
      createdAt: new Date(Date.now() + index * 1000) // Spread messages over time
    })
  );
};

// Validation test helpers
export const expectValidationError = (result: any, field: string, message?: string) => {
  expect(result.success).toBe(false);
  expect(result.error.issues).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        path: expect.arrayContaining([field]),
        ...(message && { message })
      })
    ])
  );
};

export const expectValidationSuccess = (result: any, expectedData?: any) => {
  expect(result.success).toBe(true);
  if (expectedData) {
    expect(result.data).toEqual(expectedData);
  }
};

// Async test helpers
export const waitFor = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const expectAsyncThrow = async (asyncFn: () => Promise<any>, expectedError?: string | RegExp) => {
  let error: any;
  try {
    await asyncFn();
  } catch (e) {
    error = e;
  }
  
  expect(error).toBeDefined();
  if (expectedError) {
    if (typeof expectedError === 'string') {
      expect(error.message).toContain(expectedError);
    } else {
      expect(error.message).toMatch(expectedError);
    }
  }
};

// Test environment helpers
export const setupTestEnvironment = () => {
  // Mock console methods to reduce test noise
  const originalConsole = { ...console };
  
  beforeEach(() => {
    console.log = jest.fn();
    console.info = jest.fn();
    console.warn = jest.fn();
    console.error = jest.fn();
  });
  
  afterEach(() => {
    Object.assign(console, originalConsole);
  });
};

// Mock external service responses
export const mockEmailService = () => ({
  sendMail: jest.fn().mockImplementation(() => Promise.resolve({
    messageId: 'test-message-id',
    accepted: ['test@example.com'],
    rejected: []
  }))
});

export const mockFileStorage = () => ({
  upload: jest.fn().mockImplementation(() => Promise.resolve({
    url: 'https://storage.example.com/test-file.pdf',
    key: 'test-file-key'
  })),
  delete: jest.fn().mockImplementation(() => Promise.resolve(true)),
  getSignedUrl: jest.fn().mockReturnValue('https://storage.example.com/signed-url')
});

export const mockBotExecutor = () => ({
  executeBot: jest.fn().mockImplementation(() => Promise.resolve({
    success: true,
    result: 'Bot execution successful',
    metadata: {}
  })),
  getBotStatus: jest.fn().mockReturnValue('active'),
  listAvailableBots: jest.fn().mockReturnValue(['test-bot', 'another-bot'])
});

// Integration test helpers (require actual database connection)
let testDbConnection: any = null;

export const createTestUser = async (email: string, role: string = 'USER') => {
  // This would use the actual prisma client in integration tests
  if (!testDbConnection) {
    throw new Error('Test database connection not initialized');
  }
  
  return await testDbConnection.user.create({
    data: {
      email,
      name: email.split('@')[0],
      role
    }
  });
};

export const createTestBot = async (id: string, name: string, version: string) => {
  if (!testDbConnection) {
    throw new Error('Test database connection not initialized');
  }
  
  return await testDbConnection.botDefinition.create({
    data: {
      id,
      name,
      description: `${name} bot for testing`,
      version,
      author: 'Test Author',
      isPublic: true,
      configSchema: {}
    }
  });
};

export const getAuthCookie = async (userId: string): Promise<string> => {
  // In real implementation, this would generate a valid JWT token
  // and return it as a cookie string
  const token = createMockJWT({ userId });
  return `authToken=${token}; Path=/; HttpOnly`;
};

export const cleanupTestData = async () => {
  if (!testDbConnection) return;
  
  // Clean up test data in dependency order
  await testDbConnection.botConfigFile.deleteMany({});
  await testDbConnection.botInstall.deleteMany({});
  await testDbConnection.botDefinition.deleteMany({});
  await testDbConnection.user.deleteMany({
    where: {
      email: {
        contains: '@test.com'
      }
    }
  });
};

export const setTestDbConnection = (connection: any) => {
  testDbConnection = connection;
};