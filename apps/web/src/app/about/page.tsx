'use client';

import {
  Container,
  Stack,
  Title,
  Text,
  Group,
  Anchor,
  Loader,
  Alert,
  Badge,
  Paper,
  Flex,
  NavLink,
  Box,
  ScrollArea,
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
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { useEffect, useState } from 'react';
import { useJournalSettings } from '@/contexts/JournalSettingsContext';
import { marked } from 'marked';

async function fetchContent() {
  try {
    const [sectionsResponse, aboutPagesResponse] = await Promise.all([
      fetch('http://localhost:4000/api/content', { cache: 'no-store' }),
      fetch('http://localhost:4000/api/content/about', { cache: 'no-store' })
    ]);

    const sectionsData = sectionsResponse.ok ? await sectionsResponse.json() : { sections: [] };
    const aboutData = aboutPagesResponse.ok ? await aboutPagesResponse.json() : { pages: [] };

    return {
      sections: sectionsData.sections || [],
      aboutPages: aboutData.pages || []
    };
  } catch (err) {
    console.error('Error fetching content:', err);
    return {
      sections: [],
      aboutPages: []
    };
  }
}

async function fetchPageContent(slug: string) {
  try {
    const response = await fetch(`http://localhost:4000/api/content/about/${slug}`, { cache: 'no-store' });
    return response.ok ? await response.json() : null;
  } catch (err) {
    console.error('Error fetching page content:', err);
    return null;
  }
}

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
  content?: string;
  icon?: string;
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

// Fallback mapping for pages without custom icons (legacy support)
const FALLBACK_ICONS = {
  'index': IconFileText,
  'submission-scope': IconFileText,
  'code-of-conduct': IconGavel,
  'ethics-guidelines': IconShield,
  'licensing': IconLicense,
  'editorial-board': IconUsers
};

export default function AboutPage() {
  const { settings: journalSettings } = useJournalSettings();
  const router = useRouter();
  const [sections, setSections] = useState<ContentSection[]>([]);
  const [aboutPages, setAboutPages] = useState<ContentPage[]>([]);
  const [activeSection, setActiveSection] = useState<string>('index');
  const [currentContent, setCurrentContent] = useState<ContentPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [contentLoading, setContentLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadContent = async () => {
      try {
        setLoading(true);
        const contentData = await fetchContent();
        setSections(contentData.sections);
        setAboutPages(contentData.aboutPages);
        
        // Load initial content based on URL fragment or default to index
        if (contentData.aboutPages.length > 0) {
          const hash = window.location.hash.slice(1); // Remove # from hash
          let initialPage: ContentPage;
          
          if (hash && contentData.aboutPages.find((page: ContentPage) => page.slug === hash)) {
            initialPage = contentData.aboutPages.find((page: ContentPage) => page.slug === hash)!;
          } else {
            initialPage = contentData.aboutPages.find((page: ContentPage) => page.slug === 'index') || contentData.aboutPages[0];
          }
          
          await loadPageContent(initialPage.slug, false); // Don't update URL on initial load
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load content');
      } finally {
        setLoading(false);
      }
    };
    
    loadContent();
  }, []);

  const loadPageContent = async (slug: string, updateUrl: boolean = true) => {
    try {
      setContentLoading(true);
      const pageData = await fetchPageContent(slug);
      if (pageData) {
        // Process markdown content
        if (pageData.content) {
          const processedContent = await marked(pageData.content);
          pageData.content = processedContent as string;
        }
        setCurrentContent(pageData);
        setActiveSection(slug);
        
        // Update URL with anchor if requested
        if (updateUrl) {
          const newUrl = slug === 'index' ? '/about' : `/about#${slug}`;
          window.history.pushState({}, '', newUrl);
        }
        
        // Scroll to top of content area
        const contentArea = document.querySelector('[data-content-area]');
        if (contentArea) {
          contentArea.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    } catch (err) {
      console.error('Error loading page content:', err);
    } finally {
      setContentLoading(false);
    }
  };

  // Handle browser back/forward navigation
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1);
      if (hash && aboutPages.find(page => page.slug === hash)) {
        loadPageContent(hash, false);
      } else if (!hash || hash === '') {
        // If no hash, load index page
        loadPageContent('index', false);
      }
    };

    // Listen for hash changes
    window.addEventListener('hashchange', handleHashChange);
    
    // Listen for popstate (back/forward buttons)
    window.addEventListener('popstate', handleHashChange);

    return () => {
      window.removeEventListener('hashchange', handleHashChange);
      window.removeEventListener('popstate', handleHashChange);
    };
  }, [aboutPages]);

  const formatDate = (timestamp: number | string) => {
    const date = typeof timestamp === 'string' ? new Date(timestamp) : new Date(timestamp);
    return format(date, 'MMM dd, yyyy');
  };


  const getPageIcon = (page: ContentPage) => {
    // First, try to use the custom icon from frontmatter
    if (page.icon && page.icon in ICON_MAP) {
      return ICON_MAP[page.icon as keyof typeof ICON_MAP];
    }
    
    // Fallback to legacy slug-based mapping
    if (page.slug in FALLBACK_ICONS) {
      return FALLBACK_ICONS[page.slug as keyof typeof FALLBACK_ICONS];
    }
    
    // Final fallback
    return IconFileText;
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
    <Container size="xl" py="xl">
      <Stack gap="xl">
        {/* Header */}
        <Stack gap="md" align="center">
          <Title order={1} ta="center">About {journalSettings.name}</Title>
          <Text size="lg" c="dimmed" ta="center" maw={600}>
            Learn about our mission, policies, and community guidelines for open academic publishing.
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
              
              {aboutPages
                .sort((a, b) => a.order - b.order)
                .map((page: ContentPage) => {
                  const IconComponent = getPageIcon(page);
                  return (
                    <NavLink
                      key={page.slug}
                      label={page.title}
                      leftSection={<IconComponent size={20} />}
                      active={activeSection === page.slug}
                      onClick={() => loadPageContent(page.slug)}
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
          <Box style={{ flex: 1 }} data-content-area>
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