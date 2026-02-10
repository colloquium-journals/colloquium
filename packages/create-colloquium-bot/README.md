# create-colloquium-bot

🤖 Create a new Colloquium bot package with a single command.

## Quick Start

Create a new bot package using npx (no installation required):

```bash
npx create-colloquium-bot bot-my-awesome
```

Or install globally:

```bash
npm install -g create-colloquium-bot
create-colloquium-bot bot-my-awesome
```

**Note:** Bot names must start with `bot-` prefix (e.g., `bot-my-awesome`, `bot-plagiarism-checker`).

## Features

- 🚀 **Zero Configuration**: Get started immediately with sensible defaults
- 🎯 **Interactive Setup**: Guided prompts for all configuration options
- 📦 **Complete Package**: Generates ready-to-publish npm package
- 🧪 **Testing Ready**: Includes Jest setup with comprehensive test suite
- 📚 **Full Documentation**: Auto-generated README with examples
- 🔧 **Development Tools**: TypeScript, ESLint, and build scripts included
- 🏷️ **Multiple Categories**: Choose from editorial, analysis, quality, and more

## Usage

### Interactive Mode (Recommended)

```bash
npx create-colloquium-bot
```

The CLI will guide you through the setup process:

1. **Bot Name**: Choose a unique identifier starting with `bot-` prefix (lowercase, hyphens allowed)
2. **Description**: Describe what your bot does
3. **Category**: Select from predefined categories
4. **Author Info**: Your name, email, and website
5. **License**: Choose from common open source licenses
6. **Keywords**: Help others discover your bot

### Non-Interactive Mode

```bash
npx create-colloquium-bot my-bot --yes
```

Uses sensible defaults for quick prototyping.

### Command Line Options

```bash
npx create-colloquium-bot [bot-name] [options]

Options:
  -y, --yes                Skip prompts and use defaults
  --template <template>    Template to use (basic, advanced)
  -h, --help              Display help for command
  -V, --version           Display version number
```

## What Gets Generated

A complete bot package with:

```
bot-my-awesome/
├── src/
│   └── index.ts          # Main bot implementation
├── tests/
│   └── index.test.ts     # Comprehensive test suite
├── package.json          # Package configuration
├── tsconfig.json         # TypeScript configuration
├── jest.config.js        # Test configuration
├── eslint.config.mjs    # ESLint 9 flat config
├── .gitignore           # Git ignore patterns
├── README.md            # Complete documentation
└── LICENSE              # License file
```

### Generated Bot Features

- **Multiple Commands**: Pre-built `analyze` and `help` commands
- **Parameter Validation**: Type-safe parameter handling with Zod
- **Error Handling**: Comprehensive error management
- **Report Generation**: JSON report attachments
- **Configurable Options**: Customizable analysis modes
- **Rich Documentation**: Auto-generated help and examples

## Example Generated Bot

```typescript
// Generated bot with analyze command
export const MyAwesomeBot = {
  id: 'bot-my-awesome',  // Bot IDs must start with 'bot-' prefix
  name: 'My Awesome Bot',
  commands: [
    {
      name: 'analyze',
      async execute(params, context) {
        // Your bot logic here
        return {
          messages: [{
            content: 'Analysis complete!',
            attachments: [/* reports */]
          }]
        };
      }
    }
  ]
};
```

## Bot Categories

Choose from these predefined categories:

| Category | Description |
|----------|-------------|
| `editorial` | Editorial workflow automation |
| `analysis` | Manuscript analysis and insights |
| `quality` | Quality assurance and validation |
| `formatting` | Document formatting and style |
| `integration` | External service integrations |
| `utility` | General utility functions |

## Development Workflow

After generating your bot:

```bash
cd bot-my-awesome

# Install dependencies
npm install

# Start development mode
npm run dev

# Run tests
npm test

# Build for production
npm run build

# Publish to npm
npm publish
```

## Generated Commands

Every bot includes these commands out of the box:

### `analyze` Command
- Multiple analysis modes (basic, standard, detailed)
- Configurable parameters
- JSON report generation
- Rich markdown output

### `help` Command
- Auto-generated help text
- Usage examples
- Parameter documentation
- Configuration options

## Customization

The generated code is fully customizable:

### Add New Commands

```typescript
const customCommand: BotCommand = {
  name: 'custom',
  description: 'Custom functionality',
  async execute(params, context) {
    // Your implementation
  }
};

// Add to bot commands array
export const MyBot = {
  commands: [analyzeCommand, helpCommand, customCommand]
};
```

### Modify Analysis Logic

```typescript
async function performAnalysis(manuscriptId: string, mode: string) {
  // Replace with your analysis implementation
  const results = await myCustomAnalysis(manuscriptId);
  return results;
}
```

### Update Configuration

```typescript
export const manifest = {
  colloquium: {
    category: 'analysis',
    permissions: ['read_manuscript', 'read_files'],
    defaultConfig: {
      // Your default settings
    }
  }
};
```

## Testing

Generated packages include comprehensive tests:

- ✅ Bot metadata validation
- ✅ Command functionality testing
- ✅ Parameter validation
- ✅ Error handling verification
- ✅ Performance benchmarks
- ✅ Plugin manifest validation

Run tests with coverage:

```bash
npm test -- --coverage
```

## Publishing

When ready to publish your bot:

1. **Update Version**: Bump version in `package.json`
2. **Run Tests**: Ensure all tests pass
3. **Build Package**: `npm run build`
4. **Publish**: `npm publish`

### Naming Conventions

Follow these conventions:

- **Bot IDs**: Must start with `bot-` prefix (e.g., `bot-plagiarism-checker`)
- **Package names**: Use `-bot` suffix: `@yourorg/plagiarism-checker-bot`
- **Descriptive**: Use clear, searchable names
- **Reserved prefix**: The `bot-` username prefix is reserved for system bots

## Templates

### Basic Template (Default)
- Single `analyze` command
- Standard configuration
- Complete test suite
- Ready for customization

### Advanced Template (Coming Soon)
- Multiple specialized commands
- Advanced parameter validation
- Integration examples
- Performance optimization

## Requirements

- Node.js >= 16.0.0
- npm >= 8.0.0

## Examples

### Create Analysis Bot
```bash
npx create-colloquium-bot bot-manuscript-analyzer
# Choose "analysis" category
# Implement custom analysis logic
```

### Create Integration Bot
```bash
npx create-colloquium-bot bot-slack-notifier
# Choose "integration" category
# Add Slack webhook integration
```

### Create Quality Bot
```bash
npx create-colloquium-bot bot-citation-checker
# Choose "quality" category
# Implement citation validation
```

## Best Practices

### Code Quality
- Use TypeScript strict mode
- Follow ESLint rules
- Maintain >80% test coverage
- Document all functions

### Security
- Validate all inputs
- Use least-privilege permissions
- Handle errors gracefully
- Sanitize outputs

### Performance
- Implement timeouts
- Use efficient algorithms
- Cache when appropriate
- Monitor resource usage

### User Experience
- Provide clear error messages
- Include helpful examples
- Support configuration
- Generate useful reports

## Troubleshooting

### Template Generation Issues

**Problem**: Template files not found
```bash
Error: ENOENT: no such file or directory, open 'templates/...'
```

**Solution**: Ensure you're using the published package:
```bash
npx create-colloquium-bot@latest my-bot
```

### Package Name Conflicts

**Problem**: Package name already exists
```bash
Error: Invalid package name "@myorg/existing-bot": already exists
```

**Solution**: Choose a unique name or scope:
```bash
npx create-colloquium-bot bot-my-unique-feature
```

### Permission Issues

**Problem**: Cannot write to directory
```bash
Error: EACCES: permission denied, mkdir '/path/to/bot'
```

**Solution**: Check directory permissions or choose different location:
```bash
cd ~/projects
npx create-colloquium-bot bot-my-feature
```

## Support

- 📖 **Documentation**: [Colloquium Bot Development](https://docs.colloquium.org/bot-development)
- 🐛 **Issues**: [GitHub Issues](https://github.com/colloquium/colloquium/issues)
- 💬 **Discord**: [Community Chat](https://discord.gg/colloquium)
- 📧 **Email**: team@colloquium.org

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add your improvements
4. Include tests
5. Submit a pull request

## License

MIT License - see [LICENSE](LICENSE) for details.

---

Made with ❤️ for the Colloquium academic publishing platform.