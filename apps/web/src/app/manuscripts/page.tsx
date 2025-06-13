'use client';

import { useState, useEffect } from 'react';
import { 
  Container, 
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
  Divider
} from '@mantine/core';
import { IconSearch, IconAlertCircle, IconCalendar, IconUsers, IconTag } from '@tabler/icons-react';
import Link from 'next/link';

interface Manuscript {
  id: string;
  title: string;
  abstract: string;
  authors: string[];
  keywords: string[];
  status: string;
  publishedAt: string;
  conversationCount: number;
  fileUrl?: string;
}

interface ManuscriptsResponse {
  manuscripts: Manuscript[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export default function ManuscriptsPage() {
  const [manuscripts, setManuscripts] = useState<Manuscript[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 12, total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('publishedAt');
  const [order, setOrder] = useState('desc');

  const fetchManuscripts = async (page = 1, searchTerm = search) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pagination.limit.toString(),
        orderBy: sortBy,
        order,
        status: 'PUBLISHED'
      });

      if (searchTerm) {
        params.append('search', searchTerm);
      }

      const response = await fetch(`http://localhost:4000/api/manuscripts?${params}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch manuscripts');
      }

      const data: ManuscriptsResponse = await response.json();
      setManuscripts(data.manuscripts);
      setPagination(data.pagination);
      setError(null);
    } catch (err) {
      setError('Failed to load manuscripts. Please try again.');
      console.error('Error fetching manuscripts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchManuscripts();
  }, [sortBy, order]);

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault();
    fetchManuscripts(1, search);
  };

  const handlePageChange = (page: number) => {
    fetchManuscripts(page);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const truncateText = (text: string, maxLength: number) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  if (loading && manuscripts.length === 0) {
    return (
      <Container size="lg" py="xl">
        <Stack align="center" gap="md">
          <Loader size="lg" />
          <Text>Loading manuscripts...</Text>
        </Stack>
      </Container>
    );
  }

  if (error) {
    return (
      <Container size="lg" py="xl">
        <Alert icon={<IconAlertCircle size={16} />} color="red">
          {error}
        </Alert>
      </Container>
    );
  }

  return (
    <Container size="xl" py="xl">
      <Stack gap="xl">
        {/* Header */}
        <Stack gap="md">
          <Title order={1}>Published Manuscripts</Title>
          <Text size="lg" c="dimmed">
            Explore the latest research published in our journal
          </Text>
        </Stack>

        {/* Search and Filters */}
        <Card shadow="sm" padding="lg" radius="md">
          <form onSubmit={handleSearch}>
            <Grid>
              <Grid.Col span={{ base: 12, md: 6 }}>
                <TextInput
                  placeholder="Search manuscripts by title, abstract, or author..."
                  leftSection={<IconSearch size={16} />}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </Grid.Col>
              <Grid.Col span={{ base: 6, md: 3 }}>
                <Select
                  label="Sort by"
                  value={sortBy}
                  onChange={(value) => setSortBy(value || 'publishedAt')}
                  data={[
                    { value: 'publishedAt', label: 'Publication Date' },
                    { value: 'title', label: 'Title' },
                    { value: 'createdAt', label: 'Submission Date' }
                  ]}
                />
              </Grid.Col>
              <Grid.Col span={{ base: 6, md: 3 }}>
                <Select
                  label="Order"
                  value={order}
                  onChange={(value) => setOrder(value || 'desc')}
                  data={[
                    { value: 'desc', label: 'Newest First' },
                    { value: 'asc', label: 'Oldest First' }
                  ]}
                />
              </Grid.Col>
            </Grid>
          </form>
        </Card>

        {/* Results Info */}
        <Group justify="space-between">
          <Text size="sm" c="dimmed">
            Showing {manuscripts.length} of {pagination.total} manuscripts
          </Text>
          {loading && <Loader size="sm" />}
        </Group>

        {/* Manuscripts Grid */}
        {manuscripts.length === 0 ? (
          <Card shadow="sm" padding="xl" radius="md">
            <Stack align="center" gap="md">
              <Text size="lg" fw={500}>No manuscripts found</Text>
              <Text c="dimmed">Try adjusting your search terms or filters</Text>
            </Stack>
          </Card>
        ) : (
          <Grid>
            {manuscripts.map((manuscript) => (
              <Grid.Col key={manuscript.id} span={{ base: 12, md: 6, lg: 4 }}>
                <Card 
                  shadow="sm" 
                  padding="lg" 
                  radius="md" 
                  h="100%"
                  style={{ display: 'flex', flexDirection: 'column' }}
                >
                  <Stack gap="md" style={{ flex: 1 }}>
                    {/* Title */}
                    <Anchor
                      component={Link}
                      href={`/manuscripts/${manuscript.id}`}
                      size="lg"
                      fw={600}
                      lineClamp={2}
                      style={{ minHeight: '3rem' }}
                    >
                      {manuscript.title}
                    </Anchor>

                    {/* Authors */}
                    <Group gap="xs">
                      <IconUsers size={14} />
                      <Text size="sm" c="dimmed" lineClamp={1}>
                        {manuscript.authors.join(', ')}
                      </Text>
                    </Group>

                    {/* Abstract */}
                    <Text size="sm" c="dimmed" style={{ flex: 1 }}>
                      {truncateText(manuscript.abstract, 150)}
                    </Text>

                    {/* Keywords */}
                    {manuscript.keywords.length > 0 && (
                      <Group gap="xs">
                        <IconTag size={14} />
                        <Group gap="xs">
                          {manuscript.keywords.slice(0, 3).map((keyword, index) => (
                            <Badge key={index} size="xs" variant="light">
                              {keyword}
                            </Badge>
                          ))}
                          {manuscript.keywords.length > 3 && (
                            <Text size="xs" c="dimmed">
                              +{manuscript.keywords.length - 3} more
                            </Text>
                          )}
                        </Group>
                      </Group>
                    )}

                    <Divider />

                    {/* Footer */}
                    <Group justify="space-between" align="center">
                      <Group gap="xs">
                        <IconCalendar size={14} />
                        <Text size="xs" c="dimmed">
                          {formatDate(manuscript.publishedAt)}
                        </Text>
                      </Group>
                      <Badge color="green" variant="light" size="sm">
                        Published
                      </Badge>
                    </Group>
                  </Stack>
                </Card>
              </Grid.Col>
            ))}
          </Grid>
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
    </Container>
  );
}