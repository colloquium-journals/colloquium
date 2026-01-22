'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
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
  Divider,
  Button,
  Paper
} from '@mantine/core';
import { IconSearch, IconAlertCircle, IconCalendar, IconUsers, IconTag, IconUpload, IconPencil, IconCornerDownLeft, IconX, IconAlertTriangle } from '@tabler/icons-react';
import Link from 'next/link';
import { Breadcrumbs } from '@/components/navigation/Breadcrumbs';

interface Author {
  id: string;
  name: string;
  email: string;
  orcidId?: string;
  order: number;
  isCorresponding: boolean;
}

interface Article {
  id: string;
  title: string;
  abstract: string;
  authors: string[]; // Legacy field
  authorDetails: Author[];
  keywords: string[];
  status: string;
  publishedAt: string;
  updatedAt: string;
  lastModifiedBy: string;
  fileUrl?: string;
}

interface ArticlesResponse {
  manuscripts: Article[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export default function ArticlesPage() {
  const { isAuthenticated } = useAuth();
  const [articles, setArticles] = useState<Article[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 12, total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [performedSearch, setPerformedSearch] = useState(''); // Track the actual search that was performed
  const [sortBy, setSortBy] = useState('publishedAt');
  const [order, setOrder] = useState('desc');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  const fetchArticles = async (page = 1, searchTerm = search, tagFilter = selectedTag) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pagination.limit.toString(),
        orderBy: sortBy,
        order,
        status: 'ALL' // Allow both PUBLISHED and RETRACTED articles
      });

      if (searchTerm) {
        params.append('search', searchTerm);
      }

      if (tagFilter) {
        params.append('tag', tagFilter);
      }

      const response = await fetch(`http://localhost:4000/api/articles?${params}`, {
        credentials: 'include' // Include auth cookies for access control
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch articles');
      }

      const data: ArticlesResponse = await response.json();
      setArticles(data.manuscripts);
      setPagination(data.pagination);
      setError(null);
    } catch (err) {
      setError('Failed to load articles. Please try again.');
      console.error('Error fetching articles:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchArticles(pagination.page, performedSearch, selectedTag);
  }, [sortBy, order, selectedTag]);

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault();
    setPerformedSearch(search);
    fetchArticles(1, search);
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      setPerformedSearch(search);
      fetchArticles(1, search);
    }
  };

  const handlePageChange = (page: number) => {
    fetchArticles(page);
  };

  const handleTagClick = (tag: string) => {
    if (selectedTag === tag) {
      setSelectedTag(null);
    } else {
      setSelectedTag(tag);
    }
  };

  const handleClearSearch = () => {
    setSearch('');
    setPerformedSearch('');
    fetchArticles(1, '', selectedTag);
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

  if (loading && articles.length === 0) {
    return (
      <Stack align="center" gap="md" py="xl">
        <Loader size="lg" />
        <Text>Loading articles...</Text>
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
        <Breadcrumbs items={[{ title: 'Articles' }]} />

        {/* Header */}
        <Group justify="space-between" align="flex-start">
          <Stack gap="md">
            <Title order={1}>Articles</Title>
            <Text size="lg" c="dimmed">
              Explore published research in our journal
            </Text>
          </Stack>
          {isAuthenticated ? (
            <Button component={Link} href="/articles/submit" leftSection={<IconUpload size={16} />}>
              Submit Article
            </Button>
          ) : (
            <Button component={Link} href="/auth/login" variant="outline">
              Login to Submit
            </Button>
          )}
        </Group>

        {/* Search and Filters */}
        <Paper p="lg" radius="md">
          <form onSubmit={handleSearch}>
            <Grid align="flex-end">
              <Grid.Col span={{ base: 12, md: 6 }}>
                <TextInput
                  placeholder="Search articles by title, abstract, or author..."
                  leftSection={<IconSearch size={16} />}
                  rightSection={
                    <IconCornerDownLeft size={16} style={{ color: 'var(--mantine-color-dimmed)' }} />
                  }
                  rightSectionWidth={40}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={handleKeyDown}
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
                  comboboxProps={{}}
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
          {selectedTag && (
            <Group mt="md" justify="space-between" align="center">
              <Group gap="xs">
                <Text size="sm" c="dimmed">Filtered by tag:</Text>
                <Badge variant="filled" color="blue">
                  {selectedTag}
                </Badge>
              </Group>
              <Button variant="subtle" size="xs" onClick={() => setSelectedTag(null)}>
                Clear filter
              </Button>
            </Group>
          )}
        </Paper>

        {/* Search Results Indicator */}
        {performedSearch && (
          <Paper p="md" radius="md" bg="gray.0">
            <Group justify="space-between" align="center">
              <Group gap="xs">
                <Text size="sm" c="dimmed">
                  Search results for{' '}
                  <Text component="span" fw={500} c="dark">
                    "{performedSearch}"
                  </Text>
                </Text>
              </Group>
              <Button 
                variant="subtle" 
                size="xs" 
                leftSection={<IconX size={14} />}
                onClick={handleClearSearch}
                aria-label="Clear search"
              >
                Clear search
              </Button>
            </Group>
          </Paper>
        )}

        {/* Results Info */}
        <Group justify="space-between">
          <Text size="sm" c="dimmed">
            Showing {articles.length} of {pagination.total} articles
          </Text>
          {loading && <Loader size="sm" role="status" />}
        </Group>

        {/* Articles Grid */}
        {articles.length === 0 ? (
          <Card shadow="sm" padding="xl" radius="md">
            <Stack align="center" gap="md">
              <Text size="lg" fw={500}>No articles found</Text>
              <Text c="dimmed">Try adjusting your search terms or filters</Text>
            </Stack>
          </Card>
        ) : (
          <Grid>
            {articles.map((article) => (
              <Grid.Col key={article.id} span={{ base: 12, md: 6, lg: 4 }}>
                <Card 
                  shadow="sm" 
                  padding="lg" 
                  radius="md" 
                  h="100%"
                  style={{ display: 'flex', flexDirection: 'column' }}
                >
                  <Stack gap="md" style={{ flex: 1 }}>
                    {/* RETRACTED Warning */}
                    {article.status === 'RETRACTED' && (
                      <Alert icon={<IconAlertTriangle size={16} />} color="red" variant="filled">
                        <Text size="xs" fw={600}>
                          RETRACTED ARTICLE
                        </Text>
                      </Alert>
                    )}

                    {/* Title */}
                    <Anchor
                      component={Link}
                      href={`/articles/${article.id}`}
                      size="lg"
                      fw={600}
                      lineClamp={2}
                      style={{ 
                        minHeight: '3rem',
                        opacity: article.status === 'RETRACTED' ? 0.7 : 1
                      }}
                    >
                      {article.title}
                    </Anchor>

                    {/* Authors */}
                    <Group gap="xs" wrap="nowrap" align="flex-start">
                      <IconUsers size={14} style={{ marginTop: 3, flexShrink: 0 }} />
                      <Text size="sm" c="dimmed" lineClamp={2} style={{ flex: 1 }}>
                        {article.authorDetails && article.authorDetails.length > 0
                          ? article.authorDetails.map(author => author.name).join(', ')
                          : article.authors.join(', ')
                        }
                      </Text>
                    </Group>

                    {/* Abstract */}
                    <Text size="sm" c="dimmed" style={{ flex: 1 }}>
                      {truncateText(article.abstract, 150)}
                    </Text>

                    {/* Keywords */}
                    {article.keywords.length > 0 && (
                      <Group gap="xs" align="flex-start" wrap="nowrap">
                        <IconTag size={14} style={{ marginTop: 2, flexShrink: 0 }} />
                        <Group gap="xs" wrap="wrap" style={{ flex: 1 }}>
                          {article.keywords.slice(0, 3).map((keyword, index) => (
                            <Badge
                              key={index}
                              size="xs"
                              variant={selectedTag === keyword ? "filled" : "light"}
                              color={selectedTag === keyword ? "blue" : undefined}
                              style={{
                                cursor: 'pointer',
                                transition: 'all 0.2s ease'
                              }}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleTagClick(keyword);
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = selectedTag === keyword ? '' : 'var(--mantine-color-gray-2)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = '';
                              }}
                            >
                              {keyword}
                            </Badge>
                          ))}
                          {article.keywords.length > 3 && (
                            <Text size="xs" c="dimmed">
                              +{article.keywords.length - 3} more
                            </Text>
                          )}
                        </Group>
                      </Group>
                    )}

                    <Divider />

                    {/* Footer */}
                    <Stack gap="xs">
                      <Group justify="space-between" align="center">
                        <Group gap="xs">
                          <IconCalendar size={14} />
                          <Text size="xs" c="dimmed">
                            {formatDate(article.publishedAt)}
                          </Text>
                        </Group>
                        {article.status === 'RETRACTED' ? (
                          <Badge color="red" variant="filled" size="sm">
                            RETRACTED
                          </Badge>
                        ) : (
                          <Badge color="green" variant="light" size="sm">
                            Published
                          </Badge>
                        )}
                      </Group>
                    </Stack>
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
  );
}