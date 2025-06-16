'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import {
  Container,
  Stack,
  Title,
  Card,
  TextInput,
  Textarea,
  Button,
  Group,
  Alert,
  Text,
  Anchor,
  Loader,
  Divider,
  Badge,
  Modal
} from '@mantine/core';
import {
  IconCheck,
  IconAlertCircle,
  IconExternalLink,
  IconUser,
  IconWorld,
  IconBuilding,
  IconAt,
  IconShieldCheck,
  IconUnlink
} from '@tabler/icons-react';
import { useForm } from '@mantine/form';
import { useDisclosure } from '@mantine/hooks';
import Link from 'next/link';

interface ProfileFormData {
  name: string;
  orcidId: string;
  bio: string;
  affiliation: string;
  website: string;
}

interface ORCIDStatus {
  orcidId: string | null;
  verified: boolean;
  hasToken: boolean;
}

export default function EditProfilePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isAuthenticated, refreshUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [orcidStatus, setOrcidStatus] = useState<ORCIDStatus | null>(null);
  const [orcidLoading, setOrcidLoading] = useState(false);
  const [unlinkModalOpened, { open: openUnlinkModal, close: closeUnlinkModal }] = useDisclosure(false);

  const form = useForm<ProfileFormData>({
    initialValues: {
      name: '',
      orcidId: '',
      bio: '',
      affiliation: '',
      website: ''
    },
    validate: {
      name: (value) => value.trim().length === 0 ? 'Name is required' : null,
      orcidId: (value) => {
        // Skip validation if ORCID is verified (managed by OAuth)
        if (orcidStatus?.verified) return null;
        if (!value) return null; // ORCID is optional
        const orcidRegex = /^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/;
        return orcidRegex.test(value) ? null : 'Invalid ORCID ID format (e.g., 0000-0000-0000-0000)';
      },
      bio: (value) => value.length > 1000 ? 'Bio must be less than 1000 characters' : null,
      affiliation: (value) => value.length > 200 ? 'Affiliation must be less than 200 characters' : null,
      website: (value) => {
        if (!value) return null; // Website is optional
        try {
          new URL(value);
          return null;
        } catch {
          return 'Please enter a valid URL (including http:// or https://)';
        }
      }
    }
  });

  // Fetch ORCID status
  const fetchOrcidStatus = async () => {
    try {
      const response = await fetch('http://localhost:4000/api/orcid/status', {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setOrcidStatus(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch ORCID status:', err);
    }
  };

  useEffect(() => {
    const fetchCurrentProfile = async () => {
      if (!isAuthenticated) {
        setLoading(false);
        return;
      }

      try {
        const [profileResponse] = await Promise.all([
          fetch('http://localhost:4000/api/users/me', { credentials: 'include' }),
          fetchOrcidStatus()
        ]);

        if (!profileResponse.ok) {
          throw new Error('Failed to fetch profile');
        }

        const profile = await profileResponse.json();
        
        // Populate form with current values
        form.setValues({
          name: profile.name || '',
          orcidId: profile.orcidId || '',
          bio: profile.bio || '',
          affiliation: profile.affiliation || '',
          website: profile.website || ''
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load profile');
      } finally {
        setLoading(false);
      }
    };

    fetchCurrentProfile();
  }, [isAuthenticated]);

  // Handle ORCID OAuth callback results
  useEffect(() => {
    const orcidSuccess = searchParams.get('orcid_success');
    const orcidError = searchParams.get('orcid_error');

    if (orcidSuccess === 'verified') {
      setSuccess('ORCID verified successfully!');
      fetchOrcidStatus();
      refreshUser();
      // Clean up URL
      router.replace('/profile/edit');
    } else if (orcidError) {
      const errorMessages: Record<string, string> = {
        'token_exchange_failed': 'Failed to verify ORCID. Please try again.',
        'orcid_already_linked': 'This ORCID is already linked to another account.',
        'session_expired': 'Session expired. Please try again.',
        'server_error': 'Server error occurred. Please try again later.',
        'access_denied': 'ORCID verification was cancelled.',
        'invalid_state': 'Invalid request state. Please try again.'
      };
      setError(errorMessages[orcidError] || 'ORCID verification failed');
      // Clean up URL
      router.replace('/profile/edit');
    }
  }, [searchParams, router, refreshUser]);

  const handleSubmit = async (values: ProfileFormData) => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      // Only send non-empty values, exclude ORCID if verified (managed by OAuth)
      const updateData: Partial<ProfileFormData> = {};
      Object.entries(values).forEach(([key, value]) => {
        // Skip ORCID if it's verified (managed separately)
        if (key === 'orcidId' && orcidStatus?.verified) return;
        
        if (value.trim()) {
          updateData[key as keyof ProfileFormData] = value.trim();
        }
      });

      const response = await fetch('http://localhost:4000/api/users/me', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(updateData)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to update profile');
      }

      setSuccess('Profile updated successfully!');
      
      // Refresh user data in auth context
      await refreshUser();

      // Redirect to profile page after a short delay
      setTimeout(() => {
        router.push('/profile');
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const formatORCIDUrl = (orcidId: string) => {
    return `https://orcid.org/${orcidId}`;
  };

  const handleVerifyOrcid = async () => {
    try {
      setOrcidLoading(true);
      setError(null);

      const response = await fetch('http://localhost:4000/api/orcid/auth', {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to start ORCID verification');
      }

      const data = await response.json();
      
      // Redirect to ORCID OAuth
      window.location.href = data.data.authUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start ORCID verification');
      setOrcidLoading(false);
    }
  };

  const handleUnlinkOrcid = async () => {
    try {
      setOrcidLoading(true);
      setError(null);

      const response = await fetch('http://localhost:4000/api/orcid/unlink', {
        method: 'DELETE',
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to unlink ORCID');
      }

      setSuccess('ORCID account unlinked successfully');
      await fetchOrcidStatus();
      await refreshUser();
      
      // Clear ORCID from form
      form.setFieldValue('orcidId', '');
      
      closeUnlinkModal();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to unlink ORCID');
    } finally {
      setOrcidLoading(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <Container size="md" py="xl">
        <Alert icon={<IconAlertCircle size={16} />} color="red">
          Please sign in to edit your profile.
        </Alert>
      </Container>
    );
  }

  if (loading) {
    return (
      <Container size="md" py="xl">
        <Stack align="center" gap="md">
          <Loader size="lg" />
          <Text>Loading your profile...</Text>
        </Stack>
      </Container>
    );
  }

  return (
    <Container size="md" py="xl">
      <Stack gap="xl">
        {/* Header */}
        <Stack gap="xs">
          <Group justify="space-between" align="center">
            <Title order={1}>Edit Profile</Title>
            <Button
              variant="outline"
              component={Link}
              href="/profile"
            >
              Cancel
            </Button>
          </Group>
          <Text c="dimmed">
            Update your profile information and academic credentials.
          </Text>
        </Stack>

        {/* Success/Error Messages */}
        {success && (
          <Alert icon={<IconCheck size={16} />} color="green">
            {success}
          </Alert>
        )}

        {error && (
          <Alert icon={<IconAlertCircle size={16} />} color="red">
            {error}
          </Alert>
        )}

        {/* Profile Form */}
        <Card shadow="sm" padding="xl" radius="md">
          <form onSubmit={form.onSubmit(handleSubmit)}>
            <Stack gap="lg">
              {/* Basic Information */}
              <Stack gap="md">
                <Title order={3}>Basic Information</Title>
                
                <TextInput
                  label="Full Name"
                  placeholder="Your full name"
                  leftSection={<IconUser size={16} />}
                  required
                  {...form.getInputProps('name')}
                />

                <TextInput
                  label="Email Address"
                  value={user?.email || ''}
                  disabled
                  leftSection={<IconAt size={16} />}
                  description="Email cannot be changed. Contact support if needed."
                />

                <Textarea
                  label="Bio"
                  placeholder="Tell us about yourself, your research interests, or background..."
                  minRows={3}
                  maxRows={6}
                  autosize
                  {...form.getInputProps('bio')}
                  description={`${form.values.bio.length}/1000 characters`}
                />
              </Stack>

              <Divider />

              {/* Academic Information */}
              <Stack gap="md">
                <Title order={3}>Academic Information</Title>
                
                <Stack gap="xs">
                  <Group gap="xs" align="center">
                    <Text fw={500} size="sm">ORCID iD</Text>
                    {orcidStatus?.verified && (
                      <Badge
                        size="xs"
                        color="green"
                        variant="light"
                        leftSection={<IconShieldCheck size={12} />}
                      >
                        Verified
                      </Badge>
                    )}
                  </Group>
                  
                  {orcidStatus?.verified ? (
                    <Card withBorder padding="sm" bg="green.0">
                      <Group justify="space-between" align="center">
                        <Group gap="xs">
                          <IconShieldCheck size={16} color="green" />
                          <Stack gap={2}>
                            <Text size="sm" fw={500}>
                              {orcidStatus.orcidId}
                            </Text>
                            <Text size="xs" c="dimmed">
                              Verified ORCID identifier
                            </Text>
                          </Stack>
                        </Group>
                        <Group gap="xs">
                          <Anchor
                            href={formatORCIDUrl(orcidStatus.orcidId!)}
                            target="_blank"
                            size="sm"
                          >
                            View Profile
                          </Anchor>
                          <Button
                            variant="outline"
                            size="xs"
                            color="red"
                            leftSection={<IconUnlink size={14} />}
                            onClick={openUnlinkModal}
                            loading={orcidLoading}
                          >
                            Unlink
                          </Button>
                        </Group>
                      </Group>
                    </Card>
                  ) : (
                    <Stack gap="xs">
                      <TextInput
                        placeholder="0000-0000-0000-0000"
                        leftSection={<IconExternalLink size={16} />}
                        {...form.getInputProps('orcidId')}
                        disabled={orcidStatus?.verified}
                        rightSection={
                          <Button
                            size="xs"
                            variant="light"
                            onClick={handleVerifyOrcid}
                            loading={orcidLoading}
                            leftSection={<IconShieldCheck size={14} />}
                          >
                            Verify
                          </Button>
                        }
                        rightSectionWidth={80}
                      />
                      <Text size="xs" c="dimmed">
                        Click "Verify" to authenticate your ORCID through the official ORCID system.
                        This ensures your identifier is genuine and links to your verified academic profile.
                      </Text>
                    </Stack>
                  )}
                </Stack>

                <TextInput
                  label="Affiliation"
                  placeholder="Your institution, university, or organization"
                  leftSection={<IconBuilding size={16} />}
                  {...form.getInputProps('affiliation')}
                />

                <TextInput
                  label="Website"
                  placeholder="https://your-website.com"
                  leftSection={<IconWorld size={16} />}
                  {...form.getInputProps('website')}
                  description="Your personal website, lab page, or academic homepage"
                />
              </Stack>

              <Divider />

              {/* Actions */}
              <Group justify="flex-end" gap="md">
                <Button
                  variant="outline"
                  component={Link}
                  href="/profile"
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  loading={saving}
                  leftSection={<IconCheck size={16} />}
                >
                  Save Changes
                </Button>
              </Group>
            </Stack>
          </form>
        </Card>

        {/* ORCID Info Card */}
        <Card shadow="xs" padding="lg" radius="md" bg="blue.0">
          <Stack gap="xs">
            <Title order={4}>About ORCID Verification</Title>
            <Text size="sm">
              ORCID verification ensures your identifier is authentic and controlled by you. 
              We use ORCID's official OAuth system to verify your identity and maintain the integrity 
              of academic credentials on our platform.
            </Text>
            <Group>
              <Anchor
                href="https://orcid.org/register"
                target="_blank"
                size="sm"
              >
                Get ORCID iD
              </Anchor>
              <Text size="sm" c="dimmed">•</Text>
              <Anchor
                href="https://orcid.org/about"
                target="_blank"
                size="sm"
              >
                Learn More
              </Anchor>
            </Group>
          </Stack>
        </Card>
      </Stack>

      {/* Unlink ORCID Modal */}
      <Modal
        opened={unlinkModalOpened}
        onClose={closeUnlinkModal}
        title="Unlink ORCID Account"
        centered
      >
        <Stack gap="md">
          <Text>
            Are you sure you want to unlink your ORCID account? This will remove verification 
            and you'll need to verify again if you want to re-link it.
          </Text>
          <Group justify="flex-end" gap="xs">
            <Button variant="outline" onClick={closeUnlinkModal}>
              Cancel
            </Button>
            <Button
              color="red"
              onClick={handleUnlinkOrcid}
              loading={orcidLoading}
              leftSection={<IconUnlink size={16} />}
            >
              Unlink ORCID
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Container>
  );
}