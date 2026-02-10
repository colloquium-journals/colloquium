jest.mock('@colloquium/database', () => ({
  prisma: {
    conversations: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    messages: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
  },
}));

jest.mock('../../src/middleware/auth', () => ({
  authenticateWithBots: jest.fn((req: any, res: any, next: any) => {
    if (req.headers['x-bot-token'] === 'valid-token') {
      req.botContext = {
        botId: 'bot-test',
        manuscriptId: 'ms-1',
        permissions: ['read_conversations', 'write_messages'],
        type: 'BOT_SERVICE_TOKEN',
      };
    }
    next();
  }),
  requireGlobalPermission: jest.fn(() => (req: any, res: any, next: any) => next()),
  authenticate: jest.fn((req: any, res: any, next: any) => next()),
  optionalAuth: jest.fn((req: any, res: any, next: any) => next()),
  generateBotServiceToken: jest.fn(() => 'mock-token'),
}));

jest.mock('../../src/middleware/botPermissions', () => ({
  requireBotPermission: jest.fn((...perms: string[]) => (req: any, res: any, next: any) => {
    if (req.botContext) {
      for (const perm of perms) {
        if (!req.botContext.permissions.includes(perm)) {
          return res.status(403).json({ error: `Missing permission: ${perm}` });
        }
      }
    }
    next();
  }),
}));

jest.mock('../../src/bots', () => ({
  botExecutor: {
    getBotUserId: jest.fn(() => 'bot-user-id'),
    getCommandBots: jest.fn(() => []),
    processMessage: jest.fn(() => []),
  },
}));

jest.mock('../../src/routes/events', () => ({
  broadcastToConversation: jest.fn(),
}));

jest.mock('../../src/services/botActionProcessor', () => ({
  botActionProcessor: {},
}));

jest.mock('../../src/jobs', () => ({
  addBotJob: jest.fn(),
}));

jest.mock('../../src/services/workflowVisibility', () => ({
  canUserSeeMessageWithWorkflow: jest.fn(() => true),
  maskMessageAuthor: jest.fn((author: any) => author),
  getViewerRole: jest.fn(() => 'editor'),
  computeEffectiveVisibility: jest.fn(() => 'all'),
  batchPrefetchAuthorRoles: jest.fn(),
  areAllReviewsComplete: jest.fn(() => false),
}));

jest.mock('../../src/services/workflowParticipation', () => ({
  canUserParticipate: jest.fn(() => ({ allowed: true })),
  handleAuthorResponse: jest.fn(() => ({ phaseChanged: false })),
  getParticipationStatus: jest.fn(() => null),
}));

jest.mock('../../src/services/workflowConfig', () => ({
  getWorkflowConfig: jest.fn(() => null),
}));

jest.mock('../../src/routes/settings', () => ({
  getJournalSettings: jest.fn(() => ({ publicSubmissionsVisible: true })),
}));

jest.mock('../../src/services/userInvolvement', () => ({
  getUserInvolvedManuscriptIds: jest.fn(() => []),
}));

import express from 'express';
import request from 'supertest';
import conversationsRouter from '../../src/routes/conversations';
import { prisma } from '@colloquium/database';

const app = express();
app.use(express.json());
app.use('/api/conversations', conversationsRouter);

describe('conversations bot access', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/conversations/:id/messages', () => {
    it('should return messages for authenticated bot', async () => {
      (prisma.conversations.findUnique as jest.Mock).mockResolvedValue({
        id: 'conv-1',
        manuscriptId: 'ms-1',
      });

      (prisma.messages.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'msg-1',
          content: 'Hello',
          privacy: 'PUBLIC',
          createdAt: new Date(),
          parentId: null,
          isBot: false,
          metadata: null,
          users: { id: 'user-1', name: 'Alice', email: 'alice@test.com' },
        },
      ]);

      const res = await request(app)
        .get('/api/conversations/conv-1/messages')
        .set('x-bot-token', 'valid-token');

      expect(res.status).toBe(200);
      expect(res.body.messages).toHaveLength(1);
      expect(res.body.hasMore).toBe(false);
    });

    it('should reject bot accessing wrong manuscript', async () => {
      (prisma.conversations.findUnique as jest.Mock).mockResolvedValue({
        id: 'conv-1',
        manuscriptId: 'ms-other',
      });

      const res = await request(app)
        .get('/api/conversations/conv-1/messages')
        .set('x-bot-token', 'valid-token');

      expect(res.status).toBe(403);
    });

    it('should return 403 when bot lacks read_conversations permission', async () => {
      const authMock = require('../../src/middleware/auth');
      authMock.authenticateWithBots.mockImplementationOnce((req: any, res: any, next: any) => {
        req.botContext = {
          botId: 'bot-test',
          manuscriptId: 'ms-1',
          permissions: ['read_manuscript'],
          type: 'BOT_SERVICE_TOKEN',
        };
        next();
      });

      const res = await request(app)
        .get('/api/conversations/conv-1/messages')
        .set('x-bot-token', 'valid-token');

      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/conversations/:id/messages (bot)', () => {
    it('should allow bot to post a message', async () => {
      (prisma.conversations.findUnique as jest.Mock).mockResolvedValue({
        id: 'conv-1',
        title: 'Test',
        manuscriptId: 'ms-1',
        manuscripts: { workflowPhase: null, workflowRound: 1, status: 'UNDER_REVIEW' },
      });

      (prisma.messages.create as jest.Mock).mockResolvedValue({
        id: 'msg-new',
        content: 'Bot says hi',
        conversationId: 'conv-1',
        authorId: 'bot-user-id',
        parentId: null,
        privacy: 'AUTHOR_VISIBLE',
        isBot: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        users: { id: 'bot-user-id', username: 'bot-test', name: 'Test Bot', email: 'bot-test@colloquium.bot' },
      });

      (prisma.conversations.update as jest.Mock).mockResolvedValue({});

      const res = await request(app)
        .post('/api/conversations/conv-1/messages')
        .set('x-bot-token', 'valid-token')
        .send({ content: 'Bot says hi' });

      expect(res.status).toBe(201);
      expect(res.body.data.isBot).toBe(true);
    });

    it('should not trigger bot processing for bot-posted messages', async () => {
      (prisma.conversations.findUnique as jest.Mock).mockResolvedValue({
        id: 'conv-1',
        title: 'Test',
        manuscriptId: 'ms-1',
        manuscripts: { workflowPhase: null, workflowRound: 1, status: 'UNDER_REVIEW' },
      });

      (prisma.messages.create as jest.Mock).mockResolvedValue({
        id: 'msg-new',
        content: '@bot-editorial help',
        conversationId: 'conv-1',
        authorId: 'bot-user-id',
        parentId: null,
        privacy: 'AUTHOR_VISIBLE',
        isBot: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        users: { id: 'bot-user-id', username: 'bot-test', name: 'Test Bot', email: 'bot-test@colloquium.bot' },
      });

      (prisma.conversations.update as jest.Mock).mockResolvedValue({});

      const res = await request(app)
        .post('/api/conversations/conv-1/messages')
        .set('x-bot-token', 'valid-token')
        .send({ content: '@bot-editorial help' });

      expect(res.status).toBe(201);

      const { addBotJob } = require('../../src/jobs');
      expect(addBotJob).not.toHaveBeenCalled();
    });
  });
});
