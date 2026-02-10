import { createBotClient } from '../client';

const mockFetch = jest.fn();
globalThis.fetch = mockFetch;

describe('ManuscriptClient', () => {
  const client = createBotClient({
    manuscriptId: 'ms-123',
    serviceToken: 'token-abc',
    config: { apiUrl: 'http://api:4000' },
  });

  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe('get', () => {
    it('fetches manuscript data with correct URL and headers', async () => {
      const manuscriptData = {
        id: 'ms-123',
        title: 'Test Manuscript',
        abstract: 'A test abstract',
        status: 'SUBMITTED',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(manuscriptData),
      });

      const result = await client.manuscripts.get();

      expect(mockFetch).toHaveBeenCalledWith(
        'http://api:4000/api/articles/ms-123',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'x-bot-token': 'token-abc',
          }),
        })
      );
      expect(result).toEqual(manuscriptData);
    });

    it('throws BotApiError on non-ok response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: () => Promise.resolve('Not found'),
      });

      await expect(client.manuscripts.get()).rejects.toThrow('Bot API request failed: 404 Not Found');
    });
  });
});
