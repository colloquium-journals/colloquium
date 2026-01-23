'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useLocalStorage } from '@mantine/hooks';

type ThemeMode = 'light' | 'dark' | 'auto';

interface ThemeContextType {
  colorScheme: 'light' | 'dark';
  setColorScheme: (scheme: 'light' | 'dark') => void;
  toggleColorScheme: () => void;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  isDarkModeEnabled: boolean;
  defaultTheme: ThemeMode;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

interface ThemeProviderProps {
  children: React.ReactNode;
  isDarkModeEnabled?: boolean;
  defaultTheme?: ThemeMode;
}

export function ThemeProvider({ 
  children, 
  isDarkModeEnabled = false, 
  defaultTheme = 'light' 
}: ThemeProviderProps) {
  const [themeMode, setThemeMode] = useLocalStorage<ThemeMode>({
    key: 'theme-mode',
    defaultValue: defaultTheme,
  });

  const [colorScheme, setColorSchemeState] = useState<'light' | 'dark'>('light');

  // Determine the actual color scheme based on mode and system preference
  useEffect(() => {
    const updateColorScheme = () => {
      if (!isDarkModeEnabled) {
        setColorSchemeState('light');
        return;
      }

      if (themeMode === 'auto') {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        setColorSchemeState(mediaQuery.matches ? 'dark' : 'light');
      } else {
        setColorSchemeState(themeMode);
      }
    };

    updateColorScheme();

    // Listen for system theme changes when in auto mode
    if (themeMode === 'auto' && isDarkModeEnabled) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const listener = (e: MediaQueryListEvent) => {
        setColorSchemeState(e.matches ? 'dark' : 'light');
      };

      mediaQuery.addEventListener('change', listener);
      return () => mediaQuery.removeEventListener('change', listener);
    }
  }, [themeMode, isDarkModeEnabled]);

  // Update theme mode when journal settings change
  useEffect(() => {
    if (!isDarkModeEnabled && themeMode !== 'light') {
      setThemeMode('light');
    }
  }, [isDarkModeEnabled, themeMode, setThemeMode]);

  const setColorScheme = (scheme: 'light' | 'dark') => {
    if (!isDarkModeEnabled && scheme === 'dark') return;
    setThemeMode(scheme);
  };

  const toggleColorScheme = () => {
    if (!isDarkModeEnabled) return;
    setThemeMode(colorScheme === 'dark' ? 'light' : 'dark');
  };

  const value: ThemeContextType = {
    colorScheme,
    setColorScheme,
    toggleColorScheme,
    themeMode,
    setThemeMode,
    isDarkModeEnabled,
    defaultTheme
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}