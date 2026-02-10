# Tutorial: Working with Files

This tutorial covers downloading, parsing, and uploading files in a bot — using the SDK's file client and persistent storage for incremental processing.

## What you'll build

A bot command that reads `.bib` bibliography files, extracts citation keys, and caches file hashes in storage so repeated runs skip unchanged files.

## Prerequisites

- Completed [Your First Bot](your-first-bot.md) or used `npx create-colloquium-bot`
- Familiarity with `@colloquium/bot-sdk`

## 1. List and filter files

The `client.files` client supports filtering by type:

```typescript
import { createBotClient } from '@colloquium/bot-sdk';

async function execute(params: Record<string, any>, context: BotContext): Promise<BotResponse> {
  const client = createBotClient(context);

  // List only bibliography files
  const bibFiles = await client.files.list({ fileType: 'BIBLIOGRAPHY' });

  if (bibFiles.length === 0) {
    return {
      messages: [{ content: 'No bibliography files found.' }],
    };
  }

  // Each file has: id, originalName, filename, fileType, mimetype, size, downloadUrl
  for (const file of bibFiles) {
    console.log(`Found: ${file.originalName} (${file.size} bytes)`);
  }
}
```

You can also use the pre-fetched `context.files` array for basic file listing without an API call:

```typescript
const sourceFiles = context.files?.filter(f => f.fileType === 'SOURCE') ?? [];
```

## 2. Download file content

```typescript
// Download by file ID (returns string content)
const content = await client.files.download(file.id);

// Or download by URL (useful for cross-references)
const content2 = await client.files.downloadByUrl(file.downloadUrl);
```

## 3. Parse the content

Here's a simple BibTeX parser that extracts citation keys:

```typescript
interface BibEntry {
  key: string;
  type: string;
  title?: string;
}

function parseBibtex(content: string): BibEntry[] {
  const entries: BibEntry[] = [];
  const entryRegex = /@(\w+)\s*\{\s*([^,]+),/g;
  const titleRegex = /title\s*=\s*[{"]([^}"]+)[}"]/i;

  let match;
  while ((match = entryRegex.exec(content)) !== null) {
    const type = match[1].toLowerCase();
    const key = match[2].trim();

    // Extract title from the surrounding block
    const blockStart = match.index;
    const blockEnd = content.indexOf('\n}', blockStart);
    const block = content.slice(blockStart, blockEnd);
    const titleMatch = titleRegex.exec(block);

    entries.push({
      key,
      type,
      title: titleMatch?.[1],
    });
  }

  return entries;
}
```

## 4. Use storage for incremental processing

Avoid reprocessing unchanged files by caching a content hash:

```typescript
import { createHash } from 'crypto';

async function processWithCache(
  client: ReturnType<typeof createBotClient>,
  file: { id: string; originalName: string }
): Promise<{ entries: BibEntry[]; cached: boolean }> {
  const content = await client.files.download(file.id);
  const hash = createHash('sha256').update(content).digest('hex');

  // Check if we already processed this version
  const cacheKey = `bib-hash:${file.id}`;
  const cached = await client.storage.get<{ hash: string; entries: BibEntry[] }>(cacheKey);

  if (cached && cached.hash === hash) {
    return { entries: cached.entries, cached: true };
  }

  // Parse fresh
  const entries = parseBibtex(content);

  // Store result for next time
  await client.storage.set(cacheKey, { hash, entries });

  return { entries, cached: false };
}
```

## 5. Upload results

Generate a processed output and upload it back:

```typescript
async function uploadSummary(
  client: ReturnType<typeof createBotClient>,
  entries: BibEntry[]
): Promise<void> {
  const markdown = entries
    .map(e => `- **${e.key}** (${e.type}): ${e.title ?? 'No title'}`)
    .join('\n');

  await client.files.upload('bibliography-summary.md', markdown, {
    fileType: 'RENDERED',
    renderedBy: 'bot-bib-parser',
    mimetype: 'text/markdown',
  });
}
```

## 6. Put it all together

```typescript
const parseCommand: BotCommand = {
  name: 'parse',
  description: 'Parse bibliography files and extract citation keys',
  usage: '@bot-bib-parser parse',
  parameters: [],
  examples: ['@bot-bib-parser parse'],
  permissions: ['read_manuscript_files', 'upload_files'],

  async execute(params, context): Promise<BotResponse> {
    const client = createBotClient(context);
    const bibFiles = await client.files.list({ fileType: 'BIBLIOGRAPHY' });

    if (bibFiles.length === 0) {
      return {
        messages: [{ content: 'No bibliography files found.' }],
      };
    }

    const allEntries: BibEntry[] = [];
    const results: string[] = [];

    for (const file of bibFiles) {
      const { entries, cached } = await processWithCache(client, file);
      allEntries.push(...entries);
      results.push(
        `**${file.originalName}**: ${entries.length} entries${cached ? ' (cached)' : ''}`
      );
    }

    await uploadSummary(client, allEntries);

    return {
      messages: [{
        content: `## Bibliography Summary\n\n${results.join('\n')}\n\nTotal: **${allEntries.length}** entries. Summary uploaded as \`bibliography-summary.md\`.`,
        structuredData: {
          type: 'bibliography-parse',
          data: {
            totalEntries: allEntries.length,
            files: results.length,
            entries: allEntries,
          },
        },
      }],
    };
  },
};
```

## 7. Test file operations

```typescript
import { createTestHarness, createMockFile } from '@colloquium/bots/testing';
import { BibParserBot } from '../src';

describe('BibParserBot', () => {
  const harness = createTestHarness(BibParserBot);

  afterAll(() => harness.cleanup());

  it('parses a .bib file', async () => {
    harness.withFiles([
      createMockFile({
        originalName: 'refs.bib',
        fileType: 'BIBLIOGRAPHY',
        content: `@article{smith2024,
  title = {A Study},
  author = {Smith, J.}
}
@inproceedings{jones2023,
  title = {A Conference Paper},
  author = {Jones, A.}
}`,
      }),
    ]);

    const result = await harness.executeCommand('parse');
    expect(result.messages?.[0].content).toContain('2 entries');
    expect(result.messages?.[0].structuredData?.data.totalEntries).toBe(2);
  });
});
```

## Next steps

- [Event-Driven Bots](event-driven-bots.md) — Auto-process files when uploaded
- [SDK Reference](../reference/sdk.md) — Full file client API
- [Storage Concepts](../concepts/storage.md) — Storage patterns and lifecycle
