import { Request, Response, NextFunction } from 'express';
import { requireBotPermission, requireBotOnly } from '../../src/middleware/botPermissions';

describe('botPermissions middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = {};
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();
  });

  describe('requireBotPermission', () => {
    it('should pass through for non-bot requests', () => {
      const middleware = requireBotPermission('read_manuscript');
      middleware(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should pass when bot has the required permission', () => {
      mockReq.botContext = {
        botId: 'bot-test',
        manuscriptId: 'ms-1',
        permissions: ['read_manuscript', 'read_manuscript_files'],
        type: 'BOT_SERVICE_TOKEN',
      };
      const middleware = requireBotPermission('read_manuscript');
      middleware(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should reject when bot lacks permission', () => {
      mockReq.botContext = {
        botId: 'bot-test',
        manuscriptId: 'ms-1',
        permissions: ['read_manuscript'],
        type: 'BOT_SERVICE_TOKEN',
      };
      const middleware = requireBotPermission('upload_files');
      middleware(mockReq as Request, mockRes as Response, mockNext);
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Missing permission: upload_files' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should check multiple permissions', () => {
      mockReq.botContext = {
        botId: 'bot-test',
        manuscriptId: 'ms-1',
        permissions: ['read_manuscript', 'upload_files'],
        type: 'BOT_SERVICE_TOKEN',
      };
      const middleware = requireBotPermission('read_manuscript', 'upload_files');
      middleware(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should reject if any of multiple permissions is missing', () => {
      mockReq.botContext = {
        botId: 'bot-test',
        manuscriptId: 'ms-1',
        permissions: ['read_manuscript'],
        type: 'BOT_SERVICE_TOKEN',
      };
      const middleware = requireBotPermission('read_manuscript', 'upload_files');
      middleware(mockReq as Request, mockRes as Response, mockNext);
      expect(mockRes.status).toHaveBeenCalledWith(403);
    });
  });

  describe('requireBotOnly', () => {
    it('should return bot context for bot requests', () => {
      mockReq.botContext = {
        botId: 'bot-test',
        manuscriptId: 'ms-1',
        permissions: ['bot_storage'],
        type: 'BOT_SERVICE_TOKEN',
      };
      const result = requireBotOnly(mockReq as Request, mockRes as Response);
      expect(result).toEqual({ botId: 'bot-test', manuscriptId: 'ms-1' });
    });

    it('should return null and send 401 for non-bot requests', () => {
      const result = requireBotOnly(mockReq as Request, mockRes as Response);
      expect(result).toBeNull();
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Bot authentication required' });
    });
  });
});
