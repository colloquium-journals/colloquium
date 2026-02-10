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

## Error Handling

- Bot errors are caught and logged
- A user-visible error message is posted to the conversation
- The original job is marked as failed for monitoring
- Bot actions that fail don't prevent message delivery
