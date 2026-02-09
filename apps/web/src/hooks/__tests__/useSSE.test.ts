import { renderHook, act } from '@testing-library/react';
import { useSSE } from '../useSSE';
import { API_URL } from '@/lib/api';

jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ token: 'test-token' }),
}));

// Mock EventSource
class MockEventSource {
  public url: string;
  public readyState: number = 0; // CONNECTING
  public onopen: ((event: Event) => void) | null = null;
  public onmessage: ((event: MessageEvent) => void) | null = null;
  public onerror: ((event: Event) => void) | null = null;
  
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSED = 2;

  constructor(url: string, options?: EventSourceInit) {
    this.url = url;
    // Simulate async connection with fake timers
    setTimeout(() => {
      this.readyState = MockEventSource.OPEN;
      if (this.onopen) {
        this.onopen(new Event('open'));
      }
    }, 10);
  }

  close() {
    this.readyState = MockEventSource.CLOSED;
  }

  // Test helper to simulate receiving a message
  simulateMessage(data: any) {
    if (this.onmessage) {
      const event = new MessageEvent('message', {
        data: JSON.stringify(data)
      });
      this.onmessage(event);
    }
  }

  // Test helper to simulate connection error
  simulateError() {
    if (this.onerror) {
      this.onerror(new Event('error'));
    }
  }
}

// Store references to created EventSources for testing
const mockEventSources: MockEventSource[] = [];

// Mock the global EventSource
(global as any).EventSource = jest.fn().mockImplementation((url: string, options?: EventSourceInit) => {
  const eventSource = new MockEventSource(url, options);
  mockEventSources.push(eventSource);
  return eventSource;
});

describe('useSSE Hook', () => {
  beforeEach(() => {
    mockEventSources.length = 0;
    jest.clearAllMocks();
    // Suppress console logs during tests to reduce noise
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    // Clean up any open connections
    mockEventSources.forEach(es => es.close());
    jest.restoreAllMocks();
  });

  it('should establish SSE connection when enabled and conversationId provided', async () => {
    const mockOnNewMessage = jest.fn();
    
    renderHook(() => useSSE('conversation-123', {
      enabled: true,
      onNewMessage: mockOnNewMessage
    }));

    // Wait for the hook's timeout to trigger (100ms + buffer)
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 150));
    });

    expect(global.EventSource).toHaveBeenCalledWith(
      `${API_URL}/api/events/conversations/conversation-123?token=${encodeURIComponent('test-token')}`,
      { withCredentials: true }
    );
    expect(mockEventSources).toHaveLength(1);
  });

  it('should not establish connection when disabled', () => {
    renderHook(() => useSSE('conversation-123', {
      enabled: false
    }));

    expect(global.EventSource).not.toHaveBeenCalled();
    expect(mockEventSources).toHaveLength(0);
  });

  it('should not establish connection when conversationId is empty', () => {
    renderHook(() => useSSE('', {
      enabled: true
    }));

    expect(global.EventSource).not.toHaveBeenCalled();
    expect(mockEventSources).toHaveLength(0);
  });

  it('should update connection status correctly', async () => {
    const { result } = renderHook(() => useSSE('conversation-123', {
      enabled: true
    }));

    // Initially connecting
    expect(result.current.connectionStatus).toBe('connecting');
    expect(result.current.isConnected).toBe(false);

    // Wait for hook timeout and connection to establish
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 150));
    });

    expect(result.current.connectionStatus).toBe('connected');
    expect(result.current.isConnected).toBe(true);
  });

  it('should call onNewMessage when receiving new-message event', async () => {
    const mockOnNewMessage = jest.fn();
    const mockMessage = {
      id: 'msg-123',
      content: 'Test message',
      author: { id: 'user-1', name: 'Test User' }
    };

    renderHook(() => useSSE('conversation-123', {
      enabled: true,
      onNewMessage: mockOnNewMessage
    }));

    // Fast-forward timers to establish connection and open event
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 150));
    });

    // Simulate receiving a new message
    act(() => {
      mockEventSources[0].simulateMessage({
        type: 'new-message',
        message: mockMessage
      });
    });

    expect(mockOnNewMessage).toHaveBeenCalledWith(mockMessage);
  });

  it('should not call onNewMessage for non-message events', async () => {
    const mockOnNewMessage = jest.fn();

    renderHook(() => useSSE('conversation-123', {
      enabled: true,
      onNewMessage: mockOnNewMessage
    }));

    // Fast-forward timers to establish connection and open event
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 150));
    });

    // Simulate receiving heartbeat and connected events
    act(() => {
      mockEventSources[0].simulateMessage({ type: 'heartbeat', timestamp: Date.now() });
      mockEventSources[0].simulateMessage({ type: 'connected', conversationId: 'conversation-123' });
    });

    expect(mockOnNewMessage).not.toHaveBeenCalled();
  });

  it('should handle connection errors correctly', async () => {
    const { result } = renderHook(() => useSSE('conversation-123', {
      enabled: true
    }));

    // Wait for initial connection and open event
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 150));
    });

    // Simulate connection error
    act(() => {
      mockEventSources[0].simulateError();
    });

    expect(result.current.connectionStatus).toBe('error');
    expect(result.current.isConnected).toBe(false);
  });

  it('should clean up connection on unmount', async () => {
    const { unmount } = renderHook(() => useSSE('conversation-123', {
      enabled: true
    }));

    // Fast-forward timers to establish connection and open event
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 150));
    });

    const eventSource = mockEventSources[0];
    expect(eventSource.readyState).toBe(MockEventSource.OPEN);

    // Unmount the hook
    unmount();

    expect(eventSource.readyState).toBe(MockEventSource.CLOSED);
  });

  it('should not create duplicate connections when callback changes', async () => {
    const mockOnNewMessage1 = jest.fn();
    const mockOnNewMessage2 = jest.fn();

    const { rerender } = renderHook(
      ({ onNewMessage }) => useSSE('conversation-123', {
        enabled: true,
        onNewMessage
      }),
      { initialProps: { onNewMessage: mockOnNewMessage1 } }
    );

    // Wait for initial connection and open event
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 150));
    });

    expect(mockEventSources).toHaveLength(1);
    const firstEventSource = mockEventSources[0];

    // Change the callback
    rerender({ onNewMessage: mockOnNewMessage2 });

    // Should not create a new connection
    expect(mockEventSources).toHaveLength(1);
    expect(mockEventSources[0]).toBe(firstEventSource);

    // But new callback should be used
    act(() => {
      mockEventSources[0].simulateMessage({
        type: 'new-message',
        message: { id: 'msg-123', content: 'Test' }
      });
    });

    expect(mockOnNewMessage1).not.toHaveBeenCalled();
    expect(mockOnNewMessage2).toHaveBeenCalled();
  });

  it('should handle malformed JSON messages gracefully', async () => {
    const mockOnNewMessage = jest.fn();
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    renderHook(() => useSSE('conversation-123', {
      enabled: true,
      onNewMessage: mockOnNewMessage
    }));

    // Fast-forward timers to establish connection and open event
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 150));
    });

    // Simulate receiving malformed JSON
    act(() => {
      const event = new MessageEvent('message', { data: 'invalid json' });
      if (mockEventSources[0].onmessage) {
        mockEventSources[0].onmessage(event);
      }
    });

    expect(consoleSpy).toHaveBeenCalledWith('📡 SSE: Error parsing message:', expect.any(SyntaxError));
    expect(mockOnNewMessage).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it('should prevent creating connection if one already exists', async () => {
    const { rerender } = renderHook(() => useSSE('conversation-123', {
      enabled: true
    }));

    // Wait for initial connection and open event
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 150));
    });

    expect(mockEventSources).toHaveLength(1);
    const firstEventSource = mockEventSources[0];

    // Trigger re-render that would normally create new connection
    rerender();

    // Should not create a new connection since one already exists
    expect(mockEventSources).toHaveLength(1);
    expect(mockEventSources[0]).toBe(firstEventSource);
  });
});