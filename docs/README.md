# Colloquium Documentation

Welcome to the Colloquium documentation! This is an open-source academic journal platform that emphasizes conversational peer review and community engagement.

## Documentation Index

### Development
- [**Authentication & Access Control**](./development/authentication.md) - User roles, test accounts, and security
- [**Bot Framework**](./development/bots.md) - Creating and managing bots for automation
- [**Workflow System**](./development/workflow.md) - Configurable peer review workflows
- [**CrossRef Integration**](./development/crossref-integration.md) - DOI registration and metadata
- [**DOAJ Integration**](./development/doaj-integration.md) - Open access journal directory

### Admin
- [**Settings**](./admin/settings.md) - Journal configuration and admin settings

### Bots
- [**Bot Overview**](./bots/README.md) - Introduction to Colloquium's bot ecosystem
- [**Editorial Bot**](./bots/editorial-bot.md) - Manuscript workflow automation
- [**Bot Configuration**](./bot-configuration.md) - Configuring bot settings
- [**Bot Help System**](./bot-help-system.md) - Bot help and command documentation

### Bot Development
- [**Bot Development Guide**](./bot-development/README.md) - Building custom bots
- [**npx Template**](./bot-development/npx-template.md) - Quick-start bot template

### Admin Guides
- [**About Page Content**](./admin-about-content.md) - Managing about page content
- [**Section Management**](./admin-section-management.md) - Managing journal sections
- [**Dynamic Content**](./admin-dynamic-content.md) - Dynamic content management
- [**Anchor Links**](./admin-anchor-links.md) - Anchor link configuration

### Deployment
- [**AWS Deployment**](./deployment/aws.md) - Deploying to AWS
- [**GCP Deployment**](./deployment/gcp.md) - Deploying to Google Cloud
- [**Troubleshooting**](./deployment/troubleshooting.md) - Common deployment issues

### Other
- [**Accept/Reject Workflow**](./ACCEPT_REJECT_WORKFLOW.md) - Editorial decision workflow

## Quick Start

### For Developers

1. **Clone and Install**
   ```bash
   git clone https://github.com/your-org/colloquium
   cd colloquium
   npm install
   ```

2. **Setup Database**
   ```bash
   npm run docker:up
   npm run db:migrate
   npm run db:seed
   ```

3. **Start Development**
   ```bash
   npm run dev
   ```

4. **Test Authentication**
   - Go to `http://localhost:3000/auth/login`
   - Use test email: `admin@colloquium.example.com`
   - Check MailHog at `http://localhost:8025` for the magic link
   - Click the magic link to sign in

### For Researchers

Colloquium is designed to make academic publishing more open and collaborative:

- **Submit Manuscripts**: Upload your research with rich formatting support
- **Engage in Review**: Participate in conversation-based peer review
- **Bot Assistance**: Get help from editorial bots for formatting, reference checking, etc.
- **Open Access**: Promote open science with transparent publishing

## Architecture

Colloquium is built as a modern web application with:

- **Frontend**: Next.js 16 with React 19, TypeScript, and Mantine UI
- **Backend**: Express.js with TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: Magic link authentication with JWT sessions
- **Bots**: Extensible automation framework for editorial tasks

## Test Accounts

For development and testing, use these pre-seeded accounts:

- **Admin**: `admin@colloquium.example.com`
- **Editor**: `editor@colloquium.example.com`
- **Author**: `author@colloquium.example.com`
- **Reviewer**: `reviewer@colloquium.example.com`

See [Authentication Documentation](./development/authentication.md) for detailed sign-in instructions.

## Project Structure

```
colloquium/
├── apps/
│   ├── api/              # Express.js backend (port 4000)
│   └── web/              # Next.js 16 frontend (port 3000)
├── packages/
│   ├── auth/             # Authentication utilities
│   ├── bots/             # Bot framework core
│   ├── bot-editorial/    # Editorial workflow bot
│   ├── bot-markdown-renderer/ # Markdown rendering bot
│   ├── bot-reference-check/   # Reference checking bot
│   ├── bot-reviewer-checklist/ # Reviewer checklist bot
│   ├── config/           # Shared ESLint config
│   ├── database/         # Prisma schema and migrations
│   ├── types/            # Shared TypeScript types
│   └── ui/               # Shared UI components
├── docs/                 # Documentation
└── scripts/              # Build and deployment scripts
```

## Contributing

We welcome contributions! Please see our contributing guidelines and:

1. Fork the repository
2. Create a feature branch
3. Make your changes with tests
4. Submit a pull request

## License

Colloquium is open source under the MIT License. See LICENSE file for details.
