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
  IconEye
} from '@tabler/icons-react';
import Link from 'next/link';

interface Manuscript {
  id: string;
  title: string;
  abstract: string;
  authors: string[];
  keywords: string[];
  status: string;
  submittedAt: string;
  publishedAt: string;
  updatedAt: string;
  fileUrl?: string;
  metadata?: any;
  conversationCount: number;
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

export default function ManuscriptDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const manuscriptId = params.id as string;
  
  const [manuscript, setManuscript] = useState<Manuscript | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchManuscript = async () => {
      try {
        setLoading(true);
        const response = await fetch(`http://localhost:4000/api/manuscripts/${manuscriptId}`, {
          credentials: 'include' // Include auth cookies
        });
        
        if (!response.ok) {
          throw new Error('Failed to fetch manuscript');
        }

        const data: Manuscript = await response.json();
        setManuscript(data);
        setError(null);
      } catch (err) {
        setError('Failed to load manuscript. Please try again.');
        console.error('Error fetching manuscript:', err);
      } finally {
        setLoading(false);
      }
    };

    if (manuscriptId) {
      fetchManuscript();
    }
  }, [manuscriptId]);

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
          <Text>Loading manuscript...</Text>
        </Stack>
      </Container>
    );
  }

  if (error || !manuscript) {
    return (
      <Container size="lg" py="xl">
        <Alert icon={<IconAlertCircle size={16} />} color="red">
          {error || 'Manuscript not found'}
        </Alert>
      </Container>
    );
  }

  return (
    <Container size="lg" py="xl">
      <Stack gap="xl">
        {/* Header */}
        <Card shadow="sm" padding="xl" radius="md">
          <Stack gap="lg">
            {/* Title and Status */}
            <Group justify="space-between" align="flex-start">
              <Title order={1} style={{ flex: 1 }}>
                {manuscript.title}
              </Title>
              <Badge 
                color={getStatusColor(manuscript.status)} 
                variant="light"
                size="lg"
              >
                {manuscript.status}
              </Badge>
            </Group>

            {/* Authors */}
            <Group gap="xs">
              <IconUsers size={18} />
              <Text size="lg" fw={500}>
                {manuscript.authors.join(', ')}
              </Text>
            </Group>

            {/* Metadata */}
            <Group gap="xl">
              {manuscript.publishedAt && (
                <Group gap="xs">
                  <IconCalendar size={16} />
                  <Text size="sm" c="dimmed">
                    Published: {formatDate(manuscript.publishedAt)}
                  </Text>
                </Group>
              )}
              <Group gap="xs">
                <IconEye size={16} />
                <Text size="sm" c="dimmed">
                  Submitted: {formatDate(manuscript.submittedAt)}
                </Text>
              </Group>
              <Group gap="xs">
                <IconMessage size={16} />
                <Text size="sm" c="dimmed">
                  {manuscript.conversationCount} conversation{manuscript.conversationCount !== 1 ? 's' : ''}
                </Text>
              </Group>
            </Group>

            {/* Keywords */}
            {manuscript.keywords.length > 0 && (
              <Group gap="xs">
                <IconTag size={16} />
                <Group gap="xs">
                  {manuscript.keywords.map((keyword, index) => (
                    <Badge key={index} variant="light" size="sm">
                      {keyword}
                    </Badge>
                  ))}
                </Group>
              </Group>
            )}

            {/* Actions */}
            <Group gap="md">
              {manuscript.fileUrl && (
                <Button 
                  leftSection={<IconDownload size={16} />}
                  component="a"
                  href={manuscript.fileUrl}
                  target="_blank"
                >
                  Download PDF
                </Button>
              )}
              {manuscript.conversations.length > 0 && (
                <Button 
                  variant="outline"
                  leftSection={<IconMessage size={16} />}
                  component={Link}
                  href={`/submissions?manuscript=${manuscript.id}`}
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
              {manuscript.abstract}
            </Text>
          </Stack>
        </Card>

        {/* Conversations */}
        {manuscript.conversations.length > 0 && (
          <Card shadow="sm" padding="lg" radius="md">
            <Stack gap="md">
              <Title order={3}>Related Discussions</Title>
              {manuscript.conversations.map((conversation) => (
                <Paper key={conversation.id} withBorder p="md" radius="md">
                  <Group justify="space-between" align="flex-start">
                    <Stack gap="xs" style={{ flex: 1 }}>
                      <Group gap="xs">
                        <Anchor
                          component={Link}
                          href={`/submissions/${conversation.id}`}
                          fw={500}
                        >
                          {conversation.title}
                        </Anchor>
                        <Badge 
                          color={getConversationTypeColor(conversation.type)} 
                          variant="light" 
                          size="sm"
                        >
                          {conversation.type}
                        </Badge>
                      </Group>
                      
                      <Group gap="md">
                        <Text size="xs" c="dimmed">
                          {conversation.messageCount} message{conversation.messageCount !== 1 ? 's' : ''}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {conversation.participantCount} participant{conversation.participantCount !== 1 ? 's' : ''}
                        </Text>
                        <Text size="xs" c="dimmed">
                          Updated: {formatDate(conversation.updatedAt)}
                        </Text>
                      </Group>
                    </Stack>
                    
                    <Button
                      size="xs"
                      variant="outline"
                      component={Link}
                      href={`/submissions/${conversation.id}`}
                    >
                      View
                    </Button>
                  </Group>
                </Paper>
              ))}
            </Stack>
          </Card>
        )}

        {/* Navigation */}
        <Group justify="center">
          <Button variant="outline" component={Link} href="/manuscripts">
            ← Back to Manuscripts
          </Button>
        </Group>

      </Stack>
    </Container>
  );
}