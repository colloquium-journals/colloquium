'use client';

import { Suspense } from 'react';
import { Container, Stack, Loader, Center } from '@mantine/core';
import { MagicLinkVerification } from '@/components/auth/MagicLinkVerification';

function VerificationContent() {
  return (
    <Container size="sm" py="xl">
      <Stack gap="xl" justify="center" style={{ minHeight: '60vh' }}>
        <MagicLinkVerification />
      </Stack>
    </Container>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={
      <Container size="sm" py="xl">
        <Center style={{ minHeight: '60vh' }}>
          <Loader size="lg" />
        </Center>
      </Container>
    }>
      <VerificationContent />
    </Suspense>
  );
}