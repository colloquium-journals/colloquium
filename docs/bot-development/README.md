# Colloquium Bot Development Guide

Welcome to the Colloquium bot ecosystem! This guide will help you create, publish, and distribute bots for the Colloquium academic publishing platform.

## Overview

Colloquium bots are npm packages that extend the functionality of academic journals built on the Colloquium platform. Bots can:

- Analyze manuscripts for quality, formatting, or compliance issues
- Automate editorial workflows
- Integrate with external services
- Provide specialized tools for authors, reviewers, and editors
- Generate reports and insights

## Bot Architecture

### Command-Based System
Colloquium uses a command-based bot system where users interact with bots by mentioning them in conversations. All bot IDs must start with the `bot-` prefix:

```
@bot-plagiarism-checker check threshold=0.15
@bot-reference check-doi detailed=true
@bot-editorial assign-reviewer manuscript=123 reviewer=456
```

### Bot Structure
Every bot consists of:
- **Commands**: Actions users can trigger
- **Permissions**: What the bot can access
- **Configuration**: Customizable settings
- **Manifest**: Metadata and installation info

## Quick Start

### 1. Create a New Bot Package

```bash
mkdir my-awesome-bot
cd my-awesome-bot
npm init
```

### 2. Install Dependencies

```bash
npm install @colloquium/types zod
npm install -D typescript @types/node jest @types/jest
```

### 3. Create Bot Structure

Create `src/index.ts`:

```typescript
import { BotContext, BotResponse } from '@colloquium/types';
import { z } from 'zod';

// Define your bot
export const myAwesomeBot = {
  id: 'bot-my-awesome',  // Bot IDs must start with 'bot-' prefix
  name: 'My Awesome Bot',
  description: 'Does awesome things with manuscripts',
  version: '1.0.0',
  commands: [
    {
      name: 'analyze',
      description: 'Analyze the manuscript for awesome things',
      usage: '@bot-my-awesome analyze [option=value]',
      parameters: [
        {
          name: 'depth',
          description: 'Analysis depth',
          type: 'enum',
          required: false,
          defaultValue: 'standard',
          enumValues: ['basic', 'standard', 'deep'],
          examples: ['basic', 'standard', 'deep']
        }
      ],
      examples: [
        '@bot-my-awesome analyze',
        '@bot-my-awesome analyze depth=deep'
      ],
      permissions: ['read_manuscript'],
      async execute(params: any, context: BotContext): Promise<BotResponse> {
        const { depth } = params;
        
        // Your bot logic here
        const results = await analyzeManuscript(context.manuscriptId, depth);
        
        return {
          messages: [{
            content: `✨ Analysis complete! Found ${results.count} awesome things.`,
            attachments: [{
              type: 'report',
              filename: 'awesome-analysis.json',
              data: JSON.stringify(results),
              mimetype: 'application/json'
            }]
          }]
        };
      }
    }
  ],
  keywords: ['analysis', 'awesome'],
  triggers: [],
  permissions: ['read_manuscript'],
  help: {
    overview: 'Analyzes manuscripts for awesome things.',
    quickStart: 'Use @bot-my-awesome analyze to get started.',
    examples: ['@bot-my-awesome analyze depth=deep']
  }
};

// Bot manifest for the plugin system
export const manifest = {
  name: '@myorg/my-awesome-bot',  // npm package name uses -bot suffix
  version: '1.0.0',
  description: 'Does awesome things with manuscripts',
  author: {
    name: 'Your Name',
    email: 'you@example.com'
  },
  license: 'MIT',
  keywords: ['colloquium', 'bot', 'analysis'],
  colloquium: {
    botId: 'bot-my-awesome',  // Bot ID uses bot- prefix
    apiVersion: '1.0.0',
    permissions: ['read_manuscript'],
    category: 'analysis',
    isDefault: false
  }
};

// Plugin export
export const bot = myAwesomeBot;
export default { manifest, bot: myAwesomeBot };

// Your implementation
async function analyzeManuscript(manuscriptId: string, depth: string) {
  // Implementation here
  return { count: 42, details: 'Amazing analysis results' };
}
```

### 4. Configure package.json

```json
{
  "name": "@myorg/my-awesome-bot",
  "version": "1.0.0",
  "description": "Does awesome things with manuscripts",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "keywords": ["colloquium", "bot", "analysis"],
  "author": "Your Name <you@example.com>",
  "license": "MIT",
  "colloquium": {
    "botId": "bot-my-awesome",
    "apiVersion": "1.0.0",
    "permissions": ["read_manuscript"],
    "category": "analysis",
    "isDefault": false
  },
  "scripts": {
    "build": "tsc",
    "test": "jest",
    "prepublishOnly": "npm run build"
  },
  "files": ["dist", "README.md"],
  "dependencies": {
    "@colloquium/types": "*",
    "zod": "^3.22.0"
  },
  "peerDependencies": {
    "@colloquium/types": "*"
  }
}
```

### 5. Build and Test

```bash
npm run build
npm test
```

### 6. Publish

```bash
npm publish
```

## Bot API Reference

### Command Interface

```typescript
interface BotCommand {
  name: string;                    // Command name (e.g., "analyze")
  description: string;             // Human-readable description
  usage: string;                   // Usage example
  parameters: BotCommandParameter[]; // Command parameters
  examples: string[];              // Usage examples
  permissions: string[];           // Required permissions
  execute(params: Record<string, any>, context: BotContext): Promise<BotResponse>;
}
```

### Command Parameters

```typescript
interface BotCommandParameter {
  name: string;                    // Parameter name
  description: string;             // Parameter description
  type: 'string' | 'number' | 'boolean' | 'array' | 'enum';
  required: boolean;               // Is parameter required?
  defaultValue?: any;              // Default value
  validation?: z.ZodSchema<any>;   // Zod validation schema
  enumValues?: string[];           // For enum type
  examples?: string[];             // Example values
}
```

### Bot Context

The `BotContext` provides information about the current execution environment:

```typescript
interface BotContext {
  conversationId: string;          // Current conversation
  manuscriptId: string;            // Current manuscript
  triggeredBy: {
    messageId: string;             // Message that triggered the bot
    userId: string;                // User who triggered the bot
    trigger: string;               // How bot was triggered
  };
  journal: {
    id: string;                    // Journal ID
    settings: Record<string, any>; // Journal settings
  };
  config: Record<string, any>;     // Bot configuration
}
```

### Bot Response

```typescript
interface BotResponse {
  botId?: string;                  // Bot identifier
  messages?: Array<{
    content: string;               // Message content (Markdown)
    replyTo?: string;              // Message to reply to
    attachments?: BotAttachment[]; // File attachments
  }>;
  actions?: BotAction[];           // System actions to perform
  errors?: string[];               // Error messages
}
```

## Available Permissions

- `read_manuscript` - Read manuscript content and metadata
- `read_files` - Access uploaded files
- `read_conversations` - Read conversation messages
- `write_messages` - Send messages to conversations
- `update_manuscript` - Modify manuscript metadata
- `assign_reviewers` - Assign reviewers to manuscripts
- `make_decisions` - Make editorial decisions

## Bot Categories

- `editorial` - Editorial workflow automation
- `analysis` - Manuscript analysis and quality checks
- `formatting` - Document formatting and style
- `quality` - Quality assurance and validation
- `integration` - External service integrations
- `utility` - General utility functions

## Testing Your Bot

### Unit Tests

```typescript
import { myAwesomeBot } from '../src/index';

describe('My Awesome Bot', () => {
  test('should have correct metadata', () => {
    expect(myAwesomeBot.id).toBe('bot-my-awesome');
    expect(myAwesomeBot.commands).toHaveLength(1);
  });
  
  test('analyze command should work', async () => {
    const mockContext = {
      manuscriptId: 'test-123',
      conversationId: 'conv-456',
      // ... other required fields
    };
    
    const result = await myAwesomeBot.commands[0].execute(
      { depth: 'standard' },
      mockContext
    );
    
    expect(result.messages).toBeDefined();
    expect(result.messages[0].content).toContain('Analysis complete');
  });
});
```

### Integration Testing

Test your bot in a development Colloquium instance:

1. Install your bot locally
2. Use the bot management API to install it
3. Test commands in conversations
4. Verify permissions and error handling

## Publishing Guidelines

### Bot ID Naming Convention
- **Bot IDs must start with `bot-` prefix** (e.g., `bot-plagiarism-checker`, `bot-statistics`)
- The `bot-` prefix is reserved in the system to prevent username impersonation
- Package names use `-bot` suffix: `@yourorg/plagiarism-checker-bot`
- Keep names descriptive and searchable
- Avoid generic names like "helper" or "utility"

### Documentation Requirements
- Clear README with usage examples
- API documentation for all commands
- Configuration options explanation
- Troubleshooting guide

### Quality Standards
- Comprehensive error handling
- Input validation with Zod schemas
- Unit test coverage > 80%
- TypeScript strict mode
- ESLint compliance

### Security Considerations
- Never log sensitive information
- Validate all inputs
- Use least-privilege permissions
- Handle timeouts and rate limits
- Sanitize outputs

## Distribution

### npm Registry
Publish to npm for easy installation:

```bash
npm publish --access public
```

### Private Registries
For proprietary bots, use private npm registries or Git repositories.

### Colloquium Marketplace
Submit your bot to the official Colloquium marketplace for wider distribution.

## Examples

### Simple Analysis Bot
See the [reference bot example](../packages/bots/standalone-packages/reference-bot/) for a complete implementation.

### Integration Bot
```typescript
// Example: Slack notification bot
export const slackBot = {
  id: 'bot-slack-notifications',  // Bot IDs must start with 'bot-'
  name: 'Slack Notifications',
  commands: [
    {
      name: 'notify',
      async execute(params, context) {
        const webhook = context.config.slackWebhook;
        await fetch(webhook, {
          method: 'POST',
          body: JSON.stringify({
            text: `New manuscript submitted: ${context.manuscriptId}`
          })
        });
        return {
          messages: [{ content: 'Slack notification sent!' }]
        };
      }
    }
  ]
};
```

## Support

- [Discord Community](https://discord.gg/colloquium)
- [GitHub Discussions](https://github.com/colloquium/colloquium/discussions)
- [Documentation](https://docs.colloquium.org)
- [API Reference](https://api.colloquium.org)

## Contributing

We welcome contributions to the bot ecosystem! See our [contributing guidelines](CONTRIBUTING.md) for details.