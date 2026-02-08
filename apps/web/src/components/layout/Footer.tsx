'use client';

import { Container, Group, Text, Anchor, Stack, Divider } from '@mantine/core';
import { useJournalSettings } from '@/contexts/JournalSettingsContext';
import { sanitizeHTML } from '@/lib/sanitize';

export function Footer() {
  const { settings } = useJournalSettings();

  const currentYear = new Date().getFullYear();

  return (
    <footer
      className="journal-footer"
      style={{
        marginTop: 'auto',
        marginLeft: 'calc(-1 * var(--mantine-spacing-md))',
        marginRight: 'calc(-1 * var(--mantine-spacing-md))',
        marginBottom: 'calc(-1 * var(--mantine-spacing-md))',
        padding: '2rem var(--mantine-spacing-md)'
      }}
    >
      <Container size="xl">
        <Stack gap="md">
          {/* Custom Footer Content */}
          {settings.customFooter && (
            <>
              <div dangerouslySetInnerHTML={{ __html: sanitizeHTML(settings.customFooter) }} />
              <Divider />
            </>
          )}
          
          {/* Standard Footer */}
          <Group justify="space-between" align="flex-start">
            <Stack gap="xs">
              <Text fw={500} className="journal-primary">
                {settings.name}
              </Text>
              {settings.publisherName && (
                <Text size="sm" c="dimmed">
                  Published by {settings.publisherName}
                  {settings.publisherLocation && ` • ${settings.publisherLocation}`}
                </Text>
              )}
              {settings.contactEmail && (
                <Anchor href={`mailto:${settings.contactEmail}`} size="sm">
                  {settings.contactEmail}
                </Anchor>
              )}
            </Stack>
            
            <Stack gap="xs" align="flex-end">
              <Text size="sm" c="dimmed">
                © {currentYear} {settings.publisherName || settings.name}
              </Text>
              {settings.publisherLocation && (
                <Text size="xs" c="dimmed">
                  {settings.publisherLocation}
                </Text>
              )}
              <Text size="xs" c="dimmed">
                Powered by Colloquium
              </Text>
            </Stack>
          </Group>
        </Stack>
      </Container>
    </footer>
  );
}