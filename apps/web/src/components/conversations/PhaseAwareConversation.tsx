'use client';

import { useState, useCallback } from 'react';
import { Stack, Alert, Text, Badge, Group, Paper } from '@mantine/core';
import { IconInfoCircle } from '@tabler/icons-react';
import { ConversationThread } from './ConversationThread';
import { AuthorLockedState } from './AuthorLockedState';
import { EditorPhaseControls } from './EditorPhaseControls';
import { useAuth } from '@/contexts/AuthContext';

interface WorkflowInfo {
  phase: string;
  round: number;
  hasConfig: boolean;
}

interface ParticipationInfo {
  canParticipate: boolean;
  reason?: string;
  viewerRole: string;
  phase: string;
  round: number;
}

interface ManuscriptInfo {
  id: string;
  title: string;
  status: string;
  workflowPhase?: string;
  workflowRound?: number;
  releasedAt?: string;
}

interface ReviewerInfo {
  id: string;
  name: string;
  status: string;
}

interface PhaseAwareConversationProps {
  conversationId: string;
  manuscript?: ManuscriptInfo;
  workflow?: WorkflowInfo;
  participation?: ParticipationInfo;
  reviewers?: ReviewerInfo[];
  submittedAt?: string;
  onWorkflowAction?: (action: string, params?: any) => Promise<void>;
}

export function PhaseAwareConversation({
  conversationId,
  manuscript,
  workflow,
  participation,
  reviewers = [],
  submittedAt,
  onWorkflowAction
}: PhaseAwareConversationProps) {
  const { user } = useAuth();
  const [isActionLoading, setIsActionLoading] = useState(false);

  const isEditor = user?.role === 'ADMIN' ||
    user?.role === 'EDITOR_IN_CHIEF' ||
    user?.role === 'ACTION_EDITOR';

  const isAuthor = participation?.viewerRole === 'author';
  const showLockedState = isAuthor &&
    workflow?.hasConfig &&
    !participation?.canParticipate &&
    (workflow.phase === 'REVIEW' || workflow.phase === 'DELIBERATION');

  const handleRelease = useCallback(async (decision: string, notes?: string) => {
    if (!onWorkflowAction) return;

    setIsActionLoading(true);
    try {
      await onWorkflowAction('release', { decision, notes });
    } finally {
      setIsActionLoading(false);
    }
  }, [onWorkflowAction]);

  const handleBeginDeliberation = useCallback(async () => {
    if (!onWorkflowAction) return;

    setIsActionLoading(true);
    try {
      await onWorkflowAction('begin-deliberation');
    } finally {
      setIsActionLoading(false);
    }
  }, [onWorkflowAction]);

  if (showLockedState && manuscript && submittedAt) {
    return (
      <Stack gap="lg">
        {workflow && (
          <PhaseBanner phase={workflow.phase} round={workflow.round} />
        )}
        <AuthorLockedState
          manuscriptTitle={manuscript.title}
          submittedAt={submittedAt}
          status={manuscript.status}
          round={workflow?.round}
        />
      </Stack>
    );
  }

  return (
    <Stack gap="lg">
      {workflow?.hasConfig && isEditor && (
        <EditorPhaseControls
          phase={workflow.phase}
          round={workflow.round}
          reviewers={reviewers.map(r => ({
            id: r.id,
            name: r.name,
            status: r.status as any
          }))}
          onRelease={handleRelease}
          onBeginDeliberation={handleBeginDeliberation}
          isLoading={isActionLoading}
        />
      )}

      {workflow?.hasConfig && !isEditor && (
        <PhaseBanner phase={workflow.phase} round={workflow.round} />
      )}

      {participation && !participation.canParticipate && participation.reason && (
        <Alert icon={<IconInfoCircle size={16} />} color="blue" variant="light">
          <Text size="sm">{participation.reason}</Text>
        </Alert>
      )}

      <ConversationThread conversationId={conversationId} />
    </Stack>
  );
}

function PhaseBanner({ phase, round }: { phase: string; round: number }) {
  const phaseLabels: Record<string, { label: string; color: string; description: string }> = {
    'REVIEW': {
      label: 'Review Phase',
      color: 'blue',
      description: 'Reviewers are assessing the manuscript'
    },
    'DELIBERATION': {
      label: 'Deliberation',
      color: 'violet',
      description: 'Reviewers are discussing their assessments'
    },
    'RELEASED': {
      label: 'Released',
      color: 'green',
      description: 'Reviews have been released to authors'
    },
    'AUTHOR_RESPONDING': {
      label: 'Author Response',
      color: 'orange',
      description: 'Authors are responding to reviews'
    }
  };

  const info = phaseLabels[phase] || { label: phase, color: 'gray', description: '' };

  return (
    <Paper p="sm" withBorder radius="md" bg="var(--mantine-color-gray-0)">
      <Group justify="space-between">
        <Group gap="sm">
          <Badge color={info.color} variant="filled">
            {info.label}
          </Badge>
          {round > 1 && (
            <Badge color="gray" variant="light">
              Round {round}
            </Badge>
          )}
        </Group>
        <Text size="sm" c="dimmed">{info.description}</Text>
      </Group>
    </Paper>
  );
}
