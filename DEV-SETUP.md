# Colloquium Development Setup Guide

This guide will help you set up and run the Colloquium platform in development mode.

## Prerequisites

Before starting, ensure you have the following installed:

- **Node.js 18 or higher** with npm
- **Docker** and **Docker Compose**
- **Git**

### Verify Prerequisites

```bash
node --version    # Should be 18.x or higher
npm --version     # Should be 8.x or higher
docker --version  # Should be recent version
docker-compose --version
```

## Quick Start (Recommended)

### 1. Clone and Setup

```bash
# Clone the repository
git clone https://github.com/your-org/colloquium.git
cd colloquium

# Run the automated setup script
./scripts/dev-setup.sh
```

The setup script will:
- Install all dependencies
- Create environment configuration
- Start required services (PostgreSQL, Redis, MailHog)
- Run database migrations and seeding
- Build all shared packages

### 2. Start Development

```bash
# Start all development servers
npm run dev
```

### 3. Access the Application

Once running, you can access:

- **Frontend**: http://localhost:3000
- **API**: http://localhost:4000
- **API Health Check**: http://localhost:4000/health
- **Email Testing (MailHog)**: http://localhost:8025
- **Database Studio**: http://localhost:5555 (run `npm run db:studio` in another terminal)

## Manual Setup (Alternative)

If you prefer to set things up manually or the script doesn't work:

### 1. Install Dependencies

```bash
# Install all workspace dependencies
npm install
```

### 2. Environment Configuration

```bash
# Copy environment template
cp .env.example .env

# Edit the environment file (optional for development)
nano .env  # or your preferred editor
```

The default development settings should work out of the box, but you can customize:
- Database connection
- JWT secrets
- Email configuration
- File upload settings

### 3. Start Services

```bash
# Start required services with Docker
cd docker
docker-compose up -d postgres redis mailhog
cd ..

# Wait a moment for PostgreSQL to start up
sleep 10
```

### 4. Database Setup

```bash
# Generate Prisma client
cd packages/database
npx prisma generate
cd ../..

# Run migrations to create database schema
npm run db:migrate

# Seed the database with sample data
npm run db:seed
```

### 5. Build Packages

```bash
# Build all shared packages
npm run build --workspace=@colloquium/types
npm run build --workspace=@colloquium/auth
npm run build --workspace=@colloquium/database
npm run build --workspace=@colloquium/ui
npm run build --workspace=@colloquium/bots
```

### 6. Start Development Servers

```bash
# Start all development servers
npm run dev
```

This starts:
- Frontend (Next.js) on port 3000
- Backend API (Express.js) on port 4000

## Development Workflow

### Available Scripts

```bash
# Development
npm run dev              # Start all development servers
npm run dev --workspace=@colloquium/web   # Start only frontend
npm run dev --workspace=@colloquium/api   # Start only backend

# Building
npm run build            # Build all packages and applications
npm run build --workspace=@colloquium/web # Build only frontend

# Database
npm run db:migrate       # Run database migrations
npm run db:seed          # Seed database with sample data
npm run db:studio        # Open Prisma Studio (database GUI)
npm run db:reset         # Reset database (⚠️ deletes all data)

# Code Quality
npm run lint             # Run ESLint on all packages
npm run type-check       # Run TypeScript type checking
npm run test             # Run test suites

# Utilities
npm run clean            # Clean build artifacts
```

### Working with the Database

**View Database:**
```bash
npm run db:studio
```
Opens Prisma Studio at http://localhost:5555

**Reset Database:**
```bash
npm run db:reset
```
⚠️ This will delete all data and re-run migrations and seeding.

**Seed Database Only:**
```bash
npm run db:seed
```
This adds sample data without affecting the schema. Safe to run multiple times (idempotent).

**Create New Migration:**
```bash
cd packages/database
npx prisma migrate dev --name your-migration-name
```

### Sample Data

The database is seeded with sample data including:

- **Admin User**: admin@colloquium.example.com
- **Editor User**: editor@colloquium.example.com  
- **Author User**: author@colloquium.example.com
- **Reviewer User**: reviewer@colloquium.example.com
- **Sample Manuscript**: "A Novel Approach to Academic Publishing"
- **Sample Conversation**: Editorial review discussion
- **Core Bots**: Plagiarism checker, statistics reviewer, formatting checker

## Troubleshooting

### Common Issues

**Docker Not Running:**
```bash
# Check if Docker is running
docker info

# Option 1: Use our helper script (recommended)
./scripts/start-docker.sh

# Option 2: Start manually
# On macOS:
open -a Docker

# On Linux:
sudo systemctl start docker

# Wait for Docker to be ready, then retry
./scripts/dev-setup.sh
```

**Port Already in Use:**
```bash
# Check what's using the ports
lsof -i :3000  # Frontend
lsof -i :4000  # Backend
lsof -i :5432  # PostgreSQL

# Kill processes if needed
kill -9 <PID>
```

**Database Connection Issues:**
```bash
# Check if PostgreSQL is running
docker-compose -f docker/docker-compose.yml ps

# Restart PostgreSQL
cd docker
docker-compose restart postgres
```

**Package Build Errors:**
```bash
# Clean and rebuild
npm run clean
npm install
npm run build
```

**Mantine Package Issues:**
If you encounter issues with Mantine packages, ensure you're using compatible versions:
- `@mantine/core@^7.12.0` and related packages
- `@mantine/tiptap` instead of the deprecated `@mantine/rich-text-editor`

**Prisma Type Conflicts:**
If you see "Module has already exported a member" errors:
- This happens when Prisma-generated types conflict with custom types
- The database package uses selective re-exports to avoid conflicts
- Run `npx prisma generate` after schema changes

**Permission Issues with Setup Script:**
```bash
# Make script executable
chmod +x scripts/dev-setup.sh
```

### Logs and Debugging

**View Service Logs:**
```bash
# All services
cd docker
docker-compose logs -f

# Specific service
docker-compose logs -f postgres
docker-compose logs -f redis
```

**Application Logs:**
- Frontend logs appear in the terminal where `npm run dev` is running
- Backend logs appear in the same terminal
- Database queries are logged in development mode

### Reset Everything

If you need to start completely fresh:

```bash
# Stop all services
cd docker
docker-compose down -v

# Remove node modules and build artifacts
rm -rf node_modules
rm -rf apps/*/node_modules
rm -rf packages/*/node_modules
rm -rf apps/*/.next
rm -rf packages/*/dist

# Start over
npm install
./scripts/dev-setup.sh
```

## Development Tips

### Hot Reload
- Frontend: Automatically reloads on file changes
- Backend: Uses `tsx watch` for automatic TypeScript compilation and restart
- Shared packages: Use `npm run dev` in package directories for watch mode

### Adding New Dependencies

```bash
# Add to specific workspace
npm install <package> --workspace=@colloquium/web
npm install <package> --workspace=@colloquium/api

# Add to root (affects all workspaces)
npm install <package> -w
```

### Database Schema Changes

1. Modify `packages/database/prisma/schema.prisma`
2. Create migration: `cd packages/database && npx prisma migrate dev`
3. The Prisma client will be regenerated automatically

### Environment Variables

Development defaults are set in `.env.example`. For local development, you typically only need to change:

- `DATABASE_URL` - if using external database
- `SMTP_*` - if testing real email delivery
- `JWT_SECRET` - for production-like security testing

## Next Steps

Once your development environment is running:

1. **Explore the API**: Visit http://localhost:4000/health
2. **Check the Frontend**: Visit http://localhost:3000
3. **View Sample Data**: Use Prisma Studio at http://localhost:5555
4. **Test Email**: Send test emails via MailHog at http://localhost:8025
5. **Read the Code**: Start with `apps/web/src/app/page.tsx` and `apps/api/src/app.ts`

## Getting Help

- Check the main [README.md](README.md) for project overview
- Review the [CLAUDE.md](CLAUDE.md) file for development guidance
- Open an issue if you encounter problems with the setup process