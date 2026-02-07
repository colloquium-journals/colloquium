'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';
import {
  Card,
  Title,
  Text,
  Button,
  Stack,
  Alert,
  Loader,
  Center
} from '@mantine/core';
import { IconCheck, IconAlertCircle, IconX } from '@tabler/icons-react';
import { API_URL } from '@/lib/api';

interface User {
  id: string;
  email: string;
  name: string | null;
  role: string;
}

interface MagicLinkVerificationProps {
  onSuccess?: (user: User) => void;
}

export function MagicLinkVerification({ onSuccess }: MagicLinkVerificationProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refreshUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null);

  useEffect(() => {
    const verifyMagicLink = async () => {
      const token = searchParams.get('token');
      const email = searchParams.get('email');

      if (!token || !email) {
        setError('Invalid magic link. Missing token or email.');
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(
          `${API_URL}/api/auth/verify?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`,
          {
            method: 'GET',
            credentials: 'include' // Include cookies
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || 'Failed to verify magic link');
        }

        setUser(data.user);
        setRedirectUrl(data.redirectUrl);
        setSuccess(true);

        // Store token in localStorage as backup (cookies are primary)
        if (data.token) {
          localStorage.setItem('auth-token', data.token);
        }

        // Update AuthContext with the new user state
        await refreshUser();

        if (onSuccess) {
          onSuccess(data.user);
        }

        // Redirect after a short delay
        setTimeout(() => {
          router.push(data.redirectUrl || '/profile');
        }, 2000);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred during verification');
      } finally {
        setLoading(false);
      }
    };

    verifyMagicLink();
  }, [searchParams, router, onSuccess]);

  if (loading) {
    return (
      <Card shadow="sm" padding="xl" radius="md" style={{ maxWidth: 400, margin: '0 auto' }}>
        <Center>
          <Stack align="center" gap="md">
            <Loader size="lg" />
            <Title order={3}>Verifying your magic link...</Title>
            <Text size="sm" c="dimmed" ta="center">
              Please wait while we sign you in
            </Text>
          </Stack>
        </Center>
      </Card>
    );
  }

  if (success && user) {
    return (
      <Card shadow="sm" padding="xl" radius="md" style={{ maxWidth: 400, margin: '0 auto' }}>
        <Stack align="center" gap="md">
          <IconCheck size={64} color="green" />
          <Title order={2} ta="center">Welcome back!</Title>
          <Text ta="center" c="dimmed">
            Successfully signed in as <strong>{user.email}</strong>
          </Text>
          <Text size="sm" c="dimmed" ta="center">
            Redirecting you back to where you left off...
          </Text>
          <Button 
            onClick={() => {
              router.push(redirectUrl || '/profile');
            }}
            variant="outline"
          >
            Continue
          </Button>
        </Stack>
      </Card>
    );
  }

  if (error) {
    return (
      <Card shadow="sm" padding="xl" radius="md" style={{ maxWidth: 400, margin: '0 auto' }}>
        <Stack align="center" gap="md">
          <IconX size={64} color="red" />
          <Title order={2} ta="center">Verification Failed</Title>
          <Alert icon={<IconAlertCircle size={16} />} color="red">
            {error}
          </Alert>
          <Text size="sm" c="dimmed" ta="center">
            This magic link may have expired or already been used.
          </Text>
          <Button 
            onClick={() => router.push('/auth/login')}
            fullWidth
          >
            Request New Magic Link
          </Button>
        </Stack>
      </Card>
    );
  }

  return null;
}