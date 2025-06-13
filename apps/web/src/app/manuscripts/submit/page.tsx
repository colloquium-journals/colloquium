'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Container, 
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
  Stepper,
  FileInput,
  Checkbox,
  Divider
} from '@mantine/core';
import { 
  IconCheck, 
  IconAlertCircle, 
  IconFileText, 
  IconUsers, 
  IconUpload,
  IconX
} from '@tabler/icons-react';
import { useForm } from '@mantine/form';
import { Breadcrumbs } from '@/components/navigation/Breadcrumbs';

interface SubmissionData {
  title: string;
  abstract: string;
  content: string;
  authors: string[];
  keywords: string[];
  file?: File;
  agreeToTerms: boolean;
}

export default function SubmitManuscriptPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [activeStep, setActiveStep] = useState(0);

  const form = useForm<SubmissionData>({
    initialValues: {
      title: '',
      abstract: '',
      content: '',
      authors: [''],
      keywords: [],
      agreeToTerms: false
    },
    validate: {
      title: (value) => value.trim().length < 10 ? 'Title must be at least 10 characters' : null,
      abstract: (value) => value.trim().length < 100 ? 'Abstract must be at least 100 characters' : null,
      content: (value) => value.trim().length < 500 ? 'Content must be at least 500 characters' : null,
      authors: (value) => {
        if (!value || value.length === 0) return 'At least one author is required';
        if (value.some(author => !author.trim())) return 'All author names must be filled';
        return null;
      },
      agreeToTerms: (value) => !value ? 'You must agree to the terms and conditions' : null
    }
  });

  const handleSubmit = async (values: SubmissionData) => {
    try {
      setLoading(true);
      setError(null);

      const submissionData = {
        title: values.title.trim(),
        abstract: values.abstract.trim(),
        content: values.content.trim(),
        authors: values.authors.filter(author => author.trim()).map(author => author.trim()),
        keywords: values.keywords,
        metadata: {
          submissionMethod: 'web_form',
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString()
        }
      };

      const response = await fetch('http://localhost:4000/api/manuscripts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(submissionData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to submit manuscript');
      }

      const result = await response.json();
      setSuccess(true);
      
      // Redirect to the submitted manuscript after a delay
      setTimeout(() => {
        router.push(`/manuscripts/${result.manuscript.id}`);
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

  const getProgress = () => {
    const fields = ['title', 'abstract', 'content', 'authors'];
    const completed = fields.filter(field => {
      if (field === 'authors') {
        return form.values.authors.some(author => author.trim());
      }
      return form.values[field as keyof SubmissionData]?.toString().trim();
    }).length;
    return (completed / fields.length) * 100;
  };

  const canProceedToStep = (step: number) => {
    switch (step) {
      case 1:
        return form.values.title.trim().length >= 10;
      case 2:
        return form.values.abstract.trim().length >= 100 && 
               form.values.authors.some(author => author.trim());
      case 3:
        return form.values.content.trim().length >= 500;
      default:
        return true;
    }
  };

  if (success) {
    return (
      <Container size="md" py="xl">
        <Card shadow="sm" padding="xl" radius="md">
          <Stack align="center" gap="md">
            <IconCheck size={64} color="green" />
            <Title order={2} ta="center">Manuscript Submitted Successfully!</Title>
            <Text ta="center" c="dimmed">
              Your manuscript has been submitted for review. You will be redirected to the manuscript page shortly.
            </Text>
            <Progress value={100} color="green" size="lg" style={{ width: '100%' }} />
          </Stack>
        </Card>
      </Container>
    );
  }

  return (
    <Container size="lg" py="xl">
      <Stack gap="xl">
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

        {/* Stepper */}
        <Stepper active={activeStep} onStepClick={setActiveStep} allowNextStepsSelect={false}>
          <Stepper.Step 
            label="Basic Information" 
            description="Title and abstract"
            icon={<IconFileText size={18} />}
          >
            <Card shadow="sm" padding="lg" radius="md">
              <Stack gap="md">
                <TextInput
                  label="Manuscript Title"
                  placeholder="Enter a descriptive title for your manuscript"
                  required
                  {...form.getInputProps('title')}
                />
                
                <Textarea
                  label="Abstract"
                  placeholder="Provide a concise summary of your research (minimum 100 characters)"
                  required
                  minRows={6}
                  autosize
                  {...form.getInputProps('abstract')}
                />

                <Group justify="flex-end">
                  <Button 
                    onClick={() => setActiveStep(1)}
                    disabled={!canProceedToStep(1)}
                  >
                    Next: Authors & Keywords
                  </Button>
                </Group>
              </Stack>
            </Card>
          </Stepper.Step>

          <Stepper.Step 
            label="Authors & Keywords" 
            description="Author information and keywords"
            icon={<IconUsers size={18} />}
          >
            <Card shadow="sm" padding="lg" radius="md">
              <Stack gap="md">
                <div>
                  <Text size="sm" fw={500} mb="xs">Authors</Text>
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
                          <Button 
                            variant="outline" 
                            color="red" 
                            size="sm"
                            onClick={() => removeAuthor(index)}
                          >
                            <IconX size={14} />
                          </Button>
                        )}
                      </Group>
                    ))}
                    <Button variant="light" onClick={addAuthor} size="sm">
                      Add Another Author
                    </Button>
                  </Stack>
                  {form.errors.authors && (
                    <Text size="sm" c="red" mt="xs">{form.errors.authors}</Text>
                  )}
                </div>

                <TagsInput
                  label="Keywords"
                  placeholder="Add keywords (press Enter to add)"
                  {...form.getInputProps('keywords')}
                />

                <Group justify="space-between">
                  <Button variant="outline" onClick={() => setActiveStep(0)}>
                    Back
                  </Button>
                  <Button 
                    onClick={() => setActiveStep(2)}
                    disabled={!canProceedToStep(2)}
                  >
                    Next: Content
                  </Button>
                </Group>
              </Stack>
            </Card>
          </Stepper.Step>

          <Stepper.Step 
            label="Content" 
            description="Manuscript content"
            icon={<IconFileText size={18} />}
          >
            <Card shadow="sm" padding="lg" radius="md">
              <Stack gap="md">
                <Textarea
                  label="Manuscript Content"
                  placeholder="Enter your full manuscript content in Markdown format (minimum 500 characters)"
                  required
                  minRows={15}
                  autosize
                  {...form.getInputProps('content')}
                />

                <Text size="sm" c="dimmed">
                  You can use Markdown formatting for headings, emphasis, lists, etc.
                </Text>

                <Group justify="space-between">
                  <Button variant="outline" onClick={() => setActiveStep(1)}>
                    Back
                  </Button>
                  <Button 
                    onClick={() => setActiveStep(3)}
                    disabled={!canProceedToStep(3)}
                  >
                    Next: Review & Submit
                  </Button>
                </Group>
              </Stack>
            </Card>
          </Stepper.Step>

          <Stepper.Step 
            label="Review & Submit" 
            description="Final review"
            icon={<IconCheck size={18} />}
          >
            <Card shadow="sm" padding="lg" radius="md">
              <Stack gap="lg">
                {/* Summary */}
                <div>
                  <Title order={3} mb="md">Submission Summary</Title>
                  <Grid>
                    <Grid.Col span={3}>
                      <Text fw={500}>Title:</Text>
                    </Grid.Col>
                    <Grid.Col span={9}>
                      <Text>{form.values.title}</Text>
                    </Grid.Col>
                    
                    <Grid.Col span={3}>
                      <Text fw={500}>Authors:</Text>
                    </Grid.Col>
                    <Grid.Col span={9}>
                      <Text>{form.values.authors.filter(a => a.trim()).join(', ')}</Text>
                    </Grid.Col>
                    
                    <Grid.Col span={3}>
                      <Text fw={500}>Keywords:</Text>
                    </Grid.Col>
                    <Grid.Col span={9}>
                      <Text>{form.values.keywords.join(', ') || 'None'}</Text>
                    </Grid.Col>
                    
                    <Grid.Col span={3}>
                      <Text fw={500}>Content Length:</Text>
                    </Grid.Col>
                    <Grid.Col span={9}>
                      <Text>{form.values.content.length} characters</Text>
                    </Grid.Col>
                  </Grid>
                </div>

                <Divider />

                {/* Terms and Conditions */}
                <Checkbox
                  label="I agree to the terms and conditions and confirm that this manuscript is original work"
                  required
                  {...form.getInputProps('agreeToTerms', { type: 'checkbox' })}
                />

                <Group justify="space-between">
                  <Button variant="outline" onClick={() => setActiveStep(2)}>
                    Back
                  </Button>
                  <Button 
                    onClick={() => form.onSubmit(handleSubmit)()}
                    loading={loading}
                    disabled={!form.values.agreeToTerms}
                    leftSection={<IconUpload size={16} />}
                  >
                    Submit Manuscript
                  </Button>
                </Group>
              </Stack>
            </Card>
          </Stepper.Step>
        </Stepper>
      </Stack>
    </Container>
  );
}