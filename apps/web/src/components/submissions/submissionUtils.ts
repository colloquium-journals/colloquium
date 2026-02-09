import React from 'react';
import {
  IconFileText,
  IconClock,
  IconCheck,
  IconX,
  IconEye,
  IconFiles,
  IconPhoto,
  IconCode,
  IconAlertCircle
} from '@tabler/icons-react';

export function getFileIcon(fileType: string, mimetype: string) {
  if (fileType === 'ASSET') {
    if (mimetype.startsWith('image/')) {
      return React.createElement(IconPhoto, { size: 16, color: 'var(--mantine-color-green-6)' });
    }
    return React.createElement(IconFiles, { size: 16, color: 'var(--mantine-color-blue-6)' });
  }

  if (fileType === 'SOURCE') {
    if (mimetype.includes('markdown')) {
      return React.createElement(IconCode, { size: 16, color: 'var(--mantine-color-violet-6)' });
    }
    return React.createElement(IconFileText, { size: 16, color: 'var(--mantine-color-orange-6)' });
  }

  return React.createElement(IconFileText, { size: 16, color: 'var(--mantine-color-gray-6)' });
}

export function getFileTypeColor(fileType: string): string {
  switch (fileType) {
    case 'SOURCE':
      return 'orange';
    case 'ASSET':
      return 'green';
    case 'RENDERED':
      return 'blue';
    case 'SUPPLEMENTARY':
      return 'purple';
    default:
      return 'gray';
  }
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export function getFileTypeLabel(mimetype: string): string {
  const typeMap: { [key: string]: string } = {
    'text/markdown': 'Markdown',
    'application/pdf': 'PDF',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word',
    'text/plain': 'Text',
    'image/png': 'PNG Image',
    'image/jpeg': 'JPEG Image',
    'image/gif': 'GIF Image',
    'image/svg+xml': 'SVG Image'
  };

  return typeMap[mimetype] || mimetype.split('/')[1]?.toUpperCase() || 'Unknown';
}

export function getStatusColor(status: string): string {
  switch (status.toUpperCase()) {
    case 'SUBMITTED':
    case 'UNDER_REVIEW':
      return 'blue';
    case 'ACCEPTED':
      return 'green';
    case 'REJECTED':
      return 'red';
    case 'REVISION_REQUESTED':
      return 'yellow';
    case 'PUBLISHED':
      return 'teal';
    default:
      return 'gray';
  }
}

export function getStatusIcon(status: string) {
  switch (status.toUpperCase()) {
    case 'SUBMITTED':
      return React.createElement(IconClock, { size: 12 });
    case 'UNDER_REVIEW':
      return React.createElement(IconEye, { size: 12 });
    case 'ACCEPTED':
      return React.createElement(IconCheck, { size: 12 });
    case 'REJECTED':
      return React.createElement(IconX, { size: 12 });
    case 'REVISION_REQUESTED':
      return React.createElement(IconAlertCircle, { size: 12 });
    case 'PUBLISHED':
      return React.createElement(IconCheck, { size: 12 });
    default:
      return React.createElement(IconFileText, { size: 12 });
  }
}

export function getStatusLabel(status: string): string {
  switch (status.toUpperCase()) {
    case 'SUBMITTED':
      return 'Submitted';
    case 'UNDER_REVIEW':
      return 'Under Review';
    case 'ACCEPTED':
      return 'Accepted';
    case 'REJECTED':
      return 'Rejected';
    case 'REVISION_REQUESTED':
      return 'Revision Requested';
    case 'PUBLISHED':
      return 'Published';
    default:
      return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
  }
}
