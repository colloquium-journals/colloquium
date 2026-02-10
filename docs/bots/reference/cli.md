# create-colloquium-bot CLI

Generate a new Colloquium bot package with all boilerplate pre-configured.

## Usage

```bash
npx create-colloquium-bot [bot-name] [options]
```

## Options

| Flag | Description |
|------|-------------|
| `-y, --yes` | Skip interactive prompts, use defaults |
| `--template <type>` | Template to use: `basic` (default) |

## Interactive Mode

Without `-y`, the CLI prompts for:

1. **Bot name** - Must start with `bot-`, lowercase alphanumeric with hyphens, 5-50 chars
2. **Description** - Short description of what the bot does
3. **Category** - `editorial`, `analysis`, `quality`, `formatting`, `integration`, or `utility`
4. **Organization** - npm scope for the package name
5. **Author info** - Name, email (optional), website (optional)
6. **Git URL** - Repository URL (optional)
7. **License** - MIT, Apache-2.0, GPL-3.0, BSD-3-Clause, or ISC
8. **Keywords** - Comma-separated search terms

## Generated Files

| File | Purpose |
|------|---------|
| `package.json` | Dependencies, scripts, colloquium metadata, `botApiVersion: 1` |
| `tsconfig.json` | TypeScript configuration |
| `eslint.config.mjs` | ESLint 9 flat config using `@colloquium/eslint-config/base` |
| `jest.config.js` | Test configuration |
| `default-config.yaml` | Bot configuration template |
| `src/index.ts` | Bot commands, manifest, and plugin export using `@colloquium/bot-sdk` |
| `tests/index.test.ts` | Example test |
| `README.md` | Documentation template |
| `LICENSE` | License file |
| `.gitignore` | Git ignore rules |

## Dependencies

Generated bots include:
- `@colloquium/bot-sdk` - Typed API client
- `@colloquium/types` - Shared type definitions
- `zod` - Runtime validation
- `@colloquium/eslint-config` - Shared lint rules (dev)
- `typescript`, `jest`, `ts-jest` (dev)

## Quick Start

```bash
npx create-colloquium-bot bot-my-feature
cd bot-my-feature
npm install
npm run build
npm test
```
