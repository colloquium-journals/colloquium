import request from 'supertest';
import express from 'express';
import { broadcastToConversation, getConnectionCount, closeAllConnections } from '../../src/routes/events';
import eventsRouter from '../../src/routes/events';
import { jest } from '@jest/globals';

// Mock authentication middleware
jest.mock('../../src/middleware/auth', () => ({
  authenticate: (req: any, res: any, next: any) => {
    req.user = { id: 'test-user-1' };
    next();
  },
  optionalAuth: (req: any, res: any, next: any) => next(),
  authenticateWithBots: (req: any, res: any, next: any) => next(),
  requireGlobalPermission: () => (req: any, res: any, next: any) => next(),
  generateBotServiceToken: jest.fn(() => 'mock-token'),
}));

const app = express();
app.use((req, res, next) => {
  if (typeof (res as any).flush !== 'function') {
    (res as any).flush = () => {};
  }
  next();
});
app.use('/api/events', eventsRouter);

const ORIGIN = 'http://localhost:3000';

describe('SSE Events Integration', () => {
  afterAll(() => {
    closeAllConnections();
  });

  it('should handle malformed conversation IDs', (done) => {
    request(app)
      .get('/api/events/conversations/')
      .set('Origin', ORIGIN)
      .expect(404)
      .end(done);
  });

  it('should broadcast to no connections gracefully', async () => {
    await expect(
      broadcastToConversation('nonexistent-conversation', {
        type: 'new-message',
        message: { id: 'msg-test', content: 'Test' }
      })
    ).resolves.toBeUndefined();
  });

  it('should reject requests from unknown origins', (done) => {
    request(app)
      .get('/api/events/conversations/test-conversation-origin')
      .set('Origin', 'http://evil.example.com')
      .expect(403)
      .end(done);
  });

  it('should report zero connections for unknown conversations', () => {
    expect(getConnectionCount('nonexistent')).toBe(0);
  });

  it('should report zero total connections when none established', () => {
    expect(getConnectionCount()).toBe(0);
  });
});
