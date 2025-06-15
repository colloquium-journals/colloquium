'use client';

import { useState, useEffect } from 'react';
import {
  Modal,
  Title,
  TextInput,
  Select,
  Textarea,
  Button,
  Stack,
  Alert,
  Group,
  Text,
  Loader,
  Card,
  Badge
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconAlertCircle, IconUsers } from '@tabler/icons-react';

interface Manuscript {
  id: string;
  title: string;
  authors: string[];
  status: string;
}

interface CreateConversationModalProps {
  opened: boolean;
  onClose: () => void;
  onSuccess: (conversationId: string) => void;
  manuscriptId?: string;
}

interface ConversationFormData {
  title: string;
  type: string;
  privacy: string;
  manuscriptId: string;
  description: string;
}

export function CreateConversationModal({
  opened,
  onClose,
  onSuccess,
  manuscriptId
}: CreateConversationModalProps) {
  const [manuscripts, setManuscripts] = useState<Manuscript[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingManuscripts, setLoadingManuscripts] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<ConversationFormData>({
    initialValues: {
      title: '',
      type: 'REVIEW',
      privacy: 'PRIVATE',
      manuscriptId: manuscriptId || '',
      description: ''
    },
    validate: {
      title: (value) => value.trim().length < 5 ? 'Title must be at least 5 characters' : null,
      manuscriptId: (value) => !value ? 'Please select a manuscript' : null
    }
  });

  const fetchManuscripts = async () => {
    try {
      setLoadingManuscripts(true);
      const response = await fetch('http://localhost:4000/api/manuscripts?status=ALL&limit=50', {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch manuscripts');
      }

      const data = await response.json();
      setManuscripts(data.manuscripts || []);
    } catch (err) {
      console.error('Error fetching manuscripts:', err);
      setError('Failed to load manuscripts');
    } finally {
      setLoadingManuscripts(false);
    }
  };

  useEffect(() => {
    if (opened && !manuscriptId) {
      fetchManuscripts();
    } else if (opened && manuscriptId) {
      // If manuscriptId is provided, fetch just that manuscript's details
      const fetchSingleManuscript = async () => {
        try {
          setLoadingManuscripts(true);
          const response = await fetch(`http://localhost:4000/api/manuscripts/${manuscriptId}`, {
            credentials: 'include'
          });
          
          if (response.ok) {
            const data = await response.json();
            setManuscripts([{
              id: data.id,
              title: data.title,
              authors: data.authors,
              status: data.status
            }]);
          }
        } catch (err) {
          console.error('Error fetching manuscript:', err);
        } finally {
          setLoadingManuscripts(false);
        }
      };
      
      fetchSingleManuscript();
      form.setFieldValue('manuscriptId', manuscriptId);
    }
  }, [opened, manuscriptId]);

  const handleSubmit = async (values: ConversationFormData) => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('http://localhost:4000/api/conversations', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: values.title.trim(),
          type: values.type,
          privacy: values.privacy,
          manuscriptId: values.manuscriptId,
          description: values.description.trim() || undefined
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create conversation');
      }

      const result = await response.json();
      form.reset();
      onSuccess(result.conversation.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const selectedManuscript = manuscripts.find(m => m.id === form.values.manuscriptId);

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={<Title order={3}>Start New Conversation</Title>}
      size="lg"
      centered
    >
      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="md">
          {error && (
            <Alert icon={<IconAlertCircle size={16} />} color="red">
              {error}
            </Alert>
          )}

          <TextInput
            label="Conversation Title"
            placeholder="What would you like to discuss?"
            required
            {...form.getInputProps('title')}
          />

          <Select
            label="Conversation Type"
            required
            data={[
              { value: 'REVIEW', label: 'Peer Review' },
              { value: 'EDITORIAL', label: 'Editorial Discussion' },
              { value: 'PUBLIC', label: 'Public Discussion' }
            ]}
            {...form.getInputProps('type')}
          />

          <Select
            label="Privacy Level"
            required
            data={[
              { value: 'PRIVATE', label: 'Private - Invited participants only' },
              { value: 'SEMI_PUBLIC', label: 'Semi-Public - Members can join' },
              { value: 'PUBLIC', label: 'Public - Anyone can view and join' }
            ]}
            {...form.getInputProps('privacy')}
          />

          <div>
            <Text size="sm" fw={500} mb="xs">
              {manuscriptId ? 'Selected Manuscript' : 'Select Manuscript'}
            </Text>
            {loadingManuscripts ? (
              <Card shadow="xs" padding="md">
                <Group gap="xs">
                  <Loader size="sm" />
                  <Text size="sm">Loading manuscripts...</Text>
                </Group>
              </Card>
            ) : manuscriptId ? (
              // Show selected manuscript (read-only)
              selectedManuscript && (
                <Card shadow="xs" padding="md" bg="blue.0">
                  <Stack gap="xs">
                    <Group justify="space-between" align="flex-start">
                      <Text size="sm" fw={500} lineClamp={2}>
                        {selectedManuscript.title}
                      </Text>
                      <Badge size="sm" variant="light">
                        {selectedManuscript.status}
                      </Badge>
                    </Group>
                    <Group gap="xs">
                      <IconUsers size={12} />
                      <Text size="xs" c="dimmed">
                        {selectedManuscript.authors.join(', ')}
                      </Text>
                    </Group>
                  </Stack>
                </Card>
              )
            ) : (
              <Select
                placeholder="Choose a manuscript to discuss"
                required
                searchable
                data={manuscripts.map(manuscript => ({
                  value: manuscript.id,
                  label: manuscript.title
                }))}
                {...form.getInputProps('manuscriptId')}
              />
            )}
          </div>

          <Textarea
            label="Description (Optional)"
            placeholder="Provide additional context or specific questions to discuss..."
            minRows={3}
            autosize
            {...form.getInputProps('description')}
          />

          <Group justify="flex-end" gap="sm">
            <Button variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" loading={loading}>
              Create Conversation
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}