import { createBotClient } from '../client';

const mockFetch = jest.fn();
globalThis.fetch = mockFetch;

describe('FileClient', () => {
  const client = createBotClient({
    manuscriptId: 'ms-123',
    serviceToken: 'token-abc',
    config: { apiUrl: 'http://api:4000' },
  });

  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe('list', () => {
    it('fetches file list', async () => {
      const files = [
        { id: 'f1', originalName: 'paper.md', fileType: 'SOURCE' },
        { id: 'f2', originalName: 'refs.bib', fileType: 'BIBLIOGRAPHY' },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ files }),
      });

      const result = await client.files.list();

      expect(mockFetch).toHaveBeenCalledWith(
        'http://api:4000/api/articles/ms-123/files',
        expect.objectContaining({
          headers: expect.objectContaining({
            'x-bot-token': 'token-abc',
          }),
        })
      );
      expect(result).toEqual(files);
    });

    it('filters by fileType', async () => {
      const files = [
        { id: 'f1', originalName: 'paper.md', fileType: 'SOURCE' },
        { id: 'f2', originalName: 'refs.bib', fileType: 'BIBLIOGRAPHY' },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ files }),
      });

      const result = await client.files.list({ fileType: 'SOURCE' });
      expect(result).toEqual([files[0]]);
    });

    it('returns empty array when no files', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

      const result = await client.files.list();
      expect(result).toEqual([]);
    });
  });

  describe('download', () => {
    it('downloads file by ID', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('# Hello World'),
      });

      const result = await client.files.download('f1');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://api:4000/api/articles/ms-123/files/f1/download',
        expect.any(Object)
      );
      expect(result).toBe('# Hello World');
    });
  });

  describe('downloadByUrl', () => {
    it('downloads from relative URL', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('file content'),
      });

      const result = await client.files.downloadByUrl('/api/articles/ms-123/files/f1/download');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://api:4000/api/articles/ms-123/files/f1/download',
        expect.any(Object)
      );
      expect(result).toBe('file content');
    });

    it('downloads from absolute URL', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('file content'),
      });

      const result = await client.files.downloadByUrl('http://other-host/file');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://other-host/file',
        expect.any(Object)
      );
      expect(result).toBe('file content');
    });
  });

  describe('upload', () => {
    it('uploads file with correct parameters', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          files: [{ id: 'f3', filename: 'output.html', downloadUrl: '/download/f3' }],
        }),
      });

      const result = await client.files.upload('output.html', '<html></html>', {
        fileType: 'RENDERED',
        renderedBy: 'bot-markdown-renderer',
        mimetype: 'text/html',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://api:4000/api/articles/ms-123/files',
        expect.objectContaining({
          method: 'POST',
        })
      );
      expect(result.id).toBe('f3');
      expect(result.size).toBe(13);
    });
  });
});
