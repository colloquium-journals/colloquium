import { AppShellLayout } from '@/components/layout/AppShell';
import { AuthProvider } from '@/contexts/AuthContext';
import { JournalSettingsProvider } from '@/contexts/JournalSettingsContext';
import { ThemeWrapper } from '@/components/layout/ThemeWrapper';
import { ColorSchemeScript } from '@mantine/core';
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import '@mantine/dates/styles.css';
import '@mantine/tiptap/styles.css';
import '@mantine/spotlight/styles.css';

export const metadata = {
  title: 'Colloquium - Academic Journal Platform',
  description: 'Open-source scientific journal publishing platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <ColorSchemeScript defaultColorScheme="light" />
      </head>
      <body>
        <JournalSettingsProvider>
          <ThemeWrapper>
            <AuthProvider>
              <AppShellLayout>
                {children}
              </AppShellLayout>
            </AuthProvider>
          </ThemeWrapper>
        </JournalSettingsProvider>
      </body>
    </html>
  );
}