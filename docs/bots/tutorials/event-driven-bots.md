# Tutorial: Event-Driven Bots

This tutorial shows how to subscribe to manuscript lifecycle events so your bot reacts automatically — without a user typing `@bot-name`.

## What you'll build

A bot that automatically runs when a manuscript is submitted or a file is uploaded, using the `events` property on `CommandBot`.

## Prerequisites

- Completed [Your First Bot](your-first-bot.md)
- Understanding of the [Events concept](../concepts/events.md)

## 1. The events property

`CommandBot` has an optional `events` property where you register handlers for lifecycle events:

```typescript
import {
  CommandBot,
  BotEventName,
  BotContext,
  BotResponse,
  BotEventPayload,
} from '@colloquium/types';

export const MyBot: CommandBot = {
  id: 'bot-auto-analyzer',
  name: 'Auto Analyzer',
  description: 'Automatically analyzes manuscripts on submission',
  version: '1.0.0',
  commands: [analyzeCommand],
  keywords: [],
  triggers: ['mention'],
  permissions: ['read_manuscript_files'],
  help: {
    overview: 'Runs analysis automatically when manuscripts are submitted.',
    quickStart: 'This bot runs automatically. You can also trigger it manually with `@bot-auto-analyzer analyze`.',
    examples: ['@bot-auto-analyzer analyze'],
  },

  events: {
    [BotEventName.MANUSCRIPT_SUBMITTED]: handleSubmitted,
    [BotEventName.FILE_UPLOADED]: handleFileUploaded,
  },
};
```

## 2. Handle manuscript submission

The `manuscript.submitted` event fires once when a new manuscript is created:

```typescript
async function handleSubmitted(
  context: BotContext,
  payload: BotEventPayload[BotEventName.MANUSCRIPT_SUBMITTED]
): Promise<BotResponse> {
  const client = createBotClient(context);

  // payload.manuscriptId is always available
  const manuscript = await client.manuscripts.get();

  return {
    messages: [{
      content: `Manuscript "${manuscript.title}" received. Running initial analysis...`,
    }],
  };
}
```

## 3. Handle file uploads

The `file.uploaded` event fires each time a file is added to the manuscript:

```typescript
async function handleFileUploaded(
  context: BotContext,
  payload: BotEventPayload[BotEventName.FILE_UPLOADED]
): Promise<BotResponse | void> {
  const { file } = payload;

  // Only process source files
  if (file.type !== 'SOURCE') {
    return; // Return void to skip responding
  }

  const client = createBotClient(context);
  const content = await client.files.download(file.id);

  const wordCount = content.split(/\s+/).length;

  return {
    messages: [{
      content: `New source file "${file.name}" uploaded (${wordCount.toLocaleString()} words).`,
    }],
  };
}
```

## 4. Track processed events with storage

Avoid duplicate processing by recording what you've already handled:

```typescript
async function handleSubmitted(
  context: BotContext,
  payload: BotEventPayload[BotEventName.MANUSCRIPT_SUBMITTED]
): Promise<BotResponse | void> {
  const client = createBotClient(context);

  // Check if already processed
  const processed = await client.storage.get<boolean>('submitted-processed');
  if (processed) return;

  // Mark as processed
  await client.storage.set('submitted-processed', true);

  const manuscript = await client.manuscripts.get();
  return {
    messages: [{
      content: `Welcome! Manuscript "${manuscript.title}" has been received. ` +
        `I'll monitor for new files and run analysis automatically.`,
    }],
  };
}
```

## 5. Available events

| Event | Payload | When it fires |
|-------|---------|---------------|
| `manuscript.submitted` | `{ manuscriptId }` | New manuscript created |
| `manuscript.statusChanged` | `{ previousStatus, newStatus }` | Status transitions (e.g., SUBMITTED → UNDER_REVIEW) |
| `file.uploaded` | `{ file: { id, name, type, mimetype } }` | File added to manuscript |
| `reviewer.assigned` | `{ reviewerId, dueDate, status }` | Reviewer assigned to manuscript |
| `reviewer.statusChanged` | `{ reviewerId, previousStatus, newStatus }` | Reviewer accepts/declines/completes |
| `workflow.phaseChanged` | `{ previousPhase, newPhase, round }` | Workflow phase transition |
| `decision.released` | `{ decision, round }` | Editorial decision released to authors |

All event names are available as `BotEventName` enum values with fully typed payloads via `BotEventPayload`.

## 6. Test event handlers

Use the `EventTestHarness` to fire events in tests:

```typescript
import { createEventTestHarness } from '@colloquium/bots/testing';
import { MyBot } from '../src';

describe('Auto Analyzer events', () => {
  const harness = createEventTestHarness(MyBot);

  it('responds to manuscript submission', async () => {
    const result = await harness.fireEvent('manuscript.submitted', {
      manuscriptId: 'ms-123',
    });

    expect(result).toBeDefined();
    expect(result!.messages?.[0].content).toContain('received');
  });

  it('processes source file uploads', async () => {
    const result = await harness.fireEvent('file.uploaded', {
      file: { id: 'f-1', name: 'paper.md', type: 'SOURCE', mimetype: 'text/markdown' },
    });

    expect(result).toBeDefined();
    expect(result!.messages?.[0].content).toContain('paper.md');
  });

  it('ignores non-source file uploads', async () => {
    const result = await harness.fireEvent('file.uploaded', {
      file: { id: 'f-2', name: 'logo.png', type: 'ASSET', mimetype: 'image/png' },
    });

    expect(result).toBeUndefined();
  });

  it('logs all fired events', async () => {
    harness.clearEventLog();

    await harness.fireEvent('manuscript.submitted', { manuscriptId: 'ms-1' });
    await harness.fireEvent('file.uploaded', {
      file: { id: 'f-1', name: 'paper.md', type: 'SOURCE', mimetype: 'text/markdown' },
    });

    const log = harness.getEventLog();
    expect(log).toHaveLength(2);
    expect(log[0].event).toBe('manuscript.submitted');
    expect(log[1].event).toBe('file.uploaded');
  });
});
```

## 7. Event handler patterns

**Return `void` to skip responding:**
```typescript
async function handler(context, payload): Promise<BotResponse | void> {
  if (!shouldProcess(payload)) return; // No message posted
  return { messages: [{ content: 'Processed!' }] };
}
```

**Combine events with commands:**
Events and commands work together. A bot can auto-run on submission *and* support manual `@bot-name analyze` invocations.

**Use context overrides in tests:**
```typescript
const harness = createEventTestHarness(MyBot)
  .withContext({ manuscriptId: 'specific-ms-id' });
```

## Next steps

- [Interactive Actions](interactive-actions.md) — Add buttons to bot responses
- [Events Concept](../concepts/events.md) — Event processing semantics
- [Events Reference](../reference/events.md) — Complete event catalog
- [Storage Concepts](../concepts/storage.md) — Persistent state between events
