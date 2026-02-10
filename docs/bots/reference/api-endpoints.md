# Bot API Endpoints

HTTP endpoints available to bots via `x-bot-token` authentication.

## Manuscripts

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/articles/:id` | Get manuscript metadata, authors, status |

## Files

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/articles/:id/files` | List manuscript files |
| `GET` | `/api/articles/:id/files/:fileId/download` | Download file content |
| `POST` | `/api/articles/:id/files` | Upload files (multipart/form-data) |

### File Upload Body

```
Content-Type: multipart/form-data

files: <file blob>
fileType: SOURCE | ASSET | RENDERED | SUPPLEMENTARY | BIBLIOGRAPHY
renderedBy: <bot-id>  (for RENDERED files)
```

## Users

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/users/:id` | Get user by ID |
| `GET` | `/api/users?search=query` | Search users by name |

## Reviewers

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/reviewers/assignments/:manuscriptId` | List reviewer assignments |
| `POST` | `/api/articles/:id/reviewers` | Create reviewer assignment |

### Create Reviewer Assignment Body

```json
{
  "reviewerId": "user-uuid",
  "status": "PENDING",
  "dueDate": "2024-03-15"
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
