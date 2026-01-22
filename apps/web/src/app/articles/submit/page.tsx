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
  FileInput,
  Checkbox,
  Divider,
  Loader,
  ActionIcon,
  Tooltip,
  Box
} from '@mantine/core';
import FileDropzone from '@/components/files/FileDropzone';
import { 
  IconCheck, 
  IconAlertCircle, 
  IconFileText, 
  IconUsers, 
  IconUpload,
  IconX,
  IconExclamationMark,
  IconInfoCircle,
  IconBuilding,
  IconExternalLink
} from '@tabler/icons-react';
import { useForm } from '@mantine/form';
import { Breadcrumbs } from '@/components/navigation/Breadcrumbs';
import { RequireProfileCompletion } from '@/components/auth/RequireProfileCompletion';

interface SubmissionData {
  title: string;
  abstract: string;
  authors: AuthorInput[];
  keywords: string[];
  sourceFiles: File[];
  bibliographyFiles: File[];
  assetFiles: File[];
  agreeToTerms: boolean;
}

interface AuthorInput {
  email: string;
  name: string;
  affiliation: string;
  isExistingUser: boolean;
  isCorresponding: boolean;
}

interface FormatInfo {
  name: string;
  displayName: string;
  fileExtensions: string[];
  mimeTypes: string[];
  description?: string;
}

export default function SubmitArticlePage() {
  const router = useRouter();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [supportedFormats, setSupportedFormats] = useState<FormatInfo[]>([]);
  const [loadingFormats, setLoadingFormats] = useState(true);
  const [authorLookupLoading, setAuthorLookupLoading] = useState<{ [index: number]: boolean }>({});

  // Load supported formats
  useEffect(() => {
    const loadSupportedFormats = async () => {
      try {
        console.log('Loading supported formats...');
        const response = await fetch('http://localhost:4000/api/formats');
        console.log('Formats API response:', response.status);
        if (response.ok) {
          const data = await response.json();
          console.log('Loaded formats:', data.formats);
          setSupportedFormats(data.formats);
        } else {
          // Fall back to default formats if API fails
          setSupportedFormats([
            {
              name: 'markdown',
              displayName: 'Markdown',
              fileExtensions: ['.md', '.markdown'],
              mimeTypes: ['text/markdown', 'text/x-markdown'],
              description: 'Markdown text format'
            },
            {
              name: 'latex',
              displayName: 'LaTeX',
              fileExtensions: ['.tex', '.latex'],
              mimeTypes: ['application/x-latex', 'text/x-tex'],
              description: 'LaTeX document format'
            },
            {
              name: 'pdf',
              displayName: 'PDF',
              fileExtensions: ['.pdf'],
              mimeTypes: ['application/pdf'],
              description: 'PDF documents'
            }
          ]);
        }
      } catch (error) {
        console.error('Failed to load supported formats:', error);
        // Use fallback formats
        setSupportedFormats([
          {
            name: 'markdown',
            displayName: 'Markdown',
            fileExtensions: ['.md', '.markdown'],
            mimeTypes: ['text/markdown', 'text/x-markdown'],
            description: 'Markdown text format'
          },
          {
            name: 'latex',
            displayName: 'LaTeX',
            fileExtensions: ['.tex', '.latex'],
            mimeTypes: ['text/x-tex', 'application/x-latex'],
            description: 'LaTeX document format'
          }
        ]);
      } finally {
        setLoadingFormats(false);
      }
    };

    loadSupportedFormats();
  }, []);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/auth/login?redirect=/articles/submit');
    }
  }, [authLoading, isAuthenticated, router]);

  const form = useForm<SubmissionData>({
    initialValues: {
      title: '',
      abstract: '',
      authors: [{
        email: user?.email || '',
        name: user?.name || '',
        affiliation: user?.affiliation || '',
        isExistingUser: !!user,
        isCorresponding: true
      }],
      keywords: [],
      sourceFiles: [],
      bibliographyFiles: [],
      assetFiles: [],
      agreeToTerms: false
    },
    validate: {
      title: (value) => !value.trim() ? 'Title is required' : null,
      abstract: (value) => !value.trim() ? 'Abstract is required' : null,
      authors: (value) => {
        if (!value || value.length === 0) return 'At least one author is required';
        
        const correspondingAuthors = value.filter(author => author.isCorresponding);
        if (correspondingAuthors.length === 0) return 'Exactly one corresponding author is required';
        if (correspondingAuthors.length > 1) return 'Only one corresponding author is allowed';
        
        for (const author of value) {
          if (!author.email || !author.email.trim()) {
            return 'All authors must have email addresses';
          }
          if (!author.name || !author.name.trim()) {
            return 'All authors must have names';
          }
          if (author.affiliation && author.affiliation.length > 200) {
            return 'Affiliation must be less than 200 characters';
          }
          // Basic email validation
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(author.email)) {
            return 'All email addresses must be valid';
          }
        }
        return null;
      },
      sourceFiles: (value) => {
        if (value.length === 0) return 'At least one source file is required';
        
        const maxSize = 50 * 1024 * 1024; // 50MB
        const oversizedFiles = value.filter(file => file.size > maxSize);
        if (oversizedFiles.length > 0) return 'Files must be smaller than 50MB';
        
        return null;
      },
      assetFiles: (value) => {
        const maxSize = 50 * 1024 * 1024; // 50MB
        const oversizedFiles = value.filter(file => file.size > maxSize);
        if (oversizedFiles.length > 0) return 'Asset files must be smaller than 50MB';
        
        return null;
      },
      agreeToTerms: (value) => !value ? 'You must agree to the terms and conditions' : null
    }
  });

  // Update author fields when user data becomes available
  useEffect(() => {
    if (user && !authLoading) {
      const currentAuthors = form.values.authors;
      if (currentAuthors.length > 0 && (!currentAuthors[0].email || !currentAuthors[0].name)) {
        const updatedAuthors = [...currentAuthors];
        updatedAuthors[0] = {
          ...updatedAuthors[0],
          email: user.email || '',
          name: user.name || '',
          affiliation: user.affiliation || '',
          isExistingUser: true,
          isCorresponding: true
        };
        form.setFieldValue('authors', updatedAuthors);
      }
    }
  }, [user, authLoading]);

  const handleSubmit = async (values: SubmissionData) => {
    try {
      setLoading(true);
      setError(null);

      // Create FormData for file upload
      const formData = new FormData();
      
      // Add text fields
      formData.append('title', values.title.trim());
      formData.append('abstract', values.abstract.trim());
      
      // Add authors array - convert to the expected format
      formData.append('authors', JSON.stringify(values.authors.map(author => ({
        email: author.email,
        name: author.name,
        affiliation: author.affiliation || '',
        isCorresponding: author.isCorresponding
      }))));
      
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
      
      // Add source files first (these will be marked as SOURCE in the backend)
      values.sourceFiles.forEach(file => {
        formData.append('files', file);
      });
      
      // Add bibliography files (these will be marked as REFERENCE in the backend)
      values.bibliographyFiles.forEach(file => {
        formData.append('files', file);
      });
      
      // Add asset files (these will be marked as ASSET in the backend)
      values.assetFiles.forEach(file => {
        formData.append('files', file);
      });

      const response = await fetch('http://localhost:4000/api/articles', {
        method: 'POST',
        credentials: 'include', // Include auth cookies
        body: formData // Don't set Content-Type header for FormData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to submit article');
      }

      const result = await response.json();
      setSuccess(true);
      
      // Redirect to the submission discussion after a delay
      setTimeout(() => {
        if (result.conversation?.id) {
          router.push(`/submissions/${result.conversation.id}`);
        } else {
          // Fallback to article page if conversation ID not available
          router.push(`/articles/${result.article.id}`);
        }
      }, 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred during submission');
    } finally {
      setLoading(false);
    }
  };

  const addAuthor = () => {
    form.setFieldValue('authors', [...form.values.authors, {
      email: '',
      name: '',
      affiliation: '',
      isExistingUser: false,
      isCorresponding: false
    }]);
  };

  const removeAuthor = (index: number) => {
    const newAuthors = form.values.authors.filter((_, i) => i !== index);
    form.setFieldValue('authors', newAuthors);
  };

  const lookupUserByEmail = async (email: string, authorIndex: number) => {
    if (!email || !email.includes('@')) return;
    
    setAuthorLookupLoading(prev => ({ ...prev, [authorIndex]: true }));
    
    try {
      const response = await fetch(`http://localhost:4000/api/users/lookup?email=${encodeURIComponent(email)}`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const userData = await response.json();
        const newAuthors = [...form.values.authors];
        newAuthors[authorIndex] = {
          ...newAuthors[authorIndex],
          email: email,
          // Only auto-fill name if current name is empty or matches the email prefix
          name: (!newAuthors[authorIndex].name || newAuthors[authorIndex].name === email.split('@')[0]) 
            ? (userData.name || '') 
            : newAuthors[authorIndex].name,
          // Only auto-fill affiliation if current affiliation is empty
          affiliation: !newAuthors[authorIndex].affiliation 
            ? (userData.affiliation || '') 
            : newAuthors[authorIndex].affiliation,
          isExistingUser: true
        };
        form.setFieldValue('authors', newAuthors);
      } else {
        // User not found - keep as new user
        const newAuthors = [...form.values.authors];
        newAuthors[authorIndex] = {
          ...newAuthors[authorIndex],
          email: email,
          isExistingUser: false
        };
        form.setFieldValue('authors', newAuthors);
      }
    } catch (error) {
      console.error('Error looking up user:', error);
      // On error, treat as new user
      const newAuthors = [...form.values.authors];
      newAuthors[authorIndex] = {
        ...newAuthors[authorIndex],
        email: email,
        isExistingUser: false
      };
      form.setFieldValue('authors', newAuthors);
    } finally {
      setAuthorLookupLoading(prev => ({ ...prev, [authorIndex]: false }));
    }
  };

  const updateAuthor = (index: number, field: keyof AuthorInput, value: string | boolean) => {
    const newAuthors = [...form.values.authors];
    
    // If setting someone as corresponding author, uncheck all others
    if (field === 'isCorresponding' && value === true) {
      newAuthors.forEach((author, i) => {
        if (i !== index) {
          author.isCorresponding = false;
        }
      });
    }
    
    newAuthors[index] = { ...newAuthors[index], [field]: value };
    form.setFieldValue('authors', newAuthors);
  };

  // Helper function to get field validation status
  const getFieldStatus = (fieldName: string) => {
    const value = form.values[fieldName as keyof SubmissionData];
    const error = form.errors[fieldName];
    
    switch (fieldName) {
      case 'title':
        if (error) return 'error';
        return value && typeof value === 'string' && value.trim() ? 'valid' : 'incomplete';
      
      case 'abstract':
        if (error) return 'error';
        return value && typeof value === 'string' && value.trim() ? 'valid' : 'incomplete';
      
      case 'authors':
        if (error) return 'error';
        const correspondingCount = Array.isArray(value) ? value.filter((author: any) => author.isCorresponding).length : 0;
        return Array.isArray(value) && value.length > 0 && 
               value.every((author: any) => author.email && author.name) &&
               correspondingCount === 1 ? 'valid' : 'incomplete';
      
      case 'sourceFiles':
        if (error) return 'error';
        return Array.isArray(value) && value.length > 0 ? 'valid' : 'incomplete';
      
      case 'assetFiles':
        // Asset files are always optional
        if (error) return 'error';
        return 'valid';
      
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


  const canSubmit = () => {
    const requiredFields = ['title', 'abstract', 'authors', 'sourceFiles', 'agreeToTerms'];
    return requiredFields.every(field => getFieldStatus(field) === 'valid');
  };

  const getSupportedExtensions = () => {
    const extensions = supportedFormats.flatMap(format => format.fileExtensions).join(',');
    console.log('Supported extensions:', extensions, 'from formats:', supportedFormats);
    return extensions;
  };

  const getSupportedMimeTypes = () => {
    return supportedFormats.flatMap(format => format.mimeTypes);
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
      <Stack py="xl" align="center" style={{ maxWidth: 600, margin: '0 auto' }}>
        <Stack align="center" gap="md">
          <IconCheck size={64} color="green" />
          <Title order={2} ta="center">Article Submitted Successfully!</Title>
          <Text ta="center" c="dimmed">
            Your article has been submitted for review. You will be redirected to the discussion thread shortly.
          </Text>
        </Stack>
      </Stack>
    );
  }

  return (
    <RequireProfileCompletion message="You must complete your profile with your name before submitting articles.">
      <Stack gap="xl" py="xl">
          {/* Breadcrumbs */}
          <Breadcrumbs 
            items={[
              { title: 'Articles', href: '/articles' },
              { title: 'Submit' }
            ]} 
          />

          {/* Header */}
          <Stack gap="md">
            <Title order={1}>Submit Article</Title>
            <Text size="lg" c="dimmed">
              Submit your research for peer review and publication
            </Text>
          </Stack>


        {/* Error Alert */}
        {error && (
          <Alert icon={<IconAlertCircle size={16} />} color="red" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Single Page Form */}
        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack gap="xl">
            {/* Basic Information */}
            <Stack gap="lg">
              <Group gap="xs" align="center">
                <IconFileText size={20} />
                <Title order={3}>Basic Information</Title>
              </Group>
                
                <Group align="flex-end" gap="xs">
                  <TextInput
                    label="Article Title"
                    placeholder="Enter a descriptive title for your article"
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
                    placeholder="Provide a concise summary of your research"
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

                <TagsInput
                  label="Keywords (Optional)"
                  placeholder="Add keywords (press Enter to add)"
                  {...form.getInputProps('keywords')}
                />
            </Stack>

            <Divider />

            {/* Authors */}
            <Stack gap="lg">
              <Group gap="xs" align="center">
                <IconUsers size={20} />
                <Title order={3}>Authors</Title>
              </Group>
                
                <div>
                  <Group gap="xs" align="center" mb="xs">
                    <Text size="sm" fw={500}>Authors *</Text>
                    <Tooltip label={`Status: ${getFieldStatus('authors')}`}>
                      <Box>{getStatusIcon('authors')}</Box>
                    </Tooltip>
                  </Group>
                  <Stack gap="sm">
                    {form.values.authors.map((author, index) => (
                      <Box key={index} p="md" style={{ 
                        border: '1px solid var(--mantine-color-gray-3)', 
                        borderRadius: '8px',
                        backgroundColor: 'var(--mantine-color-gray-0)'
                      }}>
                        <Stack gap="sm">
                          <Group align="flex-start" gap="sm">
                            <Stack gap="xs" style={{ flex: 1 }}>
                              <TextInput
                                label={`Author ${index + 1} Email`}
                                placeholder="Enter email address"
                                value={author.email}
                                onChange={(e) => updateAuthor(index, 'email', e.target.value)}
                                onBlur={(e) => lookupUserByEmail(e.target.value, index)}
                                required
                                rightSection={authorLookupLoading[index] ? <Loader size="xs" /> : null}
                              />
                              {author.isExistingUser && (
                                <Text size="xs" c="green">
                                  ✓ Existing user found
                                </Text>
                              )}
                              {!author.isExistingUser && author.email && (
                                <Text size="xs" c="orange">
                                  New user - will create account
                                </Text>
                              )}
                            </Stack>
                            
                            <Stack gap="xs" style={{ flex: 1 }}>
                              <TextInput
                                label="Full Name"
                                placeholder="Enter full name"
                                value={author.name}
                                onChange={(e) => updateAuthor(index, 'name', e.target.value)}
                                required
                                disabled={author.isExistingUser}
                              />
                              {author.isExistingUser && author.name && (
                                <Text size="xs" c="green">
                                  ✓ From existing account profile
                                </Text>
                              )}
                            </Stack>
                            
                            {form.values.authors.length > 1 && (
                              <ActionIcon 
                                variant="outline" 
                                color="red" 
                                size="lg"
                                onClick={() => removeAuthor(index)}
                                mt="xl"
                              >
                                <IconX size={14} />
                              </ActionIcon>
                            )}
                          </Group>
                          
                          <TextInput
                            label="Affiliation (Optional)"
                            placeholder="Institution, university, or organization"
                            value={author.affiliation}
                            onChange={(e) => updateAuthor(index, 'affiliation', e.target.value)}
                            leftSection={<IconBuilding size={16} />}
                            disabled={author.isExistingUser}
                          />
                          {author.isExistingUser && (
                            <Stack gap="xs">
                              <Text size="xs" c="green">
                                ✓ From existing account profile{!author.affiliation && ' (none set)'}
                              </Text>
                              <Text size="xs" c="dimmed">
                                Existing user details cannot be changed here. The user can update their profile after logging in.
                              </Text>
                            </Stack>
                          )}
                          
                          <Checkbox
                            label="Corresponding author (only one allowed)"
                            checked={author.isCorresponding}
                            onChange={(e) => updateAuthor(index, 'isCorresponding', e.currentTarget.checked)}
                          />
                        </Stack>
                      </Box>
                    ))}
                    <Button variant="light" onClick={addAuthor} size="sm" style={{ alignSelf: 'flex-start' }}>
                      Add Another Author
                    </Button>
                  </Stack>
                  {form.errors.authors && (
                    <Text size="sm" c="red" mt="xs">{form.errors.authors}</Text>
                  )}
                </div>
            </Stack>

            <Divider />

            {/* Article Files */}
            <Stack gap="lg">
              <Group gap="xs" align="center">
                <IconUpload size={20} />
                <Title order={3}>Article Files</Title>
              </Group>

                {/* Source Files Upload */}
                <div>
                  <Group gap="xs" align="center" mb="xs">
                    <Text size="sm" fw={500}>Source Document Files</Text>
                    <Tooltip label={`Status: ${getFieldStatus('sourceFiles')}`}>
                      <Box>{getStatusIcon('sourceFiles')}</Box>
                    </Tooltip>
                  </Group>
                  
                  <FileDropzone
                    value={form.values.sourceFiles}
                    onFilesChange={(files) => form.setFieldValue('sourceFiles', files)}
                    accept={getSupportedExtensions()}
                    placeholder="Upload your main article files"
                    description={loadingFormats ? "Loading supported formats..." : `Supported: ${supportedFormats.map(f => f.displayName).join(', ')} • Max 50MB per file`}
                    allowFolders={false}
                    maxFileSize={50 * 1024 * 1024}
                  />
                  {form.errors.sourceFiles && (
                    <Text size="sm" c="red" mt="xs">{form.errors.sourceFiles}</Text>
                  )}
                </div>

                <Divider />

                {/* Bibliography Files Upload */}
                <div>
                  <Group gap="xs" align="center" mb="xs">
                    <Text size="sm" fw={500}>Bibliography & References (Optional)</Text>
                    <Tooltip label={`Status: ${getFieldStatus('bibliographyFiles')}`}>
                      <Box>{getStatusIcon('bibliographyFiles')}</Box>
                    </Tooltip>
                  </Group>
                  
                  <FileDropzone
                    value={form.values.bibliographyFiles}
                    onFilesChange={(files) => form.setFieldValue('bibliographyFiles', files)}
                    accept=".bib,.ris,.json,.txt,.bibtex"
                    placeholder="Upload bibliography and reference files"
                    description="BibTeX (.bib), RIS (.ris), CSL JSON (.json), or plain text reference files • Max 10MB per file"
                    allowFolders={false}
                    multiple={true}
                    maxFileSize={10 * 1024 * 1024}
                  />
                  {form.errors.bibliographyFiles && (
                    <Text size="sm" c="red" mt="xs">{form.errors.bibliographyFiles}</Text>
                  )}
                </div>

                <Divider />

                {/* Asset Files Upload */}
                <div>
                  <Group gap="xs" align="center" mb="xs">
                    <Text size="sm" fw={500}>Supporting Asset Files (Optional)</Text>
                    <Tooltip label={`Status: ${getFieldStatus('assetFiles')}`}>
                      <Box>{getStatusIcon('assetFiles')}</Box>
                    </Tooltip>
                  </Group>
                  
                  <FileDropzone
                    value={form.values.assetFiles}
                    onFilesChange={(files) => form.setFieldValue('assetFiles', files)}
                    accept=".png,.jpg,.jpeg,.gif,.svg,.pdf,.csv,.xlsx,.zip,.tar.gz,.webp,.tiff,.eps,.ai,.psd,.fig,.sketch"
                    placeholder="Upload supporting files or drag a folder of assets"
                    description="Images, data files, figures, or any supplementary materials • Supports folder upload • Max 50MB per file"
                    allowFolders={true}
                    maxFileSize={50 * 1024 * 1024}
                  />
                  {form.errors.assetFiles && (
                    <Text size="sm" c="red" mt="xs">{form.errors.assetFiles}</Text>
                  )}
                </div>
            </Stack>

            <Divider />

            {/* Terms and Submit */}
            <Stack gap="lg">
              <Group gap="xs" align="center">
                <IconCheck size={20} />
                <Title order={3}>Review & Submit</Title>
              </Group>

                <Group gap="xs" align="center">
                  <Checkbox
                    label="I agree to the terms and conditions and confirm that this article is original work"
                    required
                    {...form.getInputProps('agreeToTerms', { type: 'checkbox' })}
                  />
                  <Tooltip label={`Status: ${getFieldStatus('agreeToTerms')}`}>
                    <Box>{getStatusIcon('agreeToTerms')}</Box>
                  </Tooltip>
                </Group>

                {!canSubmit() && (
                  <Text size="sm" c="orange" style={{ padding: '12px', backgroundColor: 'var(--mantine-color-orange-0)', borderRadius: '8px', border: '1px solid var(--mantine-color-orange-3)' }}>
                    <strong>Please complete all required fields:</strong>
                    <br />
                    {getFieldStatus('title') !== 'valid' && '• Title is required '}
                    {getFieldStatus('abstract') !== 'valid' && '• Abstract is required '}
                    {getFieldStatus('authors') !== 'valid' && '• Authors with exactly one corresponding author required '}
                    {getFieldStatus('sourceFiles') !== 'valid' && '• At least one source file is required '}
                    {getFieldStatus('agreeToTerms') !== 'valid' && '• Agree to terms and conditions'}
                  </Text>
                )}

                <Group justify="flex-end">
                  <Button 
                    type="submit"
                    loading={loading}
                    disabled={!canSubmit()}
                    leftSection={<IconUpload size={16} />}
                    size="lg"
                  >
                    Submit Article
                  </Button>
                </Group>
            </Stack>
          </Stack>
        </form>
      </Stack>
    </RequireProfileCompletion>
  );
}