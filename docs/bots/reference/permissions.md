# Bot Permissions Reference

## BotPermission (Bot Declaration)

These are the permissions a bot declares in its `permissions` array:

| Permission | Description |
|---|---|
| `read_manuscript` | Read manuscript metadata |
| `read_files` | Read and download manuscript files |
| `read_conversations` | Read conversation messages |
| `write_messages` | Post messages to conversations |
| `update_manuscript` | Update manuscript metadata and workflow |
| `assign_reviewers` | Create and manage reviewer assignments |
| `make_editorial_decision` | Make editorial decisions and manage workflow |

## BotApiPermission (API Enforcement)

These are the API-level permissions enforced at each endpoint:

| Permission | Endpoints |
|---|---|
| `read_manuscript` | `GET /api/articles/:id`, `GET /api/articles/:id/workflow`, `GET /api/articles/:id/reviewers/:reviewerId` |
| `read_manuscript_files` | `GET /api/articles/:id/files`, `GET /api/articles/:id/files/:fileId/download` |
| `upload_files` | `POST /api/articles/:id/files` |
| `read_conversations` | `GET /api/conversations/:id/messages` |
| `write_messages` | `POST /api/conversations/:id/messages` |
| `update_metadata` | `PATCH /api/articles/:id/metadata` |
| `manage_reviewers` | `POST /api/articles/:id/reviewers`, `PUT /api/articles/:id/reviewers/:reviewerId` |
| `manage_workflow` | Reserved for workflow management operations |
| `bot_storage` | `GET/PUT/DELETE /api/bot-storage/*` |
| `invoke_bots` | `POST /api/bots/invoke` |

## Permission Mapping

When a bot is invoked, its declared `BotPermission` values are mapped to `BotApiPermission` values:

| BotPermission | BotApiPermission(s) |
|---|---|
| `read_manuscript` | `read_manuscript` |
| `read_files` | `read_manuscript_files` |
| `read_conversations` | `read_conversations` |
| `write_messages` | `write_messages` |
| `update_manuscript` | `update_metadata`, `manage_workflow` |
| `assign_reviewers` | `manage_reviewers` |
| `make_editorial_decision` | `manage_workflow` |

## Baseline Permissions

All bots always receive these permissions regardless of their declarations:

- `read_manuscript`
- `read_manuscript_files`
- `bot_storage`

## Non-Bot Requests

The `requireBotPermission` middleware passes through for non-bot requests (when `req.botContext` is not set). This allows endpoints to serve both users and bots with the same middleware chain — user authorization is handled separately.
