'use client';

import { useState } from 'react';
import { 
  Card, 
  Group, 
  Text, 
  Avatar, 
  ActionIcon, 
  Menu, 
  Badge, 
  Button,
  Collapse,
  Textarea,
  Stack
} from '@mantine/core';
import { IconDots, IconArrowBack, IconFlag, IconCheck, IconX } from '@tabler/icons-react';

interface MessageData {
  id: string;
  content: string;
  author: {
    name: string;
    email: string;
  };
  createdAt: string;
  isBot: boolean;
}

interface MessageCardProps {
  message: MessageData;
  onReply: (content: string) => void;
  isReply?: boolean;
}

export function MessageCard({ message, onReply, isReply = false }: MessageCardProps) {
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [replyContent, setReplyContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleReply = async () => {
    if (!replyContent.trim()) return;
    
    setIsSubmitting(true);
    try {
      await onReply(replyContent);
      setReplyContent('');
      setShowReplyForm(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor(diffMs / (1000 * 60));

    if (diffMinutes < 60) {
      return `${diffMinutes} minutes ago`;
    } else if (diffHours < 24) {
      return `${diffHours} hours ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  return (
    <Card 
      shadow="sm" 
      padding="lg" 
      radius="md" 
      style={{ 
        borderLeft: isReply ? '3px solid var(--mantine-color-blue-3)' : undefined,
        backgroundColor: isReply ? 'var(--mantine-color-gray-0)' : undefined
      }}
    >
      <Stack gap="sm">
        {/* Message Header */}
        <Group justify="space-between" align="flex-start">
          <Group gap="sm">
            <Avatar 
              size="md" 
              color={message.isBot ? 'blue' : 'gray'}
              radius="xl"
            >
              {getInitials(message.author.name)}
            </Avatar>
            <div>
              <Group gap="xs" align="center">
                <Text size="sm" fw={500}>
                  {message.author.name}
                </Text>
                {message.isBot && (
                  <Badge size="xs" variant="light" color="blue">
                    Bot
                  </Badge>
                )}
              </Group>
              <Text size="xs" c="dimmed">
                {formatTimestamp(message.createdAt)}
              </Text>
            </div>
          </Group>

          <Menu shadow="md" width={150} position="bottom-end">
            <Menu.Target>
              <ActionIcon variant="subtle" size="sm">
                <IconDots size={14} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item 
                leftSection={<IconArrowBack size={14} />}
                onClick={() => setShowReplyForm(!showReplyForm)}
              >
                Reply
              </Menu.Item>
              <Menu.Item 
                leftSection={<IconFlag size={14} />}
                color="red"
              >
                Report
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>

        {/* Message Content */}
        <Text 
          size="sm" 
          style={{ 
            whiteSpace: 'pre-wrap',
            lineHeight: 1.6
          }}
        >
          {message.content}
        </Text>

        {/* Reply Form */}
        <Collapse in={showReplyForm}>
          <Stack gap="sm" mt="md" p="sm" style={{ backgroundColor: 'var(--mantine-color-gray-1)', borderRadius: '8px' }}>
            <Text size="sm" fw={500} c="dimmed">
              Reply to {message.author.name}
            </Text>
            <Textarea
              placeholder="Write your reply..."
              value={replyContent}
              onChange={(e) => setReplyContent(e.target.value)}
              minRows={3}
              autosize
            />
            <Group justify="flex-end" gap="xs">
              <Button
                variant="subtle"
                size="xs"
                leftSection={<IconX size={14} />}
                onClick={() => {
                  setShowReplyForm(false);
                  setReplyContent('');
                }}
              >
                Cancel
              </Button>
              <Button
                size="xs"
                leftSection={<IconCheck size={14} />}
                onClick={handleReply}
                loading={isSubmitting}
                disabled={!replyContent.trim()}
              >
                Reply
              </Button>
            </Group>
          </Stack>
        </Collapse>
      </Stack>
    </Card>
  );
}