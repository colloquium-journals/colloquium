'use client';

import { useEffect, useRef } from 'react';
import { Paper, Group, Text, Badge, Code, Stack, Divider } from '@mantine/core';
import type { BotCommandParameter, ActiveCommandInfo } from '@/hooks/useCommandInput';

interface ParameterHintsProps {
  activeCommand: ActiveCommandInfo | null;
  onClose: () => void;
}

function ParameterItem({ param }: { param: BotCommandParameter }) {
  const getTypeColor = (type: string) => {
    switch (type) {
      case 'enum': return 'grape';
      case 'string': return 'blue';
      case 'number': return 'teal';
      case 'boolean': return 'orange';
      case 'array': return 'cyan';
      default: return 'gray';
    }
  };

  const formatEnumValues = (values: string[]) => {
    return values.join(' | ');
  };

  return (
    <Stack gap={4} p="xs" style={{
      borderRadius: 'var(--mantine-radius-sm)',
      backgroundColor: 'var(--mantine-color-gray-0)'
    }}>
      <Group gap="xs" wrap="nowrap">
        <Badge
          size="xs"
          variant={param.required ? 'filled' : 'light'}
          color={getTypeColor(param.type)}
        >
          {param.type}
        </Badge>
        <Text size="sm" fw={600}>
          {param.name}
        </Text>
        {!param.required && (
          <Text size="xs" c="dimmed">(optional)</Text>
        )}
      </Group>

      <Text size="xs" c="dimmed">
        {param.description}
      </Text>

      {param.type === 'enum' && param.enumValues && (
        <Group gap={4}>
          <Text size="xs" c="dimmed">Values:</Text>
          <Code style={{ fontSize: '10px' }}>
            {formatEnumValues(param.enumValues)}
          </Code>
        </Group>
      )}

      {param.defaultValue !== undefined && (
        <Group gap={4}>
          <Text size="xs" c="dimmed">Default:</Text>
          <Code style={{ fontSize: '10px' }}>{String(param.defaultValue)}</Code>
        </Group>
      )}

      {param.examples && param.examples.length > 0 && (
        <Group gap={4}>
          <Text size="xs" c="dimmed">Example:</Text>
          <Code style={{ fontSize: '10px' }}>{param.name}="{param.examples[0]}"</Code>
        </Group>
      )}
    </Stack>
  );
}

export function ParameterHints({ activeCommand, onClose }: ParameterHintsProps) {
  const paperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!activeCommand) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      // Don't close when clicking the textarea - let cursor change handle it
      if (target.tagName === 'TEXTAREA') return;
      if (paperRef.current && !paperRef.current.contains(target)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [activeCommand, onClose]);

  if (!activeCommand?.command?.parameters || activeCommand.command.parameters.length === 0) {
    return null;
  }

  const { command, position } = activeCommand;
  const requiredParams = command.parameters.filter(p => p.required);
  const optionalParams = command.parameters.filter(p => !p.required);

  return (
    <Paper
      ref={paperRef}
      shadow="lg"
      radius="md"
      p="xs"
      style={{
        position: 'absolute',
        top: position.top,
        left: position.left,
        zIndex: 1000,
        maxWidth: 350,
        maxHeight: 300,
        overflow: 'auto',
        border: '1px solid var(--mantine-color-gray-3)'
      }}
    >
      <Stack gap="xs">
        <Text size="xs" fw={600} c="dimmed" px="xs" pb={4} style={{ borderBottom: '1px solid var(--mantine-color-gray-2)' }}>
          Parameters for {command.name}
        </Text>

        {requiredParams.length > 0 && (
          <>
            <Text size="xs" fw={500} c="dimmed" px="xs">Required</Text>
            {requiredParams.map(param => (
              <ParameterItem key={param.name} param={param} />
            ))}
          </>
        )}

        {optionalParams.length > 0 && (
          <>
            {requiredParams.length > 0 && <Divider />}
            <Text size="xs" fw={500} c="dimmed" px="xs">Optional</Text>
            {optionalParams.map(param => (
              <ParameterItem key={param.name} param={param} />
            ))}
          </>
        )}

        <Text size="xs" c="dimmed" px="xs" pb="xs">
          Format: <Code style={{ fontSize: '10px' }}>name="value"</Code>
        </Text>
      </Stack>
    </Paper>
  );
}
