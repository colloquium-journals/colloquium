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