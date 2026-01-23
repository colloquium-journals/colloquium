'use client';

import { useState } from 'react';
import {
  Group,
  Text,
  Avatar,
  ActionIcon,
  Menu,
  Badge,
  Stack,
  Tooltip,
  Modal,
  TextInput,
  Textarea,
  Button
} from '@mantine/core';
import {
  IconDots,
  IconArrowBack,
  IconFlag,
  IconEye,
  IconLock,
  IconUsers,
  IconShield,
  IconEdit,
  IconHistory,
  IconLink
} from '@tabler/icons-react';
import { useAuth } from '@/contexts/AuthContext';
import { MessageContent } from './MessageContent';
import { UserProfileHover } from '../shared';

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
}

interface MessageCardProps {
  message: MessageData;
  onReply: (content: string) => void;
  onEdit?: (messageId: string, content: string, reason?: string) => void;
  onPrivacyChange?: (messageId: string, privacy: string) => void;
  isReply?: boolean;
  conversationId: string;
  isActionEditor?: boolean;
}

export function MessageCard({ message, onReply, onEdit, onPrivacyChange, isReply = false, conversationId, isActionEditor = false }: MessageCardProps) {
  const [showEditModal, setShowEditModal] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [editReason, setEditReason] = useState('');
  const [isEditSubmitting, setIsEditSubmitting] = useState(false);
  const [currentPrivacy, setCurrentPrivacy] = useState(message.privacy);
  const { user } = useAuth();

  const copyMessageLink = () => {
    const messageUrl = `${window.location.href.split('#')[0]}#message-${message.id}`;
    navigator.clipboard.writeText(messageUrl);
    // TODO: Show toast notification
  };

  const handleReply = () => {
    onReply(''); // Let the parent handle the reply logic
  };


  const handleEdit = async () => {
    if (!editContent.trim() || !onEdit) return;
    
    setIsEditSubmitting(true);
    try {
      await onEdit(message.id, editContent, editReason || undefined);
      setShowEditModal(false);
      setEditReason('');
    } finally {
      setIsEditSubmitting(false);
    }
  };

  // Check if user can edit this message
  const canEdit = () => {
    if (!user || message.isBot) return false;

    const isAuthor = user.id === message.author.id;
    const isAdmin = user.role === 'ADMIN';
    const isEditor = user.role === 'EDITOR_IN_CHIEF' || user.role === 'MANAGING_EDITOR';

    // Authors can edit within 24 hours, admins/editors anytime
    if (isAdmin || isEditor) return true;

    if (isAuthor) {
      const hoursSinceCreated = (Date.now() - new Date(message.createdAt).getTime()) / (1000 * 60 * 60);
      return hoursSinceCreated <= 24;
    }

    return false;
  };

  // Check if user can edit visibility
  const canEditVisibility = () => {
    if (!user) return false;
    const isAdmin = user.role === 'ADMIN';
    const isEditor = user.role === 'EDITOR_IN_CHIEF' || user.role === 'MANAGING_EDITOR';
    return isAdmin || isEditor || isActionEditor;
  };

  const handlePrivacyChange = async (newPrivacy: string) => {
    if (newPrivacy === currentPrivacy) return;

    try {
      const response = await fetch(`http://localhost:4000/api/messages/${message.id}/privacy`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ privacy: newPrivacy }),
      });

      if (response.ok) {
        setCurrentPrivacy(newPrivacy);
        onPrivacyChange?.(message.id, newPrivacy);
      }
    } catch (error) {
      console.error('Failed to update message visibility:', error);
    }
  };

  const privacyOptions = [
    { value: 'PUBLIC', label: 'Public', icon: IconEye, color: 'green' },
    { value: 'AUTHOR_VISIBLE', label: 'Authors & Reviewers', icon: IconUsers, color: 'blue' },
    { value: 'REVIEWER_ONLY', label: 'Reviewers Only', icon: IconShield, color: 'orange' },
    { value: 'EDITOR_ONLY', label: 'Editors Only', icon: IconLock, color: 'red' },
    { value: 'ADMIN_ONLY', label: 'Admins Only', icon: IconLock, color: 'red' },
  ];

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor(diffMs / (1000 * 60));

    if (diffMinutes < 60) {
      return `${diffMinutes} ${diffMinutes === 1 ? 'minute' : 'minutes'} ago`;
    } else if (diffHours < 24) {
      return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const getVisibilityInfo = (privacy: string) => {
    switch (privacy) {
      case 'PUBLIC':
        return {
          icon: IconEye,
          label: 'Public',
          tooltip: 'Visible to everyone',
          color: 'green'
        };
      case 'AUTHOR_VISIBLE':
        return {
          icon: IconUsers,
          label: 'Authors & Reviewers',
          tooltip: 'Hidden from the public',
          color: 'blue'
        };
      case 'REVIEWER_ONLY':
        return {
          icon: IconShield,
          label: 'Reviewers Only',
          tooltip: 'Hidden from authors',
          color: 'orange'
        };
      case 'EDITOR_ONLY':
        return {
          icon: IconLock,
          label: 'Editors Only',
          tooltip: 'Hidden from authors and reviewers',
          color: 'red'
        };
      case 'ADMIN_ONLY':
        return {
          icon: IconLock,
          label: 'Admins Only',
          tooltip: 'Hidden from editors',
          color: 'red'
        };
      default:
        return {
          icon: IconEye,
          label: 'Unknown',
          tooltip: 'Visibility level unknown',
          color: 'gray'
        };
    }
  };

  const visibilityInfo = getVisibilityInfo(currentPrivacy);

  return (
    <div
      id={`message-${message.id}`}
      style={{ 
        border: '1px solid var(--mantine-color-gray-3)',
        borderLeft: isReply ? '4px solid var(--mantine-color-blue-4)' : '1px solid var(--mantine-color-gray-3)',
        borderRadius: 'var(--mantine-radius-md)',
        padding: 'var(--mantine-spacing-lg)',
        backgroundColor: isReply ? 'var(--mantine-color-gray-0)' : 'white',
        scrollMarginTop: '2rem'
      }}
    >
      <Stack gap="sm">
        {/* Message Header */}
        <Group justify="space-between" align="flex-start">
          <Group gap="sm">
            <UserProfileHover 
              user={{
                name: message.author.name,
                email: message.author.email,
                isBot: message.isBot,
                role: message.author.role,
                affiliation: message.author.affiliation,
                orcid: message.author.orcid,
                joinedAt: message.author.joinedAt,
                bio: message.author.bio
              }}
              disabled={message.isBot}
            >
              <Avatar 
                size="md" 
                color={message.isBot ? 'blue' : 'gray'}
                radius="xl"
                style={{ cursor: message.isBot ? 'default' : 'pointer' }}
              >
                {message.isBot ? '🤖' : getInitials(message.author.name)}
              </Avatar>
            </UserProfileHover>
            <div>
              <Group gap="xs" align="center">
                <UserProfileHover 
                  user={{
                    name: message.author.name,
                    email: message.author.email,
                    isBot: message.isBot,
                    role: message.author.role,
                    affiliation: message.author.affiliation,
                    orcid: message.author.orcid,
                    joinedAt: message.author.joinedAt,
                    bio: message.author.bio
                  }}
                  disabled={message.isBot}
                >
                  <Text 
                    size="sm" 
                    fw={500}
                    style={{ cursor: message.isBot ? 'default' : 'pointer' }}
                  >
                    {message.author.name}
                  </Text>
                </UserProfileHover>
                {message.isBot && (
                  <Badge size="xs" variant="light" color="blue">
                    Bot
                  </Badge>
                )}
              </Group>
              <Group gap="xs" align="center">
                <Text size="xs" c="dimmed">
                  {formatTimestamp(message.createdAt)}
                  {message.editedAt && (
                    <Text size="xs" c="dimmed" component="span" ml="xs">
                      (edited)
                    </Text>
                  )}
                </Text>
              </Group>
            </div>
          </Group>

          <Group gap="sm" align="center">
            <Tooltip label={visibilityInfo.tooltip} withArrow>
              <Badge 
                size="xs" 
                variant="light" 
                color={visibilityInfo.color}
                leftSection={<visibilityInfo.icon size={10} />}
              >
                {visibilityInfo.label}
              </Badge>
            </Tooltip>
            
            <Menu shadow="md" width={200} position="bottom-end">
              <Menu.Target>
                <ActionIcon variant="subtle" size="sm">
                  <IconDots size={14} />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item 
                  leftSection={<IconArrowBack size={14} />}
                  onClick={handleReply}
                >
                  Reply
                </Menu.Item>
                <Menu.Item 
                  leftSection={<IconLink size={14} />}
                  onClick={copyMessageLink}
                >
                  Copy Link
                </Menu.Item>
                {canEdit() && (
                  <Menu.Item 
                    leftSection={<IconEdit size={14} />}
                    onClick={() => {
                      setEditContent(message.content);
                      setShowEditModal(true);
                    }}
                  >
                    Edit
                  </Menu.Item>
                )}
                {canEditVisibility() && (
                  <>
                    <Menu.Divider />
                    <Menu.Label>Change visibility</Menu.Label>
                    {privacyOptions.map((option) => (
                      <Menu.Item
                        key={option.value}
                        leftSection={<option.icon size={14} />}
                        color={option.value === currentPrivacy ? option.color : undefined}
                        fw={option.value === currentPrivacy ? 600 : undefined}
                        disabled={option.value === currentPrivacy}
                        onClick={() => handlePrivacyChange(option.value)}
                      >
                        {option.label}
                      </Menu.Item>
                    ))}
                  </>
                )}
                {message.editedAt && (
                  <>
                    <Menu.Divider />
                    <Menu.Item
                      leftSection={<IconHistory size={14} />}
                      onClick={() => {
                        // TODO: Show edit history modal
                        console.log('Show edit history for message', message.id);
                      }}
                    >
                      Edit History
                    </Menu.Item>
                  </>
                )}
                <Menu.Divider />
                <Menu.Item
                  leftSection={<IconFlag size={14} />}
                  color="red"
                >
                  Report
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Group>

        {/* Message Content */}
        <MessageContent 
          content={message.content}
          conversationId={conversationId}
          messageId={message.id}
          size="sm"
        />

      </Stack>

      {/* Edit Modal */}
      <Modal
        opened={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Edit Message"
        size="lg"
      >
        <Stack gap="md">
          <Textarea
            label="Message Content"
            placeholder="Edit your message..."
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            minRows={4}
            autosize
            required
          />
          
          {user && (user.role === 'ADMIN' || user.role === 'EDITOR_IN_CHIEF' || user.role === 'MANAGING_EDITOR') && (
            <TextInput
              label="Edit Reason (Optional)"
              placeholder="Reason for editing this message..."
              value={editReason}
              onChange={(e) => setEditReason(e.target.value)}
            />
          )}

          <Group justify="flex-end">
            <Button
              variant="subtle"
              onClick={() => {
                setShowEditModal(false);
                setEditContent(message.content);
                setEditReason('');
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleEdit}
              loading={isEditSubmitting}
              disabled={!editContent.trim() || editContent === message.content}
            >
              Save Changes
            </Button>
          </Group>
        </Stack>
      </Modal>
    </div>
  );
}