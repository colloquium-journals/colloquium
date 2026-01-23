'use client';

import { useState, useEffect, useRef } from 'react';
import { Paper, Stack, Text, UnstyledButton, Group, Avatar } from '@mantine/core';
import { IconRobot, IconUser } from '@tabler/icons-react';

export interface MentionSuggestion {
  id: string;
  name: string;
  displayName: string;
  type: 'user' | 'bot';
  description?: string;
  color?: string;
}

interface MentionSuggestProps {
  suggestions: MentionSuggestion[];
  isVisible: boolean;
  position: { top: number; left: number };
  selectedIndex: number;
  onSelect: (suggestion: MentionSuggestion) => void;
  onClose: () => void;
}

export function MentionSuggest({
  suggestions,
  isVisible,
  position,
  selectedIndex,
  onSelect,
  onClose
}: MentionSuggestProps) {
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

  if (!isVisible || suggestions.length === 0) {
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
        maxWidth: 320,
        maxHeight: 200,
        overflow: 'auto',
        border: '1px solid var(--mantine-color-gray-3)'
      }}
    >
      <Stack gap={2}>
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
            <Group gap="xs" wrap="nowrap">
              <Avatar
                size="sm"
                radius="sm"
                color={suggestion.type === 'bot' ? (suggestion.color || 'blue') : 'gray'}
              >
                {suggestion.type === 'bot' ? <IconRobot size={14} /> : <IconUser size={14} />}
              </Avatar>
              
              <div style={{ flex: 1, minWidth: 0 }}>
                <Text size="sm" fw={500} truncate>
                  {suggestion.displayName}
                </Text>
                {suggestion.description && (
                  <Text size="xs" c="dimmed" truncate>
                    {suggestion.description}
                  </Text>
                )}
              </div>
              
              <Text size="xs" c="dimmed">
                @{suggestion.name}
              </Text>
            </Group>
          </UnstyledButton>
        ))}
      </Stack>
    </Paper>
  );
}