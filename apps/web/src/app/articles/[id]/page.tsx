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
  Paper
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
  IconAlertTriangle
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

  useEffect(() => {
    const fetchArticle = async () => {
      try {
        setLoading(true);
        const response = await fetch(`http://localhost:4000/api/articles/${articleId}`, {
          credentials: 'include' // Include auth cookies
        });
        
        if (!response.ok) {
          throw new Error('Failed to fetch article');
        }

        const data: Article = await response.json();
        setArticle(data);
        setError(null);
      } catch (err) {
        setError('Failed to load article. Please try again.');
        console.error('Error fetching article:', err);
      } finally {
        setLoading(false);
      }
    };

    if (articleId) {
      fetchArticle();
    }
  }, [articleId]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PUBLISHED': return 'green';
      case 'UNDER_REVIEW': return 'orange';
      case 'REVISION_REQUESTED': return 'yellow';
      case 'SUBMITTED': return 'blue';
      case 'REJECTED': return 'red';
      case 'RETRACTED': return 'red';
      default: return 'gray';
    }
  };

  const getConversationTypeColor = (type: string) => {
    switch (type) {
      case 'EDITORIAL': return 'blue';
      case 'REVIEW': return 'orange';
      case 'PUBLIC': return 'green';
      default: return 'gray';
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
    <Container size="lg" py="xl">
      <Stack gap="xl">
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

        {/* Header */}
        <Card shadow="sm" padding="xl" radius="md">
          <Stack gap="lg">
            {/* Title and Status */}
            <Group justify="space-between" align="flex-start">
              <Title 
                order={1} 
                style={{ 
                  flex: 1,
                  opacity: article.status === 'RETRACTED' ? 0.7 : 1 
                }}
              >
                {article.title}
              </Title>
              <Badge 
                color={getStatusColor(article.status)} 
                variant={article.status === 'RETRACTED' ? 'filled' : 'light'}
                size="lg"
              >
                {article.status}
              </Badge>
            </Group>

            {/* Authors */}
            <Group gap="xs" align="flex-start">
              <IconUsers size={18} style={{ marginTop: '2px' }} />
              <Text size="lg" fw={500} style={{ flex: 1, lineHeight: 1.4 }}>
                {article.authorDetails && article.authorDetails.length > 0 ? (
                  article.authorDetails.map((author, index) => (
                    <span key={author.id}>
                      {author.name}
                      {author.isCorresponding && (
                        <Text component="span" size="sm" c="dimmed" ml={4}>
                          (corresponding author)
                        </Text>
                      )}
                      {author.orcidId && (
                        <Anchor
                          href={`https://orcid.org/${author.orcidId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ 
                            display: 'inline-flex',
                            alignItems: 'center',
                            marginLeft: '4px',
                            verticalAlign: 'middle'
                          }}
                        >
                          <OrcidIcon size={16} />
                        </Anchor>
                      )}
                      {index < article.authorDetails.length - 1 && ', '}
                    </span>
                  ))
                ) : (
                  article.authors.join(', ')
                )}
              </Text>
            </Group>

            {/* Metadata */}
            <Group gap="xl">
              {article.publishedAt && (
                <Group gap="xs">
                  <IconCalendar size={16} />
                  <Text size="sm" c="dimmed">
                    Published: {formatDate(article.publishedAt)}
                  </Text>
                </Group>
              )}
              <Group gap="xs">
                <IconEye size={16} />
                <Text size="sm" c="dimmed">
                  Submitted: {formatDate(article.submittedAt)}
                </Text>
              </Group>
              <Group gap="xs">
                <IconMessage size={16} />
                <Text size="sm" c="dimmed">
                  {article.conversationCount} conversation{article.conversationCount !== 1 ? 's' : ''}
                </Text>
              </Group>
              {article.doi && (
                <Group gap="xs">
                  <IconExternalLink size={16} />
                  <Anchor
                    href={`https://doi.org/${article.doi}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    size="sm"
                    c="dimmed"
                  >
                    DOI: {article.doi}
                  </Anchor>
                </Group>
              )}
            </Group>

            {/* Keywords */}
            {article.keywords.length > 0 && (
              <Group gap="xs">
                <IconTag size={16} />
                <Group gap="xs">
                  {article.keywords.map((keyword, index) => (
                    <Badge key={index} variant="light" size="sm">
                      {keyword}
                    </Badge>
                  ))}
                </Group>
              </Group>
            )}

            {/* Actions */}
            <Group gap="md">
              {article.fileUrl && (
                <Button 
                  leftSection={<IconDownload size={16} />}
                  component="a"
                  href={article.fileUrl}
                  target="_blank"
                >
                  Download PDF
                </Button>
              )}
              {article.conversations.length > 0 && (
                <Button 
                  variant="outline"
                  leftSection={<IconMessage size={16} />}
                  component={Link}
                  href={`/submissions/${article.conversations[0].id}`}
                >
                  View Discussion
                </Button>
              )}
            </Group>
          </Stack>
        </Card>

        {/* Abstract */}
        <Card shadow="sm" padding="lg" radius="md">
          <Stack gap="md">
            <Title order={3}>Abstract</Title>
            <Text size="md" style={{ lineHeight: 1.7 }}>
              {article.abstract}
            </Text>
          </Stack>
        </Card>

        {/* Files */}
        {article.files && article.files.length > 0 && (
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
        )}


        {/* Navigation */}
        <Group justify="center">
          <Button variant="outline" component={Link} href="/articles">
            ← Back to Articles
          </Button>
        </Group>

      </Stack>
    </Container>
  );
}