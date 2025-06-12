#!/bin/bash

# Colloquium Development Setup Script

set -e

echo "🚀 Setting up Colloquium development environment..."

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "📄 Creating .env file from template..."
    cp .env.example .env
    echo "✅ Created .env file. Please review and update the configuration."
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Build shared packages in correct order
echo "🔨 Building shared packages..."
npm run build --workspace=@colloquium/types
npm run build --workspace=@colloquium/auth
npm run build --workspace=@colloquium/ui
npm run build --workspace=@colloquium/database
npm run build --workspace=@colloquium/bots

# Start Docker services
echo "🐳 Starting Docker services..."
cd docker
docker-compose up -d postgres redis mailhog

# Wait for PostgreSQL to be ready
echo "⏳ Waiting for PostgreSQL to be ready..."
sleep 10

# Run database migrations
echo "🗃️  Running database migrations..."
cd ..
npm run db:migrate

# Generate Prisma client
echo "🔧 Generating Prisma client..."
cd packages/database
npx prisma generate

# Seed database
echo "🌱 Seeding database..."
npm run db:seed

cd ../..

echo ""
echo "✅ Development environment setup complete!"
echo ""
echo "🌐 Services available at:"
echo "  - Frontend: http://localhost:3000"
echo "  - API: http://localhost:4000"
echo "  - Database: postgresql://postgres:password@localhost:5432/colloquium_dev"
echo "  - Redis: redis://localhost:6379"
echo "  - Mailhog (Email testing): http://localhost:8025"
echo ""
echo "To start development:"
echo "  npm run dev"
echo ""
echo "To start with Docker:"
echo "  cd docker && docker-compose up"
echo ""