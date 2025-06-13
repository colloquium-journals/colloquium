#!/bin/bash

# Quick environment check script

echo "🔍 Checking environment configuration..."
echo ""

# Check if .env file exists
if [ -f .env ]; then
    echo "✅ .env file exists"
    
    # Check DATABASE_URL
    if grep -q "DATABASE_URL" .env; then
        DATABASE_URL_LINE=$(grep "DATABASE_URL" .env)
        echo "✅ DATABASE_URL found: $DATABASE_URL_LINE"
        
        if echo "$DATABASE_URL_LINE" | grep -q "postgres:password"; then
            echo "✅ DATABASE_URL has correct credentials"
        else
            echo "⚠️  DATABASE_URL may have incorrect credentials"
        fi
    else
        echo "❌ DATABASE_URL not found in .env"
    fi
else
    echo "❌ .env file not found"
fi

echo ""

# Check if Docker is running
if docker info &> /dev/null; then
    echo "✅ Docker is running"
    
    # Check if PostgreSQL container is running
    if docker-compose -f docker/docker-compose.yml ps | grep -q postgres; then
        echo "✅ PostgreSQL container is running"
    else
        echo "❌ PostgreSQL container is not running"
    fi
else
    echo "❌ Docker is not running"
fi

echo ""
echo "🏁 Environment check complete"