# create-colloquium-journal

Create a new Colloquium journal instance with a single command.

## Usage

### Interactive Mode (Recommended)

```bash
npx create-colloquium-journal init --interactive
```

This will guide you through setting up your journal with prompts for all configuration options.

### Command Line Mode

```bash
npx create-colloquium-journal init "My Journal" \
  --slug "my-journal" \
  --description "A journal for my research community" \
  --domain "journal.university.edu" \
  --admin-name "Dr. Jane Smith" \
  --admin-email "editor@university.edu" \
  --bots "editorial-bot,markdown-renderer-bot,reference-bot"
```

### Options

- `--slug <slug>` - URL-friendly journal identifier (auto-generated from name if not provided)
- `--description <description>` - Journal description (optional)
- `--domain <domain>` - Domain name for the journal (optional)
- `--admin-name <name>` - Administrator name
- `--admin-email <email>` - Administrator email
- `--bots <bots>` - Comma-separated list of bots to install
- `--interactive` - Use interactive prompts (recommended for first-time users)

## What Gets Generated

The CLI creates a complete, ready-to-deploy journal instance:

```
my-journal-instance/
├── docker-compose.yml          # Container orchestration
├── .env                       # Environment variables
├── README.md                  # Setup instructions
├── .gitignore                 # Git ignore file
├── config/
│   └── journal.json          # Journal configuration
├── data/
│   ├── uploads/             # User uploaded files
│   └── postgres/            # Database files
├── nginx/
│   ├── nginx.conf           # Web server configuration
│   └── ssl/                 # SSL certificates directory
├── scripts/
│   └── setup.sh            # Initial setup script
└── logs/                   # Application logs
```

## Quick Start

1. **Generate your journal instance:**
   ```bash
   npx create-colloquium-journal init "My Journal" --interactive
   ```

2. **Navigate to the instance directory:**
   ```bash
   cd my-journal-instance
   ```

3. **Run the setup script:**
   ```bash
   chmod +x scripts/setup.sh
   ./scripts/setup.sh
   ```

4. **Access your journal:**
   - Web Interface: http://localhost:3000
   - API: http://localhost:4000
   - Admin Panel: http://localhost:3000/admin

## Available Bots

### Required Bots (automatically installed):
- **editorial-bot** - Automates editorial workflow and decisions (required for journal functionality)

### Optional Bots (choose during setup):
- **markdown-renderer-bot** - Renders manuscripts in various formats (recommended)
- **reference-bot** - Validates and formats citations
- **reviewer-checklist-bot** - Provides structured review checklists

## Requirements

- Node.js 16 or higher
- Docker and Docker Compose
- At least 2GB available disk space

## Production Deployment

The generated instance includes:

- **SSL Configuration** - Ready for HTTPS setup
- **Nginx Configuration** - Production-ready reverse proxy
- **Database Persistence** - PostgreSQL with persistent volumes
- **File Storage** - Organized upload directory structure
- **Security** - Generated secrets and secure defaults

For production deployment, see the generated README.md in your instance directory.

## Support

- **Documentation:** https://docs.colloquium.org/self-hosting
- **Issues:** https://github.com/colloquium/colloquium/issues
- **Community:** https://github.com/colloquium/colloquium/discussions

## License

MIT License - see LICENSE file for details.