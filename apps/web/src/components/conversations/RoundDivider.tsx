'use client';

import { Group, Text, Divider, Badge, ThemeIcon } from '@mantine/core';
import { IconRefresh } from '@tabler/icons-react';

interface RoundDividerProps {
  round: number;
  releasedAt?: string;
  decision?: string;
}

export function RoundDivider({ round, releasedAt, decision }: RoundDividerProps) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const decisionLabels: Record<string, { label: string; color: string }> = {
    'accept': { label: 'Accepted', color: 'green' },
    'revise': { label: 'Revision Requested', color: 'orange' },
    'reject': { label: 'Rejected', color: 'red' },
    'update': { label: 'Reviews Released', color: 'blue' }
  };

  const decisionInfo = decision ? decisionLabels[decision] : null;

  return (
    <Group gap="md" my="lg" style={{ width: '100%' }}>
      <Divider style={{ flex: 1 }} />
      <Group gap="xs">
        <ThemeIcon size="sm" radius="xl" color="gray" variant="light">
          <IconRefresh size={12} />
        </ThemeIcon>
        <Text size="sm" fw={500} c="dimmed">
          Round {round}
        </Text>
        {releasedAt && (
          <Text size="xs" c="dimmed">
            {formatDate(releasedAt)}
          </Text>
        )}
        {decisionInfo && (
          <Badge size="xs" color={decisionInfo.color} variant="light">
            {decisionInfo.label}
          </Badge>
        )}
      </Group>
      <Divider style={{ flex: 1 }} />
    </Group>
  );
}
