'use client';

import { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { TextInput } from '@mantine/core';
import { MentionSuggest, MentionSuggestion } from './MentionSuggest';
import { CommandSuggest } from './CommandSuggest';
import { CommandSuggestion } from '@/hooks/useCommandInput';
import { API_URL } from '@/lib/api';

interface BotCommandInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  bots: MentionSuggestion[];
}

interface ParsedInput {
  mode: 'idle' | 'mention' | 'command';
  mentionQuery: string;
  botId: string;
  commandQuery: string;
}

function parseInput(value: string): ParsedInput {
  const mentionMatch = value.match(/^@([\w-]*)$/);
  if (mentionMatch) {
    return { mode: 'mention', mentionQuery: mentionMatch[1], botId: '', commandQuery: '' };
  }

  const commandMatch = value.match(/^@([\w-]+)\s+(.*)$/);
  if (commandMatch) {
    return { mode: 'command', mentionQuery: '', botId: commandMatch[1], commandQuery: commandMatch[2] };
  }

  return { mode: 'idle', mentionQuery: '', botId: '', commandQuery: '' };
}

export function BotCommandInput({ value, onChange, placeholder, bots }: BotCommandInputProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);
  const [selectedCommandIndex, setSelectedCommandIndex] = useState(0);
  const [commands, setCommands] = useState<CommandSuggestion[]>([]);
  const [loadingCommands, setLoadingCommands] = useState(false);
  const [lastFetchedBotId, setLastFetchedBotId] = useState('');
  const [focused, setFocused] = useState(false);

  const parsed = parseInput(value);

  // Filter bot suggestions
  const filteredBots = parsed.mode === 'mention'
    ? bots.filter(bot =>
        bot.name.toLowerCase().includes(parsed.mentionQuery.toLowerCase()) ||
        bot.displayName.toLowerCase().includes(parsed.mentionQuery.toLowerCase())
      )
    : [];

  // Filter command suggestions
  const filteredCommands = parsed.mode === 'command'
    ? commands.filter(cmd =>
        parsed.commandQuery === '' ||
        cmd.name.toLowerCase().includes(parsed.commandQuery.toLowerCase()) ||
        cmd.description.toLowerCase().includes(parsed.commandQuery.toLowerCase())
      )
    : [];

  // Fetch commands when bot is detected
  useEffect(() => {
    if (parsed.mode === 'command' && parsed.botId && parsed.botId !== lastFetchedBotId) {
      setLastFetchedBotId(parsed.botId);
      setLoadingCommands(true);
      fetch(`${API_URL}/api/bots/${parsed.botId}`, { credentials: 'include' })
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data?.commands) {
            setCommands(data.commands.map((cmd: any) => ({
              id: `${parsed.botId}-${cmd.name}`,
              name: cmd.name,
              description: cmd.description,
              usage: cmd.usage || '',
              botId: parsed.botId,
              botName: parsed.botId
            })));
          }
        })
        .catch(() => {})
        .finally(() => setLoadingCommands(false));
    }
  }, [parsed.mode, parsed.botId, lastFetchedBotId]);

  // Reset selection indices when suggestions change
  useEffect(() => { setSelectedMentionIndex(0); }, [parsed.mentionQuery]);
  useEffect(() => { setSelectedCommandIndex(0); }, [parsed.commandQuery]);

  // Validation - only show when not focused and value is non-empty
  const validationError = useMemo(() => {
    if (!value || focused) return undefined;

    if (!value.startsWith('@')) {
      return 'Must start with @bot-name';
    }

    const fullMatch = value.match(/^@([\w-]+)\s+(\S+.*)$/);
    if (!fullMatch) {
      return 'Incomplete command — use @bot-name command';
    }

    const [, botId, commandPart] = fullMatch;
    const botExists = bots.some(bot => bot.name === botId);
    if (!botExists) {
      return `Unknown bot: ${botId}`;
    }

    const commandName = commandPart.trim().split(/\s+/)[0];
    if (commands.length > 0 && lastFetchedBotId === botId) {
      const commandExists = commands.some(cmd => cmd.name === commandName);
      if (!commandExists) {
        return `Unknown command: ${commandName}`;
      }
    }

    return undefined;
  }, [value, focused, bots, commands, lastFetchedBotId]);

  // Fetch commands for validation when value has a complete bot mention but we haven't fetched yet
  useEffect(() => {
    if (!value || focused) return;
    const fullMatch = value.match(/^@([\w-]+)\s+(\S+.*)$/);
    if (fullMatch) {
      const botId = fullMatch[1];
      if (botId !== lastFetchedBotId) {
        setLastFetchedBotId(botId);
        setLoadingCommands(true);
        fetch(`${API_URL}/api/bots/${botId}`, { credentials: 'include' })
          .then(res => res.ok ? res.json() : null)
          .then(data => {
            if (data?.commands) {
              setCommands(data.commands.map((cmd: any) => ({
                id: `${botId}-${cmd.name}`,
                name: cmd.name,
                description: cmd.description,
                usage: cmd.usage || '',
                botId,
                botName: botId
              })));
            }
          })
          .catch(() => {})
          .finally(() => setLoadingCommands(false));
      }
    }
  }, [value, focused, lastFetchedBotId]);

  const handleSelectBot = useCallback((suggestion: MentionSuggestion) => {
    onChange(`@${suggestion.name} `);
  }, [onChange]);

  const handleSelectCommand = useCallback((command: CommandSuggestion) => {
    onChange(`@${parsed.botId} ${command.name}`);
  }, [onChange, parsed.botId]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (parsed.mode === 'mention' && filteredBots.length > 0) {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedMentionIndex(i => (i + 1) % filteredBots.length);
          return;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedMentionIndex(i => i === 0 ? filteredBots.length - 1 : i - 1);
          return;
        case 'Tab':
        case 'Enter':
          e.preventDefault();
          handleSelectBot(filteredBots[selectedMentionIndex]);
          return;
        case 'Escape':
          e.preventDefault();
          onChange('');
          return;
      }
    }

    if (parsed.mode === 'command' && filteredCommands.length > 0) {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedCommandIndex(i => (i + 1) % filteredCommands.length);
          return;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedCommandIndex(i => i === 0 ? filteredCommands.length - 1 : i - 1);
          return;
        case 'Tab':
        case 'Enter':
          e.preventDefault();
          handleSelectCommand(filteredCommands[selectedCommandIndex]);
          return;
        case 'Escape':
          e.preventDefault();
          onChange(`@${parsed.botId} `);
          return;
      }
    }
  }, [parsed, filteredBots, filteredCommands, selectedMentionIndex, selectedCommandIndex, handleSelectBot, handleSelectCommand, onChange]);

  return (
    <div ref={containerRef} style={{ position: 'relative', flex: 1 }}>
      <TextInput
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder || '@bot-name command'}
        error={validationError}
      />
      <MentionSuggest
        suggestions={filteredBots}
        isVisible={parsed.mode === 'mention' && filteredBots.length > 0}
        position={{ top: 38, left: 0 }}
        selectedIndex={selectedMentionIndex}
        onSelect={handleSelectBot}
        onClose={() => {}}
      />
      <CommandSuggest
        suggestions={filteredCommands}
        isVisible={parsed.mode === 'command' && (filteredCommands.length > 0 || loadingCommands)}
        position={{ top: 38, left: 0 }}
        selectedIndex={selectedCommandIndex}
        isLoading={loadingCommands}
        onSelect={handleSelectCommand}
        onClose={() => {}}
      />
    </div>
  );
}
