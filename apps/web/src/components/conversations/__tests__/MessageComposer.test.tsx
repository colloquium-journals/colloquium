import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MantineProvider } from '@mantine/core';
import { MessageComposer } from '../MessageComposer';
import { AuthProvider } from '../../../contexts/AuthContext';
import { User } from '@colloquium/types';

// Mock fetch for API calls
global.fetch = jest.fn();

const mockUser: User = {
  id: 'user-1',
  email: 'test@example.com',
  firstName: 'Test',
  lastName: 'User',
  role: 'AUTHOR',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z'
};

const mockBots = [
  {
    id: 'editorial-bot',
    name: 'Editorial Bot',
    description: 'Assists with manuscript editorial workflows',
    isInstalled: true,
    isEnabled: true
  },
  {
    id: 'plagiarism-bot',
    name: 'Plagiarism Bot',
    description: 'Checks for plagiarism in manuscripts',
    isInstalled: true,
    isEnabled: true
  }
];

// Mock the useAuth hook
jest.mock('../../../contexts/AuthContext', () => ({
  ...jest.requireActual('../../../contexts/AuthContext'),
  useAuth: () => ({
    user: {
      id: 'user-1',
      email: 'test@example.com',
      name: 'Test User',
      role: 'AUTHOR',
      orcidId: null,
      createdAt: '2024-01-01T00:00:00.000Z'
    },
    loading: false,
    login: jest.fn(),
    logout: jest.fn(),
    refreshUser: jest.fn(),
    isAuthenticated: true
  })
}));

// Test wrapper with all required providers
const TestWrapper = ({ children }: { children: React.ReactNode }) => {
  return (
    <MantineProvider>
      {children}
    </MantineProvider>
  );
};

describe('MessageComposer Bot Mention Functionality', () => {
  beforeEach(() => {
    // Mock the bots API response
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ bots: mockBots })
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should fetch available bots on mount', async () => {
    render(
      <TestWrapper>
        <MessageComposer
          onSubmit={jest.fn()}
        />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('http://localhost:4000/api/bots', {
        credentials: 'include'
      });
    });
  });

  it('should display bot menu when clicking mention bot button', async () => {
    render(
      <MessageComposer
        conversationId="conv-1"
        user={mockUser}
        onMessageSent={jest.fn()}
      />
    );

    // Wait for bots to load
    await waitFor(() => {
      expect(fetch).toHaveBeenCalled();
    });

    // Click the mention bot button
    const mentionButton = screen.getByText('Mention Bot');
    fireEvent.click(mentionButton);

    // Check if bot menu items are displayed
    expect(screen.getByText('Editorial Bot')).toBeInTheDocument();
    expect(screen.getByText('Plagiarism Bot')).toBeInTheDocument();
  });

  it('should add bot mention using bot ID when bot is selected', async () => {
    render(
      <MessageComposer
        conversationId="conv-1"
        user={mockUser}
        onMessageSent={jest.fn()}
      />
    );

    await waitFor(() => {
      expect(fetch).toHaveBeenCalled();
    });

    // Click the mention bot button
    const mentionButton = screen.getByText('Mention Bot');
    fireEvent.click(mentionButton);

    // Click on Editorial Bot
    const editorialBotOption = screen.getByText('Editorial Bot');
    fireEvent.click(editorialBotOption);

    // Check if the textarea contains the correct bot ID mention
    const textarea = screen.getByRole('textbox');
    expect(textarea).toHaveValue('@editorial-bot ');
  });

  it('should display bot ID in mention badge, not display name', async () => {
    render(
      <MessageComposer
        conversationId="conv-1"
        user={mockUser}
        onMessageSent={jest.fn()}
      />
    );

    await waitFor(() => {
      expect(fetch).toHaveBeenCalled();
    });

    // Click the mention bot button and select Editorial Bot
    const mentionButton = screen.getByText('Mention Bot');
    fireEvent.click(mentionButton);
    
    const editorialBotOption = screen.getByText('Editorial Bot');
    fireEvent.click(editorialBotOption);

    // Check if badge displays bot ID, not display name
    expect(screen.getByText('@editorial-bot')).toBeInTheDocument();
    // Should NOT display the full name
    expect(screen.queryByText('@Editorial Bot')).not.toBeInTheDocument();
  });

  it('should remove bot mention when clicking remove button', async () => {
    render(
      <MessageComposer
        conversationId="conv-1"
        user={mockUser}
        onMessageSent={jest.fn()}
      />
    );

    await waitFor(() => {
      expect(fetch).toHaveBeenCalled();
    });

    // Add a bot mention
    const mentionButton = screen.getByText('Mention Bot');
    fireEvent.click(mentionButton);
    
    const editorialBotOption = screen.getByText('Editorial Bot');
    fireEvent.click(editorialBotOption);

    // Verify bot is mentioned
    expect(screen.getByText('@editorial-bot')).toBeInTheDocument();
    const textarea = screen.getByRole('textbox');
    expect(textarea).toHaveValue('@editorial-bot ');

    // Click remove button on the badge
    const removeBadgeButton = screen.getByRole('button', { name: /remove/i });
    fireEvent.click(removeBadgeButton);

    // Verify bot mention is removed
    expect(screen.queryByText('@editorial-bot')).not.toBeInTheDocument();
    expect(textarea).toHaveValue('');
  });

  it('should prevent duplicate bot mentions', async () => {
    render(
      <MessageComposer
        conversationId="conv-1"
        user={mockUser}
        onMessageSent={jest.fn()}
      />
    );

    await waitFor(() => {
      expect(fetch).toHaveBeenCalled();
    });

    // Add the same bot mention twice
    const mentionButton = screen.getByText('Mention Bot');
    fireEvent.click(mentionButton);
    
    const editorialBotOption = screen.getByText('Editorial Bot');
    fireEvent.click(editorialBotOption);

    // Try to add the same bot again
    fireEvent.click(mentionButton);
    const editorialBotOptionAgain = screen.getByText('Editorial Bot');
    fireEvent.click(editorialBotOptionAgain);

    // Should only have one mention in the textarea
    const textarea = screen.getByRole('textbox');
    expect(textarea.value.split('@editorial-bot').length - 1).toBe(1);
  });

  it('should allow multiple different bot mentions', async () => {
    render(
      <MessageComposer
        conversationId="conv-1"
        user={mockUser}
        onMessageSent={jest.fn()}
      />
    );

    await waitFor(() => {
      expect(fetch).toHaveBeenCalled();
    });

    // Add Editorial Bot mention
    const mentionButton = screen.getByText('Mention Bot');
    fireEvent.click(mentionButton);
    
    const editorialBotOption = screen.getByText('Editorial Bot');
    fireEvent.click(editorialBotOption);

    // Add Plagiarism Bot mention
    fireEvent.click(mentionButton);
    const plagiarismBotOption = screen.getByText('Plagiarism Bot');
    fireEvent.click(plagiarismBotOption);

    // Check if both bots are mentioned
    expect(screen.getByText('@editorial-bot')).toBeInTheDocument();
    expect(screen.getByText('@plagiarism-bot')).toBeInTheDocument();

    const textarea = screen.getByRole('textbox');
    expect(textarea).toHaveValue('@editorial-bot @plagiarism-bot ');
  });

  it('should handle API error gracefully when fetching bots', async () => {
    // Mock API error
    (fetch as jest.Mock).mockRejectedValue(new Error('API Error'));

    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    render(
      <MessageComposer
        conversationId="conv-1"
        user={mockUser}
        onMessageSent={jest.fn()}
      />
    );

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Error fetching bots:', expect.any(Error));
    });

    consoleSpy.mockRestore();
  });

  it('should only show enabled and installed bots in the menu', async () => {
    const botsWithDisabled = [
      ...mockBots,
      {
        id: 'disabled-bot',
        name: 'Disabled Bot',
        description: 'This bot is disabled',
        isInstalled: true,
        isEnabled: false
      },
      {
        id: 'uninstalled-bot',
        name: 'Uninstalled Bot',
        description: 'This bot is not installed',
        isInstalled: false,
        isEnabled: true
      }
    ];

    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ bots: botsWithDisabled })
    });

    render(
      <MessageComposer
        conversationId="conv-1"
        user={mockUser}
        onMessageSent={jest.fn()}
      />
    );

    await waitFor(() => {
      expect(fetch).toHaveBeenCalled();
    });

    // Click the mention bot button
    const mentionButton = screen.getByText('Mention Bot');
    fireEvent.click(mentionButton);

    // Should show enabled bots
    expect(screen.getByText('Editorial Bot')).toBeInTheDocument();
    expect(screen.getByText('Plagiarism Bot')).toBeInTheDocument();

    // Should NOT show disabled or uninstalled bots
    expect(screen.queryByText('Disabled Bot')).not.toBeInTheDocument();
    expect(screen.queryByText('Uninstalled Bot')).not.toBeInTheDocument();
  });

  it('should transform bot IDs to display names when submitting message via button', async () => {
    const mockOnSubmit = jest.fn();
    
    render(
      <TestWrapper>
        <MessageComposer
          onSubmit={mockOnSubmit}
        />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(fetch).toHaveBeenCalled();
    });

    // Add bot mention using the button
    const mentionButton = screen.getByText('Mention Bot');
    fireEvent.click(mentionButton);
    
    const editorialBotOption = screen.getByText('Editorial Bot');
    fireEvent.click(editorialBotOption);

    // Add some additional text to the message
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { 
      target: { value: '@editorial-bot help with this manuscript' } 
    });

    // Submit the message
    const submitButton = screen.getByRole('button', { name: /send/i });
    fireEvent.click(submitButton);

    // Verify that the message was sent with the display name, not the bot ID
    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith(
        '@Editorial Bot help with this manuscript',
        'PUBLIC'
      );
    });
  });

  it('should maintain manual bot ID mentions when typed directly', async () => {
    const mockOnSubmit = jest.fn();
    
    render(
      <TestWrapper>
        <MessageComposer
          onSubmit={mockOnSubmit}
        />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(fetch).toHaveBeenCalled();
    });

    // Type bot mention manually (not using the button)
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { 
      target: { value: '@editorial-bot help with this manuscript' } 
    });

    // Submit the message
    const submitButton = screen.getByRole('button', { name: /send/i });
    fireEvent.click(submitButton);

    // Verify that manually typed bot IDs are preserved
    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith(
        '@editorial-bot help with this manuscript',
        'PUBLIC'
      );
    });
  });
});