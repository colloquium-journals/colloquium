import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { ModalsProvider } from '@mantine/modals';
import { academicTheme } from '@/lib/theme';
import { AppShellLayout } from '@/components/layout/AppShell';
import { AuthProvider } from '@/contexts/AuthContext';
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
      <body>
        <MantineProvider theme={academicTheme}>
          <ModalsProvider>
            <Notifications />
            <AuthProvider>
              <AppShellLayout>
                {children}
              </AppShellLayout>
            </AuthProvider>
          </ModalsProvider>
        </MantineProvider>
      </body>
    </html>
  );
}