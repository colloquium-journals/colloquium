'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import {
  Container,
  Stack,
  Title,
  Card,
  Grid,
  Text,
  Group,
  Badge,
  Anchor,
  Loader,
  Alert,
  Avatar,
  Paper,
  Divider
} from '@mantine/core';
import {
  IconFileText,
  IconExternalLink,
  IconCalendar,
  IconMessage,
  IconAlertCircle,
  IconUser,
  IconCheck
} from '@tabler/icons-react';
import Link from 'next/link';
import { format } from 'date-fns';

interface PublicProfile {
  id: string;
  name: string | null;
  orcidId: string | null;
  orcidVerified: boolean;
  bio: string | null;
  affiliation: string | null;
  website: string | null;
  role: string;
  memberSince: string;
  stats: {
    publishedPapers: number;
  };
  publishedPapers: Array<{
    id: string;
    title: string;
    abstract: string;
    publishedAt: string;
    conversationCount: number;
    order: number;
    isCorresponding: boolean;
  }>;
}

export default function PublicProfilePage() {
  const params = useParams();
  const userId = params.id as string;
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await fetch(`http://localhost:4000/api/users/${userId}`);

        if (!response.ok) {
          if (response.status === 404) {
            throw new Error('User not found');
          }
          throw new Error('Failed to fetch user profile');
        }

        const data = await response.json();
        setProfile(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load profile');
      } finally {
        setLoading(false);
      }
    };

    if (userId) {
      fetchProfile();
    }
  }, [userId]);

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

  if (loading) {
    return (
      <Container size="lg" py="xl">
        <Stack align="center" gap="md">
          <Loader size="lg" />
          <Text>Loading profile...</Text>
        </Stack>
      </Container>
    );
  }

  if (error || !profile) {
    return (
      <Container size="lg" py="xl">
        <Alert icon={<IconAlertCircle size={16} />} color="red">
          {error || 'Profile not found'}
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
                  {profile.name ? profile.name.charAt(0).toUpperCase() : <IconUser size={32} />}
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
                      {profile.orcidVerified && (
                        <Badge size="xs" color="green" variant="light" leftSection={<IconCheck size={10} />}>
                          Verified
                        </Badge>
                      )}
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
                    Member since {formatDate(profile.memberSince)}
                  </Text>
                </Stack>
              </Group>
            </Grid.Col>
            
            <Grid.Col span={{ base: 12, md: 4 }}>
              <Paper withBorder p="md" radius="md">
                <Stack gap="xs">
                  <Text fw={500} size="sm">Publications</Text>
                  <Group justify="space-between">
                    <Text size="xs" c="dimmed">Published Papers</Text>
                    <Text size="lg" fw={700} c="blue">
                      {profile.stats.publishedPapers}
                    </Text>
                  </Group>
                </Stack>
              </Paper>
            </Grid.Col>
          </Grid>
        </Card>

        {/* Published Papers */}
        <Card shadow="sm" padding="lg" radius="md">
          <Stack gap="md">
            <Title order={3}>Published Papers</Title>
            
            {profile.publishedPapers.length === 0 ? (
              <Stack align="center" gap="md" py="xl">
                <IconFileText size={48} color="gray" />
                <Text size="lg" fw={500} c="dimmed">No published papers</Text>
                <Text c="dimmed" ta="center">
                  This researcher hasn't published any papers yet.
                </Text>
              </Stack>
            ) : (
              <Stack gap="lg">
                {profile.publishedPapers.map((paper) => (
                  <div key={paper.id}>
                    <Stack gap="xs">
                      <Group justify="space-between" align="flex-start">
                        <Stack gap="xs" style={{ flex: 1 }}>
                          <Group gap="xs">
                            <Anchor
                              component={Link}
                              href={`/manuscripts/${paper.id}`}
                              fw={500}
                              size="lg"
                            >
                              {paper.title}
                            </Anchor>
                            {paper.isCorresponding && (
                              <Badge color="blue" variant="outline" size="sm">
                                Corresponding Author
                              </Badge>
                            )}
                          </Group>
                          
                          <Text size="sm" c="dimmed" lineClamp={3}>
                            {paper.abstract}
                          </Text>
                          
                          <Group gap="lg">
                            <Group gap="xs">
                              <IconCalendar size={14} />
                              <Text size="xs" c="dimmed">
                                Published: {formatDate(paper.publishedAt)}
                              </Text>
                            </Group>
                            
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
                      </Group>
                    </Stack>
                    
                    {paper !== profile.publishedPapers[profile.publishedPapers.length - 1] && (
                      <Divider my="lg" />
                    )}
                  </div>
                ))}
              </Stack>
            )}
          </Stack>
        </Card>

        {/* ORCID Integration Notice */}
        {profile.orcidId && profile.orcidVerified && (
          <Card shadow="xs" padding="md" radius="md" bg="green.0">
            <Group gap="xs">
              <IconCheck size={16} color="var(--mantine-color-green-6)" />
              <Text size="sm">
                This profile is verified through ORCID OAuth.
              </Text>
              <Anchor
                href={`https://orcid.org/${profile.orcidId}`}
                target="_blank"
                size="sm"
              >
                View ORCID profile
              </Anchor>
            </Group>
          </Card>
        )}
      </Stack>
    </Container>
  );
}