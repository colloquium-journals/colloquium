'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Container, Stack, Loader, Text, Alert, Button } from '@mantine/core';
import { IconUser, IconExclamationMark } from '@tabler/icons-react';
import Link from 'next/link';

interface RequireProfileCompletionProps {
  children: React.ReactNode;
  message?: string;
  redirectTo?: string;
}

export function RequireProfileCompletion({ 
  children, 
  message = "Please complete your profile to access this feature.",
  redirectTo = "/profile/complete"
}: RequireProfileCompletionProps) {
  const router = useRouter();
  const { user, isAuthenticated, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/auth/login');
    }
  }, [authLoading, isAuthenticated, router]);

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

  // If not authenticated, don't render (will redirect)
  if (!isAuthenticated || !user) {
    return null;
  }

  // If user doesn't have a name, show profile completion prompt
  if (!user.name) {
    return (
      <Container size="sm" py="xl">
        <Stack gap="xl" align="center">
          <IconUser size={48} color="orange" />
          
          <Alert 
            icon={<IconExclamationMark size={16} />} 
            color="orange" 
            title="Profile Completion Required"
            style={{ textAlign: 'center' }}
          >
            {message}
          </Alert>

          <Stack gap="md" align="center">
            <Text ta="center" c="dimmed">
              You need to add your name to your profile before you can access this feature.
            </Text>
            
            <Button
              component={Link}
              href={redirectTo}
              leftSection={<IconUser size={16} />}
              size="lg"
            >
              Complete Profile
            </Button>
          </Stack>
        </Stack>
      </Container>
    );
  }

  // User has completed profile, render children
  return <>{children}</>;
}