'use client';

import { useState } from 'react';
import {
  AppShell,
  Burger,
  Group,
  Title,
  Button,
  Menu,
  Avatar,
  Text,
  UnstyledButton,
  rem,
  ActionIcon,
  Badge,
  Divider
} from '@mantine/core';
import {
  IconSearch,
  IconHome,
  IconFileText,
  IconMessage,
  IconPlus,
  IconUser,
  IconSettings,
  IconLogout,
  IconBell,
  IconChevronDown
} from '@tabler/icons-react';
import { useDisclosure } from '@mantine/hooks';
import { usePathname } from 'next/navigation';
import Link from 'next/link';

interface NavigationItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  badge?: number;
}

interface HeaderProps {
  navOpened: boolean;
  toggleNav: () => void;
}

export function Header({ navOpened, toggleNav }: HeaderProps) {
  const pathname = usePathname();
  const [userMenuOpened, setUserMenuOpened] = useState(false);

  // Mock user data - will be replaced with real auth
  const user = {
    name: 'Dr. Jane Smith',
    email: 'jane.smith@university.edu',
    role: 'Editor',
    avatar: null
  };

  const navigationItems: NavigationItem[] = [
    {
      label: 'Home',
      href: '/',
      icon: <IconHome size={16} />
    },
    {
      label: 'Articles',
      href: '/articles',
      icon: <IconFileText size={16} />
    },
    {
      label: 'Conversations',
      href: '/conversations',
      icon: <IconMessage size={16} />,
      badge: 3 // Mock unread count
    }
  ];

  const isActivePage = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <AppShell.Header>
      <Group h="100%" px="md" justify="space-between">
        {/* Left Section */}
        <Group>
          <Burger opened={navOpened} onClick={toggleNav} hiddenFrom="sm" size="sm" />
          
          {/* Logo */}
          <Group gap="xs">
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
          </Group>

          {/* Desktop Navigation */}
          <Group gap="xs" ml="xl" visibleFrom="sm">
            {navigationItems.map((item) => (
              <Button
                key={item.href}
                component={Link}
                href={item.href}
                variant={isActivePage(item.href) ? 'filled' : 'subtle'}
                color={isActivePage(item.href) ? 'blue' : 'gray'}
                leftSection={item.icon}
                rightSection={item.badge ? (
                  <Badge size="xs" color="red">
                    {item.badge}
                  </Badge>
                ) : undefined}
                size="sm"
              >
                {item.label}
              </Button>
            ))}
          </Group>
        </Group>

        {/* Right Section */}
        <Group gap="md">
          {/* Search */}
          <ActionIcon
            variant="subtle"
            size="lg"
            onClick={() => console.log('Search not implemented yet')}
            title="Search (Ctrl+K)"
          >
            <IconSearch size={18} />
          </ActionIcon>

          {/* Notifications */}
          <ActionIcon variant="subtle" size="lg" title="Notifications">
            <IconBell size={18} />
          </ActionIcon>

          {/* Quick Submit */}
          <Button
            component={Link}
            href="/articles/submit"
            leftSection={<IconPlus size={16} />}
            size="sm"
            visibleFrom="md"
          >
            Submit
          </Button>

          {/* User Menu */}
          <Menu
            opened={userMenuOpened}
            onChange={setUserMenuOpened}
            position="bottom-end"
            withArrow
          >
            <Menu.Target>
              <UnstyledButton
                style={{
                  padding: rem(4),
                  borderRadius: rem(4),
                  '&:hover': {
                    backgroundColor: 'var(--mantine-color-gray-1)'
                  }
                }}
              >
                <Group gap="xs">
                  <Avatar size="sm" color="blue">
                    {getInitials(user.name)}
                  </Avatar>
                  <div style={{ flex: 1 }}>
                    <Text size="sm" fw={500} visibleFrom="sm">
                      {user.name}
                    </Text>
                    <Text size="xs" c="dimmed" visibleFrom="md">
                      {user.role}
                    </Text>
                  </div>
                  <IconChevronDown size={14} />
                </Group>
              </UnstyledButton>
            </Menu.Target>

            <Menu.Dropdown>
              <Menu.Label>Account</Menu.Label>
              <Menu.Item leftSection={<IconUser size={14} />}>
                Profile
              </Menu.Item>
              <Menu.Item leftSection={<IconSettings size={14} />}>
                Settings
              </Menu.Item>
              <Menu.Item leftSection={<IconBell size={14} />}>
                Notifications
              </Menu.Item>
              
              <Menu.Divider />
              
              <Menu.Label>Quick Actions</Menu.Label>
              <Menu.Item 
                leftSection={<IconPlus size={14} />}
                component={Link}
                href="/articles/submit"
              >
                Submit Article
              </Menu.Item>
              <Menu.Item 
                leftSection={<IconMessage size={14} />}
                component={Link}
                href="/conversations"
              >
                My Conversations
              </Menu.Item>
              
              <Menu.Divider />
              
              <Menu.Item 
                leftSection={<IconLogout size={14} />}
                color="red"
              >
                Sign Out
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>
      </Group>
    </AppShell.Header>
  );
}