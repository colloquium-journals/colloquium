'use client';

import { useState, useEffect } from 'react';
import {
  Stack,
  Card,
  Title,
  Text,
  Button,
  Group,
  Select,
  Switch,
  Divider,
  Alert,
  Badge,
  Collapse,
  Paper,
  SimpleGrid
} from '@mantine/core';
import {
  IconCheck,
  IconDeviceFloppy,
  IconAlertCircle,
  IconEye,
  IconEyeOff,
  IconUsers,
  IconMessages,
  IconRefresh
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';

interface WorkflowConfig {
  author: {
    seesReviews: 'realtime' | 'on_release' | 'never';
    seesReviewerIdentity: 'always' | 'never' | 'on_release';
    canParticipate: 'anytime' | 'on_release' | 'invited';
  };
  reviewers: {
    seeEachOther: 'realtime' | 'after_all_submit' | 'never';
    seeAuthorIdentity: 'always' | 'never';
    seeAuthorResponses: 'realtime' | 'on_release';
  };
  phases: {
    enabled: boolean;
    authorResponseStartsNewCycle: boolean;
    requireAllReviewsBeforeRelease: boolean;
  };
}

interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  config: WorkflowConfig;
}

const workflowTemplates: WorkflowTemplate[] = [
  {
    id: 'traditional-blind',
    name: 'Traditional Double-Blind',
    description: 'Classic double-blind review where authors and reviewers cannot see each other\'s identities. Reviews are released to authors only after editorial decision.',
    config: {
      author: { seesReviews: 'on_release', seesReviewerIdentity: 'never', canParticipate: 'on_release' },
      reviewers: { seeEachOther: 'never', seeAuthorIdentity: 'never', seeAuthorResponses: 'on_release' },
      phases: { enabled: true, authorResponseStartsNewCycle: true, requireAllReviewsBeforeRelease: true }
    }
  },
  {
    id: 'single-blind',
    name: 'Single-Blind Review',
    description: 'Reviewers know author identities, but authors do not know reviewer identities. Reviews are released after editorial decision.',
    config: {
      author: { seesReviews: 'on_release', seesReviewerIdentity: 'never', canParticipate: 'on_release' },
      reviewers: { seeEachOther: 'never', seeAuthorIdentity: 'always', seeAuthorResponses: 'on_release' },
      phases: { enabled: true, authorResponseStartsNewCycle: true, requireAllReviewsBeforeRelease: true }
    }
  },
  {
    id: 'open-continuous',
    name: 'Open Continuous Review',
    description: 'Fully open review where all identities are visible and authors can see and respond to reviews in real-time.',
    config: {
      author: { seesReviews: 'realtime', seesReviewerIdentity: 'always', canParticipate: 'anytime' },
      reviewers: { seeEachOther: 'realtime', seeAuthorIdentity: 'always', seeAuthorResponses: 'realtime' },
      phases: { enabled: false, authorResponseStartsNewCycle: false, requireAllReviewsBeforeRelease: false }
    }
  },
  {
    id: 'progressive-disclosure',
    name: 'Progressive Disclosure',
    description: 'Reviewers work independently during review phase. After all reviews submitted, identities and reviews become visible to all reviewers for deliberation.',
    config: {
      author: { seesReviews: 'on_release', seesReviewerIdentity: 'on_release', canParticipate: 'on_release' },
      reviewers: { seeEachOther: 'after_all_submit', seeAuthorIdentity: 'never', seeAuthorResponses: 'on_release' },
      phases: { enabled: true, authorResponseStartsNewCycle: true, requireAllReviewsBeforeRelease: true }
    }
  },
  {
    id: 'open-gated',
    name: 'Open with Gated Participation',
    description: 'Authors can see reviews in real-time but can only respond when explicitly invited by editors.',
    config: {
      author: { seesReviews: 'realtime', seesReviewerIdentity: 'always', canParticipate: 'invited' },
      reviewers: { seeEachOther: 'realtime', seeAuthorIdentity: 'always', seeAuthorResponses: 'realtime' },
      phases: { enabled: true, authorResponseStartsNewCycle: false, requireAllReviewsBeforeRelease: false }
    }
  }
];

interface WorkflowConfigPanelProps {
  currentTemplateId?: string;
  currentConfig?: WorkflowConfig;
  onSave: (templateId: string | null, config: WorkflowConfig | null) => Promise<void>;
}

export function WorkflowConfigPanel({ currentTemplateId, currentConfig, onSave }: WorkflowConfigPanelProps) {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(currentTemplateId || null);
  const [customConfig, setCustomConfig] = useState<WorkflowConfig | null>(currentConfig || null);
  const [isCustomizing, setIsCustomizing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const selectedTemplate = workflowTemplates.find(t => t.id === selectedTemplateId);

  useEffect(() => {
    if (selectedTemplate && !isCustomizing) {
      setCustomConfig(selectedTemplate.config);
    }
  }, [selectedTemplateId, selectedTemplate, isCustomizing]);

  const handleTemplateChange = (templateId: string | null) => {
    setSelectedTemplateId(templateId);
    setIsCustomizing(false);
    setHasChanges(true);
    if (templateId) {
      const template = workflowTemplates.find(t => t.id === templateId);
      if (template) {
        setCustomConfig(template.config);
      }
    } else {
      setCustomConfig(null);
    }
  };

  const handleConfigChange = (path: string[], value: any) => {
    if (!customConfig) return;

    setHasChanges(true);
    setCustomConfig(prev => {
      if (!prev) return prev;

      const newConfig = { ...prev };
      let current: any = newConfig;

      for (let i = 0; i < path.length - 1; i++) {
        current[path[i]] = { ...current[path[i]] };
        current = current[path[i]];
      }

      current[path[path.length - 1]] = value;
      return newConfig;
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(
        isCustomizing ? null : selectedTemplateId,
        customConfig
      );
      setHasChanges(false);
      notifications.show({
        title: 'Saved',
        message: 'Workflow configuration updated successfully',
        color: 'green',
        icon: <IconCheck size={16} />
      });
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to save workflow configuration',
        color: 'red',
        icon: <IconAlertCircle size={16} />
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleClearConfig = async () => {
    setIsSaving(true);
    try {
      await onSave(null, null);
      setSelectedTemplateId(null);
      setCustomConfig(null);
      setIsCustomizing(false);
      setHasChanges(false);
      notifications.show({
        title: 'Cleared',
        message: 'Workflow configuration cleared. Using default behavior.',
        color: 'blue',
        icon: <IconCheck size={16} />
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Stack gap="lg">
      <div>
        <Title order={4} mb="xs">Review Workflow Configuration</Title>
        <Text size="sm" c="dimmed">
          Configure how reviews are conducted: visibility rules, identity masking, and phase transitions.
        </Text>
      </div>

      {!selectedTemplateId && !currentConfig && (
        <Alert icon={<IconAlertCircle size={16} />} color="blue">
          No workflow configured. Using default behavior where all messages follow standard privacy rules.
        </Alert>
      )}

      <Card withBorder>
        <Stack gap="md">
          <Title order={5}>Select Workflow Template</Title>

          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            {workflowTemplates.map(template => (
              <Paper
                key={template.id}
                p="md"
                withBorder
                style={{
                  cursor: 'pointer',
                  borderColor: selectedTemplateId === template.id ? 'var(--mantine-color-blue-5)' : undefined,
                  backgroundColor: selectedTemplateId === template.id ? 'var(--mantine-color-blue-0)' : undefined
                }}
                onClick={() => handleTemplateChange(template.id)}
              >
                <Group justify="space-between" mb="xs">
                  <Text fw={500}>{template.name}</Text>
                  {selectedTemplateId === template.id && (
                    <Badge color="blue" size="sm">Selected</Badge>
                  )}
                </Group>
                <Text size="sm" c="dimmed">{template.description}</Text>
              </Paper>
            ))}
          </SimpleGrid>

          {selectedTemplateId && (
            <Group>
              <Button
                variant="subtle"
                size="xs"
                leftSection={<IconRefresh size={14} />}
                onClick={() => handleTemplateChange(null)}
              >
                Clear Selection
              </Button>
              <Button
                variant="subtle"
                size="xs"
                onClick={() => setIsCustomizing(!isCustomizing)}
              >
                {isCustomizing ? 'Use Template Defaults' : 'Customize Settings'}
              </Button>
            </Group>
          )}
        </Stack>
      </Card>

      <Collapse in={!!(customConfig && (isCustomizing || selectedTemplateId))}>
        <Card withBorder>
          <Stack gap="md">
            <Group justify="space-between">
              <Title order={5}>
                {isCustomizing ? 'Custom Configuration' : 'Template Settings (Read-only)'}
              </Title>
              {!isCustomizing && selectedTemplateId && (
                <Badge color="gray" size="sm">Template defaults</Badge>
              )}
            </Group>

            <Divider label="Author Settings" labelPosition="left" />

            <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
              <Select
                label="When can authors see reviews?"
                description="Controls when review content is visible to authors"
                data={[
                  { value: 'realtime', label: 'Real-time (as reviews are posted)' },
                  { value: 'on_release', label: 'On release (after editorial decision)' },
                  { value: 'never', label: 'Never' }
                ]}
                value={customConfig?.author.seesReviews}
                onChange={(value) => handleConfigChange(['author', 'seesReviews'], value)}
                disabled={!isCustomizing}
                leftSection={<IconEye size={16} />}
              />

              <Select
                label="Can authors see reviewer identities?"
                description="Whether reviewers are anonymous to authors"
                data={[
                  { value: 'always', label: 'Always visible' },
                  { value: 'on_release', label: 'On release only' },
                  { value: 'never', label: 'Never (anonymous)' }
                ]}
                value={customConfig?.author.seesReviewerIdentity}
                onChange={(value) => handleConfigChange(['author', 'seesReviewerIdentity'], value)}
                disabled={!isCustomizing}
                leftSection={<IconUsers size={16} />}
              />

              <Select
                label="When can authors participate?"
                description="Controls when authors can post messages"
                data={[
                  { value: 'anytime', label: 'Anytime' },
                  { value: 'on_release', label: 'After reviews released' },
                  { value: 'invited', label: 'Only when invited by editor' }
                ]}
                value={customConfig?.author.canParticipate}
                onChange={(value) => handleConfigChange(['author', 'canParticipate'], value)}
                disabled={!isCustomizing}
                leftSection={<IconMessages size={16} />}
              />
            </SimpleGrid>

            <Divider label="Reviewer Settings" labelPosition="left" />

            <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
              <Select
                label="Can reviewers see each other's reviews?"
                description="Whether reviewers can see other reviews"
                data={[
                  { value: 'realtime', label: 'Real-time' },
                  { value: 'after_all_submit', label: 'After all reviews submitted' },
                  { value: 'never', label: 'Never' }
                ]}
                value={customConfig?.reviewers.seeEachOther}
                onChange={(value) => handleConfigChange(['reviewers', 'seeEachOther'], value)}
                disabled={!isCustomizing}
                leftSection={<IconEye size={16} />}
              />

              <Select
                label="Can reviewers see author identities?"
                description="Whether manuscript authors are anonymous"
                data={[
                  { value: 'always', label: 'Always visible' },
                  { value: 'never', label: 'Never (anonymous)' }
                ]}
                value={customConfig?.reviewers.seeAuthorIdentity}
                onChange={(value) => handleConfigChange(['reviewers', 'seeAuthorIdentity'], value)}
                disabled={!isCustomizing}
                leftSection={<IconUsers size={16} />}
              />

              <Select
                label="When can reviewers see author responses?"
                description="After authors respond, when are they visible"
                data={[
                  { value: 'realtime', label: 'Real-time' },
                  { value: 'on_release', label: 'On release' }
                ]}
                value={customConfig?.reviewers.seeAuthorResponses}
                onChange={(value) => handleConfigChange(['reviewers', 'seeAuthorResponses'], value)}
                disabled={!isCustomizing}
                leftSection={<IconEye size={16} />}
              />
            </SimpleGrid>

            <Divider label="Phase Settings" labelPosition="left" />

            <Stack gap="sm">
              <Switch
                label="Enable workflow phases"
                description="Use structured phases (Review, Deliberation, Released, Author Responding)"
                checked={customConfig?.phases.enabled}
                onChange={(e) => handleConfigChange(['phases', 'enabled'], e.currentTarget.checked)}
                disabled={!isCustomizing}
              />

              <Switch
                label="Author response starts new cycle"
                description="When author responds after release, increment review round"
                checked={customConfig?.phases.authorResponseStartsNewCycle}
                onChange={(e) => handleConfigChange(['phases', 'authorResponseStartsNewCycle'], e.currentTarget.checked)}
                disabled={!isCustomizing || !customConfig?.phases.enabled}
              />

              <Switch
                label="Require all reviews before release"
                description="Prevent releasing to authors until all assigned reviews are complete"
                checked={customConfig?.phases.requireAllReviewsBeforeRelease}
                onChange={(e) => handleConfigChange(['phases', 'requireAllReviewsBeforeRelease'], e.currentTarget.checked)}
                disabled={!isCustomizing || !customConfig?.phases.enabled}
              />
            </Stack>
          </Stack>
        </Card>
      </Collapse>

      <Group justify="flex-end">
        {(currentConfig || currentTemplateId) && (
          <Button
            variant="subtle"
            color="red"
            onClick={handleClearConfig}
            loading={isSaving}
          >
            Clear Configuration
          </Button>
        )}
        <Button
          leftSection={<IconDeviceFloppy size={16} />}
          onClick={handleSave}
          loading={isSaving}
          disabled={!hasChanges}
        >
          Save Changes
        </Button>
      </Group>
    </Stack>
  );
}
