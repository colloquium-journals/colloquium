'use client';

import { 
  Stack, 
  Group, 
  Text, 
  Badge, 
  ActionIcon, 
  Box,
  Tooltip,
  Card
} from '@mantine/core';
import { 
  IconDownload, 
  IconFile, 
  IconFileText, 
  IconPhoto, 
  IconFileZip,
  IconDatabase,
  IconFileCode
} from '@tabler/icons-react';

export interface FileItem {
  id: string;
  originalName: string;
  filename: string;
  mimetype: string;
  size: number;
  fileType: 'SOURCE' | 'ASSET' | 'RENDERED' | 'SUPPLEMENTARY';
  detectedFormat?: string | null;
  fileExtension?: string | null;
  uploadedAt: string;
  downloadUrl?: string;
}

interface FileListProps {
  files: FileItem[];
  showFileType?: boolean;
  allowDownload?: boolean;
  onDownload?: (file: FileItem) => void;
  groupByType?: boolean;
}

const getFileIcon = (mimetype: string, fileExtension?: string | null) => {
  if (mimetype.startsWith('image/')) return IconPhoto;
  if (mimetype === 'application/pdf') return IconFile;
  if (mimetype.includes('zip') || mimetype.includes('archive')) return IconFileZip;
  if (mimetype.includes('text') || fileExtension === '.md' || fileExtension === '.tex') return IconFileText;
  if (mimetype.includes('json') || mimetype.includes('xml')) return IconFileCode;
  if (mimetype.includes('csv') || mimetype.includes('excel') || mimetype.includes('spreadsheet')) return IconDatabase;
  return IconFile;
};

const getFileTypeColor = (fileType: string) => {
  switch (fileType) {
    case 'SOURCE': return 'blue';
    case 'ASSET': return 'green';
    case 'RENDERED': return 'purple';
    case 'SUPPLEMENTARY': return 'orange';
    default: return 'gray';
  }
};

const getFileTypeLabel = (fileType: string) => {
  switch (fileType) {
    case 'SOURCE': return 'Source';
    case 'ASSET': return 'Asset';
    case 'RENDERED': return 'Rendered';
    case 'SUPPLEMENTARY': return 'Supplementary';
    default: return 'Unknown';
  }
};

const formatFileSize = (bytes: number) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export function FileList({ 
  files, 
  showFileType = true, 
  allowDownload = true, 
  onDownload,
  groupByType = false 
}: FileListProps) {
  if (files.length === 0) {
    return (
      <Card withBorder p="md">
        <Text c="dimmed" ta="center">No files uploaded</Text>
      </Card>
    );
  }

  const renderFile = (file: FileItem) => {
    const FileIcon = getFileIcon(file.mimetype, file.fileExtension);
    
    return (
      <Group key={file.id} justify="space-between" p="sm" style={{ 
        borderRadius: '8px',
        border: '1px solid var(--mantine-color-gray-3)',
        backgroundColor: 'var(--mantine-color-gray-0)'
      }}>
        <Group gap="sm" style={{ flex: 1 }}>
          <FileIcon size={20} color="var(--mantine-color-blue-6)" />
          
          <Stack gap={0} style={{ flex: 1 }}>
            <Group gap="xs" align="center">
              <Text size="sm" fw={500}>{file.originalName}</Text>
              
              {showFileType && (
                <Badge 
                  size="xs" 
                  color={getFileTypeColor(file.fileType)}
                  variant="light"
                >
                  {getFileTypeLabel(file.fileType)}
                </Badge>
              )}
              
              {file.detectedFormat && (
                <Badge size="xs" color="gray" variant="outline">
                  {file.detectedFormat}
                </Badge>
              )}
            </Group>
            
            <Text size="xs" c="dimmed">
              {formatFileSize(file.size)} • {file.mimetype} • {formatDate(file.uploadedAt)}
            </Text>
          </Stack>
        </Group>

        {allowDownload && file.downloadUrl && (
          <Tooltip label="Download file">
            <ActionIcon
              variant="light"
              color="blue"
              onClick={() => onDownload ? onDownload(file) : window.open(file.downloadUrl, '_blank')}
            >
              <IconDownload size={16} />
            </ActionIcon>
          </Tooltip>
        )}
      </Group>
    );
  };

  if (groupByType) {
    const filesByType = files.reduce((acc, file) => {
      const type = file.fileType;
      if (!acc[type]) acc[type] = [];
      acc[type].push(file);
      return acc;
    }, {} as Record<string, FileItem[]>);

    const typeOrder = ['SOURCE', 'ASSET', 'RENDERED', 'SUPPLEMENTARY'];

    return (
      <Stack gap="md">
        {typeOrder.map(type => {
          const typeFiles = filesByType[type];
          if (!typeFiles || typeFiles.length === 0) return null;

          return (
            <Box key={type}>
              <Text size="sm" fw={600} mb="xs" c={getFileTypeColor(type)}>
                {getFileTypeLabel(type)} Files ({typeFiles.length})
              </Text>
              <Stack gap="xs">
                {typeFiles.map(renderFile)}
              </Stack>
            </Box>
          );
        })}
      </Stack>
    );
  }

  return (
    <Stack gap="xs">
      {files.map(renderFile)}
    </Stack>
  );
}

export default FileList;