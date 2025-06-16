# @myorg/test-bot

A Colloquium bot for Test Bot functionality

## Features

- 🔍 **Smart Analysis**: Multiple analysis modes (basic, standard, detailed)
- 📊 **Comprehensive Reports**: JSON exports with detailed findings
- ⚙️ **Configurable**: Customizable analysis parameters
- 🚀 **Fast Processing**: Optimized for quick turnaround
- 📚 **Well Documented**: Complete API and usage documentation

## Installation

### Via Colloquium Admin Interface
1. Go to Admin → Bot Management
2. Click "Install Bot"
3. Enter package name: `@myorg/test-bot`
4. Click "Install"

### Via npm (for development)
```bash
npm install @myorg/test-bot
```

## Usage

Once installed, the bot can be used in any conversation by mentioning it:

### Commands

#### `@test-bot analyze`
Analyzes the manuscript content with customizable options.

**Parameters:**
- `mode` (string, default: "standard") - Analysis mode
  - `basic` - Quick overview analysis
  - `standard` - Comprehensive analysis
  - `detailed` - In-depth analysis with extended reporting
- `includeMetadata` (boolean, default: false) - Include detailed metadata in results

**Examples:**
```
@test-bot analyze
@test-bot analyze mode=detailed
@test-bot analyze mode=basic includeMetadata=true
@test-bot analyze mode=detailed includeMetadata=true
```

#### `@test-bot help`
Shows detailed help and usage instructions.

**Example:**
```
@test-bot help
```

## Sample Output

```
🔍 Test Bot Analysis

Manuscript ID: manuscript-123
Analysis Mode: standard
Processing Time: 1500ms

Results Summary:
- Items analyzed: 25
- Issues found: 2
- Confidence score: 92.3%

Issues Detected:
1. WARNING: Consider adding more recent citations (past 5 years)
   Suggestion: Include 2-3 citations from 2022-2024

2. INFO: Abstract could benefit from quantitative results
   Suggestion: Add specific numbers or percentages to highlight key findings

💡 Recommendations:
1. Manuscript structure follows standard academic format
2. Consider expanding the discussion section
```

## Configuration

The bot supports the following configuration options:

```json
{
  "defaultMode": "standard",
  "enableNotifications": true,
  "includeMetadataByDefault": false
}
```

### Configuration Options

- **defaultMode** (`string`) - Default analysis mode when none specified
- **enableNotifications** (`boolean`) - Enable/disable bot notifications
- **includeMetadataByDefault** (`boolean`) - Whether to include metadata by default

## Development

### Prerequisites

- Node.js >= 18.0.0
- npm >= 8.0.0
- TypeScript >= 5.0.0

### Setup

```bash
# Clone and install dependencies
git clone https://github.com/myorg/test-bot.git
cd test-bot
npm install
```

### Building

```bash
npm run build
```

### Testing

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm test -- --coverage
```

### Development Mode

```bash
# Watch for changes and rebuild
npm run dev
```

### Code Quality

```bash
# Run linting
npm run lint

# Fix linting issues automatically
npm run lint:fix
```

### Publishing

```bash
# Build, test, and publish
npm publish
```

## API Reference

### Bot Interface

```typescript
interface TestBotBot {
  id: string;
  name: string;
  description: string;
  version: string;
  commands: BotCommand[];
  keywords: string[];
  triggers: string[];
  permissions: string[];
  help: {
    overview: string;
    quickStart: string;
    examples: string[];
  };
}
```

### Command Interface

```typescript
interface BotCommand {
  name: string;
  description: string;
  usage: string;
  parameters: BotCommandParameter[];
  examples: string[];
  permissions: string[];
  execute(params: Record<string, any>, context: BotContext): Promise<BotResponse>;
}
```

### Response Format

```typescript
interface BotResponse {
  messages: Array<{
    content: string;
    attachments?: Array<{
      type: string;
      filename: string;
      data: string;
      mimetype: string;
    }>;
  }>;
}
```

## Customization

To customize the bot for your specific needs:

1. **Modify Analysis Logic**: Update the `performAnalysis` function in `src/index.ts`
2. **Add New Commands**: Create additional command objects and add them to the `commands` array
3. **Extend Parameters**: Add new parameters to existing commands
4. **Custom Categories**: Update the bot category in the manifest

### Example: Adding a New Command

```typescript
const customCommand: BotCommand = {
  name: 'custom',
  description: 'Custom analysis function',
  usage: '@test-bot custom [param=value]',
  parameters: [
    {
      name: 'param',
      description: 'Custom parameter',
      type: 'string',
      required: false,
      defaultValue: 'default'
    }
  ],
  examples: ['@test-bot custom param=test'],
  permissions: ['read_manuscript'],
  async execute(params, context) {
    // Your custom logic here
    return {
      messages: [{
        content: 'Custom analysis complete!'
      }]
    };
  }
};

// Add to bot commands
export const TestBotBot = {
  // ... other properties
  commands: [analyzeCommand, helpCommand, customCommand]
};
```

## Testing

The bot includes comprehensive tests covering:

- ✅ Bot metadata validation
- ✅ Command functionality
- ✅ Parameter validation
- ✅ Error handling
- ✅ Performance benchmarks
- ✅ Plugin manifest validation

Run tests with:
```bash
npm test
```

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes and add tests
4. Ensure tests pass: `npm test`
5. Check code quality: `npm run lint`
6. Commit your changes: `git commit -m 'Add amazing feature'`
7. Push to the branch: `git push origin feature/amazing-feature`
8. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- 📖 **Documentation**: [Colloquium Bot Development Guide](https://docs.colloquium.org/bot-development)
- 🐛 **Bug Reports**: [GitHub Issues](https://github.com/myorg/test-bot/issues)
- 💬 **Community**: [Discord](https://discord.gg/colloquium)
- 📧 **Email**: you@example.com

## Changelog

### v1.0.0 (Initial Release)
- ✨ Basic analysis functionality
- 📊 Multiple analysis modes
- 🔧 Configurable parameters
- 📚 Comprehensive documentation
- ✅ Full test coverage

---

Made with ❤️ by Your Name for the Colloquium academic publishing platform.