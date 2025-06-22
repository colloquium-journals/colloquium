import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { MessageComposer } from '../MessageComposer';

// Mock the auth context
const mockUser = {
  id: 'user1',
  name: 'Test User',
  email: 'test@example.com',
  role: 'AUTHOR'
};

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: mockUser })
}));

// Mock fetch for API calls
global.fetch = jest.fn();
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const mockBots = [
  {
    id: 'editorial-bot',
    name: 'Editorial Bot',
    description: 'Assists with editorial workflows',
    isInstalled: true,
    isEnabled: true
  }
];

const mockParticipants = [
  {
    id: 'p1',
    user: {
      id: 'user2',
      name: 'John Doe',
      email: 'john@example.com',
      role: 'REVIEWER'
    }
  }
];

const renderMessageComposer = (props = {}) => {
  const defaultProps = {
    onSubmit: jest.fn(),
    conversationId: 'conv-123',
    ...props
  };

  return render(
    <MantineProvider>
      <MessageComposer {...defaultProps} />
    </MantineProvider>
  );
};

describe('MessageComposer - Mention Functionality Integration', () => {
  beforeEach(() => {
    mockFetch.mockClear();
    
    // Mock bots API response
    mockFetch.mockImplementation((url) => {
      if (url === 'http://localhost:4000/api/bots') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ bots: mockBots })
        } as Response);
      }
      
      // Mock conversation participants API response
      if (url === 'http://localhost:4000/api/conversations/conv-123') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ participants: mockParticipants })
        } as Response);
      }
      
      return Promise.reject(new Error('Unknown URL'));
    });
  });

  it('should render MessageComposer with mention functionality', async () => {
    renderMessageComposer();
    
    // Check that the textarea is present
    expect(screen.getByPlaceholderText(/Write your message/)).toBeInTheDocument();
    
    // Check that APIs are called
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('http://localhost:4000/api/bots', {
        credentials: 'include'
      });
    });
  });

  it('should load conversation participants when conversationId is provided', async () => {
    renderMessageComposer();
    
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('http://localhost:4000/api/conversations/conv-123', {
        credentials: 'include'
      });
    });
  });

  it('should not call conversation API when no conversationId', async () => {
    renderMessageComposer({ conversationId: undefined });
    
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('http://localhost:4000/api/bots', {
        credentials: 'include'
      });
    });
    
    // Should not call conversation API
    expect(mockFetch).not.toHaveBeenCalledWith(
      expect.stringContaining('/api/conversations/')
    );
  });

  it('should handle API errors gracefully', async () => {
    // Mock API failure
    mockFetch.mockImplementation(() => 
      Promise.resolve({
        ok: false,
        status: 500
      } as Response)
    );

    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    
    renderMessageComposer();
    
    // Should still render component without crashing
    expect(screen.getByPlaceholderText(/Write your message/)).toBeInTheDocument();
    
    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalled();
    });

    consoleSpy.mockRestore();
  });

  it('should render existing bot mention menu', async () => {
    renderMessageComposer();
    
    // The existing mention bot button should be present
    expect(screen.getByText('Mention Bot')).toBeInTheDocument();
  });

  it('should have the mention functionality integrated', () => {
    renderMessageComposer();
    
    // The textarea should be present and ready for mention input
    const textarea = screen.getByPlaceholderText(/Write your message/);
    expect(textarea).toBeInTheDocument();
    
    // The component should integrate both old and new mention systems
    expect(screen.getByText('Mention Bot')).toBeInTheDocument();
  });
});