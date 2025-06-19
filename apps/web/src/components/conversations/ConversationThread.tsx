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
  };
  messages: MessageData[];
}

interface MessageData {
  id: string;
  content: string;
  privacy: string;
  author: {
    name: string;
    email: string;
    role?: string;
    affiliation?: string;
    orcid?: string;
    joinedAt?: string;
    bio?: string;
  };
  createdAt: string;
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
    setConversation(prev => {
      if (!prev) return prev;
      
      // Check if message already exists (avoid duplicates)
      const messageExists = prev.messages.some(msg => msg.id === newMessage.id);
      if (messageExists) return prev;

      return {
        ...prev,
        messages: [...prev.messages, newMessage]
      };
    });
  }, []);

  // Initialize SSE connection
  const { isConnected, connectionStatus } = useSSE(conversationId, {
    enabled: !!conversationId,
    onNewMessage: handleNewMessage
  });

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
          manuscript: {
            title: data.manuscript.title,
            authors: data.manuscript.authors
          },
          messages: data.messages
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
      
      // TEMPORARY FIX: Add message immediately to local state while debugging SSE
      if (result.data) {
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
      
      // Note: The message should also be received via SSE and added through handleNewMessage
      // If you see duplicate messages, the SSE is working and this fix can be removed
    } catch (err) {
      console.error('Error posting message:', err);
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

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'EDITORIAL': return 'blue';
      case 'REVIEW': return 'orange';
      case 'PUBLIC': return 'green';
      default: return 'gray';
    }
  };

  const getPrivacyColor = (privacy: string) => {
    switch (privacy) {
      case 'PRIVATE': return 'red';
      case 'SEMI_PUBLIC': return 'yellow';
      case 'PUBLIC': return 'green';
      default: return 'gray';
    }
  };

  return (
    <Stack gap="lg">
      {/* Message Thread */}
      <MessageThread 
        messages={conversation.messages}
        onReply={(messageId, content) => handlePostMessage(content, messageId)}
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