# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is "Colloquium" - an open-source scientific journal publishing platform that democratizes academic publishing by providing technical infrastructure for academics to create and run their own journals. The platform is built around conversational review processes and an extensible bot ecosystem.

## Planned Architecture

### Core Technology Stack
- **Frontend**: Next.js 15 with TypeScript, Mantine UI components
- **Backend**: Express.js with TypeScript, Prisma ORM
- **Database**: PostgreSQL with event sourcing for conversations
- **Authentication**: Magic link-based system with JWT tokens
- **Bot Framework**: Plugin architecture for extensible functionality
- **Deployment**: Docker containers with self-hosting options

### Monorepo Structure (Planned)
```
apps/
├── web/          # Next.js frontend
├── api/          # Express.js backend
└── docs/         # Documentation site
packages/
├── database/     # Prisma schema and migrations
├── types/        # Shared TypeScript interfaces
├── ui/           # Shared React components
├── auth/         # Authentication utilities
├── bots/         # Bot framework 
├── editorial-bot/      # bot for editorial tasks
├── reference-bot/     # bot for reference checking
├── reviewer-checklist-bot/ # bot for generating reviewer checklists
└── config/       # Shared configuration
```

## Development Commands

Since this is a new project, establish these commands as you build:

- `npm run dev` - Start development servers (both frontend and backend)
- `npm run build` - Build all applications for production
- `npm run test` - Run test suites across all packages
- `npm run lint` - Run linting across all packages
- `npm run db:migrate` - Run database migrations
- `npm run db:seed` - Seed database with initial data

## Key Features to Implement

### 1. Conversational Review System
- Chat-based interface for all platform interactions
- Multiple conversation types: Private Editorial, Private Review, Semi-Public, Public Review
- Granular privacy controls and participant management
- Threaded discussions with @-mentions for users and bots

### 2. Bot Ecosystem
- **Review Bots**: Plagiarism detection, statistical analysis, formatting checks
- **Editorial Bots**: Reviewer assignment, deadline management, workflow automation
- **Publishing Bots**: LaTeX compilation, PDF generation, citation formatting
- **Integration Bots**: CrossRef submission, repository uploads, notifications

### 3. Manuscript Management
- Multi-format support (PDF, LaTeX, Word, Markdown)
- Version control with diff visualization
- Inline comments linking manuscript sections to conversations
- Automated metadata extraction

### 4. Editorial Workflow
- Bot-assisted initial screening and reviewer matching
- Automated deadline management and reminders
- Structured decision workflow with clear criteria
- Appeal handling process

## Implementation Priorities

### Phase 1: Core Infrastructure
1. Set up monorepo with Turborepo
2. Basic Next.js frontend with Mantine UI
3. Express.js API with core endpoints
4. Prisma database schema (single journal model initially)
5. Magic link authentication system
6. Basic conversation/message CRUD operations

### Phase 2: Editorial Workflow
1. Manuscript submission and management
2. User roles and permissions system
3. Conversation privacy controls
4. Email notification system
5. File upload and storage
6. Basic bot framework infrastructure

### Phase 3: Bot Ecosystem
1. Bot execution engine with sandboxing
2. Core bots (plagiarism checker, formatting validator)
3. Bot installation and configuration UI
4. Background job processing with Bull Queue
5. Bot marketplace foundation

### Phase 4: Production Ready
1. Production deployment configurations
2. Security hardening and performance optimization
3. Comprehensive testing and documentation
4. Self-hosting deployment guides

## Technical Considerations

- Use TypeScript throughout for type safety
- Implement role-based access control with conversation-level overrides
- Design for self-hosting with Docker containers
- Plan for scalability with microservices architecture
- Ensure bot security through isolated execution environments
- Support both self-hosted and managed hosting options

## File Storage System

### Current Implementation
- **Storage Type**: Local file system (with abstraction for future cloud storage)
- **Base Directory**: `apps/api/uploads/`
- **Configuration**: Environment variables in `.env`

### Storage Structure
```
uploads/
├── manuscripts/              # Submitted manuscript files and assets
│   ├── manuscript-{timestamp}-{random}.{ext}
│   └── ...
└── bot-config/              # Bot configuration and template files
    ├── template-{timestamp}-{random}.html
    └── config-{timestamp}-{random}.json
```

### File Upload Endpoints
- **Manuscript Upload**: `POST /api/articles` (up to 5 files, 50MB limit)
- **Additional Files**: `POST /api/manuscripts/:id/files`
- **Bot Config Files**: `POST /api/bot-config-files/:botId/files` (10MB limit)

### Database Schema
Files are tracked in the `ManuscriptFile` table with:
- Unique generated filenames for security
- Original filenames preserved
- File type classification (SOURCE, ASSET, RENDERED, SUPPLEMENTARY)
- SHA256 checksums for integrity
- Complete metadata and access control

### Environment Variables
```bash
UPLOAD_DIR="./uploads"
MAX_FILE_SIZE="50mb"
STORAGE_TYPE="LOCAL"                    # Future: S3, GCS, AZURE
BOT_CONFIG_UPLOAD_DIR="./uploads/bot-config"
```

### File Access
- **Download URLs**: `/api/manuscripts/{id}/files/{fileId}/download`
- **Static Serving**: Express static middleware serves `/uploads`
- **Security**: File type validation, size limits, access control

### Future Cloud Storage
The `FileStorageService` provides abstraction for:
- Amazon S3
- Google Cloud Storage
- Azure Blob Storage
- Easy migration from local to cloud storage

## Code Style Guidelines

- Follow academic naming conventions where appropriate
- Use Zod for runtime validation and type generation
- Implement comprehensive error handling
- Write tests for all critical functionality
- Document bot APIs thoroughly for third-party developers