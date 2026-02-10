jest.mock('@colloquium/database', () => ({
  prisma: {
    manuscripts: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock('../../src/middleware/auth', () => ({
  authenticateWithBots: jest.fn((req: any, res: any, next: any) => {
    if (req.headers['x-bot-token'] === 'valid-token') {
      req.botContext = {
        botId: 'bot-test',
        manuscriptId: 'ms-1',
        permissions: ['read_manuscript', 'read_manuscript_files'],
        type: 'BOT_SERVICE_TOKEN',
      };
    } else if (req.headers.authorization) {
      req.user = { id: 'user-1', email: 'test@test.com', name: 'Test', role: 'ADMIN', orcidId: null, createdAt: new Date() };
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

describe('GET /api/articles/:id/workflow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return workflow state for authenticated bot', async () => {
    (prisma.manuscripts.findUnique as jest.Mock).mockResolvedValue({
      workflowPhase: 'REVIEW',
      workflowRound: 1,
      status: 'UNDER_REVIEW',
      releasedAt: null,
      review_assignments: [
        { reviewerId: 'rev-1', status: 'PENDING', dueDate: '2024-03-01', assignedAt: '2024-02-01' },
      ],
      action_editors: { editorId: 'ed-1', assignedAt: '2024-01-15' },
    });

    const res = await request(app)
      .get('/api/articles/ms-1/workflow')
      .set('x-bot-token', 'valid-token');

    expect(res.status).toBe(200);
    expect(res.body.phase).toBe('REVIEW');
    expect(res.body.round).toBe(1);
    expect(res.body.status).toBe('UNDER_REVIEW');
    expect(res.body.reviewAssignments).toHaveLength(1);
    expect(res.body.actionEditor).toEqual({ editorId: 'ed-1', assignedAt: '2024-01-15' });
  });

  it('should return 404 for nonexistent manuscript', async () => {
    (prisma.manuscripts.findUnique as jest.Mock).mockResolvedValue(null);

    const res = await request(app)
      .get('/api/articles/ms-1/workflow')
      .set('x-bot-token', 'valid-token');

    expect(res.status).toBe(404);
  });

  it('should reject bot accessing wrong manuscript', async () => {
    const res = await request(app)
      .get('/api/articles/ms-other/workflow')
      .set('x-bot-token', 'valid-token');

    expect(res.status).toBe(403);
  });
});
