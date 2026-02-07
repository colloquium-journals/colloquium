'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Container,
  Stack,
  Title,
  Text,
  Button,
  Group,
  Loader,
  Alert,
  Paper,
  Breadcrumbs,
  Anchor,
  Badge,
  Divider
} from '@mantine/core';
import {
  IconAlertCircle,
  IconArrowLeft,
  IconClock,
  IconCalendar,
  IconExternalLink
} from '@tabler/icons-react';
import Link from 'next/link';
import { format } from 'date-fns';
import { API_URL } from '@/lib/api';

interface ContentPage {
  section: string;
  page: string;
  title: string;
  description: string;
  lastUpdated: string;
  frontmatter: any;
  content: string;
  html: string;
  wordCount: number;
  readingTime: number;
}

interface EditorialBoardMember {
  id: string;
  name: string;
  email: string;
  bio: string | null;
  affiliation: string | null;
  website: string | null;
  orcidId: string | null;
  role: string;
  memberSince: string;
  stats: {
    publishedPapers: number;
    completedReviews: number;
  };
  profileUrl: string;
}

interface EditorialBoardData {
  title: string;
  description: string;
  content: string;
  lastUpdated: string;
  members: EditorialBoardMember[];
  totalMembers: number;
  roles: {
    admins: number;
    editors: number;
  };
}

export default function AboutPageDetail() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  
  const [pageData, setPageData] = useState<ContentPage | null>(null);
  const [editorialData, setEditorialData] = useState<EditorialBoardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchContent = async () => {
      try {
        if (slug === 'editorial-board') {
          // Special handling for editorial board
          const response = await fetch(`${API_URL}/api/content/editorial-board`);
          if (!response.ok) {
            throw new Error('Failed to fetch editorial board');
          }
          const data = await response.json();
          setEditorialData(data);
        } else {
          // Regular content page
          const response = await fetch(`${API_URL}/api/content/about/${slug}`);
          if (!response.ok) {
            if (response.status === 404) {
              throw new Error('Page not found');
            }
            throw new Error('Failed to fetch page content');
          }
          const data = await response.json();
          setPageData(data);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load content');
      } finally {
        setLoading(false);
      }
    };

    if (slug) {
      fetchContent();
    }
  }, [slug]);

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'MMM dd, yyyy');
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'ADMIN': return 'red';
      case 'EDITOR': return 'blue';
      default: return 'gray';
    }
  };

  if (loading) {
    return (
      <Container size="md" py="xl">
        <Stack align="center" gap="md">
          <Loader size="lg" />
          <Text>Loading content...</Text>
        </Stack>
      </Container>
    );
  }

  if (error) {
    return (
      <Container size="md" py="xl">
        <Stack gap="md">
          <Alert icon={<IconAlertCircle size={16} />} color="red">
            {error}
          </Alert>
          <Button
            variant="outline"
            leftSection={<IconArrowLeft size={16} />}
            onClick={() => router.back()}
          >
            Go Back
          </Button>
        </Stack>
      </Container>
    );
  }

  // Render editorial board page
  if (editorialData) {
    return (
      <Container size="lg" py="xl">
        <Stack gap="xl">
          {/* Breadcrumbs */}
          <Breadcrumbs>
            <Anchor component={Link} href="/about">About</Anchor>
            <Text>Editorial Board</Text>
          </Breadcrumbs>

          {/* Header */}
          <Stack gap="md">
            <Group justify="space-between" align="flex-start">
              <Stack gap="xs">
                <Title order={1}>{editorialData.title}</Title>
                <Text size="lg" c="dimmed">
                  {editorialData.description}
                </Text>
              </Stack>
              <Button
                variant="outline"
                leftSection={<IconArrowLeft size={16} />}
                component={Link}
                href="/about"
              >
                Back to About
              </Button>
            </Group>

            <Group gap="lg">
              <Group gap="xs">
                <IconCalendar size={14} />
                <Text size="sm" c="dimmed">
                  Updated {formatDate(editorialData.lastUpdated)}
                </Text>
              </Group>
              <Badge variant="light">
                {editorialData.totalMembers} member{editorialData.totalMembers !== 1 ? 's' : ''}
              </Badge>
            </Group>
          </Stack>

          {/* Editorial Board Content */}
          {editorialData.content && (
            <Paper withBorder p="lg" radius="md">
              <div 
                dangerouslySetInnerHTML={{ __html: editorialData.content }}
                style={{ 
                  lineHeight: 1.6,
                  fontSize: '16px'
                }}
              />
            </Paper>
          )}

          {/* Board Members */}
          <Stack gap="md">
            <Group justify="space-between">
              <Title order={2}>Current Board Members</Title>
              <Group gap="md">
                <Badge color="red" variant="light">
                  {editorialData.roles.admins} Admin{editorialData.roles.admins !== 1 ? 's' : ''}
                </Badge>
                <Badge color="blue" variant="light">
                  {editorialData.roles.editors} Editor{editorialData.roles.editors !== 1 ? 's' : ''}
                </Badge>
              </Group>
            </Group>

            <Stack gap="lg">
              {editorialData.members.map((member) => (
                <Paper key={member.id} withBorder p="lg" radius="md">
                  <Group align="flex-start" gap="lg">
                    <Stack gap="xs" style={{ flex: 1 }}>
                      <Group gap="xs">
                        <Title order={3} size="lg">
                          {member.name}
                        </Title>
                        <Badge color={getRoleColor(member.role)} variant="light">
                          {member.role}
                        </Badge>
                      </Group>

                      {member.affiliation && (
                        <Text size="sm" fw={500}>
                          {member.affiliation}
                        </Text>
                      )}

                      {member.bio && (
                        <Text size="sm" lineClamp={3}>
                          {member.bio}
                        </Text>
                      )}

                      <Group gap="lg">
                        {member.orcidId && (
                          <Group gap="xs">
                            <Anchor
                              href={`https://orcid.org/${member.orcidId}`}
                              target="_blank"
                              size="sm"
                            >
                              ORCID: {member.orcidId}
                            </Anchor>
                            <IconExternalLink size={12} />
                          </Group>
                        )}
                        
                        {member.website && (
                          <Group gap="xs">
                            <Anchor
                              href={member.website}
                              target="_blank"
                              size="sm"
                            >
                              Website
                            </Anchor>
                            <IconExternalLink size={12} />
                          </Group>
                        )}
                      </Group>

                      <Group gap="lg">
                        <Text size="xs" c="dimmed">
                          {member.stats.publishedPapers} published paper{member.stats.publishedPapers !== 1 ? 's' : ''}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {member.stats.completedReviews} completed review{member.stats.completedReviews !== 1 ? 's' : ''}
                        </Text>
                        <Text size="xs" c="dimmed">
                          Member since {formatDate(member.memberSince)}
                        </Text>
                      </Group>
                    </Stack>

                    <Button
                      variant="outline"
                      size="sm"
                      component={Link}
                      href={member.profileUrl}
                    >
                      View Profile
                    </Button>
                  </Group>
                </Paper>
              ))}
            </Stack>
          </Stack>
        </Stack>
      </Container>
    );
  }

  // Render regular content page
  if (!pageData) {
    return null;
  }

  return (
    <Container size="md" py="xl">
      <Stack gap="xl">
        {/* Breadcrumbs */}
        <Breadcrumbs>
          <Anchor component={Link} href="/about">About</Anchor>
          <Text>{pageData.title}</Text>
        </Breadcrumbs>

        {/* Header */}
        <Stack gap="md">
          <Group justify="space-between" align="flex-start">
            <Stack gap="xs">
              <Title order={1}>{pageData.title}</Title>
              {pageData.description && (
                <Text size="lg" c="dimmed">
                  {pageData.description}
                </Text>
              )}
            </Stack>
            <Button
              variant="outline"
              leftSection={<IconArrowLeft size={16} />}
              component={Link}
              href="/about"
            >
              Back to About
            </Button>
          </Group>

          <Group gap="lg">
            <Group gap="xs">
              <IconClock size={14} />
              <Text size="sm" c="dimmed">
                {pageData.readingTime} min read
              </Text>
            </Group>
            <Group gap="xs">
              <IconCalendar size={14} />
              <Text size="sm" c="dimmed">
                Updated {formatDate(pageData.lastUpdated)}
              </Text>
            </Group>
          </Group>
        </Stack>

        <Divider />

        {/* Content */}
        <Paper withBorder p="xl" radius="md">
          <div 
            dangerouslySetInnerHTML={{ __html: pageData.html }}
            style={{ 
              lineHeight: 1.7,
              fontSize: '16px'
            }}
          />
        </Paper>

        {/* Footer */}
        <Group justify="center">
          <Button
            variant="outline"
            component={Link}
            href="/about"
          >
            Back to About
          </Button>
        </Group>
      </Stack>
    </Container>
  );
}