# Events Reference

Complete catalog of bot lifecycle events with TypeScript type definitions.

## Event Names

All events are available as `BotEventName` enum values from `@colloquium/types`:

```typescript
import { BotEventName } from '@colloquium/types';
```

| Enum Value | Event String | When It Fires |
|------------|-------------|---------------|
| `MANUSCRIPT_SUBMITTED` | `manuscript.submitted` | New manuscript created |
| `MANUSCRIPT_STATUS_CHANGED` | `manuscript.statusChanged` | Status transitions (e.g., SUBMITTED → UNDER_REVIEW) |
| `FILE_UPLOADED` | `file.uploaded` | File added to a manuscript |
| `REVIEWER_ASSIGNED` | `reviewer.assigned` | Reviewer assigned to manuscript |
| `REVIEWER_STATUS_CHANGED` | `reviewer.statusChanged` | Reviewer accepts, declines, or completes |
| `WORKFLOW_PHASE_CHANGED` | `workflow.phaseChanged` | Workflow phase transition |
| `DECISION_RELEASED` | `decision.released` | Editorial decision released to authors |

## Payload Types

```typescript
import { BotEventPayload, BotEventName } from '@colloquium/types';
```

### manuscript.submitted

```typescript
interface ManuscriptSubmittedPayload {
  manuscriptId: string;
}
```

**Example handler:**

```typescript
events: {
  [BotEventName.MANUSCRIPT_SUBMITTED]: async (context, payload) => {
    console.log(`New manuscript: ${payload.manuscriptId}`);
    return {
      messages: [{ content: 'Manuscript received. Starting analysis...' }],
    };
  },
}
```

### manuscript.statusChanged

```typescript
interface ManuscriptStatusChangedPayload {
  previousStatus: string;  // ManuscriptStatus enum value
  newStatus: string;        // ManuscriptStatus enum value
}
```

Possible status values: `SUBMITTED`, `UNDER_REVIEW`, `REVISION_REQUESTED`, `REVISED`, `ACCEPTED`, `REJECTED`, `PUBLISHED`, `RETRACTED`.

**Example handler:**

```typescript
events: {
  [BotEventName.MANUSCRIPT_STATUS_CHANGED]: async (context, payload) => {
    if (payload.newStatus === 'ACCEPTED') {
      return {
        messages: [{ content: 'Manuscript accepted! Preparing publication workflow.' }],
      };
    }
  },
}
```

### file.uploaded

```typescript
interface FileUploadedPayload {
  file: {
    id: string;
    name: string;      // Original filename
    type: string;       // SOURCE, ASSET, RENDERED, SUPPLEMENTARY, BIBLIOGRAPHY
    mimetype: string;   // e.g., "text/markdown", "application/pdf"
  };
}
```

**Example handler:**

```typescript
events: {
  [BotEventName.FILE_UPLOADED]: async (context, payload) => {
    if (payload.file.type === 'SOURCE') {
      const client = createBotClient(context);
      const content = await client.files.download(payload.file.id);
      // Process the file...
    }
  },
}
```

### reviewer.assigned

```typescript
interface ReviewerAssignedPayload {
  reviewerId: string;       // User ID of the assigned reviewer
  dueDate: string | null;   // ISO 8601 date string, or null
  status: string;           // Initial assignment status (usually "PENDING")
}
```

**Example handler:**

```typescript
events: {
  [BotEventName.REVIEWER_ASSIGNED]: async (context, payload) => {
    const client = createBotClient(context);
    const reviewer = await client.users.get(payload.reviewerId);
    return {
      messages: [{
        content: `Reviewer ${reviewer.name} assigned. Due: ${payload.dueDate ?? 'No deadline'}.`,
      }],
    };
  },
}
```

### reviewer.statusChanged

```typescript
interface ReviewerStatusChangedPayload {
  reviewerId: string;
  previousStatus: string;  // ReviewStatus enum value
  newStatus: string;        // ReviewStatus enum value
}
```

Possible status values: `PENDING`, `ACCEPTED`, `DECLINED`, `IN_PROGRESS`, `COMPLETED`.

**Example handler:**

```typescript
events: {
  [BotEventName.REVIEWER_STATUS_CHANGED]: async (context, payload) => {
    if (payload.newStatus === 'COMPLETED') {
      return {
        messages: [{ content: 'A reviewer has submitted their review.' }],
      };
    }
  },
}
```

### workflow.phaseChanged

```typescript
interface WorkflowPhaseChangedPayload {
  previousPhase: string | null;  // WorkflowPhase enum value or null
  newPhase: string;               // WorkflowPhase enum value
  round: number;                  // Current review round
}
```

Possible phase values: `REVIEW`, `DELIBERATION`, `RELEASED`, `AUTHOR_RESPONDING`.

**Example handler:**

```typescript
events: {
  [BotEventName.WORKFLOW_PHASE_CHANGED]: async (context, payload) => {
    if (payload.newPhase === 'DELIBERATION') {
      return {
        messages: [{
          content: `Deliberation phase started for round ${payload.round}.`,
        }],
      };
    }
  },
}
```

### decision.released

```typescript
interface DecisionReleasedPayload {
  decision: string;   // e.g., "accept", "reject", "revise"
  round: number;      // Review round
}
```

**Example handler:**

```typescript
events: {
  [BotEventName.DECISION_RELEASED]: async (context, payload) => {
    return {
      messages: [{
        content: `Editorial decision for round ${payload.round}: **${payload.decision}**.`,
      }],
    };
  },
}
```

## Handler Signature

```typescript
import { BotEventHandler, BotEventName, BotContext, BotEventPayload, BotResponse } from '@colloquium/types';

type BotEventHandler<E extends BotEventName> = (
  context: BotContext,
  payload: BotEventPayload[E]
) => Promise<BotResponse | void>;
```

## Processing Semantics

- **Asynchronous**: Events are queued as graphile-worker jobs
- **Independent**: Each bot's handler runs independently; one failure doesn't affect others
- **No ordering guarantee**: Multiple bots handling the same event may execute in any order
- **Retries**: Failed event handlers are retried by the job queue with exponential backoff
- **Context**: Event handlers receive the same `BotContext` as command handlers, including pre-fetched manuscript data

## Related

- [Events Concept](../concepts/events.md) — Conceptual overview
- [Event-Driven Bots Tutorial](../tutorials/event-driven-bots.md) — Step-by-step tutorial
- [Event Testing](../concepts/testing.md#event-testing) — Testing event handlers
