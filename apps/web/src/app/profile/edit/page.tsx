'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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
  Badge,
  Modal,
  ActionIcon,
  Table,
  Checkbox,
  Select,
} from '@mantine/core';
import {
  IconCheck,
  IconAlertCircle,
  IconExternalLink,
  IconUser,
  IconWorld,
  IconBuilding,
  IconAt,
  IconPlus,
  IconPencil,
  IconTrash,
  IconStar,
} from '@tabler/icons-react';
import { useForm } from '@mantine/form';
import { useDisclosure } from '@mantine/hooks';
import { COUNTRY_OPTIONS } from '@/lib/countries';
import { API_URL } from '@/lib/api';

interface ProfileFormData {
  name: string;
  username: string;
  bio: string;
  affiliation: string;
  website: string;
}

interface Affiliation {
  id: string;
  institution: string;
  department?: string;
  city?: string;
  state?: string;
  country: string;
  countryCode?: string;
  ror?: string;
  isPrimary: boolean;
}

interface AffiliationFormData {
  institution: string;
  department: string;
  city: string;
  state: string;
  country: string;
  countryCode: string;
  ror: string;
  isPrimary: boolean;
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
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
  const [originalUsername, setOriginalUsername] = useState('');
  const [affiliations, setAffiliations] = useState<Affiliation[]>([]);
  const [affiliationModalOpened, { open: openAffiliationModal, close: closeAffiliationModal }] = useDisclosure(false);
  const [editingAffiliation, setEditingAffiliation] = useState<Affiliation | null>(null);
  const [savingAffiliation, setSavingAffiliation] = useState(false);

  const form = useForm<ProfileFormData>({
    initialValues: {
      name: '',
      username: '',
      bio: '',
      affiliation: '',
      website: ''
    },
    validate: {
      name: (value) => value.trim().length === 0 ? 'Name is required' : null,
      username: (value) => {
        if (!value.trim()) return 'Username is required';
        if (!/^[a-z][a-z0-9-]{2,29}$/.test(value)) {
          return 'Must be 3-30 chars, start with a letter, and contain only lowercase letters, numbers, and hyphens';
        }
        if (value.startsWith('bot-')) {
          return 'Usernames starting with "bot-" are reserved for system bots';
        }
        return null;
      },
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

  const affiliationForm = useForm<AffiliationFormData>({
    initialValues: {
      institution: '',
      department: '',
      city: '',
      state: '',
      country: '',
      countryCode: '',
      ror: '',
      isPrimary: false
    },
    validate: {
      institution: (value) => value.trim().length === 0 ? 'Institution is required' : null,
      country: (value) => value.trim().length === 0 ? 'Country is required' : null,
      ror: (value) => {
        if (!value) return null;
        try {
          new URL(value);
          return null;
        } catch {
          return 'ROR must be a valid URL';
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
        const profileResponse = await fetch(`${API_URL}/api/users/me`, { credentials: 'include' });

        if (!profileResponse.ok) {
          throw new Error('Failed to fetch profile');
        }

        const profile = await profileResponse.json();

        setOrcidId(profile.orcidId || null);
        setOrcidVerified(profile.orcidVerified || false);
        setOriginalUsername(profile.username || '');
        setAffiliations(profile.affiliations || []);

        form.setValues({
          name: profile.name || '',
          username: profile.username || '',
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


  const isDirtyRef = useRef(false);
  isDirtyRef.current = form.isDirty();

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirtyRef.current) {
        e.preventDefault();
      }
    };

    const handleClick = (e: MouseEvent) => {
      if (!isDirtyRef.current) return;
      const anchor = (e.target as HTMLElement).closest('a');
      if (!anchor) return;
      const href = anchor.getAttribute('href');
      if (!href || href.startsWith('#')) return;
      // Only guard internal navigation
      if (anchor.target === '_blank') return;
      try {
        const url = new URL(href, window.location.origin);
        if (url.origin !== window.location.origin) return;
      } catch {
        return;
      }
      if (!window.confirm('You have unsaved changes. Discard them?')) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    document.addEventListener('click', handleClick, true);
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      document.removeEventListener('click', handleClick, true);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  const handleOpenAffiliationModal = (affiliation?: Affiliation) => {
    if (affiliation) {
      setEditingAffiliation(affiliation);
      affiliationForm.setValues({
        institution: affiliation.institution,
        department: affiliation.department || '',
        city: affiliation.city || '',
        state: affiliation.state || '',
        country: affiliation.country,
        countryCode: affiliation.countryCode || '',
        ror: affiliation.ror || '',
        isPrimary: affiliation.isPrimary
      });
    } else {
      setEditingAffiliation(null);
      affiliationForm.reset();
    }
    openAffiliationModal();
  };

  const handleSaveAffiliation = async (values: AffiliationFormData) => {
    try {
      setSavingAffiliation(true);
      setError(null);

      const countryOption = COUNTRY_OPTIONS.find(c => c.value === values.countryCode || c.label === values.country);
      const payload = {
        institution: values.institution.trim(),
        department: values.department.trim() || undefined,
        city: values.city.trim() || undefined,
        state: values.state.trim() || undefined,
        country: countryOption?.label || values.country.trim(),
        countryCode: countryOption?.value || values.countryCode || undefined,
        ror: values.ror.trim() || undefined,
        isPrimary: values.isPrimary
      };

      const url = editingAffiliation
        ? `${API_URL}/api/users/me/affiliations/${editingAffiliation.id}`
        : `${API_URL}/api/users/me/affiliations`;

      const response = await fetch(url, {
        method: editingAffiliation ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to save affiliation');
      }

      // Refresh affiliations list
      const affiliationsResponse = await fetch(`${API_URL}/api/users/me/affiliations`, {
        credentials: 'include'
      });
      if (affiliationsResponse.ok) {
        const affiliationsData = await affiliationsResponse.json();
        setAffiliations(affiliationsData.affiliations);
      }

      closeAffiliationModal();
      setSuccess(editingAffiliation ? 'Affiliation updated successfully!' : 'Affiliation added successfully!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save affiliation');
    } finally {
      setSavingAffiliation(false);
    }
  };

  const handleDeleteAffiliation = async (affiliationId: string) => {
    if (!window.confirm('Are you sure you want to remove this affiliation?')) {
      return;
    }

    try {
      setError(null);
      const response = await fetch(`${API_URL}/api/users/me/affiliations/${affiliationId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to remove affiliation');
      }

      setAffiliations(affiliations.filter(a => a.id !== affiliationId));
      setSuccess('Affiliation removed successfully!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove affiliation');
    }
  };

  const handleCancel = useCallback(() => {
    if (form.isDirty()) {
      if (!window.confirm('You have unsaved changes. Discard them?')) {
        return;
      }
    }
    router.push('/profile');
  }, [form, router]);

  const handleSubmit = async (values: ProfileFormData) => {
    if (usernameStatus === 'taken') {
      setError('Username is already taken. Please choose a different one.');
      return;
    }
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

      const response = await fetch(`${API_URL}/api/users/me`, {
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
      const response = await fetch(`${API_URL}/api/auth/orcid`, {
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



  const checkUsernameAvailability = async () => {
    const username = form.values.username;
    if (!username || username === originalUsername) {
      setUsernameStatus('idle');
      return;
    }
    if (!/^[a-z][a-z0-9-]{2,29}$/.test(username)) {
      setUsernameStatus('idle');
      return;
    }
    setUsernameStatus('checking');
    try {
      const response = await fetch(`${API_URL}/api/users/check-username/${username}`, {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setUsernameStatus(data.available ? 'available' : 'taken');
      } else {
        setUsernameStatus('idle');
      }
    } catch {
      setUsernameStatus('idle');
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
          <Title order={1}>Edit Profile</Title>
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
            <Stack gap="md">

                <TextInput
                  label="Full Name"
                  placeholder="Your full name"
                  leftSection={<IconUser size={16} />}
                  required
                  {...form.getInputProps('name')}
                />

                <TextInput
                  label="Username"
                  placeholder="your-username"
                  leftSection={<IconAt size={16} />}
                  required
                  description="Used for @mentions. Lowercase letters, numbers, and hyphens only."
                  rightSection={
                    usernameStatus === 'checking' ? <Loader size={14} /> :
                    usernameStatus === 'available' ? <IconCheck size={16} color="green" /> :
                    usernameStatus === 'taken' ? <IconAlertCircle size={16} color="red" /> :
                    null
                  }
                  {...form.getInputProps('username')}
                  error={usernameStatus === 'taken' ? 'Username is already taken' : form.getInputProps('username').error}
                  onBlur={(e) => {
                    form.getInputProps('username').onBlur(e);
                    checkUsernameAvailability();
                  }}
                  onChange={(e) => {
                    form.getInputProps('username').onChange(e);
                    setUsernameStatus('idle');
                  }}
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
                        href={`${API_URL}/api/auth/orcid`}
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
                  label="Primary Affiliation (Simple)"
                  placeholder="Your institution, university, or organization"
                  leftSection={<IconBuilding size={16} />}
                  {...form.getInputProps('affiliation')}
                  description="Quick text field. Use structured affiliations below for detailed info."
                />

                {/* Structured Affiliations Section */}
                <Stack gap="xs">
                  <Group justify="space-between">
                    <Text fw={500} size="sm">Structured Affiliations</Text>
                    <Button
                      size="xs"
                      variant="light"
                      leftSection={<IconPlus size={14} />}
                      onClick={() => handleOpenAffiliationModal()}
                    >
                      Add Affiliation
                    </Button>
                  </Group>
                  <Text size="xs" c="dimmed">
                    Add detailed affiliations with institution, department, and ROR identifiers for improved metadata.
                  </Text>
                  {affiliations.length > 0 ? (
                    <Table highlightOnHover>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>Institution</Table.Th>
                          <Table.Th>Location</Table.Th>
                          <Table.Th style={{ width: 100 }}>Actions</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {affiliations.map((aff) => (
                          <Table.Tr key={aff.id}>
                            <Table.Td>
                              <Stack gap={2}>
                                <Group gap="xs">
                                  <Text size="sm">{aff.institution}</Text>
                                  {aff.isPrimary && (
                                    <Badge size="xs" color="blue" variant="light" leftSection={<IconStar size={10} />}>
                                      Primary
                                    </Badge>
                                  )}
                                </Group>
                                {aff.department && (
                                  <Text size="xs" c="dimmed">{aff.department}</Text>
                                )}
                                {aff.ror && (
                                  <Anchor href={aff.ror} target="_blank" size="xs">
                                    ROR <IconExternalLink size={10} />
                                  </Anchor>
                                )}
                              </Stack>
                            </Table.Td>
                            <Table.Td>
                              <Text size="sm">
                                {[aff.city, aff.state, aff.country].filter(Boolean).join(', ')}
                              </Text>
                            </Table.Td>
                            <Table.Td>
                              <Group gap="xs">
                                <ActionIcon
                                  variant="subtle"
                                  size="sm"
                                  onClick={() => handleOpenAffiliationModal(aff)}
                                >
                                  <IconPencil size={14} />
                                </ActionIcon>
                                <ActionIcon
                                  variant="subtle"
                                  color="red"
                                  size="sm"
                                  onClick={() => handleDeleteAffiliation(aff.id)}
                                >
                                  <IconTrash size={14} />
                                </ActionIcon>
                              </Group>
                            </Table.Td>
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
                  ) : (
                    <Text size="sm" c="dimmed" ta="center" py="md">
                      No structured affiliations added yet.
                    </Text>
                  )}
                </Stack>

                <TextInput
                  label="Website"
                  placeholder="https://your-website.com"
                  leftSection={<IconWorld size={16} />}
                  {...form.getInputProps('website')}
                  description="Your personal website, lab page, or academic homepage"
                />

              {/* Actions */}
              <Group justify="flex-end" gap="md">
                <Button
                  variant="outline"
                  onClick={handleCancel}
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

      </Stack>

      {/* Affiliation Modal */}
      <Modal
        opened={affiliationModalOpened}
        onClose={closeAffiliationModal}
        title={editingAffiliation ? 'Edit Affiliation' : 'Add Affiliation'}
        size="lg"
      >
        <form onSubmit={affiliationForm.onSubmit(handleSaveAffiliation)}>
          <Stack gap="md">
            <TextInput
              label="Institution"
              placeholder="e.g., Stanford University"
              required
              {...affiliationForm.getInputProps('institution')}
            />

            <TextInput
              label="Department"
              placeholder="e.g., Department of Psychology"
              {...affiliationForm.getInputProps('department')}
            />

            <Group grow>
              <TextInput
                label="City"
                placeholder="e.g., Stanford"
                {...affiliationForm.getInputProps('city')}
              />
              <TextInput
                label="State/Province"
                placeholder="e.g., CA"
                {...affiliationForm.getInputProps('state')}
              />
            </Group>

            <Select
              label="Country"
              placeholder="Select a country"
              data={COUNTRY_OPTIONS}
              searchable
              required
              value={affiliationForm.values.countryCode}
              onChange={(value) => {
                affiliationForm.setFieldValue('countryCode', value || '');
                const country = COUNTRY_OPTIONS.find(c => c.value === value);
                affiliationForm.setFieldValue('country', country?.label || '');
              }}
              error={affiliationForm.errors.country}
            />

            <TextInput
              label="ROR ID"
              placeholder="e.g., https://ror.org/00f54p054"
              description="Research Organization Registry identifier (optional)"
              {...affiliationForm.getInputProps('ror')}
            />

            <Checkbox
              label="Set as primary affiliation"
              {...affiliationForm.getInputProps('isPrimary', { type: 'checkbox' })}
            />

            <Group justify="flex-end" gap="md">
              <Button variant="outline" onClick={closeAffiliationModal}>
                Cancel
              </Button>
              <Button type="submit" loading={savingAffiliation}>
                {editingAffiliation ? 'Update' : 'Add'} Affiliation
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

    </Container>
  );
}