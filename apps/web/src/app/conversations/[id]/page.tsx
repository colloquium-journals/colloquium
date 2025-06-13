'use client';

import { Container, Title, Text, Paper, Stack } from '@mantine/core';
import { ConversationThread } from '@/components/conversations/ConversationThread';
import { useParams } from 'next/navigation';

export default function ConversationPage() {
  const params = useParams();
  const conversationId = params.id as string;

  return (
    <Container size="lg" py="xl">
      <Stack gap="lg">
        <Paper shadow="sm" p="md" radius="md">
          <Title order={2} mb="xs">
            Conversation Thread
          </Title>
          <Text size="sm" c="dimmed">
            Conversational review for academic manuscript
          </Text>
        </Paper>

        <ConversationThread conversationId={conversationId} />
      </Stack>
    </Container>
  );
}