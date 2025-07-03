'use client';

import { useEffect, useState } from 'react';
import { useParams, notFound } from 'next/navigation';
import {
  Container,
  Stack,
  Title,
  Text,
  Group,
  Anchor,
  Loader,
  Alert,
  Paper,
  Flex,
  NavLink,
  Box,
  Divider
} from '@mantine/core';
import {
  IconFileText,
  IconUsers,
  IconGavel,
  IconShield,
  IconLicense,
  IconExternalLink,
  IconAlertCircle,
  IconBook,
  IconPencil,
  IconSettings,
  IconHeart,
  IconBulb,
  IconMail,
  IconPhone,
  IconWorld,
  IconCertificate,
  IconFlag,
  IconTarget,
  IconQuestionMark
} from '@tabler/icons-react';
import { format } from 'date-fns';
import { useJournalSettings } from '@/contexts/JournalSettingsContext';
import { marked } from 'marked';

interface ContentPage {
  slug: string;
  title: string;
  description: string;
  order: number;
  visible: boolean;
  lastUpdated: string;
  wordCount: number;
  content?: string;
  icon?: string;
}

interface SectionConfig {
  id: string;
  title: string;
  description: string;
  path: string;
  contentPath: string;
  icon: string;
  order: number;
  visible: boolean;
  showInNavigation: boolean;
  allowAnonymous: boolean;
}

// Icon mapping for frontmatter icon names to actual components
const ICON_MAP = {
  IconFileText,
  IconUsers,
  IconGavel,
  IconShield,
  IconLicense,
  IconBook,
  IconPencil,
  IconSettings,
  IconHeart,
  IconBulb,
  IconMail,
  IconPhone,
  IconWorld,
  IconCertificate,
  IconFlag,
  IconTarget,
  IconQuestionMark
};

async function fetchSectionConfig(): Promise<SectionConfig[]> {
  try {
    const response = await fetch('http://localhost:4000/api/content/sections', { cache: 'no-store' });
    if (response.ok) {
      const data = await response.json();
      return data.sections || [];
    }
    return [];
  } catch (error) {
    console.error('Error fetching section config:', error);
    return [];
  }
}

async function fetchSectionContent(sectionId: string) {
  try {
    const response = await fetch(`http://localhost:4000/api/content/${sectionId}`, { cache: 'no-store' });
    return response.ok ? await response.json() : { pages: [] };
  } catch (error) {
    console.error('Error fetching section content:', error);
    return { pages: [] };
  }
}

async function fetchPageContent(sectionId: string, slug: string) {
  try {
    const response = await fetch(`http://localhost:4000/api/content/${sectionId}/${slug}`, { cache: 'no-store' });
    return response.ok ? await response.json() : null;
  } catch (error) {
    console.error('Error fetching page content:', error);
    return null;
  }
}

export default function DynamicSectionPage() {
  const params = useParams();
  const { settings: journalSettings } = useJournalSettings();
  const [sectionConfig, setSectionConfig] = useState<SectionConfig | null>(null);
  const [pages, setPages] = useState<ContentPage[]>([]);
  const [activeSection, setActiveSection] = useState<string>('index');
  const [currentContent, setCurrentContent] = useState<ContentPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [contentLoading, setContentLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sectionSlug = params.section as string;

  useEffect(() => {
    const loadSectionData = async () => {
      try {
        setLoading(true);
        
        // Load section configuration
        const sections = await fetchSectionConfig();
        const section = sections.find(s => s.path === `/${sectionSlug}` || s.id === sectionSlug);
        
        if (!section || !section.visible) {
          notFound();
          return;
        }
        
        setSectionConfig(section);
        
        // Load section content
        const contentData = await fetchSectionContent(section.contentPath);
        setPages(contentData.pages || []);
        
        // Load initial content (index page)
        if (contentData.pages && contentData.pages.length > 0) {
          const indexPage = contentData.pages.find((page: ContentPage) => page.slug === 'index') || contentData.pages[0];
          await loadPageContent(section.contentPath, indexPage.slug);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load content');
      } finally {
        setLoading(false);
      }
    };
    
    loadSectionData();
  }, [sectionSlug]);

  const loadPageContent = async (sectionPath: string, slug: string) => {
    try {
      setContentLoading(true);
      const pageData = await fetchPageContent(sectionPath, slug);
      if (pageData) {
        // Process markdown content
        if (pageData.content) {
          const processedContent = await marked(pageData.content);
          pageData.content = processedContent as string;
        }
        setCurrentContent(pageData);
        setActiveSection(slug);
      }
    } catch (err) {
      console.error('Error loading page content:', err);
    } finally {
      setContentLoading(false);
    }
  };

  const formatDate = (timestamp: number | string) => {
    const date = typeof timestamp === 'string' ? new Date(timestamp) : new Date(timestamp);
    return format(date, 'MMM dd, yyyy');
  };

  const getPageIcon = (page: ContentPage) => {
    // First, try to use the custom icon from frontmatter
    if (page.icon && page.icon in ICON_MAP) {
      return ICON_MAP[page.icon as keyof typeof ICON_MAP];
    }
    
    // Final fallback
    return IconFileText;
  };

  if (loading) {
    return (
      <Container size="lg" py="xl">
        <Stack align="center" gap="md">
          <Loader size="lg" />
          <Text>Loading section...</Text>
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

  if (!sectionConfig) {
    notFound();
    return null;
  }

  return (
    <Container size="xl" py="xl">
      <Stack gap="xl">
        {/* Header */}
        <Stack gap="md" align="center">
          <Title order={1} ta="center">{sectionConfig.title}</Title>
          <Text size="lg" c="dimmed" ta="center" maw={600}>
            {sectionConfig.description}
          </Text>
        </Stack>

        {/* Main Content Area with Sidebar */}
        <Flex gap="xl" direction={{ base: 'column', md: 'row' }}>
          {/* Sidebar Navigation */}
          <Paper withBorder w={{ base: '100%', md: 280 }} h="fit-content">
            <Stack gap="xs" p="md">
              <Text fw={600} size="sm" c="dimmed" mb="xs">
                SECTIONS
              </Text>
              
              {pages
                .sort((a, b) => a.order - b.order)
                .map((page: ContentPage) => {
                  const IconComponent = getPageIcon(page);
                  return (
                    <NavLink
                      key={page.slug}
                      label={page.title}
                      leftSection={<IconComponent size={20} />}
                      active={activeSection === page.slug}
                      onClick={() => loadPageContent(sectionConfig.contentPath, page.slug)}
                      style={{
                        borderRadius: '6px',
                        cursor: 'pointer'
                      }}
                    />
                  );
                })}
              
              <Divider my="sm" />
              
              {/* Contact Information */}
              <Text fw={600} size="sm" c="dimmed" mb="xs">
                CONTACT
              </Text>
              <Group gap="xs" pl="xs">
                <Anchor href={`mailto:${journalSettings.contactEmail}`} size="sm">
                  {journalSettings.contactEmail}
                </Anchor>
              </Group>
              <Group gap="xs" pl="xs">
                <Anchor 
                  href="https://github.com/colloquium" 
                  target="_blank"
                  size="sm"
                >
                  <Group gap="xs" align="center">
                    GitHub
                    <IconExternalLink size={12} />
                  </Group>
                </Anchor>
              </Group>
            </Stack>
          </Paper>

          {/* Main Content */}
          <Box style={{ flex: 1 }}>
            {contentLoading ? (
              <Stack align="center" gap="md" py="xl">
                <Loader size="lg" />
                <Text>Loading content...</Text>
              </Stack>
            ) : currentContent ? (
              <Paper withBorder p="xl" radius="md">
                <Stack gap="lg">
                  {/* Content Header */}
                  <Stack gap="md">
                    <Group gap="md">
                      {(() => {
                        const IconComponent = getPageIcon(currentContent);
                        return <IconComponent size={32} color="var(--mantine-color-blue-6)" />;
                      })()}
                      <Stack gap="xs" style={{ flex: 1 }}>
                        <Title order={1} size="h2">
                          {currentContent.title}
                        </Title>
                        <Text size="md" c="dimmed">
                          {currentContent.description}
                        </Text>
                      </Stack>
                    </Group>

                    <Group gap="md" c="dimmed">
                      <Text size="sm">
                        Updated {formatDate(currentContent.lastUpdated)}
                      </Text>
                    </Group>
                  </Stack>

                  <Divider />

                  {/* Content Body */}
                  <Box
                    style={{
                      fontSize: '16px',
                      lineHeight: '1.6',
                      color: 'var(--mantine-color-text)'
                    }}
                    dangerouslySetInnerHTML={{
                      __html: currentContent.content || ''
                    }}
                  />
                </Stack>
              </Paper>
            ) : (
              <Paper withBorder p="xl" radius="md">
                <Stack align="center" gap="md">
                  <IconAlertCircle size={48} color="var(--mantine-color-red-6)" />
                  <Text size="lg" fw={500}>Content not found</Text>
                  <Text c="dimmed" ta="center">
                    The selected page content could not be loaded. Please try selecting another section.
                  </Text>
                </Stack>
              </Paper>
            )}
          </Box>
        </Flex>
      </Stack>
    </Container>
  );
}