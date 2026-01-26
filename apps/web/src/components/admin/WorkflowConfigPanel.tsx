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
  NavLink,
  Grid,
  ThemeIcon,
  SimpleGrid
} from '@mantine/core';
import {
  IconCheck,
  IconDeviceFloppy,
  IconAlertCircle,
  IconEye,
  IconUsers,
  IconMessages,
  IconEyeOff,
  IconLock,
  IconWorld,
  IconArrowRight,
  IconShield,
  IconAdjustments
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

interface WorkflowTemplateWithIcon extends WorkflowTemplate {
  icon: React.ReactNode;
  shortDescription: string;
}

const workflowTemplates: WorkflowTemplateWithIcon[] = [
  {
    id: 'traditional-blind',
    name: 'Traditional Double-Blind',
    shortDescription: 'Full anonymity for all parties',
    description: 'Classic double-blind review where authors and reviewers cannot see each other\'s identities. Reviews are released to authors only after editorial decision.',
    icon: <IconEyeOff size={20} />,
    config: {
      author: { seesReviews: 'on_release', seesReviewerIdentity: 'never', canParticipate: 'on_release' },
      reviewers: { seeEachOther: 'never', seeAuthorIdentity: 'never', seeAuthorResponses: 'on_release' },
      phases: { enabled: true, authorResponseStartsNewCycle: true, requireAllReviewsBeforeRelease: true }
    }
  },
  {
    id: 'single-blind',
    name: 'Single-Blind Review',
    shortDescription: 'Reviewers see authors, not vice versa',
    description: 'Reviewers know author identities, but authors do not know reviewer identities. Reviews are released after editorial decision.',
    icon: <IconShield size={20} />,
    config: {
      author: { seesReviews: 'on_release', seesReviewerIdentity: 'never', canParticipate: 'on_release' },
      reviewers: { seeEachOther: 'never', seeAuthorIdentity: 'always', seeAuthorResponses: 'on_release' },
      phases: { enabled: true, authorResponseStartsNewCycle: true, requireAllReviewsBeforeRelease: true }
    }
  },
  {
    id: 'open-continuous',
    name: 'Open Continuous',
    shortDescription: 'Full transparency, real-time interaction',
    description: 'Fully open review where all identities are visible and authors can see and respond to reviews in real-time.',
    icon: <IconWorld size={20} />,
    config: {
      author: { seesReviews: 'realtime', seesReviewerIdentity: 'always', canParticipate: 'anytime' },
      reviewers: { seeEachOther: 'realtime', seeAuthorIdentity: 'always', seeAuthorResponses: 'realtime' },
      phases: { enabled: false, authorResponseStartsNewCycle: false, requireAllReviewsBeforeRelease: false }
    }
  },
  {
    id: 'progressive-disclosure',
    name: 'Progressive Disclosure',
    shortDescription: 'Gradual reveal after review phase',
    description: 'Reviewers work independently during review phase. After all reviews submitted, identities and reviews become visible to all reviewers for deliberation.',
    icon: <IconArrowRight size={20} />,
    config: {
      author: { seesReviews: 'on_release', seesReviewerIdentity: 'on_release', canParticipate: 'on_release' },
      reviewers: { seeEachOther: 'after_all_submit', seeAuthorIdentity: 'never', seeAuthorResponses: 'on_release' },
      phases: { enabled: true, authorResponseStartsNewCycle: true, requireAllReviewsBeforeRelease: true }
    }
  },
  {
    id: 'open-gated',
    name: 'Open Gated',
    shortDescription: 'Visible reviews, controlled responses',
    description: 'Authors can see reviews in real-time but can only respond when explicitly invited by editors.',
    icon: <IconLock size={20} />,
    config: {
      author: { seesReviews: 'realtime', seesReviewerIdentity: 'always', canParticipate: 'invited' },
      reviewers: { seeEachOther: 'realtime', seeAuthorIdentity: 'always', seeAuthorResponses: 'realtime' },
      phases: { enabled: true, authorResponseStartsNewCycle: false, requireAllReviewsBeforeRelease: false }
    }
  }
];

const defaultCustomConfig: WorkflowConfig = {
  author: { seesReviews: 'on_release', seesReviewerIdentity: 'never', canParticipate: 'on_release' },
  reviewers: { seeEachOther: 'never', seeAuthorIdentity: 'never', seeAuthorResponses: 'on_release' },
  phases: { enabled: true, authorResponseStartsNewCycle: true, requireAllReviewsBeforeRelease: true }
};

interface WorkflowConfigPanelProps {
  currentTemplateId?: string;
  currentConfig?: WorkflowConfig;
  onSave: (templateId: string | null, config: WorkflowConfig | null) => Promise<void>;
}

export function WorkflowConfigPanel({ currentTemplateId, currentConfig, onSave }: WorkflowConfigPanelProps) {
  // 'custom' is a special selection for custom configuration
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    if (currentTemplateId) return currentTemplateId;
    if (currentConfig && !currentTemplateId) return 'custom';
    return null;
  });
  const [customConfig, setCustomConfig] = useState<WorkflowConfig | null>(currentConfig || null);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const isCustomMode = selectedId === 'custom';
  const selectedTemplate = workflowTemplates.find(t => t.id === selectedId);
  const displayConfig = isCustomMode ? customConfig : selectedTemplate?.config || null;

  useEffect(() => {
    // When switching to a template, update the config preview
    if (selectedTemplate && !isCustomMode) {
      setCustomConfig(selectedTemplate.config);
    }
  }, [selectedId, selectedTemplate, isCustomMode]);

  const handleSelectionChange = (id: string | null) => {
    setSelectedId(id);
    setHasChanges(true);
    if (id === 'custom') {
      // Start with current config or default
      setCustomConfig(customConfig || defaultCustomConfig);
    } else if (id) {
      const template = workflowTemplates.find(t => t.id === id);
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
      // If custom mode, save without templateId; otherwise save the template ID
      const templateIdToSave = isCustomMode ? null : selectedId;
      const configToSave = customConfig;

      await onSave(templateIdToSave, configToSave);
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
      setSelectedId(null);
      setCustomConfig(null);
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

      <Grid gutter="md">
        {/* Left Panel - Template Selection */}
        <Grid.Col span={{ base: 12, md: 4 }}>
          <Card withBorder h="100%">
            <Stack gap="xs">
              <Text fw={500} size="sm" c="dimmed" tt="uppercase">
                Workflow Templates
              </Text>

              {workflowTemplates.map(template => (
                <NavLink
                  key={template.id}
                  active={selectedId === template.id}
                  label={template.name}
                  description={template.shortDescription}
                  leftSection={
                    <ThemeIcon
                      variant={selectedId === template.id ? 'filled' : 'light'}
                      size="md"
                      color={selectedId === template.id ? 'blue' : 'gray'}
                    >
                      {template.icon}
                    </ThemeIcon>
                  }
                  onClick={() => handleSelectionChange(template.id)}
                  styles={{
                    root: { borderRadius: 'var(--mantine-radius-sm)' }
                  }}
                />
              ))}

              <Divider my="xs" />

              <NavLink
                active={selectedId === 'custom'}
                label="Custom Configuration"
                description="Build your own workflow"
                leftSection={
                  <ThemeIcon
                    variant={selectedId === 'custom' ? 'filled' : 'light'}
                    size="md"
                    color={selectedId === 'custom' ? 'blue' : 'gray'}
                  >
                    <IconAdjustments size={20} />
                  </ThemeIcon>
                }
                onClick={() => handleSelectionChange('custom')}
                styles={{
                  root: { borderRadius: 'var(--mantine-radius-sm)' }
                }}
              />

              {selectedId && (
                <>
                  <Divider my="xs" />
                  <Button
                    variant="subtle"
                    color="red"
                    size="xs"
                    onClick={handleClearConfig}
                    loading={isSaving}
                  >
                    Clear Configuration
                  </Button>
                </>
              )}
            </Stack>
          </Card>
        </Grid.Col>

        {/* Right Panel - Settings Display */}
        <Grid.Col span={{ base: 12, md: 8 }}>
          <Card withBorder h="100%">
            {!selectedId ? (
              <Stack align="center" justify="center" h="100%" py="xl">
                <ThemeIcon size={60} variant="light" color="gray">
                  <IconAlertCircle size={30} />
                </ThemeIcon>
                <Text c="dimmed" ta="center">
                  Select a workflow template from the left panel to configure your review process.
                </Text>
                <Text size="sm" c="dimmed" ta="center">
                  No workflow configured. Using default behavior where all messages follow standard privacy rules.
                </Text>
              </Stack>
            ) : (
              <Stack gap="md">
                <Group justify="space-between">
                  <div>
                    <Title order={5}>
                      {isCustomMode ? 'Custom Configuration' : selectedTemplate?.name}
                    </Title>
                    <Text size="sm" c="dimmed">
                      {isCustomMode
                        ? 'Configure each setting individually'
                        : selectedTemplate?.description}
                    </Text>
                  </div>
                  {!isCustomMode && (
                    <Badge color="blue" variant="light">Template</Badge>
                  )}
                </Group>

                <Divider label="Author Settings" labelPosition="left" />

                <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">
                  <Select
                    label="When can authors see reviews?"
                    description="Controls when review content is visible to authors"
                    data={[
                      { value: 'realtime', label: 'Real-time (as reviews are posted)' },
                      { value: 'on_release', label: 'On release (after editorial decision)' },
                      { value: 'never', label: 'Never' }
                    ]}
                    value={displayConfig?.author.seesReviews}
                    onChange={(value) => handleConfigChange(['author', 'seesReviews'], value)}
                    disabled={!isCustomMode}
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
                    value={displayConfig?.author.seesReviewerIdentity}
                    onChange={(value) => handleConfigChange(['author', 'seesReviewerIdentity'], value)}
                    disabled={!isCustomMode}
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
                    value={displayConfig?.author.canParticipate}
                    onChange={(value) => handleConfigChange(['author', 'canParticipate'], value)}
                    disabled={!isCustomMode}
                    leftSection={<IconMessages size={16} />}
                  />
                </SimpleGrid>

                <Divider label="Reviewer Settings" labelPosition="left" />

                <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">
                  <Select
                    label="Can reviewers see each other's reviews?"
                    description="Whether reviewers can see other reviews"
                    data={[
                      { value: 'realtime', label: 'Real-time' },
                      { value: 'after_all_submit', label: 'After all reviews submitted' },
                      { value: 'never', label: 'Never' }
                    ]}
                    value={displayConfig?.reviewers.seeEachOther}
                    onChange={(value) => handleConfigChange(['reviewers', 'seeEachOther'], value)}
                    disabled={!isCustomMode}
                    leftSection={<IconEye size={16} />}
                  />

                  <Select
                    label="Can reviewers see author identities?"
                    description="Whether manuscript authors are anonymous"
                    data={[
                      { value: 'always', label: 'Always visible' },
                      { value: 'never', label: 'Never (anonymous)' }
                    ]}
                    value={displayConfig?.reviewers.seeAuthorIdentity}
                    onChange={(value) => handleConfigChange(['reviewers', 'seeAuthorIdentity'], value)}
                    disabled={!isCustomMode}
                    leftSection={<IconUsers size={16} />}
                  />

                  <Select
                    label="When can reviewers see author responses?"
                    description="After authors respond, when are they visible"
                    data={[
                      { value: 'realtime', label: 'Real-time' },
                      { value: 'on_release', label: 'On release' }
                    ]}
                    value={displayConfig?.reviewers.seeAuthorResponses}
                    onChange={(value) => handleConfigChange(['reviewers', 'seeAuthorResponses'], value)}
                    disabled={!isCustomMode}
                    leftSection={<IconEye size={16} />}
                  />
                </SimpleGrid>

                <Divider label="Phase Settings" labelPosition="left" />

                <Stack gap="sm">
                  <Switch
                    label="Enable workflow phases"
                    description="Use structured phases (Review, Deliberation, Released, Author Responding)"
                    checked={displayConfig?.phases.enabled}
                    onChange={(e) => handleConfigChange(['phases', 'enabled'], e.currentTarget.checked)}
                    disabled={!isCustomMode}
                  />

                  <Switch
                    label="Author response starts new cycle"
                    description="When author responds after release, increment review round"
                    checked={displayConfig?.phases.authorResponseStartsNewCycle}
                    onChange={(e) => handleConfigChange(['phases', 'authorResponseStartsNewCycle'], e.currentTarget.checked)}
                    disabled={!isCustomMode || !displayConfig?.phases.enabled}
                  />

                  <Switch
                    label="Require all reviews before release"
                    description="Prevent releasing to authors until all assigned reviews are complete"
                    checked={displayConfig?.phases.requireAllReviewsBeforeRelease}
                    onChange={(e) => handleConfigChange(['phases', 'requireAllReviewsBeforeRelease'], e.currentTarget.checked)}
                    disabled={!isCustomMode || !displayConfig?.phases.enabled}
                  />
                </Stack>

                {!isCustomMode && (
                  <Alert color="blue" variant="light" icon={<IconAlertCircle size={16} />}>
                    Template settings are read-only. Select "Custom Configuration" from the left panel to modify individual settings.
                  </Alert>
                )}
              </Stack>
            )}
          </Card>
        </Grid.Col>
      </Grid>

      <Group justify="flex-end">
        <Button
          leftSection={<IconDeviceFloppy size={16} />}
          onClick={handleSave}
          loading={isSaving}
          disabled={!hasChanges || !selectedId}
        >
          Save Changes
        </Button>
      </Group>
    </Stack>
  );
}
