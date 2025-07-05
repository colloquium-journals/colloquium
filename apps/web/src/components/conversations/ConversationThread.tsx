'use client';

import { useState, useEffect, useCallback } from 'react';
import { Stack, Paper, Title, Text, Badge, Group, Loader, Alert } from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import { MessageThread } from './MessageThread';
import { useSSE } from '../../hooks/useSSE';

// Mock data types (will be replaced with real API calls)
interface ConversationData {
  id: string;
  title: string;
  manuscript: {
    id: string;
    title: string;
    authors: string[];
    status: string;
  } | null;
  messages: MessageData[];
  totalMessageCount?: number;
  visibleMessageCount?: number;
  messageVisibilityMap?: Array<{
    id: string;
    visible: boolean;
    createdAt: string;
  }>;
  participants?: Array<{
    id: string;
    role: string;
    user: {
      id: string;
      name: string;
      email: string;
      role: string;
    };
  }>;
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

  // Debug logging for conversation state changes
  useEffect(() => {
    console.log('🎪 ConversationThread: Conversation state updated');
    console.log('🎪 ConversationThread: Message count:', conversation?.messages?.length || 0);
    console.log('🎪 ConversationThread: Message IDs:', conversation?.messages?.map(m => m.id) || []);
  }, [conversation]);

  // Handle real-time messages
  const handleNewMessage = useCallback((newMessage: MessageData) => {
    console.log('🎯 ConversationThread: ===== NEW MESSAGE HANDLER CALLED =====');
    console.log('🎯 ConversationThread: Received new message via SSE:', newMessage);
    console.log('🎯 ConversationThread: Message details:', {
      id: newMessage.id,
      content: newMessage.content,
      author: newMessage.author,
      createdAt: newMessage.createdAt,
      privacy: newMessage.privacy
    });
    
    setConversation(prev => {
      console.log('🎯 ConversationThread: Current conversation state:', prev ? 'exists' : 'null');
      console.log('🎯 ConversationThread: Current messages count:', prev?.messages?.length || 0);
      
      if (!prev) {
        console.log('🎯 ConversationThread: No conversation state, skipping message');
        return prev;
      }
      
      // Check if message already exists (avoid duplicates)
      const messageExists = prev.messages.some(msg => msg.id === newMessage.id);
      console.log('🎯 ConversationThread: Message exists check:', messageExists);
      console.log('🎯 ConversationThread: Existing message IDs:', prev.messages.map(m => m.id));
      
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
      console.log('🎯 ConversationThread: ===== MESSAGE HANDLER COMPLETE =====');
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
          manuscript: data.manuscript,
          messages: data.messages || [],
          totalMessageCount: data.totalMessageCount,
          visibleMessageCount: data.visibleMessageCount,
          messageVisibilityMap: data.messageVisibilityMap,
          participants: data.participants
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

      {/* Message Thread */}
      <MessageThread 
        messages={conversation.messages}
        onReply={(messageId, content) => handlePostMessage(content, messageId)}
        onEdit={handleEditMessage}
        onSubmit={(content, privacy) => handlePostMessage(content, undefined, privacy)}
        conversationId={conversationId}
        totalMessageCount={conversation.totalMessageCount}
        visibleMessageCount={conversation.visibleMessageCount}
        messageVisibilityMap={conversation.messageVisibilityMap}
      />
    </Stack>
  );
}