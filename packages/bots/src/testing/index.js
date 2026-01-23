"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.describeSeedDataTests = exports.createSeedDataRunner = exports.SeedDataTestRunner = exports.extendJestWithBotMatchers = exports.botMatchers = exports.assertBotMessageNotContains = exports.assertBotError = exports.assertBotAction = exports.assertBotResponse = exports.createTestHarness = exports.BotTestHarness = exports.MockApiServer = exports.mockImageFile = exports.mockBibliographyFile = exports.mockMarkdownFile = exports.createMockManuscriptFiles = exports.createMockFile = exports.createContextForManuscript = exports.createMockContext = void 0;
// Context utilities
var mockContext_1 = require("./mockContext");
Object.defineProperty(exports, "createMockContext", { enumerable: true, get: function () { return mockContext_1.createMockContext; } });
Object.defineProperty(exports, "createContextForManuscript", { enumerable: true, get: function () { return mockContext_1.createContextForManuscript; } });
// File mocking utilities
var mockFiles_1 = require("./mockFiles");
Object.defineProperty(exports, "createMockFile", { enumerable: true, get: function () { return mockFiles_1.createMockFile; } });
Object.defineProperty(exports, "createMockManuscriptFiles", { enumerable: true, get: function () { return mockFiles_1.createMockManuscriptFiles; } });
Object.defineProperty(exports, "mockMarkdownFile", { enumerable: true, get: function () { return mockFiles_1.mockMarkdownFile; } });
Object.defineProperty(exports, "mockBibliographyFile", { enumerable: true, get: function () { return mockFiles_1.mockBibliographyFile; } });
Object.defineProperty(exports, "mockImageFile", { enumerable: true, get: function () { return mockFiles_1.mockImageFile; } });
// Mock API server
var mockApiServer_1 = require("./mockApiServer");
Object.defineProperty(exports, "MockApiServer", { enumerable: true, get: function () { return mockApiServer_1.MockApiServer; } });
// Test harness
var testHarness_1 = require("./testHarness");
Object.defineProperty(exports, "BotTestHarness", { enumerable: true, get: function () { return testHarness_1.BotTestHarness; } });
Object.defineProperty(exports, "createTestHarness", { enumerable: true, get: function () { return testHarness_1.createTestHarness; } });
// Assertion helpers
var assertions_1 = require("./assertions");
Object.defineProperty(exports, "assertBotResponse", { enumerable: true, get: function () { return assertions_1.assertBotResponse; } });
Object.defineProperty(exports, "assertBotAction", { enumerable: true, get: function () { return assertions_1.assertBotAction; } });
Object.defineProperty(exports, "assertBotError", { enumerable: true, get: function () { return assertions_1.assertBotError; } });
Object.defineProperty(exports, "assertBotMessageNotContains", { enumerable: true, get: function () { return assertions_1.assertBotMessageNotContains; } });
Object.defineProperty(exports, "botMatchers", { enumerable: true, get: function () { return assertions_1.botMatchers; } });
Object.defineProperty(exports, "extendJestWithBotMatchers", { enumerable: true, get: function () { return assertions_1.extendJestWithBotMatchers; } });
// Seed data testing
var seedDataRunner_1 = require("./seedDataRunner");
Object.defineProperty(exports, "SeedDataTestRunner", { enumerable: true, get: function () { return seedDataRunner_1.SeedDataTestRunner; } });
Object.defineProperty(exports, "createSeedDataRunner", { enumerable: true, get: function () { return seedDataRunner_1.createSeedDataRunner; } });
Object.defineProperty(exports, "describeSeedDataTests", { enumerable: true, get: function () { return seedDataRunner_1.describeSeedDataTests; } });
