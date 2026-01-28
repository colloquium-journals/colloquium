# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

"Colloquium" - Open-source scientific journal publishing platform with conversational review processes and extensible bot ecosystem.

**Stack**: Next.js 14, Express.js, TypeScript, Prisma ORM, PostgreSQL, Magic link auth, Mantine UI

**Roadmap**: See [plans/TODO.md](plans/TODO.md) for the high-level feature roadmap and links to detailed plans.

## Development Stage

This project is in **early active development**. There are no production deployments yet.

- **No backwards compatibility requirements**: Breaking changes to APIs, database schemas, and interfaces are acceptable
- **Prefer clean solutions**: Don't add migration shims, deprecation warnings, or compatibility layers—just make the change directly
- **Database resets are fine**: Schema changes can use `db:reset` rather than incremental migrations during this phase
- **Refactoring encouraged**: If a better approach emerges, refactor aggressively rather than working around existing patterns

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
├── bot-editorial/          # Editorial workflow bot
├── bot-markdown-renderer/  # Markdown to HTML rendering
├── bot-reference/          # Reference/citation processing
├── bot-reviewer-checklist/ # Reviewer checklist automation
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
npm run docker:up           # Start postgres, mailhog

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
**Architecture**: Asynchronous job queues with graphile-worker (PostgreSQL-based) for non-blocking UX

**Key Files**:
- `/apps/api/src/jobs/index.ts` - Queue initialization with `addBotJob()`
- `/apps/api/src/jobs/worker.ts` - 3 concurrent job processors using graphile-worker
- `/apps/api/src/jobs/botProcessor.ts` - Bot execution and response handling
- `/apps/api/src/routes/conversations.ts` - Message creation with async bot queuing

**Workflow**: User posts → Bot detection → Queue job → Worker processes → SSE broadcast responses

**Dependencies**: `graphile-worker` (uses PostgreSQL LISTEN/NOTIFY for efficient job coordination)

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
- **Bot mentions**: `@bot-<name> command` triggers async processing (all bot IDs must start with `bot-` prefix)
- **Real-time**: Server-Sent Events for live updates

### Workflow System
Configurable review workflows support different peer review models. See [docs/development/workflow.md](docs/development/workflow.md) for full documentation.

**Phases**: REVIEW → DELIBERATION → RELEASED → AUTHOR_RESPONDING

**Key Components**:
- **Database**: `workflowPhase`, `workflowRound` on manuscripts; `workflow_releases` table
- **Visibility Service**: `apps/api/src/services/workflowVisibility.ts` - controls who sees what
- **Participation Service**: `apps/api/src/services/workflowParticipation.ts` - controls who can post
- **Templates**: `packages/types/src/workflowTemplates.ts` - predefined workflow configs

**Templates Available**:
- `traditional-blind`: Double-blind with release phases
- `single-blind`: Reviewers see authors, authors don't see reviewers
- `open-continuous`: Fully transparent, real-time visibility
- `progressive-disclosure`: Reviewers collaborate after all submit
- `open-gated`: Open but authors need invitation to respond

**Editorial Bot Commands**:
- `@bot-editorial release decision="revise"` - Release reviews to authors
- `@bot-editorial begin-deliberation` - Start reviewer deliberation phase
- `@bot-editorial request-revision deadline="2024-03-15"` - Request author revisions
- `@bot-editorial send-reminder @reviewer` - Send manual deadline reminder to reviewer

### Deadline Reminders
Automated reminder system for review deadlines.

**Architecture**: Daily scanner (cron at 8 AM) + scheduled jobs via graphile-worker

**Key Components**:
- **Database**: `deadline_reminders` table tracks `assignmentId`, `daysBefore`, `status`, `scheduledFor`
- **Scanner**: `apps/api/src/services/deadlineScanner.ts` - finds deadlines, schedules reminder jobs
- **Processor**: `apps/api/src/services/deadlineReminderProcessor.ts` - sends emails, posts to conversations
- **Email Templates**: `apps/api/src/templates/reminderEmails.ts` - automated and manual reminder templates

**Configuration** (via Admin UI → Settings → Reminders):
- Master enable/disable toggle
- Configurable reminder intervals (e.g., 7, 3, 1 days before)
- Per-interval email/conversation toggle
- Overdue reminder settings (interval days, max count)

**Manual Reminders**:
- `@bot-editorial send-reminder @reviewer` - Send immediate reminder
- `@bot-editorial send-reminder @reviewer message="Please prioritize"` - With custom message

### Bot Naming Convention
- **Bot IDs**: All bots use the `bot-` prefix (e.g., `bot-editorial`, `bot-reference`, `bot-reviewer-checklist`)
- **Package folders**: Use `bot-` prefix (e.g., `bot-editorial/`, `bot-reference/`) - package names match bot IDs
- **Reserved prefix**: The `bot-` username prefix is reserved for system bots - non-bot accounts cannot use usernames starting with `bot-`

## Environment Setup

Required environment variables (see `.env.example`):
- `DATABASE_URL` - PostgreSQL connection string
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