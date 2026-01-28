'use client';

import { useState, useEffect } from 'react';
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
import { IconUser, IconLogout, IconLogin, IconSettings, IconRobot, IconSun, IconMoon, IconDeviceDesktop, IconCheck } from '@tabler/icons-react';
import { useAuth } from '@/contexts/AuthContext';
import { useJournalSettings } from '@/contexts/JournalSettingsContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useUserAccess } from '@/hooks/useUserAccess';
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
  const { colorScheme, themeMode, setThemeMode, isDarkModeEnabled } = useTheme();
  const { canSeeSubmissions } = useUserAccess();
  
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
    // Only include Submissions if user has access
    ...(canSeeSubmissions ? [{
      label: 'Submissions',
      href: '/submissions',
      requiresAuth: false // Access controlled by useUserAccess hook
    }] : [])
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
    if ('allowedRoles' in item && item.allowedRoles && user && Array.isArray(item.allowedRoles)) {
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
            {/* Theme Selector */}
            {isDarkModeEnabled && (
              <Menu shadow="md" width={160}>
                <Menu.Target>
                  <Button
                    variant="default"
                    size="sm"
                    px="xs"
                    title="Theme"
                  >
                    {colorScheme === 'dark' ? <IconMoon size={20} /> : <IconSun size={20} />}
                  </Button>
                </Menu.Target>
                <Menu.Dropdown>
                  <Menu.Item
                    leftSection={<IconSun size={14} />}
                    rightSection={themeMode === 'light' ? <IconCheck size={14} /> : null}
                    onClick={() => setThemeMode('light')}
                  >
                    Light
                  </Menu.Item>
                  <Menu.Item
                    leftSection={<IconMoon size={14} />}
                    rightSection={themeMode === 'dark' ? <IconCheck size={14} /> : null}
                    onClick={() => setThemeMode('dark')}
                  >
                    Dark
                  </Menu.Item>
                  <Menu.Item
                    leftSection={<IconDeviceDesktop size={14} />}
                    rightSection={themeMode === 'auto' ? <IconCheck size={14} /> : null}
                    onClick={() => setThemeMode('auto')}
                  >
                    System
                  </Menu.Item>
                </Menu.Dropdown>
              </Menu>
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