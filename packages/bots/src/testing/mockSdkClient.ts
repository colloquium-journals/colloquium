/**
 * Mock SDK client for testing bot logic that uses @colloquium/bot-sdk.
 *
 * Returns a fully mocked BotClient where every method is a jest.fn()
 * with sensible defaults. Supports per-method overrides.
 */

import type { BotClient } from '@colloquium/bot-sdk';

type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends (...args: any[]) => any
    ? T[P] | jest.Mock
    : T[P] extends object
      ? DeepPartial<T[P]>
      : T[P];
};

export type MockBotClient = {
  [K in keyof BotClient]: K extends 'apiUrl'
    ? string
    : {
        [M in keyof BotClient[K]]: jest.Mock;
      };
};

/**
 * Creates a fully mocked BotClient where every sub-client method is a jest.fn().
 *
 * @example
 * ```ts
 * const client = createMockSdkClient({
 *   manuscripts: { get: jest.fn().mockResolvedValue({ title: 'Test' }) }
 * });
 * ```
 */
export function createMockSdkClient(overrides?: DeepPartial<BotClient>): MockBotClient {
  const defaultManuscript = {
    id: 'test-manuscript-id',
    title: 'Test Manuscript',
    abstract: 'Test abstract',
    status: 'SUBMITTED',
    authors: [],
    keywords: [],
    workflowPhase: null,
    workflowRound: 1,
  };

  const client: MockBotClient = {
    apiUrl: (overrides?.apiUrl as string) ?? 'http://localhost:4000',

    manuscripts: {
      get: jest.fn().mockResolvedValue(defaultManuscript),
      getWorkflow: jest.fn().mockResolvedValue({
        phase: null,
        round: 1,
        status: 'SUBMITTED',
        releasedAt: null,
        reviewAssignments: [],
        actionEditor: null,
      }),
      updateMetadata: jest.fn().mockResolvedValue(defaultManuscript),
      ...overrides?.manuscripts,
    } as MockBotClient['manuscripts'],

    files: {
      list: jest.fn().mockResolvedValue([]),
      download: jest.fn().mockResolvedValue(''),
      downloadByUrl: jest.fn().mockResolvedValue(''),
      upload: jest.fn().mockResolvedValue({
        id: 'test-file-id',
        filename: 'output.html',
        downloadUrl: '/api/articles/test/files/test-file-id/download',
        size: 0,
      }),
      ...overrides?.files,
    } as MockBotClient['files'],

    users: {
      get: jest.fn().mockResolvedValue({
        id: 'test-user-id',
        name: 'Test User',
        email: 'test@example.com',
        role: 'USER',
      }),
      search: jest.fn().mockResolvedValue([]),
      ...overrides?.users,
    } as MockBotClient['users'],

    reviewers: {
      list: jest.fn().mockResolvedValue([]),
      assign: jest.fn().mockResolvedValue({ assignment: {} }),
      ...overrides?.reviewers,
    } as MockBotClient['reviewers'],

    storage: {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
      list: jest.fn().mockResolvedValue([]),
      ...overrides?.storage,
    } as MockBotClient['storage'],

    conversations: {
      getMessages: jest.fn().mockResolvedValue({ messages: [], hasMore: false }),
      postMessage: jest.fn().mockResolvedValue({
        id: 'test-message-id',
        content: '',
        privacy: 'PUBLIC',
        author: { id: 'bot-id', name: 'Bot', email: 'bot@system' },
        createdAt: new Date().toISOString(),
        parentId: null,
        isBot: true,
        metadata: null,
      }),
      listConversations: jest.fn().mockResolvedValue([]),
      ...overrides?.conversations,
    } as MockBotClient['conversations'],

    bots: {
      invoke: jest.fn().mockResolvedValue({ messages: [], actions: [], errors: [] }),
      ...overrides?.bots,
    } as MockBotClient['bots'],
  };

  return client;
}
