#!/bin/bash

# Quick Database Reset Script
# This script provides a fast way to reset just the database without Docker restarts

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

echo -e "${BLUE}🗃️  Quick Database Reset${NC}"
echo ""

# Parse command line arguments
SKIP_SEED=false
FORCE=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --no-seed)
      SKIP_SEED=true
      shift
      ;;
    --force)
      FORCE=true
      shift
      ;;
    -h|--help)
      echo "Usage: $0 [OPTIONS]"
      echo ""
      echo "Quickly reset the database without restarting Docker services."
      echo ""
      echo "OPTIONS:"
      echo "  --no-seed     Skip database seeding (just reset to empty state)"
      echo "  --force       Skip confirmation prompt"
      echo "  -h, --help    Show this help message"
      echo ""
      echo "Examples:"
      echo "  $0            # Reset and seed database"
      echo "  $0 --force    # Reset without confirmation"
      echo "  $0 --no-seed  # Clear database only"
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

# Warning and confirmation
if [ "$FORCE" != true ]; then
  echo -e "${YELLOW}⚠️  This will clear all database data!${NC}"
  echo ""
  if [ "$SKIP_SEED" = true ]; then
    echo "Database will be reset to empty state (no sample data)."
  else
    echo "Database will be reset and reseeded with sample data."
  fi
  echo ""
  read -p "Continue? (y/N): " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}❌ Reset cancelled${NC}"
    exit 0
  fi
  echo ""
fi

# Change to project root
cd "$PROJECT_ROOT"

# Set DATABASE_URL for this session
export DATABASE_URL="postgresql://postgres:password@localhost:5432/colloquium_dev"

# Check if database is accessible
echo -e "${BLUE}🔍 Checking database connection...${NC}"
cd "$PROJECT_ROOT/packages/database"

if ! npx prisma db execute --stdin <<< "SELECT 1;" &> /dev/null; then
  echo -e "${RED}❌ Cannot connect to database.${NC}"
  echo ""
  echo "Make sure:"
  echo "  • Docker services are running (npm run docker:start or ./scripts/dev-setup.sh)"
  echo "  • PostgreSQL is accessible at localhost:5432"
  echo ""
  exit 1
fi

echo -e "${GREEN}✅ Database connection verified${NC}"

# Reset database
echo -e "${BLUE}🔥 Resetting database...${NC}"

if [ "$SKIP_SEED" = true ]; then
  echo -e "${YELLOW}  • Clearing database (no seed)...${NC}"
  npx prisma migrate reset --force --skip-seed
else
  echo -e "${YELLOW}  • Clearing and seeding database...${NC}"
  npx prisma migrate reset --force
fi

cd "$PROJECT_ROOT"

echo ""
echo -e "${GREEN}✅ Database reset complete!${NC}"

if [ "$SKIP_SEED" != true ]; then
  echo ""
  echo -e "${BLUE}👥 Test accounts available:${NC}"
  echo "  • admin@colloquium.example.com (Admin)"
  echo "  • editor@colloquium.example.com (Editor)"
  echo "  • author@colloquium.example.com (Author)"
  echo "  • reviewer@colloquium.example.com (Reviewer)"
  echo ""
  echo -e "${YELLOW}💡 Use magic link authentication to sign in${NC}"
fi

echo ""
echo -e "${GREEN}🎉 Quick reset completed!${NC}"