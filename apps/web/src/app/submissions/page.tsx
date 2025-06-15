'use client';

import { useState, useEffect } from 'react';
import { 
  Title, 
  Grid, 
  Card, 
  Text, 
  Badge, 
  Group, 
  Stack, 
  Loader, 
  Alert,
  TextInput,
  Select,
  Pagination,
  Anchor,
  Button,
  Avatar,
  Divider,
  Paper
} from '@mantine/core';
import { 
  IconSearch, 
  IconAlertCircle, 
  IconMessage, 
  IconUsers, 
  IconClock,
  IconPlus,
  IconRobot
} from '@tabler/icons-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Breadcrumbs } from '@/components/navigation/Breadcrumbs';
interface Submission {
  id: string;
  title: string;
  type: string;
  privacy: string;
  manuscript: {
    id: string;
    title: string;
    authors: string[];
  };
  messageCount: number;
  participantCount: number;
  lastMessage: {
    id: string;
    content: string;
    author: {
      id: string;
      name: string;
      email: string;
    };
    createdAt: string;
    isBot: boolean;
  } | null;
  createdAt: string;
  updatedAt: string;
}

interface SubmissionsResponse {
  conversations: Submission[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export default function SubmissionsPage() {
  const router = useRouter();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 12, total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [privacyFilter, setPrivacyFilter] = useState('');

  const fetchSubmissions = async (page = 1) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pagination.limit.toString()
      });

      if (typeFilter) params.append('type', typeFilter);
      if (privacyFilter) params.append('privacy', privacyFilter);

      const response = await fetch(`http://localhost:4000/api/conversations?${params}`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch submissions');
      }

      const data: SubmissionsResponse = await response.json();
      setSubmissions(data.conversations);
      setPagination(data.pagination);
      setError(null);
    } catch (err) {
      setError('Failed to load submissions. Please try again.');
      console.error('Error fetching submissions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubmissions();
  }, [typeFilter, privacyFilter]);

  const handlePageChange = (page: number) => {
    fetchSubmissions(page);
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'EDITORIAL': return 'blue';
      case 'REVIEW': return 'orange';
      case 'PUBLIC': return 'green';
      default: return 'gray';
    }
  };

  const getPrivacyColor = (privacy: string) => {
    switch (privacy) {
      case 'PRIVATE': return 'red';
      case 'SEMI_PUBLIC': return 'yellow';
      case 'PUBLIC': return 'green';
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

  const truncateText = (text: string, maxLength: number) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  if (loading && submissions.length === 0) {
    return (
      <Stack align="center" gap="md" py="xl">
        <Loader size="lg" />
        <Text>Loading submissions...</Text>
      </Stack>
    );
  }

  if (error) {
    return (
      <Stack py="xl">
        <Alert icon={<IconAlertCircle size={16} />} color="red">
          {error}
        </Alert>
      </Stack>
    );
  }

  return (
    <Stack gap="xl" py="xl">
      {/* Breadcrumbs */}
      <Breadcrumbs items={[{ title: 'Submissions' }]} />

      {/* Header */}
      <Stack gap="md">
        <Title order={1}>Submissions</Title>
        <Text size="lg" c="dimmed">
          Manuscript submissions with active discussions and reviews
        </Text>
      </Stack>

      {/* Filters */}
      <Card shadow="sm" padding="lg" radius="md">
        <Grid>
          <Grid.Col span={{ base: 12, md: 4 }}>
            <TextInput
              placeholder="Search submissions..."
              leftSection={<IconSearch size={16} />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 6, md: 4 }}>
            <Select
              label="Type"
              placeholder="All types"
              value={typeFilter}
              onChange={(value) => setTypeFilter(value || '')}
              data={[
                { value: '', label: 'All Types' },
                { value: 'EDITORIAL', label: 'Editorial' },
                { value: 'REVIEW', label: 'Review' },
                { value: 'PUBLIC', label: 'Public' }
              ]}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 6, md: 4 }}>
            <Select
              label="Privacy"
              placeholder="All privacy levels"
              value={privacyFilter}
              onChange={(value) => setPrivacyFilter(value || '')}
              data={[
                { value: '', label: 'All Privacy Levels' },
                { value: 'PRIVATE', label: 'Private' },
                { value: 'SEMI_PUBLIC', label: 'Semi-Public' },
                { value: 'PUBLIC', label: 'Public' }
              ]}
            />
          </Grid.Col>
        </Grid>
      </Card>

      {/* Results Info */}
      <Group justify="space-between">
        <Text size="sm" c="dimmed">
          Showing {submissions.length} of {pagination.total} submissions
        </Text>
        {loading && <Loader size="sm" />}
      </Group>

      {/* Submissions List */}
      {submissions.length === 0 ? (
        <Card shadow="sm" padding="xl" radius="md">
          <Stack align="center" gap="md">
            <Text size="lg" fw={500}>No submissions found</Text>
            <Text c="dimmed">There are no manuscript submissions matching your criteria</Text>
          </Stack>
        </Card>
      ) : (
        <Stack gap="md">
          {submissions.map((submission) => (
            <Card key={submission.id} shadow="sm" padding="lg" radius="md">
              <Stack gap="md">
                {/* Header */}
                <Group justify="space-between" align="flex-start">
                  <Stack gap="xs" style={{ flex: 1 }}>
                    <Group gap="xs">
                      <Anchor
                        component={Link}
                        href={`/submissions/${submission.id}`}
                        size="lg"
                        fw={600}
                        lineClamp={1}
                      >
                        {submission.manuscript.title}
                      </Anchor>
                      <Badge color={getTypeColor(submission.type)} variant="light" size="sm">
                        {submission.type}
                      </Badge>
                      <Badge color={getPrivacyColor(submission.privacy)} variant="dot" size="sm">
                        {submission.privacy}
                      </Badge>
                    </Group>
                    
                    <Text size="sm" c="dimmed" lineClamp={1}>
                      Authors: {submission.manuscript.authors.join(', ')}
                    </Text>
                  </Stack>

                  <Group gap="xs" style={{ flexShrink: 0 }}>
                    <Group gap={4}>
                      <IconMessage size={14} />
                      <Text size="xs" c="dimmed">{submission.messageCount}</Text>
                    </Group>
                    <Group gap={4}>
                      <IconUsers size={14} />
                      <Text size="xs" c="dimmed">{submission.participantCount}</Text>
                    </Group>
                  </Group>
                </Group>

                {/* Last Message */}
                {submission.lastMessage && (
                  <>
                    <Divider />
                    <Group gap="xs" align="flex-start">
                      <Avatar size="sm" color={submission.lastMessage.isBot ? 'blue' : 'gray'}>
                        {submission.lastMessage.isBot ? (
                          <IconRobot size={14} />
                        ) : (
                          submission.lastMessage.author.name.charAt(0)
                        )}
                      </Avatar>
                      <Stack gap="xs" style={{ flex: 1, minWidth: 0 }}>
                        <Group gap="xs" align="center">
                          <Text size="sm" fw={500} lineClamp={1}>
                            {submission.lastMessage.author.name}
                          </Text>
                          {submission.lastMessage.isBot && (
                            <Badge size="xs" variant="light" color="blue">
                              Bot
                            </Badge>
                          )}
                          <Group gap={4}>
                            <IconClock size={12} />
                            <Text size="xs" c="dimmed">
                              {formatTimeAgo(submission.lastMessage.createdAt)}
                            </Text>
                          </Group>
                        </Group>
                        <Text size="sm" c="dimmed" lineClamp={2}>
                          {truncateText(submission.lastMessage.content, 200)}
                        </Text>
                      </Stack>
                    </Group>
                  </>
                )}
              </Stack>
            </Card>
          ))}
        </Stack>
      )}

      {/* Pagination */}
      {pagination.pages > 1 && (
        <Group justify="center">
          <Pagination
            value={pagination.page}
            onChange={handlePageChange}
            total={pagination.pages}
            size="sm"
          />
        </Group>
      )}

    </Stack>
  );
}