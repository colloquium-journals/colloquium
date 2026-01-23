/**
 * Bot Testing Framework
 *
 * Standardized testing utilities for all Colloquium bots.
 * Enables unit testing with mocked dependencies and integration testing
 * against real seed data.
 *
 * @example
 * ```typescript
 * import { createTestHarness, createMockFile } from '@colloquium/bots/testing';
 * import { myBot } from './myBot';
 *
 * describe('MyBot', () => {
 *   let harness: BotTestHarness<typeof myBot>;
 *
 *   beforeEach(() => {
 *     harness = createTestHarness(myBot);
 *   });
 *
 *   afterEach(() => {
 *     harness.cleanup();
 *   });
 *
 *   it('should execute my command', async () => {
 *     const result = await harness.executeCommand('myCommand', { param: 'value' });
 *     expect(result.messages[0].content).toContain('Success');
 *   });
 * });
 * ```
 */

// Context utilities
export {
  createMockContext,
  createContextForManuscript,
  type MockContextOptions
} from './mockContext';

// File mocking utilities
export {
  createMockFile,
  createMockManuscriptFiles,
  mockMarkdownFile,
  mockBibliographyFile,
  mockImageFile,
  type MockFile,
  type MockFileType
} from './mockFiles';

// Mock API server
export {
  MockApiServer,
  type MockRequest,
  type MockResponse,
  type MockEndpoint,
  type MockManuscriptData
} from './mockApiServer';

// Test harness
export {
  BotTestHarness,
  createTestHarness,
  type TestHarnessOptions
} from './testHarness';

// Assertion helpers
export {
  assertBotResponse,
  assertBotAction,
  assertBotError,
  assertBotMessageNotContains,
  botMatchers,
  extendJestWithBotMatchers
} from './assertions';

// Seed data testing
export {
  SeedDataTestRunner,
  createSeedDataRunner,
  describeSeedDataTests,
  type SeedPaperInfo,
  type SeedDataRunnerOptions
} from './seedDataRunner';
