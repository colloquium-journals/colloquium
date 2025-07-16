'use client';

import { MantineProvider, ColorSchemeScript } from '@mantine/core';
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
    // Show a minimal loading state while settings load
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
    <>
      <ColorSchemeScript />
      <ThemeProvider 
        isDarkModeEnabled={settings.enableDarkMode}
        defaultTheme={settings.defaultTheme}
      >
        <MantineProviderWrapper theme={theme}>
          {children}
        </MantineProviderWrapper>
      </ThemeProvider>
    </>
  );
}

function MantineProviderWrapper({ 
  children, 
  theme 
}: { 
  children: React.ReactNode;
  theme: any;
}) {
  const { colorScheme } = useTheme();
  
  return (
    <MantineProvider theme={theme} forceColorScheme={colorScheme}>
      <ModalsProvider>
        <Notifications />
        {children}
      </ModalsProvider>
    </MantineProvider>
  );
}