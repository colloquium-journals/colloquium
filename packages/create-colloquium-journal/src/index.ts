#!/usr/bin/env node

import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';
import crypto from 'crypto';
import { JournalConfig, AvailableBot, DeploymentType } from './types';
import { generateInstance } from './generator';
import { generateAWSInstance } from './generators/aws';
import { generateGCPInstance } from './generators/gcp';
import { validateJournalName, validateSlug, validateEmail, validateDomain } from './validation';

const REQUIRED_BOTS: AvailableBot[] = [
  {
    id: 'bot-editorial',
    name: 'Editorial Bot',
    description: 'Automates editorial workflow and decisions (required)',
    category: 'editorial',
    isDefault: true,
  },
];

const OPTIONAL_BOTS: AvailableBot[] = [
  {
    id: 'bot-markdown-renderer',
    name: 'Markdown Renderer Bot',
    description: 'Renders manuscripts in various formats',
    category: 'formatting',
    isDefault: true,
  },
  {
    id: 'bot-reference',
    name: 'Reference Bot',
    description: 'Validates and formats citations',
    category: 'quality',
    isDefault: false,
  },
  {
    id: 'bot-reviewer-checklist',
    name: 'Reviewer Checklist Bot',
    description: 'Provides structured review checklists',
    category: 'quality',
    isDefault: false,
  },
];

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

async function promptForConfig(
  journalName?: string,
  deploymentType: DeploymentType = 'docker'
): Promise<JournalConfig> {
  const deploymentLabels = {
    docker: 'Docker (self-hosted)',
    aws: 'Amazon Web Services (ECS Fargate)',
    gcp: 'Google Cloud Platform (Cloud Run)',
  };

  console.log(chalk.bold.blue('📚 Create Colloquium Journal'));
  console.log(chalk.gray(`Deployment: ${deploymentLabels[deploymentType]}`));
  console.log();
  console.log(chalk.blue('ℹ️  Note: Editorial Bot is required and will be automatically installed.'));
  console.log();

  const baseQuestions = [
    {
      type: 'input',
      name: 'name',
      message: 'Journal name:',
      default: journalName,
      validate: validateJournalName,
    },
    {
      type: 'input',
      name: 'slug',
      message: 'Journal slug (URL-friendly):',
      default: (answers: any) => toSlug(answers.name),
      validate: validateSlug,
    },
    {
      type: 'input',
      name: 'description',
      message: 'Journal description (optional):',
      default: '',
    },
    {
      type: 'input',
      name: 'domain',
      message: 'Domain name (optional, e.g. journal.university.edu):',
      default: '',
      validate: validateDomain,
    },
    {
      type: 'input',
      name: 'adminName',
      message: 'Administrator name:',
      validate: (input: string) => input.trim().length > 0 || 'Administrator name is required',
    },
    {
      type: 'input',
      name: 'adminEmail',
      message: 'Administrator email:',
      validate: validateEmail,
    },
    {
      type: 'checkbox',
      name: 'optionalBots',
      message: 'Select additional bots to install:',
      choices: OPTIONAL_BOTS.map((bot) => ({
        name: `${bot.name} - ${bot.description}`,
        value: bot.id,
        checked: bot.isDefault,
      })),
    },
  ];

  const answers = await inquirer.prompt(baseQuestions);

  let cloudAnswers: any = {};

  if (deploymentType === 'aws') {
    cloudAnswers = await inquirer.prompt([
      {
        type: 'input',
        name: 'awsRegion',
        message: 'AWS Region:',
        default: 'us-east-1',
      },
      {
        type: 'list',
        name: 'awsDbSize',
        message: 'Database instance size:',
        choices: [
          { name: 'Micro (db.t3.micro) - Development/Small', value: 'db.t3.micro' },
          { name: 'Small (db.t3.small) - Production', value: 'db.t3.small' },
          { name: 'Medium (db.t3.medium) - High traffic', value: 'db.t3.medium' },
        ],
        default: 'db.t3.micro',
      },
    ]);
  } else if (deploymentType === 'gcp') {
    cloudAnswers = await inquirer.prompt([
      {
        type: 'input',
        name: 'gcpProjectId',
        message: 'GCP Project ID:',
        validate: (input: string) => input.trim().length > 0 || 'Project ID is required',
      },
      {
        type: 'input',
        name: 'gcpRegion',
        message: 'GCP Region:',
        default: 'us-central1',
      },
      {
        type: 'list',
        name: 'gcpDbTier',
        message: 'Database instance tier:',
        choices: [
          { name: 'Micro (db-f1-micro) - Development/Small', value: 'db-f1-micro' },
          { name: 'Small (db-g1-small) - Production', value: 'db-g1-small' },
          { name: 'Custom (db-custom-1-3840) - High traffic', value: 'db-custom-1-3840' },
        ],
        default: 'db-f1-micro',
      },
    ]);
  }

  const requiredBotIds = REQUIRED_BOTS.map((bot) => bot.id);
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
    deploymentType,
    instanceId: generateInstanceId(),
    createdAt: new Date().toISOString(),
  };

  if (deploymentType === 'aws') {
    config.aws = {
      region: cloudAnswers.awsRegion,
      dbInstanceClass: cloudAnswers.awsDbSize,
    };
  } else if (deploymentType === 'gcp') {
    config.gcp = {
      projectId: cloudAnswers.gcpProjectId,
      region: cloudAnswers.gcpRegion,
      dbTier: cloudAnswers.gcpDbTier,
    };
  }

  return config;
}

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

  const deploymentType = (options.deployment || 'docker') as DeploymentType;

  if (deploymentType === 'gcp' && !options.projectId) {
    throw new Error('--project-id is required for GCP deployment');
  }

  const requiredBotIds = REQUIRED_BOTS.map((bot) => bot.id);
  const optionalBots = options.bots
    ? options.bots
        .split(',')
        .map((b: string) => b.trim())
        .filter((bot: string) => !requiredBotIds.includes(bot))
    : ['bot-markdown-renderer'];
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
    deploymentType,
    instanceId: generateInstanceId(),
    createdAt: new Date().toISOString(),
  };

  if (deploymentType === 'aws') {
    config.aws = {
      region: options.region || 'us-east-1',
      dbInstanceClass: options.dbSize || 'db.t3.micro',
    };
  } else if (deploymentType === 'gcp') {
    config.gcp = {
      projectId: options.projectId,
      region: options.region || 'us-central1',
      dbTier: options.dbTier || 'db-f1-micro',
    };
  }

  return config;
}

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
    .option('--deployment <type>', 'Deployment type: docker, aws, or gcp', 'docker')
    .option('--region <region>', 'Cloud region (for aws/gcp)')
    .option('--project-id <id>', 'GCP Project ID (required for gcp)')
    .option('--db-size <size>', 'Database instance size')
    .option('--db-tier <tier>', 'GCP database tier')
    .option('--interactive', 'Interactive setup mode')
    .action(async (name, options) => {
      try {
        const deploymentType = (options.deployment || 'docker') as DeploymentType;

        if (!['docker', 'aws', 'gcp'].includes(deploymentType)) {
          throw new Error(`Invalid deployment type: ${deploymentType}. Use docker, aws, or gcp.`);
        }

        let config: JournalConfig;

        if (options.interactive || !name) {
          config = await promptForConfig(name, deploymentType);
        } else {
          config = await parseCliConfig(name, options);
        }

        const targetDir = path.resolve(process.cwd(), `${config.slug}-instance`);

        if (await fs.pathExists(targetDir)) {
          const { overwrite } = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'overwrite',
              message: `Directory "${config.slug}-instance" already exists. Overwrite?`,
              default: false,
            },
          ]);

          if (!overwrite) {
            console.log(chalk.yellow('Operation cancelled.'));
            process.exit(0);
          }

          await fs.remove(targetDir);
        }

        console.log(chalk.blue('🚀 Generating journal instance...'));

        switch (config.deploymentType) {
          case 'aws':
            await generateAWSInstance(config, targetDir);
            break;
          case 'gcp':
            await generateGCPInstance(config, targetDir);
            break;
          default:
            await generateInstance(config, targetDir);
        }

        console.log(chalk.green('✅ Journal instance created successfully!'));
        console.log();
        console.log(chalk.bold('Next steps:'));
        console.log(chalk.cyan(`  cd ${config.slug}-instance`));

        if (config.deploymentType === 'docker') {
          console.log(chalk.cyan('  chmod +x scripts/setup.sh'));
          console.log(chalk.cyan('  ./scripts/setup.sh'));
        } else {
          console.log(chalk.cyan('  ./deploy.sh'));
        }

        console.log();
        console.log(chalk.bold('Instance Details:'));
        console.log(chalk.cyan(`  Journal Name: ${config.name}`));
        console.log(chalk.cyan(`  Journal Slug: ${config.slug}`));
        console.log(chalk.cyan(`  Deployment: ${config.deploymentType.toUpperCase()}`));
        if (config.domain) {
          console.log(chalk.cyan(`  Domain: ${config.domain}`));
        }
        if (config.aws) {
          console.log(chalk.cyan(`  AWS Region: ${config.aws.region}`));
        }
        if (config.gcp) {
          console.log(chalk.cyan(`  GCP Project: ${config.gcp.projectId}`));
          console.log(chalk.cyan(`  GCP Region: ${config.gcp.region}`));
        }
        console.log(chalk.cyan(`  Admin Email: ${config.adminEmail}`));
        console.log(chalk.cyan(`  Bots: ${config.selectedBots.join(', ')}`));
        console.log();
        console.log(chalk.bold('Documentation:'));
        console.log(chalk.cyan(`  https://docs.colloquium.org/deployment/${config.deploymentType}`));
      } catch (error) {
        console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
        process.exit(1);
      }
    });

  program.parse();
}

process.on('uncaughtException', (error) => {
  console.error(chalk.red('Uncaught error:'), error.message);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error(chalk.red('Unhandled rejection:'), reason);
  process.exit(1);
});

if (require.main === module) {
  main().catch((error) => {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  });
}
