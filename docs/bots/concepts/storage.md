# Persistent Storage

Bots can store key-value data that persists across invocations using the SDK's storage client. Storage is scoped to a (botId, manuscriptId) pair, so each bot has its own isolated namespace per manuscript.

## SDK methods

```typescript
import { createBotClient } from '@colloquium/bot-sdk';

const client = createBotClient(context);

// Get a typed value (returns null if not found)
const count = await client.storage.get<number>('run-count');

// Set a value (any JSON-serializable data)
await client.storage.set('run-count', (count ?? 0) + 1);

// Delete a key
await client.storage.delete('run-count');

// List all keys for this bot + manuscript
const keys = await client.storage.list();
// Returns: Array<{ key: string; updatedAt: string }>
```

## Scoping

Storage is automatically scoped by the bot's service token:

- **Bot scope**: Each bot can only access its own keys
- **Manuscript scope**: Keys are isolated per manuscript
- **No cross-bot access**: Bot A cannot read Bot B's storage

The scoping is enforced server-side — bots don't need to namespace their keys manually.

## Use cases

### Caching for incremental processing

Skip files that haven't changed since the last run:

```typescript
const hash = computeHash(fileContent);
const cached = await client.storage.get<string>(`file-hash:${fileId}`);

if (cached === hash) {
  return; // File unchanged, skip processing
}

// Process the file...
await client.storage.set(`file-hash:${fileId}`, hash);
```

### Multi-step workflow state

Track progress across multiple bot invocations:

```typescript
interface AnalysisState {
  step: 'pending' | 'files-checked' | 'references-validated' | 'complete';
  checkedFiles: string[];
  errors: string[];
}

const state = await client.storage.get<AnalysisState>('analysis-state') ?? {
  step: 'pending',
  checkedFiles: [],
  errors: [],
};

// Update state as work progresses
state.step = 'files-checked';
state.checkedFiles.push(fileId);
await client.storage.set('analysis-state', state);
```

### Configuration overrides

Store per-manuscript settings that override global bot config:

```typescript
const overrides = await client.storage.get<Record<string, any>>('config-overrides');
const effectiveConfig = { ...context.config, ...overrides };
```

### Event tracking

Record which events have been processed to avoid duplicate work:

```typescript
const processed = await client.storage.get<string[]>('processed-events') ?? [];

if (processed.includes(eventId)) {
  return; // Already handled
}

processed.push(eventId);
await client.storage.set('processed-events', processed);
```

## Data lifecycle

- **Created**: When a bot first calls `storage.set()`
- **Updated**: Each subsequent `storage.set()` overwrites the value
- **Deleted**: Explicitly via `storage.delete()`, or automatically when the manuscript is deleted
- **No expiration**: Keys persist indefinitely until explicitly removed or the manuscript is deleted

## API endpoints

The storage client wraps these REST endpoints:

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/bot-storage/:key` | Get a value |
| `PUT` | `/api/bot-storage/:key` | Set a value |
| `DELETE` | `/api/bot-storage/:key` | Delete a value |
| `GET` | `/api/bot-storage` | List all keys |

All endpoints require `x-bot-token` authentication with the `bot_storage` permission.

## Limits

- **Key length**: Maximum 255 characters
- **Value size**: Maximum 1 MB per key (JSON serialized)
- **Keys per bot per manuscript**: No hard limit, but keep it reasonable

## Related

- [Working with Files Tutorial](../tutorials/working-with-files.md) — Uses storage for file caching
- [Event-Driven Bots Tutorial](../tutorials/event-driven-bots.md) — Uses storage for event tracking
- [SDK Reference](../reference/sdk.md) — Full `StorageClient` API
