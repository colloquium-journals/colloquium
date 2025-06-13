'use client';

import { useState } from 'react';
import { 
  Card, 
  Title, 
  Stack, 
  Group, 
  Text, 
  Badge, 
  Avatar, 
  Button,
  Anchor,
  Divider,
  ActionIcon,
  Tooltip
} from '@mantine/core';
import { 
  IconMessage, 
  IconClock, 
  IconUsers, 
  IconRobot,
  IconArrowRight
} from '@tabler/icons-react';
import Link from 'next/link';

interface Conversation {
  id: string;
  title: string;
  type: 'EDITORIAL' | 'REVIEW' | 'PUBLIC';
  privacy: 'PRIVATE' | 'SEMI_PUBLIC' | 'PUBLIC';
  manuscript: {
    title: string;
    id: string;
  };
  lastMessage: {
    content: string;
    author: string;
    createdAt: string;
    isBot: boolean;
  };
  participantCount: number;
  unreadCount: number;
}

export function ActiveConversations() {
  // Mock data - will be replaced with real API data
  const [conversations] = useState<Conversation[]>([
    {
      id: '1',
      title: 'Editorial Review Discussion',
      type: 'EDITORIAL',
      privacy: 'PRIVATE',
      manuscript: {
        title: 'A Novel Approach to Academic Publishing',
        id: '1'
      },
      lastMessage: {
        content: 'The methodology section needs more detail on the data collection process.',
        author: 'Dr. Jane Smith',
        createdAt: '2024-01-22T14:30:00Z',
        isBot: false
      },
      participantCount: 4,
      unreadCount: 2
    },
    {
      id: '2',
      title: 'Peer Review - Methodology',
      type: 'REVIEW',
      privacy: 'SEMI_PUBLIC',
      manuscript: {
        title: 'Machine Learning Applications in Scientific Publishing',
        id: '2'
      },
      lastMessage: {
        content: 'Statistical analysis completed. No significant issues found in the methodology.',
        author: 'Statistics Reviewer',
        createdAt: '2024-01-22T13:15:00Z',
        isBot: true
      },
      participantCount: 3,
      unreadCount: 0
    },
    {
      id: '3',
      title: 'Public Discussion',
      type: 'PUBLIC',
      privacy: 'PUBLIC',
      manuscript: {
        title: 'Decentralized Peer Review: A Blockchain Approach',
        id: '3'
      },
      lastMessage: {
        content: 'This is an interesting approach to solving the centralization problem in academic publishing.',
        author: 'Community Member',
        createdAt: '2024-01-22T12:45:00Z',
        isBot: false
      },
      participantCount: 12,
      unreadCount: 5
    },
    {
      id: '4',
      title: 'Revision Discussion',
      type: 'EDITORIAL',
      privacy: 'PRIVATE',
      manuscript: {
        title: 'Open Science and Collaborative Research Platforms',
        id: '4'
      },
      lastMessage: {
        content: 'All requested revisions have been addressed. Ready for final review.',
        author: 'Dr. Emily Davis',
        createdAt: '2024-01-22T11:20:00Z',
        isBot: false
      },
      participantCount: 5,
      unreadCount: 1
    }
  ]);

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

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor(diffMs / (1000 * 60));

    if (diffMinutes < 60) {
      return `${diffMinutes}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else {
      const diffDays = Math.floor(diffHours / 24);
      return `${diffDays}d ago`;
    }
  };

  const truncateMessage = (content: string, maxLength: number = 80) => {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + '...';
  };

  return (
    <Card shadow="sm" padding="lg" radius="md">
      <Stack gap="md">
        <Group justify="space-between" align="center">
          <Title order={3}>Active Conversations</Title>
          <Button size="xs" variant="light" component={Link} href="/conversations">
            View All
          </Button>
        </Group>

        <Stack gap="sm">
          {conversations.map((conversation, index) => (
            <div key={conversation.id}>
              <Group justify="space-between" align="flex-start" wrap="nowrap">
                <Stack gap="xs" style={{ flex: 1, minWidth: 0 }}>
                  {/* Conversation Header */}
                  <Group justify="space-between" align="flex-start">
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Group gap="xs" mb="xs">
                        <Anchor
                          component={Link}
                          href={`/conversations/${conversation.id}`}
                          size="sm"
                          fw={500}
                          lineClamp={1}
                        >
                          {conversation.title}
                        </Anchor>
                        {conversation.unreadCount > 0 && (
                          <Badge size="xs" color="red" variant="filled">
                            {conversation.unreadCount}
                          </Badge>
                        )}
                      </Group>
                      
                      <Text size="xs" c="dimmed" lineClamp={1}>
                        {conversation.manuscript.title}
                      </Text>
                    </div>

                    <Group gap="xs" style={{ flexShrink: 0 }}>
                      <Badge color={getTypeColor(conversation.type)} variant="light" size="xs">
                        {conversation.type}
                      </Badge>
                      <Badge color={getPrivacyColor(conversation.privacy)} variant="dot" size="xs">
                        {conversation.privacy}
                      </Badge>
                    </Group>
                  </Group>

                  {/* Last Message */}
                  <Group gap="xs" align="flex-start">
                    <Avatar size="xs" color={conversation.lastMessage.isBot ? 'blue' : 'gray'}>
                      {conversation.lastMessage.isBot ? (
                        <IconRobot size={12} />
                      ) : (
                        conversation.lastMessage.author.charAt(0)
                      )}
                    </Avatar>
                    <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
                      <Group gap="xs" align="center">
                        <Text size="xs" fw={500} lineClamp={1}>
                          {conversation.lastMessage.author}
                        </Text>
                        {conversation.lastMessage.isBot && (
                          <Badge size="xs" variant="light" color="blue">
                            Bot
                          </Badge>
                        )}
                        <Group gap={4} style={{ flexShrink: 0 }}>
                          <IconClock size={10} />
                          <Text size="xs" c="dimmed">
                            {formatTimeAgo(conversation.lastMessage.createdAt)}
                          </Text>
                        </Group>
                      </Group>
                      <Text size="xs" c="dimmed" lineClamp={1}>
                        {truncateMessage(conversation.lastMessage.content)}
                      </Text>
                    </Stack>
                  </Group>

                  {/* Conversation Stats */}
                  <Group gap="md" mt="xs">
                    <Group gap={4}>
                      <IconUsers size={12} />
                      <Text size="xs" c="dimmed">
                        {conversation.participantCount} participants
                      </Text>
                    </Group>
                  </Group>
                </Stack>

                <Tooltip label="View conversation">
                  <ActionIcon
                    variant="subtle"
                    size="sm"
                    component={Link}
                    href={`/conversations/${conversation.id}`}
                    style={{ flexShrink: 0 }}
                  >
                    <IconArrowRight size={14} />
                  </ActionIcon>
                </Tooltip>
              </Group>
              
              {index < conversations.length - 1 && <Divider my="sm" />}
            </div>
          ))}
        </Stack>
      </Stack>
    </Card>
  );
}