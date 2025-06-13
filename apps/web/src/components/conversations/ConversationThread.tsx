'use client';

import { useState, useEffect } from 'react';
import { Stack, Paper, Title, Text, Badge, Group, Loader, Alert } from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import { MessageThread } from './MessageThread';
import { MessageComposer } from './MessageComposer';

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

  // Mock data - will be replaced with API call
  useEffect(() => {
    const fetchConversation = async () => {
      try {
        setLoading(true);
        
        // Simulate API call delay
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Mock conversation data based on our seeded data
        const mockConversation: ConversationData = {
          id: conversationId,
          title: 'Editorial Review Discussion',
          type: 'EDITORIAL',
          privacy: 'PRIVATE',
          manuscript: {
            title: 'A Novel Approach to Academic Publishing: The Colloquium Platform',
            authors: ['Sample Author']
          },
          messages: [
            {
              id: '1',
              content: 'This manuscript looks promising. The approach to conversational review is novel and could have significant impact on academic publishing. I recommend sending it out for peer review.',
              author: {
                name: 'Editor User',
                email: 'editor@colloquium.example.com'
              },
              createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
              isBot: false
            },
            {
              id: '2',
              content: 'I agree. The technical implementation seems sound and the use case is compelling. Let\'s assign reviewers from our network.',
              author: {
                name: 'Admin User',
                email: 'admin@colloquium.example.com'
              },
              createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(), // 1 hour ago
              isBot: false
            },
            {
              id: '3',
              content: `Plagiarism check completed for manuscript.

**Results:**
- Potential matches found: 0
- Databases checked: crossref, pubmed
- Similarity threshold: 15.0%
- Confidence level: 95.0%

✅ No significant plagiarism detected.`,
              author: {
                name: 'Plagiarism Checker',
                email: 'bot@colloquium.example.com'
              },
              createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30 minutes ago
              isBot: true
            }
          ]
        };
        
        setConversation(mockConversation);
      } catch (err) {
        setError('Failed to load conversation');
      } finally {
        setLoading(false);
      }
    };

    if (conversationId) {
      fetchConversation();
    }
  }, [conversationId]);

  const handleNewMessage = (content: string, parentId?: string) => {
    if (!conversation) return;

    const newMessage: MessageData = {
      id: Date.now().toString(),
      content,
      author: {
        name: 'Current User', // Will be replaced with actual user data
        email: 'user@example.com'
      },
      createdAt: new Date().toISOString(),
      isBot: false,
      parentId
    };

    setConversation(prev => prev ? {
      ...prev,
      messages: [...prev.messages, newMessage]
    } : null);
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
            </Group>
          </Group>
        </Stack>
      </Paper>

      {/* Message Thread */}
      <MessageThread 
        messages={conversation.messages}
        onReply={(messageId, content) => handleNewMessage(content, messageId)}
      />

      {/* Message Composer */}
      <MessageComposer 
        onSubmit={(content) => handleNewMessage(content)}
        placeholder="Write your message... Use @bot-name to mention bots"
      />
    </Stack>
  );
}