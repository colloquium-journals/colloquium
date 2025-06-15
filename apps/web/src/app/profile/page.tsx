'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  Container,
  Stack,
  Title,
  Card,
  Grid,
  Text,
  Button,
  Group,
  Badge,
  Anchor,
  Loader,
  Alert,
  Tabs,
  Table,
  Avatar,
  Divider,
  SimpleGrid,
  Paper,
  Progress
} from '@mantine/core';
import {
  IconUser,
  IconEdit,
  IconFileText,
  IconEye,
  IconMessage,
  IconCalendar,
  IconExternalLink,
  IconCheck,
  IconClock,
  IconAlertCircle
} from '@tabler/icons-react';
import Link from 'next/link';
import { format } from 'date-fns';

interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  orcidId: string | null;
  bio: string | null;
  affiliation: string | null;
  website: string | null;
  role: string;
  createdAt: string;
  updatedAt: string;
  stats: {
    authoredPapers: number;
    reviewsCompleted: number;
    messagesPosted: number;
    conversationsJoined: number;
  };
  authoredPapers: Array<{
    id: string;
    title: string;
    status: string;
    submittedAt: string;
    publishedAt: string | null;
    conversationCount: number;
    order: number;
    isCorresponding: boolean;
  }>;
  reviewAssignments: Array<{
    id: string;
    manuscript: {
      id: string;
      title: string;
      status: string;
      submittedAt: string;
    };
    status: string;
    assignedAt: string;
    dueDate: string | null;
    completedAt: string | null;
  }>;
}

export default function ProfilePage() {
  const { user, isAuthenticated } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!isAuthenticated) {
        setLoading(false);
        return;
      }

      try {
        const response = await fetch('http://localhost:4000/api/users/me', {
          credentials: 'include'
        });

        if (!response.ok) {
          throw new Error('Failed to fetch profile');
        }

        const data = await response.json();
        setProfile(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load profile');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [isAuthenticated]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PUBLISHED': return 'green';
      case 'UNDER_REVIEW': return 'blue';
      case 'REVISION_REQUESTED': return 'yellow';
      case 'SUBMITTED': return 'gray';
      case 'REJECTED': return 'red';
      case 'COMPLETED': return 'green';
      case 'PENDING': return 'orange';
      default: return 'gray';
    }
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'MMM dd, yyyy');
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'ADMIN': return 'red';
      case 'EDITOR': return 'blue';
      case 'REVIEWER': return 'green';
      case 'AUTHOR': return 'gray';
      default: return 'gray';
    }
  };

  if (!isAuthenticated) {
    return (
      <Container size="md" py="xl">
        <Alert icon={<IconAlertCircle size={16} />} color="red">
          Please sign in to view your profile.
        </Alert>
      </Container>
    );
  }

  if (loading) {
    return (
      <Container size="md" py="xl">
        <Stack align="center" gap="md">
          <Loader size="lg" />
          <Text>Loading your profile...</Text>
        </Stack>
      </Container>
    );
  }

  if (error || !profile) {
    return (
      <Container size="md" py="xl">
        <Alert icon={<IconAlertCircle size={16} />} color="red">
          {error || 'Failed to load profile'}
        </Alert>
      </Container>
    );
  }

  return (
    <Container size="lg" py="xl">
      <Stack gap="xl">
        {/* Profile Header */}
        <Card shadow="sm" padding="xl" radius="md">
          <Grid>
            <Grid.Col span={{ base: 12, md: 8 }}>
              <Group gap="lg" align="flex-start">
                <Avatar size="xl" color="blue">
                  {profile.name ? profile.name.charAt(0).toUpperCase() : profile.email.charAt(0).toUpperCase()}
                </Avatar>
                
                <Stack gap="xs" style={{ flex: 1 }}>
                  <Group gap="xs" align="center">
                    <Title order={2}>
                      {profile.name || 'Anonymous User'}
                    </Title>
                    <Badge color={getRoleColor(profile.role)} variant="light">
                      {profile.role}
                    </Badge>
                  </Group>
                  
                  <Text size="sm" c="dimmed">
                    {profile.email}
                  </Text>
                  
                  {profile.affiliation && (
                    <Text size="sm">
                      <strong>Affiliation:</strong> {profile.affiliation}
                    </Text>
                  )}
                  
                  {profile.orcidId && (
                    <Group gap="xs">
                      <Text size="sm">
                        <strong>ORCID:</strong>
                      </Text>
                      <Anchor
                        href={`https://orcid.org/${profile.orcidId}`}
                        target="_blank"
                        size="sm"
                      >
                        {profile.orcidId}
                        <IconExternalLink size={12} style={{ marginLeft: 4 }} />
                      </Anchor>
                    </Group>
                  )}
                  
                  {profile.website && (
                    <Group gap="xs">
                      <Text size="sm">
                        <strong>Website:</strong>
                      </Text>
                      <Anchor href={profile.website} target="_blank" size="sm">
                        {profile.website}
                        <IconExternalLink size={12} style={{ marginLeft: 4 }} />
                      </Anchor>
                    </Group>
                  )}
                  
                  {profile.bio && (
                    <Text size="sm" style={{ marginTop: 8 }}>
                      {profile.bio}
                    </Text>
                  )}
                  
                  <Text size="xs" c="dimmed">
                    Member since {formatDate(profile.createdAt)}
                  </Text>
                </Stack>
              </Group>
            </Grid.Col>
            
            <Grid.Col span={{ base: 12, md: 4 }}>
              <Stack gap="md">
                <Button
                  leftSection={<IconEdit size={16} />}
                  component={Link}
                  href="/profile/edit"
                  variant="light"
                  fullWidth
                >
                  Edit Profile
                </Button>
                
                {/* Quick Stats */}
                <Paper withBorder p="md" radius="md">
                  <Stack gap="xs">
                    <Text fw={500} size="sm">Quick Stats</Text>
                    <Group justify="space-between">
                      <Text size="xs" c="dimmed">Papers</Text>
                      <Text size="sm" fw={500}>{profile.stats.authoredPapers}</Text>
                    </Group>
                    <Group justify="space-between">
                      <Text size="xs" c="dimmed">Reviews</Text>
                      <Text size="sm" fw={500}>{profile.stats.reviewsCompleted}</Text>
                    </Group>
                    <Group justify="space-between">
                      <Text size="xs" c="dimmed">Messages</Text>
                      <Text size="sm" fw={500}>{profile.stats.messagesPosted}</Text>
                    </Group>
                    <Group justify="space-between">
                      <Text size="xs" c="dimmed">Conversations</Text>
                      <Text size="sm" fw={500}>{profile.stats.conversationsJoined}</Text>
                    </Group>
                  </Stack>
                </Paper>
              </Stack>
            </Grid.Col>
          </Grid>
        </Card>

        {/* Tabbed Content */}
        <Tabs defaultValue="papers">
          <Tabs.List>
            <Tabs.Tab value="papers" leftSection={<IconFileText size={16} />}>
              My Papers ({profile.authoredPapers.length})
            </Tabs.Tab>
            <Tabs.Tab value="reviews" leftSection={<IconEye size={16} />}>
              Review Assignments ({profile.reviewAssignments.length})
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="papers" pt="md">
            {profile.authoredPapers.length === 0 ? (
              <Card shadow="xs" padding="xl" radius="md">
                <Stack align="center" gap="md">
                  <IconFileText size={48} color="gray" />
                  <Text size="lg" fw={500}>No papers yet</Text>
                  <Text c="dimmed" ta="center">
                    Start by submitting your first manuscript to begin building your academic portfolio.
                  </Text>
                  <Button component={Link} href="/manuscripts/submit">
                    Submit Paper
                  </Button>
                </Stack>
              </Card>
            ) : (
              <Stack gap="md">
                {profile.authoredPapers.map((paper) => (
                  <Card key={paper.id} shadow="sm" padding="lg" radius="md">
                    <Group justify="space-between" align="flex-start">
                      <Stack gap="xs" style={{ flex: 1 }}>
                        <Group gap="xs">
                          <Anchor
                            component={Link}
                            href={`/manuscripts/${paper.id}`}
                            fw={500}
                            lineClamp={2}
                          >
                            {paper.title}
                          </Anchor>
                          <Badge color={getStatusColor(paper.status)} variant="light" size="sm">
                            {paper.status}
                          </Badge>
                          {paper.isCorresponding && (
                            <Badge color="blue" variant="outline" size="sm">
                              Corresponding Author
                            </Badge>
                          )}
                        </Group>
                        
                        <Group gap="lg">
                          <Group gap="xs">
                            <IconCalendar size={14} />
                            <Text size="xs" c="dimmed">
                              Submitted: {formatDate(paper.submittedAt)}
                            </Text>
                          </Group>
                          
                          {paper.publishedAt && (
                            <Group gap="xs">
                              <IconCheck size={14} />
                              <Text size="xs" c="dimmed">
                                Published: {formatDate(paper.publishedAt)}
                              </Text>
                            </Group>
                          )}
                          
                          {paper.conversationCount > 0 && (
                            <Group gap="xs">
                              <IconMessage size={14} />
                              <Text size="xs" c="dimmed">
                                {paper.conversationCount} conversation{paper.conversationCount !== 1 ? 's' : ''}
                              </Text>
                            </Group>
                          )}
                        </Group>
                      </Stack>
                      
                      <Button
                        size="xs"
                        variant="outline"
                        component={Link}
                        href={`/manuscripts/${paper.id}`}
                      >
                        View
                      </Button>
                    </Group>
                  </Card>
                ))}
              </Stack>
            )}
          </Tabs.Panel>

          <Tabs.Panel value="reviews" pt="md">
            {profile.reviewAssignments.length === 0 ? (
              <Card shadow="xs" padding="xl" radius="md">
                <Stack align="center" gap="md">
                  <IconEye size={48} color="gray" />
                  <Text size="lg" fw={500}>No review assignments</Text>
                  <Text c="dimmed" ta="center">
                    You haven't been assigned any papers to review yet.
                  </Text>
                </Stack>
              </Card>
            ) : (
              <Stack gap="md">
                {profile.reviewAssignments.map((assignment) => (
                  <Card key={assignment.id} shadow="sm" padding="lg" radius="md">
                    <Group justify="space-between" align="flex-start">
                      <Stack gap="xs" style={{ flex: 1 }}>
                        <Group gap="xs">
                          <Anchor
                            component={Link}
                            href={`/manuscripts/${assignment.manuscript.id}`}
                            fw={500}
                            lineClamp={2}
                          >
                            {assignment.manuscript.title}
                          </Anchor>
                          <Badge color={getStatusColor(assignment.status)} variant="light" size="sm">
                            {assignment.status}
                          </Badge>
                        </Group>
                        
                        <Group gap="lg">
                          <Group gap="xs">
                            <IconCalendar size={14} />
                            <Text size="xs" c="dimmed">
                              Assigned: {formatDate(assignment.assignedAt)}
                            </Text>
                          </Group>
                          
                          {assignment.dueDate && (
                            <Group gap="xs">
                              <IconClock size={14} />
                              <Text size="xs" c="dimmed">
                                Due: {formatDate(assignment.dueDate)}
                              </Text>
                            </Group>
                          )}
                          
                          {assignment.completedAt && (
                            <Group gap="xs">
                              <IconCheck size={14} />
                              <Text size="xs" c="dimmed">
                                Completed: {formatDate(assignment.completedAt)}
                              </Text>
                            </Group>
                          )}
                        </Group>
                      </Stack>
                      
                      <Button
                        size="xs"
                        variant="outline"
                        component={Link}
                        href={`/manuscripts/${assignment.manuscript.id}`}
                      >
                        View
                      </Button>
                    </Group>
                  </Card>
                ))}
              </Stack>
            )}
          </Tabs.Panel>
        </Tabs>
      </Stack>
    </Container>
  );
}