# Bot Framework

Colloquium bots are automated assistants that help with manuscript processing, editorial workflows, and quality assurance. They respond to `@bot-name command` mentions in conversations and can process files, validate references, generate documents, and manage editorial decisions.

## Architecture

```
User posts @bot-name command
  → Command parser identifies bot + command + params
    → Job queued via graphile-worker (PostgreSQL LISTEN/NOTIFY)
      → Worker picks up job, executes bot logic
        → Bot reads files, calls APIs, processes data
          → Response broadcast via SSE to conversation
```

Bots authenticate with `x-bot-token` headers and interact with the platform exclusively through API endpoints.

## Built-in Bots

| Bot | Description |
|-----|-------------|
| [bot-editorial](built-in-bots/editorial.md) | Manages editorial workflows: reviewer invitations, editorial decisions, workflow phase transitions |
| [bot-markdown-renderer](built-in-bots/markdown-renderer.md) | Renders Markdown manuscripts into PDF/HTML using configurable templates |
| [bot-reference-check](built-in-bots/reference-check.md) | Validates DOIs and checks reference integrity against CrossRef/DataCite |
| [bot-reviewer-checklist](built-in-bots/reviewer-checklist.md) | Generates customizable review checklists for assigned reviewers |

## Documentation

- **[Quick Start](quick-start.md)** - Create your first bot in 5 minutes
- **Concepts**
  - [Architecture](concepts/architecture.md) - How the bot system works
  - [Commands](concepts/commands.md) - Command syntax and the help system
  - [Authentication](concepts/authentication.md) - Security model and service tokens
  - [Configuration](concepts/configuration.md) - Bot configuration with YAML
- **Reference**
  - [Bot SDK](reference/sdk.md) - `@colloquium/bot-sdk` API reference
  - [Bot API Types](reference/bot-api.md) - TypeScript type reference
  - [CLI](reference/cli.md) - `create-colloquium-bot` generator reference
  - [API Endpoints](reference/api-endpoints.md) - HTTP endpoints for bots
