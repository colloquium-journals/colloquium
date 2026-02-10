# Quick Start: Create a Bot

This guide walks you through creating, testing, and installing a Colloquium bot.

## Prerequisites

- Node.js 18+
- A running Colloquium development environment (`npm run dev`)

## 1. Generate a bot package

```bash
npx create-colloquium-bot bot-hello-world
```

Follow the interactive prompts for description, category, and author info. The generator creates a complete package:

```
bot-hello-world/
├── package.json            # Dependencies + colloquium metadata
├── tsconfig.json
├── eslint.config.mjs       # ESLint 9 flat config
├── jest.config.js
├── default-config.yaml     # Bot configuration (editable by admins)
├── src/
│   └── index.ts            # Bot commands and manifest
├── tests/
│   └── index.test.ts
└── README.md
```

## 2. Understand the generated code

Open `src/index.ts`. Key parts:

**Commands** define what users can do:
```typescript
const analyzeCommand: BotCommand = {
  name: 'analyze',
  description: 'Analyze the manuscript content',
  usage: '@bot-hello-world analyze [mode=standard]',
  parameters: [...],
  async execute(params, context) {
    const client = createBotClient(context);
    const manuscript = context.manuscript; // pre-fetched data
    const files = await client.files.list();
    // ... your logic here
  }
};
```

**The bot export** registers commands and metadata:
```typescript
export const BotHelloWorldBot: CommandBot = {
  id: 'bot-hello-world',
  commands: [analyzeCommand],
  // ...
};
```

## 3. Use the SDK

The `@colloquium/bot-sdk` package provides typed API access:

```typescript
import { createBotClient } from '@colloquium/bot-sdk';

const client = createBotClient(context);

// Manuscript data
const manuscript = await client.manuscripts.get();

// File operations
const files = await client.files.list();
const content = await client.files.download(fileId);
await client.files.upload('output.html', htmlContent, {
  fileType: 'RENDERED',
  mimetype: 'text/html',
});

// Users and reviewers
const user = await client.users.get(userId);
const reviewers = await client.reviewers.list();
```

The bot context also includes pre-fetched `manuscript` and `files` data to avoid unnecessary API calls.

## 4. Build and test

```bash
cd bot-hello-world
npm install
npm run build
npm test
```

## 5. Install locally

For development, link the bot into the monorepo:

1. Place the bot directory under `packages/` in the Colloquium repo
2. Run `npm install` from the repo root
3. Register the bot in `packages/bots/src/framework/botManager.ts`
4. Restart the dev server

## 6. Test in a conversation

1. Open a manuscript conversation in the UI
2. Type `@bot-hello-world analyze`
3. The bot processes asynchronously and responds in the conversation

## Next steps

- [Architecture](concepts/architecture.md) - Understand the full bot lifecycle
- [SDK Reference](reference/sdk.md) - Complete API client documentation
- [Configuration](concepts/configuration.md) - Customize bot settings via YAML
- [Commands](concepts/commands.md) - Advanced command patterns and help system
