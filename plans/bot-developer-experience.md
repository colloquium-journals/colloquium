# Bot Developer Experience Overhaul

Comprehensive plan to make Colloquium's bot ecosystem a first-class extensibility platform with excellent developer experience.

## Motivation

Colloquium's long-term value depends on a thriving ecosystem of community-built bots. Today, building a bot requires reverse-engineering patterns from existing bots, writing boilerplate API client code, and navigating documentation that is outdated and inconsistent with the actual codebase. This plan addresses the full stack of improvements needed: platform capabilities, SDK tooling, developer workflow, and documentation.

## Current State Assessment

### What works well
- Command-based bot model (`CommandBot` + `BotCommand`) is clean and intuitive
- `create-colloquium-bot` CLI scaffold exists
- YAML configuration with comment preservation is developer-friendly
- Auto-generated help system reduces boilerplate
- Plugin loader supports multiple installation sources (npm, git, local, URL)
- Testing utilities exist in `packages/bots/src/testing/`
- Graphile-worker job queue is reliable and simple (no Redis dependency)

### What needs improvement
- **No shared API client**: Every bot reimplements `fetch` calls with headers, URL construction, error handling
- **Thin context**: Bots receive only IDs and a token, then must make redundant API calls for basic manuscript metadata
- **Mention-only triggers**: No way for bots to react to lifecycle events (submission, status change, file upload)
- **No persistent storage**: Bots can't remember anything between invocations
- **Limited API surface**: Bots can't read conversation history, post independent messages, or query across manuscripts
- **No composition**: Bots operate in isolation with no chaining or pipeline support
- **Unstructured output**: Bot responses are just markdown text, no machine-readable data
- **Outdated documentation**: Docs reference old `BotAction`/`BotRegistry` patterns that no longer exist in the codebase
- **Stale template**: `create-colloquium-bot` generates `.eslintrc.js` instead of ESLint 9 flat config
- **No API versioning**: No contract between platform and third-party bots

---

## Part 1: Platform & SDK Improvements

### 1.1 Bot SDK Client Library

**Package**: `@colloquium/bot-sdk`

**Goal**: Eliminate all raw `fetch` boilerplate from bot code. Every API interaction should be a single typed method call.

**Design**:

```typescript
import { createBotClient } from '@colloquium/bot-sdk';

export async function execute(params, context) {
  const client = createBotClient(context);

  // Typed, ergonomic methods
  const manuscript = await client.manuscripts.get();
  const files = await client.files.list({ type: 'SOURCE' });
  const content = await client.files.download(fileId);
  await client.files.upload('output.html', buffer, {
    fileType: 'RENDERED',
    mimetype: 'text/html',
  });

  const user = await client.users.get(userId);
  const searchResults = await client.users.search('smith');
}
```

**SDK modules**:

| Module | Methods | Wraps |
|--------|---------|-------|
| `client.manuscripts` | `get()`, `getWorkflow()`, `updateMetadata()` | `GET/PATCH /api/articles/:id` |
| `client.files` | `list(filter?)`, `download(fileId)`, `upload(name, data, opts)` | File endpoints |
| `client.users` | `get(id)`, `search(query)` | User endpoints |
| `client.conversations` | `getMessages(opts?)`, `postMessage(content, opts?)` | Conversation endpoints (new) |
| `client.reviewers` | `list()`, `assign(userId, opts?)`, `updateStatus(userId, status)` | Reviewer endpoints |
| `client.storage` | `get(key)`, `set(key, value)`, `delete(key)`, `list()` | Bot storage endpoints (new) |

**Implementation approach**:
1. Create `packages/bot-sdk/` package
2. Export a `createBotClient(context: BotContext)` factory
3. Internally reads `context.serviceToken` and `context.config.apiUrl`
4. All methods return typed responses (types from `@colloquium/types`)
5. Built-in error handling: network errors, 4xx/5xx responses, timeouts
6. Zero external dependencies beyond `@colloquium/types`

**Migration**: Refactor existing bots (`bot-editorial`, `bot-markdown-renderer`, `bot-reference-check`, `bot-reviewer-checklist`) to use the SDK, deleting their ad-hoc fetch code. This both validates the SDK design and reduces code duplication.

### 1.2 Enriched Bot Context

**Goal**: Pre-populate the `BotContext` with data that nearly every bot needs, eliminating redundant API round-trips.

**Changes to `BotContext`**:

```typescript
interface BotContext {
  // Existing fields (unchanged)
  conversationId: string;
  manuscriptId: string;
  triggeredBy: { messageId, userId, userRole, trigger };
  journal: { id, settings };
  config: Record<string, any>;
  serviceToken?: string;

  // New pre-fetched data
  manuscript: {
    title: string;
    authors: string[];
    status: ManuscriptStatus;
    workflowPhase: WorkflowPhase | null;
    workflowRound: number;
    abstract: string | null;
    keywords: string[];
  };
  files: Array<{
    id: string;
    originalName: string;
    filename: string;
    fileType: string;
    mimetype: string;
    size: number;
  }>;
  conversation: {
    id: string;
    privacy: string;
    messageCount: number;
  };
}
```

**Implementation**: In `apps/api/src/jobs/botProcessor.ts`, the processor already has DB access. Add queries for manuscript metadata and file list before calling `botExecutor.processMessage()`. This data is cheap to fetch (single DB query with includes) and saves every bot 1-3 API round-trips on every invocation.

**Breaking change**: This expands the context object. Existing bots that don't use the new fields are unaffected. Mark this as a bot API version bump.

### 1.3 Event/Hook System

**Goal**: Let bots react to platform events, not just `@mentions`. This unlocks an entire category of automation bots.

**Bot declaration**:

```typescript
const myBot: CommandBot = {
  id: 'bot-auto-render',
  commands: [ /* ... */ ],

  // New: event subscriptions
  events: {
    'manuscript.submitted': async (context) => {
      // Auto-render on submission
    },
    'manuscript.statusChanged': async (context, { previousStatus, newStatus }) => {
      // React to accept/reject/revise decisions
    },
    'file.uploaded': async (context, { file }) => {
      // Auto-process new files (e.g., parse .bib on upload)
    },
    'reviewer.assigned': async (context, { reviewer, dueDate }) => {
      // Auto-generate checklist for new reviewer
    },
    'reviewer.completed': async (context, { reviewer }) => {
      // Notify editor when all reviews are in
    },
    'workflow.phaseChanged': async (context, { previousPhase, newPhase }) => {
      // Custom actions on phase transitions
    },
  }
};
```

**Event catalog** (initial set):

| Event | Fired when | Payload |
|-------|-----------|---------|
| `manuscript.submitted` | New manuscript created | `{ manuscriptId }` |
| `manuscript.statusChanged` | Status field changes | `{ previousStatus, newStatus }` |
| `file.uploaded` | File added to manuscript | `{ file: { id, name, type, mimetype } }` |
| `reviewer.assigned` | Reviewer assignment created | `{ reviewerId, dueDate, status }` |
| `reviewer.statusChanged` | Assignment status changes (accepted, declined, completed) | `{ reviewerId, previousStatus, newStatus }` |
| `workflow.phaseChanged` | Workflow phase transitions | `{ previousPhase, newPhase, round }` |
| `decision.released` | Reviews released to authors | `{ decision, round }` |

**Implementation**:
1. Add `events` field to `CommandBot` type in `packages/types`
2. At each event source (route handlers, service functions), call a new `dispatchBotEvent(eventName, payload)` function
3. `dispatchBotEvent` looks up which installed bots subscribe to the event and queues a graphile-worker job for each
4. Event jobs are processed by the same bot worker pool, with the same timeout/retry semantics as command jobs
5. Event handlers receive the same enriched `BotContext` plus event-specific payload

**Configuration**: Journal admins can enable/disable specific event subscriptions per bot via the admin UI, similar to how bot configuration already works.

### 1.4 Bot-Scoped Persistent Storage

**Goal**: Give bots a key-value store scoped to `(botId, manuscriptId)` for state between invocations.

**Database**:

```sql
CREATE TABLE bot_storage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id TEXT NOT NULL,
  manuscript_id UUID NOT NULL REFERENCES manuscripts(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(bot_id, manuscript_id, key)
);
```

**API endpoints** (bot-token authenticated):

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/bot-storage/:key` | Get value for key (scoped to bot + manuscript from token) |
| `PUT` | `/api/bot-storage/:key` | Set value for key |
| `DELETE` | `/api/bot-storage/:key` | Delete key |
| `GET` | `/api/bot-storage` | List all keys for this bot + manuscript |

**SDK integration**:

```typescript
const client = createBotClient(context);

// Simple typed key-value operations
await client.storage.set('lastCheckHash', fileHash);
const hash = await client.storage.get<string>('lastCheckHash');
await client.storage.delete('lastCheckHash');

// Store complex objects
await client.storage.set('analysisResults', {
  checkedAt: new Date().toISOString(),
  issues: [...],
  fileHashes: {...},
});
```

**Use cases**:
- Incremental processing (only re-check changed files)
- Caching expensive computations (rendered output hash, DOI resolution results)
- Multi-step workflows (bot remembers what step it's on)
- Per-manuscript bot preferences

### 1.5 Expanded Bot API Surface

**Goal**: Add API endpoints that bots need but don't currently exist.

**New endpoints**:

| Endpoint | Purpose | Permission |
|----------|---------|------------|
| `GET /api/conversations/:id/messages` | Read conversation history | `read_conversations` |
| `POST /api/conversations/:id/messages` | Post message outside of command response | `write_messages` |
| `GET /api/articles/:id/workflow` | Read workflow state, phase, round, assignments | `read_manuscript` |
| `PATCH /api/articles/:id/metadata` | Update manuscript metadata fields | `update_metadata` |

**Permission enforcement**: Flesh out the existing `permissions[]` array in bot service tokens. Currently all bots get `['read_manuscript_files', 'upload_files']`. Expand to granular permissions that journal admins can configure per-bot:

```typescript
type BotPermission =
  | 'read_manuscript'        // Read manuscript content and metadata
  | 'read_manuscript_files'  // Download files
  | 'upload_files'           // Upload files
  | 'read_conversations'     // Read conversation messages
  | 'write_messages'         // Post messages to conversations
  | 'update_metadata'        // Modify manuscript metadata
  | 'manage_reviewers'       // Create/update reviewer assignments
  | 'manage_workflow'        // Trigger workflow transitions
  | 'bot_storage'            // Use key-value storage
```

### 1.6 Bot Composition and Pipelines

**Goal**: Allow bots to trigger other bots and allow admins to configure automated pipelines.

**A) Declarative pipelines** (admin-configured via YAML):

```yaml
# Journal workflow configuration
pipelines:
  on-submission:
    - bot: bot-markdown-renderer
      command: render
    - bot: bot-reference-check
      command: check-doi
    - bot: bot-reviewer-checklist
      command: generate

  on-revision-submitted:
    - bot: bot-markdown-renderer
      command: render
    - bot: bot-reference-check
      command: check-doi
```

Pipelines are syntactic sugar over the event system. The `on-submission` pipeline is equivalent to each bot subscribing to `manuscript.submitted`. The advantage is centralized configuration and guaranteed ordering.

**B) Bot-to-bot invocation** (programmatic, via SDK):

```typescript
const client = createBotClient(context);
const result = await client.bots.invoke('bot-reference-check', 'check-doi', {
  detailed: true,
});
```

This queues a job and waits for the result. Useful when one bot's output feeds into another's logic.

**Implementation priority**: Pipelines first (simpler, higher value), then programmatic invocation (more complex, niche use cases).

### 1.7 Structured Return Types

**Goal**: Allow bots to return machine-readable data alongside human-readable messages.

**Extended response type**:

```typescript
interface BotResponseMessage {
  content: string;                     // Human-readable markdown (existing)
  structuredData?: {                   // Machine-readable (new)
    type: string;                      // e.g., 'reference-report', 'render-result'
    data: Record<string, unknown>;     // Typed payload
  };
  annotations?: Array<{               // Inline manuscript annotations (new)
    type: 'warning' | 'error' | 'info' | 'suggestion';
    location?: { line?: number; section?: string };
    message: string;
  }>;
}
```

**Use cases**:
- Dashboard widgets that summarize bot results (e.g., "3 DOIs invalid" badge)
- Bot-to-bot data passing via pipelines (reference checker output → citation formatter input)
- Manuscript annotation overlays in the UI
- Exportable quality reports

### 1.8 Bot API Versioning

**Goal**: Establish a contract between the platform and third-party bots so that platform updates don't silently break bots.

**Approach**:
- Add `botApiVersion` field to the bot manifest (integer, starting at `1`)
- The platform declares its supported bot API versions
- On bot install/load, check compatibility
- When breaking changes occur, bump the version and document migration
- The SDK handles version negotiation transparently

```typescript
// In bot manifest
export const manifest = {
  colloquium: {
    botId: 'bot-my-awesome',
    botApiVersion: 1,  // Platform checks this on load
    // ...
  }
};
```

**What constitutes a breaking change** (requires version bump):
- Removing or renaming `BotContext` fields
- Changing `BotResponse` structure
- Removing API endpoints that bots depend on
- Changing authentication mechanism

**What does NOT require a version bump**:
- Adding new optional fields to `BotContext`
- Adding new API endpoints
- Adding new event types
- Adding new permission types

---

## Part 2: Developer Workflow Improvements

### 2.1 Update `create-colloquium-bot` Template

**Current issues**:
- Generates `.eslintrc.js` (project uses ESLint 9 flat config `eslint.config.mjs`)
- Template bot doesn't demonstrate API calls or SDK usage
- No event subscription example
- No integration test using the test harness
- Generated `default-config.yaml` is minimal

**Changes**:
- Replace `.eslintrc.js` with `eslint.config.mjs` using `@colloquium/eslint-config`
- Update `jest.config.js` to match current project patterns
- Generated bot imports and uses `@colloquium/bot-sdk`
- Include example event subscription (commented out, with explanation)
- Include a working integration test that uses `packages/bots/src/testing/`
- Richer `default-config.yaml` with annotated examples of nested config, arrays, and enums
- Add `@colloquium/bot-sdk` to generated `package.json` dependencies
- Update `tsconfig.json` to match project conventions

### 2.2 Local Development Mode

**Goal**: Make the edit-test cycle fast for bot developers.

**`colloquium bot dev` CLI command** (added to the root project's scripts or as a standalone CLI):

```bash
# Watch for changes, hot-reload bot into running API
npm run bot:dev -- --bot packages/bot-my-feature

# Or from the bot package directory
cd packages/bot-my-feature && npm run dev
```

**Behavior**:
- Watches `src/` for changes
- Rebuilds TypeScript on change
- Hot-reloads the bot in the running API (the plugin loader already supports cache cleanup)
- Streams bot execution logs to the terminal
- Shows formatted bot responses inline

**Implementation**: Extend the existing `BotPluginLoader` hot-reload capability with a file watcher (chokidar or fs.watch) and a CLI wrapper.

### 2.3 Bot Playground (Admin UI)

**Goal**: Let developers test bot commands without creating real manuscripts/conversations.

**Feature**:
- Admin page at `/admin/bot-playground`
- Text input that accepts `@bot-name command param=value`
- Displays formatted bot response (messages, actions, errors, structured data)
- Shows execution timing, permissions used, API calls made
- Dropdown to select a test manuscript as context
- Log panel showing bot console output

**Implementation**: New route in the admin section, calls the bot executor directly with a synthetic context. Lower priority than SDK and events but high value for DX.

### 2.4 Enhanced Testing Utilities

**Improvements to `packages/bots/src/testing/`**:

- **Snapshot testing**: Capture and assert on full bot responses
  ```typescript
  const response = await harness.execute('@bot-reference-check check-doi');
  expect(response).toMatchBotSnapshot();
  ```
- **Mock SDK client**: Pre-configured mock that intercepts all SDK calls
  ```typescript
  const { client, harness } = createTestHarness(myBot);
  client.files.list.mockResolvedValue([mockFile]);
  ```
- **Integration test helper**: Spins up real API + test DB for end-to-end testing
  ```typescript
  const env = await createIntegrationEnv();
  const result = await env.executeBot('bot-reference-check', 'check-doi');
  await env.teardown();
  ```
- **Event testing**: Simulate events and verify bot responses
  ```typescript
  const response = await harness.fireEvent('file.uploaded', { file: mockFile });
  expect(response.messages).toHaveLength(1);
  ```

---

## Part 3: Documentation Overhaul

The current bot documentation is spread across 6+ files with overlapping content, outdated patterns, and references to code that no longer exists. This section proposes a complete restructure.

### 3.1 Current Documentation Problems

1. **Outdated architecture references**: `docs/development/bots.md` describes a `BotAction` class pattern and `BotRegistry` API that doesn't match the current `CommandBot`/`BotCommand`/`BotExecutor` system
2. **Ghost bots**: `docs/bots/README.md` lists "Plagiarism Checker" and "Statistics Reviewer" as planned bots. These don't exist and aren't in active development. Meanwhile, actual bots (`bot-markdown-renderer`, `bot-reference-check`, `bot-reviewer-checklist`) are undocumented
3. **Scattered structure**: Bot docs are split across `docs/development/bots.md`, `docs/bot-development/README.md`, `docs/bots/README.md`, `docs/bot-configuration.md`, `docs/bot-help-system.md`, `docs/bot-development/npx-template.md` — with significant overlap and contradictions
4. **Incorrect code examples**: API usage examples show patterns (e.g., `BotRegistry.registerBot()`, `BotRegistry.executeAction()`) that don't exist in the current codebase
5. **Missing SDK documentation**: No docs for the testing utilities that already exist in `packages/bots/src/testing/`
6. **Stale links**: References to Discord, external docs sites, and contributing guides that don't exist

### 3.2 New Documentation Structure

Consolidate all bot documentation into a single `docs/bots/` directory with a clear hierarchy. Delete the scattered files and replace with:

```
docs/bots/
├── README.md                    # Landing page: what bots are, why they matter
├── quick-start.md               # 0-to-working-bot in 15 minutes
├── tutorials/
│   ├── your-first-bot.md        # Step-by-step: build a word-count bot
│   ├── working-with-files.md    # Tutorial: download, process, upload files
│   ├── event-driven-bots.md     # Tutorial: react to manuscript lifecycle events
│   └── interactive-actions.md   # Tutorial: add buttons and confirmations to bot messages
├── concepts/
│   ├── architecture.md          # How the bot system works (executor, jobs, SSE)
│   ├── commands.md              # Command parsing, parameters, help system
│   ├── authentication.md        # Service tokens, permissions, API access
│   ├── configuration.md         # YAML config, admin UI, runtime access
│   ├── events.md                # Event system, subscriptions, payloads
│   ├── storage.md               # Persistent key-value storage
│   ├── pipelines.md             # Bot composition and chaining
│   └── testing.md               # Testing strategies, harness, mocks
├── reference/
│   ├── bot-api.md               # Complete CommandBot / BotCommand / BotContext / BotResponse type reference
│   ├── sdk.md                   # @colloquium/bot-sdk API reference
│   ├── events.md                # Event catalog with payloads
│   ├── permissions.md           # All permissions, what they control
│   ├── cli.md                   # create-colloquium-bot CLI reference
│   └── api-endpoints.md         # HTTP endpoints available to bots
├── guides/
│   ├── publishing.md            # How to publish a bot to npm
│   ├── migrating-v1-to-v2.md   # Migration guide when API version bumps
│   └── containerized-bots.md   # Service-enhanced bots with Docker
└── built-in-bots/
    ├── editorial.md             # bot-editorial command reference
    ├── markdown-renderer.md     # bot-markdown-renderer command reference
    ├── reference-check.md       # bot-reference-check command reference
    └── reviewer-checklist.md    # bot-reviewer-checklist command reference
```

**Files to delete** (replaced by the new structure):
- `docs/development/bots.md`
- `docs/bot-development/README.md`
- `docs/bot-development/npx-template.md`
- `docs/bots/README.md`
- `docs/bots/editorial-bot.md`
- `docs/bots/plagiarism-checker.md` (describes a bot that doesn't exist)
- `docs/bots/statistics-reviewer.md` (describes a bot that doesn't exist)
- `docs/bot-configuration.md`
- `docs/bot-help-system.md`

### 3.3 Documentation Content Specifications

#### `docs/bots/README.md` — Landing Page

- One-paragraph explanation of what bots are and why they matter for academic publishing
- Visual diagram of the bot architecture (text-based)
- Quick links to: Quick Start, Tutorials, Built-in Bots, SDK Reference
- List of built-in bots with one-line descriptions and links

#### `docs/bots/quick-start.md` — Zero to Working Bot

Target: A developer should have a working bot in 15 minutes.

Content:
1. Prerequisites (Node.js, running Colloquium instance)
2. `npx create-colloquium-bot bot-hello-world`
3. Walk through the generated files (3-4 files, not all of them)
4. Modify the example command to do something simple
5. Install the bot locally: how to add it to the monorepo or load it via the plugin system
6. Test it: type `@bot-hello-world analyze` in a conversation
7. Next steps: links to tutorials

#### `docs/bots/tutorials/your-first-bot.md` — Build a Word Count Bot

A complete tutorial building a practical (if simple) bot from scratch. Covers:
- Creating the package manually (not with the CLI, so the developer understands every file)
- Defining the `CommandBot` with a `count` command
- Using the SDK to fetch manuscript content
- Returning a formatted response with word/sentence/paragraph counts
- Adding a `detailed` parameter
- Writing tests using the test harness
- Adding configuration (which sections to count)
- Adding help text

#### `docs/bots/tutorials/working-with-files.md` — File Processing Bot

Tutorial building a bot that:
- Lists manuscript files using `client.files.list()`
- Downloads a specific file type (e.g., `.bib` bibliography)
- Processes the file content
- Uploads a result file
- Uses storage to cache results and detect changes

#### `docs/bots/tutorials/event-driven-bots.md` — Event Subscriptions

Tutorial building a bot that:
- Subscribes to `manuscript.submitted` to auto-run on submission
- Subscribes to `file.uploaded` to process new files immediately
- Uses storage to track what's been processed
- Demonstrates the event payload and context

#### `docs/bots/tutorials/interactive-actions.md` — Buttons and Confirmations

Tutorial covering:
- Adding `BotMessageAction` buttons to responses
- Implementing `actionHandlers` for button clicks
- Adding confirmation prompts
- Targeting actions to specific roles
- Tracking action state (clicked/unclicked)

#### `docs/bots/concepts/architecture.md` — How It All Works

Conceptual overview (no code required to follow):
- Diagram: User posts message → Command parser → Job queue → Bot executor → Response via SSE
- How bots are loaded (plugin system, local packages, npm)
- How bots are registered and initialized
- The job queue (graphile-worker) and why it matters
- SSE broadcasting and real-time responses
- Service token lifecycle

#### `docs/bots/concepts/commands.md` — Commands and Parameters

- How `@bot-name command param=value` is parsed
- Parameter types (string, number, boolean, enum, array)
- Required vs optional parameters, defaults
- The auto-generated help system (reference to `bot-help-system.md` content, updated)
- Custom help sections
- Examples from built-in bots

#### `docs/bots/concepts/authentication.md` — Security Model

- How service tokens are generated and scoped
- The `x-bot-token` header
- Permission model and what each permission grants
- Manuscript scoping (bots can only access the manuscript they were triggered on)
- How journal admins control bot permissions

#### `docs/bots/concepts/configuration.md` — Bot Configuration

- The `default-config.yaml` file (content from current `bot-configuration.md`, updated)
- How admins edit config in the UI
- Accessing config in bot code via `context.config`
- Config schema validation
- Nested config patterns, arrays, enums

#### `docs/bots/concepts/events.md` — Event System

- Overview of the event model
- Full event catalog with payload types
- How to subscribe to events in a bot definition
- Event processing semantics (async, retries, ordering)
- Admin controls for enabling/disabling event subscriptions

#### `docs/bots/concepts/storage.md` — Persistent Storage

- The key-value store model
- Scoping: (botId, manuscriptId)
- SDK methods for CRUD operations
- Use cases: caching, incremental processing, multi-step workflows
- Data lifecycle (cleaned up when manuscript deleted)

#### `docs/bots/concepts/pipelines.md` — Composition

- Declarative pipelines in journal config
- Programmatic bot-to-bot invocation
- Ordering and error handling
- Examples: submission pipeline, revision pipeline

#### `docs/bots/concepts/testing.md` — Testing Bots

- Unit testing with the test harness
- Mocking the SDK client
- Snapshot testing for bot responses
- Integration testing with a real API
- Testing event handlers
- CI/CD patterns for bot packages

#### `docs/bots/reference/bot-api.md` — Type Reference

Complete type definitions with descriptions for:
- `CommandBot`
- `BotCommand`
- `BotCommandParameter`
- `BotContext` (including enriched fields)
- `BotResponse`
- `BotResponseMessage`
- `BotMessageAction`
- `BotActionHandler`
- `BotAttachment`
- `BotPluginManifest`

#### `docs/bots/reference/sdk.md` — SDK Reference

Method-by-method documentation for `@colloquium/bot-sdk`:
- `createBotClient(context)` — factory
- `client.manuscripts.*` — manuscript operations
- `client.files.*` — file operations
- `client.users.*` — user operations
- `client.conversations.*` — conversation operations
- `client.reviewers.*` — reviewer operations
- `client.storage.*` — key-value storage
- `client.bots.*` — bot-to-bot invocation
- Error handling patterns

#### `docs/bots/reference/events.md` — Event Catalog

Table of all events with:
- Event name
- When it fires
- Payload type definition
- Example handler

#### `docs/bots/reference/permissions.md` — Permission Reference

Table of all permissions with:
- Permission string
- What it grants access to
- Which API endpoints require it
- Default bot assignments

#### `docs/bots/reference/cli.md` — CLI Reference

Updated `create-colloquium-bot` documentation:
- All CLI flags and options
- Interactive prompts explained
- Generated file structure
- Post-generation steps

#### `docs/bots/reference/api-endpoints.md` — HTTP Endpoints for Bots

Table of all API endpoints that accept bot authentication:
- Method, path, description
- Required permissions
- Request/response types
- Examples with curl

#### `docs/bots/built-in-bots/*.md` — Built-in Bot References

One page per built-in bot with:
- Overview and purpose
- Complete command reference (parameters, examples, permissions)
- Configuration options (from `default-config.yaml`)
- Common usage patterns

---

## Implementation Phases

### Phase 1: Foundation (SDK + Context + Docs Restructure)
**Estimated scope**: Core infrastructure that everything else builds on.

1. Create `@colloquium/bot-sdk` package with manuscript, file, and user modules
2. Enrich `BotContext` with manuscript metadata and file list
3. Migrate existing bots to use the SDK
4. Write new documentation structure (README, quick-start, architecture concept, type reference)
5. Delete outdated documentation files
6. Update `create-colloquium-bot` template (ESLint 9, SDK usage)
7. Add `botApiVersion: 1` to bot manifest type and all existing bots

**Deliverables**:
- `packages/bot-sdk/` package, published
- Updated `BotContext` type and `botProcessor.ts`
- 4 existing bots refactored to use SDK
- New `docs/bots/` structure with core docs
- Updated `create-colloquium-bot` template

### Phase 2: Events + Storage
**Estimated scope**: The two biggest capability expansions.

1. Add `events` field to `CommandBot` type
2. Implement `dispatchBotEvent()` in API routes and services
3. Add event job processing in graphile-worker
4. Create `bot_storage` table and API endpoints
5. Add `storage` module to SDK
6. Write event and storage concept docs + tutorials
7. Update built-in bots to use events where appropriate (e.g., `bot-reviewer-checklist` auto-generates on reviewer assignment)

**Deliverables**:
- Event dispatch and processing infrastructure
- `bot_storage` table and endpoints
- SDK `storage` and `events` modules
- Concept docs and tutorials for events and storage
- At least one built-in bot updated to demonstrate events

### Phase 3: Expanded API + Composition
**Estimated scope**: Rounding out the API surface and enabling bot chaining.

1. Add conversation message read/write endpoints for bots
2. Add workflow state endpoint
3. Add metadata update endpoint
4. Implement granular permission enforcement
5. Implement declarative pipeline configuration
6. Implement bot-to-bot invocation via SDK
7. Write pipeline concept docs and tutorial
8. Write permission reference docs

**Deliverables**:
- New API endpoints with permission enforcement
- Pipeline configuration and execution
- `client.bots.invoke()` in SDK
- Pipeline and permissions docs

### Phase 4: Developer Tooling + Polish
**Estimated scope**: DX polish and remaining documentation.

1. Build `bot:dev` watch mode CLI
2. Build bot playground admin UI page
3. Enhance testing utilities (snapshot, mock SDK, integration helper, event testing)
4. Write remaining tutorials (files, interactive actions)
5. Write remaining reference docs (SDK complete reference, CLI reference, endpoints reference)
6. Complete built-in bot reference pages
7. Add structured return types to `BotResponse`

**Deliverables**:
- `bot:dev` CLI command
- Bot playground UI
- Enhanced test utilities
- Complete documentation set

---

## Relationship to Existing Plans

- **`bot-architecture-flexible-services.md`**: The containerized bot plan is complementary. The SDK, events, and storage systems work for both simple and service-enhanced bots. The `docs/bots/guides/containerized-bots.md` page will link to and build on that plan.
- **`TODO.md` items**: This plan covers "Bot developer documentation and SDK" (Community & Distribution), "Bot marketplace" (Bot Ecosystem), and "Bot sandboxing / isolated execution" (partially, via permission enforcement). Update TODO.md to reference this plan.

## Success Criteria

- A developer with no prior Colloquium knowledge can build and deploy a working bot in under 30 minutes using only the documentation
- Zero raw `fetch` calls in any bot codebase (all use SDK)
- At least one built-in bot demonstrates event subscriptions
- All documentation code examples are tested and match the actual codebase
- `create-colloquium-bot` generates a project that passes lint, type-check, and tests out of the box
