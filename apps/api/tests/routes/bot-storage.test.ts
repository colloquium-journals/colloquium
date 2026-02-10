jest.mock('@colloquium/database', () => ({
  prisma: {
    bot_storage: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      upsert: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

jest.mock('../../src/middleware/auth', () => ({
  authenticateWithBots: jest.fn((req: any, res: any, next: any) => {
    if (req.headers['x-bot-token'] === 'valid-token') {
      req.botContext = {
        botId: 'bot-test',
        manuscriptId: 'ms-1',
        permissions: ['bot_storage'],
        type: 'BOT_SERVICE_TOKEN',
      };
    }
    next();
  }),
}));

import express from 'express';
import request from 'supertest';
import botStorageRouter from '../../src/routes/bot-storage';
import { prisma } from '@colloquium/database';

const app = express();
app.use(express.json());
app.use('/api/bot-storage', botStorageRouter);

describe('bot-storage routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/bot-storage', () => {
    it('should list keys for authenticated bot', async () => {
      (prisma.bot_storage.findMany as jest.Mock).mockResolvedValue([
        { key: 'hash', updatedAt: '2024-01-01T00:00:00Z' },
        { key: 'analysis', updatedAt: '2024-01-02T00:00:00Z' },
      ]);

      const res = await request(app)
        .get('/api/bot-storage')
        .set('x-bot-token', 'valid-token');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0].key).toBe('hash');
      expect(prisma.bot_storage.findMany).toHaveBeenCalledWith({
        where: { botId: 'bot-test', manuscriptId: 'ms-1' },
        select: { key: true, updatedAt: true },
        orderBy: { key: 'asc' },
      });
    });

    it('should return 401 without bot context', async () => {
      const res = await request(app).get('/api/bot-storage');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/bot-storage/:key', () => {
    it('should return value for existing key', async () => {
      (prisma.bot_storage.findUnique as jest.Mock).mockResolvedValue({
        key: 'hash',
        value: { sha256: 'abc123' },
        updatedAt: '2024-01-01T00:00:00Z',
      });

      const res = await request(app)
        .get('/api/bot-storage/hash')
        .set('x-bot-token', 'valid-token');

      expect(res.status).toBe(200);
      expect(res.body.key).toBe('hash');
      expect(res.body.value).toEqual({ sha256: 'abc123' });
    });

    it('should return 404 for missing key', async () => {
      (prisma.bot_storage.findUnique as jest.Mock).mockResolvedValue(null);

      const res = await request(app)
        .get('/api/bot-storage/missing')
        .set('x-bot-token', 'valid-token');

      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/bot-storage/:key', () => {
    it('should upsert a value', async () => {
      (prisma.bot_storage.upsert as jest.Mock).mockResolvedValue({
        key: 'hash',
        value: { sha256: 'abc123' },
        updatedAt: '2024-01-01T00:00:00Z',
      });

      const res = await request(app)
        .put('/api/bot-storage/hash')
        .set('x-bot-token', 'valid-token')
        .send({ value: { sha256: 'abc123' } });

      expect(res.status).toBe(200);
      expect(res.body.key).toBe('hash');
      expect(prisma.bot_storage.upsert).toHaveBeenCalledWith({
        where: {
          botId_manuscriptId_key: { botId: 'bot-test', manuscriptId: 'ms-1', key: 'hash' },
        },
        update: { value: { sha256: 'abc123' } },
        create: {
          botId: 'bot-test',
          manuscriptId: 'ms-1',
          key: 'hash',
          value: { sha256: 'abc123' },
        },
      });
    });

    it('should return 400 when value is missing', async () => {
      const res = await request(app)
        .put('/api/bot-storage/hash')
        .set('x-bot-token', 'valid-token')
        .send({});

      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /api/bot-storage/:key', () => {
    it('should delete an existing key', async () => {
      (prisma.bot_storage.delete as jest.Mock).mockResolvedValue({});

      const res = await request(app)
        .delete('/api/bot-storage/hash')
        .set('x-bot-token', 'valid-token');

      expect(res.status).toBe(204);
    });

    it('should return 404 for missing key', async () => {
      (prisma.bot_storage.delete as jest.Mock).mockRejectedValue({ code: 'P2025' });

      const res = await request(app)
        .delete('/api/bot-storage/missing')
        .set('x-bot-token', 'valid-token');

      expect(res.status).toBe(404);
    });
  });

  describe('permission checks', () => {
    it('should return 403 when bot lacks bot_storage permission', async () => {
      // Override the middleware to set permissions without bot_storage
      const authMock = require('../../src/middleware/auth');
      authMock.authenticateWithBots.mockImplementationOnce((req: any, res: any, next: any) => {
        req.botContext = {
          botId: 'bot-test',
          manuscriptId: 'ms-1',
          permissions: ['read_files'],
          type: 'BOT_SERVICE_TOKEN',
        };
        next();
      });

      const res = await request(app)
        .get('/api/bot-storage')
        .set('x-bot-token', 'valid-token');

      expect(res.status).toBe(403);
    });
  });
});
