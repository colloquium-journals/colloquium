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

const mockRendererBot = {
  id: 'renderer-bot-1',
  botId: 'bot-markdown-renderer',
  name: 'Markdown Renderer',
  version: '1.0.0',
  description: 'Renders markdown with file uploads',
  author: { name: 'Test Author', email: 'author@test.com' },
  isEnabled: true,
  isDefault: false,
  isRequired: false,
  installedAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  packageName: '@colloquium/bot-markdown-renderer',
  supportsFileUploads: true
};

const mockRegularBot = {
  id: 'regular-bot-1',
  botId: 'bot-editorial',
  name: 'Editorial Bot',
  version: '1.0.0',
  description: 'Editorial workflow bot without file uploads',
  author: { name: 'Test Author', email: 'author@test.com' },
  isEnabled: true,
  isDefault: false,
  isRequired: true,
  installedAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  packageName: '@colloquium/bot-editorial',
  supportsFileUploads: false
};

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <MantineProvider>
    {children}
  </MantineProvider>
);

describe('Conditional File Upload Display', () => {
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

  it('should show Files tab for bots that support file uploads', async () => {
    (fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [mockRendererBot] })
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

    // Open configuration modal - use first dots menu (there should be only one with our mock data)
    await act(async () => {
      const menuButtons = screen.getAllByRole('button');
      const menuButton = menuButtons.find(button => 
        button.getAttribute('aria-haspopup') === 'menu'
      );
      await user.click(menuButton!);
    });

    await waitFor(() => {
      expect(screen.getByRole('menuitem', { name: /configure/i })).toBeInTheDocument();
    });

    await act(async () => {
      await user.click(screen.getByRole('menuitem', { name: /configure/i }));
    });

    await waitFor(() => {
      expect(screen.getByText('Configure Markdown Renderer')).toBeInTheDocument();
      expect(screen.getByText('Configuration')).toBeInTheDocument();
      expect(screen.getByText('Files (0)')).toBeInTheDocument();
    });
  });

  it('should NOT show Files tab for bots that do not support file uploads', async () => {
    (fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [mockRegularBot] })
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
      expect(screen.getByText('Editorial Bot')).toBeInTheDocument();
    });

    // Open configuration modal - use first dots menu (there should be only one with our mock data)
    await act(async () => {
      const menuButtons = screen.getAllByRole('button');
      const menuButton = menuButtons.find(button => 
        button.getAttribute('aria-haspopup') === 'menu'
      );
      await user.click(menuButton!);
    });

    await waitFor(() => {
      expect(screen.getByRole('menuitem', { name: /configure/i })).toBeInTheDocument();
    });

    await act(async () => {
      await user.click(screen.getByRole('menuitem', { name: /configure/i }));
    });

    await waitFor(() => {
      expect(screen.getByText('Configure Editorial Bot')).toBeInTheDocument();
      expect(screen.getByText('Configuration')).toBeInTheDocument();
      // Files tab should NOT be present
      expect(screen.queryByText(/Files \(/)).not.toBeInTheDocument();
    });
  });

  it('should handle bots with undefined supportsFileUploads (default to false)', async () => {
    const botWithoutFlag = {
      ...mockRegularBot,
      supportsFileUploads: undefined
    };

    (fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [botWithoutFlag] })
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
      expect(screen.getByText('Editorial Bot')).toBeInTheDocument();
    });

    // Open configuration modal - use first dots menu (there should be only one with our mock data)
    await act(async () => {
      const menuButtons = screen.getAllByRole('button');
      const menuButton = menuButtons.find(button => 
        button.getAttribute('aria-haspopup') === 'menu'
      );
      await user.click(menuButton!);
    });

    await waitFor(() => {
      expect(screen.getByRole('menuitem', { name: /configure/i })).toBeInTheDocument();
    });

    await act(async () => {
      await user.click(screen.getByRole('menuitem', { name: /configure/i }));
    });

    await waitFor(() => {
      expect(screen.getByText('Configure Editorial Bot')).toBeInTheDocument();
      expect(screen.getByText('Configuration')).toBeInTheDocument();
      // Files tab should NOT be present (defaults to false)
      expect(screen.queryByText(/Files \(/)).not.toBeInTheDocument();
    });
  });

  it('should show both bots correctly in a mixed environment', async () => {
    (fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [mockRendererBot, mockRegularBot] })
      });

    await act(async () => {
      render(<BotManagementPage />, { wrapper: TestWrapper });
    });

    await waitFor(() => {
      expect(screen.getByText('Markdown Renderer')).toBeInTheDocument();
      expect(screen.getByText('Editorial Bot')).toBeInTheDocument();
    });

    // Verify both bots are listed
    expect(screen.getByText('Installed Bots (2)')).toBeInTheDocument();
  });

  it('should allow switching between tabs when Files tab is available', async () => {
    (fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [mockRendererBot] })
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

    // Open configuration modal
    const menuButtons = screen.getAllByRole('button');
    const menuButton = menuButtons.find(button => 
      button.getAttribute('aria-haspopup') === 'menu'
    );
    
    await act(async () => {
      await user.click(menuButton!);
      await user.click(screen.getByRole('menuitem', { name: /configure/i }));
    });

    await waitFor(() => {
      expect(screen.getByText('Files (0)')).toBeInTheDocument();
    });

    // Click on Files tab
    await act(async () => {
      await user.click(screen.getByText('Files (0)'));
    });

    await waitFor(() => {
      expect(screen.getByText('Upload New File')).toBeInTheDocument();
      expect(screen.getByText('Upload and manage configuration files')).toBeInTheDocument();
    });

    // Switch back to Configuration tab
    await act(async () => {
      await user.click(screen.getByText('Configuration'));
    });

    await waitFor(() => {
      expect(screen.getByText('Update the configuration for Markdown Renderer')).toBeInTheDocument();
    });
  });
});