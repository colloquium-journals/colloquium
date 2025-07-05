import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';

interface UseSSEOptions {
  enabled?: boolean;
  onNewMessage?: (message: any) => void;
}

export function useSSE(conversationId: string, options: UseSSEOptions = {}) {
  const { enabled = true, onNewMessage } = options;
  const { token } = useAuth();
  const eventSourceRef = useRef<EventSource | null>(null);
  const onNewMessageRef = useRef(onNewMessage);
  const connectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');

  // Keep callback reference up to date
  useEffect(() => {
    onNewMessageRef.current = onNewMessage;
  }, [onNewMessage]);

  useEffect(() => {
    if (!enabled || !conversationId) {
      console.log('📡 SSE: Not connecting - enabled:', enabled, 'conversationId:', conversationId);
      return;
    }

    // Avoid recreating connection if one already exists for this conversation
    if (eventSourceRef.current && eventSourceRef.current.readyState !== EventSource.CLOSED) {
      console.log('📡 SSE: Connection already exists, skipping', {
        url: eventSourceRef.current.url,
        readyState: eventSourceRef.current.readyState
      });
      return;
    }

    // Use 127.0.0.1 instead of localhost to avoid potential DNS issues
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:4000';
    const sseUrl = token 
      ? `${baseUrl}/api/events/conversations/${conversationId}?token=${encodeURIComponent(token)}`
      : `${baseUrl}/api/events/conversations/${conversationId}`;
    console.log(`📡 SSE: Creating new connection to conversation ${conversationId}`);
    console.log(`📡 SSE: URL: ${sseUrl} (token: ${token ? 'present' : 'missing'})`);
    setConnectionStatus('connecting');

    // Add a small delay to avoid React Strict Mode double execution issues
    const timeoutId = setTimeout(() => {
      // Double-check if connection still needed
      if (eventSourceRef.current && eventSourceRef.current.readyState !== EventSource.CLOSED) {
        console.log('📡 SSE: Connection already exists after delay, aborting');
        return;
      }

      console.log('📡 SSE: Creating EventSource with options:', {
        url: sseUrl,
        withCredentials: true,
        timestamp: new Date().toISOString()
      });

      // Create EventSource connection
      const eventSource = new EventSource(sseUrl, { withCredentials: true });
      eventSourceRef.current = eventSource;

      // Log initial state
      console.log('📡 SSE: EventSource created, initial readyState:', eventSource.readyState);

      eventSource.onopen = (event) => {
        console.log('📡 SSE: Connected to server, readyState:', eventSource.readyState);
        if (connectionTimeoutRef.current) {
          clearTimeout(connectionTimeoutRef.current);
        }
        setConnectionStatus('connected');
      };

      eventSource.onmessage = (event) => {
        console.log('📡 SSE: Raw message received:', event);
        console.log('📡 SSE: Raw event data:', event.data);
        
        try {
          const data = JSON.parse(event.data);
          console.log('📡 SSE: Parsed event data:', data);
          console.log('📡 SSE: Event type:', data.type);

          if (data.type === 'new-message') {
            console.log('📡 SSE: New message event detected');
            console.log('📡 SSE: onNewMessage callback exists:', !!onNewMessageRef.current);
            console.log('📡 SSE: Message data:', data.message);
            
            if (onNewMessageRef.current) {
              console.log('📡 SSE: Calling onNewMessage callback');
              onNewMessageRef.current(data.message);
              console.log('📡 SSE: onNewMessage callback completed');
            } else {
              console.warn('📡 SSE: No onNewMessage callback available');
            }
          } else if (data.type === 'connected') {
            console.log('📡 SSE: Successfully joined conversation');
          } else if (data.type === 'heartbeat') {
            console.log('📡 SSE: Heartbeat received');
          } else {
            console.log('📡 SSE: Unknown event type:', data.type);
          }
        } catch (error) {
          console.error('📡 SSE: Error parsing message:', error);
          console.error('📡 SSE: Raw data that failed to parse:', event.data);
        }
      };

      eventSource.onerror = (error) => {
        console.error('📡 SSE: Connection error, readyState:', eventSource.readyState, 'error:', error);
        console.error('📡 SSE: Error details:', {
          readyState: eventSource.readyState,
          url: eventSource.url,
          withCredentials: true,
          timestamp: new Date().toISOString()
        });
        
        if (error.target) {
          console.error('📡 SSE: Error target details:', {
            readyState: (error.target as EventSource).readyState,
            url: (error.target as EventSource).url
          });
        }
        
        setConnectionStatus('error');
        
        if (eventSource.readyState === EventSource.CLOSED) {
          console.error('📡 SSE: Connection was closed by server (possibly auth/network issue)');
        } else if (eventSource.readyState === EventSource.CONNECTING) {
          console.log('📡 SSE: EventSource is reconnecting automatically');
          setConnectionStatus('connecting');
        }
      };

      // Add a timeout to detect if connection is stuck
      connectionTimeoutRef.current = setTimeout(() => {
        if (eventSource.readyState === EventSource.CONNECTING) {
          console.error('📡 SSE: Connection timeout - stuck in CONNECTING state');
          console.error('📡 SSE: This might indicate a network or CORS issue');
        }
      }, 10000); // 10 second timeout

    }, 100); // 100ms delay

    return () => {
      console.log('📡 SSE: Cleaning up effect');
      clearTimeout(timeoutId);
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
      }
      
      if (eventSourceRef.current && eventSourceRef.current.readyState !== EventSource.CLOSED) {
        console.log('📡 SSE: Closing existing connection, readyState:', eventSourceRef.current.readyState);
        eventSourceRef.current.close();
        eventSourceRef.current = null;
        setConnectionStatus('disconnected');
      }
    };
  }, [enabled, conversationId, token]);

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
      setConnectionStatus('disconnected');
    }
  }, []);

  return {
    isConnected: connectionStatus === 'connected',
    connectionStatus,
    disconnect
  };
}