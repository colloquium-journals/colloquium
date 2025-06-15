'use client';

import { useState, useEffect } from 'react';
import {
  Container,
  Stack,
  Title,
  Card,
  Grid,
  Text,
  Button,
  Group,
  Anchor,
  Loader,
  Alert,
  Badge,
  Paper
} from '@mantine/core';
import {
  IconFileText,
  IconUsers,
  IconGavel,
  IconShield,
  IconLicense,
  IconExternalLink,
  IconAlertCircle,
  IconClock
} from '@tabler/icons-react';
import Link from 'next/link';
import { format } from 'date-fns';

interface ContentSection {
  slug: string;
  name: string;
  description: string;
  pageCount: number;
  lastUpdated: number;
}

interface ContentPage {
  slug: string;
  title: string;
  description: string;
  order: number;
  visible: boolean;
  lastUpdated: string;
  wordCount: number;
}

const PAGE_ICONS = {
  'index': IconFileText,
  'submission-scope': IconFileText,
  'code-of-conduct': IconGavel,
  'ethics-guidelines': IconShield,
  'licensing': IconLicense,
  'editorial-board': IconUsers
};

export default function AboutPage() {
  const [sections, setSections] = useState<ContentSection[]>([]);
  const [aboutPages, setAboutPages] = useState<ContentPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchContent = async () => {
      try {
        const [sectionsResponse, aboutPagesResponse] = await Promise.all([
          fetch('http://localhost:4000/api/content'),
          fetch('http://localhost:4000/api/content/about')
        ]);

        if (!sectionsResponse.ok || !aboutPagesResponse.ok) {
          throw new Error('Failed to fetch content');
        }

        const sectionsData = await sectionsResponse.json();
        const aboutData = await aboutPagesResponse.json();

        setSections(sectionsData.sections);
        setAboutPages(aboutData.pages);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load content');
      } finally {
        setLoading(false);
      }
    };

    fetchContent();
  }, []);

  const formatDate = (timestamp: number | string) => {
    const date = typeof timestamp === 'string' ? new Date(timestamp) : new Date(timestamp);
    return format(date, 'MMM dd, yyyy');
  };

  const getReadingTime = (wordCount: number) => {
    return Math.ceil(wordCount / 200); // Assume 200 WPM
  };

  const getPageIcon = (slug: string) => {
    return PAGE_ICONS[slug as keyof typeof PAGE_ICONS] || IconFileText;
  };

  if (loading) {
    return (
      <Container size="lg" py="xl">
        <Stack align="center" gap="md">
          <Loader size="lg" />
          <Text>Loading about pages...</Text>
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
    <Container size="lg" py="xl">
      <Stack gap="xl">
        {/* Header */}
        <Stack gap="md" align="center">
          <Title order={1} ta="center">About Colloquium</Title>
          <Text size="lg" c="dimmed" ta="center" maw={600}>
            Learn about our mission, policies, and community guidelines for open academic publishing.
          </Text>
        </Stack>

        {/* About Pages Grid */}
        <Grid>
          {aboutPages.map((page) => {
            const IconComponent = getPageIcon(page.slug);
            
            return (
              <Grid.Col key={page.slug} span={{ base: 12, md: 6 }}>
                <Card
                  shadow="sm"
                  padding="lg"
                  radius="md"
                  component={Link}
                  href={`/about/${page.slug}`}
                  style={{ 
                    height: '100%',
                    textDecoration: 'none',
                    color: 'inherit',
                    cursor: 'pointer'
                  }}
                >
                  <Stack gap="md" h="100%">
                    <Group gap="md">
                      <IconComponent size={32} color="var(--mantine-color-blue-6)" />
                      <Stack gap="xs" style={{ flex: 1 }}>
                        <Title order={3} size="lg">
                          {page.title}
                        </Title>
                        <Text size="sm" c="dimmed" lineClamp={2}>
                          {page.description}
                        </Text>
                      </Stack>
                    </Group>

                    <Group justify="space-between" mt="auto">
                      <Group gap="xs">
                        <IconClock size={14} />
                        <Text size="xs" c="dimmed">
                          {getReadingTime(page.wordCount)} min read
                        </Text>
                      </Group>
                      <Text size="xs" c="dimmed">
                        Updated {formatDate(page.lastUpdated)}
                      </Text>
                    </Group>
                  </Stack>
                </Card>
              </Grid.Col>
            );
          })}
        </Grid>

        {/* Editorial Board Special Card */}
        <Card shadow="sm" padding="xl" radius="md" bg="blue.0">
          <Grid align="center">
            <Grid.Col span={{ base: 12, md: 8 }}>
              <Stack gap="md">
                <Group gap="md">
                  <IconUsers size={32} color="var(--mantine-color-blue-6)" />
                  <Stack gap="xs">
                    <Title order={2}>Editorial Board</Title>
                    <Text>
                      Meet our distinguished editorial team of researchers and scholars who 
                      maintain the highest standards of academic publishing.
                    </Text>
                  </Stack>
                </Group>

                <Text size="sm" c="dimmed">
                  Our board members are automatically updated based on current editor roles and represent 
                  diverse backgrounds and expertise areas.
                </Text>
              </Stack>
            </Grid.Col>
            
            <Grid.Col span={{ base: 12, md: 4 }}>
              <Stack gap="md">
                <Button
                  component={Link}
                  href="/about/editorial-board"
                  size="md"
                  rightSection={<IconExternalLink size={16} />}
                  fullWidth
                >
                  View Editorial Board
                </Button>
                
                <Badge variant="light" size="md" fullWidth>
                  Dynamically Updated
                </Badge>
              </Stack>
            </Grid.Col>
          </Grid>
        </Card>

        {/* Additional Sections */}
        {sections.length > 1 && (
          <Stack gap="md">
            <Title order={2}>Other Sections</Title>
            <Grid>
              {sections
                .filter(section => section.slug !== 'about')
                .map((section) => (
                  <Grid.Col key={section.slug} span={{ base: 12, md: 6 }}>
                    <Paper withBorder p="md" radius="md">
                      <Group justify="space-between">
                        <Stack gap="xs">
                          <Text fw={500} tt="capitalize">
                            {section.name}
                          </Text>
                          <Text size="sm" c="dimmed">
                            {section.description}
                          </Text>
                          <Text size="xs" c="dimmed">
                            {section.pageCount} page{section.pageCount !== 1 ? 's' : ''}
                          </Text>
                        </Stack>
                        <Button
                          variant="light"
                          size="sm"
                          component={Link}
                          href={`/${section.slug}`}
                        >
                          View
                        </Button>
                      </Group>
                    </Paper>
                  </Grid.Col>
                ))}
            </Grid>
          </Stack>
        )}

        {/* Contact Information */}
        <Card shadow="xs" padding="lg" radius="md">
          <Stack gap="md">
            <Title order={3}>Questions or Feedback?</Title>
            <Text>
              If you have questions about our policies, submission process, or platform, 
              we'd love to hear from you.
            </Text>
            <Group gap="md">
              <Anchor href="mailto:contact@colloquium.org">
                contact@colloquium.org
              </Anchor>
              <Text c="dimmed">•</Text>
              <Anchor 
                href="https://github.com/colloquium" 
                target="_blank"
                rightSection={<IconExternalLink size={12} />}
              >
                GitHub
              </Anchor>
            </Group>
          </Stack>
        </Card>
      </Stack>
    </Container>
  );
}