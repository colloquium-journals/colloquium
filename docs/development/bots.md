# Bot Framework

Colloquium's bot framework provides automated assistance for editorial workflows, manuscript processing, and quality assurance. Bots can be mentioned in conversations to execute specific actions or run automatically based on triggers.

## Overview

The bot system is designed with security, extensibility, and transparency in mind:

- **Permission-Based**: Each bot declares required permissions upfront
- **Auditable**: All bot actions are logged with complete execution history
- **Extensible**: Easy to create new bots for custom workflows
- **Role-Aware**: Bots respect user roles and manuscript relationships

## Bot Architecture

### Core Components

```
BotRegistry → Manages bot lifecycle and execution
├── BotDefinition → Metadata, permissions, actions
├── BotAction → Individual executable functions  
├── BotExecution → Audit trail of bot runs
├── BotPermission → Security controls
└── BotInstall → Configuration and enablement
```

### Database Schema

- **`bot_definitions`**: Bot metadata, version, permissions
- **`bot_actions`**: Available actions with input schemas
- **`bot_installs`**: Installation status and configuration
- **`bot_executions`**: Complete audit trail of all executions

## Data Access Patterns

### Standard API-Based Access (Recommended)

**All bots should use API endpoints for data access rather than direct database queries.** This ensures:

- **Consistent authentication/authorization** across all bot operations
- **Uniform error handling** and response formats
- **Centralized permission checking** through existing middleware
- **Consistent audit trails** and logging
- **Proper data validation** through API schemas
- **Cache coherency** and data consistency

### Correct Pattern: API Calls

```typescript
// ✅ CORRECT: Use API endpoints
async execute(input: any, context: BotExecutionContext): Promise<BotActionResult> {
  const { botServiceToken } = context;
  
  // Fetch manuscript data via API
  const manuscriptResponse = await fetch(`http://localhost:4000/api/articles/${input.manuscriptId}`, {
    headers: {
      'Authorization': `Bearer ${botServiceToken}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (!manuscriptResponse.ok) {
    throw new Error('Failed to fetch manuscript data');
  }
  
  const manuscript = await manuscriptResponse.json();
  
  // Access assignment data from API response
  const assignedEditor = manuscript.action_editors;
  const reviewerAssignments = manuscript.reviewAssignments;
  
  return {
    success: true,
    data: { assignedEditor, reviewerAssignments }
  };
}
```

### Anti-Pattern: Direct Database Access

```typescript
// ❌ INCORRECT: Direct database queries
async execute(input: any, context: BotExecutionContext): Promise<BotActionResult> {
  // This creates inconsistent patterns and bypasses API security
  const { prisma } = await import('@colloquium/database');
  
  const manuscript = await prisma.manuscripts.findUnique({
    where: { id: input.manuscriptId },
    include: {
      action_editors: { /* ... */ },
      review_assignments: { /* ... */ }
    }
  });
  
  // This bypasses API middleware, permissions, and audit trails
  return { success: true, data: manuscript };
}
```

### Bot Service Token Authentication

Bots receive service tokens that provide appropriate permissions:

```typescript
interface BotExecutionContext {
  userId?: string;
  manuscriptId?: string;
  conversationId?: string;
  messageId?: string;
  botServiceToken: string;  // Use this for API authentication
}
```

### API Endpoints for Bot Data Access

**Assignment Data** (Single Source of Truth):
- `GET /api/articles/:id` - Manuscript data including `action_editors` and `reviewAssignments`

**Reviewer Assignment Operations**:
- `POST /api/articles/:id/reviewers` - Create reviewer assignment
- `PUT /api/articles/:id/reviewers/:reviewerId` - Update reviewer assignment status
- `GET /api/articles/:id/reviewers/:reviewerId` - Get specific reviewer assignment

**Conversation Data**:
- `GET /api/conversations/:id` - Conversation metadata (no assignment data)

**User Data**:
- `GET /api/users/:id` - User information and permissions
- `GET /api/users?search=:query` - Search for users by name

### Migration from Direct Database Access

If you have existing bots using direct database queries:

1. **Replace database imports** with API calls
2. **Use context.botServiceToken** for authentication
3. **Update error handling** to work with HTTP responses
4. **Test permission enforcement** through API middleware
5. **Verify audit trails** are properly logged

## Creating a New Bot

### 1. Define Bot Actions

Each bot action implements the `BotAction` interface:

```typescript
import { BotAction, BotExecutionContext, BotActionResult } from '../BotRegistry';

class MyCustomAction implements BotAction {
  name = 'my_action';
  description = 'Description of what this action does';
  
  // JSON Schema for input validation
  inputSchema = {
    type: 'object',
    properties: {
      manuscriptId: { type: 'string', description: 'Target manuscript ID' },
      parameter: { type: 'string', description: 'Custom parameter' }
    },
    required: ['manuscriptId']
  };

  async execute(input: any, context: BotExecutionContext): Promise<BotActionResult> {
    try {
      // Your bot logic here
      const result = await this.performAction(input, context);
      
      return {
        success: true,
        data: result,
        message: 'Action completed successfully'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  private async performAction(input: any, context: BotExecutionContext) {
    // Implementation details
  }
}
```

### 2. Create Bot Definition

```typescript
import { Bot } from '../BotRegistry';

export const MyCustomBot: Bot = {
  id: 'bot-my-custom',  // Bot IDs must start with 'bot-' prefix
  name: 'My Custom Bot',
  description: 'Detailed description of what this bot does',
  version: '1.0.0',
  author: 'Your Name',
  
  // Required permissions
  permissions: [
    {
      permission: 'manuscript.read',
      description: 'Read manuscript content and metadata'
    },
    {
      permission: 'manuscript.update',
      description: 'Update manuscript status and metadata'
    }
  ],
  
  // Available actions
  actions: [
    new MyCustomAction(),
    // Add more actions as needed
  ],
  
  // Configuration schema (optional)
  configSchema: {
    type: 'object',
    properties: {
      autoTrigger: {
        type: 'boolean',
        description: 'Enable automatic triggering',
        default: false
      },
      threshold: {
        type: 'number',
        description: 'Processing threshold',
        default: 0.8
      }
    }
  }
};
```

### 3. Register the Bot

Add your bot to the registry in `src/bots/index.ts`:

```typescript
import { MyCustomBot } from './MyCustomBot';

export async function initializeBots() {
  // Register your bot
  BotRegistry.registerBot(MyCustomBot);
  
  // Install with default configuration
  await BotRegistry.installBot(MyCustomBot.id, {
    autoTrigger: false,
    threshold: 0.8
  });
}
```

## Installing Bots

### Via API (Admin Only)

```bash
# Install a bot
curl -X POST http://localhost:4000/api/bots/my-custom-bot/install \
  -H "Content-Type: application/json" \
  -H "Cookie: auth-token=your-jwt-token" \
  -d '{"config": {"autoTrigger": true}}'

# Configure a bot
curl -X PUT http://localhost:4000/api/bots/my-custom-bot/configure \
  -H "Content-Type: application/json" \
  -H "Cookie: auth-token=your-jwt-token" \
  -d '{"config": {"threshold": 0.9}, "isEnabled": true}'
```

### Programmatically

```typescript
import { BotRegistry } from '../bots';

// Install with custom configuration
await BotRegistry.installBot('my-custom-bot', {
  autoTrigger: true,
  threshold: 0.9,
  customSetting: 'value'
});
```

## Using Bots

### 1. Mention in Conversations

Users can mention bots in conversation messages using their bot ID (always starts with `bot-`):

```
@bot-editorial please assign john.doe@university.edu as a reviewer for this manuscript
```

### 2. Direct API Execution

```bash
curl -X POST http://localhost:4000/api/bots/editorial-bot/execute/assign_reviewer \
  -H "Content-Type: application/json" \
  -H "Cookie: auth-token=your-jwt-token" \
  -d '{
    "input": {
      "manuscriptId": "manuscript-id-here",
      "reviewerId": "user-id-here",
      "dueDate": "2024-02-15"
    },
    "manuscriptId": "manuscript-id-here"
  }'
```

### 3. Frontend Integration

Bots appear in the message composer's mention dropdown when enabled:

```typescript
// Bots are automatically fetched and displayed
// Users can select from available bots
// Bot actions can be triggered through UI forms
```

## Permission System

### Bot Permissions

Bots declare required permissions that are checked before execution:

```typescript
permissions: [
  {
    permission: 'manuscript.assign_reviewer',
    description: 'Assign reviewers to manuscripts'
  },
  {
    permission: 'manuscript.make_decision', 
    description: 'Make editorial decisions'
  }
]
```

### User Permission Checking

```typescript
// Permission check example
const canExecute = await BotRegistry.checkPermission(
  'editorial-bot',
  'assign_reviewer', 
  userId,
  manuscriptId
);

if (!canExecute) {
  throw new Error('Insufficient permissions');
}
```

### Permission Rules

- **Admins**: Can execute any bot action
- **Editors**: Can execute most editorial bot actions
- **Authors**: Limited to actions on their own manuscripts
- **Reviewers**: Limited to review-related actions

## Execution & Monitoring

### Execution History

All bot executions are logged:

```bash
# Get execution history
curl http://localhost:4000/api/bots/editorial-bot/executions
```

### Execution Context

Bots receive context about the execution environment:

```typescript
interface BotExecutionContext {
  userId?: string;           // Who triggered the action
  manuscriptId?: string;     // Target manuscript
  conversationId?: string;   // Source conversation
  messageId?: string;        // Triggering message
}
```

### Error Handling

```typescript
// Executions can fail gracefully
{
  success: false,
  error: "Reviewer already assigned to this manuscript",
  // Execution is logged as FAILED status
}
```

## API Reference

### Bot Management Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/api/bots` | List all bots | Required |
| `GET` | `/api/bots/:id` | Get bot details | Required |
| `POST` | `/api/bots/:id/install` | Install bot | Admin |
| `PUT` | `/api/bots/:id/configure` | Update configuration | Admin |
| `POST` | `/api/bots/:id/execute/:action` | Execute action | Role-based |
| `GET` | `/api/bots/:id/executions` | Get execution history | Required |

### Response Examples

```json
// GET /api/bots
{
  "bots": [
    {
      "id": "editorial-bot",
      "name": "Editorial Bot", 
      "description": "Automated editorial assistant",
      "version": "1.0.0",
      "isInstalled": true,
      "isEnabled": true,
      "actions": [
        {
          "name": "assign_reviewer",
          "description": "Assign a reviewer to a manuscript",
          "inputSchema": { ... }
        }
      ],
      "permissions": [ ... ]
    }
  ]
}

// POST /api/bots/:id/execute/:action
{
  "message": "Action executed successfully",
  "result": {
    "id": "review-assignment-id",
    "manuscriptId": "manuscript-id",
    "reviewerId": "reviewer-id",
    "status": "PENDING"
  },
  "botMessage": "Successfully assigned reviewer@example.com as reviewer"
}
```

## Best Practices

### Security

- **Validate Input**: Always validate input against JSON schemas
- **Check Permissions**: Verify user permissions before execution
- **Audit Everything**: Log all actions for transparency
- **Fail Safe**: Handle errors gracefully and provide clear messages

### Performance

- **Async Operations**: Use async/await for database operations
- **Batch Operations**: Group multiple actions when possible
- **Timeout Handling**: Set reasonable timeouts for long operations
- **Resource Cleanup**: Clean up resources in finally blocks

### User Experience

- **Clear Descriptions**: Write helpful action descriptions
- **Meaningful Errors**: Provide actionable error messages
- **Progress Feedback**: Show progress for long-running operations
- **Documentation**: Document bot capabilities and usage

### Testing

```typescript
// Example bot test
describe('Editorial Bot', () => {
  it('should assign reviewer successfully', async () => {
    const result = await BotRegistry.executeAction(
      'editorial-bot',
      'assign_reviewer',
      {
        manuscriptId: 'test-manuscript',
        reviewerId: 'test-reviewer'
      },
      {
        userId: 'test-editor',
        manuscriptId: 'test-manuscript'
      }
    );
    
    expect(result.success).toBe(true);
    expect(result.data.reviewerId).toBe('test-reviewer');
  });
});
```

## Troubleshooting

### Common Issues

1. **"Bot not found"**: Ensure bot is registered in `initializeBots()` and bot ID starts with `bot-` prefix
2. **"Permission denied"**: Check user role and bot permissions
3. **"Bot not installed"**: Install bot via API or programmatically
4. **"Action failed"**: Check execution logs for detailed error messages
5. **"Invalid bot ID"**: Bot IDs must start with `bot-` prefix (e.g., `bot-my-custom`)

### Debugging

```typescript
// Enable debug logging
console.log('Bot execution context:', context);
console.log('Input parameters:', input);

// Check bot registration (bot IDs start with 'bot-' prefix)
const bot = BotRegistry.getBot('bot-my-custom');
console.log('Bot registered:', !!bot);

// Verify permissions
const hasPermission = await BotRegistry.checkPermission(
  'bot-my-custom',
  'my-action',
  userId,
  manuscriptId
);
console.log('User has permission:', hasPermission);
```

### Error Codes

- **400**: Invalid input parameters
- **401**: Authentication required
- **403**: Insufficient permissions
- **404**: Bot or action not found
- **500**: Internal bot execution error