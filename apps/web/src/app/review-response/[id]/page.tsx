'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Container, Paper, Title, Text, Button, Group, Alert, Loader, Center, Stack } from '@mantine/core';
import { IconCheck, IconX, IconMail, IconCalendar } from '@tabler/icons-react';

interface InvitationData {
  id: string;
  status: string;
  dueDate?: string;
  reviewer: {
    name?: string;
    email: string;
  };
  manuscript: {
    title: string;
    abstract?: string;
    submittedAt: string;
  };
}

interface ResponseResult {
  message: string;
  status: string;
  reviewer: string;
  manuscript: string;
}

export default function ReviewResponsePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const invitationId = params.id as string;
  const action = searchParams.get('action');
  
  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [response, setResponse] = useState<ResponseResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (action) {
      // If there's an action in the URL, process it directly
      handleDirectResponse(action);
    } else {
      // Otherwise, load the invitation details
      loadInvitation();
    }
  }, [invitationId, action]);

  const loadInvitation = async () => {
    try {
      setLoading(true);
      // Load invitation data without action parameter to get invitation details
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const response = await fetch(`${apiUrl}/api/reviewers/invitations/${invitationId}/public`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to load invitation');
      }
      
      const data = await response.json();
      // Check if this is a response result (when action was provided) or invitation data
      if (data.invitation) {
        setInvitation(data.invitation);
      } else if (data.message && data.status) {
        // This is already a processed response
        setResponse(data);
      } else {
        throw new Error('Unexpected response format');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleDirectResponse = async (responseAction: string) => {
    try {
      setLoading(true);
      // When action is in URL, call the API with the action parameter
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const response = await fetch(`${apiUrl}/api/reviewers/invitations/${invitationId}/public?action=${responseAction}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to process response');
      }
      
      const data = await response.json();
      setResponse(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process response');
    } finally {
      setLoading(false);
    }
  };

  const handleResponse = async (responseAction: string) => {
    if (!invitation || submitting) return;
    
    try {
      setSubmitting(true);
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const response = await fetch(`${apiUrl}/api/reviewers/invitations/${invitationId}/respond-public`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: responseAction,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to submit response');
      }
      
      const data = await response.json();
      setResponse(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit response');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Container size="sm" py="xl">
        <Center>
          <Stack align="center">
            <Loader size="lg" />
            <Text>Loading invitation...</Text>
          </Stack>
        </Center>
      </Container>
    );
  }

  if (error) {
    return (
      <Container size="sm" py="xl">
        <Alert icon={<IconX size="1rem" />} title="Error" color="red">
          {error}
        </Alert>
      </Container>
    );
  }

  if (response) {
    return (
      <Container size="sm" py="xl">
        <Paper p="xl" shadow="sm">
          <Stack align="center" spacing="lg">
            {response.status === 'ACCEPTED' ? (
              <IconCheck size={48} color="green" />
            ) : (
              <IconX size={48} color="red" />
            )}
            
            <Title order={2} ta="center">
              {response.status === 'ACCEPTED' ? 'Invitation Accepted!' : 'Invitation Declined'}
            </Title>
            
            <Text ta="center" size="lg">
              {response.message}
            </Text>
            
            <Stack spacing="xs">
              <Text><strong>Reviewer:</strong> {response.reviewer}</Text>
              <Text><strong>Manuscript:</strong> {response.manuscript}</Text>
            </Stack>
            
            {response.status === 'ACCEPTED' && (
              <Alert icon={<IconMail size="1rem" />} title="Next Steps" color="green">
                You will receive further instructions from the editorial team about accessing the manuscript and submitting your review.
              </Alert>
            )}
            
            <Text size="sm" c="dimmed" ta="center">
              Thank you for your response. This window can be closed.
            </Text>
          </Stack>
        </Paper>
      </Container>
    );
  }

  if (!invitation) {
    return (
      <Container size="sm" py="xl">
        <Alert icon={<IconX size="1rem" />} title="Invitation Not Found" color="red">
          The invitation you're looking for could not be found or may have expired.
        </Alert>
      </Container>
    );
  }

  if (invitation.status !== 'PENDING') {
    return (
      <Container size="sm" py="xl">
        <Paper p="xl" shadow="sm">
          <Stack align="center" spacing="lg">
            <Title order={2} ta="center">
              Invitation Already Responded
            </Title>
            
            <Text ta="center" size="lg">
              This invitation has already been {invitation.status.toLowerCase()}.
            </Text>
            
            <Text size="sm" c="dimmed" ta="center">
              If you need to change your response, please contact the editorial team.
            </Text>
          </Stack>
        </Paper>
      </Container>
    );
  }

  return (
    <Container size="md" py="xl">
      <Paper p="xl" shadow="sm">
        <Stack spacing="lg">
          <Title order={1} ta="center">
            Review Invitation
          </Title>
          
          <Stack spacing="md">
            <Text><strong>Reviewer:</strong> {invitation.reviewer.name || invitation.reviewer.email}</Text>
            <Text><strong>Manuscript:</strong> {invitation.manuscript.title}</Text>
            <Text><strong>Submitted:</strong> {new Date(invitation.manuscript.submittedAt).toLocaleDateString()}</Text>
            {invitation.dueDate && (
              <Text>
                <IconCalendar size="1rem" style={{ display: 'inline', marginRight: '0.5rem' }} />
                <strong>Review Due:</strong> {new Date(invitation.dueDate).toLocaleDateString()}
              </Text>
            )}
          </Stack>
          
          {invitation.manuscript.abstract && (
            <Stack spacing="xs">
              <Text weight={500}>Abstract:</Text>
              <Text size="sm" style={{ fontStyle: 'italic' }}>
                {invitation.manuscript.abstract}
              </Text>
            </Stack>
          )}
          
          <Alert icon={<IconMail size="1rem" />} title="Review Invitation" color="blue">
            You have been invited to review this manuscript. Please consider your availability and expertise before responding.
          </Alert>
          
          <Group justify="center" mt="xl">
            <Button
              size="lg"
              color="green"
              leftSection={<IconCheck size="1rem" />}
              onClick={() => handleResponse('accept')}
              loading={submitting}
              disabled={submitting}
            >
              Accept Review
            </Button>
            
            <Button
              size="lg"
              color="red"
              variant="outline"
              leftSection={<IconX size="1rem" />}
              onClick={() => handleResponse('decline')}
              loading={submitting}
              disabled={submitting}
            >
              Decline Review
            </Button>
          </Group>
          
          <Text size="xs" c="dimmed" ta="center" mt="md">
            By accepting this invitation, you agree to provide a timely and constructive review.
          </Text>
        </Stack>
      </Paper>
    </Container>
  );
}