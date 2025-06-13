import React from 'react';
import { Card, Group, Text, ActionIcon, Menu, Badge } from '@mantine/core';
import { IconDots, IconArrowBack, IconFlag } from '@tabler/icons-react';
import { UserAvatar } from './UserAvatar';

export interface ConversationMessageProps {
  message: {
    id: string;
    content: string;
    author: { name?: string; email: string };
    createdAt: Date;
    isBot: boolean;
  };
  onReply?: (messageId: string) => void;
  onReport?: (messageId: string) => void;
}

export const ConversationMessage: React.FC<ConversationMessageProps> = ({ 
  message, 
  onReply,
  onReport
}) => {
  return (
    <Card>
      <Group justify="space-between" align="flex-start" mb="sm">
        <Group>
          <UserAvatar 
            name={message.author.name}
            email={message.author.email}
            size="sm" 
            color={message.isBot ? 'blue' : 'gray'}
          />
          <div>
            <Text size="sm" fw={500}>
              {message.author.name || message.author.email}
              {message.isBot && <Badge size="xs" ml="xs">Bot</Badge>}
            </Text>
            <Text size="xs" c="dimmed">
              {message.createdAt.toLocaleString()}
            </Text>
          </div>
        </Group>

        <Menu shadow="md" width={150}>
          <Menu.Target>
            <ActionIcon variant="subtle" size="sm">
              <IconDots size={14} />
            </ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item 
              leftSection={<IconArrowBack size={14} />}
              onClick={() => onReply?.(message.id)}
            >
              Reply
            </Menu.Item>
            <Menu.Item 
              leftSection={<IconFlag size={14} />}
              onClick={() => onReport?.(message.id)}
            >
              Report
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </Group>

      <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
        {message.content}
      </Text>
    </Card>
  );
};