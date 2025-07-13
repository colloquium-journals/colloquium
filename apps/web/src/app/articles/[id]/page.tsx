'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { 
  Container, 
  Title, 
  Text, 
  Badge, 
  Group, 
  Stack, 
  Loader, 
  Alert,
  Card,
  Button,
  Divider,
  Anchor,
  Paper,
  Grid,
  Box
} from '@mantine/core';
import { 
  IconAlertCircle, 
  IconCalendar, 
  IconUsers, 
  IconTag,
  IconDownload,
  IconMessage,
  IconEye,
  IconExternalLink,
  IconAlertTriangle,
  IconUserCog,
  IconUserCheck,
  IconScale
} from '@tabler/icons-react';
import Link from 'next/link';
import FileList, { FileItem } from '@/components/submissions/FileList';

// ORCID Icon Component
const OrcidIcon = ({ size = 16 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
    style={{ display: 'inline-block', verticalAlign: 'middle' }}
  >
    <circle cx="12" cy="12" r="12" fill="#A6CE39" />
    <g transform="translate(6, 8)">
      <path d="M0 0h12v8H0z" fill="none" />
      <text
        x="6"
        y="6"
        textAnchor="middle"
        fill="white"
        fontSize="8"
        fontFamily="Arial, sans-serif"
        fontWeight="bold"
      >
        iD
      </text>
    </g>
  </svg>
);

interface Author {
  id: string;
  name: string;
  email: string;
  orcidId?: string;
  order: number;
  isCorresponding: boolean;
}

interface ActionEditor {
  id: string;
  editorId: string;
  assignedAt: string;
  users_action_editors_editorIdTousers?: {
    id: string;
    name: string;
    email: string;
    affiliation?: string;
  };
}

interface ReviewAssignment {
  id: string;
  reviewer: {
    id: string;
    name: string;
    email: string;
    affiliation?: string;
  };
  status: string;
  assignedAt: string;
  dueDate?: string;
  completedAt?: string;
}

interface Article {
  id: string;
  title: string;
  abstract: string;
  authors: string[]; // Legacy field
  authorDetails: Author[];
  keywords: string[];
  status: string;
  submittedAt: string;
  publishedAt: string;
  updatedAt: string;
  fileUrl?: string;
  doi?: string;
  metadata?: any;
  conversationCount: number;
  files: FileItem[];
  action_editors?: ActionEditor | null;
  reviewAssignments: ReviewAssignment[];
  conversations: Array<{
    id: string;
    title: string;
    type: string;
    privacy: string;
    messageCount: number;
    participantCount: number;
    createdAt: string;
    updatedAt: string;
  }>;
}

export default function ArticleDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const articleId = params.id as string;
  
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [journalSettings, setJournalSettings] = useState<any>(null);
  const [htmlContent, setHtmlContent] = useState<string>('');
  const [loadingHTML, setLoadingHTML] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch article and settings in parallel
        const [articleResponse, settingsResponse] = await Promise.all([
          fetch(`http://localhost:4000/api/articles/${articleId}`, {
            credentials: 'include'
          }),
          fetch(`http://localhost:4000/api/settings`)
        ]);
        
        if (!articleResponse.ok) {
          throw new Error('Failed to fetch article');
        }

        const articleData: Article = await articleResponse.json();
        setArticle(articleData);
        
        if (settingsResponse.ok) {
          const settingsData = await settingsResponse.json();
          setJournalSettings(settingsData);
        }
        
        setError(null);
      } catch (err) {
        setError('Failed to load article. Please try again.');
        console.error('Error fetching data:', err);
      } finally {
        setLoading(false);
      }
    };

    if (articleId) {
      fetchData();
    }
  }, [articleId]);

  // Auto-load HTML content when article is loaded
  useEffect(() => {
    if (article && getRenderedHTML()) {
      loadHTMLContent();
    }
  }, [article]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getConversationTypeColor = (type: string) => {
    switch (type) {
      case 'EDITORIAL': return 'blue';
      case 'REVIEW': return 'orange';
      case 'PUBLIC': return 'green';
      default: return 'gray';
    }
  };

  // Helper function to find rendered HTML file
  const getRenderedHTML = () => {
    if (!article?.files) return null;
    return article.files
      .filter(f => f.fileType === 'RENDERED' && f.mimetype === 'text/html')
      .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())[0] || null;
  };

  // Helper function to find rendered PDF file
  const getRenderedPDF = () => {
    if (!article?.files) return null;
    return article.files
      .filter(f => f.fileType === 'RENDERED' && f.mimetype === 'application/pdf')
      .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())[0] || null;
  };

  // Get the content to display (HTML first, then PDF)
  const getRenderedContent = () => {
    const htmlFile = getRenderedHTML();
    const pdfFile = getRenderedPDF();
    return htmlFile || pdfFile;
  };

  // Function to automatically scope CSS to prevent interference with page styles
  const scopeHTMLContent = (htmlContent: string): string => {
    // Extract CSS from style tags
    const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
    
    let scopedHTML = htmlContent;
    let match;
    
    while ((match = styleRegex.exec(htmlContent)) !== null) {
      const originalCSS = match[1];
      
      // Skip if already scoped or contains scoping comments
      if (originalCSS.includes('.rendered-document') || originalCSS.includes('/* scoped */')) {
        continue;
      }
      
      // Scope CSS rules by prefixing with .rendered-document
      const scopedCSS = originalCSS
        // Handle body styles specifically
        .replace(/\bbody\s*{/g, '.rendered-document {')
        // Handle element selectors (but not pseudo-selectors or media queries)
        .replace(/^(\s*)([a-zA-Z][a-zA-Z0-9]*(?:\s*,\s*[a-zA-Z][a-zA-Z0-9]*)*)\s*{/gm, '$1.rendered-document $2 {')
        // Handle class selectors that aren't already scoped
        .replace(/^(\s*)(\.[a-zA-Z][a-zA-Z0-9_-]*(?:\s*,\s*\.[a-zA-Z][a-zA-Z0-9_-]*)*)\s*{/gm, '$1.rendered-document $2 {')
        // Handle complex selectors with combinators
        .replace(/^(\s*)([^@}]+?)\s*{/gm, (fullMatch, indent, selector) => {
          // Skip @rules, already scoped rules, or rules with .rendered-document
          if (selector.includes('@') || selector.includes('.rendered-document') || selector.trim().startsWith('/*')) {
            return fullMatch;
          }
          return `${indent}.rendered-document ${selector.trim()} {`;
        });
      
      // Add scoping comment
      const finalCSS = `/* CSS automatically scoped for safe embedding */\n${scopedCSS}`;
      
      // Replace the original style tag with scoped version
      scopedHTML = scopedHTML.replace(match[0], `<style>${finalCSS}</style>`);
    }
    
    // Wrap body content in scoped container if not already wrapped
    if (!scopedHTML.includes('class="rendered-document"')) {
      scopedHTML = scopedHTML.replace(
        /<body[^>]*>([\s\S]*?)<\/body>/i,
        '<body><div class="rendered-document">$1</div></body>'
      );
    }
    
    return scopedHTML;
  };

  // Function to fetch and load HTML content
  const loadHTMLContent = async () => {
    const htmlFile = getRenderedHTML();
    if (!htmlFile || !article) return;

    setLoadingHTML(true);
    try {
      const response = await fetch(`http://localhost:4000/api/articles/${article.id}/files/${htmlFile.id}/download?inline=true`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch HTML: ${response.status} ${response.statusText}`);
      }
      
      const htmlText = await response.text();
      const scopedHTML = scopeHTMLContent(htmlText);
      setHtmlContent(scopedHTML);
    } catch (error) {
      console.error('Error fetching HTML content:', error);
      setHtmlContent('');
    } finally {
      setLoadingHTML(false);
    }
  };


  if (loading) {
    return (
      <Container size="lg" py="xl">
        <Stack align="center" gap="md">
          <Loader size="lg" />
          <Text>Loading article...</Text>
        </Stack>
      </Container>
    );
  }

  if (error || !article) {
    return (
      <Container size="lg" py="xl">
        <Alert icon={<IconAlertCircle size={16} />} color="red">
          {error || 'Article not found'}
        </Alert>
      </Container>
    );
  }

  return (
    <Container size="xl" py="xl">
      <Stack gap="lg">
        {/* RETRACTED Warning */}
        {article.status === 'RETRACTED' && (
          <Alert 
            icon={<IconAlertTriangle size={20} />} 
            color="red" 
            variant="filled"
          >
            <Group justify="space-between" align="flex-start">
              <Stack gap="xs">
                <Text size="lg" fw={700}>
                  ⚠️ RETRACTED MANUSCRIPT
                </Text>
                <Text size="sm">
                  This article has been retracted and is no longer considered valid research. 
                  It remains available for transparency and academic record-keeping purposes.
                </Text>
              </Stack>
            </Group>
          </Alert>
        )}

        {/* Article Title */}
        <Title 
          order={1}
          mb="lg"
          style={{ 
            opacity: article.status === 'RETRACTED' ? 0.7 : 1,
            lineHeight: 1.3
          }}
        >
          {article.title}
        </Title>

        <Grid>
          {/* Sidebar - Metadata */}
          <Grid.Col span={3}>
            <Stack gap="lg">
              <Card shadow="sm" padding="lg" radius="md" style={{ position: 'sticky', top: '20px' }}>
                <Stack gap="md">

                  {/* Authors */}
                  <Box>
                    <Group gap="xs" mb="xs">
                      <IconUsers size={16} />
                      <Text size="sm" fw={500} c="dimmed">Authors</Text>
                    </Group>
                    <Stack gap="xs">
                      {article.authorDetails && article.authorDetails.length > 0 ? (
                        article.authorDetails.map((author) => (
                          <Group key={author.id} gap="xs" align="center">
                            <Anchor
                              component={Link}
                              href={`/users/${author.id}`}
                              size="sm"
                              fw={500}
                              style={{ textDecoration: 'none' }}
                            >
                              {author.name}
                            </Anchor>
                            {author.isCorresponding && (
                              <Badge size="xs" variant="light" color="orange">
                                corresponding
                              </Badge>
                            )}
                            {author.orcidId && (
                              <Anchor
                                href={`https://orcid.org/${author.orcidId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <OrcidIcon size={14} />
                              </Anchor>
                            )}
                          </Group>
                        ))
                      ) : (
                        article.authors.map((name, index) => (
                          <Text key={index} size="sm" fw={500}>{name}</Text>
                        ))
                      )}
                    </Stack>
                  </Box>

                  <Divider />

                  {/* Dates */}
                  <Stack gap="xs">
                    {article.publishedAt && (
                      <Group gap="xs">
                        <IconCalendar size={14} />
                        <Text size="xs" c="dimmed">
                          Published: {formatDate(article.publishedAt)}
                        </Text>
                      </Group>
                    )}
                    <Group gap="xs">
                      <IconEye size={14} />
                      <Text size="xs" c="dimmed">
                        Submitted: {formatDate(article.submittedAt)}
                      </Text>
                    </Group>
                    {article.doi && (
                      <Group gap="xs">
                        <IconExternalLink size={14} />
                        <Anchor
                          href={`https://doi.org/${article.doi}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          size="xs"
                          c="dimmed"
                        >
                          DOI: {article.doi}
                        </Anchor>
                      </Group>
                    )}
                  </Stack>

                  {/* Action Editor */}
                  {article.action_editors && (
                    <>
                      <Divider />
                      <Box>
                        <Group gap="xs" mb="xs">
                          <IconUserCog size={14} />
                          <Text size="xs" fw={500} c="dimmed">Action Editor</Text>
                        </Group>
                        <Group gap="xs" align="center">
                          {article.action_editors.users_action_editors_editorIdTousers ? (
                            <Anchor
                              component={Link}
                              href={`/users/${article.action_editors.users_action_editors_editorIdTousers.id}`}
                              size="sm"
                              fw={500}
                              style={{ textDecoration: 'none' }}
                            >
                              {article.action_editors.users_action_editors_editorIdTousers.name}
                            </Anchor>
                          ) : (
                            <Text size="sm" fw={500}>
                              Assigned
                            </Text>
                          )}
                        </Group>
                        {article.action_editors.users_action_editors_editorIdTousers?.affiliation && (
                          <Text size="xs" c="dimmed">
                            {article.action_editors.users_action_editors_editorIdTousers.affiliation}
                          </Text>
                        )}
                      </Box>
                    </>
                  )}

                  {/* Reviewers */}
                  {article.reviewAssignments && article.reviewAssignments.length > 0 && (
                    <>
                      <Divider />
                      <Box>
                        <Group gap="xs" mb="xs">
                          <IconUserCheck size={14} />
                          <Text size="xs" fw={500} c="dimmed">Reviewers</Text>
                        </Group>
                        <Stack gap="xs">
                          {article.reviewAssignments
                            .filter(assignment => ['ACCEPTED', 'IN_PROGRESS', 'COMPLETED'].includes(assignment.status))
                            .map((assignment) => (
                              <Group key={assignment.id} gap="xs" align="center">
                                <Anchor
                                  component={Link}
                                  href={`/users/${assignment.reviewer.id}`}
                                  size="sm"
                                  fw={500}
                                  style={{ textDecoration: 'none' }}
                                >
                                  {assignment.reviewer.name}
                                </Anchor>
                                <Badge size="xs" variant="light" color={
                                  assignment.status === 'COMPLETED' ? 'green' : 
                                  assignment.status === 'IN_PROGRESS' ? 'blue' : 'gray'
                                }>
                                  {assignment.status.toLowerCase().replace('_', ' ')}
                                </Badge>
                              </Group>
                            ))}
                        </Stack>
                      </Box>
                    </>
                  )}

                  {/* Keywords */}
                  {article.keywords.length > 0 && (
                    <>
                      <Divider />
                      <Box>
                        <Group gap="xs" mb="xs">
                          <IconTag size={14} />
                          <Text size="xs" fw={500} c="dimmed">Keywords</Text>
                        </Group>
                        <Group gap="xs">
                          {article.keywords.map((keyword, index) => (
                            <Badge key={index} variant="light" size="xs">
                              {keyword}
                            </Badge>
                          ))}
                        </Group>
                      </Box>
                    </>
                  )}

                  {/* License */}
                  {journalSettings?.licenseType && (
                    <>
                      <Divider />
                      <Box>
                        <Group gap="xs" mb="xs">
                          <IconScale size={14} />
                          <Text size="xs" fw={500} c="dimmed">License</Text>
                        </Group>
                        <Group gap="xs" align="center">
                          <Text size="sm" fw={500}>
                            {journalSettings.licenseType}
                          </Text>
                        </Group>
                        <Text size="xs" c="dimmed">
                          © {new Date(article.submittedAt).getFullYear()} by the authors
                        </Text>
                      </Box>
                    </>
                  )}

                  <Divider />

                  {/* Actions */}
                  <Stack gap="xs">
                    {article.fileUrl && (
                      <Button 
                        size="sm"
                        leftSection={<IconDownload size={14} />}
                        component="a"
                        href={article.fileUrl}
                        target="_blank"
                        fullWidth
                      >
                        Download PDF
                      </Button>
                    )}
                    {article.conversations.length > 0 && (
                      <Button 
                        size="sm"
                        variant="outline"
                        leftSection={<IconMessage size={14} />}
                        component={Link}
                        href={`/submissions/${article.conversations[0].id}`}
                        fullWidth
                      >
                        Peer Review
                      </Button>
                    )}
                    <Button 
                      size="sm"
                      variant="light"
                      component={Link}
                      href="/articles"
                      fullWidth
                    >
                      ← Back to Articles
                    </Button>
                  </Stack>
                </Stack>
              </Card>
            </Stack>
          </Grid.Col>

          {/* Main Content Area */}
          <Grid.Col span={9}>
            {/* Rendered Content - Primary Focus */}
            {getRenderedContent() ? (
              <Stack gap="md">
                {getRenderedHTML() && htmlContent ? (
                  // Display HTML content inline seamlessly
                  <div 
                    dangerouslySetInnerHTML={{ __html: htmlContent }}
                    style={{
                      width: '100%'
                    }}
                  />
                ) : getRenderedHTML() && loadingHTML ? (
                  // Loading state for HTML
                  <div style={{
                    height: '400px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <Stack align="center" gap="md">
                      <Loader size="lg" />
                      <Text>Loading article content...</Text>
                    </Stack>
                  </div>
                ) : getRenderedPDF() ? (
                  // Display PDF content in iframe (PDFs need iframe)
                  <Box style={{ height: 'calc(100vh - 140px)' }}>
                    <iframe
                      src={`http://localhost:4000/api/articles/${article.id}/files/${getRenderedPDF()?.id}/download?inline=true`}
                      style={{
                        width: '100%',
                        height: '100%',
                        border: '1px solid #e9ecef',
                        borderRadius: '8px',
                        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
                      }}
                      title="Article PDF"
                    />
                  </Box>
                ) : null}
              </Stack>
            ) : (
              // Fallback: Show files if no rendered content available
              article.files && article.files.length > 0 && (
                <Card shadow="sm" padding="lg" radius="md">
                  <Stack gap="md">
                    <Title order={3}>Files</Title>
                    <FileList 
                      files={article.files}
                      showFileType={true}
                      allowDownload={true}
                      groupByType={true}
                    />
                  </Stack>
                </Card>
              )
            )}


          </Grid.Col>
        </Grid>
      </Stack>
    </Container>
  );
}