/** @type {import('jest').Config} */
module.exports = {
  projects: [
    '<rootDir>/apps/api',
    '<rootDir>/apps/web',
    '<rootDir>/packages/auth',
    '<rootDir>/packages/bot-editorial',
    '<rootDir>/packages/bot-markdown-renderer',
    '<rootDir>/packages/bot-reference-check',
    '<rootDir>/packages/bot-reviewer-checklist',
    '<rootDir>/packages/bots',
    '<rootDir>/packages/create-colloquium-bot',
    '<rootDir>/packages/create-colloquium-journal',
    '<rootDir>/packages/database',
    '<rootDir>/packages/types',
    '<rootDir>/packages/ui'
  ],
  collectCoverageFrom: [
    'apps/**/*.{ts,tsx}',
    'packages/**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/dist/**',
    '!**/coverage/**'
  ],
  coverageDirectory: '<rootDir>/coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThresholds: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  }
};