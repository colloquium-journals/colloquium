#!/usr/bin/env node

import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';
import validateNpmPackageName from 'validate-npm-package-name';

interface BotConfig {
  name: string;
  displayName: string;
  description: string;
  category: string;
  packageName: string;
  authorName: string;
  authorEmail: string;
  authorUrl?: string;
  orgName: string;
  gitUrl?: string;
  license: string;
  keywords: string[];
}

// Bot categories with descriptions
const BOT_CATEGORIES = [
  { name: 'editorial', description: 'Editorial workflow automation' },
  { name: 'analysis', description: 'Manuscript analysis and insights' },
  { name: 'quality', description: 'Quality assurance and validation' },
  { name: 'formatting', description: 'Document formatting and style' },
  { name: 'integration', description: 'External service integrations' },
  { name: 'utility', description: 'General utility functions' }
];

// Common licenses
const LICENSES = [
  'MIT',
  'Apache-2.0',
  'GPL-3.0',
  'BSD-3-Clause',
  'ISC'
];

// Validation functions
function validateBotName(name: string): boolean | string {
  if (!name || name.trim().length === 0) {
    return 'Bot name is required';
  }

  if (!/^[a-z0-9\-]+$/.test(name)) {
    return 'Bot name must be lowercase alphanumeric with hyphens only';
  }

  if (!name.startsWith('bot-')) {
    return 'Bot name must start with "bot-" prefix (e.g., bot-my-feature)';
  }

  if (name.length < 5) {
    return 'Bot name must be at least 5 characters long (bot- plus at least 1 character)';
  }

  if (name.length > 50) {
    return 'Bot name must be less than 50 characters';
  }

  return true;
}

function validatePackageName(name: string): boolean | string {
  const result = validateNpmPackageName(name);
  
  if (!result.validForNewPackages) {
    return result.errors?.[0] || result.warnings?.[0] || 'Invalid package name';
  }
  
  return true;
}

function validateEmail(email: string): boolean | string {
  if (!email) return true; // Optional
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) || 'Invalid email format';
}

function validateUrl(url: string): boolean | string {
  if (!url) return true; // Optional
  
  try {
    new URL(url);
    return true;
  } catch {
    return 'Invalid URL format';
  }
}

// Utility functions
function toPascalCase(str: string): string {
  return str
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
}

function toTitleCase(str: string): string {
  return str
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// Template generation
async function generateBotPackage(config: BotConfig, targetDir: string) {
  const templateDir = path.join(__dirname, '..', 'templates');
  
  console.log(chalk.blue('📦 Creating bot package...'));
  
  // Ensure target directory exists
  await fs.ensureDir(targetDir);
  
  // Copy template files
  await copyTemplateFiles(templateDir, targetDir, config);
  
  console.log(chalk.green('✅ Bot package created successfully!'));
  console.log();
  console.log(chalk.bold('Next steps:'));
  console.log(chalk.cyan(`  cd ${config.name}`));
  console.log(chalk.cyan('  npm install'));
  console.log(chalk.cyan('  npm run dev'));
  console.log();
  console.log(chalk.bold('Development:'));
  console.log(chalk.cyan('  npm run build    # Build the package'));
  console.log(chalk.cyan('  npm test         # Run tests'));
  console.log(chalk.cyan('  npm run lint     # Check code quality'));
  console.log();
  console.log(chalk.bold('Publishing:'));
  console.log(chalk.cyan('  npm publish      # Publish to npm'));
  console.log();
  console.log(chalk.bold('Documentation:'));
  console.log(chalk.cyan('  https://docs.colloquium.org/bot-development'));
}

async function copyTemplateFiles(templateDir: string, targetDir: string, config: BotConfig) {
  // Template variables
  const vars = {
    BOT_NAME: config.name,
    BOT_DISPLAY_NAME: config.displayName,
    BOT_DESCRIPTION: config.description,
    BOT_CLASS_NAME: toPascalCase(config.name),
    PACKAGE_NAME: config.packageName,
    AUTHOR_NAME: config.authorName,
    AUTHOR_EMAIL: config.authorEmail,
    AUTHOR_URL: config.authorUrl || '',
    ORG_NAME: config.orgName,
    GIT_URL: config.gitUrl || `https://github.com/${config.orgName}/${config.name}`,
    LICENSE: config.license,
    KEYWORDS: config.keywords.map(k => `"${k}"`).join(', '),
    CATEGORY: config.category,
    YEAR: new Date().getFullYear().toString()
  };
  
  // Files to process with template variables
  const templateFiles = [
    'package.json.template',
    'tsconfig.json.template',
    'src/index.ts.template',
    'tests/index.test.ts.template',
    'README.md.template',
    'LICENSE.template',
    '.gitignore.template',
    'eslint.config.mjs.template',
    'jest.config.js.template',
    'default-config.yaml.template'
  ];
  
  for (const file of templateFiles) {
    const templatePath = path.join(templateDir, file);
    const targetPath = path.join(targetDir, file.replace('.template', ''));
    
    if (await fs.pathExists(templatePath)) {
      let content = await fs.readFile(templatePath, 'utf-8');
      
      // Process template content
      content = processTemplate(content, vars);
      
      await fs.ensureDir(path.dirname(targetPath));
      await fs.writeFile(targetPath, content);
    }
  }
  
  // Create src and tests directories
  await fs.ensureDir(path.join(targetDir, 'src'));
  await fs.ensureDir(path.join(targetDir, 'tests'));
}

function processTemplate(content: string, vars: Record<string, string>): string {
  // Replace simple variables {{VAR_NAME}}
  Object.entries(vars).forEach(([key, value]) => {
    const regex = new RegExp(`{{${key}}}`, 'g');
    content = content.replace(regex, value);
  });
  
  // Handle conditional blocks for optional fields
  // {{#if AUTHOR_EMAIL}}, email: "{{AUTHOR_EMAIL}}"{{/if}}
  content = content.replace(/{{#if AUTHOR_EMAIL}}([^}]+){{\/if}}/g, (match, block) => {
    return vars.AUTHOR_EMAIL ? block.replace(/{{AUTHOR_EMAIL}}/g, vars.AUTHOR_EMAIL) : '';
  });
  
  content = content.replace(/{{#if AUTHOR_URL}}([^}]+){{\/if}}/g, (match, block) => {
    return vars.AUTHOR_URL ? block.replace(/{{AUTHOR_URL}}/g, vars.AUTHOR_URL) : '';
  });
  
  // Handle license conditional for MIT vs others
  content = content.replace(/{{#if \(eq LICENSE "MIT"\)}}([\s\S]*?){{else}}([\s\S]*?){{\/if}}/g, (match, mitBlock, otherBlock) => {
    return vars.LICENSE === 'MIT' ? mitBlock : otherBlock.replace(/{{LICENSE}}/g, vars.LICENSE);
  });
  
  return content;
}

// Interactive prompts
async function promptForConfig(): Promise<BotConfig> {
  console.log(chalk.bold.blue('🤖 Create Colloquium Bot'));
  console.log(chalk.gray('Let\'s create a new bot package for the Colloquium platform.'));
  console.log();
  
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'name',
      message: 'Bot name (must start with bot-, e.g., bot-my-feature):',
      validate: validateBotName,
      transformer: (input: string) => input.toLowerCase().replace(/[^a-z0-9\-]/g, '-')
    },
    {
      type: 'input',
      name: 'description',
      message: 'Bot description:',
      validate: (input: string) => input.trim().length > 0 || 'Description is required'
    },
    {
      type: 'list',
      name: 'category',
      message: 'Bot category:',
      choices: BOT_CATEGORIES.map(cat => ({
        name: `${cat.name} - ${cat.description}`,
        value: cat.name
      }))
    },
    {
      type: 'input',
      name: 'orgName',
      message: 'Organization/username for package scope:',
      default: 'myorg',
      validate: (input: string) => input.trim().length > 0 || 'Organization name is required'
    },
    {
      type: 'input',
      name: 'authorName',
      message: 'Your name:',
      validate: (input: string) => input.trim().length > 0 || 'Author name is required'
    },
    {
      type: 'input',
      name: 'authorEmail',
      message: 'Your email:',
      validate: validateEmail
    },
    {
      type: 'input',
      name: 'authorUrl',
      message: 'Your website (optional):',
      validate: validateUrl
    },
    {
      type: 'input',
      name: 'gitUrl',
      message: 'Git repository URL (optional):',
      validate: validateUrl
    },
    {
      type: 'list',
      name: 'license',
      message: 'License:',
      choices: LICENSES,
      default: 'MIT'
    },
    {
      type: 'input',
      name: 'keywords',
      message: 'Keywords (comma-separated):',
      default: 'colloquium, bot, academic',
      filter: (input: string) => input.split(',').map(k => k.trim()).filter(k => k.length > 0)
    }
  ]);
  
  const displayName = toTitleCase(answers.name);
  const packageName = `@${answers.orgName}/${answers.name}`;
  
  // Validate generated package name
  const packageValidation = validatePackageName(packageName);
  if (packageValidation !== true) {
    throw new Error(`Invalid package name "${packageName}": ${packageValidation}`);
  }
  
  return {
    ...answers,
    displayName,
    packageName
  };
}

// Main CLI setup
async function main() {
  const program = new Command();
  
  program
    .name('create-colloquium-bot')
    .description('Create a new Colloquium bot package')
    .version('1.0.0')
    .argument('[bot-name]', 'Name of the bot to create')
    .option('-y, --yes', 'Skip prompts and use defaults')
    .option('--template <template>', 'Template to use (basic, advanced)', 'basic')
    .action(async (botName, options) => {
      try {
        let config: BotConfig;
        
        if (options.yes && botName) {
          // Non-interactive mode with defaults
          const validation = validateBotName(botName);
          if (validation !== true) {
            console.error(chalk.red(`Error: ${validation}`));
            process.exit(1);
          }
          
          config = {
            name: botName,
            displayName: toTitleCase(botName),
            description: `A Colloquium bot for ${toTitleCase(botName)} functionality`,
            category: 'utility',
            packageName: `@myorg/${botName}`,
            authorName: 'Your Name',
            authorEmail: 'you@example.com',
            orgName: 'myorg',
            license: 'MIT',
            keywords: ['colloquium', 'bot', 'academic']
          };
        } else {
          // Interactive mode
          config = await promptForConfig();
        }
        
        const targetDir = path.resolve(process.cwd(), config.name);
        
        // Check if directory already exists
        if (await fs.pathExists(targetDir)) {
          const { overwrite } = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'overwrite',
              message: `Directory "${config.name}" already exists. Overwrite?`,
              default: false
            }
          ]);
          
          if (!overwrite) {
            console.log(chalk.yellow('Operation cancelled.'));
            process.exit(0);
          }
          
          await fs.remove(targetDir);
        }
        
        await generateBotPackage(config, targetDir);
        
      } catch (error) {
        console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
        process.exit(1);
      }
    });
  
  program.parse();
}

// Handle unhandled errors
process.on('uncaughtException', (error) => {
  console.error(chalk.red('Uncaught error:'), error.message);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error(chalk.red('Unhandled rejection:'), reason);
  process.exit(1);
});

// Run the CLI
if (require.main === module) {
  main();
}