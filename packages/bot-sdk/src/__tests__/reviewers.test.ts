import { createBotClient } from '../client';

const mockFetch = jest.fn();
globalThis.fetch = mockFetch;

describe('ReviewerClient', () => {
  const client = createBotClient({
    manuscriptId: 'ms-123',
    serviceToken: 'token-abc',
    config: { apiUrl: 'http://api:4000' },
  });

  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe('list', () => {
    it('fetches reviewer assignments for the manuscript', async () => {
      const assignments = [
        { id: 'ra-1', reviewerId: 'u1', status: 'PENDING', manuscriptId: 'ms-123' },
        { id: 'ra-2', reviewerId: 'u2', status: 'ACCEPTED', manuscriptId: 'ms-123' },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ assignments }),
      });

      const result = await client.reviewers.list();

      expect(mockFetch).toHaveBeenCalledWith(
        'http://api:4000/api/reviewers/assignments/ms-123',
        expect.objectContaining({
          headers: expect.objectContaining({
            'x-bot-token': 'token-abc',
          }),
        })
      );
      expect(result).toEqual(assignments);
    });

    it('returns empty array when no assignments', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

      const result = await client.reviewers.list();
      expect(result).toEqual([]);
    });
  });

  describe('assign', () => {
    it('creates a reviewer assignment', async () => {
      const assignment = { id: 'ra-3', reviewerId: 'u3', status: 'PENDING', manuscriptId: 'ms-123' };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ assignment }),
      });

      const result = await client.reviewers.assign('u3');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://api:4000/api/articles/ms-123/reviewers',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ reviewerId: 'u3' }),
          headers: expect.objectContaining({
            'content-type': 'application/json',
            'x-bot-token': 'token-abc',
          }),
        })
      );
      expect(result).toEqual({ assignment });
    });

    it('passes optional options', async () => {
      const assignment = { id: 'ra-4', reviewerId: 'u4', status: 'PENDING', manuscriptId: 'ms-123' };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ assignment }),
      });

      await client.reviewers.assign('u4', { status: 'ACCEPTED', dueDate: '2026-03-01' });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://api:4000/api/articles/ms-123/reviewers',
        expect.objectContaining({
          body: JSON.stringify({ reviewerId: 'u4', status: 'ACCEPTED', dueDate: '2026-03-01' }),
        })
      );
    });
  });

  describe('updateStatus', () => {
    it('updates a reviewer assignment status', async () => {
      const assignment = { id: 'ra-1', reviewerId: 'u1', status: 'ACCEPTED', manuscriptId: 'ms-123' };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ assignment }),
      });

      const result = await client.reviewers.updateStatus('u1', 'ACCEPTED');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://api:4000/api/articles/ms-123/reviewers/u1',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ status: 'ACCEPTED' }),
          headers: expect.objectContaining({
            'content-type': 'application/json',
            'x-bot-token': 'token-abc',
          }),
        })
      );
      expect(result).toEqual({ assignment });
    });

    it('passes optional dueDate and completedAt', async () => {
      const assignment = { id: 'ra-1', reviewerId: 'u1', status: 'COMPLETED', manuscriptId: 'ms-123' };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ assignment }),
      });

      await client.reviewers.updateStatus('u1', 'COMPLETED', {
        completedAt: '2026-03-15T00:00:00Z',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://api:4000/api/articles/ms-123/reviewers/u1',
        expect.objectContaining({
          body: JSON.stringify({ status: 'COMPLETED', completedAt: '2026-03-15T00:00:00Z' }),
        })
      );
    });
  });
});
