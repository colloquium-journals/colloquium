#!/bin/bash

# Cleanup development processes and ports

echo "🧹 Cleaning up development processes..."

# Kill any running tsx processes (API)
echo "🔄 Stopping API processes (tsx)..."
pkill -f "tsx.*app.ts" 2>/dev/null && echo "✅ Killed tsx processes" || echo "ℹ️  No tsx processes found"

# Kill any running Next.js processes
echo "🔄 Stopping Next.js processes..."
pkill -f "next.*dev" 2>/dev/null && echo "✅ Killed Next.js processes" || echo "ℹ️  No Next.js processes found"

# Kill any turbo dev processes
echo "🔄 Stopping Turbo dev processes..."
pkill -f "turbo.*dev" 2>/dev/null && echo "✅ Killed Turbo processes" || echo "ℹ️  No Turbo processes found"

# Free up ports 3000 and 4000 specifically
echo "🔄 Freeing ports 3000 and 4000..."
lsof -ti:3000 | xargs kill -9 2>/dev/null && echo "✅ Freed port 3000" || echo "ℹ️  Port 3000 already free"
lsof -ti:4000 | xargs kill -9 2>/dev/null && echo "✅ Freed port 4000" || echo "ℹ️  Port 4000 already free"

# Wait a moment for processes to fully terminate
echo "⏳ Waiting for processes to terminate..."
sleep 2

echo "✅ Cleanup complete!"