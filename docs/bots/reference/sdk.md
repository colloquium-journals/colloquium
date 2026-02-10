# Bot SDK Reference

`@colloquium/bot-sdk` provides a typed API client for bots to interact with the Colloquium platform.

## Installation

```bash
npm install @colloquium/bot-sdk
```

(For monorepo packages, use `"@colloquium/bot-sdk": "*"` in dependencies.)

## createBotClient(context)

Creates a client instance from a bot context object.

```typescript
import { createBotClient } from '@colloquium/bot-sdk';

const client = createBotClient(context);
```

The client extracts `apiUrl` from `context.config.apiUrl`, falling back to `process.env.API_URL`, then `http://localhost:4000`. Authentication uses `context.serviceToken`.

## client.manuscripts

### get()

Fetches manuscript metadata.

```typescript
const manuscript = await client.manuscripts.get();
// Returns: ManuscriptData
```

Returns title, abstract, authors, status, keywords, workflow info, and more.

## client.files

### list(filter?)

Lists manuscript files.

```typescript
const allFiles = await client.files.list();
const sourceFiles = await client.files.list({ fileType: 'SOURCE' });
```

### download(fileId)

Downloads file content as text by file ID.

```typescript
const content = await client.files.download('file-uuid');
```

### downloadByUrl(url)

Downloads from a relative or absolute URL. Handles URL resolution against `apiUrl`.

```typescript
const content = await client.files.downloadByUrl(file.downloadUrl);
```

### upload(filename, content, options?)

Uploads a file to the manuscript.

```typescript
const result = await client.files.upload('output.html', htmlContent, {
  fileType: 'RENDERED',
  renderedBy: 'bot-markdown-renderer',
  mimetype: 'text/html',
});
// Returns: { id, filename, downloadUrl, size }
```

Options:
- `fileType` - `'SOURCE'`, `'ASSET'`, `'RENDERED'`, `'SUPPLEMENTARY'`, `'BIBLIOGRAPHY'`
- `renderedBy` - Bot ID that created the file
- `mimetype` - MIME type of the content

## client.users

### get(userId)

Fetches a user by ID.

```typescript
const user = await client.users.get('user-uuid');
// Returns: UserData { id, name, email, role, ... }
```

### search(query)

Searches users by name.

```typescript
const users = await client.users.search('Smith');
// Returns: UserData[]
```

## client.reviewers

### list()

Lists reviewer assignments for the manuscript.

```typescript
const assignments = await client.reviewers.list();
// Returns: ReviewerAssignment[]
```

### assign(reviewerId, options?)

Creates a reviewer assignment.

```typescript
const result = await client.reviewers.assign('user-uuid', {
  status: 'PENDING',
  dueDate: '2024-03-15',
});
```

## client.storage

A key-value store scoped to `(botId, manuscriptId)`. Useful for persisting state between invocations.

### get(key)

Retrieves a value by key. Returns `null` if the key doesn't exist.

```typescript
const hash = await client.storage.get<string>('file-hash');
```

### set(key, value)

Sets a value for the given key (creates or updates).

```typescript
await client.storage.set('file-hash', 'sha256:abc123');
await client.storage.set('analysis', { score: 0.95, checked: true });
```

### delete(key)

Removes a key-value pair.

```typescript
await client.storage.delete('file-hash');
```

### list()

Lists all keys for the current bot and manuscript.

```typescript
const entries = await client.storage.list();
// Returns: Array<{ key: string; updatedAt: string }>
```

## client.manuscripts (continued)

### getWorkflow()

Fetches the current workflow state for the manuscript.

```typescript
const workflow = await client.manuscripts.getWorkflow();
// Returns: WorkflowState { phase, round, status, releasedAt, reviewAssignments, actionEditor }
```

### updateMetadata(data)

Updates manuscript metadata fields. Requires `update_metadata` permission.

```typescript
const updated = await client.manuscripts.updateMetadata({
  title: 'Updated Title',
  keywords: ['machine-learning', 'nlp'],
});
```

Allowed fields: `title`, `abstract`, `keywords`, `subjects`.

## client.conversations

### getMessages(conversationId, options?)

Reads messages from a conversation. Supports cursor-based pagination.

```typescript
const { messages, hasMore } = await client.conversations.getMessages('conv-uuid');
const page2 = await client.conversations.getMessages('conv-uuid', {
  limit: 20,
  before: messages[0].id,
});
```

### postMessage(conversationId, content, options?)

Posts a message to a conversation. The message is attributed to the bot.

```typescript
const msg = await client.conversations.postMessage('conv-uuid', 'Analysis complete.');
const reply = await client.conversations.postMessage('conv-uuid', 'Reply text', {
  parentId: 'msg-uuid',
  privacy: 'EDITOR_ONLY',
});
```

### listConversations()

Lists conversations for the manuscript.

```typescript
const convos = await client.conversations.listConversations();
// Returns: Array<{ id, title, type }>
```

## client.bots

### invoke(botId, command, parameters?)

Invokes another bot's command synchronously. Requires `invoke_bots` permission.

```typescript
const result = await client.bots.invoke('bot-reference-check', 'check', {
  format: 'detailed',
});
// Returns: BotInvocationResponse { messages, actions, errors }
```

The invoking bot decides what to do with the result — no messages are automatically posted to conversations.

## Error Handling

Failed API calls throw `BotApiError`:

```typescript
import { BotApiError } from '@colloquium/bot-sdk';

try {
  const files = await client.files.list();
} catch (error) {
  if (error instanceof BotApiError) {
    console.error(`API error: ${error.status} ${error.statusText}`);
    console.error(`Response: ${error.body}`);
  }
}
```

## Types

The SDK exports these types:

- `BotClient` - The client object returned by `createBotClient`
- `BotClientContext` - Input to `createBotClient`
- `ManuscriptData` - Manuscript metadata shape
- `FileData` - File metadata shape
- `UserData` - User data shape
- `ReviewerAssignment` - Reviewer assignment shape
- `WorkflowState` - Workflow state shape
- `MetadataUpdate` - Metadata update input shape
- `ConversationClient` - Conversation client interface
- `ConversationMessage` - Message shape from conversation endpoints
- `ConversationInfo` - Conversation summary shape
- `BotInvocationClient` - Bot invocation client interface
- `BotInvocationResponse` - Response from bot invocation
- `StorageClient` - Storage client interface
- `BotApiError` - Error class for failed requests
