/**
 * Jest test setup for reviewer-checklist-bot package
 */

// Setup test environment
process.env.NODE_ENV = 'test';

// Mock console methods that might be noisy in tests
global.console = {
  ...console,
  // Uncomment the next line if you want to silence console.log during tests
  // log: jest.fn(),
};

// Global test utilities can be added here