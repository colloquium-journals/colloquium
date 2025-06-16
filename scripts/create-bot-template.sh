#!/bin/bash

# Colloquium Bot Template Generator
# Usage: ./create-bot-template.sh my-awesome-bot "My Organization"

set -e

BOT_NAME="$1"
AUTHOR_NAME="${2:-Your Name}"
AUTHOR_EMAIL="${3:-you@example.com}"
ORG_NAME="${4:-yourorg}"

if [ -z "$BOT_NAME" ]; then
    echo "Usage: $0 <bot-name> [author-name] [author-email] [org-name]"
    echo "Example: $0 my-awesome-bot \"John Doe\" \"john@example.com\" \"mycompany\""
    exit 1
fi

# Validate bot name
if [[ ! "$BOT_NAME" =~ ^[a-z0-9\-]+$ ]]; then
    echo "Error: Bot name must be lowercase alphanumeric with hyphens only"
    exit 1
fi

PACKAGE_NAME="@${ORG_NAME}/${BOT_NAME}"
BOT_CLASS_NAME=$(echo "$BOT_NAME" | sed 's/-/ /g' | sed 's/\b\w/\u&/g' | sed 's/ //g')
BOT_DISPLAY_NAME=$(echo "$BOT_NAME" | sed 's/-/ /g' | sed 's/\b\w/\u&/g')

echo "Creating Colloquium bot: $BOT_DISPLAY_NAME"
echo "Package name: $PACKAGE_NAME"
echo "Author: $AUTHOR_NAME <$AUTHOR_EMAIL>"

# Create directory structure
mkdir -p "$BOT_NAME"/{src,tests}
cd "$BOT_NAME"

# Create package.json
cat > package.json << EOF
{
  "name": "$PACKAGE_NAME",
  "version": "1.0.0",
  "description": "A Colloquium bot for $BOT_DISPLAY_NAME functionality",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "keywords": [
    "colloquium",
    "bot",
    "academic",
    "publishing"
  ],
  "author": {
    "name": "$AUTHOR_NAME",
    "email": "$AUTHOR_EMAIL"
  },
  "license": "MIT",
  "homepage": "https://github.com/$ORG_NAME/$BOT_NAME",
  "repository": {
    "type": "git",
    "url": "https://github.com/$ORG_NAME/$BOT_NAME.git"
  },
  "bugs": {
    "url": "https://github.com/$ORG_NAME/$BOT_NAME/issues"
  },
  "colloquium": {
    "botId": "$BOT_NAME",
    "apiVersion": "1.0.0",
    "permissions": ["read_manuscript"],
    "category": "utility",
    "isDefault": false
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "test": "jest",
    "test:watch": "jest --watch",
    "lint": "eslint src --ext .ts",
    "prepublishOnly": "npm run build && npm test"
  },
  "files": [
    "dist",
    "README.md",
    "LICENSE"
  ],
  "dependencies": {
    "@colloquium/types": "*",
    "zod": "^3.22.0"
  },
  "devDependencies": {
    "@types/node": "^20.8.0",
    "@types/jest": "^29.5.0",
    "@typescript-eslint/eslint-plugin": "^6.0.0",
    "@typescript-eslint/parser": "^6.0.0",
    "eslint": "^8.0.0",
    "jest": "^29.7.0",
    "ts-jest": "^29.1.0",
    "typescript": "^5.2.2"
  },
  "peerDependencies": {
    "@colloquium/types": "*"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
EOF

# Create TypeScript config
cat > tsconfig.json << EOF
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "moduleResolution": "node",
    "resolveJsonModule": true,
    "allowSyntheticDefaultImports": true
  },
  "include": [
    "src/**/*"
  ],
  "exclude": [
    "node_modules",
    "dist",
    "**/*.test.ts"
  ]
}
EOF

# Create Jest config
cat > jest.config.js << EOF
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.test.ts'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  }
};
EOF

# Create ESLint config
cat > .eslintrc.js << EOF
module.exports = {
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    '@typescript-eslint/recommended'
  ],
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module'
  },
  rules: {
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': 'error'
  }
};
EOF

# Create main bot file
cat > src/index.ts << EOF
import { BotContext, BotResponse } from '@colloquium/types';
import { z } from 'zod';

// Bot command interface
interface BotCommand {
  name: string;
  description: string;
  usage: string;
  parameters: Array<{
    name: string;
    description: string;
    type: string;
    required: boolean;
    defaultValue?: any;
    validation?: z.ZodSchema<any>;
    examples?: string[];
  }>;
  examples: string[];
  permissions: string[];
  execute(params: Record<string, any>, context: BotContext): Promise<BotResponse>;
}

// Command bot interface
interface CommandBot {
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

// Example command
const exampleCommand: BotCommand = {
  name: 'analyze',
  description: 'Analyze the manuscript for specific patterns',
  usage: '@$BOT_NAME analyze [mode=standard]',
  parameters: [
    {
      name: 'mode',
      description: 'Analysis mode',
      type: 'enum',
      required: false,
      defaultValue: 'standard',
      examples: ['basic', 'standard', 'detailed']
    }
  ],
  examples: [
    '@$BOT_NAME analyze',
    '@$BOT_NAME analyze mode=detailed'
  ],
  permissions: ['read_manuscript'],
  async execute(params, context) {
    const { mode } = params;
    const { manuscriptId } = context;

    try {
      // Your bot logic here
      const results = await performAnalysis(manuscriptId, mode);
      
      let message = \`🔍 **$BOT_DISPLAY_NAME Analysis**\\n\\n\`;
      message += \`**Manuscript ID:** \${manuscriptId}\\n\`;
      message += \`**Mode:** \${mode}\\n\\n\`;
      message += \`**Results:**\\n\`;
      message += \`- Items analyzed: \${results.count}\\n\`;
      message += \`- Issues found: \${results.issues}\\n\`;
      
      if (results.issues > 0) {
        message += \`\\n**Issues:**\\n\`;
        results.details.forEach((issue: any, i: number) => {
          message += \`\${i + 1}. \${issue.description}\\n\`;
        });
      } else {
        message += \`\\n✅ **All good!** No issues found.\`;
      }

      return {
        messages: [{
          content: message,
          attachments: [{
            type: 'report',
            filename: \`$BOT_NAME-analysis-\${manuscriptId}.json\`,
            data: JSON.stringify(results, null, 2),
            mimetype: 'application/json'
          }]
        }]
      };
    } catch (error) {
      return {
        messages: [{
          content: \`❌ **Error during analysis:** \${error instanceof Error ? error.message : 'Unknown error'}\\n\\nPlease try again or contact support if the issue persists.\`
        }]
      };
    }
  }
};

const helpCommand: BotCommand = {
  name: 'help',
  description: 'Show detailed help for the $BOT_NAME',
  usage: '@$BOT_NAME help',
  parameters: [],
  examples: ['@$BOT_NAME help'],
  permissions: [],
  async execute(params, context) {
    let message = \`📚 **$BOT_DISPLAY_NAME Help**\\n\\n\`;
    message += \`I help with manuscript analysis and processing.\\n\\n\`;
    
    message += \`**Available Commands:**\\n\`;
    message += \`• \\\`analyze\\\` - Analyze manuscript content\\n\\n\`;
    
    message += \`**Examples:**\\n\`;
    message += \`• \\\`@$BOT_NAME analyze\\\` - Basic analysis\\n\`;
    message += \`• \\\`@$BOT_NAME analyze mode=detailed\\\` - Detailed analysis\\n\\n\`;
    
    message += \`**Need more help?** Check our documentation or contact support.\`;

    return {
      messages: [{ content: message }]
    };
  }
};

// The main bot export
export const ${BOT_CLASS_NAME}Bot: CommandBot = {
  id: '$BOT_NAME',
  name: '$BOT_DISPLAY_NAME',
  description: 'A Colloquium bot for $BOT_DISPLAY_NAME functionality',
  version: '1.0.0',
  commands: [exampleCommand, helpCommand],
  keywords: ['analysis', 'utility'],
  triggers: [],
  permissions: ['read_manuscript'],
  help: {
    overview: 'Analyzes manuscripts and provides useful insights.',
    quickStart: 'Use @$BOT_NAME analyze to get started.',
    examples: [
      '@$BOT_NAME analyze',
      '@$BOT_NAME analyze mode=detailed'
    ]
  }
};

// Bot plugin manifest
export const manifest = {
  name: '$PACKAGE_NAME',
  version: '1.0.0',
  description: 'A Colloquium bot for $BOT_DISPLAY_NAME functionality',
  author: {
    name: '$AUTHOR_NAME',
    email: '$AUTHOR_EMAIL'
  },
  license: 'MIT',
  keywords: ['colloquium', 'bot', 'analysis'],
  homepage: 'https://github.com/$ORG_NAME/$BOT_NAME',
  repository: {
    type: 'git' as const,
    url: 'https://github.com/$ORG_NAME/$BOT_NAME.git'
  },
  bugs: {
    url: 'https://github.com/$ORG_NAME/$BOT_NAME/issues'
  },
  colloquium: {
    botId: '$BOT_NAME',
    apiVersion: '1.0.0',
    permissions: ['read_manuscript'],
    category: 'utility' as const,
    isDefault: false,
    defaultConfig: {
      defaultMode: 'standard',
      enableNotifications: true
    }
  }
};

// Bot plugin export
export const bot = ${BOT_CLASS_NAME}Bot;

// Default export for plugin system
export default {
  manifest,
  bot: ${BOT_CLASS_NAME}Bot
};

// Implementation functions
async function performAnalysis(manuscriptId: string, mode: string) {
  // TODO: Implement your analysis logic here
  
  // Example implementation
  const mockResults = {
    count: 10,
    issues: Math.floor(Math.random() * 3),
    mode,
    details: [
      { description: 'Example issue 1', severity: 'warning' },
      { description: 'Example issue 2', severity: 'info' }
    ]
  };
  
  // Simulate processing time
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  return mockResults;
}
EOF

# Create test file
cat > tests/index.test.ts << EOF
import { ${BOT_CLASS_NAME}Bot } from '../src/index';
import { BotContext } from '@colloquium/types';

describe('$BOT_DISPLAY_NAME Bot', () => {
  const mockContext: BotContext = {
    conversationId: 'test-conversation',
    manuscriptId: 'test-manuscript',
    triggeredBy: {
      messageId: 'test-message',
      userId: 'test-user',
      trigger: 'mention' as any
    },
    journal: {
      id: 'test-journal',
      settings: {}
    },
    config: {}
  };

  test('should have correct bot metadata', () => {
    expect(${BOT_CLASS_NAME}Bot.id).toBe('$BOT_NAME');
    expect(${BOT_CLASS_NAME}Bot.name).toBe('$BOT_DISPLAY_NAME');
    expect(${BOT_CLASS_NAME}Bot.version).toBe('1.0.0');
    expect(${BOT_CLASS_NAME}Bot.commands).toHaveLength(2);
  });

  test('should have analyze command', () => {
    const analyzeCommand = ${BOT_CLASS_NAME}Bot.commands.find(cmd => cmd.name === 'analyze');
    expect(analyzeCommand).toBeDefined();
    expect(analyzeCommand?.description).toContain('manuscript');
    expect(analyzeCommand?.permissions).toContain('read_manuscript');
  });

  test('should have help command', () => {
    const helpCommand = ${BOT_CLASS_NAME}Bot.commands.find(cmd => cmd.name === 'help');
    expect(helpCommand).toBeDefined();
    expect(helpCommand?.description).toContain('help');
  });

  test('help command should execute successfully', async () => {
    const helpCommand = ${BOT_CLASS_NAME}Bot.commands.find(cmd => cmd.name === 'help');
    expect(helpCommand).toBeDefined();
    
    if (helpCommand) {
      const result = await helpCommand.execute({}, mockContext);
      expect(result.messages).toBeDefined();
      expect(result.messages).toHaveLength(1);
      expect(result.messages![0].content).toContain('$BOT_DISPLAY_NAME Help');
    }
  });

  test('analyze command should execute with default parameters', async () => {
    const analyzeCommand = ${BOT_CLASS_NAME}Bot.commands.find(cmd => cmd.name === 'analyze');
    expect(analyzeCommand).toBeDefined();
    
    if (analyzeCommand) {
      const result = await analyzeCommand.execute({
        mode: 'standard'
      }, mockContext);
      
      expect(result.messages).toBeDefined();
      expect(result.messages).toHaveLength(1);
      expect(result.messages![0].content).toContain('$BOT_DISPLAY_NAME Analysis');
      expect(result.messages![0].attachments).toBeDefined();
      expect(result.messages![0].attachments).toHaveLength(1);
      expect(result.messages![0].attachments![0].filename).toContain('$BOT_NAME-analysis');
    }
  });

  test('bot should have correct triggers and permissions', () => {
    expect(${BOT_CLASS_NAME}Bot.permissions).toContain('read_manuscript');
    expect(${BOT_CLASS_NAME}Bot.keywords).toContain('analysis');
  });
});
EOF

# Create README
cat > README.md << EOF
# $PACKAGE_NAME

A Colloquium bot for $BOT_DISPLAY_NAME functionality.

## Features

- Manuscript analysis and processing
- Customizable analysis modes
- Detailed reporting with JSON exports
- Easy integration with Colloquium journals

## Installation

### Via Colloquium Admin Interface
1. Go to Admin → Bot Management
2. Click "Install Bot"
3. Enter package name: \`$PACKAGE_NAME\`
4. Click "Install"

### Via npm (for development)
\`\`\`bash
npm install $PACKAGE_NAME
\`\`\`

## Usage

Once installed, the bot can be used in any conversation by mentioning it:

### Commands

#### \`@$BOT_NAME analyze\`
Analyzes the manuscript content.

**Parameters:**
- \`mode\` (string, default: "standard") - Analysis mode: basic, standard, or detailed

**Examples:**
\`\`\`
@$BOT_NAME analyze
@$BOT_NAME analyze mode=detailed
\`\`\`

#### \`@$BOT_NAME help\`
Shows detailed help and usage instructions.

## Configuration

The bot supports the following configuration options:

\`\`\`json
{
  "defaultMode": "standard",
  "enableNotifications": true
}
\`\`\`

## Development

### Building
\`\`\`bash
npm run build
\`\`\`

### Testing
\`\`\`bash
npm test
\`\`\`

### Development Mode
\`\`\`bash
npm run dev
\`\`\`

## Requirements

- Node.js >= 18.0.0
- Colloquium >= 0.1.0

## License

MIT License - see LICENSE file for details.

## Support

- [GitHub Issues](https://github.com/$ORG_NAME/$BOT_NAME/issues)
- [Documentation](https://docs.colloquium.org)
- [Community Discord](https://discord.gg/colloquium)

## Contributing

Contributions are welcome! Please read our contributing guidelines and submit pull requests.
EOF

# Create LICENSE
cat > LICENSE << EOF
MIT License

Copyright (c) $(date +%Y) $AUTHOR_NAME

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
EOF

# Create .gitignore
cat > .gitignore << EOF
# Dependencies
node_modules/
npm-debug.log*

# Build outputs
dist/
*.d.ts
*.d.ts.map
*.js.map

# Test coverage
coverage/

# Environment
.env
.env.local
.env.*.local

# Editor
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Logs
logs/
*.log
EOF

# Make script executable
chmod +x create-bot-template.sh

echo ""
echo "✅ Bot template created successfully!"
echo ""
echo "Next steps:"
echo "1. cd $BOT_NAME"
echo "2. npm install"
echo "3. npm run build"
echo "4. npm test"
echo "5. Edit src/index.ts to implement your bot logic"
echo "6. npm publish (when ready)"
echo ""
echo "📚 Documentation: https://docs.colloquium.org/bot-development"
echo "💬 Support: https://discord.gg/colloquium"
EOF

chmod +x /Users/jdeleeuw/Documents/GitHub/colloquium/scripts/create-bot-template.sh