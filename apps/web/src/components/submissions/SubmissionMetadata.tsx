'use client';

import {
  Text,
  Group,
  Badge,
  Avatar,
} from '@mantine/core';
import {
  IconCalendar,
  IconUser,
  IconClock,
  IconEye,
  IconUserCog,
} from '@tabler/icons-react';

interface SubmissionData {
  id: string;
  title: string;
  abstract?: string;
  status: string;
  submittedAt: string;
  updatedAt: string;
  authors: Array<{
    id: string;
    name: string;
    email: string;
    affiliation?: string;
    isCorresponding?: boolean;
  }>;
  keywords?: string[];
  files?: Array<{
    id: string;
    filename: string;
    originalName: string;
    size: number;
    fileType: string;
    mimetype: string;
    uploadedAt: string;
  }>;
  assignedEditor?: {
    id: string;
    name: string;
    email: string;
    affiliation?: string;
    assignedAt: string;
  };
  reviewAssignments?: Array<{
    id: string;
    reviewer: {
      name: string;
      affiliation?: string;
    };
    status: string;
    assignedAt: string;
    dueDate?: string;
  }>;
}

interface SubmissionMetadataProps {
  submission: SubmissionData;
}

export function SubmissionMetadata({ submission }: SubmissionMetadataProps) {
  return (
    <>
      {/* Authors */}
      <Group gap="xs" align="center">
        <IconUser size={16} />
        <Text fw={500} size="sm">Authors:</Text>
        <Group gap="md">
          {submission.authors.map((author) => (
            <Group key={author.id} gap="xs">
              <Avatar size="xs" color="blue">
                {author.name.split(' ').map(n => n[0]).join('').toUpperCase()}
              </Avatar>
              <Text size="sm" fw={500}>{author.name}</Text>
              {author.isCorresponding && (
                <Badge size="xs" variant="light" color="orange">Corresponding</Badge>
              )}
              {author.affiliation && (
                <Text size="xs" c="dimmed">({author.affiliation})</Text>
              )}
            </Group>
          ))}
        </Group>
      </Group>

      {/* Assigned Editor */}
      <Group gap="xs" align="center">
        <IconUserCog size={16} />
        <Text fw={500} size="sm">Editor:</Text>
        {submission.assignedEditor ? (
          <Group gap="xs">
            <Avatar size="xs" color="indigo">
              {submission.assignedEditor.name.split(' ').map(n => n[0]).join('').toUpperCase()}
            </Avatar>
            <Text size="sm" fw={500}>{submission.assignedEditor.name}</Text>
            {submission.assignedEditor.affiliation && (
              <Text size="xs" c="dimmed">({submission.assignedEditor.affiliation})</Text>
            )}
          </Group>
        ) : (
          <Text size="sm" c="dimmed" style={{ fontStyle: 'italic' }}>
            No editor assigned
          </Text>
        )}
      </Group>

      {/* Assigned Reviewers */}
      <Group gap="xs" align="center">
        <IconEye size={16} />
        <Text fw={500} size="sm">Reviewers:</Text>
        {submission.reviewAssignments && submission.reviewAssignments.length > 0 ? (
          <Group gap="md">
            {submission.reviewAssignments.map((assignment) => (
              <Group key={assignment.id} gap="xs">
                <Avatar size="xs" color="grape">
                  {(assignment.reviewer.name || 'R').split(' ').map((n: string) => n[0]).join('').toUpperCase()}
                </Avatar>
                <Text size="sm" fw={500}>{assignment.reviewer.name}</Text>
              </Group>
            ))}
          </Group>
        ) : (
          <Text size="sm" c="dimmed" style={{ fontStyle: 'italic' }}>
            No reviewers assigned
          </Text>
        )}
      </Group>

      {/* Dates */}
      <Group gap="xl">
        <Group gap="xs">
          <IconCalendar size={14} />
          <Text size="sm" c="dimmed">
            Submitted: {new Date(submission.submittedAt).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric'
            })}
          </Text>
        </Group>

        <Group gap="xs">
          <IconClock size={14} />
          <Text size="sm" c="dimmed">
            Updated: {new Date(submission.updatedAt).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric'
            })}
          </Text>
        </Group>
      </Group>
    </>
  );
}
