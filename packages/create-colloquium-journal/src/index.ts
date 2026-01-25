#!/usr/bin/env node

import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';
import crypto from 'crypto';
import { JournalConfig, TemplateContext, AvailableBot } from './types';
import { generateInstance } from './generator';
import { validateJournalName, validateSlug, validateEmail, validateDomain } from './validation';

// Required bots (always included)
const REQUIRED_BOTS: AvailableBot[] = [
  {
    id: 'bot-editorial',
    name: 'Editorial Bot',
    description: 'Automates editorial workflow and decisions (required)',
    category: 'editorial',
    isDefault: true
  }
];

// Optional bots that users can choose from
const OPTIONAL_BOTS: AvailableBot[] = [
  {
    id: 'bot-markdown-renderer',
    name: 'Markdown Renderer Bot',
    description: 'Renders manuscripts in various formats',
    category: 'formatting',
    isDefault: true
  },
  {
    id: 'bot-reference',
    name: 'Reference Bot',
    description: 'Validates and formats citations',
    category: 'quality',
    isDefault: false
  },
  {
    id: 'bot-reviewer-checklist',
    name: 'Reviewer Checklist Bot',
    description: 'Provides structured review checklists',
    category: 'quality',
    isDefault: false
  }
];

// Utility functions
function generateSecret(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

function generateInstanceId(): string {
  return crypto.randomBytes(8).toString('hex');
}

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

// Interactive prompts
async function promptForConfig(journalName?: string): Promise<JournalConfig> {
  console.log(chalk.bold.blue('📚 Create Colloquium Journal'));
  console.log(chalk.gray('Create a new journal instance with Docker deployment.'));
  console.log();
  console.log(chalk.blue('ℹ️  Note: Editorial Bot is required and will be automatically installed.'));
  console.log();

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'name',
      message: 'Journal name:',
      default: journalName,
      validate: validateJournalName
    },
    {
      type: 'input',
      name: 'slug',
      message: 'Journal slug (URL-friendly):',
      default: (answers: any) => toSlug(answers.name),
      validate: validateSlug
    },
    {
      type: 'input',
      name: 'description',
      message: 'Journal description (optional):',
      default: ''
    },
    {
      type: 'input',
      name: 'domain',
      message: 'Domain name (optional, e.g. journal.university.edu):',
      default: '',
      validate: validateDomain
    },
    {
      type: 'input',
      name: 'adminName',
      message: 'Administrator name:',
      validate: (input: string) => input.trim().length > 0 || 'Administrator name is required'
    },
    {
      type: 'input',
      name: 'adminEmail',
      message: 'Administrator email:',
      validate: validateEmail
    },
    {
      type: 'checkbox',
      name: 'optionalBots',
      message: 'Select additional bots to install:',
      choices: OPTIONAL_BOTS.map(bot => ({
        name: `${bot.name} - ${bot.description}`,
        value: bot.id,
        checked: bot.isDefault
      }))
    }
  ]);

  // Combine required bots with selected optional bots
  const requiredBotIds = REQUIRED_BOTS.map(bot => bot.id);
  const allSelectedBots = [...requiredBotIds, ...answers.optionalBots];

  const config: JournalConfig = {
    name: answers.name.trim(),
    slug: answers.slug.trim(),
    description: answers.description.trim() || undefined,
    domain: answers.domain.trim() || undefined,
    adminName: answers.adminName.trim(),
    adminEmail: answers.adminEmail.trim(),
    selectedBots: allSelectedBots,
    dbPassword: generateSecret(16),
    dbName: answers.slug.replace(/-/g, '_'),
    jwtSecret: generateSecret(32),
    magicLinkSecret: generateSecret(32),
    deploymentType: 'docker',
    instanceId: generateInstanceId(),
    createdAt: new Date().toISOString()
  };

  return config;
}

// CLI argument parsing
async function parseCliConfig(journalName?: string, options?: any): Promise<JournalConfig> {
  if (!journalName) {
    throw new Error('Journal name is required');
  }

  const validation = validateJournalName(journalName);
  if (validation !== true) {
    throw new Error(`Invalid journal name: ${validation}`);
  }

  const slug = options.slug || toSlug(journalName);
  const slugValidation = validateSlug(slug);
  if (slugValidation !== true) {
    throw new Error(`Invalid slug: ${slugValidation}`);
  }

  if (options.adminEmail) {
    const emailValidation = validateEmail(options.adminEmail);
    if (emailValidation !== true) {
      throw new Error(`Invalid admin email: ${emailValidation}`);
    }
  }

  if (options.domain) {
    const domainValidation = validateDomain(options.domain);
    if (domainValidation !== true) {
      throw new Error(`Invalid domain: ${domainValidation}`);
    }
  }

  // Parse optional bots and ensure bot-editorial is always included
  const requiredBotIds = REQUIRED_BOTS.map(bot => bot.id);
  const optionalBots = options.bots
    ? options.bots.split(',').map((b: string) => b.trim()).filter((bot: string) => !requiredBotIds.includes(bot))
    : ['bot-markdown-renderer']; // Default optional bot
  const allSelectedBots = [...requiredBotIds, ...optionalBots];

  const config: JournalConfig = {
    name: journalName.trim(),
    slug: slug.trim(),
    description: options.description?.trim() || undefined,
    domain: options.domain?.trim() || undefined,
    adminName: options.adminName?.trim() || 'Administrator',
    adminEmail: options.adminEmail?.trim() || 'admin@example.com',
    selectedBots: allSelectedBots,
    dbPassword: generateSecret(16),
    dbName: slug.replace(/-/g, '_'),
    jwtSecret: generateSecret(32),
    magicLinkSecret: generateSecret(32),
    deploymentType: 'docker',
    instanceId: generateInstanceId(),
    createdAt: new Date().toISOString()
  };

  return config;
}

// Main CLI program
async function main() {
  const program = new Command();

  program
    .name('create-colloquium-journal')
    .description('Create a new Colloquium journal instance')
    .version('1.0.0');

  program
    .command('init [name]')
    .description('Initialize a new journal instance')
    .option('--slug <slug>', 'Journal URL slug')
    .option('--description <description>', 'Journal description')
    .option('--domain <domain>', 'Domain name')
    .option('--admin-name <name>', 'Administrator name')
    .option('--admin-email <email>', 'Administrator email')
    .option('--bots <bots>', 'Comma-separated list of bots to install')
    .option('--interactive', 'Interactive setup mode')
    .action(async (name, options) => {
      try {
        let config: JournalConfig;

        if (options.interactive || !name) {
          config = await promptForConfig(name);
        } else {
          config = await parseCliConfig(name, options);
        }

        const targetDir = path.resolve(process.cwd(), `${config.slug}-instance`);

        // Check if directory already exists
        if (await fs.pathExists(targetDir)) {
          const { overwrite } = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'overwrite',
              message: `Directory "${config.slug}-instance" already exists. Overwrite?`,
              default: false
            }
          ]);

          if (!overwrite) {
            console.log(chalk.yellow('Operation cancelled.'));
            process.exit(0);
          }

          await fs.remove(targetDir);
        }

        console.log(chalk.blue('🚀 Generating journal instance...'));
        await generateInstance(config, targetDir);

        console.log(chalk.green('✅ Journal instance created successfully!'));
        console.log();
        console.log(chalk.bold('Next steps:'));
        console.log(chalk.cyan(`  cd ${config.slug}-instance`));
        console.log(chalk.cyan('  chmod +x scripts/setup.sh'));
        console.log(chalk.cyan('  ./scripts/setup.sh'));
        console.log();
        console.log(chalk.bold('Instance Details:'));
        console.log(chalk.cyan(`  Journal Name: ${config.name}`));
        console.log(chalk.cyan(`  Journal Slug: ${config.slug}`));
        if (config.domain) {
          console.log(chalk.cyan(`  Domain: ${config.domain}`));
        }
        console.log(chalk.cyan(`  Admin Email: ${config.adminEmail}`));
        console.log(chalk.cyan(`  Bots: ${config.selectedBots.join(', ')}`));
        console.log();
        console.log(chalk.bold('Documentation:'));
        console.log(chalk.cyan('  https://docs.colloquium.org/self-hosting'));

      } catch (error) {
        console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
        process.exit(1);
      }
    });

  program.parse();
}

// Error handling
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
  main().catch((error) => {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  });
}