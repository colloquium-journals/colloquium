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
  Stack,
  Tooltip,
  Divider
} from '@mantine/core';
import { 
  IconDots, 
  IconArrowBack, 
  IconFlag, 
  IconCheck, 
  IconX, 
  IconEye, 
  IconLock, 
  IconUsers, 
  IconShield,
  IconInfoCircle
} from '@tabler/icons-react';
import { MessageContent } from './MessageContent';

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
}

interface MessageCardProps {
  message: MessageData;
  onReply: (content: string) => void;
  isReply?: boolean;
  conversationId: string;
}

export function MessageCard({ message, onReply, isReply = false, conversationId }: MessageCardProps) {
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

  const getVisibilityInfo = (privacy: string) => {
    switch (privacy) {
      case 'PUBLIC':
        return {
          icon: IconEye,
          label: 'Public',
          description: 'Visible to everyone',
          color: 'green',
          audience: ['Authors', 'Reviewers', 'Editors', 'Admins', 'Public']
        };
      case 'AUTHOR_VISIBLE':
        return {
          icon: IconUsers,
          label: 'Authors & Reviewers',
          description: 'Visible to authors, reviewers, editors, and admins',
          color: 'blue',
          audience: ['Authors', 'Reviewers', 'Editors', 'Admins']
        };
      case 'REVIEWER_ONLY':
        return {
          icon: IconShield,
          label: 'Reviewers Only',
          description: 'Only visible to reviewers, editors, and admins',
          color: 'orange',
          audience: ['Reviewers', 'Editors', 'Admins']
        };
      case 'EDITOR_ONLY':
        return {
          icon: IconLock,
          label: 'Editors Only',
          description: 'Only visible to editors and admins',
          color: 'red',
          audience: ['Editors', 'Admins']
        };
      case 'ADMIN_ONLY':
        return {
          icon: IconLock,
          label: 'Admins Only',
          description: 'Only visible to admins',
          color: 'red',
          audience: ['Admins']
        };
      default:
        return {
          icon: IconEye,
          label: 'Unknown',
          description: 'Visibility level unknown',
          color: 'gray',
          audience: ['Unknown']
        };
    }
  };

  const visibilityInfo = getVisibilityInfo(message.privacy);

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
              {message.isBot ? '🤖' : getInitials(message.author.name)}
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
                <Tooltip 
                  label={
                    <Stack gap="xs">
                      <Text size="sm" fw={500}>{visibilityInfo.description}</Text>
                      <Divider />
                      <Text size="xs" fw={500}>Visible to:</Text>
                      {visibilityInfo.audience.map((role, index) => (
                        <Text key={index} size="xs">• {role}</Text>
                      ))}
                    </Stack>
                  }
                  multiline
                  width={200}
                  withArrow
                >
                  <Badge 
                    size="xs" 
                    variant="light" 
                    color={visibilityInfo.color}
                    leftSection={<visibilityInfo.icon size={10} />}
                  >
                    {visibilityInfo.label}
                  </Badge>
                </Tooltip>
              </Group>
              <Group gap="xs" align="center">
                <Text size="xs" c="dimmed">
                  {formatTimestamp(message.createdAt)}
                </Text>
                <ActionIcon 
                  variant="subtle" 
                  size="xs"
                  color={visibilityInfo.color}
                >
                  <Tooltip label={`${visibilityInfo.description}. Click for details.`}>
                    <IconInfoCircle size={12} />
                  </Tooltip>
                </ActionIcon>
              </Group>
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
        <MessageContent 
          content={message.content}
          conversationId={conversationId}
          size="sm"
        />

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