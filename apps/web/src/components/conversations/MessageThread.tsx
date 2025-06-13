'use client';

import { Stack } from '@mantine/core';
import { MessageCard } from './MessageCard';

interface MessageData {
  id: string;
  content: string;
  author: {
    name: string;
    email: string;
  };
  createdAt: string;
  isBot: boolean;
  parentId?: string;
}

interface MessageThreadProps {
  messages: MessageData[];
  onReply: (messageId: string, content: string) => void;
}

export function MessageThread({ messages, onReply }: MessageThreadProps) {
  // Build a tree structure for threaded messages
  const messageMap = new Map<string, MessageData>();
  const children = new Map<string, MessageData[]>();
  const rootMessages: MessageData[] = [];

  // First pass: build the message map
  messages.forEach(message => {
    messageMap.set(message.id, message);
  });

  // Second pass: organize into parent-child relationships
  messages.forEach(message => {
    if (message.parentId) {
      if (!children.has(message.parentId)) {
        children.set(message.parentId, []);
      }
      children.get(message.parentId)!.push(message);
    } else {
      rootMessages.push(message);
    }
  });

  // Sort root messages by creation time
  rootMessages.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  // Recursive component to render a message and its replies
  const renderMessage = (message: MessageData, depth = 0): JSX.Element => {
    const messageChildren = children.get(message.id) || [];
    const sortedChildren = messageChildren.sort((a, b) => 
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    return (
      <div key={message.id} style={{ marginLeft: depth > 0 ? 24 : 0 }}>
        <MessageCard
          message={message}
          onReply={(content) => onReply(message.id, content)}
          isReply={depth > 0}
        />
        {sortedChildren.length > 0 && (
          <Stack gap="sm" mt="sm">
            {sortedChildren.map(childMessage => renderMessage(childMessage, depth + 1))}
          </Stack>
        )}
      </div>
    );
  };

  return (
    <Stack gap="md">
      {rootMessages.map(message => renderMessage(message))}
      {messages.length === 0 && (
        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--mantine-color-dimmed)' }}>
          No messages yet. Start the conversation!
        </div>
      )}
    </Stack>
  );
}