# Tutorial: Build a Word Count Bot

This tutorial walks through creating a bot from scratch — without the CLI generator — so you understand every file and pattern.

## What you'll build

A bot that counts words, sentences, and paragraphs in a manuscript's source files. Users invoke it with `@bot-word-count count` and optionally pass `detailed=true` for per-file breakdowns.

## Prerequisites

- Node.js 18+
- A running Colloquium dev environment (`npm run dev`)
- Familiarity with TypeScript

## 1. Create the package

Create `packages/bot-word-count/` with this structure:

```
bot-word-count/
├── package.json
├── tsconfig.json
├── src/
│   └── index.ts
└── tests/
    └── index.test.ts
```

**package.json:**

```json
{
  "name": "@colloquium/bot-word-count",
  "version": "1.0.0",
  "private": true,
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch --preserveWatchOutput",
    "test": "jest",
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "@colloquium/types": "*",
    "@colloquium/bot-sdk": "*"
  },
  "devDependencies": {
    "@types/jest": "^29.5.0",
    "jest": "^29.7.0",
    "ts-jest": "^29.1.0",
    "typescript": "^5.2.2"
  },
  "colloquium": {
    "botId": "bot-word-count",
    "botApiVersion": 1,
    "permissions": ["read_manuscript_files"]
  }
}
```

**tsconfig.json:**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src"]
}
```

## 2. Define the bot

Create `src/index.ts`:

```typescript
import { CommandBot, BotCommand, BotContext, BotResponse } from '@colloquium/types';
import { createBotClient } from '@colloquium/bot-sdk';

interface WordCounts {
  words: number;
  sentences: number;
  paragraphs: number;
}

function countText(text: string): WordCounts {
  const trimmed = text.trim();
  if (!trimmed) return { words: 0, sentences: 0, paragraphs: 0 };

  return {
    words: trimmed.split(/\s+/).length,
    sentences: trimmed.split(/[.!?]+/).filter(s => s.trim()).length,
    paragraphs: trimmed.split(/\n\s*\n/).filter(p => p.trim()).length,
  };
}

const countCommand: BotCommand = {
  name: 'count',
  description: 'Count words, sentences, and paragraphs in manuscript files',
  usage: '@bot-word-count count [detailed=false]',
  parameters: [
    {
      name: 'detailed',
      description: 'Show per-file breakdown',
      type: 'boolean',
      required: false,
      defaultValue: false,
    },
  ],
  examples: [
    '@bot-word-count count',
    '@bot-word-count count detailed=true',
  ],
  permissions: ['read_manuscript_files'],

  async execute(params: Record<string, any>, context: BotContext): Promise<BotResponse> {
    const client = createBotClient(context);
    const detailed = params.detailed === true || params.detailed === 'true';

    const files = await client.files.list({ fileType: 'SOURCE' });

    if (files.length === 0) {
      return {
        messages: [{ content: 'No source files found for this manuscript.' }],
      };
    }

    let totalCounts: WordCounts = { words: 0, sentences: 0, paragraphs: 0 };
    const perFile: Array<{ name: string; counts: WordCounts }> = [];

    for (const file of files) {
      const content = await client.files.download(file.id);
      const counts = countText(content);
      totalCounts.words += counts.words;
      totalCounts.sentences += counts.sentences;
      totalCounts.paragraphs += counts.paragraphs;
      perFile.push({ name: file.originalName, counts });
    }

    let markdown = `## Word Count Summary\n\n`;
    markdown += `| Metric | Count |\n|--------|-------|\n`;
    markdown += `| Words | ${totalCounts.words.toLocaleString()} |\n`;
    markdown += `| Sentences | ${totalCounts.sentences.toLocaleString()} |\n`;
    markdown += `| Paragraphs | ${totalCounts.paragraphs.toLocaleString()} |\n`;

    if (detailed && perFile.length > 1) {
      markdown += `\n### Per-File Breakdown\n\n`;
      markdown += `| File | Words | Sentences | Paragraphs |\n`;
      markdown += `|------|-------|-----------|------------|\n`;
      for (const { name, counts } of perFile) {
        markdown += `| ${name} | ${counts.words} | ${counts.sentences} | ${counts.paragraphs} |\n`;
      }
    }

    return {
      messages: [{
        content: markdown,
        structuredData: {
          type: 'word-count',
          data: {
            total: totalCounts,
            files: perFile.map(f => ({ name: f.name, ...f.counts })),
          },
        },
      }],
    };
  },
};

export const WordCountBot: CommandBot = {
  id: 'bot-word-count',
  name: 'Word Count',
  description: 'Counts words, sentences, and paragraphs in manuscript source files',
  version: '1.0.0',
  commands: [countCommand],
  keywords: ['count', 'words', 'statistics'],
  triggers: ['mention'],
  permissions: ['read_manuscript_files'],
  help: {
    overview: 'Analyzes manuscript source files and reports word, sentence, and paragraph counts.',
    quickStart: 'Use `@bot-word-count count` to get a summary, or `@bot-word-count count detailed=true` for a per-file breakdown.',
    examples: [
      '@bot-word-count count',
      '@bot-word-count count detailed=true',
    ],
  },
};
```

## 3. Write tests

Create `tests/index.test.ts`:

```typescript
import { createTestHarness, createMockFile } from '@colloquium/bots/testing';
import { WordCountBot } from '../src';

describe('WordCountBot', () => {
  const harness = createTestHarness(WordCountBot);

  afterEach(() => {
    harness.clearRequestLog();
  });

  afterAll(() => {
    harness.cleanup();
  });

  it('reports zero files gracefully', async () => {
    const result = await harness.executeCommand('count');
    expect(result.messages?.[0].content).toContain('No source files');
  });

  it('counts words in a single file', async () => {
    harness.withFiles([
      createMockFile({
        originalName: 'manuscript.md',
        fileType: 'SOURCE',
        content: 'Hello world. This is a test.',
      }),
    ]);

    const result = await harness.executeCommand('count');
    expect(result.messages?.[0].content).toContain('Words');
    expect(result.messages?.[0].structuredData?.type).toBe('word-count');
    expect(result.messages?.[0].structuredData?.data.total).toEqual({
      words: 6,
      sentences: 2,
      paragraphs: 1,
    });
  });

  it('shows per-file breakdown when detailed=true', async () => {
    harness.withFiles([
      createMockFile({ originalName: 'intro.md', fileType: 'SOURCE', content: 'Intro text.' }),
      createMockFile({ originalName: 'methods.md', fileType: 'SOURCE', content: 'Methods section.' }),
    ]);

    const result = await harness.executeCommand('count', { detailed: true });
    expect(result.messages?.[0].content).toContain('Per-File Breakdown');
    expect(result.messages?.[0].content).toContain('intro.md');
    expect(result.messages?.[0].content).toContain('methods.md');
  });
});
```

## 4. Build and run

```bash
cd packages/bot-word-count
npm run build
npm test
```

Use watch mode during development:

```bash
npm run bot:dev -- --bot packages/bot-word-count
```

## 5. Register the bot

Add your bot to `packages/bots/src/framework/botManager.ts`:

```typescript
import { WordCountBot } from '@colloquium/bot-word-count';

// In the bot registration section:
botManager.register(WordCountBot);
```

Restart the API server to pick up the new bot.

## 6. Try it out

Open any manuscript conversation and type:

```
@bot-word-count count
```

## Next steps

- [Working with Files](working-with-files.md) — Download, parse, and upload files
- [Event-Driven Bots](event-driven-bots.md) — React to manuscript lifecycle events
- [Interactive Actions](interactive-actions.md) — Add buttons and confirmations
- [SDK Reference](../reference/sdk.md) — Complete API client documentation
