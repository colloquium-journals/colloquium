# Tutorial: Interactive Actions

This tutorial shows how to add clickable buttons to bot responses so users can trigger follow-up actions without typing commands.

## What you'll build

A bot that presents review results with "Approve" and "Request Revision" action buttons, and handles clicks with confirmation prompts and role-based visibility.

## Prerequisites

- Completed [Your First Bot](your-first-bot.md)
- Familiarity with `BotResponse` and `BotMessageAction`

## 1. Add actions to a response

Actions are buttons attached to individual messages via the `actions` array:

```typescript
import { BotResponse, BotMessageAction } from '@colloquium/types';

const response: BotResponse = {
  messages: [{
    content: '## Analysis Complete\n\nThe manuscript passes all quality checks.',
    actions: [
      {
        id: 'approve',
        label: 'Approve Manuscript',
        style: 'primary',
        handler: {
          botId: 'bot-quality-check',
          action: 'approve',
          params: {},
        },
      },
      {
        id: 'request-revision',
        label: 'Request Revision',
        style: 'secondary',
        handler: {
          botId: 'bot-quality-check',
          action: 'requestRevision',
          params: {},
        },
      },
    ],
  }],
};
```

## 2. Action properties

Each `BotMessageAction` has these fields:

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique identifier for this action |
| `label` | `string` | Button text shown to users |
| `style` | `'primary' \| 'secondary' \| 'danger'` | Visual style |
| `confirmText` | `string?` | If set, shows a confirmation dialog before executing |
| `targetUserId` | `string?` | Only show to this specific user |
| `targetRoles` | `string[]?` | Only show to users with these roles |
| `handler` | `object` | Which bot/action to invoke when clicked |
| `resultContent` | `string?` | Updated message content after action executes |
| `resultLabel` | `string?` | Updated button label after execution |
| `triggered` | `boolean?` | Whether the action has been executed |
| `triggeredBy` | `string?` | User ID who triggered it |
| `triggeredAt` | `string?` | Timestamp of execution |

## 3. Add confirmation prompts

For destructive or significant actions, add `confirmText`:

```typescript
{
  id: 'reject',
  label: 'Reject Manuscript',
  style: 'danger',
  confirmText: 'Are you sure you want to reject this manuscript? This action cannot be undone.',
  handler: {
    botId: 'bot-quality-check',
    action: 'reject',
    params: {},
  },
}
```

The UI shows a confirmation dialog before invoking the handler.

## 4. Target actions to specific roles

Restrict who sees certain buttons:

```typescript
{
  id: 'assign-reviewer',
  label: 'Assign Reviewer',
  style: 'primary',
  targetRoles: ['ADMIN', 'EDITOR_IN_CHIEF', 'ACTION_EDITOR'],
  handler: {
    botId: 'bot-quality-check',
    action: 'assignReviewer',
    params: {},
  },
}
```

Regular users won't see this button — only editors and admins.

## 5. Implement action handlers

Register `actionHandlers` on your `CommandBot` to process button clicks:

```typescript
import {
  CommandBot,
  BotActionHandler,
  BotActionHandlerContext,
  BotActionHandlerResult,
} from '@colloquium/types';

const handleApprove: BotActionHandler = async (
  params: Record<string, any>,
  context: BotActionHandlerContext
): Promise<BotActionHandlerResult> => {
  // context provides: manuscriptId, conversationId, messageId, triggeredBy, serviceToken

  // Perform the approval logic...

  return {
    success: true,
    updatedContent: '## Analysis Complete\n\nManuscript approved.',
    updatedLabel: 'Approved',
  };
};

const handleRequestRevision: BotActionHandler = async (
  params,
  context
): Promise<BotActionHandlerResult> => {
  return {
    success: true,
    updatedContent: '## Analysis Complete\n\nRevision requested.',
    updatedLabel: 'Revision Requested',
  };
};

export const QualityCheckBot: CommandBot = {
  id: 'bot-quality-check',
  // ... other fields
  commands: [analyzeCommand],
  actionHandlers: {
    approve: handleApprove,
    requestRevision: handleRequestRevision,
  },
};
```

## 6. Action handler results

The `BotActionHandlerResult` controls what happens after a click:

```typescript
interface BotActionHandlerResult {
  success: boolean;          // Whether the action succeeded
  updatedContent?: string;   // Replace the original message content
  updatedLabel?: string;     // Replace the button label
  error?: string;            // Error message if success is false
}
```

When `success` is `true`:
- The button is marked as `triggered` with the user's ID and timestamp
- If `updatedContent` is provided, the message content updates
- If `updatedLabel` is provided, the button text updates

When `success` is `false`:
- The `error` message is displayed to the user
- The button remains clickable

## 7. Pass parameters to action handlers

Include data in `handler.params` to pass context to the handler:

```typescript
// In the response
actions: files.map(file => ({
  id: `process-${file.id}`,
  label: `Process ${file.originalName}`,
  style: 'secondary' as const,
  handler: {
    botId: 'bot-quality-check',
    action: 'processFile',
    params: { fileId: file.id, fileName: file.originalName },
  },
}))

// In the handler
const handleProcessFile: BotActionHandler = async (params, context) => {
  const { fileId, fileName } = params;
  // Process the specific file...
  return {
    success: true,
    updatedLabel: `Processed ${fileName}`,
  };
};
```

## 8. Track action state

After an action is triggered, the message's metadata is updated with state:

```typescript
// After user clicks "Approve":
{
  id: 'approve',
  label: 'Approved',           // Updated via resultLabel
  triggered: true,
  triggeredBy: 'user-uuid',
  triggeredAt: '2024-03-15T10:30:00Z',
}
```

Your bot can check this state in subsequent commands to understand what actions have been taken.

## 9. Full example

```typescript
const analyzeCommand: BotCommand = {
  name: 'analyze',
  description: 'Run quality checks and present action buttons',
  usage: '@bot-quality-check analyze',
  parameters: [],
  examples: ['@bot-quality-check analyze'],
  permissions: ['read_manuscript_files'],

  async execute(params, context): Promise<BotResponse> {
    const client = createBotClient(context);
    const manuscript = await client.manuscripts.get();

    const issues = runQualityChecks(manuscript);
    const passed = issues.length === 0;

    const content = passed
      ? `## Quality Check Passed\n\nAll checks passed for "${manuscript.title}".`
      : `## Quality Check: ${issues.length} Issue(s)\n\n${issues.map(i => `- ${i}`).join('\n')}`;

    const actions: BotMessageAction[] = [];

    if (passed) {
      actions.push({
        id: 'approve',
        label: 'Approve',
        style: 'primary',
        targetRoles: ['ADMIN', 'EDITOR_IN_CHIEF', 'ACTION_EDITOR'],
        confirmText: 'Approve this manuscript for publication?',
        handler: { botId: 'bot-quality-check', action: 'approve', params: {} },
      });
    }

    actions.push({
      id: 'request-revision',
      label: 'Request Revision',
      style: 'secondary',
      targetRoles: ['ADMIN', 'EDITOR_IN_CHIEF', 'ACTION_EDITOR'],
      handler: { botId: 'bot-quality-check', action: 'requestRevision', params: {} },
    });

    return {
      messages: [{ content, actions }],
    };
  },
};
```

## Next steps

- [Commands Concept](../concepts/commands.md) — Command patterns and help system
- [Authentication](../concepts/authentication.md) — Service tokens and permissions
- [Bot API Types](../reference/bot-api.md) — Full type reference for actions
