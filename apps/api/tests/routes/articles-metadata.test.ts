jest.mock('@colloquium/database', () => ({
  prisma: {
    manuscripts: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock('../../src/middleware/auth', () => ({
  authenticateWithBots: jest.fn((req: any, res: any, next: any) => {
    if (req.headers['x-bot-token'] === 'valid-token') {
      req.botContext = {
        botId: 'bot-test',
        manuscriptId: 'ms-1',
        permissions: ['read_manuscript', 'update_metadata'],
        type: 'BOT_SERVICE_TOKEN',
      };
    }
    next();
  }),
  authenticate: jest.fn((req: any, res: any, next: any) => next()),
  optionalAuth: jest.fn((req: any, res: any, next: any) => next()),
  requireGlobalPermission: jest.fn(() => (req: any, res: any, next: any) => next()),
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

jest.mock('../../src/services/fileStorage', () => ({ fileStorage: {} }));
jest.mock('../../src/services/formatDetection', () => ({ formatDetection: {} }));
jest.mock('../../src/jobs', () => ({ addBotJob: jest.fn() }));
jest.mock('../../src/services/botEventDispatcher', () => ({ dispatchBotEvent: jest.fn() }));

import express from 'express';
import request from 'supertest';
import articlesRouter from '../../src/routes/articles';
import { prisma } from '@colloquium/database';

const app = express();
app.use(express.json());
app.use('/api/articles', articlesRouter);

describe('PATCH /api/articles/:id/metadata', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should update metadata for authenticated bot', async () => {
    (prisma.manuscripts.findUnique as jest.Mock).mockResolvedValue({ id: 'ms-1' });
    (prisma.manuscripts.update as jest.Mock).mockResolvedValue({
      id: 'ms-1',
      title: 'Updated Title',
      abstract: 'Updated abstract',
      keywords: ['ml'],
      subjects: [],
      status: 'UNDER_REVIEW',
      updatedAt: new Date(),
    });

    const res = await request(app)
      .patch('/api/articles/ms-1/metadata')
      .set('x-bot-token', 'valid-token')
      .send({ title: 'Updated Title', abstract: 'Updated abstract', keywords: ['ml'] });

    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Updated Title');
  });

  it('should return 400 for empty body', async () => {
    const res = await request(app)
      .patch('/api/articles/ms-1/metadata')
      .set('x-bot-token', 'valid-token')
      .send({});

    expect(res.status).toBe(400);
  });

  it('should reject bot accessing wrong manuscript', async () => {
    const res = await request(app)
      .patch('/api/articles/ms-other/metadata')
      .set('x-bot-token', 'valid-token')
      .send({ title: 'Test' });

    expect(res.status).toBe(403);
  });

  it('should reject invalid fields', async () => {
    const res = await request(app)
      .patch('/api/articles/ms-1/metadata')
      .set('x-bot-token', 'valid-token')
      .send({ title: '' });

    expect(res.status).toBe(400);
  });

  it('should return 404 for nonexistent manuscript', async () => {
    (prisma.manuscripts.findUnique as jest.Mock).mockResolvedValue(null);

    const res = await request(app)
      .patch('/api/articles/ms-1/metadata')
      .set('x-bot-token', 'valid-token')
      .send({ title: 'Test' });

    expect(res.status).toBe(404);
  });

  it('should return 403 when bot lacks update_metadata permission', async () => {
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
      .patch('/api/articles/ms-1/metadata')
      .set('x-bot-token', 'valid-token')
      .send({ title: 'Test' });

    expect(res.status).toBe(403);
  });
});
