'use client';

import { useState, useEffect } from 'react';
import { 
  Paper, 
  Title, 
  Text, 
  Group, 
  Badge, 
  Stack, 
  Avatar,
  Divider,
  Box,
  Loader,
  Alert
} from '@mantine/core';
import { 
  IconCalendar, 
  IconUser, 
  IconFileText,
  IconAlertCircle,
  IconClock,
  IconCheck,
  IconX
} from '@tabler/icons-react';

interface SubmissionData {
  id: string;
  title: string;
  abstract?: string;
  status: string;
  submittedAt: string;
  updatedAt: string;
  authors: Array<{
    id: string;
    name: string;
    email: string;
    affiliation?: string;
    isCorresponding?: boolean;
  }>;
  keywords?: string[];
  manuscript?: {
    filename: string;
    size: number;
    uploadedAt: string;
  };
  reviewAssignments?: Array<{
    id: string;
    reviewer: {
      name: string;
      affiliation?: string;
    };
    status: string;
    assignedAt: string;
    dueDate?: string;
  }>;
}

interface SubmissionHeaderProps {
  submissionId: string;
}

export function SubmissionHeader({ submissionId }: SubmissionHeaderProps) {
  const [submission, setSubmission] = useState<SubmissionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSubmission = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/manuscripts/${submissionId}`, {
          credentials: 'include'
        });

        if (!response.ok) {
          throw new Error('Failed to fetch submission details');
        }

        const data = await response.json();
        setSubmission(data.manuscript);
      } catch (err) {
        console.error('Error fetching submission:', err);
        setError('Failed to load submission details');
      } finally {
        setLoading(false);
      }
    };

    if (submissionId) {
      fetchSubmission();
    }
  }, [submissionId]);

  if (loading) {
    return (
      <Paper shadow="md" p="xl" radius="lg">
        <Group>
          <Loader size="md" />
          <Text>Loading submission details...</Text>
        </Group>
      </Paper>
    );
  }

  if (error || !submission) {
    return (
      <Alert icon={<IconAlertCircle size={16} />} color="red" variant="filled">
        {error || 'Submission not found'}
      </Alert>
    );
  }

  return (
    <Box>
      {/* Main Header */}
      <Paper shadow="md" p="xl" radius="lg" style={{ background: 'linear-gradient(135deg, var(--mantine-color-blue-0) 0%, var(--mantine-color-indigo-0) 100%)' }}>
        <Stack gap="lg">
          {/* Title and Status */}
          <Group justify="space-between" align="flex-start">
            <Box style={{ flex: 1 }}>
              <Group gap="sm" mb="xs">
                <Badge 
                  size="lg"
                  variant="filled"
                  color={getStatusColor(submission.status)}
                  leftSection={getStatusIcon(submission.status)}
                >
                  {getStatusLabel(submission.status)}
                </Badge>
                <Text size="sm" c="dimmed">
                  ID: {submission.id}
                </Text>
              </Group>
              
              <Title order={1} size="h2" mb="md" style={{ lineHeight: 1.3 }}>
                {submission.title}
              </Title>
              
              {submission.abstract && (
                <Text size="sm" c="dimmed" lineClamp={3} style={{ maxWidth: '80%' }}>
                  {submission.abstract}
                </Text>
              )}
            </Box>

            <Box>
              <Text size="xs" c="dimmed" ta="right">
                Use @editorial-bot for actions
              </Text>
            </Box>
          </Group>

          {/* Keywords */}
          {submission.keywords && submission.keywords.length > 0 && (
            <Group gap="xs">
              <Text size="sm" fw={500} c="dimmed">Keywords:</Text>
              {submission.keywords.map((keyword, index) => (
                <Badge key={index} size="sm" variant="light" color="gray">
                  {keyword}
                </Badge>
              ))}
            </Group>
          )}
        </Stack>
      </Paper>

      {/* Authors and Metadata */}
      <Paper shadow="sm" p="lg" radius="lg" mt="md">
        <Stack gap="lg">
          {/* Authors */}
          <Box>
            <Group gap="xs" mb="md">
              <IconUser size={18} />
              <Text fw={600} size="sm">Authors</Text>
            </Group>
            <Group gap="md">
              {submission.authors.map((author) => (
                <Group key={author.id} gap="sm">
                  <Avatar size="sm" color="blue">
                    {author.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                  </Avatar>
                  <Box>
                    <Text size="sm" fw={500}>
                      {author.name}
                      {author.isCorresponding && (
                        <Badge size="xs" variant="light" color="orange" ml="xs">
                          Corresponding
                        </Badge>
                      )}
                    </Text>
                    {author.affiliation && (
                      <Text size="xs" c="dimmed">{author.affiliation}</Text>
                    )}
                  </Box>
                </Group>
              ))}
            </Group>
          </Box>

          <Divider />

          {/* Dates and File Info */}
          <Group grow>
            <Box>
              <Group gap="xs" mb="xs">
                <IconCalendar size={16} />
                <Text size="sm" fw={500} c="dimmed">Submitted</Text>
              </Group>
              <Text size="sm">
                {new Date(submission.submittedAt).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </Text>
            </Box>

            <Box>
              <Group gap="xs" mb="xs">
                <IconClock size={16} />
                <Text size="sm" fw={500} c="dimmed">Last Updated</Text>
              </Group>
              <Text size="sm">
                {new Date(submission.updatedAt).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </Text>
            </Box>

            {submission.manuscript && (
              <Box>
                <Group gap="xs" mb="xs">
                  <IconFileText size={16} />
                  <Text size="sm" fw={500} c="dimmed">Manuscript</Text>
                </Group>
                <Text size="sm">
                  {submission.manuscript.filename}
                </Text>
                <Text size="xs" c="dimmed">
                  {(submission.manuscript.size / 1024 / 1024).toFixed(1)} MB
                </Text>
              </Box>
            )}
          </Group>

          {/* Review Assignments (if any) */}
          {submission.reviewAssignments && submission.reviewAssignments.length > 0 && (
            <>
              <Divider />
              <Box>
                <Text fw={600} size="sm" mb="md">Review Assignments</Text>
                <Stack gap="sm">
                  {submission.reviewAssignments.map((assignment) => (
                    <Group key={assignment.id} justify="space-between">
                      <Group gap="sm">
                        <Avatar size="xs" color="grape">
                          {assignment.reviewer.name.split(' ').map(n => n[0]).join('')}
                        </Avatar>
                        <Box>
                          <Text size="sm">{assignment.reviewer.name}</Text>
                          {assignment.reviewer.affiliation && (
                            <Text size="xs" c="dimmed">{assignment.reviewer.affiliation}</Text>
                          )}
                        </Box>
                      </Group>
                      <Badge 
                        size="sm" 
                        variant="light"
                        color={getReviewStatusColor(assignment.status)}
                      >
                        {assignment.status}
                      </Badge>
                    </Group>
                  ))}
                </Stack>
              </Box>
            </>
          )}
        </Stack>
      </Paper>
    </Box>
  );
}

function getStatusColor(status: string): string {
  switch (status.toUpperCase()) {
    case 'SUBMITTED':
    case 'UNDER_REVIEW':
      return 'blue';
    case 'ACCEPTED':
      return 'green';
    case 'REJECTED':
      return 'red';
    case 'REVISION_REQUESTED':
      return 'yellow';
    case 'PUBLISHED':
      return 'teal';
    default:
      return 'gray';
  }
}

function getStatusIcon(status: string) {
  switch (status.toUpperCase()) {
    case 'SUBMITTED':
      return <IconClock size={12} />;
    case 'UNDER_REVIEW':
      return <IconEye size={12} />;
    case 'ACCEPTED':
      return <IconCheck size={12} />;
    case 'REJECTED':
      return <IconX size={12} />;
    case 'REVISION_REQUESTED':
      return <IconAlertCircle size={12} />;
    case 'PUBLISHED':
      return <IconCheck size={12} />;
    default:
      return <IconFileText size={12} />;
  }
}

function getStatusLabel(status: string): string {
  switch (status.toUpperCase()) {
    case 'SUBMITTED':
      return 'Submitted';
    case 'UNDER_REVIEW':
      return 'Under Review';
    case 'ACCEPTED':
      return 'Accepted';
    case 'REJECTED':
      return 'Rejected';
    case 'REVISION_REQUESTED':
      return 'Revision Requested';
    case 'PUBLISHED':
      return 'Published';
    default:
      return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
  }
}

function getReviewStatusColor(status: string): string {
  switch (status.toUpperCase()) {
    case 'PENDING':
      return 'yellow';
    case 'IN_PROGRESS':
      return 'blue';
    case 'COMPLETED':
      return 'green';
    case 'OVERDUE':
      return 'red';
    default:
      return 'gray';
  }
}