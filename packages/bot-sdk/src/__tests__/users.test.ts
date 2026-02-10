import { createBotClient } from '../client';

const mockFetch = jest.fn();
globalThis.fetch = mockFetch;

describe('UserClient', () => {
  const client = createBotClient({
    manuscriptId: 'ms-123',
    serviceToken: 'token-abc',
    config: { apiUrl: 'http://api:4000' },
  });

  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe('get', () => {
    it('fetches user by ID', async () => {
      const user = { id: 'u1', name: 'Dr. Smith', email: 'smith@test.com', role: 'ACTION_EDITOR' };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(user),
      });

      const result = await client.users.get('u1');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://api:4000/api/users/u1',
        expect.objectContaining({
          headers: expect.objectContaining({
            'x-bot-token': 'token-abc',
          }),
        })
      );
      expect(result).toEqual(user);
    });
  });

  describe('search', () => {
    it('searches users by query', async () => {
      const users = [
        { id: 'u1', name: 'Dr. Smith', email: 'smith@test.com', role: 'ACTION_EDITOR' },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ users }),
      });

      const result = await client.users.search('Smith');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://api:4000/api/users?search=Smith',
        expect.any(Object)
      );
      expect(result).toEqual(users);
    });

    it('encodes query parameters', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ users: [] }),
      });

      await client.users.search('Dr. Smith & Jones');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://api:4000/api/users?search=Dr.%20Smith%20%26%20Jones',
        expect.any(Object)
      );
    });

    it('returns empty array when no users found', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

      const result = await client.users.search('nobody');
      expect(result).toEqual([]);
    });
  });
});
