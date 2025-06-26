'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

interface JournalSettings {
  name: string;
  description?: string;
  logoUrl?: string;
  primaryColor: string;
  secondaryColor: string;
  contactEmail?: string;
  publisherName?: string;
  publisherLocation?: string;
  submissionsOpen: boolean;
  customCss?: string;
  customFooter?: string;
  maintenanceMode: boolean;
  enableDarkMode: boolean;
  defaultTheme: 'light' | 'dark' | 'auto';
}

interface JournalSettingsContextType {
  settings: JournalSettings;
  loading: boolean;
  error: string | null;
  refreshSettings: () => Promise<void>;
}

const defaultSettings: JournalSettings = {
  name: 'Colloquium',
  primaryColor: '#1976d2',
  secondaryColor: '#424242',
  submissionsOpen: true,
  maintenanceMode: false,
  enableDarkMode: false,
  defaultTheme: 'light'
};

const JournalSettingsContext = createContext<JournalSettingsContextType>({
  settings: defaultSettings,
  loading: true,
  error: null,
  refreshSettings: async () => {}
});

export function useJournalSettings() {
  const context = useContext(JournalSettingsContext);
  if (!context) {
    throw new Error('useJournalSettings must be used within a JournalSettingsProvider');
  }
  return context;
}

interface JournalSettingsProviderProps {
  children: React.ReactNode;
}

export function JournalSettingsProvider({ children }: JournalSettingsProviderProps) {
  const [settings, setSettings] = useState<JournalSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('http://localhost:4000/api/settings', {
        cache: 'no-store'
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch journal settings');
      }
      
      const fetchedSettings = await response.json();
      setSettings({ ...defaultSettings, ...fetchedSettings });
    } catch (err) {
      console.error('Error fetching journal settings:', err);
      setError(err instanceof Error ? err.message : 'Failed to load settings');
      // Keep using default settings if fetch fails
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const refreshSettings = async () => {
    await fetchSettings();
  };

  // Apply custom CSS to document head
  useEffect(() => {
    const styleId = 'journal-custom-styles';
    let styleElement = document.getElementById(styleId) as HTMLStyleElement;
    
    if (!styleElement) {
      styleElement = document.createElement('style');
      styleElement.id = styleId;
      document.head.appendChild(styleElement);
    }

    // Generate CSS for custom colors
    const css = `
      :root {
        --journal-primary-color: ${settings.primaryColor};
        --journal-secondary-color: ${settings.secondaryColor};
        --mantine-color-primary-6: ${settings.primaryColor};
        --mantine-color-blue-6: ${settings.primaryColor};
        --mantine-color-blue-filled: ${settings.primaryColor};
        --mantine-color-blue-filled-hover: ${settings.primaryColor}dd;
      }
      
      [data-mantine-color-scheme="dark"] {
        --journal-primary-color: ${settings.primaryColor};
        --journal-secondary-color: ${settings.secondaryColor};
        --mantine-color-primary-6: ${settings.primaryColor};
        --mantine-color-blue-6: ${settings.primaryColor};
        --mantine-color-blue-filled: ${settings.primaryColor};
        --mantine-color-blue-filled-hover: ${settings.primaryColor}dd;
      }
      
      .journal-primary {
        color: ${settings.primaryColor} !important;
      }
      
      .journal-primary-bg {
        background-color: ${settings.primaryColor} !important;
      }
      
      .journal-secondary {
        color: ${settings.secondaryColor} !important;
      }
      
      .journal-secondary-bg {
        background-color: ${settings.secondaryColor} !important;
      }
      
      .journal-footer {
        border-top: 1px solid var(--mantine-color-gray-3);
        background-color: var(--mantine-color-gray-0);
      }
      
      [data-mantine-color-scheme="dark"] .journal-footer {
        border-top-color: var(--mantine-color-dark-4);
        background-color: var(--mantine-color-dark-7);
      }
      
      ${settings.customCss || ''}
    `;
    
    styleElement.textContent = css;
  }, [settings.primaryColor, settings.secondaryColor, settings.customCss]);

  return (
    <JournalSettingsContext.Provider 
      value={{ settings, loading, error, refreshSettings }}
    >
      {children}
    </JournalSettingsContext.Provider>
  );
}