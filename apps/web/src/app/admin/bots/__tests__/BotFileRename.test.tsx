// @ts-nocheck
import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
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

const mockAuthUser = {
  id: 'user-1',
  email: 'admin@test.com',
  name: 'Test Admin',
  role: 'ADMIN'
};

const mockBot = {
  id: 'bot-1',
  botId: 'test-bot',
  name: 'Test Bot',
  version: '1.0.0',
  description: 'Test bot',
  author: { name: 'Test Author', email: 'author@test.com' },
  isEnabled: true,
  isDefault: false,
  isRequired: false,
  installedAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  packageName: '@test/test-bot'
};

const mockFile = {
  id: 'file-1',
  filename: 'original.html',
  description: 'Test file',
  mimetype: 'text/html',
  size: 1024,
  checksum: 'abc123',
  uploadedAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  uploadedBy: { id: 'user-1', name: 'Test Admin', email: 'admin@test.com' },
  downloadUrl: '/api/bot-config-files/file-1/download'
};

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <MantineProvider>
    {children}
  </MantineProvider>
);

describe('Bot File Rename Functionality', () => {
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

  it('should show edit button for each file', async () => {
    (fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [mockBot] })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ files: [mockFile], total: 1 })
      });

    const user = userEvent.setup();
    
    await act(async () => {
      render(<BotManagementPage />, { wrapper: TestWrapper });
    });

    await waitFor(() => {
      expect(screen.getByText('Test Bot')).toBeInTheDocument();
    });

    // Open configuration modal
    const menuButtons = screen.getAllByRole('button');
    const menuButton = menuButtons.find(button => 
      button.getAttribute('aria-haspopup') === 'menu'
    );
    
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
      expect(screen.getByText('Files (1)')).toBeInTheDocument();
    });

    await act(async () => {
      await user.click(screen.getByText('Files (1)'));
    });

    await waitFor(() => {
      expect(screen.getByText('original.html')).toBeInTheDocument();
    });

    // Find and verify edit button exists
    const editButtons = screen.getAllByRole('button');
    const editButton = editButtons.find(button => 
      button.querySelector('svg')?.classList.contains('tabler-icon-edit')
    );
    expect(editButton).toBeInTheDocument();
  });

  it('should enter edit mode when edit button is clicked', async () => {
    (fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [mockBot] })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ files: [mockFile], total: 1 })
      });

    const user = userEvent.setup();
    
    await act(async () => {
      render(<BotManagementPage />, { wrapper: TestWrapper });
    });

    // Navigate to files tab
    await waitFor(() => {
      expect(screen.getByText('Test Bot')).toBeInTheDocument();
    });

    const menuButtons = screen.getAllByRole('button');
    const menuButton = menuButtons.find(button => 
      button.getAttribute('aria-haspopup') === 'menu'
    );
    
    await act(async () => {
      await user.click(menuButton!);
      await user.click(screen.getByText('Configure'));
      await user.click(screen.getByText('Files (1)'));
    });

    await waitFor(() => {
      expect(screen.getByText('original.html')).toBeInTheDocument();
    });

    // Click edit button
    const editButtons = screen.getAllByRole('button');
    const editButton = editButtons.find(button => 
      button.querySelector('svg')?.classList.contains('tabler-icon-edit')
    );

    await act(async () => {
      await user.click(editButton!);
    });

    // Check that input field appears with current filename
    await waitFor(() => {
      const input = screen.getByDisplayValue('original.html');
      expect(input).toBeInTheDocument();
    });
  });

  it('should save renamed file when save button is clicked', async () => {
    const updatedFile = { ...mockFile, filename: 'renamed.html' };
    
    (fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [mockBot] })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ files: [mockFile], total: 1 })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, file: updatedFile })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ files: [updatedFile], total: 1 })
      });

    const user = userEvent.setup();
    
    await act(async () => {
      render(<BotManagementPage />, { wrapper: TestWrapper });
    });

    // Navigate to files tab and enter edit mode
    await waitFor(() => {
      expect(screen.getByText('Test Bot')).toBeInTheDocument();
    });

    const menuButtons = screen.getAllByRole('button');
    const menuButton = menuButtons.find(button => 
      button.getAttribute('aria-haspopup') === 'menu'
    );
    
    await act(async () => {
      await user.click(menuButton!);
      await user.click(screen.getByText('Configure'));
      await user.click(screen.getByText('Files (1)'));
    });

    const editButtons = screen.getAllByRole('button');
    const editButton = editButtons.find(button => 
      button.querySelector('svg')?.classList.contains('tabler-icon-edit')
    );

    await act(async () => {
      await user.click(editButton!);
    });

    const input = screen.getByDisplayValue('original.html');
    
    // Clear and type new filename
    await act(async () => {
      await user.clear(input);
      await user.type(input, 'renamed.html');
    });

    // Click save button
    const saveButtons = screen.getAllByRole('button');
    const saveButton = saveButtons.find(button => 
      button.querySelector('svg')?.classList.contains('tabler-icon-device-floppy')
    );

    await act(async () => {
      await user.click(saveButton!);
    });

    await waitFor(() => {
      expect(notifications.show).toHaveBeenCalledWith({
        title: 'Success',
        message: 'File renamed successfully',
        color: 'green',
        icon: expect.any(Object)
      });
    });

    // Verify API call was made
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:4000/api/bot-config-files/file-1',
      expect.objectContaining({
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ filename: 'renamed.html' })
      })
    );
  });

  it('should handle rename errors gracefully', async () => {
    (fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [mockBot] })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ files: [mockFile], total: 1 })
      })
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'File already exists' })
      });

    const user = userEvent.setup();
    
    await act(async () => {
      render(<BotManagementPage />, { wrapper: TestWrapper });
    });

    // Navigate to files tab and enter edit mode
    await waitFor(() => {
      expect(screen.getByText('Test Bot')).toBeInTheDocument();
    });

    const menuButtons = screen.getAllByRole('button');
    const menuButton = menuButtons.find(button => 
      button.getAttribute('aria-haspopup') === 'menu'
    );
    
    await act(async () => {
      await user.click(menuButton!);
      await user.click(screen.getByText('Configure'));
      await user.click(screen.getByText('Files (1)'));
    });

    const editButtons = screen.getAllByRole('button');
    const editButton = editButtons.find(button => 
      button.querySelector('svg')?.classList.contains('tabler-icon-edit')
    );

    await act(async () => {
      await user.click(editButton!);
    });

    const input = screen.getByDisplayValue('original.html');
    
    await act(async () => {
      await user.clear(input);
      await user.type(input, 'duplicate.html');
    });

    const saveButtons = screen.getAllByRole('button');
    const saveButton = saveButtons.find(button => 
      button.querySelector('svg')?.classList.contains('tabler-icon-device-floppy')
    );

    await act(async () => {
      await user.click(saveButton!);
    });

    await waitFor(() => {
      expect(notifications.show).toHaveBeenCalledWith({
        title: 'Error',
        message: 'File already exists',
        color: 'red',
        icon: expect.any(Object)
      });
    });
  });

  it('should cancel edit mode when escape key is pressed', async () => {
    (fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [mockBot] })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ files: [mockFile], total: 1 })
      });

    const user = userEvent.setup();
    
    await act(async () => {
      render(<BotManagementPage />, { wrapper: TestWrapper });
    });

    // Navigate to files tab and enter edit mode
    await waitFor(() => {
      expect(screen.getByText('Test Bot')).toBeInTheDocument();
    });

    const menuButtons = screen.getAllByRole('button');
    const menuButton = menuButtons.find(button => 
      button.getAttribute('aria-haspopup') === 'menu'
    );
    
    await act(async () => {
      await user.click(menuButton!);
      await user.click(screen.getByText('Configure'));
      await user.click(screen.getByText('Files (1)'));
    });

    const editButtons = screen.getAllByRole('button');
    const editButton = editButtons.find(button => 
      button.querySelector('svg')?.classList.contains('tabler-icon-edit')
    );

    await act(async () => {
      await user.click(editButton!);
    });

    const input = screen.getByDisplayValue('original.html');
    
    // Press escape to cancel
    await act(async () => {
      await user.type(input, '{Escape}');
    });

    // Check that we're back to display mode
    await waitFor(() => {
      expect(screen.getByText('original.html')).toBeInTheDocument();
      expect(screen.queryByDisplayValue('original.html')).not.toBeInTheDocument();
    });
  });
});