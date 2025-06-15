# Colloquium Scripts

This directory contains utility scripts for managing the Colloquium development environment.

## Setup Scripts

- **`dev-setup.sh`** - Initial development environment setup
  - Installs dependencies
  - Sets up Docker services
  - Runs database migrations and seeding
  - Comprehensive first-time setup

- **`start-docker.sh`** - Start Docker services only
- **`check-env.sh`** - Verify environment configuration

## Reset Scripts

These scripts help reset the application to a clean state for testing without needing to restart the entire development environment.

### `reset-app.sh` - Complete Application Reset

Resets the entire application state including Docker services.

```bash
# Full reset with confirmation
./scripts/reset-app.sh

# Full reset without confirmation
./scripts/reset-app.sh --force

# Quick reset (database only, no Docker restart)
./scripts/reset-app.sh --quick --force

# Reset without reseeding data
./scripts/reset-app.sh --no-seed

# Available from project root
npm run app:reset
npm run app:reset-quick
```

**Options:**
- `--force` - Skip confirmation prompt
- `--quick` - Skip Docker service restart (database only)
- `--no-seed` - Clear database without reseeding sample data
- `--no-docker` - Skip Docker operations entirely
- `--help` - Show usage information

### `reset-db.sh` - Quick Database Reset

Fast database-only reset without Docker restarts.

```bash
# Reset and seed database
./scripts/reset-db.sh

# Reset without confirmation
./scripts/reset-db.sh --force

# Clear database only (no sample data)
./scripts/reset-db.sh --no-seed --force

# Available from project root
npm run db:reset        # Reset with confirmation
npm run db:reset-quick  # Reset without confirmation
npm run db:clear        # Clear without seeding
```

**Options:**
- `--force` - Skip confirmation prompt
- `--no-seed` - Clear database without reseeding sample data
- `--help` - Show usage information

## When to Use Each Reset Script

### Use `reset-app.sh` when:
- Docker services are having issues
- You need a completely clean environment
- You're switching between different development branches
- You want to clear all caches and temporary files

### Use `reset-db.sh` when:
- You just need fresh database data
- You're testing database schema changes
- You want to quickly get back to a known state
- Docker services are already running properly

## Sample Data

When scripts are run with seeding enabled (default), the following test accounts are created:

- **admin@colloquium.example.com** - Admin user with full access
- **editor@colloquium.example.com** - Editor user for manuscript management
- **author@colloquium.example.com** - Author user for submissions
- **reviewer@colloquium.example.com** - Reviewer user for peer review

The database is also seeded with:
- Sample manuscripts (published and under review)
- Sample conversations and messages
- Bot definitions and installations
- Journal settings

## Examples

```bash
# Quick development reset (most common use case)
npm run db:reset-quick

# Test with empty database
npm run db:clear

# Full environment reset after pulling new changes
npm run app:reset

# Reset everything without waiting for confirmation
./scripts/reset-app.sh --force
```

All scripts include colored output and progress indicators to show what's happening during the reset process.