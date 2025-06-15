'use client';

import {
  AppShell,
  Stack,
  Button,
  Divider,
  Text,
  Group,
  Badge,
  ScrollArea
} from '@mantine/core';
import {
  IconHome,
  IconFileText,
  IconMessage,
  IconPlus,
  IconUser,
  IconSettings,
  IconBell,
  IconSearch
} from '@tabler/icons-react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';

interface NavigationItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  badge?: number;
}

interface MobileNavProps {
  opened: boolean;
  onClose: () => void;
}

export function MobileNav({ opened, onClose }: MobileNavProps) {
  const pathname = usePathname();

  const navigationItems: NavigationItem[] = [
    {
      label: 'Dashboard',
      href: '/dashboard',
      icon: <IconHome size={20} />
    },
    {
      label: 'Manuscripts',
      href: '/manuscripts',
      icon: <IconFileText size={20} />
    },
    {
      label: 'Conversations',
      href: '/conversations',
      icon: <IconMessage size={20} />,
      badge: 3
    }
  ];

  const quickActions: NavigationItem[] = [
    {
      label: 'Submit Manuscript',
      href: '/manuscripts/submit',
      icon: <IconPlus size={20} />
    },
    {
      label: 'Search',
      href: '/search',
      icon: <IconSearch size={20} />
    }
  ];

  const accountItems: NavigationItem[] = [
    {
      label: 'Profile',
      href: '/profile',
      icon: <IconUser size={20} />
    },
    {
      label: 'Settings',
      href: '/settings',
      icon: <IconSettings size={20} />
    },
    {
      label: 'Notifications',
      href: '/notifications',
      icon: <IconBell size={20} />,
      badge: 2
    }
  ];

  const isActivePage = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  const renderNavItems = (items: NavigationItem[], title?: string) => (
    <Stack gap="xs">
      {title && (
        <Text size="xs" fw={600} c="dimmed" tt="uppercase" pl="md">
          {title}
        </Text>
      )}
      {items.map((item) => (
        <Button
          key={item.href}
          component={Link}
          href={item.href}
          variant={isActivePage(item.href) ? 'filled' : 'subtle'}
          color={isActivePage(item.href) ? 'blue' : 'gray'}
          justify="space-between"
          leftSection={item.icon}
          rightSection={item.badge ? (
            <Badge size="xs" color="red">
              {item.badge}
            </Badge>
          ) : undefined}
          fullWidth
          onClick={onClose}
          size="md"
          radius="md"
        >
          {item.label}
        </Button>
      ))}
    </Stack>
  );

  return (
    <AppShell.Navbar p="md">
      <AppShell.Section grow component={ScrollArea}>
        <Stack gap="lg">
          {/* Main Navigation */}
          {renderNavItems(navigationItems, 'Navigation')}
          
          <Divider />
          
          {/* Quick Actions */}
          {renderNavItems(quickActions, 'Quick Actions')}
          
          <Divider />
          
          {/* Account */}
          {renderNavItems(accountItems, 'Account')}
        </Stack>
      </AppShell.Section>
    </AppShell.Navbar>
  );
}