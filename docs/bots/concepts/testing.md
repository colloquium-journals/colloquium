# Testing Bots

The `@colloquium/bots/testing` package provides test harnesses, mock servers, assertion helpers, and utilities for unit and integration testing.

## Unit testing with the test harness

The test harness is the primary tool for testing bot commands. It mocks the API server and provides a clean interface for executing commands:

```typescript
import { createTestHarness, createMockFile, assertBotResponse } from '@colloquium/bots/testing';
import { MyBot } from '../src';

describe('MyBot', () => {
  const harness = createTestHarness(MyBot);

  afterAll(() => harness.cleanup());

  it('runs the analyze command', async () => {
    harness.withFiles([
      createMockFile({ originalName: 'paper.md', fileType: 'SOURCE', content: 'Hello world.' }),
    ]);

    const result = await harness.executeCommand('analyze');

    assertBotResponse(result, {
      messageContains: 'analysis',
      messageCount: 1,
    });
  });
});
```

### Harness methods

| Method | Description |
|--------|-------------|
| `executeCommand(name, params)` | Execute a bot command with mock context |
| `withFiles(files)` | Set available files |
| `addFile(file)` | Add a single file |
| `withContext(overrides)` | Override context fields |
| `withConfig(config)` | Set bot configuration |
| `withManuscript(data)` | Set manuscript metadata |
| `getRequestLog()` | Get all HTTP requests made |
| `clearRequestLog()` | Clear the request log |
| `cleanup()` | Tear down mock server |

## Mock API server

The harness uses `MockApiServer` internally, but you can use it directly for more control:

```typescript
import { MockApiServer } from '@colloquium/bots/testing';

const server = MockApiServer.withManuscriptAndFiles(
  { title: 'Test Paper', status: 'SUBMITTED' },
  [createMockFile({ originalName: 'paper.md', fileType: 'SOURCE' })]
);

server.install();  // Intercepts HTTP calls
// ... run tests ...
server.uninstall();
```

## Assertion helpers

### Basic assertions

```typescript
import {
  assertBotResponse,
  assertBotAction,
  assertBotError,
  assertBotMessageNotContains,
} from '@colloquium/bots/testing';

// Check message content and structure
assertBotResponse(result, {
  messageContains: ['word count', 'summary'],
  messageCount: 1,
  hasAttachments: false,
});

// Check bot actions
assertBotAction(result, {
  type: 'UPDATE_MANUSCRIPT_STATUS',
  data: { status: 'ACCEPTED' },
});

// Check error responses
assertBotError(result, { hasErrors: true, errorContains: 'not found' });

// Negative assertions
assertBotMessageNotContains(result, 'internal error');
```

### Structured data assertions

```typescript
import { assertBotStructuredData, assertBotAnnotations } from '@colloquium/bots/testing';

// Verify structured data on a response message
assertBotStructuredData(result, {
  type: 'word-count',
  dataContains: { words: 150 },
});

// Verify annotations
assertBotAnnotations(result, {
  type: 'warning',
  count: 2,
  messageContains: 'missing DOI',
});
```

### Custom Jest matchers

Register custom matchers for more natural assertion syntax:

```typescript
import { extendJestWithBotMatchers } from '@colloquium/bots/testing';

// In your test setup file or beforeAll:
extendJestWithBotMatchers();

// Then in tests:
expect(result).toContainBotMessage('analysis complete');
expect(result).toHaveBotAction('UPDATE_MANUSCRIPT_STATUS');
expect(result).toHaveBotStructuredData('word-count');
expect(result).toHaveBotAnnotations('warning');
```

## Snapshot testing

Snapshot testing verifies that bot responses don't change unexpectedly. The snapshot utilities normalize UUIDs and timestamps so snapshots stay stable:

```typescript
import { assertBotResponseSnapshot, createBotResponseSerializer } from '@colloquium/bots/testing';

// Option 1: Direct assertion
it('matches snapshot', async () => {
  const result = await harness.executeCommand('analyze');
  assertBotResponseSnapshot(result);
});

// Option 2: Custom serializer (register once in setup)
expect.addSnapshotSerializer(createBotResponseSerializer());
```

## Mock SDK client

For testing code that uses `@colloquium/bot-sdk` directly (not through the test harness), use the mock client:

```typescript
import { createMockSdkClient } from '@colloquium/bots/testing';

it('uses the SDK client', async () => {
  const client = createMockSdkClient({
    manuscripts: {
      get: jest.fn().mockResolvedValue({ title: 'Test', status: 'SUBMITTED' }),
    },
    files: {
      list: jest.fn().mockResolvedValue([
        { id: 'f1', originalName: 'paper.md', fileType: 'SOURCE' },
      ]),
    },
  });

  // Pass client to your function under test
  const result = await myFunction(client);

  // Verify SDK calls
  expect(client.manuscripts.get).toHaveBeenCalled();
  expect(client.files.list).toHaveBeenCalledWith({ fileType: 'SOURCE' });
});
```

Every method on the mock client is a `jest.fn()` with sensible defaults.

## Event testing

Test event handlers with the `EventTestHarness`:

```typescript
import { createEventTestHarness } from '@colloquium/bots/testing';

const harness = createEventTestHarness(MyBot);

it('handles file upload events', async () => {
  const result = await harness.fireEvent('file.uploaded', {
    file: { id: 'f1', name: 'paper.md', type: 'SOURCE', mimetype: 'text/markdown' },
  });

  expect(result?.messages?.[0].content).toContain('paper.md');
});

it('tracks event history', async () => {
  harness.clearEventLog();

  await harness.fireEvent('manuscript.submitted', { manuscriptId: 'ms-1' });
  await harness.fireEvent('file.uploaded', {
    file: { id: 'f1', name: 'paper.md', type: 'SOURCE', mimetype: 'text/markdown' },
  });

  expect(harness.getEventLog()).toHaveLength(2);
});
```

## Integration testing

For end-to-end tests against a running API:

```typescript
import { createIntegrationEnv } from '@colloquium/bots/testing';

describe('integration', () => {
  let env;

  beforeAll(async () => {
    env = await createIntegrationEnv();
  });

  afterAll(async () => {
    await env.teardown();
  });

  it('executes a bot command via the API', async () => {
    const result = await env.executeBot('bot-reference-check', 'check');
    expect(result.errors).toBeUndefined();
  });
});
```

Integration tests require:
- A running API server (`npm run dev`)
- A seeded database with test data
- The `BOT_SERVICE_TOKEN` environment variable (or pass `serviceToken` in options)

## CI/CD patterns

### Run unit tests in CI

```yaml
- run: npm test
```

Unit tests use the mock API server and don't require external services.

### Run integration tests separately

```yaml
- run: npm run docker:up
- run: npm run db:reset-quick
- run: npm run dev &
- run: cd packages/bot-reference-check && npm run test:integration
```

Integration tests need the full stack running.

### Test structure recommendation

```
packages/bot-my-bot/
├── tests/
│   ├── commands.test.ts       # Unit tests for commands
│   ├── events.test.ts         # Unit tests for event handlers
│   └── integration.test.ts    # Integration tests (optional)
```

## Related

- [Your First Bot Tutorial](../tutorials/your-first-bot.md) — Includes test examples
- [Event-Driven Bots Tutorial](../tutorials/event-driven-bots.md) — Event testing examples
- [SDK Reference](../reference/sdk.md) — API client documentation
