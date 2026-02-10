# Bot Pipelines

Pipelines allow you to chain bot commands that run sequentially in response to platform events.

## Configuration

Pipelines are configured in journal settings as a JSON object:

```json
{
  "pipelines": {
    "on-submission": [
      { "bot": "bot-reference-check", "command": "check" },
      { "bot": "bot-reviewer-checklist", "command": "generate" }
    ],
    "on-status-changed": [
      { "bot": "bot-editorial", "command": "notify" }
    ]
  }
}
```

Each pipeline key maps to a platform event. Steps are executed sequentially — each step must complete before the next begins.

## Event Mapping

| Pipeline Key | Event |
|---|---|
| `on-submission` | `manuscript.submitted` |
| `on-status-changed` | `manuscript.statusChanged` |
| `on-file-uploaded` | `file.uploaded` |
| `on-reviewer-assigned` | `reviewer.assigned` |
| `on-reviewer-status-changed` | `reviewer.statusChanged` |
| `on-phase-changed` | `workflow.phaseChanged` |
| `on-decision-released` | `decision.released` |

## Step Schema

Each step has:

- `bot` (required) - Bot ID to invoke (e.g., `bot-reference-check`)
- `command` (required) - Command name to execute
- `parameters` (optional) - Parameters to pass to the command

## Execution Semantics

1. Pipelines run **after** individual bot event handlers
2. Each step is queued as a separate job for sequential execution
3. If a step produces **errors**, the pipeline stops — no further steps run
4. Step results (messages, actions) are processed normally (posted to conversations, actions applied)
5. Pipelines are fire-and-forget — there is no return value or callback

## Example: Submission Pipeline

When a manuscript is submitted, run a reference check followed by a checklist generation:

```json
{
  "pipelines": {
    "on-submission": [
      { "bot": "bot-reference-check", "command": "check" },
      {
        "bot": "bot-reviewer-checklist",
        "command": "generate",
        "parameters": { "template": "standard" }
      }
    ]
  }
}
```

## Differences from Event Handlers

| Feature | Event Handlers | Pipelines |
|---|---|---|
| Configuration | Bot code (`events` property) | Journal settings JSON |
| Execution | Parallel (one job per bot) | Sequential (chained jobs) |
| Scope | Single bot | Multiple bots |
| Error handling | Independent per bot | Pipeline stops on error |
| Use case | Bot-specific reactions | Multi-bot workflows |
