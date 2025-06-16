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
      
      // Note: We don't add the message to local state here anymore
      // The message will be received via WebSocket and added through handleNewMessage
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
      {/* Conversation Header */}
      <Paper shadow="sm" p="lg" radius="md">
        <Stack gap="md">
          <Group justify="space-between" align="flex-start">
            <div>
              <Title order={3} mb="xs">
                {conversation.title}
              </Title>
              <Text size="sm" c="dimmed" mb="md">
                Manuscript: {conversation.manuscript.title}
              </Text>
              <Text size="sm" c="dimmed">
                Authors: {conversation.manuscript.authors.join(', ')}
              </Text>
            </div>
            <Group gap="xs">
              <Badge color={getTypeColor(conversation.type)} variant="light">
                {conversation.type}
              </Badge>
              <Badge color={getPrivacyColor(conversation.privacy)} variant="light">
                {conversation.privacy}
              </Badge>
              <Badge 
                color={
                  connectionStatus === 'connected' ? 'green' : 
                  connectionStatus === 'connecting' ? 'yellow' : 
                  connectionStatus === 'error' ? 'red' : 'gray'
                } 
                variant="light"
                leftSection={
                  connectionStatus === 'connected' ? <IconWifi size={12} /> :
                  connectionStatus === 'connecting' ? <IconLoader size={12} /> :
                  <IconWifiOff size={12} />
                }
              >
                {connectionStatus === 'connected' ? 'Live' : 
                 connectionStatus === 'connecting' ? 'Connecting' : 
                 connectionStatus === 'error' ? 'Error' : 'Offline'}
              </Badge>
            </Group>
          </Group>
        </Stack>
      </Paper>

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