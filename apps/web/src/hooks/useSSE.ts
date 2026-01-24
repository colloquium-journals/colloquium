import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';

interface UseSSEOptions {
  enabled?: boolean;
  onNewMessage?: (message: any) => void;
  onMessageUpdated?: (message: any) => void;
  onActionEditorAssigned?: (assignment: any) => void;
  onReviewerAssigned?: (assignment: any) => void;
  onReviewerInvitationResponse?: (response: any) => void;
}

export function useSSE(conversationId: string, options: UseSSEOptions = {}) {
  const { enabled = true, onNewMessage, onMessageUpdated, onActionEditorAssigned, onReviewerAssigned, onReviewerInvitationResponse } = options;
  const { token } = useAuth();
  const eventSourceRef = useRef<EventSource | null>(null);
  const onNewMessageRef = useRef(onNewMessage);
  const onMessageUpdatedRef = useRef(onMessageUpdated);
  const onActionEditorAssignedRef = useRef(onActionEditorAssigned);
  const onReviewerAssignedRef = useRef(onReviewerAssigned);
  const onReviewerInvitationResponseRef = useRef(onReviewerInvitationResponse);
  const connectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');

  // Keep callback references up to date
  useEffect(() => {
    onNewMessageRef.current = onNewMessage;
  }, [onNewMessage]);

  useEffect(() => {
    onMessageUpdatedRef.current = onMessageUpdated;
  }, [onMessageUpdated]);

  useEffect(() => {
    onActionEditorAssignedRef.current = onActionEditorAssigned;
  }, [onActionEditorAssigned]);

  useEffect(() => {
    onReviewerAssignedRef.current = onReviewerAssigned;
  }, [onReviewerAssigned]);

  useEffect(() => {
    onReviewerInvitationResponseRef.current = onReviewerInvitationResponse;
  }, [onReviewerInvitationResponse]);

  useEffect(() => {
    if (!enabled || !conversationId) {
      return;
    }

    // Avoid recreating connection if one already exists for this conversation
    if (eventSourceRef.current && eventSourceRef.current.readyState !== EventSource.CLOSED) {
      return;
    }

    // Use 127.0.0.1 instead of localhost to avoid potential DNS issues
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:4000';
    const sseUrl = token 
      ? `${baseUrl}/api/events/conversations/${conversationId}?token=${encodeURIComponent(token)}`
      : `${baseUrl}/api/events/conversations/${conversationId}`;
    setConnectionStatus('connecting');

    // Add a small delay to avoid React Strict Mode double execution issues
    const timeoutId = setTimeout(() => {
      // Double-check if connection still needed
      if (eventSourceRef.current && eventSourceRef.current.readyState !== EventSource.CLOSED) {
        return;
      }

      // Create EventSource connection
      const eventSource = new EventSource(sseUrl, { withCredentials: true });
      eventSourceRef.current = eventSource;

      eventSource.onopen = (event) => {
        if (connectionTimeoutRef.current) {
          clearTimeout(connectionTimeoutRef.current);
        }
        setConnectionStatus('connected');
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'new-message') {
            if (onNewMessageRef.current) {
              onNewMessageRef.current(data.message);
            }
          } else if (data.type === 'message-updated') {
            if (onMessageUpdatedRef.current) {
              onMessageUpdatedRef.current(data.message);
            }
          } else if (data.type === 'connected') {
            // Connection established
          } else if (data.type === 'heartbeat') {
            // Heartbeat received
          } else if (data.type === 'action-editor-assigned') {
            if (onActionEditorAssignedRef.current) {
              onActionEditorAssignedRef.current(data.assignment);
            }
          } else if (data.type === 'reviewer-assigned') {
            if (onReviewerAssignedRef.current) {
              onReviewerAssignedRef.current(data.assignment);
            }
          } else if (data.type === 'reviewer-invitation-response') {
            if (onReviewerInvitationResponseRef.current) {
              onReviewerInvitationResponseRef.current(data.response);
            }
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
      clearTimeout(timeoutId);
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
      }
      
      if (eventSourceRef.current && eventSourceRef.current.readyState !== EventSource.CLOSED) {
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