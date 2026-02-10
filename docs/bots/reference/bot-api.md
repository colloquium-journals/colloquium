# Bot API Type Reference

TypeScript types from `@colloquium/types` used in bot development.

## CommandBot

The main bot definition:

```typescript
interface CommandBot {
  id: string;                          // Must start with 'bot-'
  name: string;                        // Display name
  description: string;
  version: string;                     // Semver
  commands: BotCommand[];              // At least one required
  keywords: string[];                  // Trigger keywords
  triggers: string[];                  // Event triggers
  permissions: string[];               // Required permissions
  supportsFileUploads?: boolean;
  help: {
    overview: string;
    quickStart: string;
    examples: string[];
  };
  customHelpSections?: BotCustomHelpSection[];
  onInstall?: (context: BotInstallationContext) => Promise<void>;
  actionHandlers?: Record<string, BotActionHandler>;
}
```

## BotCommand

```typescript
interface BotCommand {
  name: string;
  description: string;
  usage: string;
  parameters: BotCommandParameter[];
  examples: string[];
  permissions: string[];
  help?: string;  // Detailed help text
  execute: (params: Record<string, any>, context: any) => Promise<any>;
}
```

## BotCommandParameter

```typescript
interface BotCommandParameter {
  name: string;
  description: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'enum';
  required: boolean;
  defaultValue?: any;
  enumValues?: string[];
  validation?: z.ZodSchema;
  examples?: string[];
}
```

## BotContext

Passed to command `execute` functions:

```typescript
interface BotContext {
  conversationId: string;
  manuscriptId: string;
  triggeredBy: {
    messageId: string;
    userId: string;
    userRole: string;
    trigger: BotTrigger;
  };
  journal: { id: string; settings: Record<string, any> };
  config: Record<string, any>;
  serviceToken?: string;

  // Pre-fetched data (enriched context)
  manuscript?: {
    title: string;
    abstract: string | null;
    authors: string[];
    status: string;
    keywords: string[];
    workflowPhase: string | null;
    workflowRound: number;
  };
  files?: Array<{
    id: string;
    originalName: string;
    filename: string;
    fileType: string;
    mimetype: string;
    size: number;
  }>;
}
```

## BotResponse

Returned from command `execute`:

```typescript
interface BotResponse {
  botId?: string;
  messages?: Array<{
    content: string;
    replyTo?: string;
    attachments?: BotAttachment[];
    actions?: BotMessageAction[];
  }>;
  actions?: BotAction[];
  errors?: string[];
}
```

## BotAttachment

```typescript
interface BotAttachment {
  type: 'file' | 'report' | 'analysis';
  filename: string;
  data: any;
  mimetype?: string;
}
```

## BotMessageAction

Interactive buttons in bot messages:

```typescript
interface BotMessageAction {
  id: string;
  label: string;
  style?: 'primary' | 'secondary' | 'danger';
  confirmText?: string;
  targetUserId?: string;
  targetRoles?: string[];
  handler: {
    botId: string;
    action: string;
    params: Record<string, any>;
  };
}
```

## BotAction

Side effects the bot wants to perform:

```typescript
interface BotAction {
  type: 'UPDATE_MANUSCRIPT_STATUS' | 'ASSIGN_REVIEWER' |
        'MAKE_EDITORIAL_DECISION' | 'ASSIGN_ACTION_EDITOR' |
        'EXECUTE_PUBLICATION_WORKFLOW' | 'UPDATE_WORKFLOW_PHASE' |
        'SEND_MANUAL_REMINDER' | ...;
  data: Record<string, any>;
}
```

## BotActionHandler

Handles button clicks from BotMessageAction:

```typescript
type BotActionHandler = (
  params: Record<string, any>,
  context: BotActionHandlerContext
) => Promise<BotActionHandlerResult>;

interface BotActionHandlerContext {
  manuscriptId: string;
  conversationId: string;
  messageId: string;
  triggeredBy: { userId: string; userRole: string };
  serviceToken: string;
}

interface BotActionHandlerResult {
  success: boolean;
  updatedContent?: string;
  updatedLabel?: string;
  error?: string;
}
```

## BotPluginManifest

Package manifest for bot plugins:

```typescript
// Validated by botPluginManifestSchema (Zod)
interface BotPluginManifest {
  name: string;
  version: string;
  description: string;
  author: { name: string; email?: string; url?: string };
  license?: string;
  keywords?: string[];
  colloquium: {
    botId: string;
    apiVersion: string;
    botApiVersion: number;     // Integer, minimum 1
    permissions: string[];
    isDefault: boolean;
    category?: 'editorial' | 'analysis' | 'formatting' | 'quality' | 'integration' | 'utility';
    supportsFileUploads?: boolean;
  };
}
```
