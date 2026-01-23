'use client';

import { useState, useEffect, useRef } from 'react';
import { Paper, Stack, Text, UnstyledButton, Group, Avatar, Code, Loader } from '@mantine/core';
import { IconRobot, IconTerminal } from '@tabler/icons-react';

import type { CommandSuggestion } from '@/hooks/useCommandInput';

export type { CommandSuggestion };

interface CommandSuggestProps {
  suggestions: CommandSuggestion[];
  isVisible: boolean;
  position: { top: number; left: number };
  selectedIndex: number;
  isLoading?: boolean;
  onSelect: (suggestion: CommandSuggestion) => void;
  onClose: () => void;
}

export function CommandSuggest({
  suggestions,
  isVisible,
  position,
  selectedIndex,
  isLoading = false,
  onSelect,
  onClose
}: CommandSuggestProps) {
  const suggestRef = useRef<HTMLDivElement>(null);
  const selectedItemRef = useRef<HTMLButtonElement>(null);

  // Auto-scroll to selected item
  useEffect(() => {
    if (selectedItemRef.current && suggestRef.current) {
      const container = suggestRef.current;
      const selected = selectedItemRef.current;
      
      const containerRect = container.getBoundingClientRect();
      const selectedRect = selected.getBoundingClientRect();
      
      if (selectedRect.bottom > containerRect.bottom) {
        selected.scrollIntoView({ block: 'end', behavior: 'smooth' });
      } else if (selectedRect.top < containerRect.top) {
        selected.scrollIntoView({ block: 'start', behavior: 'smooth' });
      }
    }
  }, [selectedIndex]);

  if (!isVisible) {
    return null;
  }

  return (
    <Paper
      ref={suggestRef}
      shadow="lg"
      radius="md"
      p="xs"
      style={{
        position: 'absolute',
        top: position.top,
        left: position.left,
        zIndex: 1000,
        maxWidth: 400,
        maxHeight: 250,
        overflow: 'auto',
        border: '1px solid var(--mantine-color-gray-3)'
      }}
    >
      <Stack gap={2}>
        {isLoading ? (
          <Group justify="center" p="md">
            <Loader size="sm" />
            <Text size="sm" c="dimmed">Loading commands...</Text>
          </Group>
        ) : suggestions.length === 0 ? (
          <Text size="sm" c="dimmed" p="md" ta="center">
            No commands available
          </Text>
        ) : (
          <>
            <Group gap="xs" p="xs" style={{ borderBottom: '1px solid var(--mantine-color-gray-2)' }}>
              <IconTerminal size={14} />
              <Text size="xs" fw={600} c="dimmed">
                Available Commands
              </Text>
            </Group>
            {suggestions.map((suggestion, index) => (
              <UnstyledButton
                key={suggestion.id}
                ref={index === selectedIndex ? selectedItemRef : undefined}
                onClick={() => onSelect(suggestion)}
                p="xs"
                style={{
                  borderRadius: 'var(--mantine-radius-sm)',
                  backgroundColor: index === selectedIndex 
                    ? 'var(--mantine-color-blue-light)' 
                    : 'transparent',
                  color: index === selectedIndex 
                    ? 'var(--mantine-color-blue-text)' 
                    : 'inherit'
                }}
              >
                <Stack gap={4}>
                  <Group gap="xs" wrap="nowrap">
                    <Avatar
                      size="sm"
                      radius="sm"
                      color="blue"
                    >
                      <IconRobot size={14} />
                    </Avatar>
                    
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Group gap="xs" wrap="nowrap">
                        <Text size="sm" fw={600} truncate>
                          {suggestion.name}
                        </Text>
                        <Text size="xs" c="dimmed">
                          @{suggestion.botId}
                        </Text>
                      </Group>
                      <Text size="xs" c="dimmed" truncate>
                        {suggestion.description}
                      </Text>
                    </div>
                  </Group>
                  
                  {suggestion.usage && (
                    <Code style={{ fontSize: '10px' }}>
                      {suggestion.usage}
                    </Code>
                  )}
                </Stack>
              </UnstyledButton>
            ))}
          </>
        )}
      </Stack>
    </Paper>
  );
}