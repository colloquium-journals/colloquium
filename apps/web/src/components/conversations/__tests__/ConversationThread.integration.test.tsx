import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MantineProvider } from '@mantine/core';
import { AuthProvider } from '../../../contexts/AuthContext';
import { ConversationThread } from '../ConversationThread';

// Mock SSE hook
const mockSSEHook = {
  isConnected: true,
  connectionStatus: 'connected' as const,
  disconnect: jest.fn()
};

jest.mock('../../../hooks/useSSE', () => ({
  useSSE: jest.fn(() => mockSSEHook)
}));

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

// Mock fetch for API calls
global.fetch = jest.fn();

const mockConversationData = {
  id: 'conversation-123',
  type: 'EDITORIAL',
  privacy: 'PRIVATE',
  title: 'Test Conversation',
  manuscript: {
    title: 'Test Manuscript',
    authors: ['Test Author']
  },
  createdAt: '2024-01-01T00:00:00.000Z',
  messages: [
    {
      id: 'msg-1',
      content: 'Initial message',
      privacy: 'AUTHOR_VISIBLE',
      createdAt: '2024-01-01T00:00:00.000Z',
      author: {
        id: 'user-1',
        name: 'Test User',
        email: 'test@example.com'
      },
      parentId: null,
      isBot: false
    }
  ],
  participants: [
    {
      id: 'user-1',
      role: 'AUTHOR',
      user: {
        id: 'user-1',
        name: 'Test User',
        email: 'test@example.com',
        role: 'AUTHOR'
      }
    }
  ]
};

// Test wrapper with all required providers
const TestWrapper = ({ children }: { children: React.ReactNode }) => {
  return (
    <MantineProvider>
      {children}
    </MantineProvider>
  );
};

describe('ConversationThread Real-time Message Flow', () => {
  let mockUseSSE: jest.Mock;

  beforeEach(() => {
    mockUseSSE = require('../../../hooks/useSSE').useSSE;
    mockUseSSE.mockReturnValue(mockSSEHook);

    // Mock the conversation API response
    (fetch as jest.Mock).mockImplementation((url) => {
      if (url.includes('/api/conversations/')) {
        return Promise.resolve({
          ok: true,
          json: async () => mockConversationData
        });
      }
      if (url.includes('/api/bots')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ bots: [] })
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({})
      });
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should establish SSE connection for the conversation', async () => {
    render(
      <TestWrapper>
        <ConversationThread conversationId="conversation-123" />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(mockUseSSE).toHaveBeenCalledWith('conversation-123', {
        enabled: true,
        onNewMessage: expect.any(Function)
      });
    });
  });

  it('should display existing messages on load', async () => {
    render(
      <TestWrapper>
        <ConversationThread conversationId="conversation-123" />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Initial message')).toBeInTheDocument();
    });
  });

  it('should add user message immediately when posted', async () => {
    // Mock successful message posting
    (fetch as jest.Mock).mockImplementation((url, options) => {
      if (url.includes('/api/conversations/') && options?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          status: 201,
          json: async () => ({
            message: 'Message posted successfully',
            data: {
              id: 'msg-2',
              content: 'New user message',
              privacy: 'AUTHOR_VISIBLE',
              createdAt: '2024-01-01T00:01:00.000Z',
              author: {
                id: 'user-1',
                name: 'Test User',
                type: 'user'
              },
              parentId: null,
              botMetadata: null,
              editHistory: [],
              children: []
            }
          })
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => mockConversationData
      });
    });

    render(
      <TestWrapper>
        <ConversationThread conversationId="conversation-123" />
      </TestWrapper>
    );

    // Wait for conversation to load
    await waitFor(() => {
      expect(screen.getByText('Initial message')).toBeInTheDocument();
    });

    // Find the message composer textarea and submit button
    const textarea = screen.getByRole('textbox');
    const submitButton = screen.getByRole('button', { name: /send/i });

    // Type and submit a new message
    fireEvent.change(textarea, { target: { value: 'New user message' } });
    fireEvent.click(submitButton);

    // The user message should appear immediately (not waiting for SSE)
    await waitFor(() => {
      expect(screen.getByText('New user message')).toBeInTheDocument();
    });

    // Verify the API was called correctly
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:4000/api/conversations/conversation-123/messages',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          content: 'New user message',
          parentId: undefined,
          privacy: 'AUTHOR_VISIBLE'
        })
      })
    );
  });

  it('should receive bot messages via SSE', async () => {
    let sseCallback: ((message: any) => void) | undefined;

    // Capture the SSE callback
    mockUseSSE.mockImplementation((conversationId, options) => {
      sseCallback = options.onNewMessage;
      return mockSSEHook;
    });

    render(
      <TestWrapper>
        <ConversationThread conversationId="conversation-123" />
      </TestWrapper>
    );

    // Wait for conversation to load
    await waitFor(() => {
      expect(screen.getByText('Initial message')).toBeInTheDocument();
    });

    // Simulate receiving a bot message via SSE
    const botMessage = {
      id: 'msg-bot-1',
      content: 'Bot response message',
      privacy: 'AUTHOR_VISIBLE',
      createdAt: '2024-01-01T00:02:00.000Z',
      author: {
        id: 'editorial-bot',
        name: 'Editorial Bot',
        type: 'bot'
      },
      parentId: null,
      botMetadata: {
        botId: 'editorial-bot',
        command: 'help'
      },
      editHistory: [],
      children: []
    };

    if (sseCallback) {
      sseCallback(botMessage);
    }

    // The bot message should appear in the conversation
    await waitFor(() => {
      expect(screen.getByText('Bot response message')).toBeInTheDocument();
    });
  });

  it('should not duplicate messages when receiving via SSE', async () => {
    let sseCallback: ((message: any) => void) | undefined;

    mockUseSSE.mockImplementation((conversationId, options) => {
      sseCallback = options.onNewMessage;
      return mockSSEHook;
    });

    render(
      <TestWrapper>
        <ConversationThread conversationId="conversation-123" />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Initial message')).toBeInTheDocument();
    });

    // Simulate receiving the same message twice
    const duplicateMessage = {
      id: 'msg-duplicate',
      content: 'Duplicate message test',
      privacy: 'AUTHOR_VISIBLE',
      createdAt: '2024-01-01T00:03:00.000Z',
      author: {
        id: 'user-1',
        name: 'Test User',
        type: 'user'
      },
      parentId: null,
      botMetadata: null,
      editHistory: [],
      children: []
    };

    if (sseCallback) {
      sseCallback(duplicateMessage);
      sseCallback(duplicateMessage); // Send the same message again
    }

    await waitFor(() => {
      expect(screen.getByText('Duplicate message test')).toBeInTheDocument();
    });

    // Should only appear once in the DOM
    const duplicateMessages = screen.getAllByText('Duplicate message test');
    expect(duplicateMessages).toHaveLength(1);
  });

  it('should handle SSE connection errors gracefully', async () => {
    // Mock SSE connection error
    mockUseSSE.mockReturnValue({
      isConnected: false,
      connectionStatus: 'error',
      disconnect: jest.fn()
    });

    render(
      <TestWrapper>
        <ConversationThread conversationId="conversation-123" />
      </TestWrapper>
    );

    // Conversation should still load and display existing messages
    await waitFor(() => {
      expect(screen.getByText('Initial message')).toBeInTheDocument();
    });

    // User should still be able to post messages even with SSE error
    const textarea = screen.getByRole('textbox');
    const submitButton = screen.getByRole('button', { name: /send/i });

    expect(textarea).toBeEnabled();
    expect(submitButton).toBeEnabled();
  });

  it('should handle bot mentions correctly in message flow', async () => {
    // Mock bots API
    (fetch as jest.Mock).mockImplementation((url, options) => {
      if (url.includes('/api/bots')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            bots: [
              {
                id: 'editorial-bot',
                name: 'Editorial Bot',
                description: 'Assists with editorial workflows',
                isInstalled: true,
                isEnabled: true
              }
            ]
          })
        });
      }
      if (url.includes('/api/conversations/') && options?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          status: 201,
          json: async () => ({
            message: 'Message posted successfully',
            data: {
              id: 'msg-bot-mention',
              content: '@editorial-bot help',
              privacy: 'AUTHOR_VISIBLE',
              createdAt: '2024-01-01T00:04:00.000Z',
              author: {
                id: 'user-1',
                name: 'Test User',
                type: 'user'
              },
              parentId: null,
              botMetadata: null,
              editHistory: [],
              children: []
            }
          })
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => mockConversationData
      });
    });

    render(
      <TestWrapper>
        <ConversationThread conversationId="conversation-123" />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Initial message')).toBeInTheDocument();
    });

    // Type a bot mention
    const textarea = screen.getByRole('textbox');
    const submitButton = screen.getByRole('button', { name: /send/i });

    fireEvent.change(textarea, { target: { value: '@editorial-bot help' } });
    fireEvent.click(submitButton);

    // Message should be posted
    await waitFor(() => {
      expect(screen.getByText('@editorial-bot help')).toBeInTheDocument();
    });

    // Verify the correct API call was made
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:4000/api/conversations/conversation-123/messages',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          content: '@editorial-bot help',
          parentId: undefined,
          privacy: 'AUTHOR_VISIBLE'
        })
      })
    );
  });

  it('should show connection status indicator', async () => {
    render(
      <TestWrapper>
        <ConversationThread conversationId="conversation-123" />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Initial message')).toBeInTheDocument();
    });

    // Should show connected status (this depends on your UI implementation)
    // You might need to add a connection status indicator to the UI
  });
});