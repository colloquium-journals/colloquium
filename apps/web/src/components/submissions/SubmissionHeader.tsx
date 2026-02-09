'use client';

import { useState, useEffect } from 'react';
import {
  Paper,
  Title,
  Text,
  Group,
  Badge,
  Stack,
  Box,
  Loader,
  Alert,
  Button,
  useComputedColorScheme
} from '@mantine/core';
import {
  IconAlertCircle,
  IconCheck,
  IconEdit
} from '@tabler/icons-react';
import { useSSE } from '../../hooks/useSSE';
import { useAuth } from '../../contexts/AuthContext';
import { hasManuscriptPermission, ManuscriptPermission, GlobalRole } from '@colloquium/auth/permissions';
import { API_URL } from '@/lib/api';
import { getStatusColor, getStatusIcon, getStatusLabel } from './submissionUtils';
import { SubmissionMetadata } from './SubmissionMetadata';
import { SubmissionEditPanel } from './SubmissionEditPanel';
import { SubmissionFilesSection } from './SubmissionFilesSection';

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
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const colorScheme = useComputedColorScheme('light');
  const dark = colorScheme === 'dark';
  const [submission, setSubmission] = useState<SubmissionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({
    title: '',
    abstract: '',
    keywords: [] as string[]
  });
  const [savingEdits, setSavingEdits] = useState(false);

  // Handle real-time action editor assignment updates
  const handleActionEditorAssigned = (assignment: any) => {
    setSubmission(prev => {
      const updated = prev ? {
        ...prev,
        assignedEditor: {
          id: assignment.editor.id,
          name: assignment.editor.name,
          email: assignment.editor.email,
          affiliation: assignment.editor.affiliation,
          assignedAt: assignment.assignedAt
        }
      } : prev;
      return updated;
    });
  };

  // Handle real-time reviewer assignment updates
  const handleReviewerAssigned = (assignment: any) => {
    setSubmission(prev => {
      if (!prev) return prev;

      const newAssignment = {
        id: assignment.assignmentId,
        reviewer: {
          name: assignment.reviewer.name || assignment.reviewer.email,
          affiliation: assignment.reviewer.affiliation
        },
        status: assignment.status,
        assignedAt: assignment.assignedAt,
        dueDate: assignment.dueDate
      };

      // Only add the assignment if it's in an accepted state
      if (assignment.status === 'ACCEPTED' || assignment.status === 'IN_PROGRESS' || assignment.status === 'COMPLETED') {
        return {
          ...prev,
          reviewAssignments: [
            ...(prev.reviewAssignments || []),
            newAssignment
          ]
        };
      }

      return prev;
    });
  };

  // Handle real-time reviewer invitation response updates
  const handleReviewerInvitationResponse = (response: any) => {
    setSubmission(prev => {
      if (!prev) return prev;

      // Update the review assignment status if it exists
      const updatedReviewAssignments = prev.reviewAssignments?.map(assignment => {
        if (assignment.id === response.assignmentId) {
          return {
            ...assignment,
            status: response.status,
            respondedAt: response.respondedAt
          };
        }
        return assignment;
      }) || [];

      // If this is a new response for an assignment we don't have yet, add it
      const existingAssignment = prev.reviewAssignments?.find(a => a.id === response.assignmentId);
      if (!existingAssignment && response.reviewer) {
        updatedReviewAssignments.push({
          id: response.assignmentId,
          reviewer: {
            name: response.reviewer.name || response.reviewer.email,
            affiliation: response.reviewer.affiliation
          },
          status: response.status,
          assignedAt: response.respondedAt,
          dueDate: undefined
        });
      }

      // Filter to only show accepted, in-progress, or completed reviewers
      const filteredReviewAssignments = updatedReviewAssignments.filter(
        assignment => assignment.status === 'ACCEPTED' || assignment.status === 'IN_PROGRESS' || assignment.status === 'COMPLETED'
      );

      return {
        ...prev,
        reviewAssignments: filteredReviewAssignments
      };
    });
  };

  // Initialize SSE connection for real-time updates
  useSSE(submissionId, {
    enabled: !!submissionId,
    onActionEditorAssigned: handleActionEditorAssigned,
    onReviewerAssigned: handleReviewerAssigned,
    onReviewerInvitationResponse: handleReviewerInvitationResponse
  });

  useEffect(() => {
    const fetchSubmission = async () => {
      try {
        setLoading(true);


        // First, fetch the conversation to get the manuscript ID
        const conversationResponse = await fetch(`${API_URL}/api/conversations/${submissionId}`, {
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

        // Fetch full manuscript details including action editors
        const manuscriptResponse = await fetch(`${API_URL}/api/articles/${manuscript.id}`, {
          credentials: 'include'
        });

        if (!manuscriptResponse.ok) {
          throw new Error('Failed to fetch manuscript details');
        }

        const manuscriptData = await manuscriptResponse.json();

        // Format submission data from manuscript API
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
          assignedEditor: (() => {
            if (manuscriptData.action_editors?.users_action_editors_editorIdTousers) {
              return {
                id: manuscriptData.action_editors.users_action_editors_editorIdTousers.id,
                name: manuscriptData.action_editors.users_action_editors_editorIdTousers.name,
                email: manuscriptData.action_editors.users_action_editors_editorIdTousers.email,
                affiliation: manuscriptData.action_editors.users_action_editors_editorIdTousers.affiliation,
                assignedAt: manuscriptData.action_editors.assignedAt
              };
            }
            return undefined;
          })(),
          reviewAssignments: manuscriptData.reviewAssignments
            ?.filter((assignment: any) => assignment.status === 'ACCEPTED' || assignment.status === 'IN_PROGRESS' || assignment.status === 'COMPLETED')
            ?.map((assignment: any) => ({
              id: assignment.id,
              reviewer: {
                name: assignment.reviewer.name,
                email: assignment.reviewer.email,
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
  }, [submissionId, authLoading, isAuthenticated]);

  // Initialize edit data when submission loads
  useEffect(() => {
    if (submission) {
      setEditData({
        title: submission.title,
        abstract: submission.abstract || '',
        keywords: submission.keywords || []
      });
    }
  }, [submission]);

  // Check if user can edit manuscript metadata
  const canEditMetadata = () => {
    if (!user || !submission) return false;

    const isAuthor = submission.authors.some(author => author.email === user.email);
    const isAdmin = user.role === GlobalRole.ADMIN;

    return hasManuscriptPermission(
      user.role as GlobalRole,
      ManuscriptPermission.EDIT_MANUSCRIPT,
      { isAuthor }
    ) || isAdmin;
  };

  // Handle saving manuscript metadata edits
  const handleSaveEdits = async () => {
    if (!submission) return;

    setSavingEdits(true);

    try {
      const response = await fetch(`${API_URL}/api/articles/${submission.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          title: editData.title.trim(),
          abstract: editData.abstract.trim(),
          keywords: editData.keywords
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to save changes');
      }

      // Update local submission data
      setSubmission(prev => prev ? {
        ...prev,
        title: editData.title.trim(),
        abstract: editData.abstract.trim(),
        keywords: editData.keywords,
        updatedAt: new Date().toISOString()
      } : prev);

      setIsEditing(false);

    } catch (err) {
      console.error('Error saving edits:', err);
      alert(err instanceof Error ? err.message : 'Failed to save changes');
    } finally {
      setSavingEdits(false);
    }
  };

  // Handle canceling edits
  const handleCancelEdits = () => {
    if (submission) {
      setEditData({
        title: submission.title,
        abstract: submission.abstract || '',
        keywords: submission.keywords || []
      });
    }
    setIsEditing(false);
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
    <Paper shadow="md" p="xl" radius="lg" style={{ background: dark
      ? 'linear-gradient(135deg, var(--mantine-color-dark-7) 0%, var(--mantine-color-dark-6) 100%)'
      : 'linear-gradient(135deg, var(--mantine-color-blue-0) 0%, var(--mantine-color-indigo-0) 100%)'
    }}>
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

              {canEditMetadata() && !isEditing && (
                <Button
                  variant="light"
                  size="xs"
                  leftSection={<IconEdit size={14} />}
                  onClick={() => setIsEditing(true)}
                >
                  Revision
                </Button>
              )}

              {isEditing && (
                <Group gap="xs">
                  <Button
                    variant="light"
                    size="xs"
                    color="gray"
                    onClick={handleCancelEdits}
                    disabled={savingEdits}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="filled"
                    size="xs"
                    leftSection={<IconCheck size={14} />}
                    onClick={handleSaveEdits}
                    loading={savingEdits}
                  >
                    Save Changes
                  </Button>
                </Group>
              )}
            </Group>

            {isEditing ? (
              <SubmissionEditPanel
                submissionId={submission.id}
                editData={editData}
                onEditDataChange={setEditData}
                savingEdits={savingEdits}
                onSaveEdits={handleSaveEdits}
                onRefresh={() => window.location.reload()}
              />
            ) : (
              <Title order={1} size="h2" mb="sm" style={{ lineHeight: 1.3 }}>
                {submission.title}
              </Title>
            )}
          </Box>
        </Group>

        {/* Organized Information Section */}
        <Stack gap="md">
          <SubmissionMetadata submission={submission} />

          {/* Files Section - Collapsible */}
          {submission.files && submission.files.length > 0 && (
            <SubmissionFilesSection
              submissionId={submission.id}
              files={submission.files}
            />
          )}
        </Stack>
      </Stack>
    </Paper>
  );
}
