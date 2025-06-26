import { Title, Text, Button, Stack, Card, Group, Container, Grid, Badge, Anchor, SimpleGrid } from '@mantine/core';
import { IconPencil, IconCalendar, IconUsers, IconTag } from '@tabler/icons-react';
import Link from 'next/link';
import { Suspense } from 'react';

async function fetchRecentArticles() {
  try {
    const params = new URLSearchParams({
      page: '1',
      limit: '6',
      orderBy: 'publishedAt',
      order: 'desc',
      status: 'ALL'
    });
    
    const url = `http://localhost:4000/api/articles?${params}`;
    console.log('Fetching articles from:', url);
    
    const response = await fetch(url, {
      cache: 'no-store',
      credentials: 'include'
    });
    
    console.log('Response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('API Error:', response.status, errorText);
      throw new Error(`Failed to fetch articles: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('Fetched articles data:', data);
    
    // Filter to only published articles on the client side
    const publishedArticles = data.manuscripts?.filter((article: any) => 
      article.status === 'PUBLISHED'
    ) || [];
    
    return { data: publishedArticles };
  } catch (error) {
    console.error('Error fetching articles:', error);
    return { data: [] };
  }
}

function RecentArticlesSkeleton() {
  return (
    <Stack gap="md">
      {[...Array(4)].map((_, i) => (
        <Card shadow="sm" padding="lg" radius="md" key={i}>
          <Stack gap="md">
            <div style={{ height: 28, backgroundColor: '#f1f3f4', borderRadius: 4 }} />
            <div style={{ height: 20, backgroundColor: '#f1f3f4', borderRadius: 4, width: '70%' }} />
            <div style={{ height: 20, backgroundColor: '#f1f3f4', borderRadius: 4, width: '50%' }} />
            <div style={{ height: 16, backgroundColor: '#f1f3f4', borderRadius: 4, width: '40%' }} />
          </Stack>
        </Card>
      ))}
    </Stack>
  );
}

async function RecentArticles() {
  const articlesData = await fetchRecentArticles();
  const articles = articlesData.data || [];

  if (articles.length === 0) {
    return (
      <Card shadow="sm" padding="xl" radius="md">
        <Stack align="center" gap="md">
          <Text size="lg" c="dimmed">No published articles yet</Text>
          <Text size="sm" c="dimmed" ta="center">
            Be the first to contribute to this journal by submitting your research.
          </Text>
          <Button component={Link} href="/articles/submit" leftSection={<IconPencil size={16} />}>
            Submit Article
          </Button>
        </Stack>
      </Card>
    );
  }

  return (
    <Stack gap="md">
      {articles.map((article: any) => (
        <Card shadow="sm" padding="lg" radius="md" component={Link} href={`/articles/${article.id}`} key={article.id}>
          <Stack gap="md">
            <Title order={4} size="h4">
              {article.title}
            </Title>
            
            {/* Authors */}
            <Group gap="xs">
              <IconUsers size={16} />
              <Text size="sm" c="dimmed">
                {article.authorDetails && article.authorDetails.length > 0 
                  ? article.authorDetails.map((author: any) => author.name).join(', ')
                  : article.authors?.join(', ') || 'Unknown authors'
                }
              </Text>
            </Group>

            {/* Keywords/Tags */}
            {article.keywords && article.keywords.length > 0 && (
              <Group gap="xs">
                <IconTag size={16} />
                <Group gap="xs">
                  {article.keywords.map((keyword: string, index: number) => (
                    <Badge key={index} size="sm" variant="light" color="blue">
                      {keyword}
                    </Badge>
                  ))}
                </Group>
              </Group>
            )}

            {/* Publication Date */}
            <Group gap="xs">
              <IconCalendar size={16} />
              <Text size="sm" c="dimmed">
                Published {new Date(article.publishedAt || article.createdAt).toLocaleDateString()}
              </Text>
            </Group>
          </Stack>
        </Card>
      ))}
    </Stack>
  );
}

export default function HomePage() {
  return (
    <Container size="xl" py="xl">
      <Stack gap="xl">
        {/* Journal Header */}
        <Stack align="center" gap="md" ta="center">
          <Title order={1} size="2.5rem" c="academic.8">
            Journal of Open Science
          </Title>
          <Text size="lg" c="dimmed" maw={600}>
            A peer-reviewed open access journal dedicated to advancing scientific knowledge 
            through transparent, collaborative research and innovative review processes.
          </Text>
          <Button 
            size="lg" 
            leftSection={<IconPencil size={20} />} 
            component={Link} 
            href="/articles/submit"
            mt="md"
          >
            Submit Your Research
          </Button>
        </Stack>

        {/* Main Content - Two Column Layout */}
        <Group align="flex-start" gap="xl">
          {/* Recent Publications - Left Column */}
          <Stack gap="md" style={{ flex: 2 }}>
            <Group justify="space-between" align="center">
              <Title order={2} size="h3">
                Recent Publications
              </Title>
              <Anchor component={Link} href="/articles" size="sm">
                View all articles →
              </Anchor>
            </Group>
            
            <Suspense fallback={<RecentArticlesSkeleton />}>
              <RecentArticles />
            </Suspense>
          </Stack>
          
          {/* About Section - Right Column */}
          <Card shadow="sm" padding="xl" radius="md" style={{ flex: 1, minWidth: 300 }}>
            <Stack gap="md">
              <Title order={2} size="h3">
                About the Journal
              </Title>
              <Text>
                The Journal of Open Science is committed to advancing scientific knowledge through 
                open, transparent, and collaborative research practices. We embrace innovative 
                peer review processes that foster constructive dialogue between authors, reviewers, 
                and the broader scientific community.
              </Text>
            </Stack>
          </Card>
        </Group>
      </Stack>
    </Container>
  );
}