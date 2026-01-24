'use client';

import { useState } from 'react';
import { Group, Button, Modal, Text, Stack } from '@mantine/core';
import { useAuth } from '@/contexts/AuthContext';

interface BotMessageAction {
  id: string;
  label: string;
  style?: 'primary' | 'secondary' | 'danger';
  confirmText?: string;
  targetUserId?: string;
  targetRoles?: string[];
  resultLabel?: string;
  triggered?: boolean;
  triggeredBy?: string;
  triggeredAt?: string;
}

interface MessageActionsProps {
  messageId: string;
  actions: BotMessageAction[];
  onActionTriggered?: (updatedMessage: any) => void;
}

export function MessageActions({ messageId, actions, onActionTriggered }: MessageActionsProps) {
  const { user } = useAuth();
  const [pendingAction, setPendingAction] = useState<BotMessageAction | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

  const isAuthorized = (action: BotMessageAction): boolean => {
    if (!user) return false;
    if (action.targetUserId && action.targetUserId !== user.id) return false;
    if (action.targetRoles?.length && !action.targetRoles.includes(user.role || '')) return false;
    return true;
  };

  const triggerAction = async (action: BotMessageAction) => {
    setLoading(action.id);
    setPendingAction(null);

    try {
      const response = await fetch(`http://localhost:4000/api/messages/${messageId}/actions/${action.id}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.ok) {
        const result = await response.json();
        onActionTriggered?.(result.data);
      }
    } catch (error) {
      console.error('Failed to trigger action:', error);
    } finally {
      setLoading(null);
    }
  };

  const handleClick = (action: BotMessageAction) => {
    if (action.confirmText) {
      setPendingAction(action);
    } else {
      triggerAction(action);
    }
  };

  const getButtonVariant = (action: BotMessageAction): string => {
    if (action.triggered) return 'light';
    switch (action.style) {
      case 'danger': return 'light';
      case 'secondary': return 'subtle';
      default: return 'light';
    }
  };

  const getButtonColor = (action: BotMessageAction): string => {
    if (action.triggered) return 'gray';
    switch (action.style) {
      case 'danger': return 'red';
      case 'secondary': return 'gray';
      default: return 'blue';
    }
  };

  const visibleActions = actions.filter(a => isAuthorized(a));

  if (visibleActions.length === 0) return null;

  return (
    <>
      <Group gap="xs" mt="xs">
        {visibleActions.map(action => (
          <Button
            key={action.id}
            size="xs"
            variant={getButtonVariant(action)}
            color={getButtonColor(action)}
            disabled={action.triggered || false}
            loading={loading === action.id}
            onClick={() => handleClick(action)}
          >
            {action.triggered ? (action.resultLabel || `${action.label} (done)`) : action.label}
          </Button>
        ))}
      </Group>

      <Modal
        opened={!!pendingAction}
        onClose={() => setPendingAction(null)}
        title="Confirm Action"
        size="sm"
      >
        <Stack gap="md">
          <Text size="sm">{pendingAction?.confirmText}</Text>
          <Group justify="flex-end">
            <Button variant="subtle" onClick={() => setPendingAction(null)}>
              Cancel
            </Button>
            <Button
              color={pendingAction?.style === 'danger' ? 'red' : 'blue'}
              onClick={() => pendingAction && triggerAction(pendingAction)}
              loading={loading === pendingAction?.id}
            >
              Confirm
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
