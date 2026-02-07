'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import {
  Container,
  Title,
  Text,
  Card,
  TextInput,
  Button,
  Stack,
  Alert,
  Loader,
  Group
} from '@mantine/core';
import {
  IconUser,
  IconCheck,
  IconAlertCircle
} from '@tabler/icons-react';
import { useForm } from '@mantine/form';
import { API_URL } from '@/lib/api';

function ProfileCompleteContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isAuthenticated, loading: authLoading, refreshUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Get the return URL from query parameters
  const returnUrl = searchParams.get('returnUrl');

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/auth/login');
    }
  }, [authLoading, isAuthenticated, router]);

  // Redirect if user already has a name
  useEffect(() => {
    if (user?.name) {
      router.push(returnUrl || '/profile');
    }
  }, [user, router, returnUrl]);

  const form = useForm({
    initialValues: {
      name: ''
    },
    validate: {
      name: (value) => {
        if (!value || value.trim().length < 2) {
          return 'Name must be at least 2 characters long';
        }
        if (value.trim().length > 100) {
          return 'Name must be less than 100 characters';
        }
        return null;
      }
    }
  });

  const handleSubmit = async (values: { name: string }) => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${API_URL}/api/users/me`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          name: values.name.trim()
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update profile');
      }

      // Refresh user data in auth context
      await refreshUser();

      // Redirect to return URL or profile page
      router.push(returnUrl || '/profile');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred while updating your profile');
    } finally {
      setLoading(false);
    }
  };

  // Show loading state while checking authentication
  if (authLoading) {
    return (
      <Container size="sm" py="xl">
        <Stack align="center" gap="md">
          <Loader size="lg" />
          <Text>Loading...</Text>
        </Stack>
      </Container>
    );
  }

  // If not authenticated, don't render the form (will redirect)
  if (!isAuthenticated || !user) {
    return null;
  }

  // If user already has a name, don't render (will redirect)
  if (user.name) {
    return null;
  }

  return (
    <Container size="sm" py="xl">
      <Stack gap="xl">
        {/* Header */}
        <Stack gap="md" align="center">
          <IconUser size={48} color="blue" />
          <Title order={1} ta="center">Complete Your Profile</Title>
          <Text size="lg" c="dimmed" ta="center">
            Welcome to Colloquium! Please provide your name to complete your account setup.
          </Text>
        </Stack>

        {/* Error Alert */}
        {error && (
          <Alert icon={<IconAlertCircle size={16} />} color="red" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Profile Completion Form */}
        <Card shadow="sm" padding="xl" radius="md">
          <form onSubmit={form.onSubmit(handleSubmit)}>
            <Stack gap="lg">
              <Stack gap="md">
                <Text fw={500}>Account Information</Text>
                <TextInput
                  label="Email"
                  value={user.email}
                  disabled
                  description="Your email address cannot be changed"
                />
              </Stack>

              <Stack gap="md">
                <TextInput
                  label="Full Name"
                  placeholder="Enter your full name"
                  required
                  leftSection={<IconUser size={16} />}
                  {...form.getInputProps('name')}
                  description="This will be displayed on your publications and profile"
                />
              </Stack>

              <Group justify="flex-end">
                <Button
                  type="submit"
                  loading={loading}
                  leftSection={<IconCheck size={16} />}
                  size="lg"
                  disabled={!form.isValid()}
                >
                  Complete Profile
                </Button>
              </Group>
            </Stack>
          </form>
        </Card>

        {/* Help Text */}
        <Card shadow="sm" padding="md" radius="md" bg="blue.0">
          <Stack gap="xs">
            <Text size="sm" fw={500} c="blue.8">
              Why do we need your name?
            </Text>
            <Text size="sm" c="blue.7">
              Your name will be used for manuscript submissions, peer review assignments, 
              and to properly attribute your contributions to the scientific community.
            </Text>
          </Stack>
        </Card>
      </Stack>
    </Container>
  );
}

export default function ProfileCompletePage() {
  return (
    <Suspense fallback={
      <Container size="sm" py="xl">
        <Stack align="center" gap="md">
          <Loader size="lg" />
          <Text>Loading...</Text>
        </Stack>
      </Container>
    }>
      <ProfileCompleteContent />
    </Suspense>
  );
}