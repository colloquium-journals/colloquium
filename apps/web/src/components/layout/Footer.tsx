'use client';

import { Container, Group, Text, Anchor, Stack, Divider } from '@mantine/core';
import { useJournalSettings } from '@/contexts/JournalSettingsContext';

export function Footer() {
  const { settings } = useJournalSettings();
  
  const currentYear = new Date().getFullYear();
  
  return (
    <footer className="journal-footer" style={{ 
      marginTop: 'auto',
      padding: '2rem 0'
    }}>
      <Container size="xl">
        <Stack gap="md">
          {/* Custom Footer Content */}
          {settings.customFooter && (
            <>
              <div dangerouslySetInnerHTML={{ __html: settings.customFooter }} />
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
                © {currentYear} {settings.copyrightHolder || settings.name}
              </Text>
              {settings.licenseType && (
                <Text size="xs" c="dimmed">
                  Licensed under {settings.licenseType}
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