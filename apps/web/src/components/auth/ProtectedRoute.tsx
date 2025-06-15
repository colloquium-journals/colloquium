'use client';

import { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Container, Paper, Title, Text, Button, Stack, Alert } from '@mantine/core';
import { IconLogin, IconShieldX } from '@tabler/icons-react';

interface ProtectedRouteProps {
  children: ReactNode;
  requireAuth?: boolean;
  allowedRoles?: string[];
  fallbackPath?: string;
  showFallback?: boolean;
}

export function ProtectedRoute({ 
  children, 
  requireAuth = true, 
  allowedRoles = [], 
  fallbackPath = '/auth/login',
  showFallback = true 
}: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const router = useRouter();

  // Show loading while checking authentication
  if (loading) {
    return (
      <Container size="sm" py="xl">
        <Paper shadow="sm" p="xl" radius="md" ta="center">
          <Text>Loading...</Text>
        </Paper>
      </Container>
    );
  }

  // Check if authentication is required
  if (requireAuth && !user) {
    if (!showFallback) {
      router.push(fallbackPath);
      return null;
    }

    return (
      <Container size="sm" py="xl">
        <Paper shadow="sm" p="xl" radius="md" ta="center">
          <Stack align="center" gap="md">
            <IconLogin size={48} color="gray" />
            <Title order={2}>Authentication Required</Title>
            <Text c="dimmed">You need to be logged in to access this page.</Text>
            <Button 
              leftSection={<IconLogin size={16} />}
              onClick={() => router.push(fallbackPath)}
            >
              Sign In
            </Button>
          </Stack>
        </Paper>
      </Container>
    );
  }

  // Check role-based access
  if (user && allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    if (!showFallback) {
      router.push('/');
      return null;
    }

    return (
      <Container size="sm" py="xl">
        <Paper shadow="sm" p="xl" radius="md" ta="center">
          <Stack align="center" gap="md">
            <IconShieldX size={48} color="red" />
            <Title order={2}>Access Denied</Title>
            <Text c="dimmed">
              You don't have permission to access this page. Required role: {allowedRoles.join(' or ')}
            </Text>
            <Alert color="red" variant="light">
              Your current role: <strong>{user.role}</strong>
            </Alert>
            <Button onClick={() => router.push('/')}>
              Go to Home
            </Button>
          </Stack>
        </Paper>
      </Container>
    );
  }

  // User has access, render the protected content
  return <>{children}</>;
}

// Convenience components for specific access levels
export function AdminRoute({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute allowedRoles={['ADMIN']}>
      {children}
    </ProtectedRoute>
  );
}

export function EditorRoute({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute allowedRoles={['ADMIN', 'EDITOR']}>
      {children}
    </ProtectedRoute>
  );
}

export function AuthenticatedRoute({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute requireAuth={true}>
      {children}
    </ProtectedRoute>
  );
}

export function PublicRoute({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute requireAuth={false}>
      {children}
    </ProtectedRoute>
  );
}