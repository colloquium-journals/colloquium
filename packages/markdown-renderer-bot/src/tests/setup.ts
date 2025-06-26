// Test setup for markdown-renderer-bot
import 'jest';

// Mock console methods to avoid noise in tests
console.log = jest.fn();
console.warn = jest.fn();
console.error = jest.fn();

// Mock fetch
global.fetch = jest.fn();