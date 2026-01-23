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
} from '@mantine/core';
import {
  IconCheck,
  IconAlertCircle,
  IconExternalLink,
  IconUser,
  IconWorld,
  IconBuilding,
  IconAt,
} from '@tabler/icons-react';
import { useForm } from '@mantine/form';
import Link from 'next/link';

interface ProfileFormData {
  name: string;
  bio: string;
  affiliation: string;
  website: string;
}


export default function EditProfilePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isAuthenticated, refreshUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [orcidId, setOrcidId] = useState<string | null>(null);
  const [orcidVerified, setOrcidVerified] = useState(false);
  const [unlinking, setUnlinking] = useState(false);

  const form = useForm<ProfileFormData>({
    initialValues: {
      name: '',
      bio: '',
      affiliation: '',
      website: ''
    },
    validate: {
      name: (value) => value.trim().length === 0 ? 'Name is required' : null,
      bio: (value) => value.length > 1000 ? 'Bio must be less than 1000 characters' : null,
      affiliation: (value) => value.length > 200 ? 'Affiliation must be less than 200 characters' : null,
      website: (value) => {
        if (!value) return null;
        try {
          new URL(value);
          return null;
        } catch {
          return 'Please enter a valid URL (including http:// or https://)';
        }
      }
    }
  });


  useEffect(() => {
    // Handle ORCID OAuth callback query params
    const orcidStatus = searchParams.get('orcid');
    if (orcidStatus === 'verified') {
      setSuccess('ORCID verified successfully!');
    } else if (orcidStatus === 'error') {
      const reason = searchParams.get('reason');
      const messages: Record<string, string> = {
        denied: 'ORCID authorization was denied.',
        invalid_state: 'Invalid session state. Please try again.',
        session_expired: 'Session expired. Please try again.',
        already_claimed: 'This ORCID is already linked to another account.',
        exchange_failed: 'Failed to verify with ORCID. Please try again.',
        not_configured: 'ORCID integration is not configured.',
      };
      setError(messages[reason || ''] || 'ORCID verification failed.');
    }
  }, [searchParams]);

  useEffect(() => {
    const fetchCurrentProfile = async () => {
      if (!isAuthenticated) {
        setLoading(false);
        return;
      }

      try {
        const profileResponse = await fetch('http://localhost:4000/api/users/me', { credentials: 'include' });

        if (!profileResponse.ok) {
          throw new Error('Failed to fetch profile');
        }

        const profile = await profileResponse.json();

        setOrcidId(profile.orcidId || null);
        setOrcidVerified(profile.orcidVerified || false);

        form.setValues({
          name: profile.name || '',
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


  const handleSubmit = async (values: ProfileFormData) => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      // Only send non-empty values
      const updateData: Partial<ProfileFormData> = {};
      Object.entries(values).forEach(([key, value]) => {
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

  const handleUnlinkOrcid = async () => {
    try {
      setUnlinking(true);
      const response = await fetch('http://localhost:4000/api/auth/orcid', {
        method: 'DELETE',
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to unlink ORCID');
      }

      setOrcidId(null);
      setOrcidVerified(false);
      setSuccess('ORCID unlinked successfully.');
      await refreshUser();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to unlink ORCID');
    } finally {
      setUnlinking(false);
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
                  <Text fw={500} size="sm">ORCID iD</Text>
                  {orcidId && orcidVerified ? (
                    <Group gap="sm">
                      <Badge color="green" variant="light" leftSection={<IconCheck size={12} />}>
                        Verified
                      </Badge>
                      <Anchor
                        href={`https://orcid.org/${orcidId}`}
                        target="_blank"
                        size="sm"
                      >
                        {orcidId}
                        <IconExternalLink size={12} style={{ marginLeft: 4 }} />
                      </Anchor>
                      <Button
                        variant="subtle"
                        color="red"
                        size="xs"
                        onClick={handleUnlinkOrcid}
                        loading={unlinking}
                      >
                        Unlink
                      </Button>
                    </Group>
                  ) : (
                    <Group gap="sm">
                      <Button
                        variant="light"
                        component="a"
                        href="http://localhost:4000/api/auth/orcid"
                        leftSection={<IconExternalLink size={16} />}
                      >
                        Link ORCID
                      </Button>
                      <Text size="xs" c="dimmed">
                        Verify your identity via ORCID OAuth
                      </Text>
                    </Group>
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

    </Container>
  );
}