# Colloquium Documentation

Welcome to the Colloquium documentation! This is an open-source academic journal platform that emphasizes conversational peer review and community engagement.

## 📖 **Documentation Index**

### **Development**
- [**Authentication & Access Control**](./development/authentication.md) - User roles, test accounts, and security
- [**Bot Framework**](./development/bots.md) - Creating and managing bots for automation
- [**API Reference**](./development/api.md) - Complete API documentation
- [**Database Schema**](./development/database.md) - Data models and relationships

### **Bots**
- [**Bot Overview**](./bots/README.md) - Introduction to Colloquium's bot ecosystem
- [**Editorial Bot**](./bots/editorial-bot.md) - Manuscript workflow automation (✅ Active)
- [**Plagiarism Checker**](./bots/plagiarism-checker.md) - Academic integrity validation (🚧 Planned)
- [**Statistics Reviewer**](./bots/statistics-reviewer.md) - Statistical analysis validation (🚧 Planned)

### **Features**
- [**Manuscript Management**](./features/manuscripts.md) - Submission, review, and publishing
- [**Conversational Review**](./features/conversations.md) - Discussion-based peer review
- [**Content Management**](./features/content.md) - Dynamic pages and editorial content
- [**User Management**](./features/users.md) - Profiles, roles, and permissions

### **Deployment**
- [**Local Development**](./deployment/local.md) - Setting up your development environment
- [**Production Setup**](./deployment/production.md) - Deploying to production
- [**Environment Variables**](./deployment/environment.md) - Configuration options

## 🚀 **Quick Start**

### **For Developers**

1. **Clone and Install**
   ```bash
   git clone https://github.com/your-org/colloquium
   cd colloquium
   npm install
   ```

2. **Setup Database**
   ```bash
   cd packages/database
   npx prisma migrate dev
   npx prisma db seed
   ```

3. **Start Development**
   ```bash
   # Terminal 1: API Server
   cd apps/api
   npm run dev

   # Terminal 2: Frontend
   cd apps/web  
   npm run dev
   ```

4. **Test Authentication**
   - Go to `http://localhost:3001/auth/login`
   - Use test email: `admin@colloquium.example.com`
   - Check server console for magic link
   - Paste magic link in browser to sign in

### **For Researchers**

Colloquium is designed to make academic publishing more open and collaborative:

- **📝 Submit Manuscripts**: Upload your research with rich formatting support
- **💬 Engage in Review**: Participate in conversation-based peer review
- **🤖 AI Assistance**: Get help from editorial bots for formatting, plagiarism checking, etc.
- **🌍 Open Access**: Promote open science with transparent publishing

## 🏗️ **Architecture**

Colloquium is built as a modern web application with:

- **Frontend**: Next.js 14 with TypeScript and Mantine UI
- **Backend**: Express.js with TypeScript 
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: Magic link authentication with JWT sessions
- **Bots**: Extensible automation framework for editorial tasks

## 🎯 **Core Features**

### **Manuscript Management**
- Rich text editor with academic formatting
- File upload for supplementary materials
- Automated plagiarism and formatting checks
- Status tracking from submission to publication

### **Conversational Review**
- Real-time discussions between authors, reviewers, and editors
- Privacy-controlled conversations (public, semi-public, private)
- Bot integration for automated feedback and suggestions
- Threaded conversations for organized feedback

### **Editorial Workflow**
- Dashboard for editors and admins
- Automated reviewer assignment
- Editorial decision tracking
- Manuscript status management

### **Bot Ecosystem**
- **Editorial Bot**: Assign reviewers, manage decisions
- **Plagiarism Checker**: Scan for potential plagiarism
- **Statistics Reviewer**: Validate statistical methods
- **Extensible Framework**: Easy to add custom bots

## 🔐 **User Roles & Access**

| Role | Permissions |
|------|------------|
| **Public** | Browse published manuscripts, view public conversations |
| **Author** | Submit manuscripts, participate in discussions |
| **Reviewer** | Review manuscripts, provide feedback |
| **Editor** | Manage submissions, assign reviewers, make decisions |
| **Admin** | Full system access, user management, bot configuration |

## 🧪 **Test Accounts**

For development and testing, use these pre-seeded accounts:

- **Admin**: `admin@colloquium.example.com`
- **Editor**: `editor@colloquium.example.com`  
- **Author**: `author@colloquium.example.com`
- **Reviewer**: `reviewer@colloquium.example.com`

See [Authentication Documentation](./development/authentication.md) for detailed sign-in instructions.

## 📁 **Project Structure**

```
colloquium/
├── apps/
│   ├── api/          # Express.js backend
│   └── web/          # Next.js frontend
├── packages/
│   ├── auth/         # Authentication utilities
│   ├── database/     # Prisma schema and migrations
│   ├── types/        # Shared TypeScript types
│   └── ui/           # Shared UI components
├── docs/             # Documentation
└── scripts/          # Build and deployment scripts
```

## 🤝 **Contributing**

We welcome contributions! Please see our contributing guidelines and:

1. Fork the repository
2. Create a feature branch
3. Make your changes with tests
4. Submit a pull request

## 📄 **License**

Colloquium is open source under the MIT License. See LICENSE file for details.

## 💬 **Support**

- **Issues**: [GitHub Issues](https://github.com/your-org/colloquium/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-org/colloquium/discussions)  
- **Email**: `contact@colloquium.org`

---

*Building the future of open academic publishing, one conversation at a time.*