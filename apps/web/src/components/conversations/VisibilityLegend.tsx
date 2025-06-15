'use client';

import { 
  Card, 
  Title, 
  Stack, 
  Group, 
  Badge, 
  Text,
  Collapse,
  Button
} from '@mantine/core';
import { 
  IconEye, 
  IconLock, 
  IconUsers, 
  IconShield,
  IconChevronDown,
  IconChevronUp,
  IconInfoCircle
} from '@tabler/icons-react';
import { useState } from 'react';

interface VisibilityLevel {
  privacy: string;
  icon: React.ComponentType<{ size?: number }>;
  label: string;
  description: string;
  color: string;
  audience: string[];
}

const visibilityLevels: VisibilityLevel[] = [
  {
    privacy: 'PUBLIC',
    icon: IconEye,
    label: 'Public',
    description: 'Visible to everyone including the public',
    color: 'green',
    audience: ['Authors', 'Reviewers', 'Editors', 'Admins', 'Public']
  },
  {
    privacy: 'AUTHOR_VISIBLE',
    icon: IconUsers,
    label: 'Authors & Reviewers',
    description: 'Visible to manuscript authors, reviewers, editors, and admins',
    color: 'blue',
    audience: ['Authors', 'Reviewers', 'Editors', 'Admins']
  },
  {
    privacy: 'REVIEWER_ONLY',
    icon: IconShield,
    label: 'Reviewers Only',
    description: 'Only visible to reviewers, editors, and admins',
    color: 'orange',
    audience: ['Reviewers', 'Editors', 'Admins']
  },
  {
    privacy: 'EDITOR_ONLY',
    icon: IconLock,
    label: 'Editors Only',
    description: 'Only visible to editors and admins',
    color: 'red',
    audience: ['Editors', 'Admins']
  },
  {
    privacy: 'ADMIN_ONLY',
    icon: IconLock,
    label: 'Admins Only',
    description: 'Only visible to admins',
    color: 'red',
    audience: ['Admins']
  }
];

interface VisibilityLegendProps {
  variant?: 'full' | 'compact';
  showTitle?: boolean;
}

export function VisibilityLegend({ variant = 'full', showTitle = true }: VisibilityLegendProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (variant === 'compact') {
    return (
      <Card shadow="xs" padding="sm" radius="md" withBorder>
        <Stack gap="xs">
          <Group justify="space-between" align="center">
            <Group gap="xs">
              <IconInfoCircle size={16} color="blue" />
              <Text size="sm" fw={500}>Message Visibility</Text>
            </Group>
            <Button
              variant="subtle"
              size="xs"
              rightSection={isExpanded ? <IconChevronUp size={12} /> : <IconChevronDown size={12} />}
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? 'Hide' : 'Show'}
            </Button>
          </Group>
          
          <Collapse in={isExpanded}>
            <Stack gap="xs" mt="xs">
              {visibilityLevels.map((level) => (
                <Group key={level.privacy} gap="xs" align="center">
                  <Badge 
                    size="xs" 
                    variant="light" 
                    color={level.color}
                    leftSection={<level.icon size={10} />}
                  >
                    {level.label}
                  </Badge>
                  <Text size="xs" c="dimmed">
                    {level.description}
                  </Text>
                </Group>
              ))}
            </Stack>
          </Collapse>
        </Stack>
      </Card>
    );
  }

  return (
    <Card shadow="sm" padding="lg" radius="md">
      <Stack gap="md">
        {showTitle && (
          <Group gap="xs">
            <IconInfoCircle size={20} color="blue" />
            <Title order={4}>Message Visibility Levels</Title>
          </Group>
        )}
        
        <Text size="sm" c="dimmed">
          Each message shows who can see it based on its privacy level:
        </Text>

        <Stack gap="md">
          {visibilityLevels.map((level) => (
            <Group key={level.privacy} align="flex-start" gap="md">
              <Badge 
                size="sm" 
                variant="light" 
                color={level.color}
                leftSection={<level.icon size={14} />}
                style={{ minWidth: 'fit-content' }}
              >
                {level.label}
              </Badge>
              
              <Stack gap="xs" style={{ flex: 1 }}>
                <Text size="sm" fw={500}>
                  {level.description}
                </Text>
                <Group gap="xs">
                  <Text size="xs" c="dimmed" fw={500}>
                    Visible to:
                  </Text>
                  {level.audience.map((role, index) => (
                    <Text key={index} size="xs" c="dimmed">
                      {role}{index < level.audience.length - 1 ? ',' : ''}
                    </Text>
                  ))}
                </Group>
              </Stack>
            </Group>
          ))}
        </Stack>

        <Text size="xs" c="dimmed" style={{ fontStyle: 'italic' }}>
          💡 Tip: Hover over any message's visibility badge to see who can see it.
        </Text>
      </Stack>
    </Card>
  );
}