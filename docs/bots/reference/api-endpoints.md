# Bot API Endpoints

HTTP endpoints available to bots via `x-bot-token` authentication.

## Manuscripts

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| `GET` | `/api/articles/:id` | `read_manuscript` | Get manuscript metadata, authors, status |
| `GET` | `/api/articles/:id/workflow` | `manage_workflow` | Get workflow state (phase, round, assignments) |
| `PATCH` | `/api/articles/:id/metadata` | `update_metadata` | Update manuscript title, abstract, keywords |

## Files

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| `GET` | `/api/articles/:id/files` | `read_manuscript_files` | List manuscript files |
| `GET` | `/api/articles/:id/files/:fileId/download` | `read_manuscript_files` | Download file content |
| `POST` | `/api/articles/:id/files` | `upload_files` | Upload files (multipart/form-data) |

### File Upload Body

```
Content-Type: multipart/form-data

files: <file blob>
fileType: SOURCE | ASSET | RENDERED | SUPPLEMENTARY | BIBLIOGRAPHY
renderedBy: <bot-id>  (for RENDERED files)
```

## Users

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| `GET` | `/api/users/:id` | `read_manuscript` | Get user by ID |
| `GET` | `/api/users?search=query` | `read_manuscript` | Search users by name |

## Reviewers

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| `GET` | `/api/reviewers/assignments/:manuscriptId` | `manage_reviewers` | List reviewer assignments |
| `POST` | `/api/articles/:id/reviewers` | `manage_reviewers` | Create reviewer assignment |

### Create Reviewer Assignment Body

```json
{
  "reviewerId": "user-uuid",
  "status": "PENDING",
  "dueDate": "2024-03-15"
}
```

## Storage

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| `GET` | `/api/bot-storage/:key` | `bot_storage` | Get a stored value |
| `PUT` | `/api/bot-storage/:key` | `bot_storage` | Set a stored value |
| `DELETE` | `/api/bot-storage/:key` | `bot_storage` | Delete a stored value |
| `GET` | `/api/bot-storage` | `bot_storage` | List all stored keys |

Storage is scoped to (botId, manuscriptId). The bot ID and manuscript ID are derived from the service token.

### Set Storage Body

```json
{
  "value": { "any": "json-serializable data" }
}
```

## Conversations

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| `GET` | `/api/conversations` | `read_conversations` | List conversations for a manuscript |
| `GET` | `/api/conversations/:id/messages` | `read_conversations` | Get messages in a conversation |
| `POST` | `/api/conversations/:id/messages` | `write_messages` | Post a message to a conversation |

### Post Message Body

```json
{
  "content": "Message text (markdown supported)",
  "parentId": "optional-parent-message-id",
  "privacy": "PUBLIC"
}
```

### Get Messages Query Parameters

| Param | Type | Description |
|-------|------|-------------|
| `limit` | `number` | Max messages to return (default 50) |
| `before` | `string` | Cursor for pagination (message ID) |

## Bot Invocation

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| `POST` | `/api/bots/invoke` | `invoke_bots` | Invoke another bot's command |

### Invoke Bot Body

```json
{
  "botId": "bot-reference-check",
  "command": "check",
  "parameters": { "detailed": true }
}
```

## Authentication

All requests must include:

```
x-bot-token: <service-token>
```

The service token is available at `context.serviceToken` in bot command handlers.

## Error Responses

```json
{
  "error": {
    "message": "Description of the error",
    "type": "NOT_FOUND"
  }
}
```

Common status codes:
- `401` - Missing or invalid bot token
- `403` - Insufficient permissions
- `404` - Resource not found
- `422` - Validation error
