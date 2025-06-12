import React from 'react';
import { Card, Group, Text, ActionIcon, Menu } from '@mantine/core';
import { IconDots, IconEye, IconEdit, IconTrash } from '@tabler/icons-react';
import { ManuscriptStatus } from '@colloquium/types';
import { StatusBadge } from './StatusBadge';

export interface ManuscriptCardProps {
  manuscript: {
    id: string;
    title: string;
    status: ManuscriptStatus;
    submittedAt: Date;
    authors: string[];
  };
  onView?: (id: string) => void;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
}

export const ManuscriptCard: React.FC<ManuscriptCardProps> = ({ 
  manuscript,
  onView,
  onEdit,
  onDelete
}) => {
  return (
    <Card>
      <Group justify="space-between" mb="xs">
        <Text fw={500} size="lg" lineClamp={2}>
          {manuscript.title}
        </Text>
        <Menu shadow="md" width={200}>
          <Menu.Target>
            <ActionIcon variant="subtle">
              <IconDots size={16} />
            </ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item leftSection={<IconEye size={14} />} onClick={() => onView?.(manuscript.id)}>
              View Details
            </Menu.Item>
            <Menu.Item leftSection={<IconEdit size={14} />} onClick={() => onEdit?.(manuscript.id)}>
              Edit
            </Menu.Item>
            <Menu.Divider />
            <Menu.Item color="red" leftSection={<IconTrash size={14} />} onClick={() => onDelete?.(manuscript.id)}>
              Delete
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </Group>

      <Group gap="xs" mb="sm">
        <StatusBadge status={manuscript.status} />
      </Group>
      
      <Text size="sm" c="dimmed" mb="xs">
        Authors: {manuscript.authors.join(', ')}
      </Text>
      
      <Text size="sm" c="dimmed">
        Submitted: {manuscript.submittedAt.toLocaleDateString()}
      </Text>
    </Card>
  );
};