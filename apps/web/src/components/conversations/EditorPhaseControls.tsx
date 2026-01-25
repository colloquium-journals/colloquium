'use client';

import { useState } from 'react';
import {
  Paper,
  Group,
  Badge,
  Text,
  Button,
  Menu,
  Stack,
  Progress,
  Tooltip,
  Alert
} from '@mantine/core';
import {
  IconChevronDown,
  IconSend,
  IconUsers,
  IconCheck,
  IconX,
  IconRefresh,
  IconAlertCircle,
  IconClock
} from '@tabler/icons-react';

interface ReviewerStatus {
  id: string;
  name: string;
  status: 'PENDING' | 'ACCEPTED' | 'IN_PROGRESS' | 'COMPLETED' | 'DECLINED';
}

interface EditorPhaseControlsProps {
  phase: string;
  round: number;
  reviewers: ReviewerStatus[];
  requireAllReviewsComplete?: boolean;
  onRelease: (decision: string, notes?: string) => void;
  onBeginDeliberation: () => void;
  isLoading?: boolean;
}

export function EditorPhaseControls({
  phase,
  round,
  reviewers,
  requireAllReviewsComplete = true,
  onRelease,
  onBeginDeliberation,
  isLoading = false
}: EditorPhaseControlsProps) {
  const completedReviews = reviewers.filter(r => r.status === 'COMPLETED').length;
  const totalActiveReviewers = reviewers.filter(r => ['ACCEPTED', 'IN_PROGRESS', 'COMPLETED'].includes(r.status)).length;
  const allReviewsComplete = completedReviews === totalActiveReviewers && totalActiveReviewers > 0;

  const phaseLabels: Record<string, { label: string; color: string }> = {
    'REVIEW': { label: 'Review Phase', color: 'blue' },
    'DELIBERATION': { label: 'Deliberation', color: 'violet' },
    'RELEASED': { label: 'Released to Authors', color: 'green' },
    'AUTHOR_RESPONDING': { label: 'Author Responding', color: 'orange' }
  };

  const phaseInfo = phaseLabels[phase] || { label: phase, color: 'gray' };

  const canRelease = !requireAllReviewsComplete || allReviewsComplete;
  const canBeginDeliberation = phase === 'REVIEW' && allReviewsComplete;

  const getReviewerStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED': return <IconCheck size={12} color="green" />;
      case 'IN_PROGRESS': return <IconClock size={12} color="blue" />;
      case 'ACCEPTED': return <IconClock size={12} color="gray" />;
      case 'PENDING': return <IconClock size={12} color="gray" />;
      case 'DECLINED': return <IconX size={12} color="red" />;
      default: return null;
    }
  };

  const getReviewerStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED': return 'green';
      case 'IN_PROGRESS': return 'blue';
      case 'ACCEPTED': return 'gray';
      case 'PENDING': return 'gray';
      case 'DECLINED': return 'red';
      default: return 'gray';
    }
  };

  return (
    <Paper shadow="sm" p="md" radius="md" withBorder>
      <Stack gap="md">
        <Group justify="space-between">
          <Group gap="md">
            <Badge size="lg" color={phaseInfo.color} variant="filled">
              {phaseInfo.label}
            </Badge>
            {round > 1 && (
              <Badge size="lg" color="gray" variant="light">
                Round {round}
              </Badge>
            )}
          </Group>

          <Group gap="xs">
            {phase === 'REVIEW' && (
              <Button
                variant="light"
                color="violet"
                size="sm"
                leftSection={<IconUsers size={16} />}
                onClick={onBeginDeliberation}
                disabled={!canBeginDeliberation || isLoading}
              >
                Begin Deliberation
              </Button>
            )}

            <Menu shadow="md" width={200}>
              <Menu.Target>
                <Button
                  color="green"
                  size="sm"
                  rightSection={<IconChevronDown size={16} />}
                  disabled={isLoading}
                >
                  Release Decision
                </Button>
              </Menu.Target>

              <Menu.Dropdown>
                <Menu.Label>Editorial Decision</Menu.Label>
                <Menu.Item
                  leftSection={<IconCheck size={14} color="green" />}
                  onClick={() => onRelease('accept')}
                  disabled={!canRelease}
                >
                  Accept
                </Menu.Item>
                <Menu.Item
                  leftSection={<IconRefresh size={14} color="orange" />}
                  onClick={() => onRelease('revise')}
                  disabled={!canRelease}
                >
                  Request Revision
                </Menu.Item>
                <Menu.Item
                  leftSection={<IconX size={14} color="red" />}
                  onClick={() => onRelease('reject')}
                  disabled={!canRelease}
                >
                  Reject
                </Menu.Item>
                <Menu.Divider />
                <Menu.Item
                  leftSection={<IconSend size={14} />}
                  onClick={() => onRelease('update')}
                  disabled={!canRelease}
                >
                  Release without Decision
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Group>

        <Stack gap="xs">
          <Group justify="space-between">
            <Text size="sm" fw={500}>Review Progress</Text>
            <Text size="sm" c="dimmed">
              {completedReviews} of {totalActiveReviewers} reviews complete
            </Text>
          </Group>
          <Progress
            value={totalActiveReviewers > 0 ? (completedReviews / totalActiveReviewers) * 100 : 0}
            color={allReviewsComplete ? 'green' : 'blue'}
            size="sm"
            radius="xl"
          />
        </Stack>

        {reviewers.length > 0 && (
          <Group gap="xs" wrap="wrap">
            {reviewers.map(reviewer => (
              <Tooltip
                key={reviewer.id}
                label={`${reviewer.name}: ${reviewer.status.replace('_', ' ').toLowerCase()}`}
              >
                <Badge
                  size="sm"
                  color={getReviewerStatusColor(reviewer.status)}
                  variant="light"
                  leftSection={getReviewerStatusIcon(reviewer.status)}
                >
                  {reviewer.name.split(' ')[0]}
                </Badge>
              </Tooltip>
            ))}
          </Group>
        )}

        {requireAllReviewsComplete && !allReviewsComplete && phase === 'REVIEW' && (
          <Alert
            icon={<IconAlertCircle size={16} />}
            color="yellow"
            variant="light"
          >
            <Text size="sm">
              Waiting for {totalActiveReviewers - completedReviews} review(s) to complete before release is enabled.
            </Text>
          </Alert>
        )}
      </Stack>
    </Paper>
  );
}
