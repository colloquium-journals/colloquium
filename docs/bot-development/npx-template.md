# Using create-colloquium-bot

The fastest way to create a new Colloquium bot is using the `create-colloquium-bot` npx package. This tool generates a complete, ready-to-publish bot package with all the boilerplate code, tests, and documentation.

## Quick Start

```bash
npx create-colloquium-bot bot-my-awesome
```

This will:
1. Guide you through interactive setup
2. Generate a complete bot package
3. Include TypeScript, tests, and documentation
4. Provide ready-to-run example code

**Note:** Bot names must start with `bot-` prefix (e.g., `bot-my-awesome`, `bot-plagiarism-checker`).

## Interactive Setup

The CLI will ask you for:

### Bot Information
- **Bot Name**: Unique identifier starting with `bot-` prefix (lowercase, hyphens allowed)
- **Description**: What your bot does
- **Category**: Choose from 6 predefined categories

### Package Details
- **Organization**: npm scope for your package
- **Author Info**: Name, email, website
- **Repository**: Git repository URL
- **License**: Choose from common licenses

### Generated Structure

```
bot-my-awesome/
├── src/
│   └── index.ts              # Main bot implementation
├── tests/
│   └── index.test.ts         # Comprehensive test suite
├── package.json              # Package configuration with Colloquium metadata
├── tsconfig.json             # TypeScript configuration
├── jest.config.js           # Test configuration
├── .eslintrc.js             # Code quality rules
├── .gitignore               # Git ignore patterns
├── README.md                # Complete documentation with examples
└── LICENSE                  # License file
```

## Generated Bot Features

### Commands
Every generated bot includes:

- **analyze**: Customizable analysis with multiple modes
- **help**: Auto-generated help documentation

### Configuration
- Multiple analysis modes (basic, standard, detailed)
- Boolean parameters with validation
- JSON report generation
- Error handling and timeouts

### Example Usage
```typescript
// Generated bot structure
export const MyAwesomeBot = {
  id: 'bot-my-awesome',  // Bot IDs must start with 'bot-' prefix
  name: 'My Awesome Bot',
  commands: [
    {
      name: 'analyze',
      parameters: [
        {
          name: 'mode',
          type: 'enum',
          defaultValue: 'standard',
          examples: ['basic', 'standard', 'detailed']
        }
      ],
      async execute(params, context) {
        const { mode } = params;
        const results = await performAnalysis(context.manuscriptId, mode);
        
        return {
          messages: [{
            content: `Analysis complete in ${mode} mode!`,
            attachments: [{
              type: 'report',
              filename: 'analysis-report.json',
              data: JSON.stringify(results)
            }]
          }]
        };
      }
    }
  ]
};
```

## Development Workflow

After generation:

```bash
cd bot-my-awesome

# Install dependencies
npm install

# Start development
npm run dev

# Run tests
npm test

# Check code quality
npm run lint

# Build for production
npm run build

# Publish to npm
npm publish
```

## Customization

### Adding New Commands

```typescript
const customCommand: BotCommand = {
  name: 'validate',
  description: 'Validate manuscript structure',
  parameters: [
    {
      name: 'strict',
      type: 'boolean',
      defaultValue: false
    }
  ],
  async execute(params, context) {
    // Your validation logic
    return {
      messages: [{ content: 'Validation complete!' }]
    };
  }
};

// Add to commands array
export const MyBot = {
  commands: [analyzeCommand, helpCommand, customCommand]
};
```

### Modifying Analysis Logic

The generated `performAnalysis` function includes placeholder logic:

```typescript
async function performAnalysis(manuscriptId: string, mode: string) {
  // Replace this with your actual analysis implementation
  
  // Example: Text analysis
  const manuscript = await fetchManuscript(manuscriptId);
  const wordCount = manuscript.content.split(' ').length;
  const issues = await detectIssues(manuscript, mode);
  
  return {
    itemsAnalyzed: wordCount,
    issuesFound: issues.length,
    confidence: calculateConfidence(issues),
    issues: issues,
    recommendations: generateRecommendations(issues)
  };
}
```

### Configuration Options

Update the manifest for custom configuration:

```typescript
export const manifest = {
  colloquium: {
    category: 'analysis', // Your category
    permissions: ['read_manuscript', 'read_files'], // Required permissions
    defaultConfig: {
      defaultMode: 'standard',
      enableNotifications: true,
      customSetting: 'value'
    }
  }
};
```

## Testing

Generated tests cover:

- ✅ Bot metadata validation
- ✅ Command functionality
- ✅ Parameter validation  
- ✅ Error handling
- ✅ Performance benchmarks
- ✅ Plugin manifest validation

### Adding Custom Tests

```typescript
describe('Custom Functionality', () => {
  test('should validate manuscript structure', async () => {
    const validateCommand = bot.commands.find(cmd => cmd.name === 'validate');
    const result = await validateCommand.execute(
      { strict: true },
      mockContext
    );
    
    expect(result.messages[0].content).toContain('Validation complete');
  });
});
```

## Categories

Choose the appropriate category for your bot:

| Category | Use Cases | Examples |
|----------|-----------|----------|
| `editorial` | Workflow automation, reviewer assignment | Editorial Bot, Review Manager |
| `analysis` | Content analysis, insights | Statistics Bot, Readability Checker |
| `quality` | Validation, compliance | Reference Bot, Format Checker |
| `formatting` | Style, layout, citations | Citation Formatter, Style Guide |
| `integration` | External services | Slack Bot, Email Notifier |
| `utility` | General tools | File Converter, Backup Bot |

## Publishing Guidelines

### Package Naming
- Use descriptive, searchable names
- Follow `@yourorg/botname-bot` pattern
- Avoid generic terms like "helper" or "utility"

### Documentation
- Include clear usage examples
- Document all parameters
- Explain configuration options
- Add troubleshooting section

### Quality Standards
- Maintain >80% test coverage
- Follow TypeScript strict mode
- Use comprehensive error handling
- Include performance considerations

## Command Line Options

```bash
# Interactive mode (recommended)
npx create-colloquium-bot

# Specify bot name (must start with bot-)
npx create-colloquium-bot bot-my-feature

# Non-interactive with defaults
npx create-colloquium-bot bot-my-feature --yes

# Show help
npx create-colloquium-bot --help
```

## Examples

### Analysis Bot
```bash
npx create-colloquium-bot bot-readability-checker
# Category: analysis
# Implement text readability algorithms
```

### Integration Bot
```bash
npx create-colloquium-bot bot-slack-notifier
# Category: integration
# Add Slack webhook integration
```

### Quality Bot
```bash
npx create-colloquium-bot bot-citation-validator
# Category: quality
# Implement citation format checking
```

## Troubleshooting

### Common Issues

**Template not found**
```bash
npx create-colloquium-bot@latest bot-my-feature
```

**Permission denied**
```bash
# Use a different directory
cd ~/projects
npx create-colloquium-bot bot-my-feature
```

**Package name conflicts**
```bash
# Choose a unique name or scope
npx create-colloquium-bot bot-my-unique-feature
```

## Advanced Usage

### Custom Templates
Future versions will support custom templates:

```bash
npx create-colloquium-bot bot-my-feature --template advanced
npx create-colloquium-bot bot-my-feature --template integration
```

### Configuration File
For repeated bot creation:

```json
// .create-bot-config.json
{
  "author": {
    "name": "Your Name",
    "email": "you@example.com",
    "url": "https://yoursite.com"
  },
  "org": "yourorg",
  "license": "MIT",
  "defaultCategory": "analysis"
}
```

## Support

- 📖 [Bot Development Guide](../README.md)
- 🐛 [Report Issues](https://github.com/colloquium/colloquium/issues)
- 💬 [Discord Community](https://discord.gg/colloquium)
- 📧 team@colloquium.org

---

Next: [Publishing Your Bot](./publishing.md)