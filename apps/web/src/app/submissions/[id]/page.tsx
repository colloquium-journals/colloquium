'use client';

import { Container, Title, Text, Paper, Stack } from '@mantine/core';
import { ConversationThread } from '@/components/conversations/ConversationThread';
import { VisibilityLegend } from '@/components/conversations/VisibilityLegend';
import { useParams } from 'next/navigation';

export default function SubmissionPage() {
  const params = useParams();
  const submissionId = params.id as string;

  return (
    <Container size="lg" py="xl">
      <Stack gap="lg">
        <Paper shadow="sm" p="md" radius="md">
          <Title order={2} mb="xs">
            Submission Discussion
          </Title>
          <Text size="sm" c="dimmed">
            Manuscript discussion and review thread
          </Text>
        </Paper>

        <VisibilityLegend variant="compact" />
        
        <ConversationThread conversationId={submissionId} />
      </Stack>
    </Container>
  );
}