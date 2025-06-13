'use client';

import { Grid, Card, Text, Group, ThemeIcon, Stack } from '@mantine/core';
import { 
  IconFileText, 
  IconMessageCircle, 
  IconUsers, 
  IconRobot,
  IconTrendingUp,
  IconClock
} from '@tabler/icons-react';

interface StatCard {
  title: string;
  value: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  trend?: {
    value: string;
    positive: boolean;
  };
}

export function OverviewCards() {
  // Mock data - will be replaced with real API data
  const stats: StatCard[] = [
    {
      title: 'Active Manuscripts',
      value: '12',
      description: 'Manuscripts in review process',
      icon: <IconFileText size={24} />,
      color: 'blue',
      trend: { value: '+2', positive: true }
    },
    {
      title: 'Open Conversations',
      value: '28',
      description: 'Active review discussions',
      icon: <IconMessageCircle size={24} />,
      color: 'orange',
      trend: { value: '+5', positive: true }
    },
    {
      title: 'Active Reviewers',
      value: '47',
      description: 'Reviewers participating this month',
      icon: <IconUsers size={24} />,
      color: 'green',
      trend: { value: '+8', positive: true }
    },
    {
      title: 'Bot Actions',
      value: '156',
      description: 'Automated tasks completed today',
      icon: <IconRobot size={24} />,
      color: 'violet',
      trend: { value: '+23', positive: true }
    },
    {
      title: 'Review Completion',
      value: '78%',
      description: 'Average review completion rate',
      icon: <IconTrendingUp size={24} />,
      color: 'teal',
      trend: { value: '+5%', positive: true }
    },
    {
      title: 'Avg Review Time',
      value: '14 days',
      description: 'Average time to complete review',
      icon: <IconClock size={24} />,
      color: 'red',
      trend: { value: '-2 days', positive: true }
    }
  ];

  return (
    <Grid>
      {stats.map((stat, index) => (
        <Grid.Col key={index} span={{ base: 12, xs: 6, md: 4, lg: 2 }}>
          <Card shadow="sm" padding="lg" radius="md" h="100%">
            <Stack gap="xs">
              <Group justify="space-between" align="flex-start">
                <Text size="xs" tt="uppercase" fw={700} c="dimmed">
                  {stat.title}
                </Text>
                <ThemeIcon color={stat.color} variant="light" size="sm">
                  {stat.icon}
                </ThemeIcon>
              </Group>
              
              <Text size="xl" fw={700}>
                {stat.value}
              </Text>
              
              <Text size="xs" c="dimmed">
                {stat.description}
              </Text>
              
              {stat.trend && (
                <Group gap={4}>
                  <Text 
                    size="xs" 
                    fw={500}
                    c={stat.trend.positive ? 'teal' : 'red'}
                  >
                    {stat.trend.value}
                  </Text>
                  <Text size="xs" c="dimmed">
                    this month
                  </Text>
                </Group>
              )}
            </Stack>
          </Card>
        </Grid.Col>
      ))}
    </Grid>
  );
}