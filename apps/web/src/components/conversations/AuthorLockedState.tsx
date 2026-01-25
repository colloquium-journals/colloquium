'use client';

import {
  Paper,
  Stack,
  Title,
  Text,
  Group,
  Badge,
  ThemeIcon,
  List,
  Divider
} from '@mantine/core';
import {
  IconLock,
  IconClock,
  IconFileText,
  IconInfoCircle
} from '@tabler/icons-react';

interface AuthorLockedStateProps {
  manuscriptTitle: string;
  submittedAt: string;
  status: string;
  fileCount?: number;
  round?: number;
}

export function AuthorLockedState({
  manuscriptTitle,
  submittedAt,
  status,
  fileCount = 0,
  round = 1
}: AuthorLockedStateProps) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const statusLabels: Record<string, { label: string; color: string }> = {
    'SUBMITTED': { label: 'Under Initial Review', color: 'blue' },
    'UNDER_REVIEW': { label: 'Under Peer Review', color: 'blue' },
    'REVISION_REQUESTED': { label: 'Revision Requested', color: 'orange' },
    'REVISED': { label: 'Revised - Under Review', color: 'blue' }
  };

  const statusInfo = statusLabels[status] || { label: status, color: 'gray' };

  return (
    <Paper shadow="sm" p="xl" radius="md" withBorder>
      <Stack gap="lg">
        <Group justify="center">
          <ThemeIcon size={60} radius="xl" color="blue" variant="light">
            <IconLock size={30} />
          </ThemeIcon>
        </Group>

        <Stack gap="xs" align="center">
          <Title order={3}>Review in Progress</Title>
          <Text c="dimmed" ta="center" maw={500}>
            Your manuscript is currently being reviewed. You will be notified when reviews are released and you can participate in the discussion.
          </Text>
        </Stack>

        <Divider />

        <Stack gap="md">
          <Group gap="xs">
            <IconFileText size={18} color="var(--mantine-color-gray-6)" />
            <Text fw={500}>Manuscript</Text>
          </Group>
          <Text ml="md">{manuscriptTitle}</Text>

          <Group gap="xs">
            <IconClock size={18} color="var(--mantine-color-gray-6)" />
            <Text fw={500}>Submitted</Text>
          </Group>
          <Text ml="md">{formatDate(submittedAt)}</Text>

          <Group gap="xs">
            <IconInfoCircle size={18} color="var(--mantine-color-gray-6)" />
            <Text fw={500}>Status</Text>
          </Group>
          <Group ml="md">
            <Badge color={statusInfo.color} variant="light">
              {statusInfo.label}
            </Badge>
            {round > 1 && (
              <Badge color="gray" variant="light">
                Round {round}
              </Badge>
            )}
          </Group>

          {fileCount > 0 && (
            <>
              <Group gap="xs">
                <IconFileText size={18} color="var(--mantine-color-gray-6)" />
                <Text fw={500}>Submitted Files</Text>
              </Group>
              <Text ml="md" c="dimmed">{fileCount} file(s) attached</Text>
            </>
          )}
        </Stack>

        <Divider />

        <Stack gap="xs">
          <Text fw={500} size="sm">What to expect:</Text>
          <List size="sm" spacing="xs" c="dimmed">
            <List.Item>Reviewers are currently assessing your manuscript</List.Item>
            <List.Item>You will receive an email when reviews are released</List.Item>
            <List.Item>Once released, you can view feedback and respond</List.Item>
            <List.Item>The editor will make a decision based on reviews and your response</List.Item>
          </List>
        </Stack>
      </Stack>
    </Paper>
  );
}
