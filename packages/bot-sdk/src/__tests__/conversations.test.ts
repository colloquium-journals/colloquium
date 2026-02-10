import { createConversationClient } from '../conversations';

describe('ConversationClient', () => {
  const mockHttp = {
    request: jest.fn(),
    getJSON: jest.fn(),
    postJSON: jest.fn(),
    putJSON: jest.fn(),
    patchJSON: jest.fn(),
    deleteRequest: jest.fn(),
  };

  const conversations = createConversationClient(mockHttp as any, 'ms-123');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getMessages', () => {
    it('should fetch messages from conversation', async () => {
      const response = {
        messages: [{ id: 'msg-1', content: 'Hello' }],
        hasMore: false,
      };
      mockHttp.getJSON.mockResolvedValue(response);

      const result = await conversations.getMessages('conv-1');

      expect(result).toEqual(response);
      expect(mockHttp.getJSON).toHaveBeenCalledWith('/api/conversations/conv-1/messages');
    });

    it('should pass pagination options', async () => {
      mockHttp.getJSON.mockResolvedValue({ messages: [], hasMore: false });

      await conversations.getMessages('conv-1', { limit: 10, before: 'msg-5' });

      expect(mockHttp.getJSON).toHaveBeenCalledWith(
        '/api/conversations/conv-1/messages?limit=10&before=msg-5'
      );
    });
  });

  describe('postMessage', () => {
    it('should post a message to conversation', async () => {
      const msg = { id: 'msg-new', content: 'Bot reply' };
      mockHttp.postJSON.mockResolvedValue({ data: msg });

      const result = await conversations.postMessage('conv-1', 'Bot reply');

      expect(result).toEqual(msg);
      expect(mockHttp.postJSON).toHaveBeenCalledWith(
        '/api/conversations/conv-1/messages',
        { content: 'Bot reply' }
      );
    });

    it('should pass optional parameters', async () => {
      mockHttp.postJSON.mockResolvedValue({ data: { id: 'msg-new' } });

      await conversations.postMessage('conv-1', 'Reply', {
        parentId: 'msg-1',
        privacy: 'EDITOR_ONLY',
      });

      expect(mockHttp.postJSON).toHaveBeenCalledWith(
        '/api/conversations/conv-1/messages',
        { content: 'Reply', parentId: 'msg-1', privacy: 'EDITOR_ONLY' }
      );
    });
  });

  describe('listConversations', () => {
    it('should list conversations for manuscript', async () => {
      const convos = [{ id: 'conv-1', title: 'Review', type: 'REVIEW' }];
      mockHttp.getJSON.mockResolvedValue({ conversations: convos });

      const result = await conversations.listConversations();

      expect(result).toEqual(convos);
      expect(mockHttp.getJSON).toHaveBeenCalledWith(
        '/api/conversations?manuscriptId=ms-123'
      );
    });
  });
});
