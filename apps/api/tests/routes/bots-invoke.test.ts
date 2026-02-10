jest.mock('../../src/middleware/auth', () => ({
  authenticate: jest.fn((req: any, res: any, next: any) => next()),
  authenticateWithBots: jest.fn((req: any, res: any, next: any) => {
    if (req.headers['x-bot-token'] === 'valid-token') {
      req.botContext = {
        botId: 'bot-caller',
        manuscriptId: 'ms-1',
        permissions: ['invoke_bots', 'read_manuscript'],
        type: 'BOT_SERVICE_TOKEN',
      };
    }
    next();
  }),
  requireGlobalPermission: jest.fn(() => (req: any, res: any, next: any) => next()),
  generateBotServiceToken: jest.fn(() => 'target-token'),
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
    getCommandBots: jest.fn(() => [
      { id: 'bot-target', name: 'Target', commands: [{ name: 'analyze' }], permissions: [] },
    ]),
    getInstalledBots: jest.fn(() => [
      { botId: 'bot-target', bot: { id: 'bot-target' }, config: { isEnabled: true } },
    ]),
    executeCommandBot: jest.fn(async () => ({
      messages: [{ content: 'Result from target' }],
    })),
  },
  getBotPermissions: jest.fn(() => ['read_manuscript', 'read_manuscript_files']),
}));

import express from 'express';
import request from 'supertest';
import botsRouter from '../../src/routes/bots';

const app = express();
app.use(express.json());
app.use('/api/bots', botsRouter);

describe('POST /api/bots/invoke', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should invoke a target bot and return result', async () => {
    const res = await request(app)
      .post('/api/bots/invoke')
      .set('x-bot-token', 'valid-token')
      .send({ botId: 'bot-target', command: 'analyze' });

    expect(res.status).toBe(200);
    expect(res.body.messages).toHaveLength(1);
    expect(res.body.messages[0].content).toBe('Result from target');
  });

  it('should return 401 without bot auth', async () => {
    const res = await request(app)
      .post('/api/bots/invoke')
      .send({ botId: 'bot-target', command: 'analyze' });

    expect(res.status).toBe(401);
  });

  it('should return 400 when botId or command is missing', async () => {
    const res = await request(app)
      .post('/api/bots/invoke')
      .set('x-bot-token', 'valid-token')
      .send({ botId: 'bot-target' });

    expect(res.status).toBe(400);
  });

  it('should return 404 for unknown target bot', async () => {
    const { botExecutor } = require('../../src/bots');
    botExecutor.getCommandBots.mockReturnValueOnce([]);

    const res = await request(app)
      .post('/api/bots/invoke')
      .set('x-bot-token', 'valid-token')
      .send({ botId: 'bot-unknown', command: 'analyze' });

    expect(res.status).toBe(404);
  });

  it('should return 403 when bot lacks invoke_bots permission', async () => {
    const authMock = require('../../src/middleware/auth');
    authMock.authenticateWithBots.mockImplementationOnce((req: any, res: any, next: any) => {
      req.botContext = {
        botId: 'bot-caller',
        manuscriptId: 'ms-1',
        permissions: ['read_manuscript'],
        type: 'BOT_SERVICE_TOKEN',
      };
      next();
    });

    const res = await request(app)
      .post('/api/bots/invoke')
      .set('x-bot-token', 'valid-token')
      .send({ botId: 'bot-target', command: 'analyze' });

    expect(res.status).toBe(403);
  });
});
