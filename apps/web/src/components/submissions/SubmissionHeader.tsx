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
  Alert,
  Button,
  ActionIcon,
  Collapse
} from '@mantine/core';
import { 
  IconCalendar, 
  IconUser, 
  IconFileText,
  IconAlertCircle,
  IconClock,
  IconCheck,
  IconX,
  IconEye,
  IconDownload,
  IconFiles,
  IconPhoto,
  IconCode,
  IconUserCog,
  IconChevronDown,
  IconChevronRight
} from '@tabler/icons-react';
import { useSSE } from '../../hooks/useSSE';

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
  files?: Array<{
    id: string;
    filename: string;
    originalName: string;
    size: number;
    fileType: string;
    mimetype: string;
    uploadedAt: string;
  }>;
  assignedEditor?: {
    id: string;
    name: string;
    email: string;
    affiliation?: string;
    assignedAt: string;
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
  submissionId: string; // This is actually a conversation ID
}

export function SubmissionHeader({ submissionId }: SubmissionHeaderProps) {
  const [submission, setSubmission] = useState<SubmissionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filesExpanded, setFilesExpanded] = useState(false);

  // Handle real-time action editor assignment updates
  const handleActionEditorAssigned = (assignment: any) => {
    setSubmission(prev => prev ? {
      ...prev,
      assignedEditor: {
        id: assignment.editor.id,
        name: assignment.editor.name,
        email: assignment.editor.email,
        affiliation: assignment.editor.affiliation,
        assignedAt: assignment.assignedAt
      }
    } : prev);
  };

  // Handle real-time reviewer assignment updates
  const handleReviewerAssigned = (assignment: any) => {
    setSubmission(prev => prev ? {
      ...prev,
      reviewAssignments: [
        ...(prev.reviewAssignments || []),
        {
          id: assignment.assignmentId,
          reviewer: {
            id: assignment.reviewer.id,
            name: assignment.reviewer.name || assignment.reviewer.email,
            email: assignment.reviewer.email,
            affiliation: assignment.reviewer.affiliation
          },
          status: assignment.status,
          assignedAt: assignment.assignedAt,
          dueDate: assignment.dueDate
        }
      ]
    } : prev);
  };

  // Initialize SSE connection for real-time updates
  useSSE(submissionId, {
    enabled: !!submissionId,
    onActionEditorAssigned: handleActionEditorAssigned,
    onReviewerAssigned: handleReviewerAssigned
  });

  useEffect(() => {
    const fetchSubmission = async () => {
      try {
        setLoading(true);
        
        // Fetch the conversation to get the manuscript data
        const conversationResponse = await fetch(`http://localhost:4000/api/conversations/${submissionId}`, {
          credentials: 'include'
        });

        if (!conversationResponse.ok) {
          throw new Error('Failed to fetch conversation details');
        }

        const conversationData = await conversationResponse.json();
        const manuscript = conversationData.manuscript;

        if (!manuscript) {
          throw new Error('No manuscript associated with this conversation');
        }

        // Try to fetch full manuscript details, but fall back to conversation data if forbidden
        let manuscriptData = manuscript;
        try {
          const manuscriptResponse = await fetch(`http://localhost:4000/api/manuscripts/${manuscript.id}`, {
            credentials: 'include'
          });

          if (manuscriptResponse.ok) {
            manuscriptData = await manuscriptResponse.json();
          }
        } catch (err) {
          // If we can't fetch full manuscript details, use what we have from conversation
          console.warn('Could not fetch full manuscript details, using conversation data:', err);
        }

        // Format submission data from either full manuscript or conversation manuscript data
        setSubmission({
          id: manuscriptData.id,
          title: manuscriptData.title,
          abstract: manuscriptData.abstract || '',
          status: manuscriptData.status || 'SUBMITTED',
          submittedAt: manuscriptData.submittedAt || manuscriptData.createdAt || new Date().toISOString(),
          updatedAt: manuscriptData.updatedAt || new Date().toISOString(),
          authors: manuscriptData.authorDetails?.map((author: any) => ({
            id: author.id,
            name: author.name,
            email: author.email,
            affiliation: author.affiliation,
            isCorresponding: author.isCorresponding
          })) || manuscriptData.authors?.map((name: string, index: number) => ({
            id: `author-${index}`,
            name,
            email: '',
            isCorresponding: index === 0
          })) || [],
          keywords: manuscriptData.keywords || [],
          files: manuscriptData.files?.map((file: any) => ({
            id: file.id,
            filename: file.filename,
            originalName: file.originalName,
            size: file.size,
            fileType: file.fileType,
            mimetype: file.mimetype,
            uploadedAt: file.uploadedAt
          })) || [],
          assignedEditor: manuscriptData.action_editors ? {
            id: manuscriptData.action_editors.users_action_editors_editorIdTousers.id,
            name: manuscriptData.action_editors.users_action_editors_editorIdTousers.name,
            email: manuscriptData.action_editors.users_action_editors_editorIdTousers.email,
            affiliation: manuscriptData.action_editors.users_action_editors_editorIdTousers.affiliation,
            assignedAt: manuscriptData.action_editors.assignedAt
          } : undefined,
          reviewAssignments: manuscriptData.reviewAssignments?.map((assignment: any) => ({
            id: assignment.id,
            reviewer: {
              name: assignment.reviewer.name,
              affiliation: assignment.reviewer.affiliation
            },
            status: assignment.status,
            assignedAt: assignment.assignedAt,
            dueDate: assignment.dueDate
          })) || []
        });
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

  const handleDownload = async (fileId?: string) => {
    if (!submission?.files || submission.files.length === 0) return;
    
    // Use first file if no specific file ID provided, or find the specified file
    const fileToDownload = fileId 
      ? submission.files.find(f => f.id === fileId)
      : submission.files.find(f => f.fileType === 'SOURCE') || submission.files[0];
    
    if (!fileToDownload) return;
    
    try {
      const response = await fetch(`http://localhost:4000/api/manuscripts/${submission.id}/files/${fileToDownload.id}/download`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to download file');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileToDownload.originalName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading file:', error);
    }
  };

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
    <Paper shadow="md" p="xl" radius="lg" style={{ background: 'linear-gradient(135deg, var(--mantine-color-blue-0) 0%, var(--mantine-color-indigo-0) 100%)' }}>
      <Stack gap="lg">
        {/* Title, Status, and Actions Row */}
        <Group justify="space-between" align="flex-start">
          <Box style={{ flex: 1 }}>
            <Group gap="sm" mb="xs" align="center">
              <Badge 
                size="lg"
                variant="filled"
                color={getStatusColor(submission.status)}
                leftSection={getStatusIcon(submission.status)}
              >
                {getStatusLabel(submission.status)}
              </Badge>
            </Group>
            
            <Title order={1} size="h2" mb="sm" style={{ lineHeight: 1.3 }}>
              {submission.title}
            </Title>
            
            {/* Authors directly below title */}
            <Group gap="md" mb="md">
              {submission.authors.map((author) => (
                <Group key={author.id} gap="sm">
                  <Avatar size="sm" color="blue">
                    {author.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                  </Avatar>
                  <Box>
                    <Group gap="xs" align="center">
                      <Text size="sm" fw={500}>
                        {author.name}
                      </Text>
                      {author.isCorresponding && (
                        <Badge size="xs" variant="light" color="orange">
                          Corresponding
                        </Badge>
                      )}
                    </Group>
                    {author.affiliation && (
                      <Text size="xs" c="dimmed">{author.affiliation}</Text>
                    )}
                  </Box>
                </Group>
              ))}
            </Group>
            
            {submission.abstract && (
              <Text size="sm" c="dimmed" lineClamp={3} style={{ maxWidth: '80%' }}>
                {submission.abstract}
              </Text>
            )}
          </Box>
        </Group>

        <Divider />

        {/* Organized Information Section */}
        <Stack gap="md">
          {/* Assigned Editor */}
          <Group gap="xs" align="center">
            <IconUserCog size={16} />
            <Text fw={500} size="sm">Editor:</Text>
            {submission.assignedEditor ? (
              <Group gap="xs">
                <Avatar size="xs" color="indigo">
                  {submission.assignedEditor.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                </Avatar>
                <Text size="sm" fw={500}>{submission.assignedEditor.name}</Text>
                {submission.assignedEditor.affiliation && (
                  <Text size="xs" c="dimmed">({submission.assignedEditor.affiliation})</Text>
                )}
              </Group>
            ) : (
              <Text size="sm" c="dimmed" style={{ fontStyle: 'italic' }}>
                No editor assigned
              </Text>
            )}
          </Group>

          {/* Assigned Reviewers */}
          <Group gap="xs" align="center">
            <IconEye size={16} />
            <Text fw={500} size="sm">Reviewers:</Text>
            {submission.reviewAssignments && submission.reviewAssignments.length > 0 ? (
              <Group gap="md">
                {submission.reviewAssignments.map((assignment) => (
                  <Group key={assignment.id} gap="xs">
                    <Avatar size="xs" color="grape">
                      {assignment.reviewer.name.split(' ').map(n => n[0]).join('')}
                    </Avatar>
                    <Text size="sm" fw={500}>{assignment.reviewer.name}</Text>
                    <Badge 
                      size="xs" 
                      variant="light"
                      color={getReviewStatusColor(assignment.status)}
                    >
                      {assignment.status}
                    </Badge>
                  </Group>
                ))}
              </Group>
            ) : (
              <Text size="sm" c="dimmed" style={{ fontStyle: 'italic' }}>
                No reviewers assigned
              </Text>
            )}
          </Group>

          {/* Dates */}
          <Group gap="xl">
            <Group gap="xs">
              <IconCalendar size={14} />
              <Text size="sm" c="dimmed">
                Submitted: {new Date(submission.submittedAt).toLocaleDateString('en-US', { 
                  month: 'short', 
                  day: 'numeric', 
                  year: 'numeric' 
                })}
              </Text>
            </Group>
            
            <Group gap="xs">
              <IconClock size={14} />
              <Text size="sm" c="dimmed">
                Updated: {new Date(submission.updatedAt).toLocaleDateString('en-US', { 
                  month: 'short', 
                  day: 'numeric', 
                  year: 'numeric' 
                })}
              </Text>
            </Group>
          </Group>

          {/* Files Section - Collapsible */}
          {submission.files && submission.files.length > 0 && (
            <Box>
              <Group justify="space-between" align="center">
                <Group 
                  gap="xs" 
                  style={{ cursor: 'pointer', flex: 1 }}
                  onClick={() => setFilesExpanded(!filesExpanded)}
                >
                  {filesExpanded ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
                  <IconFiles size={16} />
                  <Text fw={500} size="sm">Files</Text>
                  <Badge size="sm" variant="light" color="blue">
                    {submission.files.length}
                  </Badge>
                </Group>
                
                <Button
                  size="xs"
                  variant="light"
                  leftSection={<IconDownload size={14} />}
                  onClick={() => handleDownload()}
                >
                  Download
                </Button>
              </Group>
              
              <Collapse in={filesExpanded}>
                <Stack gap="xs" mt="xs">
                  {submission.files
                    .sort((a, b) => {
                      // Sort by: RENDERED first, then SOURCE, then others, then by upload date
                      const typeOrder = { 'RENDERED': 0, 'SOURCE': 1, 'ASSET': 2, 'SUPPLEMENTARY': 3 };
                      const aOrder = typeOrder[a.fileType as keyof typeof typeOrder] ?? 4;
                      const bOrder = typeOrder[b.fileType as keyof typeof typeOrder] ?? 4;
                      if (aOrder !== bOrder) return aOrder - bOrder;
                      return new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime();
                    })
                    .map((file, index) => (
                      <Group key={file.id} justify="space-between" p="xs" 
                             style={{ 
                               backgroundColor: index === 0 && file.fileType === 'RENDERED' 
                                 ? 'var(--mantine-color-blue-0)' 
                                 : 'var(--mantine-color-gray-0)', 
                               borderRadius: 'var(--mantine-radius-sm)',
                               border: index === 0 && file.fileType === 'RENDERED'
                                 ? '1px solid var(--mantine-color-blue-4)'
                                 : '1px solid var(--mantine-color-gray-3)'
                             }}>
                        <Group gap="sm" style={{ flex: 1, minWidth: 0 }}>
                          {getFileIcon(file.fileType, file.mimetype)}
                          <Box style={{ flex: 1, minWidth: 0 }}>
                            <Group gap="xs" align="center">
                              <Text size="sm" fw={500} truncate style={{ flex: 1 }}>
                                {file.originalName}
                              </Text>
                              <Badge 
                                size="xs" 
                                variant="light" 
                                color={getFileTypeColor(file.fileType)}
                              >
                                {file.fileType}
                              </Badge>
                              {index === 0 && file.fileType === 'RENDERED' && (
                                <Badge size="xs" variant="filled" color="blue">
                                  Latest
                                </Badge>
                              )}
                            </Group>
                            <Text size="xs" c="dimmed" truncate>
                              {formatFileSize(file.size)} • {getFileTypeLabel(file.mimetype)}
                            </Text>
                          </Box>
                        </Group>
                        <ActionIcon 
                          variant="light" 
                          color="blue" 
                          size="sm"
                          onClick={() => handleDownload(file.id)}
                        >
                          <IconDownload size={14} />
                        </ActionIcon>
                      </Group>
                    ))}
                </Stack>
              </Collapse>
            </Box>
          )}

          {/* Keywords */}
          {submission.keywords && submission.keywords.length > 0 && (
            <Box>
              <Text size="sm" fw={500} c="dimmed" mb="xs">Keywords:</Text>
              <Group gap="xs">
                {submission.keywords.map((keyword, index) => (
                  <Badge key={index} size="sm" variant="light" color="gray">
                    {keyword}
                  </Badge>
                ))}
              </Group>
            </Box>
          )}
        </Stack>
      </Stack>
    </Paper>
  );
}

function getFileIcon(fileType: string, mimetype: string) {
  if (fileType === 'ASSET') {
    if (mimetype.startsWith('image/')) {
      return <IconPhoto size={16} color="var(--mantine-color-green-6)" />;
    }
    return <IconFiles size={16} color="var(--mantine-color-blue-6)" />;
  }
  
  if (fileType === 'SOURCE') {
    if (mimetype.includes('markdown')) {
      return <IconCode size={16} color="var(--mantine-color-violet-6)" />;
    }
    return <IconFileText size={16} color="var(--mantine-color-orange-6)" />;
  }
  
  return <IconFileText size={16} color="var(--mantine-color-gray-6)" />;
}

function getFileTypeColor(fileType: string): string {
  switch (fileType) {
    case 'SOURCE':
      return 'orange';
    case 'ASSET':
      return 'green';
    case 'RENDERED':
      return 'blue';
    case 'SUPPLEMENTARY':
      return 'purple';
    default:
      return 'gray';
  }
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function getFileTypeLabel(mimetype: string): string {
  const typeMap: { [key: string]: string } = {
    'text/markdown': 'Markdown',
    'application/pdf': 'PDF',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word',
    'text/plain': 'Text',
    'image/png': 'PNG Image',
    'image/jpeg': 'JPEG Image',
    'image/gif': 'GIF Image',
    'image/svg+xml': 'SVG Image'
  };
  
  return typeMap[mimetype] || mimetype.split('/')[1]?.toUpperCase() || 'Unknown';
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