# Scientific Journal Platform - Technical Implementation Plan

## Architecture Overview

### **Monorepo Structure**
```
scientific-journal-platform/
├── apps/
│   ├── web/                    # Next.js frontend application
│   ├── api/                    # Express.js backend API server
│   └── docs/                   # Documentation site (optional)
├── packages/
│   ├── database/               # Prisma schema and migrations
│   ├── types/                  # Shared TypeScript interfaces
│   ├── ui/                     # Shared React components
│   ├── auth/                   # Authentication utilities
│   ├── bots/                   # Bot framework and core bots
│   └── config/                 # Shared configuration (ESLint, etc.)
├── docker/
│   ├── docker-compose.yml      # Local development
│   ├── docker-compose.prod.yml # Production deployment
│   └── Dockerfile.*            # Container definitions
├── docs/
│   ├── api/                    # API documentation
│   ├── deployment/             # Deployment guides
│   └── development/            # Development setup
└── package.json                # Workspace root
```

## Technology Stack

### **Frontend (apps/web)**
- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript
- **Styling**: Mantine UI Library
- **Components**: Mantine components + custom extensions
- **Forms**: Mantine Forms + Zod validation
- **State Management**: React Query for server state + React built-in state
- **Rich Text**: Mantine RichTextEditor or TipTap

### **Backend (apps/api)**
- **Framework**: Express.js with TypeScript
- **Validation**: Zod schemas
- **Documentation**: OpenAPI/Swagger
- **Testing**: Jest + Supertest
- **Background Jobs**: Bull Queue with Redis
- **File Upload**: Multer + cloud storage adapter

### **Database (packages/database)**
- **ORM**: Prisma with PostgreSQL
- **Migrations**: Prisma Migrate
- **Seeding**: Prisma seed scripts
- **Testing**: Database containers for integration tests

### **Shared Packages**
- **types**: Zod schemas exported as TypeScript types
- **ui**: React components with Storybook
- **auth**: NextAuth.js utilities and middleware
- **bots**: Bot framework interfaces and utilities

## Database Schema Design

### **Core Entities**
```prisma
// packages/database/schema.prisma
model User {
  id          String   @id @default(cuid())
  email       String   @unique
  name        String?
  orcidId     String?  @unique
  role        UserRole @default(AUTHOR)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  // Relationships
  authoredMessages    Message[]
  authoredManuscripts ManuscriptAuthor[]
  reviewAssignments   ReviewAssignment[]
}

model JournalSettings {
  id          String @id @default("singleton")
  name        String
  description String?
  logoUrl     String?
  settings    Json   @default("{}")
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model Manuscript {
  id          String           @id @default(cuid())
  title       String
  abstract    String?
  content     String?          // Markdown content
  status      ManuscriptStatus @default(SUBMITTED)
  submittedAt DateTime         @default(now())
  updatedAt   DateTime         @updatedAt
  
  // Relationships
  authors       ManuscriptAuthor[]
  conversations Conversation[]
  files         ManuscriptFile[]
}

model Conversation {
  id           String            @id @default(cuid())
  title        String
  type         ConversationType  // EDITORIAL, REVIEW, PUBLIC, etc.
  privacy      PrivacyLevel      // PRIVATE, SEMI_PUBLIC, PUBLIC
  manuscriptId String
  createdAt    DateTime          @default(now())
  
  // Relationships
  manuscript   Manuscript        @relation(fields: [manuscriptId], references: [id])
  messages     Message[]
  participants ConversationParticipant[]
}

model Message {
  id             String   @id @default(cuid())
  content        String
  conversationId String
  authorId       String
  parentId       String?  // For threading like GitHub issues
  createdAt      DateTime @default(now())
  isBot          Boolean  @default(false)
  metadata       Json?    // Bot-specific data, attachments, etc.
  
  // Relationships
  conversation   Conversation @relation(fields: [conversationId], references: [id])
  author         User         @relation(fields: [authorId], references: [id])
  parent         Message?     @relation("MessageThread", fields: [parentId], references: [id])
  replies        Message[]    @relation("MessageThread")
}

enum ConversationType {
  EDITORIAL     // Editors only
  REVIEW        // Editors + assigned reviewers
  SEMI_PUBLIC   // + Authors
  PUBLIC        // + Community
  AUTHOR_ONLY   // Authors discussing among themselves
}

enum PrivacyLevel {
  PRIVATE       // Specific participants only
  SEMI_PUBLIC   // Journal members can see
  PUBLIC        // Anyone can see
}

enum ManuscriptStatus {
  SUBMITTED
  UNDER_REVIEW
  REVISION_REQUESTED
  REVISED
  ACCEPTED
  REJECTED
  PUBLISHED
}
```

### **Bot Framework Schema**
```prisma
model BotDefinition {
  id          String   @id
  name        String
  description String
  version     String
  author      String
  isPublic    Boolean  @default(false)
  config      Json     // Bot-specific configuration schema
  
  // Relationships
  install     BotInstall?
}

model BotInstall {
  id           String   @id @default(cuid())
  botId        String   @unique
  config       Json     @default("{}")
  isEnabled    Boolean  @default(true)
  installedAt  DateTime @default(now())
  
  // Relationships
  bot          BotDefinition  @relation(fields: [botId], references: [id])
}

enum UserRole {
  AUTHOR
  REVIEWER  
  EDITOR
  ADMIN
}
```

## API Architecture

### **Backend Structure (apps/api)**
```
apps/api/
├── src/
│   ├── routes/
│   │   ├── auth.ts           # Authentication endpoints
│   │   ├── settings.ts       # Journal settings management
│   │   ├── manuscripts.ts    # Manuscript management
│   │   ├── conversations.ts  # Discussion threads
│   │   ├── messages.ts       # Message posting/editing
│   │   ├── users.ts          # User management
│   │   └── bots.ts          # Bot management and execution
│   ├── middleware/
│   │   ├── auth.ts          # JWT/session validation
│   │   ├── permissions.ts   # Role-based access control
│   │   └── validation.ts    # Request validation
│   ├── services/
│   │   ├── bot-executor.ts  # Bot execution engine
│   │   ├── file-storage.ts  # File upload/download
│   │   ├── email.ts         # Notification service
│   │   └── search.ts        # Full-text search
│   ├── jobs/
│   │   ├── bot-jobs.ts      # Background bot execution
│   │   ├── email-jobs.ts    # Email notifications
│   │   └── cleanup-jobs.ts  # Data cleanup tasks
│   └── app.ts               # Express app setup
├── tests/
│   ├── integration/         # API endpoint tests
│   └── unit/               # Service unit tests
└── package.json
```

### **API Endpoints**
```typescript
// Simplified API structure - single journal per installation
GET    /api/settings                   # Get journal settings (global)
PUT    /api/settings                   # Update journal settings

GET    /api/manuscripts                # List all manuscripts
POST   /api/manuscripts                # Submit new manuscript
GET    /api/manuscripts/:id            # Get manuscript details
PUT    /api/manuscripts/:id            # Update manuscript
DELETE /api/manuscripts/:id            # Delete manuscript

GET    /api/manuscripts/:id/conversations # List conversations for manuscript
POST   /api/manuscripts/:id/conversations # Create new conversation
GET    /api/conversations/:id          # Get conversation + messages
PUT    /api/conversations/:id          # Update conversation settings
POST   /api/conversations/:id/messages # Post new message
PUT    /api/messages/:id               # Edit message
DELETE /api/messages/:id               # Delete message

GET    /api/users                      # List users (for admin)
GET    /api/users/me                   # Get current user profile
PUT    /api/users/me                   # Update user profile
POST   /api/users/:id/role             # Update user role (admin only)

GET    /api/bots                       # List available bots
GET    /api/bots/installed             # List installed bots
POST   /api/bots/:botId/install        # Install bot
DELETE /api/bots/:botId                # Uninstall bot
PUT    /api/bots/:botId/config         # Update bot configuration
POST   /api/bots/:botId/execute        # Trigger bot execution
```

## Bot Framework Architecture

### **Bot Interface (packages/bots)**
```typescript
// Core bot interface
export interface Bot {
  id: string;
  name: string;
  description: string;
  version: string;
  triggers: BotTrigger[];
  permissions: BotPermission[];
  execute: (context: BotContext) => Promise<BotResponse>;
}

export interface BotContext {
  conversationId: string;
  manuscriptId: string;
  triggeredBy: {
    messageId: string;
    userId: string;
    trigger: BotTrigger;
  };
  journal: {
    id: string;
    settings: Record<string, any>;
  };
  config: Record<string, any>; // Bot-specific configuration
}

export interface BotResponse {
  messages?: {
    content: string;
    replyTo?: string; // Message ID to reply to
    attachments?: BotAttachment[];
  }[];
  actions?: BotAction[]; // Side effects (update manuscript status, etc.)
  errors?: string[];
}

export enum BotTrigger {
  MENTION = 'mention',           // @bot-name in message
  KEYWORD = 'keyword',           // Specific keywords
  MANUSCRIPT_SUBMITTED = 'manuscript_submitted',
  REVIEW_COMPLETE = 'review_complete',
  SCHEDULED = 'scheduled',       // Cron-like scheduling
}
```

### **Core Bot Examples**
```typescript
// Plagiarism checker bot
export const plagiarismBot: Bot = {
  id: 'plagiarism-checker',
  name: 'Plagiarism Checker',
  description: 'Checks manuscripts for potential plagiarism',
  version: '1.0.0',
  triggers: [BotTrigger.MENTION, BotTrigger.MANUSCRIPT_SUBMITTED],
  permissions: [BotPermission.READ_MANUSCRIPT],
  
  async execute(context: BotContext): Promise<BotResponse> {
    const manuscript = await getManuscript(context.manuscriptId);
    const results = await checkPlagiarism(manuscript.content);
    
    return {
      messages: [{
        content: `Plagiarism check complete. ${results.matches} potential matches found.`,
        attachments: [{
          type: 'report',
          filename: 'plagiarism-report.pdf',
          data: results.report
        }]
      }]
    };
  }
};

// Statistics reviewer bot
export const statsBot: Bot = {
  id: 'stats-reviewer',
  name: 'Statistics Reviewer',
  description: 'Reviews statistical methods and analyses',
  version: '1.0.0',
  triggers: [BotTrigger.MENTION],
  permissions: [BotPermission.READ_MANUSCRIPT, BotPermission.READ_FILES],
  
  async execute(context: BotContext): Promise<BotResponse> {
    const files = await getManuscriptFiles(context.manuscriptId);
    const dataFiles = files.filter(f => f.type === 'data');
    
    if (dataFiles.length === 0) {
      return {
        messages: [{
          content: 'No data files found. Please upload data files for statistical review.'
        }]
      };
    }
    
    const analysis = await reviewStatistics(dataFiles);
    
    return {
      messages: [{
        content: `Statistical review complete. ${analysis.issues.length} issues identified.`,
        attachments: [{
          type: 'analysis',
          filename: 'statistical-review.json',
          data: analysis
        }]
      }]
    };
  }
};
```

## Authentication & Authorization

### **Magic Link Authentication (packages/auth)**
```typescript
// Magic link flow
export async function sendMagicLink(email: string, redirectUrl?: string) {
  const token = generateSecureToken();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
  
  await prisma.magicLink.create({
    data: {
      email,
      token,
      expiresAt,
      redirectUrl
    }
  });
  
  await sendEmail({
    to: email,
    subject: 'Sign in to Journal Platform',
    template: 'magic-link',
    data: {
      loginUrl: `${BASE_URL}/auth/verify?token=${token}`
    }
  });
}

export async function verifyMagicLink(token: string) {
  const link = await prisma.magicLink.findFirst({
    where: {
      token,
      expiresAt: { gt: new Date() },
      usedAt: null
    }
  });
  
  if (!link) {
    throw new Error('Invalid or expired magic link');
  }
  
  // Mark as used
  await prisma.magicLink.update({
    where: { id: link.id },
    data: { usedAt: new Date() }
  });
  
  // Create or find user
  const user = await prisma.user.upsert({
    where: { email: link.email },
    create: { email: link.email },
    update: { lastLoginAt: new Date() }
  });
  
  // Generate JWT
  return generateJWT({ userId: user.id, email: user.email });
}
```

### **Role-Based Permissions**
```typescript
export enum Role {
  AUTHOR = 'author',
  REVIEWER = 'reviewer',
  EDITOR = 'editor',
  ADMIN = 'admin'
}

export enum Permission {
  READ_MANUSCRIPT = 'read_manuscript',
  EDIT_MANUSCRIPT = 'edit_manuscript',
  CREATE_CONVERSATION = 'create_conversation',
  MODERATE_CONVERSATION = 'moderate_conversation',
  ASSIGN_REVIEWERS = 'assign_reviewers',
  MAKE_EDITORIAL_DECISIONS = 'make_editorial_decisions',
  INSTALL_BOTS = 'install_bots',
  MANAGE_SETTINGS = 'manage_settings',
  MANAGE_USERS = 'manage_users'
}

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  [Role.AUTHOR]: [
    Permission.READ_MANUSCRIPT,
    Permission.EDIT_MANUSCRIPT,
    Permission.CREATE_CONVERSATION
  ],
  [Role.REVIEWER]: [
    Permission.READ_MANUSCRIPT,
    Permission.CREATE_CONVERSATION
  ],
  [Role.EDITOR]: [
    Permission.READ_MANUSCRIPT,
    Permission.CREATE_CONVERSATION,
    Permission.MODERATE_CONVERSATION,
    Permission.ASSIGN_REVIEWERS,
    Permission.MAKE_EDITORIAL_DECISIONS
  ],
  [Role.ADMIN]: [
    Permission.READ_MANUSCRIPT,
    Permission.CREATE_CONVERSATION,
    Permission.MODERATE_CONVERSATION,
    Permission.ASSIGN_REVIEWERS,
    Permission.MAKE_EDITORIAL_DECISIONS,
    Permission.INSTALL_BOTS,
    Permission.MANAGE_SETTINGS,
    Permission.MANAGE_USERS
  ]
};

// Simplified permission checking
export function hasPermission(user: User, permission: Permission): boolean {
  const rolePermissions = ROLE_PERMISSIONS[user.role];
  return rolePermissions.includes(permission);
}
```

## Frontend Architecture

### **Next.js App Structure (apps/web)**
```
apps/web/
├── src/
│   ├── app/                    # App Router pages
│   │   ├── (auth)/            # Auth-related pages
│   │   ├── journals/          # Journal management
│   │   ├── manuscripts/       # Manuscript workflows
│   │   └── conversations/     # Discussion interfaces
│   ├── components/
│   │   ├── ui/               # Basic UI components
│   │   ├── forms/            # Form components
│   │   ├── conversations/    # Thread/message components
│   │   └── manuscripts/      # Manuscript-specific components
│   ├── hooks/
│   │   ├── api/              # React Query hooks
│   │   ├── auth/             # Authentication hooks
│   │   └── forms/            # Form management hooks
│   ├── lib/
│   │   ├── api.ts            # API client configuration
│   │   ├── auth.ts           # Auth utilities
│   │   └── utils.ts          # General utilities
│   └── types/                # Component-specific types
├── public/                    # Static assets
└── package.json
```

### **API Integration with React Query and Mantine**
```typescript
// hooks/api/manuscripts.ts
export function useManuscripts() {
  return useQuery({
    queryKey: ['manuscripts'],
    queryFn: () => api.get('/manuscripts')
  });
}

export function useManuscript(manuscriptId: string) {
  return useQuery({
    queryKey: ['manuscript', manuscriptId],
    queryFn: () => api.get(`/manuscripts/${manuscriptId}`)
  });
}

// hooks/api/conversations.ts
export function useConversations(manuscriptId: string) {
  return useQuery({
    queryKey: ['conversations', manuscriptId],
    queryFn: () => api.get(`/manuscripts/${manuscriptId}/conversations`)
  });
}

export function useCreateMessage() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: CreateMessageData) => 
      api.post(`/conversations/${data.conversationId}/messages`, data),
    onSuccess: (_, variables) => {
      // Invalidate conversation to refetch messages
      queryClient.invalidateQueries({
        queryKey: ['conversation', variables.conversationId]
      });
    }
  });
}

// Usage in components with Mantine
import { Card, Text, Stack, Button, Textarea } from '@mantine/core';
import { useForm } from '@mantine/form';

export function ConversationThread({ conversationId }: Props) {
  const { data: conversation } = useConversation(conversationId);
  const createMessage = useCreateMessage();
  
  const form = useForm({
    initialValues: {
      content: ''
    },
    validate: {
      content: (value) => value.length > 0 ? null : 'Message cannot be empty'
    }
  });

  const handleSubmit = (values: { content: string }) => {
    createMessage.mutate({
      conversationId,
      content: values.content,
      parentId: null // Top-level message
    });
    form.reset();
  };
  
  return (
    <Stack spacing="md">
      <Card shadow="sm" padding="lg">
        <Text size="xl" weight={500} mb="md">
          {conversation?.title}
        </Text>
        <MessageList messages={conversation?.messages} />
      </Card>
      
      <Card shadow="sm" padding="lg">
        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack spacing="md">
            <Textarea
              placeholder="Write your message..."
              autosize
              minRows={3}
              {...form.getInputProps('content')}
            />
            <Button type="submit" loading={createMessage.isLoading}>
              Send Message
            </Button>
          </Stack>
        </form>
      </Card>
    </Stack>
  );
}
```

### **Mantine Theme Configuration**
```typescript
// lib/theme.ts
import { MantineProvider, createTheme } from '@mantine/core';

export const academicTheme = createTheme({
  colors: {
    academic: [
      '#f8f9fa', // Light gray for backgrounds
      '#e9ecef', // Subtle borders
      '#dee2e6', // Disabled states
      '#ced4da', // Placeholder text
      '#adb5bd', // Secondary text
      '#6c757d', // Tertiary text
      '#495057', // Body text
      '#343a40', // Headings
      '#212529', // Dark text
      '#000000', // Pure black
    ],
    // Status colors for manuscript workflow
    submitted: ['#e3f2fd', '#bbdefb', '#90caf9', '#64b5f6', '#42a5f5', '#2196f3', '#1e88e5', '#1976d2', '#1565c0', '#0d47a1'],
    review: ['#fff3e0', '#ffe0b2', '#ffcc02', '#ffb74d', '#ffa726', '#ff9800', '#fb8c00', '#f57c00', '#ef6c00', '#e65100'],
    accepted: ['#e8f5e8', '#c8e6c8', '#a5d6a7', '#81c784', '#66bb6a', '#4caf50', '#43a047', '#388e3c', '#2e7d32', '#1b5e20'],
    rejected: ['#ffebee', '#ffcdd2', '#ef9a9a', '#e57373', '#ef5350', '#f44336', '#e53935', '#d32f2f', '#c62828', '#b71c1c']
  },
  primaryColor: 'academic',
  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif',
  headings: { 
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif',
    sizes: {
      h1: { fontSize: '2rem', fontWeight: '700' },
      h2: { fontSize: '1.5rem', fontWeight: '600' },
      h3: { fontSize: '1.25rem', fontWeight: '600' },
    }
  },
  components: {
    Card: {
      defaultProps: {
        shadow: 'sm',
        padding: 'lg',
        radius: 'md'
      }
    },
    Button: {
      defaultProps: {
        radius: 'md'
      }
    },
    TextInput: {
      defaultProps: {
        radius: 'md'
      }
    }
  }
});

// App setup with providers
// apps/web/src/app/layout.tsx
import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { ModalsProvider } from '@mantine/modals';
import { academicTheme } from '@/lib/theme';
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import '@mantine/dates/styles.css';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <MantineProvider theme={academicTheme}>
          <ModalsProvider>
            <Notifications />
            {children}
          </ModalsProvider>
        </MantineProvider>
      </body>
    </html>
  );
}
```

### **Academic-Focused Component Examples**
```typescript
// components/manuscripts/ManuscriptCard.tsx
import { Card, Group, Text, Badge, Stack, ActionIcon, Menu } from '@mantine/core';
import { IconDots, IconEye, IconEdit, IconTrash } from '@tabler/icons-react';

interface ManuscriptCardProps {
  manuscript: {
    id: string;
    title: string;
    status: ManuscriptStatus;
    submittedAt: Date;
    authors: string[];
  };
}

export function ManuscriptCard({ manuscript }: ManuscriptCardProps) {
  const getStatusColor = (status: ManuscriptStatus) => {
    switch (status) {
      case 'SUBMITTED': return 'submitted';
      case 'UNDER_REVIEW': return 'review';
      case 'ACCEPTED': return 'accepted';
      case 'REJECTED': return 'rejected';
      default: return 'gray';
    }
  };

  return (
    <Card>
      <Group justify="space-between" mb="xs">
        <Text fw={500} size="lg" lineClamp={2}>
          {manuscript.title}
        </Text>
        <Menu shadow="md" width={200}>
          <Menu.Target>
            <ActionIcon variant="subtle">
              <IconDots size={16} />
            </ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item leftSection={<IconEye size={14} />}>
              View Details
            </Menu.Item>
            <Menu.Item leftSection={<IconEdit size={14} />}>
              Edit
            </Menu.Item>
            <Menu.Divider />
            <Menu.Item color="red" leftSection={<IconTrash size={14} />}>
              Delete
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </Group>

      <Stack gap="xs">
        <Group gap="xs">
          <Badge color={getStatusColor(manuscript.status)} variant="light">
            {manuscript.status.replace('_', ' ')}
          </Badge>
        </Group>
        
        <Text size="sm" c="dimmed">
          Authors: {manuscript.authors.join(', ')}
        </Text>
        
        <Text size="sm" c="dimmed">
          Submitted: {manuscript.submittedAt.toLocaleDateString()}
        </Text>
      </Stack>
    </Card>
  );
}

// components/conversations/ConversationMessage.tsx
import { Card, Group, Text, Avatar, ActionIcon, Menu } from '@mantine/core';
import { IconDots, IconReply, IconFlag } from '@tabler/icons-react';

interface ConversationMessageProps {
  message: {
    id: string;
    content: string;
    author: { name: string; email: string };
    createdAt: Date;
    isBot: boolean;
  };
  onReply: (messageId: string) => void;
}

export function ConversationMessage({ message, onReply }: ConversationMessageProps) {
  return (
    <Card>
      <Group justify="space-between" align="flex-start" mb="sm">
        <Group>
          <Avatar 
            size="sm" 
            color={message.isBot ? 'blue' : 'academic'}
          >
            {message.author.name.charAt(0)}
          </Avatar>
          <div>
            <Text size="sm" fw={500}>
              {message.author.name}
              {message.isBot && <Badge size="xs" ml="xs">Bot</Badge>}
            </Text>
            <Text size="xs" c="dimmed">
              {message.createdAt.toLocaleString()}
            </Text>
          </div>
        </Group>

        <Menu shadow="md" width={150}>
          <Menu.Target>
            <ActionIcon variant="subtle" size="sm">
              <IconDots size={14} />
            </ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item 
              leftSection={<IconReply size={14} />}
              onClick={() => onReply(message.id)}
            >
              Reply
            </Menu.Item>
            <Menu.Item leftSection={<IconFlag size={14} />}>
              Report
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </Group>

      <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
        {message.content}
      </Text>
    </Card>
  );
}
```

## Development Workflow

### **Package Management**
```json
// Root package.json
{
  "name": "scientific-journal-platform",
  "private": true,
  "workspaces": [
    "apps/*",
    "packages/*"
  ],
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "test": "turbo run test",
    "lint": "turbo run lint",
    "db:migrate": "cd packages/database && npx prisma migrate dev",
    "db:seed": "cd packages/database && npx prisma db seed"
  },
  "devDependencies": {
    "turbo": "^1.10.0",
    "@types/node": "^20.0.0",
    "typescript": "^5.0.0"
  }
}

// Frontend app package.json (apps/web/package.json)
{
  "name": "@journal/web",
  "version": "0.1.0",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "next": "^15.0.0",
    "react": "^18.0.0",
    "react-dom": "^18.0.0",
    "@mantine/core": "^7.0.0",
    "@mantine/hooks": "^7.0.0",
    "@mantine/form": "^7.0.0",
    "@mantine/notifications": "^7.0.0",
    "@mantine/modals": "^7.0.0",
    "@mantine/dates": "^7.0.0",
    "@mantine/spotlight": "^7.0.0",
    "@mantine/rich-text-editor": "^7.0.0",
    "@tabler/icons-react": "^2.0.0",
    "@tanstack/react-query": "^5.0.0",
    "zod": "^3.0.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/react": "^18.0.0",
    "@types/react-dom": "^18.0.0",
    "typescript": "^5.0.0"
  }
}
```

### **Development Setup**
```bash
# Initial setup
git clone <repository>
cd scientific-journal-platform
npm install

# Database setup
cp .env.example .env
# Edit .env with database credentials
npm run db:migrate
npm run db:seed

# Start development servers
npm run dev  # Starts both frontend and backend

# Run tests
npm run test

# Build for production
npm run build
```

### **Docker Development**
```yaml
# docker/docker-compose.yml
version: '3.8'
services:
  web:
    build: 
      context: ..
      dockerfile: docker/Dockerfile.web
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_API_URL=http://api:4000
    volumes:
      - ../apps/web:/app
      - /app/node_modules
    command: npm run dev

  api:
    build:
      context: ..
      dockerfile: docker/Dockerfile.api
    ports:
      - "4000:4000"
    environment:
      - DATABASE_URL=postgresql://postgres:password@postgres:5432/journal_dev
      - REDIS_URL=redis://redis:6379
    volumes:
      - ../apps/api:/app
      - /app/node_modules
    command: npm run dev
    depends_on:
      - postgres
      - redis

  postgres:
    image: postgres:15
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
      - POSTGRES_DB=journal_dev
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

volumes:
  postgres_data:
```

## Deployment Strategy

### **Production Deployment Options**

#### **Self-Hosted with Docker**
```yaml
# docker/docker-compose.prod.yml
version: '3.8'
services:
  web:
    build:
      context: ..
      dockerfile: docker/Dockerfile.web
      target: production
    environment:
      - NEXT_PUBLIC_API_URL=https://api.yourjournal.org
    restart: unless-stopped

  api:
    build:
      context: ..
      dockerfile: docker/Dockerfile.api
      target: production
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - JWT_SECRET=${JWT_SECRET}
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/ssl/certs
    depends_on:
      - web
      - api
    restart: unless-stopped
```

#### **Cloud Platform Deployment**
- **Frontend**: Vercel, Netlify, or CloudFlare Pages
- **Backend**: Railway, Render, or DigitalOcean App Platform
- **Database**: Managed PostgreSQL (AWS RDS, DigitalOcean, etc.)
- **Redis**: Managed Redis service
- **Storage**: AWS S3, DigitalOcean Spaces, or CloudFlare R2

### **One-Click Deployment Scripts**
```bash
#!/bin/bash
# scripts/deploy-digitalocean.sh

# Create DigitalOcean App Platform spec
cat > .do/app.yaml << EOF
name: journal-platform
services:
- name: web
  source_dir: apps/web
  github:
    repo: your-org/scientific-journal-platform
    branch: main
  run_command: npm start
  environment_slug: node-js
  instance_count: 1
  instance_size_slug: basic-xxs
  
- name: api
  source_dir: apps/api
  github:
    repo: your-org/scientific-journal-platform
    branch: main
  run_command: npm start
  environment_slug: node-js
  instance_count: 1
  instance_size_slug: basic-xxs
  
databases:
- engine: PG
  name: journal-db
  version: "15"
EOF

# Deploy to DigitalOcean
doctl apps create --spec .do/app.yaml
```

## Implementation Phases

### **Phase 1: Core Infrastructure (Month 1)**
- [ ] Set up monorepo with Turborepo
- [ ] Basic Next.js frontend with authentication
- [ ] Express.js API with core endpoints
- [ ] Prisma database schema and migrations (single journal model)
- [ ] Docker development environment
- [ ] Basic conversation/message CRUD
- [ ] Global settings management

### **Phase 2: Editorial Workflow (Month 2)**
- [ ] Manuscript submission and management
- [ ] User roles and permissions (simplified global roles)
- [ ] Conversation privacy controls
- [ ] Email notifications
- [ ] Basic bot framework infrastructure
- [ ] File upload and storage

### **Phase 3: Bot Ecosystem (Month 3)**
- [ ] Bot execution engine
- [ ] Core bots (plagiarism, formatting)
- [ ] Bot installation and configuration UI (global installation)
- [ ] Background job processing
- [ ] Bot marketplace foundation

### **Phase 4: Production Ready (Month 4)**
- [ ] Production deployment configurations
- [ ] Performance optimization
- [ ] Security hardening
- [ ] Documentation and self-hosting guides
- [ ] Testing and quality assurance
- [ ] Launch with founder's journal

## Testing Strategy

### **Backend Testing**
```typescript
// Integration tests for API endpoints
describe('Conversations API', () => {
  beforeEach(async () => {
    await setupTestDatabase();
  });

  it('should create conversation with proper permissions', async () => {
    const response = await request(app)
      .post('/api/manuscripts/123/conversations')
      .set('Authorization', `Bearer ${editorToken}`)
      .send({
        title: 'Review Discussion',
        type: 'REVIEW',
        privacy: 'PRIVATE'
      });

    expect(response.status).toBe(201);
    expect(response.body.title).toBe('Review Discussion');
  });
});
```

### **Frontend Testing**
```typescript
// Component tests with React Testing Library
import { render, screen, fireEvent } from '@testing-library/react';
import { MessageForm } from './MessageForm';

test('submits message when form is filled', async () => {
  const onSubmit = jest.fn();
  render(<MessageForm onSubmit={onSubmit} />);
  
  fireEvent.change(screen.getByRole('textbox'), {
    target: { value: 'Test message content' }
  });
  
  fireEvent.click(screen.getByRole('button', { name: /send/i }));
  
  expect(onSubmit).toHaveBeenCalledWith('Test message content');
});
```

### **Bot Testing**
```typescript
// Bot execution tests
describe('PlagiarismBot', () => {
  it('should detect potential plagiarism', async () => {
    const context = createBotContext({
      manuscriptId: 'test-manuscript',
      content: 'Some potentially plagiarized content...'
    });
    
    const response = await plagiarismBot.execute(context);
    
    expect(response.messages).toHaveLength(1);
    expect(response.messages[0].content).toContain('potential matches found');
  });
});
```

## Security Considerations

### **Authentication & Authorization**
- JWT tokens with reasonable expiration times
- Magic link tokens single-use with short expiration
- Role-based access control at API level
- Conversation-level permission overrides

### **Data Protection**
- Input validation with Zod schemas
- SQL injection prevention through Prisma
- XSS prevention through proper React rendering
- File upload validation and scanning

### **Bot Security**
- Bot execution in isolated environments
- Limited bot permissions based on functionality
- Bot code review and approval process
- Resource limits on bot execution

### **Infrastructure Security**
- HTTPS everywhere with proper certificates
- Database connection encryption
- Environment variable security
- Regular security updates and patches

This technical plan provides a comprehensive foundation for building the scientific journal publishing platform with a clean separation between frontend and backend, while maintaining the flexibility and self-hosting capabilities essential for academic institutions.