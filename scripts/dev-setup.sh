#!/bin/bash

# Colloquium Development Setup Script

set -e

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Get the project root (one level up from scripts/)
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "🚀 Setting up Colloquium development environment..."
echo "📁 Project root: $PROJECT_ROOT"

# Change to project root
cd "$PROJECT_ROOT"

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    echo "   Visit: https://docs.docker.com/get-docker/"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    echo "   Visit: https://docs.docker.com/compose/install/"
    exit 1
fi

# Check if Docker daemon is running
if ! docker info &> /dev/null; then
    echo "❌ Docker daemon is not running."
    echo ""
    
    # Check if this is Docker Desktop vs Homebrew Docker
    if [[ "$OSTYPE" == "darwin"* ]]; then
        if brew list | grep -q docker && ! ls /Applications/ | grep -qi docker; then
            echo "🍺 Detected Homebrew Docker installation."
            echo ""
            echo "You have Docker CLI but need Docker Desktop for this project."
            echo "Please install Docker Desktop:"
            echo ""
            echo "Option 1 - Install Docker Desktop:"
            echo "   brew install --cask docker"
            echo "   open -a Docker"
            echo ""
            echo "Option 2 - Download manually:"
            echo "   Visit: https://docs.docker.com/desktop/install/mac/"
            echo ""
            exit 1
        fi
    fi
    
    echo "Please start Docker and then re-run this script:"
    echo ""
    echo "🖥️  On macOS:"
    echo "   • Open Docker Desktop from Applications, or"
    echo "   • Run: open -a Docker"
    echo ""
    echo "🐧 On Linux:"
    echo "   • Run: sudo systemctl start docker"
    echo ""
    echo "🪟 On Windows:"
    echo "   • Start Docker Desktop from Start Menu"
    echo ""
    echo "⏳ After Docker starts (whale icon stops animating), run:"
    echo "   ./scripts/dev-setup.sh"
    echo ""
    
    # Offer to install Docker Desktop via Homebrew on macOS
    if [[ "$OSTYPE" == "darwin"* ]]; then
        read -p "🚀 Would you like me to install Docker Desktop via Homebrew? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            echo "🍺 Installing Docker Desktop via Homebrew..."
            if brew install --cask docker; then
                echo "✅ Docker Desktop installed successfully!"
                echo "🐳 Starting Docker Desktop..."
                open -a Docker
                echo "⏳ Please wait for Docker to start (this may take 30-60 seconds)..."
                echo "   Watch for the whale icon in your menu bar to stop animating."
                echo "   Then re-run this script: ./scripts/dev-setup.sh"
            else
                echo "❌ Failed to install Docker Desktop via Homebrew."
                echo "   Please install manually from: https://docs.docker.com/desktop/install/mac/"
            fi
        fi
    fi
    
    exit 1
fi

echo "✅ Docker is running"

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "📄 Creating .env file from template..."
    cp .env.example .env
    echo "✅ Created .env file with Docker database configuration."
else
    echo "📄 Found existing .env file"
    # Update DATABASE_URL if it still has placeholder values
    if grep -q "username:password" .env; then
        echo "🔧 Updating DATABASE_URL to match Docker setup..."
        sed -i '' 's|postgresql://username:password@localhost:5432/colloquium_dev|postgresql://postgres:password@localhost:5432/colloquium_dev|g' .env
        echo "✅ Updated DATABASE_URL in .env file"
    fi
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Generate Prisma client first (needed for database package build)
echo "🔧 Generating Prisma client..."
cd "$PROJECT_ROOT/packages/database" || {
    echo "❌ Could not navigate to packages/database directory"
    exit 1
}
npx prisma generate
cd "$PROJECT_ROOT" || {
    echo "❌ Could not navigate back to project root"
    exit 1
}

# Build shared packages in correct order
echo "🔨 Building shared packages..."
npm run build --workspace=@colloquium/types
npm run build --workspace=@colloquium/auth
npm run build --workspace=@colloquium/ui
npm run build --workspace=@colloquium/database
npm run build --workspace=@colloquium/bots

# Start Docker services
echo "🐳 Starting Docker services..."
cd "$PROJECT_ROOT/docker" || {
    echo "❌ Could not navigate to docker directory"
    exit 1
}
docker-compose up -d postgres redis mailhog

# Wait for PostgreSQL to be ready
echo "⏳ Waiting for PostgreSQL to be ready..."
sleep 10

# Set DATABASE_URL for this session to ensure Prisma operations work
export DATABASE_URL="postgresql://postgres:password@localhost:5432/colloquium_dev"

# Run database migrations (Prisma client already generated above)
echo "🗃️  Running database migrations..."
npm run db:migrate

# Seed database
echo "🌱 Seeding database..."
npm run db:seed

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