'use client';

import { useState, useEffect, useCallback } from 'react';
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
  manuscript: {
    id: string;
    title: string;
    authors: string[];
    status: string;
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
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('active'); // Default to active submissions

  const fetchSubmissions = async (page = 1) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pagination.limit.toString(),
        manuscriptStatus: statusFilter
      });

      if (debouncedSearch && debouncedSearch.trim()) {
        params.append('search', debouncedSearch.trim());
      }


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

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);

    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    fetchSubmissions();
  }, [debouncedSearch, statusFilter]);

  const handlePageChange = (page: number) => {
    fetchSubmissions(page);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'SUBMITTED': return 'blue';
      case 'UNDER_REVIEW': return 'orange';
      case 'REVISION_REQUESTED': return 'yellow';
      case 'REVISED': return 'cyan';
      case 'ACCEPTED': return 'green';
      case 'REJECTED': return 'red';
      case 'PUBLISHED': return 'green';
      case 'RETRACTED': return 'red';
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
          {statusFilter === 'active' 
            ? 'Manuscript submissions currently in the review process'
            : statusFilter === 'completed'
            ? 'Completed manuscript submissions (published, rejected, or retracted)'
            : 'All manuscript submissions with discussions and reviews'
          }
        </Text>
      </Stack>

      {/* Filters */}
      <Grid align="flex-end">
        <Grid.Col span={{ base: 12, md: 8 }}>
          <TextInput
            placeholder="Search submissions..."
            leftSection={<IconSearch size={16} />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 4 }}>
          <Select
            label="Status Filter"
            placeholder="Select status"
            value={statusFilter}
            onChange={(value) => setStatusFilter(value || 'active')}
            data={[
              { value: 'active', label: 'Active Submissions' },
              { value: 'completed', label: 'Completed Submissions' },
              { value: 'all', label: 'All Submissions' }
            ]}
            clearable={false}
          />
        </Grid.Col>
      </Grid>

      {/* Results Info */}
      <Group justify="space-between">
        <Text size="sm" c="dimmed">
          Showing {submissions.length} of {pagination.total} {
            statusFilter === 'active' ? 'active' : 
            statusFilter === 'completed' ? 'completed' : ''
          } submissions
        </Text>
        {loading && <Loader size="sm" />}
      </Group>

      {/* Submissions List */}
      {submissions.length === 0 ? (
        <Paper p="xl" radius="md" withBorder>
          <Stack align="center" gap="md">
            <Text size="lg" fw={500}>No submissions found</Text>
            <Text c="dimmed">There are no manuscript submissions matching your criteria</Text>
          </Stack>
        </Paper>
      ) : (
        <Paper radius="md" withBorder>
          {submissions.map((submission, index) => (
            <div key={submission.id}>
              <Group gap="md" p="md" align="flex-start">
                {/* Main content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Stack gap="xs">
                    <Anchor
                      component={Link}
                      href={`/submissions/${submission.id}`}
                      fw={600}
                      lineClamp={1}
                    >
                      {submission.manuscript.title}
                    </Anchor>
                    
                    <Text size="sm" c="dimmed" lineClamp={1}>
                      {submission.manuscript.authors.join(', ')}
                    </Text>

                    {/* Last activity */}
                    {submission.lastMessage && (
                      <Group gap="xs" align="center">
                        <Avatar size={16} color={submission.lastMessage.isBot ? 'blue' : 'gray'}>
                          {submission.lastMessage.isBot ? (
                            <IconRobot size={10} />
                          ) : (
                            submission.lastMessage.author.name.charAt(0)
                          )}
                        </Avatar>
                        <Text size="xs" c="dimmed">
                          {submission.lastMessage.author.name}
                        </Text>
                        {submission.lastMessage.isBot && (
                          <Badge size="xs" variant="light" color="blue">
                            Bot
                          </Badge>
                        )}
                        <Text size="xs" c="dimmed">•</Text>
                        <Text size="xs" c="dimmed">
                          {formatTimeAgo(submission.updatedAt)}
                        </Text>
                      </Group>
                    )}
                  </Stack>
                </div>

                {/* Stats and Status */}
                <Group gap="md" style={{ flexShrink: 0 }}>
                  {/* Status Badge */}
                  <Badge 
                    size="sm" 
                    variant="light" 
                    color={getStatusColor(submission.manuscript.status)}
                  >
                    {submission.manuscript.status.replace('_', ' ')}
                  </Badge>

                  <Group gap={4}>
                    <IconMessage size={14} />
                    <Text size="sm" c="dimmed">{submission.messageCount}</Text>
                  </Group>
                  <Group gap={4}>
                    <IconUsers size={14} />
                    <Text size="sm" c="dimmed">{submission.participantCount}</Text>
                  </Group>
                </Group>
              </Group>
              
              {index < submissions.length - 1 && <Divider />}
            </div>
          ))}
        </Paper>
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