'use client';

import { useState } from 'react';
import {
  Card,
  Title,
  Text,
  TextInput,
  Button,
  Stack,
  Alert,
  Group,
  Anchor
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconMail, IconCheck, IconAlertCircle } from '@tabler/icons-react';

interface LoginFormProps {
  onSuccess?: () => void;
  redirectUrl?: string;
}

interface LoginFormData {
  email: string;
}

export function LoginForm({ onSuccess, redirectUrl }: LoginFormProps) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [magicLinkUrl, setMagicLinkUrl] = useState<string | null>(null);

  const form = useForm<LoginFormData>({
    initialValues: {
      email: ''
    },
    validate: {
      email: (value) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(value) ? null : 'Please enter a valid email address';
      }
    }
  });

  const handleSubmit = async (values: LoginFormData) => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('http://localhost:4000/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: values.email,
          redirectUrl
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to send magic link');
      }

      setSuccess(true);
      
      // In development, show the magic link for testing
      if (data.magicLinkUrl) {
        setMagicLinkUrl(data.magicLinkUrl);
      }

      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <Card shadow="sm" padding="xl" radius="md" style={{ maxWidth: 400, margin: '0 auto' }}>
        <Stack align="center" gap="md">
          <IconCheck size={64} color="green" />
          <Title order={2} ta="center">Check Your Email</Title>
          <Text ta="center" c="dimmed">
            We've sent a magic link to <strong>{form.values.email}</strong>. 
            Click the link in your email to sign in.
          </Text>
          
          {magicLinkUrl && (
            <Alert color="blue" title="Development Mode">
              <Text size="sm" mb="xs">
                For testing purposes, here's your magic link:
              </Text>
              <Anchor 
                href={magicLinkUrl} 
                target="_blank"
                size="sm"
                style={{ wordBreak: 'break-all' }}
              >
                {magicLinkUrl}
              </Anchor>
            </Alert>
          )}

          <Group gap="xs">
            <Text size="sm" c="dimmed">
              Didn't receive the email?
            </Text>
            <Button 
              variant="subtle" 
              size="sm"
              onClick={() => {
                setSuccess(false);
                setError(null);
                form.reset();
              }}
            >
              Try again
            </Button>
          </Group>
        </Stack>
      </Card>
    );
  }

  return (
    <Card shadow="sm" padding="xl" radius="md" style={{ maxWidth: 400, margin: '0 auto' }}>
      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="md">
          <Stack gap="xs" align="center">
            <Title order={2}>Sign in to Colloquium</Title>
            <Text size="sm" c="dimmed" ta="center">
              Enter your email address and we'll send you a magic link to sign in
            </Text>
          </Stack>

          {error && (
            <Alert icon={<IconAlertCircle size={16} />} color="red">
              {error}
            </Alert>
          )}

          <TextInput
            label="Email Address"
            placeholder="your.email@example.com"
            leftSection={<IconMail size={16} />}
            required
            {...form.getInputProps('email')}
          />

          <Button
            type="submit"
            loading={loading}
            fullWidth
            size="md"
          >
            Send Magic Link
          </Button>

          <Text size="xs" c="dimmed" ta="center">
            By signing in, you agree to our terms of service and privacy policy.
          </Text>
        </Stack>
      </form>
    </Card>
  );
}