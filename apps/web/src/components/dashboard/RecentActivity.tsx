'use client';

import { useState } from 'react';
import { 
  Card, 
  Title, 
  Stack, 
  Group, 
  Text, 
  Avatar, 
  Badge,
  Button,
  Timeline,
  ThemeIcon,
  Anchor
} from '@mantine/core';
import { 
  IconMessage, 
  IconFileText, 
  IconUserPlus, 
  IconRobot, 
  IconCheck,
  IconX,
  IconEdit,
  IconUpload
} from '@tabler/icons-react';
import Link from 'next/link';

interface Activity {
  id: string;
  type: 'MESSAGE' | 'MANUSCRIPT_SUBMITTED' | 'REVIEWER_ASSIGNED' | 'BOT_ACTION' | 'REVIEW_COMPLETED' | 'MANUSCRIPT_ACCEPTED' | 'MANUSCRIPT_REJECTED' | 'MANUSCRIPT_REVISED';
  title: string;
  description: string;
  user: {
    name: string;
    isBot: boolean;
  };
  timestamp: string;
  relatedItem?: {
    type: 'manuscript' | 'conversation';
    id: string;
    title: string;
  };
}

export function RecentActivity() {
  // Mock data - will be replaced with real API data
  const [activities] = useState<Activity[]>([
    {
      id: '1',
      type: 'MESSAGE',
      title: 'New message in Editorial Review',
      description: 'The methodology section needs more detail on the data collection process.',
      user: {
        name: 'Dr. Jane Smith',
        isBot: false
      },
      timestamp: '2024-01-22T14:30:00Z',
      relatedItem: {
        type: 'conversation',
        id: '1',
        title: 'Editorial Review Discussion'
      }
    },
    {
      id: '2',
      type: 'BOT_ACTION',
      title: 'Statistical analysis completed',
      description: 'No significant issues found in the methodology section.',
      user: {
        name: 'Statistics Reviewer',
        isBot: true
      },
      timestamp: '2024-01-22T13:15:00Z',
      relatedItem: {
        type: 'manuscript',
        id: '2',
        title: 'Machine Learning Applications in Scientific Publishing'
      }
    },
    {
      id: '3',
      type: 'MANUSCRIPT_SUBMITTED',
      title: 'New manuscript submitted',
      description: 'Decentralized Peer Review: A Blockchain Approach',
      user: {
        name: 'Prof. Bob Wilson',
        isBot: false
      },
      timestamp: '2024-01-22T12:45:00Z',
      relatedItem: {
        type: 'manuscript',
        id: '3',
        title: 'Decentralized Peer Review: A Blockchain Approach'
      }
    },
    {
      id: '4',
      type: 'REVIEWER_ASSIGNED',
      title: 'Reviewer assigned',
      description: 'Dr. Carol Brown assigned as reviewer for manuscript',
      user: {
        name: 'Editor User',
        isBot: false
      },
      timestamp: '2024-01-22T11:20:00Z',
      relatedItem: {
        type: 'manuscript',
        id: '1',
        title: 'A Novel Approach to Academic Publishing'
      }
    },
    {
      id: '5',
      type: 'BOT_ACTION',
      title: 'Plagiarism check completed',
      description: 'No significant plagiarism detected. Confidence level: 95%',
      user: {
        name: 'Plagiarism Checker',
        isBot: true
      },
      timestamp: '2024-01-22T10:30:00Z',
      relatedItem: {
        type: 'manuscript',
        id: '3',
        title: 'Decentralized Peer Review: A Blockchain Approach'
      }
    },
    {
      id: '6',
      type: 'MANUSCRIPT_REVISED',
      title: 'Manuscript revised',
      description: 'Author submitted revised version addressing reviewer comments',
      user: {
        name: 'Dr. Emily Davis',
        isBot: false
      },
      timestamp: '2024-01-22T09:15:00Z',
      relatedItem: {
        type: 'manuscript',
        id: '4',
        title: 'Open Science and Collaborative Research Platforms'
      }
    }
  ]);

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'MESSAGE': return <IconMessage size={16} />;
      case 'MANUSCRIPT_SUBMITTED': return <IconUpload size={16} />;
      case 'REVIEWER_ASSIGNED': return <IconUserPlus size={16} />;
      case 'BOT_ACTION': return <IconRobot size={16} />;
      case 'REVIEW_COMPLETED': return <IconCheck size={16} />;
      case 'MANUSCRIPT_ACCEPTED': return <IconCheck size={16} />;
      case 'MANUSCRIPT_REJECTED': return <IconX size={16} />;
      case 'MANUSCRIPT_REVISED': return <IconEdit size={16} />;
      default: return <IconFileText size={16} />;
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'MESSAGE': return 'blue';
      case 'MANUSCRIPT_SUBMITTED': return 'green';
      case 'REVIEWER_ASSIGNED': return 'orange';
      case 'BOT_ACTION': return 'violet';
      case 'REVIEW_COMPLETED': return 'teal';
      case 'MANUSCRIPT_ACCEPTED': return 'green';
      case 'MANUSCRIPT_REJECTED': return 'red';
      case 'MANUSCRIPT_REVISED': return 'yellow';
      default: return 'gray';
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor(diffMs / (1000 * 60));

    if (diffMinutes < 60) {
      return `${diffMinutes}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else {
      const diffDays = Math.floor(diffHours / 24);
      return `${diffDays}d ago`;
    }
  };

  return (
    <Card shadow="sm" padding="lg" radius="md">
      <Stack gap="md">
        <Group justify="space-between" align="center">
          <Title order={3}>Recent Activity</Title>
          <Button size="xs" variant="light">
            View All
          </Button>
        </Group>

        <Timeline active={activities.length} bulletSize={24} lineWidth={2}>
          {activities.map((activity) => (
            <Timeline.Item
              key={activity.id}
              bullet={
                <ThemeIcon 
                  color={getActivityColor(activity.type)} 
                  size={24} 
                  radius="xl"
                  variant="light"
                >
                  {getActivityIcon(activity.type)}
                </ThemeIcon>
              }
            >
              <Stack gap="xs">
                <Group justify="space-between" align="flex-start">
                  <div style={{ flex: 1 }}>
                    <Text size="sm" fw={500}>
                      {activity.title}
                    </Text>
                    <Text size="xs" c="dimmed" mt={2}>
                      {activity.description}
                    </Text>
                  </div>
                  <Text size="xs" c="dimmed" style={{ flexShrink: 0 }}>
                    {formatTimeAgo(activity.timestamp)}
                  </Text>
                </Group>

                <Group gap="xs" align="center">
                  <Avatar 
                    size="xs" 
                    color={activity.user.isBot ? 'blue' : 'gray'}
                    radius="xl"
                  >
                    {activity.user.isBot ? (
                      <IconRobot size={12} />
                    ) : (
                      activity.user.name.charAt(0)
                    )}
                  </Avatar>
                  <Text size="xs" c="dimmed">
                    {activity.user.name}
                  </Text>
                  {activity.user.isBot && (
                    <Badge size="xs" variant="light" color="blue">
                      Bot
                    </Badge>
                  )}
                </Group>

                {activity.relatedItem && (
                  <Anchor
                    component={Link}
                    href={
                      activity.relatedItem.type === 'manuscript'
                        ? `/manuscripts/${activity.relatedItem.id}`
                        : `/conversations/${activity.relatedItem.id}`
                    }
                    size="xs"
                    lineClamp={1}
                  >
                    → {activity.relatedItem.title}
                  </Anchor>
                )}
              </Stack>
            </Timeline.Item>
          ))}
        </Timeline>
      </Stack>
    </Card>
  );
}