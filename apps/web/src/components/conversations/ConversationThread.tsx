'use client';

import { useState, useEffect, useCallback } from 'react';
import { Stack, Paper, Title, Text, Badge, Group, Loader, Alert } from '@mantine/core';
import { IconAlertCircle, IconWifi, IconWifiOff, IconLoader } from '@tabler/icons-react';
import { MessageThread } from './MessageThread';
import { MessageComposer } from './MessageComposer';
import { useSSE } from '../../hooks/useSSE';

// Mock data types (will be replaced with real API calls)
interface ConversationData {
  id: string;
  title: string;
  type: string;
  privacy: string;
  manuscript: {
    title: string;
    authors: string[];
  } | null;
  messages: MessageData[];
}

interface MessageData {
  id: string;
  content: string;
  privacy: string;
  author: {
    id: string;
    name: string;
    email: string;
    role?: string;
    affiliation?: string;
    orcid?: string;
    joinedAt?: string;
    bio?: string;
  };
  createdAt: string;
  editedAt?: string;
  isBot: boolean;
  parentId?: string;
}

interface ConversationThreadProps {
  conversationId: string;
}

export function ConversationThread({ conversationId }: ConversationThreadProps) {
  const [conversation, setConversation] = useState<ConversationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Handle real-time messages
  const handleNewMessage = useCallback((newMessage: MessageData) => {
    console.log('🎯 ConversationThread: Received new message via SSE:', newMessage);
    console.log('🎯 ConversationThread: Message details:', {
      id: newMessage.id,
      content: newMessage.content,
      author: newMessage.author
    });
    
    setConversation(prev => {
      if (!prev) {
        console.log('🎯 ConversationThread: No conversation state, skipping message');
        return prev;
      }
      
      // Check if message already exists (avoid duplicates)
      const messageExists = prev.messages.some(msg => msg.id === newMessage.id);
      if (messageExists) {
        console.log('🎯 ConversationThread: Message already exists, skipping');
        return prev;
      }

      console.log('🎯 ConversationThread: Adding new message to conversation');
      console.log('🎯 ConversationThread: Current message count:', prev.messages.length);
      const updatedConversation = {
        ...prev,
        messages: [...prev.messages, newMessage]
      };
      console.log('🎯 ConversationThread: New message count:', updatedConversation.messages.length);
      return updatedConversation;
    });
  }, []);

  // Initialize SSE connection
  const { isConnected, connectionStatus } = useSSE(conversationId, {
    enabled: !!conversationId,
    onNewMessage: handleNewMessage
  });

  // Log SSE connection status
  useEffect(() => {
    console.log('🔌 ConversationThread: SSE Status Update:', {
      conversationId,
      isConnected,
      connectionStatus,
      hasCallback: !!handleNewMessage
    });
  }, [conversationId, isConnected, connectionStatus, handleNewMessage]);

  // Mock data - will be replaced with API call
  useEffect(() => {
    const fetchConversation = async () => {
      try {
        setLoading(true);
        
        const response = await fetch(`http://localhost:4000/api/conversations/${conversationId}`, {
          credentials: 'include' // Include auth cookies
        });
        
        if (!response.ok) {
          throw new Error('Failed to fetch conversation');
        }
        
        const data = await response.json();
        
        // Format the data to match our ConversationData interface
        const formattedConversation: ConversationData = {
          id: data.id,
          title: data.title,
          type: data.type,
          privacy: data.privacy,
          manuscript: data.manuscript ? {
            title: data.manuscript.title,
            authors: data.manuscript.authors
          } : null,
          messages: data.messages || []
        };
        
        setConversation(formattedConversation);
        setError(null);
      } catch (err) {
        setError('Failed to load conversation');
        console.error('Error fetching conversation:', err);
      } finally {
        setLoading(false);
      }
    };

    if (conversationId) {
      fetchConversation();
    }
  }, [conversationId]);

  const handlePostMessage = async (content: string, parentId?: string, privacy?: string) => {
    if (!conversation) return;

    try {
      console.log('Posting message:', { content, parentId, privacy }); // Debug log
      
      const response = await fetch(`http://localhost:4000/api/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include', // Include auth cookies
        body: JSON.stringify({
          content,
          parentId,
          privacy
        })
      });

      console.log('Response status:', response.status); // Debug log

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('API Error:', errorData); // Debug log
        throw new Error(errorData.message || 'Failed to post message');
      }

      const result = await response.json();
      console.log('Message posted successfully:', result); // Debug log
      
      // Add user message immediately to local state for instant feedback
      // Bot responses will still come via SSE
      if (result.data && !result.data.isBot) {
        setConversation(prev => {
          if (!prev) return prev;
          
          // Check if message already exists (avoid duplicates)
          const messageExists = prev.messages.some(msg => msg.id === result.data.id);
          if (messageExists) return prev;

          return {
            ...prev,
            messages: [...prev.messages, result.data]
          };
        });
      }
    } catch (err) {
      console.error('Error posting message:', err);
      // Could show a toast notification here
    }
  };

  const handleEditMessage = async (messageId: string, content: string, reason?: string) => {
    if (!conversation) return;

    try {
      console.log('Editing message:', { messageId, content, reason }); // Debug log
      
      const response = await fetch(`http://localhost:4000/api/messages/${messageId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          content,
          reason
        })
      });

      console.log('Edit response status:', response.status); // Debug log

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Edit API Error:', errorData); // Debug log
        throw new Error(errorData.error?.message || 'Failed to edit message');
      }

      const result = await response.json();
      console.log('Message edited successfully:', result); // Debug log
      
      // Update the message in local state
      if (result.data) {
        setConversation(prev => {
          if (!prev) return prev;
          
          return {
            ...prev,
            messages: prev.messages.map(msg => 
              msg.id === messageId 
                ? { ...msg, content, editedAt: result.data.editedAt }
                : msg
            )
          };
        });
      }
    } catch (err) {
      console.error('Error editing message:', err);
      // Could show a toast notification here
    }
  };

  if (loading) {
    return (
      <Paper shadow="sm" p="xl" radius="md">
        <Stack align="center" gap="md">
          <Loader size="lg" />
          <Text>Loading conversation...</Text>
        </Stack>
      </Paper>
    );
  }

  if (error || !conversation) {
    return (
      <Alert icon={<IconAlertCircle size={16} />} color="red">
        {error || 'Conversation not found'}
      </Alert>
    );
  }


  return (
    <Stack gap="lg">
      {/* SSE Connection Status Indicator */}
      <Group justify="flex-end" gap="xs">
        <Text size="xs" c="dimmed">
          Real-time: 
        </Text>
        {connectionStatus === 'connected' ? (
          <Badge color="green" size="sm" variant="light">
            <IconWifi size={12} style={{ marginRight: 4 }} />
            Connected
          </Badge>
        ) : connectionStatus === 'connecting' ? (
          <Badge color="yellow" size="sm" variant="light">
            <IconLoader size={12} style={{ marginRight: 4 }} />
            Connecting...
          </Badge>
        ) : (
          <Badge color="red" size="sm" variant="light">
            <IconWifiOff size={12} style={{ marginRight: 4 }} />
            Disconnected
          </Badge>
        )}
      </Group>

      {/* Message Thread */}
      <MessageThread 
        messages={conversation.messages}
        onReply={(messageId, content) => handlePostMessage(content, messageId)}
        onEdit={handleEditMessage}
        conversationId={conversationId}
      />

      {/* Message Composer */}
      <MessageComposer 
        onSubmit={(content, privacy) => handlePostMessage(content, undefined, privacy)}
        placeholder="Write your message... Use @bot-name to mention bots"
      />
    </Stack>
  );
}