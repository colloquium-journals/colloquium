'use client';

import { useState, useRef, useEffect } from 'react';
import { 
  Paper, 
  Textarea, 
  Button, 
  Group, 
  Stack, 
  Text, 
  Badge,
  Menu,
  ActionIcon,
  Select,
  Tooltip,
  Popover,
  Code
} from '@mantine/core';
import { IconSend, IconAt, IconX, IconLock, IconEye, IconUsers, IconShield, IconMarkdown, IconHelp } from '@tabler/icons-react';
import { useAuth } from '@/contexts/AuthContext';

interface Bot {
  id: string;
  name: string;
  description: string;
  color: string;
  isInstalled: boolean;
  isEnabled: boolean;
}

interface MessageComposerProps {
  onSubmit: (content: string, privacy?: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

// Bot colors for UI consistency
const BOT_COLORS = [
  'blue', 'green', 'red', 'orange', 'purple', 'cyan', 'pink', 'gray'
];

// Privacy level options with their descriptions and icons
const privacyOptions = [
  {
    value: 'AUTHOR_VISIBLE',
    label: 'Authors & Reviewers',
    description: 'Visible to authors, reviewers, editors, and admins',
    icon: IconUsers,
    color: 'blue'
  },
  {
    value: 'REVIEWER_ONLY', 
    label: 'Reviewers Only',
    description: 'Only visible to reviewers, editors, and admins',
    icon: IconShield,
    color: 'orange'
  },
  {
    value: 'EDITOR_ONLY',
    label: 'Editors Only', 
    description: 'Only visible to editors and admins',
    icon: IconLock,
    color: 'red'
  },
  {
    value: 'PUBLIC',
    label: 'Public',
    description: 'Visible to everyone',
    icon: IconEye,
    color: 'green'
  }
];

// Get default privacy based on user role
function getDefaultPrivacy(userRole: string | undefined): string {
  switch (userRole) {
    case 'ADMIN':
    case 'EDITOR':
      return 'AUTHOR_VISIBLE';
    case 'REVIEWER':
      return 'REVIEWER_ONLY';
    case 'AUTHOR':
    default:
      return 'AUTHOR_VISIBLE';
  }
}

export function MessageComposer({ onSubmit, placeholder = "Write your message...", disabled = false }: MessageComposerProps) {
  const { user } = useAuth();
  const [content, setContent] = useState('');
  const [mentionedBots, setMentionedBots] = useState<Bot[]>([]);
  const [availableBots, setAvailableBots] = useState<Bot[]>([]);
  const [showBotMenu, setShowBotMenu] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [privacy, setPrivacy] = useState(getDefaultPrivacy(user?.role));
  const [loadingBots, setLoadingBots] = useState(false);
  const [showMarkdownHelp, setShowMarkdownHelp] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Fetch available bots
  useEffect(() => {
    if (!user) return; // Only fetch bots when user is authenticated

    const fetchBots = async () => {
      try {
        setLoadingBots(true);
        const response = await fetch('http://localhost:4000/api/bots', {
          credentials: 'include'
        });

        if (response.ok) {
          const data = await response.json();
          // console.log('Fetched bots:', data); // Debug log
          const enabledBots = data.bots
            .filter((bot: any) => bot.isInstalled && bot.isEnabled)
            .map((bot: any, index: number) => ({
              id: bot.id,
              name: bot.name,
              description: bot.description,
              color: BOT_COLORS[index % BOT_COLORS.length],
              isInstalled: bot.isInstalled,
              isEnabled: bot.isEnabled
            }));
          // console.log('Enabled bots:', enabledBots); // Debug log
          setAvailableBots(enabledBots);
        } else {
          console.error('Failed to fetch bots:', response.status, response.statusText);
        }
      } catch (error) {
        console.error('Error fetching bots:', error);
      } finally {
        setLoadingBots(false);
      }
    };

    fetchBots();
  }, [user]);

  const handleSubmit = async () => {
    if (!content.trim() || disabled) return;

    setIsSubmitting(true);
    try {
      // Keep bot mentions as-is (using bot ID)
      const processedContent = content;

      await onSubmit(processedContent, privacy);
      setContent('');
      setMentionedBots([]);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      handleSubmit();
    }
  };

  const addBotMention = (bot: Bot) => {
    if (mentionedBots.find(b => b.id === bot.id)) return;

    // Use bot ID for the @-mention, not the display name
    const botMention = `@${bot.id}`;
    const newContent = content + (content ? ' ' : '') + botMention + ' ';
    
    setContent(newContent);
    setMentionedBots([...mentionedBots, bot]);
    setShowBotMenu(false);
    
    // Focus back to textarea
    if (textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(newContent.length, newContent.length);
    }
  };

  const removeBotMention = (botId: string) => {
    const bot = mentionedBots.find(b => b.id === botId);
    if (!bot) return;

    // Use bot ID for removal, not the display name
    const botMention = `@${bot.id}`;
    const newContent = content.replace(new RegExp(`\\s*${botMention}\\s*`, 'g'), ' ').trim();
    
    setContent(newContent);
    setMentionedBots(mentionedBots.filter(b => b.id !== botId));
  };

  const canSubmit = content.trim().length > 0 && !isSubmitting && !disabled;

  return (
    <Paper shadow="sm" p="lg" radius="md">
      <Stack gap="md">
        {/* Bot Mentions */}
        {mentionedBots.length > 0 && (
          <Group gap="xs">
            <Text size="xs" c="dimmed">
              Mentioning:
            </Text>
            {mentionedBots.map(bot => (
              <Badge
                key={bot.id}
                color={bot.color}
                variant="light"
                rightSection={
                  <ActionIcon
                    size="xs"
                    color={bot.color}
                    radius="xl"
                    variant="transparent"
                    onClick={() => removeBotMention(bot.id)}
                  >
                    <IconX size={10} />
                  </ActionIcon>
                }
              >
                @{bot.id}
              </Badge>
            ))}
          </Group>
        )}

        {/* Message Input */}
        <Stack gap="xs">
          <Textarea
            ref={textareaRef}
            placeholder={placeholder}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyPress}
            minRows={3}
            autosize
            maxRows={8}
            disabled={disabled}
          />
          
          {/* Formatting Help */}
          <Group justify="flex-end">
            <Popover
              opened={showMarkdownHelp}
              onChange={setShowMarkdownHelp}
              position="top-end"
              width={320}
              trapFocus
              shadow="md"
            >
              <Popover.Target>
                <Button
                  variant="subtle"
                  size="xs"
                  color="gray"
                  leftSection={<IconMarkdown size={12} />}
                  onClick={() => setShowMarkdownHelp(!showMarkdownHelp)}
                >
                  Markdown supported
                </Button>
              </Popover.Target>
              <Popover.Dropdown>
                <Stack gap="xs">
                  <Text size="sm" fw={600}>Markdown Formatting</Text>
                  
                  <Group gap="xs" align="flex-start">
                    <Code>**bold**</Code>
                    <Text size="xs" c="dimmed">{'→'}</Text>
                    <Text size="xs" fw={600}>bold</Text>
                  </Group>
                  
                  <Group gap="xs" align="flex-start">
                    <Code>*italic*</Code>
                    <Text size="xs" c="dimmed">{'→'}</Text>
                    <Text size="xs" fs="italic">italic</Text>
                  </Group>
                  
                  <Group gap="xs" align="flex-start">
                    <Code>`code`</Code>
                    <Text size="xs" c="dimmed">{'→'}</Text>
                    <Code>code</Code>
                  </Group>
                  
                  <Group gap="xs" align="flex-start">
                    <Code># Heading</Code>
                    <Text size="xs" c="dimmed">{'→'}</Text>
                    <Text size="sm" fw={600}>Heading</Text>
                  </Group>
                  
                  <Group gap="xs" align="flex-start">
                    <Code>- List item</Code>
                    <Text size="xs" c="dimmed">{'→'}</Text>
                    <Text size="xs">• List item</Text>
                  </Group>
                  
                  <Group gap="xs" align="flex-start">
                    <Code>[Link](url)</Code>
                    <Text size="xs" c="dimmed">{'→'}</Text>
                    <Text size="xs" c="blue">Link</Text>
                  </Group>
                  
                  <Group gap="xs" align="flex-start">
                    <Code>{'> Quote'}</Code>
                    <Text size="xs" c="dimmed">{'→'}</Text>
                    <Text size="xs" fs="italic" c="dimmed">Quote</Text>
                  </Group>
                </Stack>
              </Popover.Dropdown>
            </Popover>
          </Group>
        </Stack>

        {/* Actions */}
        <Group justify="space-between">
          <Group gap="xs">
            <Menu
              opened={showBotMenu}
              onChange={setShowBotMenu}
              shadow="md"
              width={300}
            >
              <Menu.Target>
                <Button
                  variant="subtle"
                  size="xs"
                  leftSection={<IconAt size={14} />}
                  onClick={() => setShowBotMenu(!showBotMenu)}
                >
                  Mention Bot
                </Button>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Label>Available Bots</Menu.Label>
                {loadingBots ? (
                  <Menu.Item disabled>
                    <Group gap="xs">
                      <Text size="sm">Loading bots...</Text>
                    </Group>
                  </Menu.Item>
                ) : availableBots.length === 0 ? (
                  <Menu.Item disabled>
                    <Text size="sm" c="dimmed">No bots available</Text>
                  </Menu.Item>
                ) : (
                  availableBots.map(bot => (
                    <Menu.Item
                      key={bot.id}
                      onClick={() => addBotMention(bot)}
                      disabled={mentionedBots.some(b => b.id === bot.id)}
                    >
                      <div>
                        <Text size="sm" fw={500}>
                          {bot.name}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {bot.description}
                        </Text>
                      </div>
                    </Menu.Item>
                  ))
                )}
              </Menu.Dropdown>
            </Menu>

            <Select
              size="xs"
              value={privacy}
              onChange={(value) => value && setPrivacy(value)}
              data={privacyOptions.map(opt => ({
                value: opt.value,
                label: opt.label
              }))}
              leftSection={(() => {
                const option = privacyOptions.find(opt => opt.value === privacy);
                return option ? <option.icon size={14} /> : <IconEye size={14} />;
              })()}
              w={180}
              comboboxProps={{ size: 'xs' }}
            />

            <Text size="xs" c="dimmed">
              Tip: Use Ctrl+Enter to send
            </Text>
          </Group>

          <Button
            leftSection={<IconSend size={16} />}
            onClick={handleSubmit}
            loading={isSubmitting}
            disabled={!canSubmit}
          >
            Send Message
          </Button>
        </Group>
      </Stack>
    </Paper>
  );
}