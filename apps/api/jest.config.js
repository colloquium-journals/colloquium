/** @type {import('jest').Config} */
module.exports = {
  displayName: 'API',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: [
    '**/__tests__/**/*.ts',
    '**/?(*.)+(spec|test).ts'
  ],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: 'tsconfig.json',
      diagnostics: false
    }]
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/index.ts'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  testTimeout: 10000,
  clearMocks: true,
  restoreMocks: true,
  passWithNoTests: true,
  moduleNameMapper: {
    '^@colloquium/auth$': '<rootDir>/../../packages/auth/dist',
    '^@colloquium/database$': '<rootDir>/../../packages/database/dist/database/src',
    '^@colloquium/bots/src/(.*)$': '<rootDir>/../../packages/bots/dist/$1',
    '^@colloquium/bots$': '<rootDir>/../../packages/bots/dist',
    '^@colloquium/(.*)$': '<rootDir>/../../packages/$1/src'
  },
  transformIgnorePatterns: [
    'node_modules/(?!(@colloquium)/)'
  ]
};