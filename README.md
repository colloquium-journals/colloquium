# Colloquium

An open-source scientific journal publishing platform that democratizes academic publishing through conversational review and extensible bot automation.

## Features

- **Conversational Review**: All review processes happen in structured chat environments with granular privacy controls
- **Bot Ecosystem**: Extensible plugin architecture for automated plagiarism detection, statistical analysis, and workflow management
- **Self-Sovereign**: Journals own their data and make their own governance decisions
- **Self-Hosting**: Deploy on your own infrastructure with optional managed hosting
- **Modern Tech Stack**: Built with Next.js, Express.js, PostgreSQL, and TypeScript

## Quick Start

### Prerequisites

- **Node.js 18+** and npm
- **Docker Desktop** (must be running before setup)
  - [Download Docker Desktop](https://docs.docker.com/get-docker/)
  - Make sure Docker is started before running setup
- PostgreSQL 15+ (if not using Docker)

### Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-org/colloquium.git
   cd colloquium
   ```

2. **Run the setup script**
   ```bash
   ./scripts/dev-setup.sh
   ```

3. **Start development servers**
   ```bash
   npm run dev
   ```

4. **Access the application**
   - Frontend: http://localhost:3000
   - API: http://localhost:4000
   - Database UI: http://localhost:5555 (run `npm run db:studio`)
   - Email testing: http://localhost:8025

### Manual Setup

If you prefer manual setup:

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Set up environment**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Start services with Docker**
   ```bash
   cd docker
   docker-compose up -d postgres mailhog
   ```

4. **Run database migrations**
   ```bash
   npm run db:migrate
   npm run db:seed
   ```

5. **Build packages**
   ```bash
   npm run build
   ```

6. **Start development**
   ```bash
   npm run dev
   ```

## Project Structure

```
colloquium/
├── apps/
│   ├── web/          # Next.js frontend application
│   └── api/          # Express.js backend API server
├── packages/
│   ├── database/     # Prisma schema and utilities
│   ├── types/        # Shared TypeScript types and validation
│   ├── ui/           # Shared React components
│   ├── auth/         # Authentication utilities
│   ├── bots/         # Bot framework and core bots
│   └── config/       # Shared configuration (ESLint, etc.)
├── docker/           # Docker configuration files
├── scripts/          # Development and deployment scripts
└── docs/            # Documentation
```

## Available Scripts

- `npm run dev` - Start all development servers
- `npm run build` - Build all applications and packages
- `npm run test` - Run test suites
- `npm run lint` - Run linting
- `npm run type-check` - Run TypeScript type checking
- `npm run db:migrate` - Run database migrations
- `npm run db:seed` - Seed database with sample data
- `npm run db:studio` - Open Prisma Studio

## Core Concepts

### Manuscripts and Review
- Authors submit manuscripts through the web interface
- Manuscripts go through conversational review processes
- Multiple conversation types support different privacy levels

### Bot Ecosystem
- Bots provide automated assistance throughout the review process
- Core bots include plagiarism checking, statistical analysis, and formatting
- Extensible framework allows custom bot development

### User Roles
- **Authors**: Submit and revise manuscripts
- **Reviewers**: Participate in review conversations
- **Editors**: Manage editorial workflow and decisions
- **Admins**: Configure journal settings and manage users

## Deployment

### Self-Hosting with Docker

1. **Production deployment**
   ```bash
   cd docker
   docker-compose -f docker-compose.prod.yml up -d
   ```

2. **Configure environment variables**
   - Copy and configure production environment variables
   - Set up SSL certificates for HTTPS
   - Configure SMTP for email delivery

### Cloud Deployment

The platform can be deployed on various cloud providers:
- **Frontend**: Vercel, Netlify, or CloudFlare Pages
- **Backend**: Railway, Render, or DigitalOcean App Platform
- **Database**: Managed PostgreSQL (AWS RDS, DigitalOcean, etc.)

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- 📖 [Documentation](docs/)
- 🐛 [Issue Tracker](https://github.com/your-org/colloquium/issues)
- 💬 [Discussions](https://github.com/your-org/colloquium/discussions)