# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Project Overview

"Colloquium" - Open-source scientific journal publishing platform with conversational review processes and extensible bot ecosystem.

**Stack**: Next.js 15, Express.js, TypeScript, Prisma ORM, PostgreSQL, Magic link auth, Mantine UI

## Architecture

```
apps/
├── web/          # Next.js frontend  
├── api/          # Express.js backend
packages/
├── database/     # Prisma schema
├── bots/         # Bot framework
└── [others]/     # Shared packages
```

## Development Commands

- `npm run dev` - Start development servers
- `npm run test` - Run tests
- `npm run lint` - Run linting

## Key Systems

### File Storage
- **Location**: `apps/api/uploads/manuscripts/` and `apps/api/uploads/bot-config/`
- **Endpoints**: `POST /api/articles/` (manuscript submission), `POST /api/articles/:id/files` (additional files), `POST /api/bot-config-files/:botId/files`
- **Database**: `ManuscriptFile` table with security, metadata, access control
- **Download**: `/api/articles/{id}/files/{fileId}/download`

### Bot Processing System
**Architecture**: Asynchronous job queues with Redis/Bull for non-blocking UX

**Key Files**:
- `/apps/api/src/jobs/index.ts` - Queue initialization with `getBotQueue()`
- `/apps/api/src/jobs/worker.ts` - 3 concurrent job processors
- `/apps/api/src/jobs/botProcessor.ts` - Bot execution and response handling
- `/apps/api/src/routes/conversations.ts` - Message creation with async bot queuing

**Workflow**: User posts → Bot detection → Queue job → Worker processes → SSE broadcast responses

**Config**:
```bash
REDIS_HOST=localhost
REDIS_PORT=6379
```

**Dependencies**: `bull`, `ioredis`

**⚠️ Bot Data Access**: All bots MUST use API endpoints (not direct database queries) for consistency and security. See [Bot Framework Documentation](docs/development/bots.md#data-access-patterns) for required patterns.

### Assignment System
**Editor Assignments**:
- **Database**: `action_editors` table with `editorId`, `manuscriptId`, `assignedAt`
- **API**: Available via `/api/articles/:id` endpoint in `action_editors` field
- **Relation**: Links to `users` table via `users_action_editors_editorIdTousers`

**Reviewer Assignments**:
- **Database**: `review_assignments` table with `reviewerId`, `manuscriptId`, `status`, `assignedAt`, `dueDate`
- **API**: Available via `/api/articles/:id` endpoint in `reviewAssignments` field
- **Statuses**: INVITED, ACCEPTED, DECLINED, IN_PROGRESS, COMPLETED
- **Filtering**: Only ACCEPTED, IN_PROGRESS, COMPLETED assignments shown in UI

### Conversation System
- **Privacy levels**: PUBLIC, AUTHOR_VISIBLE, REVIEWER_ONLY, EDITOR_ONLY, ADMIN_ONLY
- **Bot mentions**: `@bot-name command` triggers async processing
- **Real-time**: Server-Sent Events for live updates

## Code Style

- TypeScript throughout
- Zod for validation
- Academic naming conventions
- Comprehensive error handling
- No code comments unless necessary

## Test Structure

### Organization Patterns

**Frontend (Web App)**:
- Tests adjacent to source files in `__tests__/` directories
- Example: `/apps/web/src/components/conversations/__tests__/`
- Pattern: `src/[module]/__tests__/[component].test.tsx`

**Backend (API)**:
- Tests in dedicated `/tests/` directory with organized subdirectories
- **Integration tests**: `/apps/api/tests/integration/`
- **Route tests**: `/apps/api/tests/routes/`
- **Service tests**: `/apps/api/tests/services/`
- **Schema tests**: `/apps/api/tests/schemas/`
- **Middleware tests**: `/apps/api/tests/middleware/`

**Packages**:
- Tests in `src/__tests__/` directories
- Example: `/packages/bots/src/framework/__tests__/`

### File Naming

- Use `.test.ts` or `.test.tsx` extensions exclusively
- Descriptive names: `validation-accept-reject.test.ts`, `botActionProcessor.test.ts`

### Test Setup

- **Setup files**: Each app/package has `tests/setup.ts` or `src/tests/setup.ts`
- **Test utilities**: Centralized in `/tests/utils/testUtils.ts` for API
- **Mocking**: Jest mocks for external dependencies (nodemailer, etc.)

## Security Notes

- **Bot Authentication**: 
  - Authenticate bots to API with X-Bot-Token header