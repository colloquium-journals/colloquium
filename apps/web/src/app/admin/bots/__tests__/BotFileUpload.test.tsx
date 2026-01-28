// @ts-nocheck
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import BotManagementPage from '../page';
import { useAuth } from '@/contexts/AuthContext';

// Mock the auth context
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: jest.fn()
}));

// Mock notifications
jest.mock('@mantine/notifications', () => ({
  notifications: {
    show: jest.fn()
  }
}));

// Mock fetch globally
global.fetch = jest.fn();

// Mock File constructor
global.File = class {
  constructor(chunks: BlobPart[], filename: string, options?: FilePropertyBag) {
    this.name = filename;
    this.size = chunks.reduce((acc, chunk) => acc + (typeof chunk === 'string' ? chunk.length : chunk.size || 0), 0);
    this.type = options?.type || '';
  }
  name: string;
  size: number;
  type: string;
} as any;

const mockAuthUser = {
  id: 'user-1',
  email: 'admin@test.com',
  name: 'Test Admin',
  role: 'ADMIN'
};

const mockBot = {
  id: 'bot-1',
  botId: 'bot-markdown-renderer',
  name: 'Markdown Renderer',
  version: '1.0.0',
  description: 'Renders markdown content',
  author: { name: 'Test Author', email: 'author@test.com' },
  category: 'renderer',
  isEnabled: true,
  isDefault: false,
  isRequired: false,
  installedAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  packageName: '@colloquium/bot-markdown-renderer'
};

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <MantineProvider>
    {children}
  </MantineProvider>
);

describe('Bot File Upload Features', () => {
  beforeEach(() => {
    (useAuth as jest.Mock).mockReturnValue({
      user: mockAuthUser,
      isAuthenticated: true
    });
    
    (fetch as jest.Mock).mockClear();
    (notifications.show as jest.Mock).mockClear();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should render bot management page for admin users', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [mockBot] })
    });

    await act(async () => {
      render(<BotManagementPage />, { wrapper: TestWrapper });
    });

    await waitFor(() => {
      expect(screen.getByText('Bot Management')).toBeInTheDocument();
      expect(screen.getByText('Markdown Renderer')).toBeInTheDocument();
    });
  });

  it('should show access denied for non-admin users', async () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: { ...mockAuthUser, role: 'USER' },
      isAuthenticated: true
    });

    await act(async () => {
      render(<BotManagementPage />, { wrapper: TestWrapper });
    });

    expect(screen.getByText('Admin access required to manage bots.')).toBeInTheDocument();
  });

  it('should open configuration modal when configure is clicked', async () => {
    (fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [mockBot] })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ files: [], total: 0 })
      });

    const user = userEvent.setup();
    
    await act(async () => {
      render(<BotManagementPage />, { wrapper: TestWrapper });
    });

    await waitFor(() => {
      expect(screen.getByText('Markdown Renderer')).toBeInTheDocument();
    });

    // Find and click the menu button
    const menuButtons = screen.getAllByRole('button');
    const menuButton = menuButtons.find(button => 
      button.getAttribute('aria-haspopup') === 'menu'
    );
    
    expect(menuButton).toBeInTheDocument();
    
    await act(async () => {
      await user.click(menuButton!);
    });

    await waitFor(() => {
      expect(screen.getByText('Configure')).toBeInTheDocument();
    });

    await act(async () => {
      await user.click(screen.getByText('Configure'));
    });

    await waitFor(() => {
      expect(screen.getByText('Configure Markdown Renderer')).toBeInTheDocument();
    });
  });

  it('should show files tab with correct count', async () => {
    const mockFiles = [
      {
        id: 'file-1',
        filename: 'template.html',
        category: 'template',
        description: 'HTML template',
        mimetype: 'text/html',
        size: 1024,
        checksum: 'abc123',
        uploadedAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        uploadedBy: { id: 'user-1', name: 'Test Admin', email: 'admin@test.com' },
        downloadUrl: '/api/bot-config-files/file-1/download'
      }
    ];

    (fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [mockBot] })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ files: mockFiles, total: 1 })
      });

    const user = userEvent.setup();
    
    await act(async () => {
      render(<BotManagementPage />, { wrapper: TestWrapper });
    });

    await waitFor(() => {
      expect(screen.getByText('Markdown Renderer')).toBeInTheDocument();
    });

    // Open configuration modal
    const menuButtons = screen.getAllByRole('button');
    const menuButton = menuButtons.find(button => 
      button.getAttribute('aria-haspopup') === 'menu'
    );
    
    await act(async () => {
      await user.click(menuButton!);
      await user.click(screen.getByText('Configure'));
    });

    await waitFor(() => {
      expect(screen.getByText('Files (1)')).toBeInTheDocument();
    });

    // Click on Files tab
    await act(async () => {
      await user.click(screen.getByText('Files (1)'));
    });

    await waitFor(() => {
      expect(screen.getByText('template.html')).toBeInTheDocument();
      expect(screen.getByText('HTML template')).toBeInTheDocument();
    });
  });

  it('should show file upload form in files tab', async () => {
    (fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [mockBot] })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ files: [], total: 0 })
      });

    const user = userEvent.setup();
    
    await act(async () => {
      render(<BotManagementPage />, { wrapper: TestWrapper });
    });

    await waitFor(() => {
      expect(screen.getByText('Markdown Renderer')).toBeInTheDocument();
    });

    // Open configuration modal and go to files tab
    const menuButtons = screen.getAllByRole('button');
    const menuButton = menuButtons.find(button => 
      button.getAttribute('aria-haspopup') === 'menu'
    );
    
    await act(async () => {
      await user.click(menuButton!);
      await user.click(screen.getByText('Configure'));
    });

    await waitFor(() => {
      expect(screen.getByText('Files (0)')).toBeInTheDocument();
    });

    await act(async () => {
      await user.click(screen.getByText('Files (0)'));
    });

    await waitFor(() => {
      expect(screen.getByText('Upload New File')).toBeInTheDocument();
      expect(screen.getByLabelText('Select File')).toBeInTheDocument();
      expect(screen.getByLabelText('Category')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Upload File' })).toBeInTheDocument();
    });
  });

  it('should handle successful file upload', async () => {
    const mockResponse = {
      success: true,
      file: {
        id: 'new-file-1',
        filename: 'test.html',
        category: 'template',
        description: 'Test file',
        mimetype: 'text/html',
        size: 100,
        checksum: 'def456',
        uploadedAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        uploadedBy: { id: 'user-1', name: 'Test Admin', email: 'admin@test.com' },
        downloadUrl: '/api/bot-config-files/new-file-1/download'
      }
    };

    (fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [mockBot] })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ files: [], total: 0 })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ files: [mockResponse.file], total: 1 })
      });

    const user = userEvent.setup();
    
    await act(async () => {
      render(<BotManagementPage />, { wrapper: TestWrapper });
    });

    await waitFor(() => {
      expect(screen.getByText('Markdown Renderer')).toBeInTheDocument();
    });

    // Open configuration modal and go to files tab
    const menuButtons = screen.getAllByRole('button');
    const menuButton = menuButtons.find(button => 
      button.getAttribute('aria-haspopup') === 'menu'
    );
    
    await act(async () => {
      await user.click(menuButton!);
      await user.click(screen.getByText('Configure'));
      await user.click(screen.getByText('Files (0)'));
    });

    await waitFor(() => {
      expect(screen.getByText('Upload New File')).toBeInTheDocument();
    });

    // Upload a file
    const testFile = new File(['<html>test</html>'], 'test.html', { type: 'text/html' });
    const fileInput = screen.getByLabelText('Select File') as HTMLInputElement;
    
    await act(async () => {
      await user.upload(fileInput, testFile);
    });

    expect(fileInput.files![0]).toBe(testFile);
    expect(fileInput.files).toHaveLength(1);

    // Click upload button
    const uploadButton = screen.getByRole('button', { name: 'Upload File' });
    
    await act(async () => {
      await user.click(uploadButton);
    });

    await waitFor(() => {
      expect(notifications.show).toHaveBeenCalledWith({
        title: 'Success',
        message: 'File uploaded successfully',
        color: 'green',
        icon: expect.any(Object)
      });
    });
  });
});