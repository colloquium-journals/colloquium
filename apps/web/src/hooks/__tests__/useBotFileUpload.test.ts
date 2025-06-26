import { renderHook, act, waitFor } from '@testing-library/react';
import { notifications } from '@mantine/notifications';
import { useBotFileUpload } from '../useBotFileUpload';

// Mock notifications
jest.mock('@mantine/notifications', () => ({
  notifications: {
    show: jest.fn()
  }
}));

// Mock fetch globally
global.fetch = jest.fn();

const mockFile = new File(['test content'], 'test.html', { type: 'text/html' });

describe('useBotFileUpload', () => {
  beforeEach(() => {
    (fetch as jest.Mock).mockClear();
    (notifications.show as jest.Mock).mockClear();
  });

  it('should initialize with correct default values', () => {
    const { result } = renderHook(() => useBotFileUpload());

    expect(result.current.isUploading).toBe(false);
    expect(result.current.uploadProgress).toBe(0);
    expect(result.current.files).toEqual([]);
  });

  it('should upload file successfully', async () => {
    const mockResponse = {
      success: true,
      file: {
        id: 'file-1',
        filename: 'test.html',
        category: 'template',
        description: 'Test file',
        mimetype: 'text/html',
        size: 12,
        uploadedAt: '2024-01-01T00:00:00Z',
        uploadedBy: { id: 'user-1', name: 'Test User', email: 'test@example.com' },
        downloadUrl: '/api/bot-config-files/file-1/download'
      }
    };

    (fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ files: [mockResponse.file], total: 1 })
      });

    const { result } = renderHook(() => useBotFileUpload());

    await act(async () => {
      await result.current.uploadFile('bot-1', mockFile, 'template', 'Test file');
    });

    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:4000/api/bot-config-files/bot-1/files',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: expect.any(FormData)
      })
    );

    expect(notifications.show).toHaveBeenCalledWith({
      title: 'Success',
      message: 'File uploaded successfully',
      color: 'green',
      icon: expect.any(Object)
    });
  });

  it('should handle upload errors', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'File too large' })
    });

    const { result } = renderHook(() => useBotFileUpload());

    await act(async () => {
      await result.current.uploadFile('bot-1', mockFile, 'template', 'Test file');
    });

    expect(notifications.show).toHaveBeenCalledWith({
      title: 'Error',
      message: 'File too large',
      color: 'red',
      icon: expect.any(Object)
    });
  });

  it('should fetch files successfully', async () => {
    const mockFiles = [
      {
        id: 'file-1',
        filename: 'template.html',
        category: 'template',
        description: 'HTML template',
        mimetype: 'text/html',
        size: 1024,
        uploadedAt: '2024-01-01T00:00:00Z',
        uploadedBy: { id: 'user-1', name: 'Test User', email: 'test@example.com' },
        downloadUrl: '/api/bot-config-files/file-1/download'
      }
    ];

    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ files: mockFiles, total: 1 })
    });

    const { result } = renderHook(() => useBotFileUpload());

    await act(async () => {
      await result.current.fetchFiles('bot-1');
    });

    expect(result.current.files).toEqual(mockFiles);
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:4000/api/bot-config-files/bot-1/files',
      { credentials: 'include' }
    );
  });

  it('should delete file successfully', async () => {
    const mockFiles = [
      {
        id: 'file-1',
        filename: 'template.html',
        category: 'template',
        description: 'HTML template',
        mimetype: 'text/html',
        size: 1024,
        uploadedAt: '2024-01-01T00:00:00Z',
        uploadedBy: { id: 'user-1', name: 'Test User', email: 'test@example.com' },
        downloadUrl: '/api/bot-config-files/file-1/download'
      }
    ];

    // Setup initial files
    (fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ files: mockFiles, total: 1 })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, message: 'File deleted successfully' })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ files: [], total: 0 })
      });

    const { result } = renderHook(() => useBotFileUpload());

    // Fetch files first
    await act(async () => {
      await result.current.fetchFiles('bot-1');
    });

    expect(result.current.files).toHaveLength(1);

    // Delete file
    await act(async () => {
      await result.current.deleteFile('bot-1', 'file-1');
    });

    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:4000/api/bot-config-files/file-1',
      expect.objectContaining({
        method: 'DELETE',
        credentials: 'include'
      })
    );

    expect(notifications.show).toHaveBeenCalledWith({
      title: 'Success',
      message: 'File deleted successfully',
      color: 'green',
      icon: expect.any(Object)
    });

    expect(result.current.files).toHaveLength(0);
  });

  it('should handle delete errors', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'File not found' })
    });

    const { result } = renderHook(() => useBotFileUpload());

    await act(async () => {
      await result.current.deleteFile('bot-1', 'file-1');
    });

    expect(notifications.show).toHaveBeenCalledWith({
      title: 'Error',
      message: 'File not found',
      color: 'red',
      icon: expect.any(Object)
    });
  });

  it('should track upload progress', async () => {
    (fetch as jest.Mock).mockImplementationOnce(() =>
      new Promise(resolve =>
        setTimeout(() => resolve({
          ok: true,
          json: async () => ({ success: true, file: {} })
        }), 100)
      )
    );

    const { result } = renderHook(() => useBotFileUpload());

    act(() => {
      result.current.uploadFile('bot-1', mockFile, 'template', 'Test file');
    });

    // Check that upload state is set
    expect(result.current.isUploading).toBe(true);
    expect(result.current.uploadProgress).toBeGreaterThan(0);

    await waitFor(() => {
      expect(result.current.isUploading).toBe(false);
    });

    expect(result.current.uploadProgress).toBe(0);
  });

  it('should handle network errors gracefully', async () => {
    (fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useBotFileUpload());

    await act(async () => {
      await result.current.uploadFile('bot-1', mockFile, 'template', 'Test file');
    });

    expect(notifications.show).toHaveBeenCalledWith({
      title: 'Error',
      message: 'Network error',
      color: 'red',
      icon: expect.any(Object)
    });
  });

  it('should handle file fetch errors gracefully', async () => {
    (fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useBotFileUpload());

    await act(async () => {
      await result.current.fetchFiles('bot-1');
    });

    // Should not crash and should set files to empty array
    expect(result.current.files).toEqual([]);
  });
});