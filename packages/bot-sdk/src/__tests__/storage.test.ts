import { createStorageClient } from '../storage';

describe('StorageClient', () => {
  const mockHttp = {
    request: jest.fn(),
    getJSON: jest.fn(),
    postJSON: jest.fn(),
    putJSON: jest.fn(),
    deleteRequest: jest.fn(),
  };

  const storage = createStorageClient(mockHttp as any);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('get', () => {
    it('should return value for existing key', async () => {
      mockHttp.getJSON.mockResolvedValue({ value: { sha256: 'abc' } });

      const result = await storage.get('hash');

      expect(result).toEqual({ sha256: 'abc' });
      expect(mockHttp.getJSON).toHaveBeenCalledWith('/api/bot-storage/hash');
    });

    it('should return null for 404 response', async () => {
      mockHttp.getJSON.mockRejectedValue({ status: 404 });

      const result = await storage.get('missing');

      expect(result).toBeNull();
    });

    it('should re-throw non-404 errors', async () => {
      mockHttp.getJSON.mockRejectedValue(new Error('network error'));

      await expect(storage.get('hash')).rejects.toThrow('network error');
    });

    it('should encode key in URL', async () => {
      mockHttp.getJSON.mockResolvedValue({ value: 'test' });

      await storage.get('key with spaces');

      expect(mockHttp.getJSON).toHaveBeenCalledWith('/api/bot-storage/key%20with%20spaces');
    });
  });

  describe('set', () => {
    it('should PUT the value', async () => {
      mockHttp.putJSON.mockResolvedValue({});

      await storage.set('hash', { sha256: 'abc' });

      expect(mockHttp.putJSON).toHaveBeenCalledWith('/api/bot-storage/hash', { value: { sha256: 'abc' } });
    });
  });

  describe('delete', () => {
    it('should DELETE the key', async () => {
      mockHttp.deleteRequest.mockResolvedValue(undefined);

      await storage.delete('hash');

      expect(mockHttp.deleteRequest).toHaveBeenCalledWith('/api/bot-storage/hash');
    });
  });

  describe('list', () => {
    it('should return all keys', async () => {
      const entries = [
        { key: 'a', updatedAt: '2024-01-01' },
        { key: 'b', updatedAt: '2024-01-02' },
      ];
      mockHttp.getJSON.mockResolvedValue(entries);

      const result = await storage.list();

      expect(result).toEqual(entries);
      expect(mockHttp.getJSON).toHaveBeenCalledWith('/api/bot-storage');
    });
  });
});
