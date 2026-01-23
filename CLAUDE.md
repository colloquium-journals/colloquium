# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

"Colloquium" - Open-source scientific journal publishing platform with conversational review processes and extensible bot ecosystem.

**Stack**: Next.js 14, Express.js, TypeScript, Prisma ORM, PostgreSQL, Magic link auth, Mantine UI

**Roadmap**: See [plans/TODO.md](plans/TODO.md) for the high-level feature roadmap and links to detailed plans.

## Architecture

```
apps/
├── web/                    # Next.js 14 frontend (port 3000)
├── api/                    # Express.js backend (port 4000)
packages/
├── database/               # Prisma schema and client
├── bots/                   # Bot framework core
├── types/                  # Shared TypeScript types and Zod schemas
├── auth/                   # Authentication utilities
├── ui/                     # Shared React components
├── config/                 # Shared ESLint config
├── editorial-bot/          # Editorial workflow bot
├── markdown-renderer-bot/  # Markdown to HTML rendering
├── reference-bot/          # Reference/citation processing
├── reviewer-checklist-bot/ # Reviewer checklist automation
├── create-colloquium-bot/  # npx template for new bots
└── create-colloquium-journal/ # npx template for new journals
```

Uses Turborepo for monorepo orchestration with npm workspaces.

## Development Commands

```bash
# Start all services (frontend, API, required Docker containers)
npm run dev

# Run all tests across workspaces
npm run test

# Run tests for a specific workspace
cd apps/api && npm test
cd apps/web && npm test

# Run a single test file
cd apps/api && npx jest tests/routes/articles.test.ts
cd apps/web && npx jest src/components/__tests__/Button.test.tsx

# Run tests matching a pattern
cd apps/api && npx jest --testNamePattern="should create manuscript"

# Watch mode for tests
cd apps/api && npm run test:watch

# Linting and type checking
npm run lint
npm run type-check

# Database operations
npm run db:migrate          # Run Prisma migrations
npm run db:seed             # Seed with sample data
npm run db:studio           # Open Prisma Studio (port 5555)
npm run db:reset            # Reset database (interactive)
npm run db:reset-quick      # Reset database (no confirmation)
npm run db:clear            # Clear database without seeding

# Docker services
npm run docker:up           # Start postgres, redis, mailhog

# Build
npm run build               # Build all packages and apps
```

## Key Systems

### File Storage & Management
- **Storage Structure**: Manuscript-specific folders at `apps/api/uploads/manuscripts/{manuscriptId}/`
- **File Organization**: Original filenames preserved with conflict resolution (e.g., `file(1).pdf`)
- **File Types**: SOURCE (main manuscript), ASSET (images/data), RENDERED (bot outputs), BIBLIOGRAPHY
- **Database**: `manuscript_files` table tracks `path`, `originalName`, `filename`, `fileType`, `mimetype`
- **Endpoints**: 
  - `POST /api/articles/` (manuscript submission)
  - `POST /api/articles/:id/files` (additional files)
  - `GET /api/articles/:id/files` (list files)
  - `GET /api/articles/:id/files/:fileId/download` (download with auth)
- **Bot Integration**: Bots download files via authenticated API calls using `x-bot-token` header

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

## Environment Setup

Required environment variables (see `.env.example`):
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection for job queues
- `JWT_SECRET` / `MAGIC_LINK_SECRET` - Auth secrets
- `FRONTEND_URL` / `API_URL` - App URLs (localhost:3000 / localhost:4000)

Development services:
- **MailHog**: http://localhost:8025 (email testing)
- **Prisma Studio**: http://localhost:5555 (database UI)

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

## Static Asset Hosting for Published Content

Dual-tier asset hosting for performance and security:

```
Draft/Review:    /api/articles/{id}/files/{fileId}/download  (authenticated)
Published:       /static/published/{id}/{filename}           (static, public)
```

**Workflow**: When manuscript status → PUBLISHED:
1. ASSET files copied to `/static/published/{manuscriptId}/`
2. RENDERED HTML updated with static URLs
3. Express serves with long-term caching

**Key Files**:
- `apps/api/src/services/publishedAssetManager.ts`
- `apps/api/src/services/botActionProcessor.ts` (publication hooks)

**Migration**: `npm run migrate-published-assets` (for existing published content)

## Security Notes

- **Bot Authentication**: Bots authenticate to API with `X-Bot-Token` header
- **User Roles**: ADMIN, EDITOR_IN_CHIEF, ACTION_EDITOR, USER, BOT (see `GlobalRole` enum)
- **Message Privacy**: PUBLIC, AUTHOR_VISIBLE, REVIEWER_ONLY, EDITOR_ONLY, ADMIN_ONLY