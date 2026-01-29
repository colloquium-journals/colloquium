'use client';

import { Container, Stack, Box } from '@mantine/core';
import { useParams } from 'next/navigation';
import { SubmissionHeader, ConversationSection } from '@/components/submissions';

export default function SubmissionPage() {
  const params = useParams();
  const submissionId = params.id as string;

  return (
    <Box style={{ backgroundColor: 'var(--mantine-color-body)', minHeight: '100vh' }}>
      <Container size="lg" py="xl">
        <Stack gap="xl">
          {/* Detailed Submission Header */}
          <SubmissionHeader submissionId={submissionId} />
          
          {/* Discussion Section - Bot-Centric Interactions */}
          <ConversationSection 
            conversationId={submissionId}
            title="Peer Review Discussion"
            description="Use @bot-name commands to interact with editorial bots, request reviews, or get assistance"
          />
        </Stack>
      </Container>
    </Box>
  );
}