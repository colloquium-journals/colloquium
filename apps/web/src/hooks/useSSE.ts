import { useEffect, useRef, useState } from 'react';

interface UseSSEOptions {
  enabled?: boolean;
  onNewMessage?: (message: any) => void;
}

export function useSSE(conversationId: string, options: UseSSEOptions = {}) {
  const { enabled = true, onNewMessage } = options;
  const eventSourceRef = useRef<EventSource | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');

  useEffect(() => {
    if (!enabled || !conversationId) return;

    console.log(`📡 SSE: Connecting to conversation ${conversationId}`);
    setConnectionStatus('connecting');

    // Create EventSource connection
    const eventSource = new EventSource(
      `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/events/conversations/${conversationId}`,
      { withCredentials: true }
    );

    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      console.log('📡 SSE: Connected to server');
      setIsConnected(true);
      setConnectionStatus('connected');
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('📡 SSE: Received event:', data);

        if (data.type === 'new-message' && onNewMessage) {
          onNewMessage(data.message);
        } else if (data.type === 'connected') {
          console.log('📡 SSE: Successfully joined conversation');
        } else if (data.type === 'heartbeat') {
          // Heartbeat to keep connection alive
        }
      } catch (error) {
        console.error('📡 SSE: Error parsing message:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('📡 SSE: Connection error:', error);
      setIsConnected(false);
      setConnectionStatus('error');
      
      // EventSource will automatically try to reconnect
      setTimeout(() => {
        if (eventSource.readyState === EventSource.CONNECTING) {
          setConnectionStatus('connecting');
        }
      }, 1000);
    };

    return () => {
      console.log('📡 SSE: Closing connection');
      eventSource.close();
      eventSourceRef.current = null;
      setIsConnected(false);
      setConnectionStatus('disconnected');
    };
  }, [enabled, conversationId, onNewMessage]);

  const disconnect = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
      setIsConnected(false);
      setConnectionStatus('disconnected');
    }
  };

  return {
    isConnected,
    connectionStatus,
    disconnect
  };
}