'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Stack, Group, Text, Button, Paper, Badge, Switch } from '@mantine/core';
import { IconChevronDown, IconChevronUp, IconEyeOff, IconRobot } from '@tabler/icons-react';
import { MessageCard } from './MessageCard';
import { MessageComposer, MessageComposerRef } from './MessageComposer';
import { SignInPrompt } from './SignInPrompt';
import { useAuth } from '../../contexts/AuthContext';

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
  totalMessageCount?: number;
  visibleMessageCount?: number;
  messageVisibilityMap?: Array<{
    id: string;
    visible: boolean;
    createdAt: string;
  }>;
}

export function MessageThread({ 
  messages, 
  onReply, 
  onEdit, 
  conversationId, 
  onSubmit, 
  totalMessageCount,
  visibleMessageCount,
  messageVisibilityMap 
}: MessageThreadProps) {
  const [showAllMessages, setShowAllMessages] = useState(false);
  const [hideBotMessages, setHideBotMessages] = useState(() => {
    // Persist bot filter preference in localStorage
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('hideBotMessages');
      return saved === 'true';
    }
    return false;
  });
  const composerRef = useRef<MessageComposerRef>(null);
  const { user, isAuthenticated, loading: authLoading } = useAuth();

  // Persist bot filter preference
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('hideBotMessages', hideBotMessages.toString());
    }
  }, [hideBotMessages]);
  
  
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

  // Filter out bot messages if hideBotMessages is true
  const filteredMessages = hideBotMessages 
    ? allMessages.filter(message => !message.isBot)
    : allMessages;

  // Calculate counts for display
  const botMessageCount = allMessages.filter(message => message.isBot).length;
  const humanMessageCount = allMessages.length - botMessageCount;

  // Determine which messages to show
  const shouldCollapse = filteredMessages.length > 10;
  const visibleMessages = shouldCollapse && !showAllMessages 
    ? filteredMessages.slice(-5) // Show last 5 messages
    : filteredMessages;
  const hiddenCount = shouldCollapse && !showAllMessages 
    ? filteredMessages.length - 5 
    : 0;



  // Function to handle reply by scrolling to composer and prepending quoted content
  const handleReplyToMessage = (message: MessageData) => {
    // Only allow replies if user is authenticated
    if (!isAuthenticated) {
      const composerElement = document.getElementById('message-composer');
      if (composerElement) {
        composerElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

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

  // Function to create hidden messages indicator
  const createHiddenMessageIndicator = (count: number, key: string) => (
    <Group justify="center" py="xs" key={key}>
      <Paper
        shadow="xs"
        radius="md"
        px="md"
        py="xs"
        style={{
          border: '1px dashed var(--mantine-color-gray-4)',
          backgroundColor: 'var(--mantine-color-gray-0)',
          maxWidth: '300px'
        }}
      >
        <Group gap="xs" justify="center">
          <IconEyeOff size={16} color="var(--mantine-color-gray-6)" />
          <Text size="sm" c="dimmed">
            {count} message{count !== 1 ? 's' : ''} not visible to you
          </Text>
        </Group>
      </Paper>
    </Group>
  );

  // Function to build message list with hidden indicators
  const buildMessagesWithIndicators = () => {
   
    
    if (!messageVisibilityMap || !totalMessageCount || visibleMessageCount === undefined) {
      const result = visibleMessages.map(message => renderMessage(message));
      return result;
    }
    
    const result: JSX.Element[] = [];
    const sortedVisibilityMap = [...messageVisibilityMap].sort((a, b) => 
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    
    
    // Create a set of message IDs in the visibility map for fast lookup
    const visibilityMapIds = new Set(sortedVisibilityMap.map(entry => entry.id));
    
    // Find messages that are in visibleMessages but not in the visibility map
    // These are likely new messages that arrived via SSE after the initial page load
    const messagesNotInMap = visibleMessages.filter(msg => !visibilityMapIds.has(msg.id));
    
    let currentHiddenCount = 0;
    let processedMessageIds = new Set<string>();

    // Process messages from the visibility map first
    for (let i = 0; i < sortedVisibilityMap.length; i++) {
      const entry = sortedVisibilityMap[i];
      
      if (entry.visible) {
        // If we have accumulated hidden messages, show indicator
        if (currentHiddenCount > 0) {
          result.push(createHiddenMessageIndicator(currentHiddenCount, `hidden-${i}`));
          currentHiddenCount = 0;
        }
        
        // Add the visible message if it exists in our visible messages list
        const message = visibleMessages.find(m => m.id === entry.id);
        if (message) {
          result.push(renderMessage(message));
          processedMessageIds.add(message.id);
        }
      } else {
        currentHiddenCount++;
      }
    }
    
    // Add any messages that weren't in the visibility map (new messages from SSE)
    // These should be added at the end since they're typically the newest
    messagesNotInMap.forEach(message => {
      if (!processedMessageIds.has(message.id)) {
        result.push(renderMessage(message));
        processedMessageIds.add(message.id);
      }
    });
    

    // Add final hidden indicator if needed
    if (currentHiddenCount > 0) {
      result.push(createHiddenMessageIndicator(currentHiddenCount, `hidden-final`));
    }

    // If no visible messages but we have hidden ones, show a single indicator
    if (result.length === 0 && totalMessageCount > 0) {
      result.push(createHiddenMessageIndicator(totalMessageCount, 'all-hidden'));
    }

    return result;
  };

  return (
    <Stack gap="md">
      {/* Message Controls */}
      <Group justify="space-between" align="center">
        <Group gap="sm">
          <Text size="sm" c="dimmed">
            {hideBotMessages 
              ? `${humanMessageCount} human message${humanMessageCount !== 1 ? 's' : ''}` 
              : `${allMessages.length} total message${allMessages.length !== 1 ? 's' : ''}`}
            {botMessageCount > 0 && hideBotMessages && (
              <span> ({botMessageCount} bot message{botMessageCount !== 1 ? 's' : ''} hidden)</span>
            )}
          </Text>
        </Group>
        
        {botMessageCount > 0 && (
          <Group gap="sm" align="center">
            <Text size="xs" c="dimmed">
              {botMessageCount} bot message{botMessageCount !== 1 ? 's' : ''}
            </Text>
            <Switch
              size="sm"
              label="Hide bot messages"
              checked={hideBotMessages}
              onChange={(event) => setHideBotMessages(event.currentTarget.checked)}
            />
          </Group>
        )}
      </Group>

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
      
      {/* Render visible messages with hidden indicators */}
      <Stack gap="md">
        {buildMessagesWithIndicators()}
      </Stack>
      
      {messages.length === 0 && (!totalMessageCount || totalMessageCount === 0) && (
        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--mantine-color-dimmed)' }}>
          No messages yet. Start the conversation!
        </div>
      )}
      
      {/* Message Composer or Sign In Prompt */}
      <div id="message-composer">
        {authLoading ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--mantine-color-dimmed)' }}>
            Loading...
          </div>
        ) : isAuthenticated ? (
          <MessageComposer 
            ref={composerRef}
            onSubmit={onSubmit}
            placeholder="Write your message... Type @ to mention users and bots"
            conversationId={conversationId}
          />
        ) : (
          <SignInPrompt 
            redirectUrl={typeof window !== 'undefined' ? window.location.href : undefined}
          />
        )}
      </div>
    </Stack>
  );
}