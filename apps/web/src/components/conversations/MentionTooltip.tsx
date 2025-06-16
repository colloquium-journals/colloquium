import { Tooltip, Avatar, Group, Text, Stack, Badge, Loader } from '@mantine/core';
import { IconRobot, IconUser } from '@tabler/icons-react';
import { useState, useEffect } from 'react';
import { Mention, BOT_INFO } from '../../lib/mentions';

interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: string;
  affiliation?: string;
  bio?: string;
}

interface MentionTooltipProps {
  mention: Mention;
  children: React.ReactNode;
  conversationId: string;
}

export function MentionTooltip({ mention, children, conversationId }: MentionTooltipProps) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = async () => {
    if (mention.isBot) {
      // Use static bot info
      const botInfo = BOT_INFO[mention.id];
      if (botInfo) {
        setProfile({
          id: mention.id,
          name: botInfo.displayName,
          email: `${mention.id}@colloquium.ai`,
          role: botInfo.role,
          bio: botInfo.description
        });
      }
      return;
    }

    // Fetch user profile from API
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/users/profile/${mention.id}`,
        { credentials: 'include' }
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch profile');
      }
      
      const data = await response.json();
      setProfile(data.user);
    } catch (err) {
      console.error('Error fetching user profile:', err);
      setError('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [mention.id, mention.isBot]);

  const renderTooltipContent = () => {
    if (loading) {
      return (
        <Group gap="xs">
          <Loader size="xs" />
          <Text size="sm">Loading profile...</Text>
        </Group>
      );
    }

    if (error || !profile) {
      return (
        <Text size="sm" c="dimmed">
          {error || 'Profile not found'}
        </Text>
      );
    }

    return (
      <Stack gap="xs" w={280}>
        <Group gap="sm">
          <Avatar 
            size="md" 
            color={mention.isBot ? 'blue' : 'grape'}
            radius="sm"
          >
            {mention.isBot ? (
              <IconRobot size={20} />
            ) : (
              <IconUser size={20} />
            )}
          </Avatar>
          <div style={{ flex: 1 }}>
            <Text fw={600} size="sm">
              {profile.name}
            </Text>
            <Text size="xs" c="dimmed">
              {profile.email}
            </Text>
          </div>
        </Group>

        <Group gap="xs">
          <Badge 
            size="xs" 
            variant="light" 
            color={mention.isBot ? 'blue' : 'grape'}
          >
            {profile.role}
          </Badge>
          {mention.isBot && (
            <Badge size="xs" variant="light" color="cyan">
              Bot
            </Badge>
          )}
        </Group>

        {profile.affiliation && (
          <Text size="xs" c="dimmed">
            <strong>Affiliation:</strong> {profile.affiliation}
          </Text>
        )}

        {profile.bio && (
          <Text size="xs" c="dimmed" lineClamp={3}>
            {profile.bio}
          </Text>
        )}

        <Text size="xs" c="dimmed" fs="italic">
          Role in this conversation: {getRoleInConversation(profile.role, mention.isBot || false)}
        </Text>
      </Stack>
    );
  };

  return (
    <Tooltip
      label={renderTooltipContent()}
      multiline
      w={300}
      withArrow
      position="top"
      offset={5}
      openDelay={500}
      closeDelay={100}
    >
      {children}
    </Tooltip>
  );
}

/**
 * Determine the user's role in the conversation context
 */
function getRoleInConversation(userRole: string, isBot: boolean): string {
  if (isBot) {
    return 'Automated Assistant';
  }

  switch (userRole.toUpperCase()) {
    case 'AUTHOR':
      return 'Manuscript Author';
    case 'REVIEWER':
      return 'Peer Reviewer';
    case 'EDITOR':
      return 'Managing Editor';
    case 'ADMIN':
      return 'Journal Administrator';
    default:
      return 'Participant';
  }
}