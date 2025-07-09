import fs from 'fs-extra';
import path from 'path';
import { JournalConfig, TemplateContext } from './types';

export async function generateInstance(config: JournalConfig, targetDir: string): Promise<void> {
  const templateDir = path.join(__dirname, '..', 'templates');
  
  // Create target directory
  await fs.ensureDir(targetDir);
  
  // Create template context
  const context: TemplateContext = {
    JOURNAL_NAME: config.name,
    JOURNAL_SLUG: config.slug,
    JOURNAL_DESCRIPTION: config.description || '',
    JOURNAL_DOMAIN: config.domain || 'localhost',
    ADMIN_EMAIL: config.adminEmail,
    ADMIN_NAME: config.adminName,
    DB_PASSWORD: config.dbPassword,
    DB_NAME: config.dbName,
    JWT_SECRET: config.jwtSecret,
    MAGIC_LINK_SECRET: config.magicLinkSecret,
    SELECTED_BOTS: config.selectedBots.map(bot => `"${bot}"`).join(', '),
    INSTANCE_ID: config.instanceId,
    CREATED_AT: config.createdAt
  };
  
  // Generate main files
  await generateDockerCompose(templateDir, targetDir, context);
  await generateEnvironmentFile(templateDir, targetDir, context);
  await generateNginxConfig(templateDir, targetDir, context);
  await generateJournalConfig(templateDir, targetDir, context);
  await generateSetupScript(templateDir, targetDir, context);
  
  // Create directory structure
  await createDirectoryStructure(targetDir);
  
  // Generate documentation
  await generateReadme(targetDir, config);
  
  // Copy additional files
  await copyAdditionalFiles(targetDir, config);
}

async function generateDockerCompose(templateDir: string, targetDir: string, context: TemplateContext): Promise<void> {
  const templatePath = path.join(templateDir, 'docker-compose.yml.template');
  const targetPath = path.join(targetDir, 'docker-compose.yml');
  
  const template = await fs.readFile(templatePath, 'utf-8');
  const processed = processTemplate(template, context);
  
  await fs.writeFile(targetPath, processed);
}

async function generateEnvironmentFile(templateDir: string, targetDir: string, context: TemplateContext): Promise<void> {
  const templatePath = path.join(templateDir, '.env.template');
  const targetPath = path.join(targetDir, '.env');
  
  const template = await fs.readFile(templatePath, 'utf-8');
  const processed = processTemplate(template, context);
  
  await fs.writeFile(targetPath, processed);
}

async function generateNginxConfig(templateDir: string, targetDir: string, context: TemplateContext): Promise<void> {
  const nginxDir = path.join(targetDir, 'nginx');
  await fs.ensureDir(nginxDir);
  
  const templatePath = path.join(templateDir, 'nginx.conf.template');
  const targetPath = path.join(nginxDir, 'nginx.conf');
  
  const template = await fs.readFile(templatePath, 'utf-8');
  const processed = processTemplate(template, context);
  
  await fs.writeFile(targetPath, processed);
}

async function generateJournalConfig(templateDir: string, targetDir: string, context: TemplateContext): Promise<void> {
  const configDir = path.join(targetDir, 'config');
  await fs.ensureDir(configDir);
  
  const templatePath = path.join(templateDir, 'journal.json.template');
  const targetPath = path.join(configDir, 'journal.json');
  
  const template = await fs.readFile(templatePath, 'utf-8');
  const processed = processTemplate(template, context);
  
  await fs.writeFile(targetPath, processed);
}

async function generateSetupScript(templateDir: string, targetDir: string, context: TemplateContext): Promise<void> {
  const scriptsDir = path.join(targetDir, 'scripts');
  await fs.ensureDir(scriptsDir);
  
  const templatePath = path.join(templateDir, 'scripts', 'setup.sh.template');
  const targetPath = path.join(scriptsDir, 'setup.sh');
  
  const template = await fs.readFile(templatePath, 'utf-8');
  const processed = processTemplate(template, context);
  
  await fs.writeFile(targetPath, processed);
  
  // Make script executable
  await fs.chmod(targetPath, '755');
}

async function createDirectoryStructure(targetDir: string): Promise<void> {
  const directories = [
    'data',
    'data/uploads',
    'data/postgres',
    'nginx',
    'nginx/ssl',
    'config',
    'scripts',
    'logs'
  ];
  
  for (const dir of directories) {
    await fs.ensureDir(path.join(targetDir, dir));
  }
}

async function generateReadme(targetDir: string, config: JournalConfig): Promise<void> {
  const readmeContent = `# ${config.name}

A Colloquium journal instance for ${config.name}.

## Quick Start

1. **Setup the instance:**
   \`\`\`bash
   chmod +x scripts/setup.sh
   ./scripts/setup.sh
   \`\`\`

2. **Access your journal:**
   - Web Interface: http://localhost:3000
   - API: http://localhost:4000
   - Admin Panel: http://localhost:3000/admin

## Configuration

### Journal Settings
- **Name:** ${config.name}
- **Slug:** ${config.slug}
- **Description:** ${config.description || 'Not specified'}
- **Domain:** ${config.domain || 'localhost'}
- **Admin Email:** ${config.adminEmail}

### Installed Bots
${config.selectedBots.map(bot => `- ${bot}`).join('\n')}

## Docker Commands

### Start Services
\`\`\`bash
docker-compose up -d
\`\`\`

### Stop Services
\`\`\`bash
docker-compose down
\`\`\`

### View Logs
\`\`\`bash
docker-compose logs -f
\`\`\`

### Restart Services
\`\`\`bash
docker-compose restart
\`\`\`

### Update Services
\`\`\`bash
docker-compose pull
docker-compose up -d
\`\`\`

## Database Operations

### Access Database
\`\`\`bash
docker-compose exec postgres psql -U postgres -d ${config.dbName}
\`\`\`

### Backup Database
\`\`\`bash
docker-compose exec postgres pg_dump -U postgres ${config.dbName} > backup.sql
\`\`\`

### Restore Database
\`\`\`bash
docker-compose exec -T postgres psql -U postgres -d ${config.dbName} < backup.sql
\`\`\`

## File Structure

\`\`\`
${config.slug}-instance/
├── docker-compose.yml      # Container orchestration
├── .env                    # Environment variables
├── README.md              # This file
├── config/
│   └── journal.json       # Journal configuration
├── data/
│   ├── uploads/          # User uploaded files
│   └── postgres/         # Database files
├── nginx/
│   ├── nginx.conf        # Web server configuration
│   └── ssl/             # SSL certificates
├── scripts/
│   └── setup.sh         # Initial setup script
└── logs/                # Application logs
\`\`\`

## Production Deployment

### SSL Configuration
1. Obtain SSL certificates for your domain
2. Place certificates in \`nginx/ssl/\`
3. Update \`nginx/nginx.conf\` to enable HTTPS
4. Update \`.env\` with your domain settings

### Email Configuration
Update the following in \`.env\`:
\`\`\`
SMTP_HOST=smtp.your-provider.com
SMTP_PORT=587
SMTP_USER=your-email@your-domain.com
SMTP_PASSWORD=your-password
SMTP_FROM=noreply@your-domain.com
\`\`\`

### Environment Variables
Review and update production settings in \`.env\`:
- Set \`NODE_ENV=production\`
- Configure proper domain URLs
- Set up external services (ORCID, analytics, etc.)

## Support

- **Documentation:** https://docs.colloquium.org/self-hosting
- **Issues:** https://github.com/colloquium/colloquium/issues
- **Community:** https://github.com/colloquium/colloquium/discussions

## License

This instance is powered by Colloquium, licensed under the MIT License.
`;

  await fs.writeFile(path.join(targetDir, 'README.md'), readmeContent);
}

async function copyAdditionalFiles(targetDir: string, config: JournalConfig): Promise<void> {
  // Create .gitignore
  const gitignoreContent = `# Dependencies
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Production builds
dist/
build/

# Environment files
.env.local
.env.production
.env.test

# Database
data/postgres/

# Logs
logs/
*.log

# SSL certificates
nginx/ssl/*.pem
nginx/ssl/*.key
nginx/ssl/*.crt

# OS files
.DS_Store
Thumbs.db

# IDE files
.vscode/
.idea/
*.swp
*.swo

# Backup files
*.backup
*.sql
backup/
`;

  await fs.writeFile(path.join(targetDir, '.gitignore'), gitignoreContent);
  
  // Create docker-compose.override.yml template for development
  const overrideContent = `# Docker Compose override for development
# Copy this file to docker-compose.override.yml and customize as needed

version: '3.8'

services:
  web:
    environment:
      - NODE_ENV=development
    # volumes:
    #   - ./custom-web-config:/app/config

  api:
    environment:
      - NODE_ENV=development
      - DEBUG=true
    # volumes:
    #   - ./custom-api-config:/app/config

  postgres:
    # ports:
    #   - "5432:5432"  # Expose PostgreSQL port for external access
    
  # Add development services
  # mailhog:
  #   image: mailhog/mailhog:latest
  #   ports:
  #     - "1025:1025"  # SMTP port
  #     - "8025:8025"  # Web UI port
`;

  await fs.writeFile(path.join(targetDir, 'docker-compose.override.yml.example'), overrideContent);
}

function processTemplate(template: string, context: TemplateContext): string {
  let processed = template;
  
  // Replace simple variables {{VAR_NAME}}
  Object.entries(context).forEach(([key, value]) => {
    const regex = new RegExp(`{{${key}}}`, 'g');
    processed = processed.replace(regex, value);
  });
  
  // Handle conditional blocks for optional fields
  // {{#if JOURNAL_DOMAIN}}content{{/if}}
  processed = processed.replace(/{{#if JOURNAL_DOMAIN}}([^}]+){{\/if}}/g, (match, block) => {
    return context.JOURNAL_DOMAIN && context.JOURNAL_DOMAIN !== 'localhost' 
      ? block.replace(/{{JOURNAL_DOMAIN}}/g, context.JOURNAL_DOMAIN) 
      : '';
  });
  
  return processed;
}