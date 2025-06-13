'use client';

import { useState } from 'react';
import { 
  Card, 
  Title, 
  Table, 
  Badge, 
  Group, 
  Text, 
  ActionIcon, 
  Menu,
  Button,
  Stack,
  Avatar,
  Progress,
  Anchor
} from '@mantine/core';
import { 
  IconDots, 
  IconEye, 
  IconMessage, 
  IconEdit, 
  IconTrash, 
  IconClock,
  IconUsers
} from '@tabler/icons-react';
import Link from 'next/link';

interface Manuscript {
  id: string;
  title: string;
  authors: string[];
  status: 'SUBMITTED' | 'UNDER_REVIEW' | 'REVISION_REQUESTED' | 'ACCEPTED' | 'REJECTED';
  submittedAt: string;
  reviewProgress: number;
  conversationCount: number;
  reviewerCount: number;
}

export function ManuscriptOverview() {
  // Mock data - will be replaced with real API data
  const [manuscripts] = useState<Manuscript[]>([
    {
      id: '1',
      title: 'A Novel Approach to Academic Publishing: The Colloquium Platform',
      authors: ['Dr. Jane Smith', 'Prof. John Doe'],
      status: 'UNDER_REVIEW',
      submittedAt: '2024-01-15T10:00:00Z',
      reviewProgress: 65,
      conversationCount: 3,
      reviewerCount: 2
    },
    {
      id: '2',
      title: 'Machine Learning Applications in Scientific Publishing',
      authors: ['Dr. Alice Johnson'],
      status: 'REVISION_REQUESTED',
      submittedAt: '2024-01-10T14:30:00Z',
      reviewProgress: 90,
      conversationCount: 5,
      reviewerCount: 3
    },
    {
      id: '3',
      title: 'Decentralized Peer Review: A Blockchain Approach',
      authors: ['Prof. Bob Wilson', 'Dr. Carol Brown', 'Dr. David Lee'],
      status: 'SUBMITTED',
      submittedAt: '2024-01-20T09:15:00Z',
      reviewProgress: 20,
      conversationCount: 1,
      reviewerCount: 1
    },
    {
      id: '4',
      title: 'Open Science and Collaborative Research Platforms',
      authors: ['Dr. Emily Davis'],
      status: 'ACCEPTED',
      submittedAt: '2023-12-05T16:45:00Z',
      reviewProgress: 100,
      conversationCount: 7,
      reviewerCount: 4
    }
  ]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'SUBMITTED': return 'blue';
      case 'UNDER_REVIEW': return 'orange';
      case 'REVISION_REQUESTED': return 'yellow';
      case 'ACCEPTED': return 'green';
      case 'REJECTED': return 'red';
      default: return 'gray';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'SUBMITTED': return 'Submitted';
      case 'UNDER_REVIEW': return 'Under Review';
      case 'REVISION_REQUESTED': return 'Revision Requested';
      case 'ACCEPTED': return 'Accepted';
      case 'REJECTED': return 'Rejected';
      default: return status;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getProgressColor = (progress: number) => {
    if (progress >= 80) return 'green';
    if (progress >= 50) return 'orange';
    return 'blue';
  };

  return (
    <Card shadow="sm" padding="lg" radius="md">
      <Stack gap="md">
        <Group justify="space-between" align="center">
          <Title order={3}>Manuscripts Overview</Title>
          <Button size="xs" variant="light">
            View All
          </Button>
        </Group>

        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Title & Authors</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Progress</Table.Th>
              <Table.Th>Activity</Table.Th>
              <Table.Th>Submitted</Table.Th>
              <Table.Th></Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {manuscripts.map((manuscript) => (
              <Table.Tr key={manuscript.id}>
                <Table.Td>
                  <Stack gap={4}>
                    <Anchor
                      component={Link}
                      href={`/manuscripts/${manuscript.id}`}
                      size="sm"
                      fw={500}
                      lineClamp={1}
                    >
                      {manuscript.title}
                    </Anchor>
                    <Text size="xs" c="dimmed">
                      {manuscript.authors.join(', ')}
                    </Text>
                  </Stack>
                </Table.Td>
                <Table.Td>
                  <Badge 
                    color={getStatusColor(manuscript.status)} 
                    variant="light"
                    size="sm"
                  >
                    {getStatusLabel(manuscript.status)}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Stack gap={4}>
                    <Progress
                      value={manuscript.reviewProgress}
                      color={getProgressColor(manuscript.reviewProgress)}
                      size="sm"
                      w={80}
                    />
                    <Text size="xs" c="dimmed">
                      {manuscript.reviewProgress}%
                    </Text>
                  </Stack>
                </Table.Td>
                <Table.Td>
                  <Group gap="xs">
                    <Group gap={4}>
                      <IconMessage size={14} />
                      <Text size="xs">{manuscript.conversationCount}</Text>
                    </Group>
                    <Group gap={4}>
                      <IconUsers size={14} />
                      <Text size="xs">{manuscript.reviewerCount}</Text>
                    </Group>
                  </Group>
                </Table.Td>
                <Table.Td>
                  <Group gap={4}>
                    <IconClock size={14} />
                    <Text size="xs" c="dimmed">
                      {formatDate(manuscript.submittedAt)}
                    </Text>
                  </Group>
                </Table.Td>
                <Table.Td>
                  <Menu shadow="md" width={150} position="bottom-end">
                    <Menu.Target>
                      <ActionIcon variant="subtle" size="sm">
                        <IconDots size={14} />
                      </ActionIcon>
                    </Menu.Target>
                    <Menu.Dropdown>
                      <Menu.Item 
                        leftSection={<IconEye size={14} />}
                        component={Link}
                        href={`/manuscripts/${manuscript.id}`}
                      >
                        View Details
                      </Menu.Item>
                      <Menu.Item 
                        leftSection={<IconMessage size={14} />}
                        component={Link}
                        href={`/conversations?manuscript=${manuscript.id}`}
                      >
                        Conversations
                      </Menu.Item>
                      <Menu.Item leftSection={<IconEdit size={14} />}>
                        Edit
                      </Menu.Item>
                      <Menu.Divider />
                      <Menu.Item 
                        leftSection={<IconTrash size={14} />}
                        color="red"
                      >
                        Delete
                      </Menu.Item>
                    </Menu.Dropdown>
                  </Menu>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Stack>
    </Card>
  );
}