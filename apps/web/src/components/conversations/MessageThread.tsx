'use client';

import { useState, useRef, useEffect } from 'react';
import { Stack, Group, Text, Button, Paper, Badge } from '@mantine/core';
import { IconChevronDown, IconChevronUp, IconEyeOff } from '@tabler/icons-react';
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
  const composerRef = useRef<MessageComposerRef>(null);
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  
  // Debug logging for messages prop changes
  useEffect(() => {
    console.log('🎭 MessageThread: Messages prop updated, count:', messages.length);
    console.log('🎭 MessageThread: Message IDs:', messages.map(m => m.id));
  }, [messages]);
  
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

  // Debug logging for message visibility
  console.log('🎨 MessageThread: Message visibility calc:', {
    totalMessages: allMessages.length,
    shouldCollapse,
    showAllMessages,
    visibleMessagesCount: visibleMessages.length,
    hiddenCount,
    lastVisibleMessageId: visibleMessages[visibleMessages.length - 1]?.id,
    visibleMessageIds: visibleMessages.map(m => m.id),
    lastFewAllMessages: allMessages.slice(-3).map(m => ({ id: m.id, content: m.content }))
  });

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
    console.log('🎬 MessageThread: Rendering message:', message.id, message.content);
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
    console.log('🎪 MessageThread: buildMessagesWithIndicators called');
    console.log('🎪 MessageThread: visibleMessages count:', visibleMessages.length);
    console.log('🎪 MessageThread: visibleMessages IDs:', visibleMessages.map(m => m.id));
    
    if (!messageVisibilityMap || !totalMessageCount || visibleMessageCount === undefined) {
      console.log('🎪 MessageThread: Using simple rendering (no visibility data)');
      const result = visibleMessages.map(message => renderMessage(message));
      console.log('🎪 MessageThread: Simple render result count:', result.length);
      return result;
    }

    console.log('🎪 MessageThread: Using complex rendering with visibility indicators');
    
    const result: JSX.Element[] = [];
    const sortedVisibilityMap = [...messageVisibilityMap].sort((a, b) => 
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    
    console.log('🎪 MessageThread: sortedVisibilityMap length:', sortedVisibilityMap.length);
    console.log('🎪 MessageThread: visibleMessages length:', visibleMessages.length);
    
    // Create a set of message IDs in the visibility map for fast lookup
    const visibilityMapIds = new Set(sortedVisibilityMap.map(entry => entry.id));
    
    // Find messages that are in visibleMessages but not in the visibility map
    // These are likely new messages that arrived via SSE after the initial page load
    const messagesNotInMap = visibleMessages.filter(msg => !visibilityMapIds.has(msg.id));
    console.log('🎪 MessageThread: Messages not in visibility map:', messagesNotInMap.map(m => m.id));
    
    let currentHiddenCount = 0;
    let processedMessageIds = new Set<string>();

    // Process messages from the visibility map first
    for (let i = 0; i < sortedVisibilityMap.length; i++) {
      const entry = sortedVisibilityMap[i];
      console.log(`🎪 MessageThread: Processing entry ${i}:`, entry.id, 'visible:', entry.visible);
      
      if (entry.visible) {
        // If we have accumulated hidden messages, show indicator
        if (currentHiddenCount > 0) {
          console.log('🎪 MessageThread: Adding hidden indicator for', currentHiddenCount, 'messages');
          result.push(createHiddenMessageIndicator(currentHiddenCount, `hidden-${i}`));
          currentHiddenCount = 0;
        }
        
        // Add the visible message if it exists in our visible messages list
        const message = visibleMessages.find(m => m.id === entry.id);
        console.log('🎪 MessageThread: Looking for message', entry.id, 'found:', !!message);
        if (message) {
          console.log('🎪 MessageThread: Adding visible message:', message.id);
          result.push(renderMessage(message));
          processedMessageIds.add(message.id);
        }
      } else {
        console.log('🎪 MessageThread: Message not visible, incrementing hidden count');
        currentHiddenCount++;
      }
    }
    
    // Add any messages that weren't in the visibility map (new messages from SSE)
    // These should be added at the end since they're typically the newest
    messagesNotInMap.forEach(message => {
      if (!processedMessageIds.has(message.id)) {
        console.log('🎪 MessageThread: Adding new message not in visibility map:', message.id);
        result.push(renderMessage(message));
        processedMessageIds.add(message.id);
      }
    });
    
    console.log('🎪 MessageThread: Complex render result count:', result.length);

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