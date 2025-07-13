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
  IconChevronRight,
  IconUpload,
  IconEdit
} from '@tabler/icons-react';
import { useSSE } from '../../hooks/useSSE';
import { useAuth } from '../../contexts/AuthContext';
import FileDropzone from '../files/FileDropzone';
import { hasManuscriptPermission, ManuscriptPermission, GlobalRole } from '@colloquium/auth';

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
  const [submission, setSubmission] = useState<SubmissionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filesExpanded, setFilesExpanded] = useState(false);
  const [revisionExpanded, setRevisionExpanded] = useState(false);
  const [revisionFiles, setRevisionFiles] = useState<File[]>([]);
  const [uploadingRevision, setUploadingRevision] = useState(false);
  const [showHTML, setShowHTML] = useState(false);
  const [htmlContent, setHtmlContent] = useState<string>('');
  const [loadingHTML, setLoadingHTML] = useState(false);

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

        // Fetch full manuscript details including action editors
        const manuscriptResponse = await fetch(`http://localhost:4000/api/articles/${manuscript.id}`, {
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

  // Check if user can upload file revisions
  const canUploadRevisions = () => {
    if (!user || !submission) return false;
    
    // Check if user is an author
    const isAuthor = submission.authors.some(author => author.email === user.email);
    
    // Check if user is admin
    const isAdmin = user.role === GlobalRole.ADMIN;
    
    return hasManuscriptPermission(
      user.role as GlobalRole, 
      ManuscriptPermission.EDIT_MANUSCRIPT, 
      { isAuthor }
    ) || isAdmin;
  };

  // Handle file revision upload
  const handleRevisionUpload = async () => {
    if (!submission || revisionFiles.length === 0) return;
    
    setUploadingRevision(true);
    
    try {
      const formData = new FormData();
      
      // Add files
      revisionFiles.forEach(file => {
        formData.append('files', file);
      });
      
      // Add metadata
      const metadata = {
        uploadType: 'revision',
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString()
      };
      formData.append('metadata', JSON.stringify(metadata));
      
      const response = await fetch(`http://localhost:4000/api/articles/${submission.id}/files`, {
        method: 'POST',
        credentials: 'include',
        body: formData
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to upload revision files');
      }
      
      const result = await response.json();
      
      // Clear the upload files
      setRevisionFiles([]);
      setRevisionExpanded(false);
      
      // Refresh the submission data to show new files
      // We'll trigger a re-fetch by updating the submission
      window.location.reload(); // Simple refresh for now
      
    } catch (err) {
      console.error('Error uploading revision:', err);
      alert(err instanceof Error ? err.message : 'Failed to upload revision files');
    } finally {
      setUploadingRevision(false);
    }
  };

  // Helper function to find the rendered PDF
  const getRenderedPDF = () => {
    if (!submission?.files) return null;
    return submission.files
      .filter(f => f.fileType === 'RENDERED' && f.mimetype === 'application/pdf')
      .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())[0] || null;
  };

  // Helper function to find the rendered HTML
  const getRenderedHTML = () => {
    if (!submission?.files) return null;
    return submission.files
      .filter(f => f.fileType === 'RENDERED' && f.mimetype === 'text/html')
      .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())[0] || null;
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

  const handleViewHTML = async () => {
    const htmlFile = getRenderedHTML();
    if (!htmlFile || !submission) return;

    setLoadingHTML(true);
    try {
      const response = await fetch(`http://localhost:4000/api/articles/${submission.id}/files/${htmlFile.id}/download?inline=true`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch HTML: ${response.status} ${response.statusText}`);
      }
      
      const htmlText = await response.text();
      const scopedHTML = scopeHTMLContent(htmlText);
      setHtmlContent(scopedHTML);
      setShowHTML(true);
    } catch (error) {
      console.error('Error fetching HTML content:', error);
    } finally {
      setLoadingHTML(false);
    }
  };

  const handleDownload = async (fileId?: string) => {
    if (!submission?.files || submission.files.length === 0) return;
    
    // Use specific file if ID provided, otherwise prioritize most recent RENDERED, then SOURCE, then first file
    const fileToDownload = fileId 
      ? submission.files.find(f => f.id === fileId)
      : submission.files
          .filter(f => f.fileType === 'RENDERED')
          .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())[0] ||
        submission.files.find(f => f.fileType === 'SOURCE') || 
        submission.files[0];
    
    if (!fileToDownload) return;
    
    try {
      console.log(`Downloading file: ${fileToDownload.originalName} (${fileToDownload.fileType})`);
      const response = await fetch(`http://localhost:4000/api/articles/${submission.id}/files/${fileToDownload.id}/download`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Download failed:', response.status, errorText);
        throw new Error(`Failed to download file: ${response.status} ${response.statusText}`);
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
      alert(`Failed to download file: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
            
            {/* Keywords */}
            {submission.keywords && submission.keywords.length > 0 && (
              <Box mt="sm">
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
                      {(assignment.reviewer.name || 'R').split(' ').map((n: string) => n[0]).join('').toUpperCase()}
                    </Avatar>
                    <Text size="sm" fw={500}>{assignment.reviewer.name}</Text>
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
                
                <Group gap="xs">
                  {getRenderedHTML() && (
                    <Button
                      size="md"
                      variant="filled"
                      color="green"
                      leftSection={loadingHTML ? <Loader size={18} /> : <IconEye size={18} />}
                      onClick={handleViewHTML}
                      loading={loadingHTML}
                    >
                      View HTML
                    </Button>
                  )}
                  {getRenderedPDF() && (
                    <Button
                      size="md"
                      variant="filled"
                      color="blue"
                      leftSection={<IconDownload size={18} />}
                      onClick={() => handleDownload(getRenderedPDF()?.id)}
                    >
                      Download PDF
                    </Button>
                  )}
                </Group>
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

          {/* File Revision Section - Only for Authors and Admins */}
          {canUploadRevisions() && (
            <Box>
              <Group justify="space-between" align="center">
                <Group 
                  gap="xs" 
                  style={{ cursor: 'pointer', flex: 1 }}
                  onClick={() => setRevisionExpanded(!revisionExpanded)}
                >
                  {revisionExpanded ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
                  <IconEdit size={16} />
                  <Text fw={500} size="sm">Upload File Revisions</Text>
                  <Badge size="xs" variant="light" color="orange">
                    Authors Only
                  </Badge>
                </Group>
              </Group>
              
              <Collapse in={revisionExpanded}>
                <Stack gap="md" mt="md">
                  <Text size="sm" c="dimmed">
                    Upload revised versions of your manuscript files. These will be added as new versions and a notification will be posted to the discussion thread.
                  </Text>
                  
                  <FileDropzone
                    value={revisionFiles}
                    onFilesChange={setRevisionFiles}
                    accept=".md,.tex,.pdf,.docx,.doc"
                    placeholder="Upload revised manuscript files"
                    description="Supported: Markdown, LaTeX, PDF, Word • Max 50MB per file"
                    allowFolders={false}
                    maxFileSize={50 * 1024 * 1024}
                  />
                  
                  {revisionFiles.length > 0 && (
                    <Group justify="flex-end">
                      <Button
                        variant="light"
                        color="gray"
                        size="sm"
                        onClick={() => setRevisionFiles([])}
                        disabled={uploadingRevision}
                      >
                        Cancel
                      </Button>
                      <Button
                        leftSection={<IconUpload size={16} />}
                        size="sm"
                        onClick={handleRevisionUpload}
                        loading={uploadingRevision}
                      >
                        Upload Revision
                      </Button>
                    </Group>
                  )}
                </Stack>
              </Collapse>
            </Box>
          )}

        </Stack>
      </Stack>

      {/* HTML Content Display */}
      {showHTML && htmlContent && (
        <Box mt="xl">
          <Group justify="space-between" align="center" mb="md">
            <Title order={3}>Rendered HTML</Title>
            <Button
              variant="light"
              color="gray"
              size="sm"
              onClick={() => setShowHTML(false)}
            >
              Hide
            </Button>
          </Group>
          <Paper
            p="xl"
            withBorder
            style={{
              maxHeight: '80vh',
              overflow: 'auto',
              backgroundColor: 'white'
            }}
          >
            <div 
              dangerouslySetInnerHTML={{ __html: htmlContent }}
              style={{
                lineHeight: '1.6',
                fontSize: '14px'
              }}
            />
          </Paper>
        </Box>
      )}
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

