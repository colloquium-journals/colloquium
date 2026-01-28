'use client';

import { useState, useEffect, useRef } from 'react';
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
  Box,
  Modal,
  Table,
  Badge,
  MultiSelect
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
  IconExternalLink,
  IconFileSpreadsheet,
  IconDownload,
  IconFileTypeCsv,
  IconCoin,
  IconPlus,
  IconTrash
} from '@tabler/icons-react';
import { downloadTemplate, parseAuthorFile, ImportedAuthor, ParseResult } from '@/utils/authorImport';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { Breadcrumbs } from '@/components/navigation/Breadcrumbs';
import { RequireProfileCompletion } from '@/components/auth/RequireProfileCompletion';
import { useJournalSettings } from '@/contexts/JournalSettingsContext';
import { CREDIT_ROLES, CreditRoleCode } from '@colloquium/types';

interface FundingInput {
  funderName: string;
  funderDoi: string;
  awardId: string;
  awardTitle: string;
}

interface SubmissionData {
  title: string;
  abstract: string;
  authors: AuthorInput[];
  keywords: string[];
  funding: FundingInput[];
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
  creditRoles: string[];
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
  const { settings: journalSettings } = useJournalSettings();
  const maxSupplementalFiles = journalSettings.maxSupplementalFiles ?? 10;
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [supportedFormats, setSupportedFormats] = useState<FormatInfo[]>([]);
  const [loadingFormats, setLoadingFormats] = useState(true);
  const [authorLookupLoading, setAuthorLookupLoading] = useState<{ [index: number]: boolean }>({});
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importedAuthors, setImportedAuthors] = useState<ImportedAuthor[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [importFileProcessing, setImportFileProcessing] = useState(false);
  const [importDragOver, setImportDragOver] = useState(false);
  const importFileInputRef = useRef<HTMLInputElement>(null);

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
        isCorresponding: true,
        creditRoles: []
      }],
      keywords: [],
      funding: [],
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

        if (maxSupplementalFiles > 0 && value.length > maxSupplementalFiles) {
          return `Maximum ${maxSupplementalFiles} supplemental file${maxSupplementalFiles !== 1 ? 's' : ''} allowed`;
        }

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
          isCorresponding: true,
          creditRoles: updatedAuthors[0].creditRoles || []
        };
        form.setFieldValue('authors', updatedAuthors);
      }
    }
  }, [user, authLoading]);

  const handleSubmit = async (values: SubmissionData) => {
    try {
      setLoading(true);

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
        isCorresponding: author.isCorresponding,
        creditRoles: author.creditRoles || []
      }))));

      // Add funding array
      if (values.funding.length > 0) {
        formData.append('funding', JSON.stringify(values.funding.filter(f => f.funderName.trim()).map(f => ({
          funderName: f.funderName.trim(),
          funderDoi: f.funderDoi.trim() || undefined,
          awardId: f.awardId.trim() || undefined,
          awardTitle: f.awardTitle.trim() || undefined
        }))));
      }
      
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
        let fullMessage = 'Failed to submit article';
        try {
          const errorData = await response.json();
          const message = errorData.message || errorData.error?.message || fullMessage;
          const details = errorData.details || errorData.error?.details;
          fullMessage = message;
          if (details && typeof details === 'object') {
            fullMessage += ': ' + Object.values(details).join(', ');
          }
        } catch {
          fullMessage = `Failed to submit article (${response.status} ${response.statusText})`;
        }
        throw new Error(fullMessage);
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
      notifications.show({
        title: 'Submission Failed',
        message: err instanceof Error ? err.message : 'An error occurred during submission',
        color: 'red',
        autoClose: 10000
      });
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
      isCorresponding: false,
      creditRoles: []
    }]);
  };

  const addFunding = () => {
    form.setFieldValue('funding', [...form.values.funding, {
      funderName: '',
      funderDoi: '',
      awardId: '',
      awardTitle: ''
    }]);
  };

  const removeFunding = (index: number) => {
    const newFunding = form.values.funding.filter((_, i) => i !== index);
    form.setFieldValue('funding', newFunding);
  };

  const updateFunding = (index: number, field: keyof FundingInput, value: string) => {
    const newFunding = [...form.values.funding];
    newFunding[index] = { ...newFunding[index], [field]: value };
    form.setFieldValue('funding', newFunding);
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

  const updateAuthor = (index: number, field: keyof AuthorInput, value: string | boolean | string[]) => {
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

  const handleImportFileChange = async (file: File | null) => {
    if (!file) return;

    setImportFileProcessing(true);
    setImportErrors([]);
    setImportedAuthors([]);

    try {
      const result = await parseAuthorFile(file);
      setImportedAuthors(result.authors);
      setImportErrors(result.errors);
    } catch (error) {
      setImportErrors(['Failed to process file']);
    } finally {
      setImportFileProcessing(false);
    }
  };

  const handleImportDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setImportDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      const fileName = file.name.toLowerCase();
      if (fileName.endsWith('.csv') || fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
        handleImportFileChange(file);
      } else {
        setImportErrors([`Invalid file type: "${file.name}". Please upload a CSV or Excel file (.csv, .xlsx, .xls)`]);
      }
    }
  };

  const handleImportInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleImportFileChange(file);
    }
  };

  const handleAddImportedAuthors = async () => {
    if (importedAuthors.length === 0) return;

    const currentAuthors = form.values.authors;

    // Check for existing corresponding author
    const hasExistingCorresponding = currentAuthors.some(a => a.isCorresponding);

    // Convert imported authors to AuthorInput format
    const newAuthors: AuthorInput[] = importedAuthors.map((imported, index) => ({
      email: imported.email,
      name: imported.name,
      affiliation: imported.affiliation,
      isExistingUser: false,
      // Only set as corresponding if no existing corresponding and this is the first imported one marked
      isCorresponding: !hasExistingCorresponding && imported.isCorresponding,
      creditRoles: []
    }));

    // If multiple imported authors are marked as corresponding, only keep the first
    let foundCorresponding = hasExistingCorresponding;
    for (const author of newAuthors) {
      if (author.isCorresponding) {
        if (foundCorresponding) {
          author.isCorresponding = false;
        } else {
          foundCorresponding = true;
        }
      }
    }

    // Filter out duplicates (by email) that already exist in current authors
    const existingEmails = new Set(currentAuthors.map(a => a.email.toLowerCase()));
    const filteredNewAuthors = newAuthors.filter(a => !existingEmails.has(a.email.toLowerCase()));

    // Merge authors
    const mergedAuthors = [...currentAuthors, ...filteredNewAuthors];
    form.setFieldValue('authors', mergedAuthors);

    // Close modal and reset state
    setImportModalOpen(false);
    setImportedAuthors([]);
    setImportErrors([]);
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
              <Group gap="xs" align="center" justify="space-between">
                <Group gap="xs" align="center">
                  <IconUsers size={20} />
                  <Title order={3}>Authors</Title>
                </Group>
                <Button
                  variant="light"
                  size="xs"
                  leftSection={<IconFileSpreadsheet size={16} />}
                  onClick={() => setImportModalOpen(true)}
                >
                  Import from file
                </Button>
              </Group>

              {/* Import Modal */}
              <Modal
                opened={importModalOpen}
                onClose={() => {
                  setImportModalOpen(false);
                  setImportedAuthors([]);
                  setImportErrors([]);
                }}
                title="Import Authors from File"
                size="lg"
              >
                <Stack gap="md">
                  <Text size="sm" c="dimmed">
                    Upload a CSV or Excel file with author information. Required columns: email, name.
                    Optional columns: affiliation, corresponding.
                  </Text>

                  <Group gap="xs">
                    <Text size="sm" fw={500}>Download template:</Text>
                    <Button
                      variant="subtle"
                      size="xs"
                      leftSection={<IconFileTypeCsv size={14} />}
                      onClick={() => downloadTemplate('csv')}
                    >
                      CSV
                    </Button>
                    <Button
                      variant="subtle"
                      size="xs"
                      leftSection={<IconDownload size={14} />}
                      onClick={() => downloadTemplate('xlsx')}
                    >
                      Excel
                    </Button>
                  </Group>

                  <input
                    ref={importFileInputRef}
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={handleImportInputChange}
                    style={{ display: 'none' }}
                  />
                  <Box
                    onDrop={handleImportDrop}
                    onDragOver={(e) => { e.preventDefault(); setImportDragOver(true); }}
                    onDragLeave={(e) => { e.preventDefault(); setImportDragOver(false); }}
                    onClick={() => importFileInputRef.current?.click()}
                    style={{
                      border: `2px dashed ${importDragOver ? 'var(--mantine-color-blue-5)' : 'var(--mantine-color-gray-4)'}`,
                      borderRadius: '8px',
                      padding: '24px',
                      backgroundColor: importDragOver ? 'var(--mantine-color-blue-0)' : 'var(--mantine-color-gray-0)',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      textAlign: 'center'
                    }}
                  >
                    <Stack align="center" gap="xs">
                      <IconUpload size={32} color="var(--mantine-color-gray-6)" />
                      <Text size="sm" fw={500}>
                        Drag and drop a file here, or click to select
                      </Text>
                      <Text size="xs" c="dimmed">
                        Accepts CSV or Excel files (.csv, .xlsx, .xls)
                      </Text>
                    </Stack>
                  </Box>

                  {importFileProcessing && (
                    <Group gap="xs">
                      <Loader size="sm" />
                      <Text size="sm">Processing file...</Text>
                    </Group>
                  )}

                  {importErrors.length > 0 && (
                    <Alert
                      icon={<IconAlertCircle size={16} />}
                      color={importedAuthors.length > 0 ? 'yellow' : 'red'}
                      title={importedAuthors.length > 0 ? 'Warnings' : 'Errors'}
                    >
                      <Stack gap="xs">
                        {importErrors.map((error, index) => (
                          <Text key={index} size="sm">{error}</Text>
                        ))}
                      </Stack>
                    </Alert>
                  )}

                  {importedAuthors.length > 0 && (
                    <Stack gap="sm">
                      <Text size="sm" fw={500}>
                        Preview ({importedAuthors.length} author{importedAuthors.length !== 1 ? 's' : ''} found):
                      </Text>
                      <Table.ScrollContainer minWidth={500}>
                        <Table striped withTableBorder>
                          <Table.Thead>
                            <Table.Tr>
                              <Table.Th>Email</Table.Th>
                              <Table.Th>Name</Table.Th>
                              <Table.Th>Affiliation</Table.Th>
                              <Table.Th>Corresponding</Table.Th>
                            </Table.Tr>
                          </Table.Thead>
                          <Table.Tbody>
                            {importedAuthors.map((author, index) => (
                              <Table.Tr key={index}>
                                <Table.Td>{author.email}</Table.Td>
                                <Table.Td>{author.name}</Table.Td>
                                <Table.Td>{author.affiliation || '—'}</Table.Td>
                                <Table.Td>
                                  {author.isCorresponding ? (
                                    <Badge color="blue" size="sm">Yes</Badge>
                                  ) : '—'}
                                </Table.Td>
                              </Table.Tr>
                            ))}
                          </Table.Tbody>
                        </Table>
                      </Table.ScrollContainer>
                      <Group justify="flex-end">
                        <Button
                          variant="outline"
                          onClick={() => {
                            setImportModalOpen(false);
                            setImportedAuthors([]);
                            setImportErrors([]);
                          }}
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={handleAddImportedAuthors}
                          leftSection={<IconCheck size={16} />}
                        >
                          Add {importedAuthors.length} author{importedAuthors.length !== 1 ? 's' : ''}
                        </Button>
                      </Group>
                    </Stack>
                  )}
                </Stack>
              </Modal>

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
                          <Grid gutter="sm" align="flex-start">
                            <Grid.Col span={{ base: 12, sm: 6 }}>
                              <Stack gap="xs">
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
                            </Grid.Col>

                            <Grid.Col span={{ base: form.values.authors.length > 1 ? 11 : 12, sm: form.values.authors.length > 1 ? 5 : 6 }}>
                              <Stack gap="xs">
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
                            </Grid.Col>

                            {form.values.authors.length > 1 && (
                              <Grid.Col span={{ base: 1, sm: 1 }} style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 4 }}>
                                <ActionIcon
                                  variant="outline"
                                  color="red"
                                  size="lg"
                                  onClick={() => removeAuthor(index)}
                                  mt="xl"
                                >
                                  <IconX size={14} />
                                </ActionIcon>
                              </Grid.Col>
                            )}
                          </Grid>
                          
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

                          <MultiSelect
                            label="CRediT Roles (Optional)"
                            placeholder="Select contributor roles"
                            data={CREDIT_ROLES.map(role => ({ value: role.code, label: role.label }))}
                            value={author.creditRoles}
                            onChange={(value) => updateAuthor(index, 'creditRoles', value)}
                            searchable
                            clearable
                            description="Contributor Roles Taxonomy (CRediT) roles for this author"
                          />

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

            {/* Funding */}
            <Stack gap="lg">
              <Group gap="xs" align="center">
                <IconCoin size={20} />
                <Title order={3}>Funding (Optional)</Title>
              </Group>
              <Text size="sm" c="dimmed">
                Add information about grants or funding sources that supported this research.
              </Text>

              <Stack gap="sm">
                {form.values.funding.map((fund, index) => (
                  <Box key={index} p="md" style={{
                    border: '1px solid var(--mantine-color-gray-3)',
                    borderRadius: '8px',
                    backgroundColor: 'var(--mantine-color-gray-0)'
                  }}>
                    <Stack gap="sm">
                      <Group align="flex-start" gap="sm">
                        <TextInput
                          label="Funder Name"
                          placeholder="e.g., National Science Foundation"
                          value={fund.funderName}
                          onChange={(e) => updateFunding(index, 'funderName', e.target.value)}
                          style={{ flex: 1 }}
                          required
                        />
                        <ActionIcon
                          variant="outline"
                          color="red"
                          size="lg"
                          onClick={() => removeFunding(index)}
                          mt="xl"
                        >
                          <IconTrash size={14} />
                        </ActionIcon>
                      </Group>

                      <Grid gutter="sm">
                        <Grid.Col span={{ base: 12, sm: 6 }}>
                          <TextInput
                            label="Funder DOI (Optional)"
                            placeholder="e.g., 10.13039/100000001"
                            value={fund.funderDoi}
                            onChange={(e) => updateFunding(index, 'funderDoi', e.target.value)}
                            description="Crossref Funder Registry DOI"
                          />
                        </Grid.Col>
                        <Grid.Col span={{ base: 12, sm: 6 }}>
                          <TextInput
                            label="Award/Grant ID (Optional)"
                            placeholder="e.g., BCS-1234567"
                            value={fund.awardId}
                            onChange={(e) => updateFunding(index, 'awardId', e.target.value)}
                          />
                        </Grid.Col>
                      </Grid>

                      <TextInput
                        label="Award Title (Optional)"
                        placeholder="Grant title or project name"
                        value={fund.awardTitle}
                        onChange={(e) => updateFunding(index, 'awardTitle', e.target.value)}
                      />
                    </Stack>
                  </Box>
                ))}
                <Button
                  variant="light"
                  onClick={addFunding}
                  size="sm"
                  leftSection={<IconPlus size={14} />}
                  style={{ alignSelf: 'flex-start' }}
                >
                  Add Funding Source
                </Button>
              </Stack>
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
                    description={`Images, data files, figures, or any supplementary materials • Supports folder upload • Max 50MB per file${maxSupplementalFiles > 0 ? ` • Max ${maxSupplementalFiles} files` : ''}`}
                    allowFolders={true}
                    maxFileSize={50 * 1024 * 1024}
                    maxFiles={maxSupplementalFiles > 0 ? maxSupplementalFiles : undefined}
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