'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { 
  Title, 
  Card, 
  TextInput, 
  Textarea, 
  Button, 
  Stack, 
  Group, 
  Alert,
  TagsInput,
  Grid,
  Text,
  Progress,
  FileInput,
  Checkbox,
  Divider,
  Loader,
  ActionIcon,
  Tooltip,
  Box
} from '@mantine/core';
import { 
  IconCheck, 
  IconAlertCircle, 
  IconFileText, 
  IconUsers, 
  IconUpload,
  IconX,
  IconExclamationMark,
  IconInfoCircle
} from '@tabler/icons-react';
import { useForm } from '@mantine/form';
import { Breadcrumbs } from '@/components/navigation/Breadcrumbs';
import { RequireProfileCompletion } from '@/components/auth/RequireProfileCompletion';

interface SubmissionData {
  title: string;
  abstract: string;
  content: string;
  authors: string[];
  keywords: string[];
  files: File[];
  agreeToTerms: boolean;
}

export default function SubmitManuscriptPage() {
  const router = useRouter();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/auth/login?redirect=/manuscripts/submit');
    }
  }, [authLoading, isAuthenticated, router]);

  const form = useForm<SubmissionData>({
    initialValues: {
      title: '',
      abstract: '',
      content: '',
      authors: [user?.name || user?.email || ''],
      keywords: [],
      files: [],
      agreeToTerms: false
    },
    validate: {
      title: (value) => value.trim().length < 10 ? 'Title must be at least 10 characters' : null,
      abstract: (value) => value.trim().length < 100 ? 'Abstract must be at least 100 characters' : null,
      content: (value, values) => {
        // Content is optional if files are provided
        if (values.files && values.files.length > 0) return null;
        return value.trim().length < 500 ? 'Content must be at least 500 characters if no files are uploaded' : null;
      },
      authors: (value) => {
        if (!value || value.length === 0) return 'At least one author is required';
        if (value.some(author => !author.trim())) return 'All author names must be filled';
        return null;
      },
      files: (value) => {
        if (value.length === 0) return 'At least one manuscript file is required';
        const maxSize = 50 * 1024 * 1024; // 50MB
        const oversizedFiles = value.filter(file => file.size > maxSize);
        if (oversizedFiles.length > 0) return 'Files must be smaller than 50MB';
        
        const allowedTypes = [
          'application/pdf',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/msword',
          'text/plain'
        ];
        const invalidFiles = value.filter(file => !allowedTypes.includes(file.type));
        if (invalidFiles.length > 0) return 'Only PDF, Word documents, and text files are allowed';
        
        return null;
      },
      agreeToTerms: (value) => !value ? 'You must agree to the terms and conditions' : null
    }
  });

  const handleSubmit = async (values: SubmissionData) => {
    try {
      setLoading(true);
      setError(null);

      // Create FormData for file upload
      const formData = new FormData();
      
      // Add text fields
      formData.append('title', values.title.trim());
      formData.append('abstract', values.abstract.trim());
      formData.append('content', values.content.trim());
      
      // Add authors array
      values.authors.filter(author => author.trim()).forEach(author => {
        formData.append('authors', author.trim());
      });
      
      // Add keywords array
      values.keywords.forEach(keyword => {
        formData.append('keywords', keyword);
      });
      
      // Add metadata
      const metadata = {
        submissionMethod: 'web_form',
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString()
      };
      formData.append('metadata', JSON.stringify(metadata));
      
      // Add files
      values.files.forEach(file => {
        formData.append('files', file);
      });

      const response = await fetch('http://localhost:4000/api/manuscripts', {
        method: 'POST',
        credentials: 'include', // Include auth cookies
        body: formData // Don't set Content-Type header for FormData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to submit manuscript');
      }

      const result = await response.json();
      setSuccess(true);
      
      // Redirect to the submission discussion after a delay
      setTimeout(() => {
        if (result.conversation?.id) {
          router.push(`/submissions/${result.conversation.id}`);
        } else {
          // Fallback to manuscript page if conversation ID not available
          router.push(`/manuscripts/${result.manuscript.id}`);
        }
      }, 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred during submission');
    } finally {
      setLoading(false);
    }
  };

  const addAuthor = () => {
    form.setFieldValue('authors', [...form.values.authors, '']);
  };

  const removeAuthor = (index: number) => {
    const newAuthors = form.values.authors.filter((_, i) => i !== index);
    form.setFieldValue('authors', newAuthors);
  };

  // Helper function to get field validation status
  const getFieldStatus = (fieldName: string) => {
    const value = form.values[fieldName as keyof SubmissionData];
    const error = form.errors[fieldName];
    
    switch (fieldName) {
      case 'title':
        if (error) return 'error';
        return value && typeof value === 'string' && value.trim().length >= 10 ? 'valid' : 'incomplete';
      
      case 'abstract':
        if (error) return 'error';
        return value && typeof value === 'string' && value.trim().length >= 100 ? 'valid' : 'incomplete';
      
      case 'authors':
        if (error) return 'error';
        return Array.isArray(value) && value.some(author => author.trim()) ? 'valid' : 'incomplete';
      
      case 'content':
        // Content is valid if either content is provided OR files are uploaded
        const hasContent = value && typeof value === 'string' && value.trim().length >= 500;
        const hasFiles = form.values.files.length > 0;
        if (error) return 'error';
        return hasContent || hasFiles ? 'valid' : 'incomplete';
      
      case 'files':
        if (error) return 'error';
        const hasContentFallback = form.values.content.trim().length >= 500;
        return Array.isArray(value) && (value.length > 0 || hasContentFallback) ? 'valid' : 'incomplete';
      
      case 'agreeToTerms':
        return value ? 'valid' : 'incomplete';
      
      default:
        return 'incomplete';
    }
  };

  const getStatusIcon = (fieldName: string) => {
    const status = getFieldStatus(fieldName);
    
    switch (status) {
      case 'valid':
        return <IconCheck size={16} color="green" />;
      case 'error':
        return <IconExclamationMark size={16} color="red" />;
      case 'incomplete':
        return <IconInfoCircle size={16} color="gray" />;
      default:
        return <IconInfoCircle size={16} color="gray" />;
    }
  };

  const getProgress = () => {
    const fields = ['title', 'abstract', 'authors', 'content', 'agreeToTerms'];
    const validFields = fields.filter(field => getFieldStatus(field) === 'valid').length;
    return (validFields / fields.length) * 100;
  };

  const canSubmit = () => {
    const requiredFields = ['title', 'abstract', 'authors', 'content', 'agreeToTerms'];
    return requiredFields.every(field => getFieldStatus(field) === 'valid');
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Show loading state while checking authentication
  if (authLoading) {
    return (
      <Stack py="xl" align="center">
        <Loader size="lg" />
        <Text>Loading...</Text>
      </Stack>
    );
  }

  // If not authenticated, don't render the form (will redirect)
  if (!isAuthenticated) {
    return null;
  }

  if (success) {
    return (
      <Stack py="xl" align="center">
        <Card shadow="sm" padding="xl" radius="md" style={{ maxWidth: 600, width: '100%' }}>
          <Stack align="center" gap="md">
            <IconCheck size={64} color="green" />
            <Title order={2} ta="center">Manuscript Submitted Successfully!</Title>
            <Text ta="center" c="dimmed">
              Your manuscript has been submitted for review. You will be redirected to the discussion thread shortly.
            </Text>
            <Progress value={100} color="green" size="lg" style={{ width: '100%' }} />
          </Stack>
        </Card>
      </Stack>
    );
  }

  return (
    <RequireProfileCompletion message="You must complete your profile with your name before submitting manuscripts.">
      <Stack gap="xl" py="xl">
          {/* Breadcrumbs */}
          <Breadcrumbs 
            items={[
              { title: 'Manuscripts', href: '/manuscripts' },
              { title: 'Submit' }
            ]} 
          />

          {/* Header */}
          <Stack gap="md">
            <Title order={1}>Submit Manuscript</Title>
            <Text size="lg" c="dimmed">
              Submit your research for peer review and publication
            </Text>
          </Stack>

        {/* Progress */}
        <Card shadow="sm" padding="md" radius="md">
          <Stack gap="xs">
            <Group justify="space-between">
              <Text size="sm" fw={500}>Completion Progress</Text>
              <Text size="sm" c="dimmed">{Math.round(getProgress())}%</Text>
            </Group>
            <Progress value={getProgress()} />
          </Stack>
        </Card>

        {/* Error Alert */}
        {error && (
          <Alert icon={<IconAlertCircle size={16} />} color="red" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Single Page Form */}
        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack gap="lg">
            {/* Basic Information */}
            <Card shadow="sm" padding="lg" radius="md">
              <Stack gap="md">
                <Group gap="xs" align="center">
                  <IconFileText size={20} />
                  <Title order={3}>Basic Information</Title>
                  {getStatusIcon('title')}
                </Group>
                
                <Group align="flex-end" gap="xs">
                  <TextInput
                    label="Manuscript Title"
                    placeholder="Enter a descriptive title for your manuscript (minimum 10 characters)"
                    required
                    style={{ flex: 1 }}
                    {...form.getInputProps('title')}
                  />
                  <Tooltip label={`Status: ${getFieldStatus('title')}`}>
                    <Box>{getStatusIcon('title')}</Box>
                  </Tooltip>
                </Group>
                
                <Group align="flex-start" gap="xs">
                  <Textarea
                    label="Abstract"
                    placeholder="Provide a concise summary of your research (minimum 100 characters)"
                    required
                    minRows={6}
                    autosize
                    style={{ flex: 1 }}
                    {...form.getInputProps('abstract')}
                  />
                  <Tooltip label={`Status: ${getFieldStatus('abstract')}`}>
                    <Box mt="xl">{getStatusIcon('abstract')}</Box>
                  </Tooltip>
                </Group>
                
                <Text size="sm" c="dimmed">
                  {form.values.abstract.length}/100 characters minimum
                </Text>
              </Stack>
            </Card>

            {/* Authors & Keywords */}
            <Card shadow="sm" padding="lg" radius="md">
              <Stack gap="md">
                <Group gap="xs" align="center">
                  <IconUsers size={20} />
                  <Title order={3}>Authors & Keywords</Title>
                  {getStatusIcon('authors')}
                </Group>
                
                <div>
                  <Group gap="xs" align="center" mb="xs">
                    <Text size="sm" fw={500}>Authors *</Text>
                    <Tooltip label={`Status: ${getFieldStatus('authors')}`}>
                      <Box>{getStatusIcon('authors')}</Box>
                    </Tooltip>
                  </Group>
                  <Stack gap="xs">
                    {form.values.authors.map((author, index) => (
                      <Group key={index} align="flex-end">
                        <TextInput
                          placeholder={`Author ${index + 1} name`}
                          style={{ flex: 1 }}
                          value={author}
                          onChange={(e) => {
                            const newAuthors = [...form.values.authors];
                            newAuthors[index] = e.target.value;
                            form.setFieldValue('authors', newAuthors);
                          }}
                          required={index === 0}
                        />
                        {form.values.authors.length > 1 && (
                          <ActionIcon 
                            variant="outline" 
                            color="red" 
                            size="lg"
                            onClick={() => removeAuthor(index)}
                          >
                            <IconX size={14} />
                          </ActionIcon>
                        )}
                      </Group>
                    ))}
                    <Button variant="light" onClick={addAuthor} size="sm" style={{ alignSelf: 'flex-start' }}>
                      Add Another Author
                    </Button>
                  </Stack>
                  {form.errors.authors && (
                    <Text size="sm" c="red" mt="xs">{form.errors.authors}</Text>
                  )}
                </div>

                <TagsInput
                  label="Keywords (Optional)"
                  placeholder="Add keywords (press Enter to add)"
                  {...form.getInputProps('keywords')}
                />
              </Stack>
            </Card>

            {/* Content & Files */}
            <Card shadow="sm" padding="lg" radius="md">
              <Stack gap="md">
                <Group gap="xs" align="center">
                  <IconFileText size={20} />
                  <Title order={3}>Content & Files</Title>
                  {getStatusIcon('content')}
                </Group>
                
                <Alert icon={<IconInfoCircle size={16} />} color="blue">
                  You must provide either manuscript content (minimum 500 characters) OR upload files. Both are not required.
                </Alert>

                <Group align="flex-start" gap="xs">
                  <Textarea
                    label="Manuscript Content"
                    placeholder="Enter your full manuscript content in Markdown format (minimum 500 characters if no files uploaded)"
                    minRows={8}
                    autosize
                    style={{ flex: 1 }}
                    {...form.getInputProps('content')}
                  />
                  <Tooltip label={`Status: ${getFieldStatus('content')}`}>
                    <Box mt="xl">{getStatusIcon('content')}</Box>
                  </Tooltip>
                </Group>
                
                <Text size="sm" c="dimmed">
                  {form.values.content.length} characters • Markdown formatting is supported
                </Text>

                <Divider />

                <div>
                  <Group gap="xs" align="center" mb="xs">
                    <Text size="sm" fw={500}>Upload Manuscript Files</Text>
                    <Tooltip label={`Status: ${getFieldStatus('files')}`}>
                      <Box>{getStatusIcon('files')}</Box>
                    </Tooltip>
                  </Group>
                  
                  <FileInput
                    placeholder="Select PDF, Word, or text files"
                    multiple
                    accept=".pdf,.doc,.docx,.txt,.tex"
                    value={form.values.files}
                    onChange={(files) => form.setFieldValue('files', files || [])}
                    leftSection={<IconUpload size={16} />}
                  />
                  {form.errors.files && (
                    <Text size="sm" c="red" mt="xs">{form.errors.files}</Text>
                  )}
                  
                  <Text size="xs" c="dimmed" mt="xs">
                    Supported formats: PDF, Word documents (.doc, .docx), Text files (.txt), LaTeX (.tex)
                    <br />
                    Maximum file size: 50MB per file, up to 5 files total
                  </Text>

                  {form.values.files.length > 0 && (
                    <Stack gap="xs" mt="md">
                      <Text size="sm" fw={500}>Selected Files:</Text>
                      {form.values.files.map((file, index) => (
                        <Group key={index} justify="space-between" bg="gray.0" p="xs" style={{ borderRadius: '4px' }}>
                          <Stack gap={0}>
                            <Text size="sm">{file.name}</Text>
                            <Text size="xs" c="dimmed">{formatFileSize(file.size)}</Text>
                          </Stack>
                          <ActionIcon
                            size="sm"
                            variant="outline"
                            color="red"
                            onClick={() => {
                              const newFiles = form.values.files.filter((_, i) => i !== index);
                              form.setFieldValue('files', newFiles);
                            }}
                          >
                            <IconX size={12} />
                          </ActionIcon>
                        </Group>
                      ))}
                    </Stack>
                  )}
                </div>
              </Stack>
            </Card>

            {/* Terms and Submit */}
            <Card shadow="sm" padding="lg" radius="md">
              <Stack gap="md">
                <Group gap="xs" align="center">
                  <IconCheck size={20} />
                  <Title order={3}>Review & Submit</Title>
                  {getStatusIcon('agreeToTerms')}
                </Group>

                <Group gap="xs" align="center">
                  <Checkbox
                    label="I agree to the terms and conditions and confirm that this manuscript is original work"
                    required
                    {...form.getInputProps('agreeToTerms', { type: 'checkbox' })}
                  />
                  <Tooltip label={`Status: ${getFieldStatus('agreeToTerms')}`}>
                    <Box>{getStatusIcon('agreeToTerms')}</Box>
                  </Tooltip>
                </Group>

                {!canSubmit() && (
                  <Alert icon={<IconExclamationMark size={16} />} color="orange">
                    Please complete all required fields before submitting:
                    <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
                      {getFieldStatus('title') !== 'valid' && <li>Title (minimum 10 characters)</li>}
                      {getFieldStatus('abstract') !== 'valid' && <li>Abstract (minimum 100 characters)</li>}
                      {getFieldStatus('authors') !== 'valid' && <li>At least one author</li>}
                      {getFieldStatus('content') !== 'valid' && <li>Either content (500+ characters) or upload files</li>}
                      {getFieldStatus('agreeToTerms') !== 'valid' && <li>Agree to terms and conditions</li>}
                    </ul>
                  </Alert>
                )}

                <Group justify="flex-end">
                  <Button 
                    type="submit"
                    loading={loading}
                    disabled={!canSubmit()}
                    leftSection={<IconUpload size={16} />}
                    size="lg"
                  >
                    Submit Manuscript
                  </Button>
                </Group>
              </Stack>
            </Card>
          </Stack>
        </form>
      </Stack>
    </RequireProfileCompletion>
  );
}