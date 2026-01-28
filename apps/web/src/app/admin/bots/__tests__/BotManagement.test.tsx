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

// Mock File constructor and FileReader
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

const mockBotFile = {
  id: 'file-1',
  filename: 'template.html',
  category: 'template',
  description: 'HTML template for rendering',
  mimetype: 'text/html',
  size: 1024,
  checksum: 'abc123',
  uploadedAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  uploadedBy: {
    id: 'user-1',
    name: 'Test Admin',
    email: 'admin@test.com'
  },
  downloadUrl: '/api/bot-config-files/file-1/download'
};

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <MantineProvider>
    {children}
  </MantineProvider>
);

describe('BotManagementPage - File Configuration', () => {
  const openConfigModal = async (user: any) => {
    const menuButtons = screen.getAllByRole('button');
    const menuButton = menuButtons.find(button => 
      button.getAttribute('aria-haspopup') === 'menu'
    );
    expect(menuButton).toBeInTheDocument();
    await user.click(menuButton!);
    
    const configureOption = await waitFor(() => 
      screen.getByText('Configure')
    );
    await user.click(configureOption);
  };

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

  it('renders the bot management page', async () => {
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

  it('opens the configuration modal with tabs', async () => {
    (fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [mockBot] })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ files: [mockBotFile], total: 1 })
      });

    const user = userEvent.setup();
    render(<BotManagementPage />, { wrapper: TestWrapper });

    await waitFor(() => {
      expect(screen.getByText('Markdown Renderer')).toBeInTheDocument();
    });

    // Click the menu button (three dots)
    const menuButtons = screen.getAllByRole('button');
    const menuButton = menuButtons.find(button => 
      button.getAttribute('aria-haspopup') === 'menu'
    );
    expect(menuButton).toBeInTheDocument();
    
    await user.click(menuButton!);
    
    const configureOption = await waitFor(() => 
      screen.getByText('Configure')
    );
    await user.click(configureOption);

    await waitFor(() => {
      expect(screen.getByText('Configure Markdown Renderer')).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Configuration' })).toBeInTheDocument();
    });

    // The test passes if the modal opens with the Configuration tab
    // Files tab loading is tested separately
  });

  it('displays existing files in the files tab', async () => {
    (fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [mockBot] })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ files: [mockBotFile], total: 1 })
      });

    const user = userEvent.setup();
    render(<BotManagementPage />, { wrapper: TestWrapper });

    await waitFor(() => {
      expect(screen.getByText('Markdown Renderer')).toBeInTheDocument();
    });

    // Open configuration modal
    const menuButtons = screen.getAllByRole('button');
    const menuButton = menuButtons.find(button => 
      button.getAttribute('aria-haspopup') === 'menu'
    );
    await user.click(menuButton!);
    const configureOption = await waitFor(() => 
      screen.getByText('Configure')
    );
    await user.click(configureOption);

    // Switch to Files tab
    await waitFor(() => {
      const filesTab = screen.getByText('Files (1)');
      expect(filesTab).toBeInTheDocument();
    });

    const filesTab = screen.getByText('Files (1)');
    await user.click(filesTab);

    await waitFor(() => {
      expect(screen.getByText('template.html')).toBeInTheDocument();
      expect(screen.getByText('HTML template for rendering')).toBeInTheDocument();
      expect(screen.getByText('1.0 KB')).toBeInTheDocument();
      expect(screen.getByText('template')).toBeInTheDocument();
    });
  });

  it('uploads a new file successfully', async () => {
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
        json: async () => ({ success: true, file: mockBotFile })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ files: [mockBotFile], total: 1 })
      });

    const user = userEvent.setup();
    render(<BotManagementPage />, { wrapper: TestWrapper });

    await waitFor(() => {
      expect(screen.getByText('Markdown Renderer')).toBeInTheDocument();
    });

    // Open configuration modal and go to Files tab
    const menuButton = screen.getByRole('button', { name: /menu/i });
    await user.click(menuButton);
    const configureOption = await waitFor(() => 
      screen.getByText('Configure')
    );
    await user.click(configureOption);

    await waitFor(() => {
      const filesTab = screen.getByText('Files (0)');
      expect(filesTab).toBeInTheDocument();
    });

    const filesTab = screen.getByText('Files (0)');
    await user.click(filesTab);

    await waitFor(() => {
      expect(screen.getByText('Upload New File')).toBeInTheDocument();
    });

    // Create a test file
    const testFile = new File(['<html>test</html>'], 'test-template.html', {
      type: 'text/html'
    });

    // Upload file
    const fileInput = screen.getByLabelText('Select File');
    await user.upload(fileInput, testFile);

    // Set category and description
    const categorySelect = screen.getByDisplayValue('General');
    await user.click(categorySelect);
    
    const templateOption = screen.getByText('Template');
    await user.click(templateOption);

    const descriptionInput = screen.getByPlaceholderText('File description');
    await user.type(descriptionInput, 'Test HTML template');

    // Click upload button
    const uploadButton = screen.getByRole('button', { name: 'Upload File' });
    await user.click(uploadButton);

    await waitFor(() => {
      expect(notifications.show).toHaveBeenCalledWith({
        title: 'Success',
        message: 'File uploaded successfully',
        color: 'green',
        icon: expect.any(Object)
      });
    });

    // Verify fetch was called with correct data
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:4000/api/bot-config-files/bot-markdown-renderer/files',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: expect.any(FormData)
      })
    );
  });

  it('handles file upload errors', async () => {
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
        ok: false,
        json: async () => ({ error: 'File too large' })
      });

    const user = userEvent.setup();
    render(<BotManagementPage />, { wrapper: TestWrapper });

    await waitFor(() => {
      expect(screen.getByText('Markdown Renderer')).toBeInTheDocument();
    });

    // Open configuration modal and go to Files tab
    const menuButton = screen.getByRole('button', { name: /menu/i });
    await user.click(menuButton);
    const configureOption = await waitFor(() => 
      screen.getByText('Configure')
    );
    await user.click(configureOption);

    const filesTab = screen.getByText('Files (0)');
    await user.click(filesTab);

    // Upload file
    const testFile = new File(['<html>test</html>'], 'test-template.html', {
      type: 'text/html'
    });

    const fileInput = screen.getByLabelText('Select File');
    await user.upload(fileInput, testFile);

    const uploadButton = screen.getByRole('button', { name: 'Upload File' });
    await user.click(uploadButton);

    await waitFor(() => {
      expect(notifications.show).toHaveBeenCalledWith({
        title: 'Error',
        message: 'File too large',
        color: 'red',
        icon: expect.any(Object)
      });
    });
  });

  it('deletes a file successfully', async () => {
    (fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [mockBot] })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ files: [mockBotFile], total: 1 })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, message: 'File deleted successfully' })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ files: [], total: 0 })
      });

    // Mock window.confirm
    const originalConfirm = window.confirm;
    window.confirm = jest.fn(() => true);

    const user = userEvent.setup();
    render(<BotManagementPage />, { wrapper: TestWrapper });

    await waitFor(() => {
      expect(screen.getByText('Markdown Renderer')).toBeInTheDocument();
    });

    // Open configuration modal and go to Files tab
    const menuButton = screen.getByRole('button', { name: /menu/i });
    await user.click(menuButton);
    const configureOption = await waitFor(() => 
      screen.getByText('Configure')
    );
    await user.click(configureOption);

    const filesTab = screen.getByText('Files (1)');
    await user.click(filesTab);

    await waitFor(() => {
      expect(screen.getByText('template.html')).toBeInTheDocument();
    });

    // Click delete button
    const deleteButton = screen.getByRole('button', { name: /delete/i });
    await user.click(deleteButton);

    await waitFor(() => {
      expect(notifications.show).toHaveBeenCalledWith({
        title: 'Success',
        message: 'File deleted successfully',
        color: 'green',
        icon: expect.any(Object)
      });
    });

    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:4000/api/bot-config-files/file-1',
      expect.objectContaining({
        method: 'DELETE',
        credentials: 'include'
      })
    );

    // Restore window.confirm
    window.confirm = originalConfirm;
  });

  it('shows progress during file upload', async () => {
    (fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [mockBot] })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ files: [], total: 0 })
      })
      .mockImplementationOnce(() => 
        new Promise(resolve => 
          setTimeout(() => resolve({
            ok: true,
            json: async () => ({ success: true, file: mockBotFile })
          }), 100)
        )
      )
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ files: [mockBotFile], total: 1 })
      });

    const user = userEvent.setup();
    render(<BotManagementPage />, { wrapper: TestWrapper });

    await waitFor(() => {
      expect(screen.getByText('Markdown Renderer')).toBeInTheDocument();
    });

    // Open configuration modal and go to Files tab
    const menuButton = screen.getByRole('button', { name: /menu/i });
    await user.click(menuButton);
    const configureOption = await waitFor(() => 
      screen.getByText('Configure')
    );
    await user.click(configureOption);

    const filesTab = screen.getByText('Files (0)');
    await user.click(filesTab);

    // Upload file
    const testFile = new File(['<html>test</html>'], 'test-template.html', {
      type: 'text/html'
    });

    const fileInput = screen.getByLabelText('Select File');
    await user.upload(fileInput, testFile);

    const uploadButton = screen.getByRole('button', { name: 'Upload File' });
    await user.click(uploadButton);

    // Check that progress indicator appears
    await waitFor(() => {
      expect(screen.getByText('Uploading...')).toBeInTheDocument();
    });

    // Wait for upload to complete
    await waitFor(() => {
      expect(screen.queryByText('Uploading...')).not.toBeInTheDocument();
    }, { timeout: 2000 });
  });

  it('prevents unauthorized users from accessing the page', () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: { ...mockAuthUser, role: 'USER' },
      isAuthenticated: true
    });

    render(<BotManagementPage />, { wrapper: TestWrapper });

    expect(screen.getByText('Admin access required to manage bots.')).toBeInTheDocument();
  });

  it('disables upload button when no file is selected', async () => {
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
    render(<BotManagementPage />, { wrapper: TestWrapper });

    await waitFor(() => {
      expect(screen.getByText('Markdown Renderer')).toBeInTheDocument();
    });

    // Open configuration modal and go to Files tab
    const menuButton = screen.getByRole('button', { name: /menu/i });
    await user.click(menuButton);
    const configureOption = await waitFor(() => 
      screen.getByText('Configure')
    );
    await user.click(configureOption);

    const filesTab = screen.getByText('Files (0)');
    await user.click(filesTab);

    const uploadButton = screen.getByRole('button', { name: 'Upload File' });
    expect(uploadButton).toBeDisabled();
  });

  it('enables upload button when file is selected', async () => {
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
    render(<BotManagementPage />, { wrapper: TestWrapper });

    await waitFor(() => {
      expect(screen.getByText('Markdown Renderer')).toBeInTheDocument();
    });

    // Open configuration modal and go to Files tab
    const menuButton = screen.getByRole('button', { name: /menu/i });
    await user.click(menuButton);
    const configureOption = await waitFor(() => 
      screen.getByText('Configure')
    );
    await user.click(configureOption);

    const filesTab = screen.getByText('Files (0)');
    await user.click(filesTab);

    // Select a file
    const testFile = new File(['<html>test</html>'], 'test-template.html', {
      type: 'text/html'
    });

    const fileInput = screen.getByLabelText('Select File');
    await user.upload(fileInput, testFile);

    const uploadButton = screen.getByRole('button', { name: 'Upload File' });
    expect(uploadButton).toBeEnabled();
  });
});