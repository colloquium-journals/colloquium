'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Container, Paper, Title, Text, Button, Group, Alert, Loader, Center, Stack } from '@mantine/core';
import { IconCheck, IconX, IconMail, IconCalendar } from '@tabler/icons-react';
import { useAuth } from '@/contexts/AuthContext';
import { API_URL } from '@/lib/api';

interface InvitationData {
  id: string;
  status: string;
  dueDate?: string;
  reviewer: {
    id?: string;
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
  const token = searchParams.get('token');
  const { user, loading: authLoading } = useAuth();

  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [response, setResponse] = useState<ResponseResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [wrongUser, setWrongUser] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    loadInvitationAndProcess();
  }, [invitationId, action, authLoading]);

  const loadInvitationAndProcess = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/api/reviewers/invitations/${invitationId}/public`, {
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to load invitation');
      }

      const data = await response.json();
      if (data.invitation) {
        setInvitation(data.invitation);

        // If the user is logged in as someone other than the invited reviewer and has no token, block the action
        if (!token && user && data.invitation.reviewer.id && user.id !== data.invitation.reviewer.id) {
          setWrongUser(true);
          setLoading(false);
          return;
        }

        // If there's an action in the URL and the user check passed, process it
        if (action) {
          await handleDirectResponse(action);
          return;
        }
      } else if (data.message && data.status) {
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
      const tokenParam = token ? `&token=${encodeURIComponent(token)}` : '';
      const response = await fetch(`${API_URL}/api/reviewers/invitations/${invitationId}/public?action=${responseAction}${tokenParam}`, {
        credentials: 'include'
      });

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
      const response = await fetch(`${API_URL}/api/reviewers/invitations/${invitationId}/respond-public`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: responseAction,
          ...(token && { token }),
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

  if (wrongUser && invitation) {
    return (
      <Container size="sm" py="xl">
        <Paper p="xl" shadow="sm">
          <Stack align="center" gap="lg">
            <IconX size={48} color="orange" />
            <Title order={2} ta="center">
              This Invitation Is Not For You
            </Title>
            <Text ta="center" size="lg">
              This review invitation was sent to <strong>{invitation.reviewer.name || invitation.reviewer.email}</strong>.
              Only they can accept or decline it.
            </Text>
            <Text size="sm" c="dimmed" ta="center">
              If you are the invited reviewer, please log in with the correct account.
            </Text>
          </Stack>
        </Paper>
      </Container>
    );
  }

  if (response) {
    return (
      <Container size="sm" py="xl">
        <Paper p="xl" shadow="sm">
          <Stack align="center" gap="lg">
            {response.status === 'IN_PROGRESS' ? (
              <IconCheck size={48} color="green" />
            ) : (
              <IconX size={48} color="red" />
            )}
            
            <Title order={2} ta="center">
              {response.status === 'IN_PROGRESS' ? 'Invitation Accepted!' : 'Invitation Declined'}
            </Title>
            
            <Text ta="center" size="lg">
              {response.message}
            </Text>
            
            <Stack gap="xs">
              <Text><strong>Reviewer:</strong> {response.reviewer}</Text>
              <Text><strong>Manuscript:</strong> {response.manuscript}</Text>
            </Stack>
            
            {response.status === 'IN_PROGRESS' && (
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
          <Stack align="center" gap="lg">
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
        <Stack gap="lg">
          <Title order={1} ta="center">
            Review Invitation
          </Title>
          
          <Stack gap="md">
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
            <Stack gap="xs">
              <Text fw={500}>Abstract:</Text>
              <Text size="sm" style={{ fontStyle: 'italic' }}>
                {invitation.manuscript.abstract}
              </Text>
            </Stack>
          )}
          
          {(token || (user && invitation.reviewer.id && user.id === invitation.reviewer.id)) ? (
            <>
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
            </>
          ) : (
            <Alert icon={<IconMail size="1rem" />} title="Authorization Required" color="yellow">
              To respond to this invitation, please use the accept or decline link from your invitation email, or log in as the invited reviewer.
            </Alert>
          )}
        </Stack>
      </Paper>
    </Container>
  );
}