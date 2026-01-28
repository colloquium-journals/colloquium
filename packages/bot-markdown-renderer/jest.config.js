module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/src'],
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/?(*.)+(spec|test).ts'
  ],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.test.json' }],
  },
  moduleNameMapper: {
    // Map workspace packages to their source for testing
    '^@colloquium/bots$': '<rootDir>/../bots/src/index.ts',
    '^@colloquium/bots/testing$': '<rootDir>/../bots/src/testing/index.ts',
    '^@colloquium/types$': '<rootDir>/../types/src/index.ts',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/tests/**',
  ],
  setupFilesAfterEnv: ['<rootDir>/src/tests/setup.ts'],
};