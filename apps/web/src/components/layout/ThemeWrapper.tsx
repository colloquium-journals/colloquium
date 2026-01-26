'use client';

import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { ModalsProvider } from '@mantine/modals';
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';
import { useJournalSettings } from '@/contexts/JournalSettingsContext';
import { createDynamicTheme } from '@/lib/dynamicTheme';
import { useMemo } from 'react';

interface ThemeWrapperProps {
  children: React.ReactNode;
}

export function ThemeWrapper({ children }: ThemeWrapperProps) {
  const { settings, loading } = useJournalSettings();

  // Create dynamic theme based on journal settings (memoized to prevent unnecessary re-creation)
  const theme = useMemo(() => createDynamicTheme(
    settings.primaryColor,
    settings.secondaryColor
  ), [settings.primaryColor, settings.secondaryColor]);

  if (loading) {
    return (
      <MantineProvider>
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh'
        }}>
          Loading...
        </div>
      </MantineProvider>
    );
  }

  return (
    <ThemeProvider
      isDarkModeEnabled={settings.enableDarkMode}
      defaultTheme={settings.defaultTheme}
    >
      <MantineProviderWithTheme theme={theme}>
        <ModalsProvider>
          <Notifications />
          {children}
        </ModalsProvider>
      </MantineProviderWithTheme>
    </ThemeProvider>
  );
}

function MantineProviderWithTheme({
  children,
  theme
}: {
  children: React.ReactNode;
  theme: ReturnType<typeof createDynamicTheme>;
}) {
  const { colorScheme } = useTheme();

  return (
    <MantineProvider theme={theme} forceColorScheme={colorScheme}>
      {children}
    </MantineProvider>
  );
}