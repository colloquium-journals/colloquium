'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { LoginForm } from '@/components/auth/LoginForm';
import { Stack, Container } from '@mantine/core';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get('redirect');

  const handleSuccess = () => {
    // LoginForm already handles success state internally
  };

  return (
    <Container size="sm" py="xl">
      <Stack gap="xl" justify="center" style={{ minHeight: '60vh' }}>
        <LoginForm 
          onSuccess={handleSuccess}
          redirectUrl={redirectUrl || undefined}
        />
      </Stack>
    </Container>
  );
}