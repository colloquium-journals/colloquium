'use client';

import {
  Title,
  Text,
  Group,
  Badge,
  Stack,
  Divider,
  Box,
  useComputedColorScheme
} from '@mantine/core';
import { 
  IconMessageCircle, 
  IconUsers, 
  IconShield
} from '@tabler/icons-react';
import { ConversationThread } from '../conversations/ConversationThread';

interface ConversationSectionProps {
  conversationId: string;
  title?: string;
  description?: string;
  variant?: 'default' | 'compact';
}

export function ConversationSection({ 
  conversationId, 
  title = "Discussion Thread",
  description = "Manuscript review and discussion",
  variant = 'default'
}: ConversationSectionProps) {
  const colorScheme = useComputedColorScheme('light');
  const dark = colorScheme === 'dark';

  if (variant === 'compact') {
    return (
      <Box style={{ border: `1px solid ${dark ? 'var(--mantine-color-dark-4)' : 'var(--mantine-color-gray-3)'}`, borderRadius: 'var(--mantine-radius-md)' }}>
        <Box p="lg" style={{ backgroundColor: dark ? 'var(--mantine-color-dark-6)' : 'var(--mantine-color-gray-0)', borderTopLeftRadius: 'var(--mantine-radius-md)', borderTopRightRadius: 'var(--mantine-radius-md)' }}>
          <Group gap="sm">
            <IconMessageCircle size={20} color="var(--mantine-color-blue-6)" />
            <Box>
              <Text fw={600} size="sm">{title}</Text>
              <Text size="xs" c="dimmed">{description}</Text>
            </Box>
          </Group>
        </Box>

        <Box p="lg" pt="md">
          <ConversationThread conversationId={conversationId} />
        </Box>
      </Box>
    );
  }

  return (
    <Box>
      <ConversationThread conversationId={conversationId} />
    </Box>
  );
}