'use client';

import { 
  Card, 
  Title, 
  Stack, 
  Button, 
  Group, 
  Text, 
  Divider,
  Badge
} from '@mantine/core';
import { 
  IconPlus, 
  IconUpload, 
  IconUsers, 
  IconRobot, 
  IconSettings,
  IconSearch,
  IconBell,
  IconBook
} from '@tabler/icons-react';
import Link from 'next/link';

interface QuickAction {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  href?: string;
  badge?: {
    text: string;
    color: string;
  };
  onClick?: () => void;
}

export function QuickActions() {
  // Mock notification count - will be replaced with real data
  const notificationCount = 3;

  const primaryActions: QuickAction[] = [
    {
      id: 'submit-manuscript',
      title: 'Submit Manuscript',
      description: 'Upload a new manuscript for review',
      icon: <IconUpload size={18} />,
      color: 'blue',
      href: '/manuscripts/submit'
    },
    {
      id: 'start-conversation',
      title: 'Start Conversation',
      description: 'Begin a new discussion thread',
      icon: <IconPlus size={18} />,
      color: 'green',
      href: '/conversations/new'
    },
    {
      id: 'invite-reviewers',
      title: 'Invite Reviewers',
      description: 'Add reviewers to manuscripts',
      icon: <IconUsers size={18} />,
      color: 'orange',
      href: '/reviewers/invite'
    }
  ];

  const secondaryActions: QuickAction[] = [
    {
      id: 'manage-bots',
      title: 'Manage Bots',
      description: 'Configure automated workflows',
      icon: <IconRobot size={18} />,
      color: 'violet',
      href: '/bots'
    },
    {
      id: 'browse-manuscripts',
      title: 'Browse Manuscripts',
      description: 'Explore published work',
      icon: <IconBook size={18} />,
      color: 'teal',
      href: '/manuscripts'
    },
    {
      id: 'search',
      title: 'Advanced Search',
      description: 'Find manuscripts and discussions',
      icon: <IconSearch size={18} />,
      color: 'gray',
      href: '/search'
    }
  ];

  const utilityActions: QuickAction[] = [
    {
      id: 'notifications',
      title: 'Notifications',
      description: 'View recent updates',
      icon: <IconBell size={18} />,
      color: 'yellow',
      href: '/notifications',
      badge: notificationCount > 0 ? {
        text: notificationCount.toString(),
        color: 'red'
      } : undefined
    },
    {
      id: 'settings',
      title: 'Settings',
      description: 'Manage your preferences',
      icon: <IconSettings size={18} />,
      color: 'dark',
      href: '/settings'
    }
  ];

  const renderActionButton = (action: QuickAction) => (
    <Button
      key={action.id}
      variant="light"
      color={action.color}
      size="md"
      leftSection={action.icon}
      component={action.href ? Link : undefined}
      href={action.href}
      onClick={action.onClick}
      justify="flex-start"
      fullWidth
      h="auto"
      p="md"
    >
      <Stack gap={2} align="flex-start" style={{ flex: 1 }}>
        <Group justify="space-between" w="100%">
          <Text size="sm" fw={500}>
            {action.title}
          </Text>
          {action.badge && (
            <Badge size="xs" color={action.badge.color}>
              {action.badge.text}
            </Badge>
          )}
        </Group>
        <Text size="xs" c="dimmed" ta="left">
          {action.description}
        </Text>
      </Stack>
    </Button>
  );

  return (
    <Card shadow="sm" padding="lg" radius="md">
      <Stack gap="md">
        <Title order={3}>Quick Actions</Title>

        {/* Primary Actions */}
        <Stack gap="xs">
          <Text size="sm" fw={500} c="dimmed">
            PRIMARY
          </Text>
          {primaryActions.map(renderActionButton)}
        </Stack>

        <Divider />

        {/* Secondary Actions */}
        <Stack gap="xs">
          <Text size="sm" fw={500} c="dimmed">
            BROWSE & MANAGE
          </Text>
          {secondaryActions.map(renderActionButton)}
        </Stack>

        <Divider />

        {/* Utility Actions */}
        <Stack gap="xs">
          <Text size="sm" fw={500} c="dimmed">
            ACCOUNT
          </Text>
          {utilityActions.map(renderActionButton)}
        </Stack>
      </Stack>
    </Card>
  );
}