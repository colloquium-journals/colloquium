'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

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

function getStoredTheme(): ThemeMode | null {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem('theme-mode');
  if (stored === 'light' || stored === 'dark' || stored === 'auto') {
    return stored;
  }
  return null;
}

export function ThemeProvider({
  children,
  isDarkModeEnabled = false,
  defaultTheme = 'light'
}: ThemeProviderProps) {
  const [themeMode, setThemeModeState] = useState<ThemeMode>(() => {
    return getStoredTheme() || defaultTheme;
  });

  const [colorScheme, setColorSchemeState] = useState<'light' | 'dark'>('light');

  const setThemeMode = useCallback((mode: ThemeMode) => {
    setThemeModeState(mode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('theme-mode', mode);
    }
  }, []);

  // Determine the actual color scheme based on mode and system preference
  useEffect(() => {
    if (!isDarkModeEnabled) {
      setColorSchemeState('light');
      return;
    }

    if (themeMode === 'auto') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      setColorSchemeState(mediaQuery.matches ? 'dark' : 'light');

      const listener = (e: MediaQueryListEvent) => {
        setColorSchemeState(e.matches ? 'dark' : 'light');
      };
      mediaQuery.addEventListener('change', listener);
      return () => mediaQuery.removeEventListener('change', listener);
    } else {
      setColorSchemeState(themeMode);
    }
  }, [themeMode, isDarkModeEnabled]);

  const setColorScheme = useCallback((scheme: 'light' | 'dark') => {
    if (!isDarkModeEnabled && scheme === 'dark') return;
    setThemeMode(scheme);
  }, [isDarkModeEnabled, setThemeMode]);

  const toggleColorScheme = useCallback(() => {
    if (!isDarkModeEnabled) return;
    setThemeMode(colorScheme === 'dark' ? 'light' : 'dark');
  }, [isDarkModeEnabled, colorScheme, setThemeMode]);

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