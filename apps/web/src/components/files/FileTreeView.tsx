'use client';

import { useState } from 'react';
import { 
  Stack, 
  Group, 
  Text, 
  ActionIcon, 
  Box,
  Tooltip,
  Collapse
} from '@mantine/core';
import { 
  IconFolder,
  IconFolderOpen,
  IconFile,
  IconFileText,
  IconPhoto,
  IconFile3d,
  IconFileZip,
  IconFileCode,
  IconDatabase,
  IconChevronRight,
  IconChevronDown,
  IconX,
  IconDownload
} from '@tabler/icons-react';

export interface FileNode {
  id: string;
  name: string;
  path: string;
  type: 'file' | 'folder';
  size?: number;
  mimetype?: string;
  children?: FileNode[];
  file?: File; // Original File object for uploads
}

interface FileTreeViewProps {
  files: FileNode[];
  onRemoveFile?: (path: string) => void;
  onDownloadFile?: (node: FileNode) => void;
  showActions?: boolean;
  maxDepth?: number;
  currentDepth?: number;
}

const getFileIcon = (mimetype?: string, fileName?: string) => {
  if (!mimetype && !fileName) return IconFile;
  
  const ext = fileName?.toLowerCase().split('.').pop() || '';
  
  if (mimetype?.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(ext)) {
    return IconPhoto;
  }
  if (mimetype === 'application/pdf' || ext === 'pdf') {
    return IconFile3d;
  }
  if (mimetype?.includes('zip') || mimetype?.includes('archive') || ['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
    return IconFileZip;
  }
  if (mimetype?.includes('text') || ['md', 'txt', 'tex', 'latex'].includes(ext)) {
    return IconFileText;
  }
  if (mimetype?.includes('json') || mimetype?.includes('xml') || ['js', 'ts', 'jsx', 'tsx', 'html', 'css', 'py', 'java', 'cpp'].includes(ext)) {
    return IconFileCode;
  }
  if (mimetype?.includes('csv') || mimetype?.includes('excel') || mimetype?.includes('spreadsheet') || ['csv', 'xlsx', 'xls'].includes(ext)) {
    return IconDatabase;
  }
  
  return IconFile;
};

const formatFileSize = (bytes?: number) => {
  if (!bytes || bytes === 0) return '';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const FileTreeNode = ({ 
  node, 
  onRemoveFile, 
  onDownloadFile, 
  showActions = true,
  depth = 0,
  maxDepth = 10
}: {
  node: FileNode;
  onRemoveFile?: (path: string) => void;
  onDownloadFile?: (node: FileNode) => void;
  showActions?: boolean;
  depth?: number;
  maxDepth?: number;
}) => {
  const [isExpanded, setIsExpanded] = useState(depth < 2); // Auto-expand first 2 levels
  
  const paddingLeft = depth * 20;
  
  if (node.type === 'folder') {
    const FolderIcon = isExpanded ? IconFolderOpen : IconFolder;
    const ChevronIcon = isExpanded ? IconChevronDown : IconChevronRight;
    
    return (
      <Box>
        <Group 
          gap="xs" 
          style={{ 
            paddingLeft: `${paddingLeft}px`,
            cursor: 'pointer',
            padding: '4px 8px',
            borderRadius: '4px'
          }}
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <ChevronIcon size={14} color="var(--mantine-color-gray-6)" />
          <FolderIcon size={16} color="var(--mantine-color-blue-6)" />
          <Text size="sm" fw={500}>{node.name}</Text>
          {node.children && (
            <Text size="xs" c="dimmed">({node.children.length} items)</Text>
          )}
          
          {showActions && onRemoveFile && (
            <ActionIcon
              size="xs"
              variant="subtle"
              color="red"
              onClick={(e) => {
                e.stopPropagation();
                onRemoveFile(node.path);
              }}
              ml="auto"
            >
              <IconX size={12} />
            </ActionIcon>
          )}
        </Group>
        
        <Collapse in={isExpanded}>
          <Stack gap={0}>
            {node.children && node.children.map((child) => (
              <FileTreeNode
                key={child.id}
                node={child}
                onRemoveFile={onRemoveFile}
                onDownloadFile={onDownloadFile}
                showActions={showActions}
                depth={depth + 1}
                maxDepth={maxDepth}
              />
            ))}
          </Stack>
        </Collapse>
      </Box>
    );
  }
  
  // File node
  const FileIcon = getFileIcon(node.mimetype, node.name);
  
  return (
    <Group 
      gap="xs" 
      justify="space-between"
      style={{ 
        paddingLeft: `${paddingLeft + 14}px`, // Account for no chevron
        padding: '4px 8px',
        borderRadius: '4px'
      }}
    >
      <Group gap="xs" style={{ flex: 1, minWidth: 0 }}>
        <FileIcon size={16} color="var(--mantine-color-gray-7)" />
        <Text size="sm" truncate style={{ flex: 1 }}>
          {node.name}
        </Text>
        {node.size && (
          <Text size="xs" c="dimmed">
            {formatFileSize(node.size)}
          </Text>
        )}
      </Group>
      
      {showActions && (
        <Group gap="xs">
          {onDownloadFile && (
            <Tooltip label="Download">
              <ActionIcon
                size="xs"
                variant="subtle"
                color="blue"
                onClick={() => onDownloadFile(node)}
              >
                <IconDownload size={12} />
              </ActionIcon>
            </Tooltip>
          )}
          {onRemoveFile && (
            <Tooltip label="Remove">
              <ActionIcon
                size="xs"
                variant="subtle"
                color="red"
                onClick={() => onRemoveFile(node.path)}
              >
                <IconX size={12} />
              </ActionIcon>
            </Tooltip>
          )}
        </Group>
      )}
    </Group>
  );
};

export function FileTreeView({ 
  files, 
  onRemoveFile, 
  onDownloadFile, 
  showActions = true,
  maxDepth = 10,
  currentDepth = 0
}: FileTreeViewProps) {
  if (files.length === 0) {
    return (
      <Box 
        p="md" 
        ta="center" 
        style={{ 
          border: '2px dashed var(--mantine-color-gray-4)',
          borderRadius: '8px',
          backgroundColor: 'var(--mantine-color-gray-0)'
        }}
      >
        <Text c="dimmed" size="sm">No files uploaded</Text>
      </Box>
    );
  }

  return (
    <Box 
      style={{ 
        border: '1px solid var(--mantine-color-gray-3)',
        borderRadius: '8px',
        backgroundColor: 'var(--mantine-color-gray-0)',
        maxHeight: '400px',
        overflowY: 'auto'
      }}
    >
      <Stack gap={0} p="xs">
        {files.map((file) => (
          <FileTreeNode
            key={file.id}
            node={file}
            onRemoveFile={onRemoveFile}
            onDownloadFile={onDownloadFile}
            showActions={showActions}
            depth={currentDepth}
            maxDepth={maxDepth}
          />
        ))}
      </Stack>
    </Box>
  );
}

export default FileTreeView;