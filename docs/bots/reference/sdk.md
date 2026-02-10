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
- `BotApiError` - Error class for failed requests
