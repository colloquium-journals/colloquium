#!/bin/bash

# Helper script to start Docker and wait for it to be ready

echo "🐳 Starting Docker Desktop..."

# Start Docker Desktop based on OS
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS - try multiple ways to start Docker Desktop
    echo "🖥️  Attempting to start Docker Desktop on macOS..."
    
    if open -a "Docker Desktop" 2>/dev/null; then
        echo "✅ Started via 'Docker Desktop' app name"
    elif open -a Docker 2>/dev/null; then
        echo "✅ Started via 'Docker' app name"
    elif open /Applications/Docker.app 2>/dev/null; then
        echo "✅ Started via direct path"
    elif ls /Applications/ | grep -i docker &>/dev/null; then
        # Find Docker in Applications and try to open it
        DOCKER_APP=$(ls /Applications/ | grep -i docker | head -1)
        echo "🔍 Found: $DOCKER_APP"
        open "/Applications/$DOCKER_APP" 2>/dev/null || {
            echo "❌ Could not start $DOCKER_APP"
            echo "   Please start it manually from Applications folder"
            exit 1
        }
        echo "✅ Started $DOCKER_APP"
    else
        echo "❌ Docker Desktop not found in Applications folder."
        echo "   Please install Docker Desktop from https://docs.docker.com/get-docker/"
        echo "   Expected location: /Applications/Docker.app"
        exit 1
    fi
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux
    echo "🐧 Starting Docker service on Linux..."
    sudo systemctl start docker || {
        echo "❌ Could not start Docker service."
        echo "   Please install Docker: https://docs.docker.com/engine/install/"
        exit 1
    }
else
    echo "❌ Unsupported operating system: $OSTYPE"
    echo "   Please start Docker manually."
    exit 1
fi

echo "⏳ Waiting for Docker to be ready..."

# Wait for Docker to be available (up to 2 minutes)
TIMEOUT=120
ELAPSED=0

while [ $ELAPSED -lt $TIMEOUT ]; do
    if docker info &> /dev/null; then
        echo "✅ Docker is ready!"
        echo ""
        echo "🚀 You can now run the setup script:"
        echo "   ./scripts/dev-setup.sh"
        exit 0
    fi
    
    echo "   Still waiting... ($ELAPSED/${TIMEOUT}s)"
    sleep 5
    ELAPSED=$((ELAPSED + 5))
done

echo "❌ Docker failed to start within $TIMEOUT seconds."
echo "   Please check Docker Desktop and try again."
exit 1