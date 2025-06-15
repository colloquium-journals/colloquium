'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
  Divider
} from '@mantine/core';
import {
  IconCheck,
  IconAlertCircle,
  IconExternalLink,
  IconUser,
  IconWorld,
  IconBuilding,
  IconAt
} from '@tabler/icons-react';
import { useForm } from '@mantine/form';
import Link from 'next/link';

interface ProfileFormData {
  name: string;
  orcidId: string;
  bio: string;
  affiliation: string;
  website: string;
}

export default function EditProfilePage() {
  const router = useRouter();
  const { user, isAuthenticated, refreshUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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

  useEffect(() => {
    const fetchCurrentProfile = async () => {
      if (!isAuthenticated) {
        setLoading(false);
        return;
      }

      try {
        const response = await fetch('http://localhost:4000/api/users/me', {
          credentials: 'include'
        });

        if (!response.ok) {
          throw new Error('Failed to fetch profile');
        }

        const profile = await response.json();
        
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

  const formatORCIDUrl = (orcidId: string) => {
    return `https://orcid.org/${orcidId}`;
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
                
                <TextInput
                  label="ORCID iD"
                  placeholder="0000-0000-0000-0000"
                  leftSection={<IconExternalLink size={16} />}
                  {...form.getInputProps('orcidId')}
                  description={
                    <Group gap="xs">
                      <Text size="xs" c="dimmed">
                        Your ORCID identifier helps verify your academic identity.
                      </Text>
                      {form.values.orcidId && (
                        <>
                          <Text size="xs">•</Text>
                          <Anchor
                            href={formatORCIDUrl(form.values.orcidId)}
                            target="_blank"
                            size="xs"
                          >
                            View ORCID Profile
                          </Anchor>
                        </>
                      )}
                    </Group>
                  }
                />

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
            <Title order={4}>About ORCID</Title>
            <Text size="sm">
              ORCID provides a persistent digital identifier that distinguishes you from other researchers 
              and connects you to your contributions across research and scholarly activities.
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