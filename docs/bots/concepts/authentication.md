# Authentication and Security

## Service Tokens

Bots authenticate API requests using service tokens, not user credentials.

1. When a bot job is processed, `generateBotServiceToken()` creates a JWT
2. The token is scoped to a specific manuscript and permission set
3. It's passed to the bot via `context.serviceToken`
4. The SDK automatically includes it in all API requests

## Using the Token

With the SDK (recommended):
```typescript
const client = createBotClient(context);
// Token is automatically included in all requests
const files = await client.files.list();
```

Manual usage (if needed):
```typescript
const response = await fetch(`${apiUrl}/api/articles/${id}/files`, {
  headers: { 'x-bot-token': context.serviceToken }
});
```

## Permission Model

Bots declare required permissions in their manifest:

```json
{
  "colloquium": {
    "permissions": ["read_manuscript", "read_manuscript_files", "upload_files"]
  }
}
```

Available permissions:
- `read_manuscript` - Read manuscript metadata
- `read_files` / `read_manuscript_files` - Access manuscript files
- `read_conversations` - Read conversation messages
- `write_messages` - Post messages to conversations
- `update_manuscript` - Change manuscript status
- `assign_reviewers` - Manage reviewer assignments
- `make_editorial_decision` - Accept/reject manuscripts
- `upload_files` - Upload files to manuscripts
- `access_external_apis` - Call external services (DOI lookup, etc.)

## Manuscript Scoping

Service tokens are scoped to a specific manuscript ID. A bot processing manuscript A cannot access files from manuscript B.

## Data Access Rules

All bots **must** use API endpoints for data access, not direct database queries. This ensures:
- Permission checks are enforced
- Audit logging captures all access
- Data transformations are consistent
- Security boundaries are maintained
