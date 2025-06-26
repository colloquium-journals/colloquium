import '@testing-library/jest-dom';
import { beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';

// Mock Next.js router
jest.mock('next/router', () => ({
  useRouter: () => ({
    route: '/',
    pathname: '/',
    query: {},
    asPath: '/',
    push: jest.fn(),
    replace: jest.fn(),
    reload: jest.fn(),
    back: jest.fn(),
    prefetch: jest.fn(),
    beforePopState: jest.fn(),
    events: {
      on: jest.fn(),
      off: jest.fn(),
      emit: jest.fn(),
    },
  }),
}));

// Mock Next.js navigation (App Router)
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    refresh: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

// Mock environment variables  
// process.env.NODE_ENV = 'test'; // Read-only in build mode
process.env.NEXT_PUBLIC_API_URL = 'http://localhost:4000';

beforeAll(() => {
  console.log('🧪 Setting up Web test environment');
  
  // Mock ResizeObserver for Mantine components
  global.ResizeObserver = jest.fn().mockImplementation(() => ({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn(),
  }));
  
  // Mock IntersectionObserver for Mantine components
  global.IntersectionObserver = jest.fn().mockImplementation(() => ({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn(),
  }));
  
  // Mock scrollIntoView for Mantine Select component
  Element.prototype.scrollIntoView = jest.fn();
});

afterAll(() => {
  console.log('🧹 Cleaning up Web test environment');
});

beforeEach(() => {
  jest.clearAllMocks();
});

// Global test utilities for React components
global.testUtils = {
  // Mock user context
  createMockAuthUser: () => ({
    id: 'test-user-id',
    email: 'test@example.com',
    name: 'Test User',
    role: 'AUTHOR' as const,
    orcidId: null,
  }),
  
  // Mock API responses
  mockApiResponse: (data: any) => Promise.resolve({ ok: true, json: () => Promise.resolve(data) }),
  mockApiError: (error: string) => Promise.reject(new Error(error)),
};

// Extend global namespace for TypeScript
declare global {
  var testUtils: {
    createMockAuthUser: () => any;
    mockApiResponse: (data: any) => Promise<any>;
    mockApiError: (error: string) => Promise<never>;
  };
}