# Bot Architecture

## Message Flow

```
1. User posts "@bot-name command param=value" in a conversation
2. API receives message, saves to database
3. Mention parser detects @bot- prefix, extracts bot ID
4. Command parser identifies command name and parameters
5. Job is queued via graphile-worker (addBotJob)
6. Worker picks up job (3 concurrent processors)
7. botProcessor.ts:
   a. Fetches message and user data
   b. Generates service token with permissions
   c. Pre-fetches manuscript metadata and file list
   d. Calls botExecutor.processMessage() with enriched context
8. Bot executes command logic, returns BotResponse
9. Response messages saved to database
10. Messages broadcast via SSE to connected clients
11. Bot actions (status changes, file uploads) processed by BotActionProcessor
```

## Plugin System

Bots are loaded as plugins via `botManager.ts`. Each bot package exports:

- A `CommandBot` object with commands, help, and metadata
- A plugin manifest describing permissions, category, and version

Built-in bots are registered at startup. The system validates manifests against `botPluginManifestSchema` before loading.

## Job Queue

Colloquium uses **graphile-worker** backed by PostgreSQL for bot job processing:

- Jobs are added with `addBotJob()` after message creation
- PostgreSQL `LISTEN/NOTIFY` ensures efficient, low-latency pickup
- 3 concurrent worker slots process jobs in parallel
- Failed jobs are retried automatically

This architecture ensures bot processing never blocks the user's message posting.

## Service Tokens

Each bot invocation receives a scoped service token:

1. `generateBotServiceToken()` creates a JWT with specific permissions
2. Token is passed in `context.serviceToken`
3. Bots include it as `x-bot-token` header in API calls
4. API middleware validates the token and checks permission scopes

## Enriched Context

The bot processor pre-fetches commonly needed data before invoking the bot:

- `context.manuscript` - Title, abstract, authors, status, keywords, workflow info
- `context.files` - List of manuscript files with metadata

This saves bots 1-3 API round-trips per invocation. Both fields are optional for backwards compatibility.

## Event System

In addition to `@mention` commands, bots can subscribe to platform lifecycle events using the `events` property on `CommandBot`. When an event occurs (e.g., a reviewer is assigned), the system dispatches it to all installed bots that have a handler for that event.

### Event Flow

```
1. Platform action occurs (e.g., reviewer assigned)
2. Route/service calls dispatchBotEvent(eventName, manuscriptId, payload)
3. Dispatcher checks all installed bots for matching event handlers
4. For each match, a graphile-worker job is queued (bot-event-processing)
5. Worker invokes the bot's event handler with enriched context + payload
6. If handler returns messages, they are posted to the manuscript's review conversation
```

### Available Events

| Event | Trigger |
|-------|---------|
| `manuscript.submitted` | New manuscript created |
| `manuscript.statusChanged` | Manuscript status updated |
| `file.uploaded` | File added to a manuscript |
| `reviewer.assigned` | Reviewer assigned to manuscript |
| `reviewer.statusChanged` | Review assignment status changes |
| `workflow.phaseChanged` | Workflow phase transitions |
| `decision.released` | Editorial decision released |

See [Events Reference](events.md) for full payload documentation.

## Bot-Scoped Storage

Bots can persist key-value data scoped to `(botId, manuscriptId)` using the storage API. This allows bots to remember state between invocations (e.g., file hashes, analysis results, preferences).

Access is via `client.storage` in the SDK or the `/api/bot-storage` REST endpoints.

## Pipeline System

Pipelines allow declarative, sequential bot execution triggered by platform events. Configure them in journal settings:

```json
{
  "pipelines": {
    "on-submission": [
      { "bot": "bot-reference-check", "command": "check" },
      { "bot": "bot-reviewer-checklist", "command": "generate" }
    ]
  }
}
```

### Pipeline Execution Flow

```
1. Platform event occurs (e.g., manuscript.submitted)
2. botEventDispatcher dispatches individual event handlers
3. pipelineExecutor checks journal settings for matching pipeline
4. First step queued as bot-pipeline-step job
5. Worker executes bot command via botExecutor
6. On success, next step is queued
7. On error, pipeline stops (no further steps)
```

Pipeline keys map to event names: `on-submission` → `manuscript.submitted`, `on-status-changed` → `manuscript.statusChanged`, etc.

See [Pipelines Reference](pipelines.md) for full configuration.

## Bot-to-Bot Invocation

Bots with the `invoke_bots` permission can invoke other bots synchronously via `POST /api/bots/invoke`. The invoking bot decides what to do with the result — no messages are automatically posted.

```typescript
const result = await client.bots.invoke('bot-reference-check', 'check');
```

## Granular Permissions

Bot API permissions are enforced at every endpoint. Bots receive permissions based on their declared `BotPermission` values, mapped to API-level `BotApiPermission` values at token generation time. Baseline permissions (`read_manuscript`, `read_manuscript_files`, `bot_storage`) are always included.

See [Permissions Reference](../reference/permissions.md) for the full mapping.

## Error Handling

- Bot errors are caught and logged
- A user-visible error message is posted to the conversation
- The original job is marked as failed for monitoring
- Bot actions that fail don't prevent message delivery
