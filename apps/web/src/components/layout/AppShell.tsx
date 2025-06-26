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
  Stack
} from '@mantine/core';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { IconUser, IconLogout, IconLogin, IconSettings, IconRobot } from '@tabler/icons-react';
import { useAuth } from '@/contexts/AuthContext';

interface AppShellLayoutProps {
  children: React.ReactNode;
}

export function AppShellLayout({ children }: AppShellLayoutProps) {
  const [navOpened, setNavOpened] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout, isAuthenticated } = useAuth();
  
  const toggleNav = () => setNavOpened(!navOpened);
  const closeNav = () => setNavOpened(false);

  // Filter navigation items based on user role and authentication
  const allNavigationItems = [
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
    },
    { 
      label: 'About', 
      href: '/about', 
      requiresAuth: false // Public access
    }
  ];

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
              <Title 
                order={3} 
                style={{ 
                  color: 'var(--mantine-color-blue-6)',
                  cursor: 'pointer'
                }}
              >
                Colloquium
              </Title>
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
                  size="sm"
                >
                  {item.label}
                </Button>
              ))}
            </Group>
          </Group>

          {/* Right Section */}
          <Group gap="md">
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
              fullWidth
              onClick={closeNav}
            >
              {item.label}
            </Button>
          ))}
        </Stack>
      </AppShell.Navbar>
      
      <AppShell.Main>
        {children}
      </AppShell.Main>
    </AppShell>
  );
}