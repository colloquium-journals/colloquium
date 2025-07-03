'use client';

import { useState, useRef } from 'react';
import { Stack, Group, Text, Button, Paper } from '@mantine/core';
import { IconChevronDown, IconChevronUp } from '@tabler/icons-react';
import { MessageCard } from './MessageCard';
import { MessageComposer, MessageComposerRef } from './MessageComposer';

interface MessageData {
  id: string;
  content: string;
  privacy: string;
  author: {
    id: string;
    name: string;
    email: string;
    role?: string;
    affiliation?: string;
    orcid?: string;
    joinedAt?: string;
    bio?: string;
  };
  createdAt: string;
  editedAt?: string;
  isBot: boolean;
  parentId?: string;
}

interface MessageThreadProps {
  messages: MessageData[];
  onReply: (messageId: string, content: string) => void;
  onEdit: (messageId: string, content: string, reason?: string) => void;
  conversationId: string;
  onSubmit: (content: string, privacy?: string) => void;
}

export function MessageThread({ messages, onReply, onEdit, conversationId, onSubmit }: MessageThreadProps) {
  const [showAllMessages, setShowAllMessages] = useState(false);
  const composerRef = useRef<MessageComposerRef>(null);
  
  // Build a flat list of all messages (no hierarchy)
  const messageMap = new Map<string, MessageData>();
  
  // Build the message map for easy lookup
  messages.forEach(message => {
    messageMap.set(message.id, message);
  });

  // Sort all messages by creation time (flat structure)
  const allMessages = [...messages].sort((a, b) => 
    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  // Determine which messages to show
  const shouldCollapse = allMessages.length > 10;
  const visibleMessages = shouldCollapse && !showAllMessages 
    ? allMessages.slice(-5) // Show last 5 messages
    : allMessages;
  const hiddenCount = shouldCollapse && !showAllMessages 
    ? allMessages.length - 5 
    : 0;

  // Function to handle reply by scrolling to composer and prepending quoted content
  const handleReplyToMessage = (message: MessageData) => {
    const quotedContent = getQuotedReply(message, '');
    
    // Prepend the quoted content to the composer
    composerRef.current?.prependContent(quotedContent);
    
    // Scroll to the composer
    const composerElement = document.getElementById('message-composer');
    if (composerElement) {
      composerElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    
    // Focus the composer
    setTimeout(() => {
      composerRef.current?.focus();
    }, 300); // Small delay to allow scroll to complete
  };

  // Simple function to render a message (no hierarchy)
  const renderMessage = (message: MessageData): JSX.Element => {
    return (
      <MessageCard
        key={message.id}
        message={message}
        onReply={() => handleReplyToMessage(message)}
        onEdit={(messageId, content, reason) => onEdit(messageId, content, reason)}
        isReply={false}
        conversationId={conversationId}
      />
    );
  };

  // Helper function to create quoted reply content
  const getQuotedReply = (originalMessage: MessageData, replyContent: string): string => {
    const messageAnchor = `#message-${originalMessage.id}`;
    let quotedText = originalMessage.content.length > 100 
      ? originalMessage.content.substring(0, 100) + '...' 
      : originalMessage.content;
    
    // Prefix each line with "> " for proper markdown blockquote formatting
    quotedText = quotedText
      .split('\n')
      .map(line => `> ${line}`)
      .join('\n');
    
    return `In reply to [${originalMessage.author.name}](${messageAnchor}):\n\n${quotedText}\n\n${replyContent}`;
  };

  return (
    <Stack gap="md">
      {/* Show hidden messages indicator */}
      {hiddenCount > 0 && (
        <Group justify="center" py="md">
          <Paper
            shadow="sm"
            radius="md"
            p="md"
            style={{
              border: '1px solid var(--mantine-color-gray-3)',
              backgroundColor: 'white',
              maxWidth: '400px'
            }}
          >
            <Group justify="center">
              <Button
                variant="subtle"
                size="sm"
                leftSection={<IconChevronDown size={16} />}
                onClick={() => setShowAllMessages(true)}
              >
                Show {hiddenCount} older message{hiddenCount !== 1 ? 's' : ''}
              </Button>
            </Group>
          </Paper>
        </Group>
      )}
      
      {/* Render visible messages */}
      <Stack gap="md">
        {visibleMessages.map(message => renderMessage(message))}
      </Stack>
      
      {/* Show collapse button when all messages are visible */}
      {shouldCollapse && showAllMessages && (
        <Group justify="center" py="md">
          <Paper
            shadow="sm"
            radius="md"
            p="md"
            style={{
              border: '1px solid var(--mantine-color-gray-3)',
              backgroundColor: 'white',
              maxWidth: '400px'
            }}
          >
            <Group justify="center">
              <Button
                variant="subtle"
                size="sm"
                leftSection={<IconChevronUp size={16} />}
                onClick={() => setShowAllMessages(false)}
              >
                Show only recent messages
              </Button>
            </Group>
          </Paper>
        </Group>
      )}
      
      {messages.length === 0 && (
        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--mantine-color-dimmed)' }}>
          No messages yet. Start the conversation!
        </div>
      )}
      
      {/* Message Composer */}
      <div id="message-composer">
        <MessageComposer 
          ref={composerRef}
          onSubmit={onSubmit}
          placeholder="Write your message... Type @ to mention users and bots"
          conversationId={conversationId}
        />
      </div>
    </Stack>
  );
}