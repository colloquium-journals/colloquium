'use client';

import { 
  HoverCard, 
  Avatar, 
  Text, 
  Group, 
  Stack, 
  Badge,
  Divider,
  ActionIcon,
  Anchor
} from '@mantine/core';
import {
  IconMail,
  IconCalendar,
  IconExternalLink,
  IconCheck
} from '@tabler/icons-react';

interface UserProfileData {
  name: string;
  email: string;
  isBot?: boolean;
  role?: string;
  affiliation?: string;
  orcid?: string;
  orcidVerified?: boolean;
  joinedAt?: string;
  bio?: string;
}

interface UserProfileHoverProps {
  user: UserProfileData;
  children: React.ReactNode;
  disabled?: boolean;
}

export function UserProfileHover({ user, children, disabled = false }: UserProfileHoverProps) {
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const formatJoinDate = (dateString?: string) => {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long' 
    });
  };

  const getRoleColor = (role?: string) => {
    if (!role) return 'gray';
    switch (role.toLowerCase()) {
      case 'admin': return 'red';
      case 'editor': return 'blue';
      case 'reviewer': return 'orange';
      case 'author': return 'green';
      default: return 'gray';
    }
  };

  if (disabled || user.isBot) {
    return <>{children}</>;
  }

  return (
    <HoverCard width={320} shadow="md" openDelay={200} closeDelay={100}>
      <HoverCard.Target>
        {children}
      </HoverCard.Target>
      <HoverCard.Dropdown>
        <Stack gap="sm">
          {/* Header with avatar and basic info */}
          <Group gap="md" align="flex-start">
            <Avatar 
              size="lg" 
              radius="md"
              color="gray"
            >
              {getInitials(user.name)}
            </Avatar>
            <Stack gap="xs" style={{ flex: 1 }}>
              <Text fw={600} size="md">{user.name}</Text>
              <Group gap="xs">
                <Text size="sm" c="dimmed">{user.email}</Text>
                <ActionIcon 
                  variant="subtle" 
                  size="xs" 
                  component="a" 
                  href={`mailto:${user.email}`}
                >
                  <IconMail size={14} />
                </ActionIcon>
              </Group>
              {user.role && (
                <Badge 
                  size="sm" 
                  variant="light" 
                  color={getRoleColor(user.role)}
                >
                  {user.role}
                </Badge>
              )}
            </Stack>
          </Group>

          {/* Additional info */}
          {(user.affiliation || user.orcid || user.joinedAt) && (
            <>
              <Divider />
              <Stack gap="xs">
                {user.affiliation && (
                  <Text size="sm" c="dimmed">
                    <strong>Affiliation:</strong> {user.affiliation}
                  </Text>
                )}
                {user.orcid && (
                  <Group gap="xs">
                    <Text size="sm" c="dimmed">
                      <strong>ORCID:</strong>
                    </Text>
                    <Anchor
                      href={`https://orcid.org/${user.orcid}`}
                      target="_blank"
                      size="sm"
                    >
                      {user.orcid}
                      <IconExternalLink size={12} style={{ marginLeft: '4px' }} />
                    </Anchor>
                    {user.orcidVerified && (
                      <Badge size="xs" color="green" variant="light" leftSection={<IconCheck size={10} />}>
                        Verified
                      </Badge>
                    )}
                  </Group>
                )}
                {user.joinedAt && (
                  <Group gap="xs">
                    <IconCalendar size={14} color="var(--mantine-color-dimmed)" />
                    <Text size="sm" c="dimmed">
                      Joined {formatJoinDate(user.joinedAt)}
                    </Text>
                  </Group>
                )}
              </Stack>
            </>
          )}

          {/* Bio */}
          {user.bio && (
            <>
              <Divider />
              <Text size="sm" c="dimmed" lineClamp={3}>
                {user.bio}
              </Text>
            </>
          )}
        </Stack>
      </HoverCard.Dropdown>
    </HoverCard>
  );
}