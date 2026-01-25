# Colloquium Bots

Colloquium's bot ecosystem provides intelligent automation for editorial workflows, manuscript processing, and quality assurance. Bots can be mentioned in conversations, triggered automatically, or executed directly via API.

## Available Bots

### 🤖 **Editorial Bot** (Fully Implemented)
- **Purpose**: Automate core editorial workflows
- **Actions**: Assign reviewers, designate action editors, make editorial decisions
- **Status**: ✅ Active and fully functional
- **[📖 Documentation](./editorial-bot.md)**

### 🔍 **Plagiarism Checker** (Planned)
- **Purpose**: Detect potential plagiarism and maintain academic integrity
- **Actions**: Scan manuscripts, generate reports, check specific sections
- **Status**: 🚧 Seeded but not yet implemented
- **[📖 Documentation](./plagiarism-checker.md)**

### 📊 **Statistics Reviewer** (Planned) 
- **Purpose**: Validate statistical methods and reporting
- **Actions**: Review analyses, check power calculations, validate data presentation
- **Status**: 🚧 Seeded but not yet implemented  
- **[📖 Documentation](./statistics-reviewer.md)**

## Quick Start

### Using Bots in Conversations

Mention bots directly in conversation messages using their bot ID (always starts with `bot-`):

```
@bot-editorial assign reviewer@university.edu as reviewer for this manuscript

@bot-plagiarism-checker scan this manuscript for potential plagiarism

@bot-statistics check the statistical analysis in the results section
```

### Using Bots via API

Execute bot actions directly:

```bash
# Assign a reviewer using Editorial Bot
curl -X POST http://localhost:4000/api/bots/editorial-bot/execute/assign_reviewer \
  -H "Content-Type: application/json" \
  -H "Cookie: auth-token=your-jwt-token" \
  -d '{
    "input": {
      "manuscriptId": "ms-123",
      "reviewerId": "reviewer-456",
      "dueDate": "2024-02-15"
    }
  }'
```

### Checking Available Bots

```bash
# List all installed bots
curl http://localhost:4000/api/bots \
  -H "Cookie: auth-token=your-jwt-token"
```

## Bot Architecture

### Core Components

```
🏗️ BotRegistry
├── 📋 BotDefinition (metadata, permissions, configuration)
├── ⚡ BotAction (executable functions with input validation)
├── 🔐 BotPermission (security controls and access rules)
├── 📦 BotInstall (installation status and configuration)
└── 📊 BotExecution (complete audit trail of all runs)
```

### Security Model

- **Permission-Based**: Each bot declares required permissions upfront
- **Role-Aware**: Actions respect user roles and manuscript relationships
- **Auditable**: Every bot execution is logged with complete context
- **Configurable**: Admins control bot installation and configuration

## Common Use Cases

### Editorial Workflow Automation

```bash
# Complete manuscript assignment workflow
@bot-editorial set editor@journal.org as action editor for manuscript ms-123
@bot-editorial assign reviewer1@university.edu as reviewer with due date 2024-02-15
@bot-editorial assign reviewer2@institute.org as reviewer with due date 2024-02-15

# Later, after reviews are complete
@bot-editorial accept manuscript ms-123 with comments "Excellent contribution"
```

### Quality Assurance Pipeline

```bash
# Automated quality checks
@bot-plagiarism-checker scan manuscript ms-123 for potential plagiarism
@bot-statistics check statistical methods in manuscript ms-123

# Generate comprehensive reports
@bot-plagiarism-checker generate report for scan scan-456
@bot-statistics generate statistics report for review stats-789
```

### Batch Operations

```bash
# Assign multiple reviewers
curl -X POST http://localhost:4000/api/bots/editorial-bot/execute/assign_reviewer \
  -d '{"input": {"manuscriptId": "ms-123", "reviewerId": "reviewer-1", "dueDate": "2024-02-15"}}'

curl -X POST http://localhost:4000/api/bots/editorial-bot/execute/assign_reviewer \
  -d '{"input": {"manuscriptId": "ms-123", "reviewerId": "reviewer-2", "dueDate": "2024-02-15"}}'
```

## Access Control

### Who Can Use Bots

| Bot Type | Public | Author | Reviewer | Editor | Admin |
|----------|--------|--------|----------|--------|-------|
| **Editorial Bot** | ❌ | ❌ | ❌ | ✅ | ✅ |
| **Plagiarism Checker** | ❌ | ❌ | ✅ | ✅ | ✅ |
| **Statistics Reviewer** | ❌ | ❌ | ✅ | ✅ | ✅ |

### Permission System

Bots require specific permissions that are checked before execution:

- `manuscript.assign_reviewer` - Assign reviewers to manuscripts
- `manuscript.make_decision` - Make editorial decisions
- `manuscript.read` - Access manuscript content
- `manuscript.attach_report` - Attach reports to manuscripts

## Bot Management (Admin Only)

### Installation

```bash
# Install a bot with custom configuration
curl -X POST http://localhost:4000/api/bots/editorial-bot/install \
  -H "Content-Type: application/json" \
  -H "Cookie: auth-token=admin-token" \
  -d '{
    "config": {
      "autoAssignReviewers": false,
      "defaultReviewDays": 21,
      "requireActionEditor": true
    }
  }'
```

### Configuration

```bash
# Update bot configuration
curl -X PUT http://localhost:4000/api/bots/editorial-bot/configure \
  -H "Content-Type: application/json" \
  -H "Cookie: auth-token=admin-token" \
  -d '{
    "config": {
      "defaultReviewDays": 30
    },
    "isEnabled": true
  }'
```

### Monitoring

```bash
# View bot execution history
curl http://localhost:4000/api/bots/editorial-bot/executions \
  -H "Cookie: auth-token=admin-token"

# Get detailed bot information
curl http://localhost:4000/api/bots/editorial-bot \
  -H "Cookie: auth-token=admin-token"
```

## Creating Custom Bots

### 1. Define Bot Actions

```typescript
import { BotAction, BotExecutionContext, BotActionResult } from '../BotRegistry';

class CustomAction implements BotAction {
  name = 'custom_action';
  description = 'Description of custom action';
  
  inputSchema = {
    type: 'object',
    properties: {
      manuscriptId: { type: 'string', description: 'Target manuscript' },
      parameter: { type: 'string', description: 'Custom parameter' }
    },
    required: ['manuscriptId']
  };

  async execute(input: any, context: BotExecutionContext): Promise<BotActionResult> {
    // Implementation here
    return {
      success: true,
      data: { result: 'success' },
      message: 'Action completed successfully'
    };
  }
}
```

### 2. Create Bot Definition

```typescript
export const CustomBot: Bot = {
  id: 'bot-custom',  // Bot IDs must start with 'bot-' prefix
  name: 'Custom Bot',
  description: 'Description of what this bot does',
  version: '1.0.0',
  author: 'Your Name',
  permissions: [
    {
      permission: 'manuscript.read',
      description: 'Read manuscript content'
    }
  ],
  actions: [new CustomAction()],
  configSchema: { /* JSON Schema for configuration */ }
};
```

### 3. Register and Install

```typescript
// In src/bots/index.ts
import { CustomBot } from './CustomBot';

export async function initializeBots() {
  BotRegistry.registerBot(CustomBot);
  await BotRegistry.installBot(CustomBot.id, { /* default config */ });
}
```

For detailed instructions, see the [Bot Development Guide](../development/bots.md).

## Best Practices

### For Bot Users

1. **Clear Instructions**: Provide specific, actionable requests when mentioning bots
2. **Context Aware**: Include manuscript IDs and relevant parameters
3. **Review Results**: Always review bot outputs before taking action
4. **Understand Limitations**: Know what each bot can and cannot do

### For Bot Developers

1. **Input Validation**: Always validate inputs against JSON schemas
2. **Error Handling**: Provide clear, actionable error messages
3. **Permission Checks**: Verify user permissions before execution
4. **Audit Trail**: Log all actions for transparency and debugging
5. **Documentation**: Provide comprehensive usage examples

### For Administrators

1. **Regular Monitoring**: Review bot execution logs regularly
2. **Configuration Management**: Keep bot configurations up to date
3. **User Training**: Ensure users understand how to use bots effectively
4. **Security Reviews**: Regularly audit bot permissions and access

## Troubleshooting

### Common Issues

| Issue | Possible Cause | Solution |
|-------|---------------|----------|
| "Bot not available" | Bot not installed or disabled | Check installation status |
| "Permission denied" | User lacks required permissions | Verify user role and permissions |
| "Action failed" | Invalid input or system error | Check execution logs for details |
| "Bot not responding" | Bot mention not recognized | Ensure exact bot name and @ symbol |

### Getting Help

1. **Check Documentation**: Review bot-specific documentation
2. **View Execution History**: Check recent executions for error patterns
3. **Test Permissions**: Verify user has required access
4. **Contact Administrators**: Report persistent issues to journal admins

### Debug Commands

```bash
# Check bot status
curl http://localhost:4000/api/bots/bot-name

# View recent executions
curl http://localhost:4000/api/bots/bot-name/executions?limit=10

# Test bot action
curl -X POST http://localhost:4000/api/bots/bot-name/execute/action-name \
  -d '{"input": {"test": "parameters"}}'
```

## Roadmap

### Short Term (Next Release)
- ✅ Complete Editorial Bot implementation
- 🚧 Implement Plagiarism Checker core functionality
- 🚧 Add Statistics Reviewer basic validation

### Medium Term (3-6 Months)
- 📋 Advanced plagiarism detection with multiple databases
- 📋 Comprehensive statistical analysis validation
- 📋 Bot mention parsing in conversation messages
- 📋 Automatic triggering based on manuscript events

### Long Term (6+ Months)
- 📋 AI-powered content analysis bots
- 📋 Custom bot marketplace
- 📋 Visual bot workflow builder
- 📋 Integration with external editorial systems
- 📋 Multi-language bot support

## Contributing

Interested in contributing to the bot ecosystem? Here's how:

1. **Report Issues**: Found a bug? Report it on [GitHub Issues](https://github.com/your-org/colloquium/issues)
2. **Suggest Features**: Have ideas for new bots? Start a discussion
3. **Contribute Code**: Fork the repo and submit a pull request
4. **Write Documentation**: Help improve bot documentation
5. **Test Bots**: Help test new bot functionality

See our [Contributing Guide](../../CONTRIBUTING.md) for detailed instructions.

---

*Building intelligent automation for academic publishing, one bot at a time.*