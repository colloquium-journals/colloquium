'use client';

import { useState } from 'react';
import {
  AppShell,
  Group,
  Title,
  Button,
  Burger,
  Menu,
  Avatar,
  Text,
  Divider,
  Stack,
  Image
} from '@mantine/core';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { IconUser, IconLogout, IconLogin, IconSettings, IconRobot, IconSun, IconMoon } from '@tabler/icons-react';
import { useAuth } from '@/contexts/AuthContext';
import { useJournalSettings } from '@/contexts/JournalSettingsContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Footer } from './Footer';

interface AppShellLayoutProps {
  children: React.ReactNode;
}

export function AppShellLayout({ children }: AppShellLayoutProps) {
  const [navOpened, setNavOpened] = useState(false);
  const [sections, setSections] = useState<any[]>([]);
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout, isAuthenticated } = useAuth();
  const { settings, loading } = useJournalSettings();
  const { colorScheme, toggleColorScheme, isDarkModeEnabled } = useTheme();
  
  const toggleNav = () => setNavOpened(!navOpened);
  const closeNav = () => setNavOpened(false);

  // Load section configuration
  useEffect(() => {
    const loadSections = async () => {
      try {
        const response = await fetch('http://localhost:4000/api/content/sections', { cache: 'no-store' });
        if (response.ok) {
          const data = await response.json();
          setSections(data.sections || []);
        }
      } catch (error) {
        console.error('Error loading sections:', error);
      }
    };
    
    loadSections();
  }, []);

  // Filter navigation items based on user role and authentication
  const staticNavigationItems = [
    { 
      label: 'Home', 
      href: '/', 
      requiresAuth: false // Public access
    },
    { 
      label: 'Articles', 
      href: '/articles', 
      requiresAuth: false // Public access
    },
    { 
      label: 'Submissions', 
      href: '/submissions', 
      requiresAuth: false // Public access (filtered by API)
    }
  ];

  // Add dynamic section navigation items
  const sectionNavigationItems = sections
    .filter(section => section.showInNavigation && section.visible)
    .map(section => ({
      label: section.title,
      href: section.path,
      requiresAuth: !section.allowAnonymous
    }));

  const allNavigationItems = [...staticNavigationItems, ...sectionNavigationItems];

  const navigationItems = allNavigationItems.filter(item => {
    // If item doesn't require auth, show it to everyone
    if (!item.requiresAuth) return true;
    
    // If item requires auth but user isn't authenticated, hide it
    if (item.requiresAuth && !isAuthenticated) return false;
    
    // If item has role restrictions, check user role
    if (item.allowedRoles && user) {
      return item.allowedRoles.includes(user.role);
    }
    
    // If item requires auth and user is authenticated (no role restrictions), show it
    return isAuthenticated;
  });

  const isActivePage = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  const handleLogout = async () => {
    await logout();
    router.push('/');
  };

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{
        width: 300,
        breakpoint: 'sm',
        collapsed: { desktop: true, mobile: !navOpened }
      }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          {/* Left Section */}
          <Group>
            <Burger opened={navOpened} onClick={toggleNav} hiddenFrom="sm" size="sm" />
            
            {/* Logo */}
            <Link href="/" style={{ textDecoration: 'none' }}>
              <Group gap="xs" align="center">
                {settings.logoUrl && (
                  <Image 
                    src={settings.logoUrl.startsWith('http') ? settings.logoUrl : `http://localhost:4000${settings.logoUrl}`}
                    alt={`${settings.name} logo`}
                    h={32}
                    w="auto"
                    fit="contain"
                  />
                )}
                <Title 
                  order={3} 
                  className="journal-primary"
                  style={{ 
                    cursor: 'pointer'
                  }}
                >
                  {loading ? 'Colloquium' : settings.name}
                </Title>
              </Group>
            </Link>

            {/* Desktop Navigation */}
            <Group gap="xs" ml="xl" visibleFrom="sm">
              {navigationItems.map((item) => (
                <Button
                  key={item.href}
                  component={Link}
                  href={item.href}
                  variant={isActivePage(item.href) ? 'filled' : 'subtle'}
                  color={isActivePage(item.href) ? 'blue' : 'gray'}
                  style={isActivePage(item.href) ? { 
                    backgroundColor: settings.primaryColor,
                    borderColor: settings.primaryColor 
                  } : undefined}
                  size="sm"
                >
                  {item.label}
                </Button>
              ))}
            </Group>
          </Group>

          {/* Right Section */}
          <Group gap="md">
            {/* Dark Mode Toggle */}
            {isDarkModeEnabled && (
              <Button
                variant="subtle"
                size="sm"
                onClick={toggleColorScheme}
                leftSection={colorScheme === 'dark' ? <IconSun size={16} /> : <IconMoon size={16} />}
                hiddenFrom="md"
              >
                {colorScheme === 'dark' ? 'Light' : 'Dark'}
              </Button>
            )}
            
            {isDarkModeEnabled && (
              <Button
                variant="subtle"
                size="compact-sm"
                onClick={toggleColorScheme}
                p="xs"
                visibleFrom="md"
                title={`Switch to ${colorScheme === 'dark' ? 'light' : 'dark'} mode`}
              >
                {colorScheme === 'dark' ? <IconSun size={18} /> : <IconMoon size={18} />}
              </Button>
            )}

            {isAuthenticated && user && !user.name && (
              <Button
                component={Link}
                href="/profile/complete"
                size="sm"
                visibleFrom="md"
                variant="filled"
                color="orange"
              >
                Complete Profile
              </Button>
            )}
            
            {isAuthenticated && user && user.name && (
              <Button
                component={Link}
                href="/articles/submit"
                size="sm"
                visibleFrom="md"
                variant="gradient"
                gradient={{ from: 'blue', to: 'cyan' }}
              >
                Submit Article
              </Button>
            )}
            
            {isAuthenticated && user ? (
              <Menu shadow="md" width={200}>
                <Menu.Target>
                  <Button variant="subtle" p="xs">
                    <Group gap="xs">
                      <Avatar size="sm" color="blue">
                        {user.name ? user.name.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()}
                      </Avatar>
                      <Text size="sm" visibleFrom="sm">
                        {user.name || user.email}
                      </Text>
                    </Group>
                  </Button>
                </Menu.Target>

                <Menu.Dropdown>
                  <Menu.Label>
                    <Text size="xs" c="dimmed">
                      {user.email}
                    </Text>
                  </Menu.Label>
                  <Menu.Item 
                    leftSection={<IconUser size={14} />}
                    component={Link}
                    href="/profile"
                  >
                    Profile
                  </Menu.Item>
                  {isDarkModeEnabled && (
                    <Menu.Item
                      leftSection={colorScheme === 'dark' ? <IconSun size={14} /> : <IconMoon size={14} />}
                      onClick={toggleColorScheme}
                    >
                      {colorScheme === 'dark' ? 'Light Mode' : 'Dark Mode'}
                    </Menu.Item>
                  )}
                  {user.role === 'ADMIN' && (
                    <>
                      <Menu.Divider />
                      <Menu.Label>Administration</Menu.Label>
                      <Menu.Item 
                        leftSection={<IconSettings size={14} />}
                        component={Link}
                        href="/admin/settings"
                      >
                        Admin Settings
                      </Menu.Item>
                    </>
                  )}
                  <Menu.Divider />
                  <Menu.Item 
                    leftSection={<IconLogout size={14} />}
                    onClick={handleLogout}
                    color="red"
                  >
                    Sign Out
                  </Menu.Item>
                </Menu.Dropdown>
              </Menu>
            ) : (
              <Button
                leftSection={<IconLogin size={16} />}
                component={Link}
                href="/auth/login"
                size="sm"
              >
                Sign In
              </Button>
            )}
          </Group>
        </Group>
      </AppShell.Header>

      {/* Mobile Navigation */}
      <AppShell.Navbar p="md">
        <Stack gap="xs">
          {navigationItems.map((item) => (
            <Button
              key={item.href}
              component={Link}
              href={item.href}
              variant={isActivePage(item.href) ? 'filled' : 'subtle'}
              color={isActivePage(item.href) ? 'blue' : 'gray'}
              style={isActivePage(item.href) ? { 
                backgroundColor: settings.primaryColor,
                borderColor: settings.primaryColor 
              } : undefined}
              fullWidth
              onClick={closeNav}
            >
              {item.label}
            </Button>
          ))}
        </Stack>
      </AppShell.Navbar>
      
      <AppShell.Main style={{ display: 'flex', flexDirection: 'column', minHeight: 'calc(100vh - 60px)' }}>
        <div style={{ flex: 1 }}>
          {children}
        </div>
        <Footer />
      </AppShell.Main>
    </AppShell>
  );
}