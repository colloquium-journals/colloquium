import { Title, Text, Button, Stack, Card, Group } from '@mantine/core';
import { IconBook, IconUsers, IconRocket } from '@tabler/icons-react';
import Link from 'next/link';

export default function HomePage() {
  return (
    <Stack align="center" gap="xl" py="xl">
        <Stack align="center" gap="md">
          <Title order={1} size="3rem" ta="center" c="academic.8">
            Colloquium
          </Title>
          <Text size="xl" ta="center" c="dimmed" maw={600}>
            Open-source scientific journal publishing platform that democratizes academic publishing
            through conversational review and extensible bot automation.
          </Text>
        </Stack>

        <Group gap="md" mt="xl">
          <Button size="lg" leftSection={<IconRocket size={20} />} component={Link} href="/dashboard">
            Get Started
          </Button>
          <Button size="lg" variant="outline" leftSection={<IconBook size={20} />} component={Link} href="/manuscripts">
            Browse Articles
          </Button>
        </Group>

        <Stack gap="md" mt="xl" w="100%">
          <Title order={2} ta="center" mb="md">
            Key Features
          </Title>
          
          <Group grow align="flex-start">
            <Card shadow="sm" padding="lg" radius="md">
              <Stack align="center" ta="center">
                <IconUsers size={48} color="var(--mantine-color-blue-6)" />
                <Title order={3} size="h4">
                  Conversational Review
                </Title>
                <Text size="sm" c="dimmed">
                  All review processes happen in structured chat environments with 
                  granular privacy controls and community participation.
                </Text>
              </Stack>
            </Card>

            <Card shadow="sm" padding="lg" radius="md">
              <Stack align="center" ta="center">
                <IconRocket size={48} color="var(--mantine-color-green-6)" />
                <Title order={3} size="h4">
                  Bot Ecosystem
                </Title>
                <Text size="sm" c="dimmed">
                  Extensible plugin architecture for automated plagiarism detection,
                  statistical analysis, formatting, and workflow management.
                </Text>
              </Stack>
            </Card>

            <Card shadow="sm" padding="lg" radius="md">
              <Stack align="center" ta="center">
                <IconBook size={48} color="var(--mantine-color-violet-6)" />
                <Title order={3} size="h4">
                  Self-Sovereign
                </Title>
                <Text size="sm" c="dimmed">
                  Journals own their data and make their own governance decisions.
                  Self-hosting with optional managed hosting available.
                </Text>
              </Stack>
            </Card>
          </Group>
        </Stack>
      </Stack>
  );
}