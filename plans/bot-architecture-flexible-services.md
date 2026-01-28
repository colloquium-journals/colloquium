# Flexible Bot Architecture with Optional Services

## Overview

This document outlines a flexible bot architecture for Colloquium that supports both simple JavaScript bots and complex service-enhanced bots that require external tools like Pandoc, R, Python, etc.

## Architecture Principles

1. **Simple by Default**: Most bots should be pure JavaScript/TypeScript functions
2. **Power When Needed**: Complex bots can optionally include containerized services
3. **Consistent Interface**: All bots use the same configuration and discovery mechanism
4. **Gradual Complexity**: Bots can evolve from simple to service-enhanced over time

## Bot Types

### 1. Simple Bots (Most Common)

Pure JavaScript/TypeScript bots with no external dependencies beyond Node.js APIs.

**Examples:**
- Comment/summary bots
- Text processing bots  
- API integration bots (OpenAI, etc.)
- Notification bots

**Architecture:**
```
packages/comment-bot/
├── src/
│   └── index.ts           # Bot implementation
├── package.json           # Standard npm package
└── README.md
```

### 2. Service-Enhanced Bots (When Needed)

Bots that require external tools, languages, or complex processing environments.

**Examples:**
- PDF rendering (requires Pandoc + LaTeX)
- Statistical analysis (requires R/Python)
- Image processing (requires ImageMagick)
- Code compilation (requires language-specific toolchains)

**Architecture:**
```
packages/bot-markdown-renderer/
├── src/
│   └── index.ts           # Bot implementation
├── docker/
│   ├── pandoc-service/
│   │   ├── Dockerfile     # Pandoc + minimal Express service
│   │   ├── service.js     # HTTP wrapper for Pandoc
│   │   └── package.json
│   └── docker-compose.yml # Service definitions
├── templates/             # Bot-specific assets
├── package.json           # Bot config + service metadata
└── README.md
```

## Universal Bot Configuration

All bots use a standardized configuration in `package.json`:

### Simple Bot Config
```json
{
  "name": "@colloquium/comment-bot",
  "version": "1.0.0",
  "main": "dist/index.js",
  "colloquium": {
    "botId": "comment-bot",
    "apiVersion": "1.0.0",
    "permissions": [
      "read_conversations"
    ],
    "defaultConfig": {
      "maxLength": 500,
      "autoReply": false,
      "sentiment": "neutral"
    }
  }
}
```

### Service-Enhanced Bot Config
```json
{
  "name": "@colloquium/markdown-renderer-bot",
  "version": "1.0.0",
  "main": "dist/index.js",
  "colloquium": {
    "botId": "markdown-renderer",
    "apiVersion": "1.0.0",
    "permissions": [
      "read_manuscript_files",
      "upload_files"
    ],
    "defaultConfig": {
      "pdfEngine": "html",
      "templateName": "academic-standard",
      "citationStyle": "apa.csl",
      "outputFormats": ["pdf"]
    },
    "services": [
      {
        "name": "pandoc",
        "image": "colloquium/pandoc-service:1.0.0",
        "port": 8080,
        "healthCheck": "/health",
        "environment": {
          "PANDOC_VERSION": "3.1.8"
        },
        "resources": {
          "memory": "512Mi",
          "cpu": "500m"
        }
      }
    ]
  }
}
```

## Configuration Properties

### Required Properties (All Bots)
- **`botId`**: Unique identifier for the bot
- **`apiVersion`**: Framework compatibility version
- **`permissions`**: Array of permissions the bot requires
- **`defaultConfig`**: Default configuration values that users can customize

### Optional Properties
- **`services`**: Array of containerized services (service-enhanced bots only)
- **`healthChecks`**: Health check endpoints for monitoring
- **`resourceLimits`**: Memory/CPU limits for the bot
- **`dependencies`**: Other bots this bot depends on

## Service Configuration

For service-enhanced bots, each service in the `services` array can specify:

```json
{
  "name": "service-name",
  "image": "docker-image:tag",
  "port": 8080,
  "healthCheck": "/health",
  "environment": {
    "ENV_VAR": "value"
  },
  "resources": {
    "memory": "512Mi",
    "cpu": "500m"
  },
  "volumes": [
    {
      "host": "./uploads",
      "container": "/uploads",
      "mode": "ro"
    }
  ]
}
```

## Framework Implementation

### Bot Discovery
The framework scans installed bot packages and automatically detects:
1. Simple bots (no `services` property)
2. Service-enhanced bots (has `services` property)

### Service Management
For service-enhanced bots, the framework:
1. **Startup**: Launches required services via Docker Compose
2. **Health Monitoring**: Monitors service health via health check endpoints
3. **Scaling**: Can scale services based on demand
4. **Cleanup**: Stops services when bot is uninstalled

### Bot Execution
```javascript
// Framework automatically handles both types
class BotManager {
  async executeBotCommand(botId, command, context) {
    const bot = this.getBotById(botId);
    
    // Start services if needed
    if (bot.config.services) {
      await this.serviceManager.ensureServicesRunning(bot.config.services);
    }
    
    // Execute bot command
    return await bot.execute(command, context);
  }
}
```

## Benefits

### For Simple Bots
- ✅ **Low Barrier to Entry**: Just JavaScript, no Docker knowledge required
- ✅ **Fast Development**: Quick to write, test, and deploy
- ✅ **Lightweight**: No container overhead
- ✅ **Easy Debugging**: Standard Node.js debugging tools

### For Service-Enhanced Bots
- ✅ **Full Power**: Access to any tool or language via containers
- ✅ **Cross-Platform Consistency**: Same behavior everywhere
- ✅ **Isolation**: Service failures don't crash the main system
- ✅ **Scalability**: Services can be scaled independently

### For the Platform
- ✅ **Consistent Interface**: All bots configured and discovered the same way
- ✅ **Security**: Standardized permission model
- ✅ **Flexibility**: Supports both simple and complex use cases
- ✅ **Evolution**: Bots can grow from simple to complex as needed

## Migration Path

### Existing Simple Bots
No changes required - they continue to work as-is.

### Existing Complex Bots (like markdown-renderer)
1. Add `services` array to `colloquium` config
2. Create Docker service definitions in `docker/` directory
3. Update bot code to call services via HTTP instead of local commands
4. Framework automatically detects and manages services

## Example: Markdown Renderer Migration

### Before (Current - Broken without Pandoc)
```javascript
// Calls local pandoc command - fails if not installed
const result = execSync('pandoc input.md -o output.pdf');
```

### After (Service-Enhanced)
```javascript
// Calls containerized Pandoc service via HTTP
const response = await fetch('http://pandoc-service:8080/convert', {
  method: 'POST',
  body: JSON.stringify({ markdown: content, format: 'pdf' })
});
const pdfBuffer = await response.buffer();
```

## Implementation Plan

1. **Phase 1**: Update bot framework to detect `services` configuration
2. **Phase 2**: Implement service manager for Docker Compose integration
3. **Phase 3**: Create Pandoc microservice for markdown-renderer-bot
4. **Phase 4**: Update markdown-renderer-bot to use service architecture
5. **Phase 5**: Document patterns for other service-enhanced bots

This flexible architecture ensures that Colloquium can support both simple automation bots and powerful academic processing tools while maintaining a consistent developer and user experience.