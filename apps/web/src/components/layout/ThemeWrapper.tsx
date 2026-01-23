'use client';

import { MantineProvider, useMantineColorScheme } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { ModalsProvider } from '@mantine/modals';
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';
import { useJournalSettings } from '@/contexts/JournalSettingsContext';
import { createDynamicTheme } from '@/lib/dynamicTheme';
import { useMemo, useEffect } from 'react';

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
      <MantineProvider theme={theme} defaultColorScheme="light">
        <ColorSchemeSync />
        <ModalsProvider>
          <Notifications />
          {children}
        </ModalsProvider>
      </MantineProvider>
    </ThemeProvider>
  );
}

function ColorSchemeSync() {
  const { colorScheme } = useTheme();
  const { setColorScheme } = useMantineColorScheme();

  useEffect(() => {
    setColorScheme(colorScheme);
  }, [colorScheme, setColorScheme]);

  return null;
}