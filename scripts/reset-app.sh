#!/bin/bash

# Colloquium Application Reset Script
# This script resets the application to its default state for testing

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Get the project root (one level up from scripts/)
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo -e "${BLUE}🔄 Colloquium Application Reset${NC}"
echo -e "${BLUE}📁 Project root: $PROJECT_ROOT${NC}"
echo ""

# Parse command line arguments
SKIP_SEED=false
SKIP_DOCKER=false
QUICK_MODE=false
FORCE=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --no-seed)
      SKIP_SEED=true
      shift
      ;;
    --no-docker)
      SKIP_DOCKER=true
      shift
      ;;
    --quick)
      QUICK_MODE=true
      shift
      ;;
    --force)
      FORCE=true
      shift
      ;;
    -h|--help)
      echo "Usage: $0 [OPTIONS]"
      echo ""
      echo "Reset the Colloquium application to its default state."
      echo ""
      echo "OPTIONS:"
      echo "  --no-seed     Skip database seeding (just reset to empty state)"
      echo "  --no-docker   Skip Docker service restart"
      echo "  --quick       Quick reset (database only, no Docker restart)"
      echo "  --force       Skip confirmation prompt"
      echo "  -h, --help    Show this help message"
      echo ""
      echo "Examples:"
      echo "  $0                    # Full reset with confirmation"
      echo "  $0 --force           # Full reset without confirmation"
      echo "  $0 --quick --force   # Quick database reset only"
      echo "  $0 --no-seed         # Reset database to empty state"
      echo ""
      exit 0
      ;;
    *)
      echo -e "${RED}❌ Unknown option: $1${NC}"
      echo "Use --help for usage information"
      exit 1
      ;;
  esac
done

# Set quick mode defaults
if [ "$QUICK_MODE" = true ]; then
  SKIP_DOCKER=true
fi

# Warning and confirmation
if [ "$FORCE" != true ]; then
  echo -e "${YELLOW}⚠️  Warning: This will completely reset the application state!${NC}"
  echo ""
  echo "This will:"
  echo "  • Clear all database data (users, manuscripts, conversations, etc.)"
  if [ "$SKIP_SEED" != true ]; then
    echo "  • Restore sample data (test users, manuscripts, conversations)"
  fi
  if [ "$SKIP_DOCKER" != true ]; then
    echo "  • Restart Docker services (PostgreSQL, Redis, MailHog)"
  fi
  echo "  • Clear any cached data"
  echo ""
  read -p "Are you sure you want to continue? (y/N): " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}❌ Reset cancelled${NC}"
    exit 0
  fi
  echo ""
fi

# Change to project root
cd "$PROJECT_ROOT"

# Function to check if Docker is running
check_docker() {
  if ! docker info &> /dev/null; then
    echo -e "${RED}❌ Docker is not running. Please start Docker first.${NC}"
    echo ""
    echo "Start Docker and try again:"
    echo "  macOS: open -a Docker"
    echo "  Linux: sudo systemctl start docker"
    echo ""
    exit 1
  fi
}

# Function to wait for PostgreSQL
wait_for_postgres() {
  echo -e "${BLUE}⏳ Waiting for PostgreSQL to be ready...${NC}"
  
  # Try to connect for up to 30 seconds
  for i in {1..30}; do
    if docker exec colloquium-postgres pg_isready -U postgres &> /dev/null; then
      echo -e "${GREEN}✅ PostgreSQL is ready${NC}"
      return 0
    fi
    echo -n "."
    sleep 1
  done
  
  echo -e "${RED}❌ PostgreSQL failed to start within 30 seconds${NC}"
  exit 1
}

# Function to reset database
reset_database() {
  echo -e "${BLUE}🗃️  Resetting database...${NC}"
  
  # Set DATABASE_URL for this session
  export DATABASE_URL="postgresql://postgres:password@localhost:5432/colloquium_dev"
  
  # Reset database using Prisma
  cd "$PROJECT_ROOT/packages/database"
  
  if [ "$SKIP_SEED" = true ]; then
    echo -e "${YELLOW}🔥 Clearing database (no seed)...${NC}"
    npx prisma migrate reset --force --skip-seed
  else
    echo -e "${YELLOW}🔥 Clearing and seeding database...${NC}"
    npx prisma migrate reset --force
  fi
  
  cd "$PROJECT_ROOT"
  echo -e "${GREEN}✅ Database reset complete${NC}"
}

# Function to restart Docker services
restart_docker_services() {
  if [ "$SKIP_DOCKER" = true ]; then
    echo -e "${YELLOW}⏭️  Skipping Docker service restart${NC}"
    return 0
  fi
  
  echo -e "${BLUE}🐳 Restarting Docker services...${NC}"
  
  cd "$PROJECT_ROOT/docker"
  
  # Stop services
  echo -e "${YELLOW}🛑 Stopping services...${NC}"
  docker-compose down
  
  # Start services
  echo -e "${YELLOW}🚀 Starting services...${NC}"
  docker-compose up -d postgres redis mailhog
  
  cd "$PROJECT_ROOT"
  echo -e "${GREEN}✅ Docker services restarted${NC}"
}

# Function to clear application caches
clear_caches() {
  echo -e "${BLUE}🧹 Clearing application caches...${NC}"
  
  # Clear Next.js cache
  if [ -d "apps/web/.next" ]; then
    echo -e "${YELLOW}  • Clearing Next.js cache...${NC}"
    rm -rf apps/web/.next
  fi
  
  # Clear any log files
  if [ -d "logs" ]; then
    echo -e "${YELLOW}  • Clearing log files...${NC}"
    rm -rf logs/*
  fi
  
  # Clear uploaded files (if they exist)
  if [ -d "uploads" ]; then
    echo -e "${YELLOW}  • Clearing uploaded files...${NC}"
    rm -rf uploads/*
  fi
  
  # Clear any temporary files
  find . -name "*.tmp" -type f -delete 2>/dev/null || true
  find . -name ".DS_Store" -type f -delete 2>/dev/null || true
  
  echo -e "${GREEN}✅ Caches cleared${NC}"
}

# Function to show final status
show_status() {
  echo ""
  echo -e "${GREEN}✅ Application reset complete!${NC}"
  echo ""
  echo -e "${BLUE}🌐 Services available at:${NC}"
  echo "  • Frontend: http://localhost:3000"
  echo "  • API: http://localhost:4000"
  echo "  • Database: postgresql://postgres:password@localhost:5432/colloquium_dev"
  echo "  • Redis: redis://localhost:6379"
  echo "  • MailHog (Email testing): http://localhost:8025"
  echo ""
  
  if [ "$SKIP_SEED" != true ]; then
    echo -e "${BLUE}👥 Test accounts available:${NC}"
    echo "  • admin@colloquium.example.com (Admin)"
    echo "  • editor@colloquium.example.com (Editor)"
    echo "  • author@colloquium.example.com (Author)"
    echo "  • reviewer@colloquium.example.com (Reviewer)"
    echo ""
    echo -e "${YELLOW}💡 Use magic link authentication to sign in${NC}"
    echo ""
  fi
  
  echo "To start development:"
  echo "  npm run dev"
  echo ""
}

# Main execution flow
echo -e "${BLUE}🔄 Starting application reset...${NC}"
echo ""

# Check Docker if we're going to use it
if [ "$SKIP_DOCKER" != true ]; then
  check_docker
fi

# Step 1: Clear caches
clear_caches

# Step 2: Restart Docker services
restart_docker_services

# Step 3: Wait for PostgreSQL if we restarted Docker
if [ "$SKIP_DOCKER" != true ]; then
  wait_for_postgres
fi

# Step 4: Reset database
reset_database

# Step 5: Show final status
show_status

echo -e "${GREEN}🎉 Reset completed successfully!${NC}"