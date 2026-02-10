import { createBotInvocationClient } from '../bots';

describe('BotInvocationClient', () => {
  const mockHttp = {
    request: jest.fn(),
    getJSON: jest.fn(),
    postJSON: jest.fn(),
    putJSON: jest.fn(),
    patchJSON: jest.fn(),
    deleteRequest: jest.fn(),
  };

  const bots = createBotInvocationClient(mockHttp as any);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('invoke', () => {
    it('should invoke a bot command', async () => {
      const response = {
        messages: [{ content: 'Analysis complete' }],
      };
      mockHttp.postJSON.mockResolvedValue(response);

      const result = await bots.invoke('bot-reference-check', 'check');

      expect(result).toEqual(response);
      expect(mockHttp.postJSON).toHaveBeenCalledWith('/api/bots/invoke', {
        botId: 'bot-reference-check',
        command: 'check',
        parameters: undefined,
      });
    });

    it('should pass parameters when provided', async () => {
      mockHttp.postJSON.mockResolvedValue({ messages: [] });

      await bots.invoke('bot-editorial', 'release', { decision: 'revise' });

      expect(mockHttp.postJSON).toHaveBeenCalledWith('/api/bots/invoke', {
        botId: 'bot-editorial',
        command: 'release',
        parameters: { decision: 'revise' },
      });
    });
  });
});
