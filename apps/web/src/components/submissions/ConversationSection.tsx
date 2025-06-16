'use client';

import { 
  Paper, 
  Title, 
  Text, 
  Group, 
  Badge, 
  Stack,
  Divider,
  Box,
  ActionIcon,
  Tooltip
} from '@mantine/core';
import { 
  IconMessageCircle, 
  IconUsers, 
  IconShield,
  IconEye,
  IconChevronDown,
  IconChevronUp
} from '@tabler/icons-react';
import { useState } from 'react';
import { ConversationThread } from '../conversations/ConversationThread';
import { VisibilityLegend } from '../conversations/VisibilityLegend';

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
  const [isExpanded, setIsExpanded] = useState(true);

  if (variant === 'compact') {
    return (
      <Paper shadow="sm" radius="lg" style={{ overflow: 'hidden' }}>
        <Box p="lg" style={{ backgroundColor: 'var(--mantine-color-gray-0)' }}>
          <Group justify="space-between" align="center">
            <Group gap="sm">
              <IconMessageCircle size={20} color="var(--mantine-color-blue-6)" />
              <Box>
                <Text fw={600} size="sm">{title}</Text>
                <Text size="xs" c="dimmed">{description}</Text>
              </Box>
            </Group>
            
            <Group gap="xs">
              <VisibilityLegend variant="compact" />
              <Tooltip label={isExpanded ? "Collapse" : "Expand"}>
                <ActionIcon 
                  variant="light" 
                  size="sm"
                  onClick={() => setIsExpanded(!isExpanded)}
                >
                  {isExpanded ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
                </ActionIcon>
              </Tooltip>
            </Group>
          </Group>
        </Box>

        {isExpanded && (
          <Box p="lg" pt="md">
            <ConversationThread conversationId={conversationId} />
          </Box>
        )}
      </Paper>
    );
  }

  return (
    <Box>
      {/* Section Header */}
      <Paper shadow="sm" p="lg" radius="lg" mb="md" style={{ 
        backgroundColor: 'var(--mantine-color-gray-0)',
        borderLeft: '4px solid var(--mantine-color-blue-5)'
      }}>
        <Group justify="space-between" align="flex-start">
          <Group gap="md" align="flex-start">
            <Box 
              p="sm" 
              style={{ 
                backgroundColor: 'var(--mantine-color-blue-1)', 
                borderRadius: 'var(--mantine-radius-md)',
                border: '1px solid var(--mantine-color-blue-3)'
              }}
            >
              <IconMessageCircle size={24} color="var(--mantine-color-blue-6)" />
            </Box>
            
            <Box>
              <Title order={3} size="h4" mb="xs">
                {title}
              </Title>
              <Text size="sm" c="dimmed" mb="md">
                {description}
              </Text>
              
              <Group gap="xs">
                <Badge size="sm" variant="filled" color="blue" leftSection={<IconMessageCircle size={12} />}>
                  @editorial-bot
                </Badge>
                <Badge size="sm" variant="filled" color="purple" leftSection={<IconShield size={12} />}>
                  @plagiarism-bot
                </Badge>
                <Badge size="sm" variant="filled" color="teal" leftSection={<IconUsers size={12} />}>
                  @statistics-bot
                </Badge>
              </Group>
            </Box>
          </Group>

          <Group gap="xs">
            <Tooltip label={isExpanded ? "Collapse discussion" : "Expand discussion"}>
              <ActionIcon 
                variant="light" 
                size="lg"
                onClick={() => setIsExpanded(!isExpanded)}
              >
                {isExpanded ? <IconChevronUp size={18} /> : <IconChevronDown size={18} />}
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>
      </Paper>

      {/* Bot Interaction Guide & Visibility Legend */}
      {isExpanded && (
        <>
          <Paper shadow="xs" p="md" radius="lg" mb="md" style={{ backgroundColor: 'var(--mantine-color-blue-0)', border: '1px solid var(--mantine-color-blue-3)' }}>
            <Group gap="sm" mb="sm">
              <IconMessageCircle size={16} color="var(--mantine-color-blue-6)" />
              <Text fw={600} size="sm" c="blue">Bot Interaction Guide</Text>
            </Group>
            <Text size="sm" c="dimmed" mb="xs">
              Interact with bots using @ mentions in your messages:
            </Text>
            <Group gap="lg">
              <Text size="xs" c="dimmed">• <strong>@editorial-bot help</strong> - Get assistance with submission process</Text>
              <Text size="xs" c="dimmed">• <strong>@plagiarism-bot check</strong> - Request plagiarism analysis</Text>
              <Text size="xs" c="dimmed">• <strong>@statistics-bot review</strong> - Statistical methodology review</Text>
            </Group>
          </Paper>
          
          <Paper shadow="xs" p="md" radius="lg" mb="lg" style={{ backgroundColor: 'var(--mantine-color-gray-0)' }}>
            <VisibilityLegend />
          </Paper>
        </>
      )}

      {/* Conversation Thread */}
      {isExpanded && (
        <Paper shadow="sm" radius="lg" style={{ overflow: 'hidden' }}>
          <Box p="lg">
            <ConversationThread conversationId={conversationId} />
          </Box>
        </Paper>
      )}
    </Box>
  );
}