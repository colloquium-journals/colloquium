'use client';

import { useState, useRef } from 'react';
import { 
  Paper, 
  Textarea, 
  Button, 
  Group, 
  Stack, 
  Text, 
  Badge,
  Menu,
  ActionIcon
} from '@mantine/core';
import { IconSend, IconAt, IconX } from '@tabler/icons-react';

interface Bot {
  id: string;
  name: string;
  description: string;
  color: string;
}

interface MessageComposerProps {
  onSubmit: (content: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

// Mock bot data - will be replaced with API data
const availableBots: Bot[] = [
  {
    id: 'plagiarism-checker',
    name: 'Plagiarism Checker',
    description: 'Checks manuscripts for potential plagiarism',
    color: 'red'
  },
  {
    id: 'statistics-reviewer',
    name: 'Statistics Reviewer',
    description: 'Reviews statistical methods and analyses',
    color: 'blue'
  },
  {
    id: 'formatting-checker',
    name: 'Formatting Checker',
    description: 'Validates manuscript formatting and style',
    color: 'green'
  }
];

export function MessageComposer({ onSubmit, placeholder = "Write your message...", disabled = false }: MessageComposerProps) {
  const [content, setContent] = useState('');
  const [mentionedBots, setMentionedBots] = useState<Bot[]>([]);
  const [showBotMenu, setShowBotMenu] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = async () => {
    if (!content.trim() || disabled) return;

    setIsSubmitting(true);
    try {
      // Process bot mentions in the content
      let processedContent = content;
      mentionedBots.forEach(bot => {
        processedContent = processedContent.replace(
          new RegExp(`@${bot.name.replace(/\s+/g, '-').toLowerCase()}`, 'g'),
          `@${bot.name}`
        );
      });

      await onSubmit(processedContent);
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

    const botMention = `@${bot.name.replace(/\s+/g, '-').toLowerCase()}`;
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

    const botMention = `@${bot.name.replace(/\s+/g, '-').toLowerCase()}`;
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
                @{bot.name}
              </Badge>
            ))}
          </Group>
        )}

        {/* Message Input */}
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
                {availableBots.map(bot => (
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
                ))}
              </Menu.Dropdown>
            </Menu>

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