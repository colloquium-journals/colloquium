module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/?(*.)+(spec|test).ts'
  ],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: 'tsconfig.json'
    }],
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/tests/**',
  ],
  setupFilesAfterEnv: ['<rootDir>/src/tests/setup.ts'],
  moduleNameMapper: {
    '^@colloquium/types$': '<rootDir>/../types/src/index.ts',
    '^@colloquium/bot-sdk$': '<rootDir>/../bot-sdk/src/index.ts',
    '^@colloquium/(.*)$': '<rootDir>/../$1/src'
  },
  transformIgnorePatterns: [
    'node_modules/(?!(@colloquium)/)'
  ]
};