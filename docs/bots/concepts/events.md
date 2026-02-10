# Bot Events

The event system allows bots to react to platform lifecycle events automatically, without requiring `@mention` commands.

## Subscribing to Events

Add an `events` property to your `CommandBot`:

```typescript
import { CommandBot, BotEventName } from '@colloquium/types';

const myBot: CommandBot = {
  id: 'bot-my-bot',
  // ... other properties
  events: {
    [BotEventName.REVIEWER_ASSIGNED]: async (context, payload) => {
      // payload.reviewerId, payload.dueDate, payload.status
      return {
        messages: [{ content: 'A reviewer was assigned!' }],
      };
    },
    [BotEventName.MANUSCRIPT_SUBMITTED]: async (context, payload) => {
      // payload.manuscriptId
      // Return void to take no visible action
    },
  },
};
```

## Event Catalog

### manuscript.submitted

Fired when a new manuscript is created.

| Field | Type | Description |
|-------|------|-------------|
| `manuscriptId` | `string` | ID of the new manuscript |

### manuscript.statusChanged

Fired when a manuscript's status is updated.

| Field | Type | Description |
|-------|------|-------------|
| `previousStatus` | `string` | Status before the change |
| `newStatus` | `string` | Status after the change |

### file.uploaded

Fired when a file is uploaded to a manuscript.

| Field | Type | Description |
|-------|------|-------------|
| `file.id` | `string` | File ID |
| `file.name` | `string` | Original filename |
| `file.type` | `string` | File type (SOURCE, ASSET, etc.) |
| `file.mimetype` | `string` | MIME type |

### reviewer.assigned

Fired when a reviewer is assigned (via invite, direct assign, or bulk assign).

| Field | Type | Description |
|-------|------|-------------|
| `reviewerId` | `string` | User ID of the reviewer |
| `dueDate` | `string \| null` | Review due date (ISO string) |
| `status` | `string` | Initial assignment status |

### reviewer.statusChanged

Fired when a review assignment status changes (accept, decline, complete, etc.).

| Field | Type | Description |
|-------|------|-------------|
| `reviewerId` | `string` | User ID of the reviewer |
| `previousStatus` | `string` | Status before change |
| `newStatus` | `string` | Status after change |

### workflow.phaseChanged

Fired when the workflow phase transitions.

| Field | Type | Description |
|-------|------|-------------|
| `previousPhase` | `string \| null` | Phase before transition |
| `newPhase` | `string` | New workflow phase |
| `round` | `number` | Current review round |

### decision.released

Fired when an editorial decision is released to authors.

| Field | Type | Description |
|-------|------|-------------|
| `decision` | `string` | Editorial decision (accept, reject, revise) |
| `round` | `number` | Review round |

## Handler Context

Event handlers receive the same `BotContext` as command handlers, with pre-fetched manuscript data and files. The `triggeredBy.trigger` will be `'EVENT'` and `conversationId` will be empty (events are not tied to a specific conversation).

## Handler Return Value

Handlers can return:

- **`void`** - No visible action taken
- **`BotResponse`** - Messages are posted to the manuscript's review conversation; actions are processed by the action processor

## Processing

Events are processed asynchronously via graphile-worker jobs, just like `@mention` commands. Each event handler runs independently, and failures in one bot don't affect others.
