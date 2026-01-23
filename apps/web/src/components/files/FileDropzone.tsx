'use client';

import { useCallback, useRef, useState, useEffect } from 'react';
import { 
  Stack, 
  Group, 
  Text, 
  Button,
  Box,
  rem,
  Paper,
  Badge,
  ActionIcon,
  Tooltip
} from '@mantine/core';
import { 
  IconUpload,
  IconFolder,
  IconFile,
  IconX,
  IconCheck,
  IconReplace,
  IconTrash
} from '@tabler/icons-react';
import { buildFileTree, FileWithPath } from '@/utils/fileTree';
import { FileTreeView, FileNode } from './FileTreeView';

interface FileDropzoneProps {
  onFilesChange: (files: File[]) => void;
  accept?: string;
  maxFileSize?: number;
  maxFiles?: number;
  multiple?: boolean;
  allowFolders?: boolean;
  value?: File[];
  placeholder?: string;
  description?: string;
}

export function FileDropzone({
  onFilesChange,
  accept,
  maxFileSize = 50 * 1024 * 1024, // 50MB
  maxFiles,
  multiple = true,
  allowFolders = true,
  value = [],
  placeholder = "Click to select files or drag and drop",
  description
}: FileDropzoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // Convert current files to tree structure
  const updateFileTree = useCallback((files: File[]) => {
    const tree = buildFileTree(files);
    setFileTree(tree);
  }, []);

  // Update tree when value changes
  useEffect(() => {
    updateFileTree(value);
  }, [value, updateFileTree]);

  const handleFiles = useCallback((newFiles: FileList | File[]) => {
    const filesArray = Array.from(newFiles).map(file => {
      // Simply add the webkitRelativePath property if it doesn't exist
      // This is much simpler and doesn't interfere with FormData
      const fileWithPath = file as FileWithPath;
      if (!fileWithPath.webkitRelativePath) {
        // Use Object.defineProperty to add the property without breaking the File object
        Object.defineProperty(fileWithPath, 'webkitRelativePath', {
          value: file.name,
          writable: false,
          enumerable: true,
          configurable: true
        });
      }
      return fileWithPath;
    });
    
    // Validate file sizes
    const oversizedFiles = filesArray.filter(file => file.size > maxFileSize);
    if (oversizedFiles.length > 0) {
      alert(`Some files are too large. Maximum size is ${Math.round(maxFileSize / (1024 * 1024))}MB`);
      return;
    }

    // Validate max file count
    if (maxFiles && (value.length + filesArray.length) > maxFiles) {
      alert(`Too many files. Maximum allowed: ${maxFiles}`);
      return;
    }

    // Combine with existing files
    const allFiles = [...value, ...filesArray];
    onFilesChange(allFiles);
    updateFileTree(allFiles);
  }, [value, onFilesChange, maxFileSize, updateFileTree]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    handleFiles(files);
  }, [handleFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(e.target.files);
    }
  }, [handleFiles]);

  const handleFolderInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      // For folder input, files will have webkitRelativePath
      handleFiles(e.target.files);
    }
  }, [handleFiles]);

  const removeFile = useCallback((pathToRemove: string) => {
    const filteredFiles = value.filter(file => {
      const fileWithPath = file as FileWithPath;
      const filePath = fileWithPath.webkitRelativePath || file.name;
      return !filePath.startsWith(pathToRemove);
    });
    
    onFilesChange(filteredFiles);
    updateFileTree(filteredFiles);
  }, [value, onFilesChange, updateFileTree]);

  const downloadFile = useCallback((node: FileNode) => {
    if (node.file) {
      const url = URL.createObjectURL(node.file);
      const a = document.createElement('a');
      a.href = url;
      a.download = node.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  }, []);

  const clearAll = useCallback(() => {
    onFilesChange([]);
    setFileTree([]);
  }, [onFilesChange]);

  const hasFiles = value.length > 0;

  return (
    <Stack gap="md">
      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        multiple={multiple}
        accept={accept}
        onChange={handleFileInputChange}
        style={{ display: 'none' }}
      />
      
      {allowFolders && (
        <input
          ref={folderInputRef}
          type="file"
          // @ts-ignore - webkitdirectory is not in TS types but is widely supported
          webkitdirectory=""
          multiple
          onChange={handleFolderInputChange}
          style={{ display: 'none' }}
        />
      )}

      {/* Show uploaded files prominently when they exist */}
      {hasFiles ? (
        <Paper p="md" withBorder style={{ backgroundColor: 'var(--mantine-color-gray-0)' }}>
          <Stack gap="md">
            {/* Success header */}
            <Group justify="space-between" align="center">
              <Group gap="xs">
                <IconCheck size={18} color="var(--mantine-color-green-6)" />
                <Text size="sm" fw={500}>
                  Files Uploaded
                </Text>
                <Badge size="sm" color="gray" variant="light">
                  {value.length} file{value.length !== 1 ? 's' : ''}
                </Badge>
              </Group>
              <Group gap="xs">
                <Tooltip label="Add more files">
                  <ActionIcon
                    variant="light"
                    color="blue"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <IconUpload size={14} />
                  </ActionIcon>
                </Tooltip>
                <Tooltip label="Remove all files">
                  <ActionIcon
                    variant="light"
                    color="red"
                    size="sm"
                    onClick={clearAll}
                  >
                    <IconTrash size={14} />
                  </ActionIcon>
                </Tooltip>
              </Group>
            </Group>

            {/* File list */}
            <FileTreeView
              files={fileTree}
              onRemoveFile={removeFile}
              onDownloadFile={downloadFile}
              showActions={true}
            />

            {/* Add more files option */}
            <Box
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              style={{
                border: `1px dashed ${isDragOver ? 'var(--mantine-color-blue-5)' : 'var(--mantine-color-gray-4)'}`,
                borderRadius: rem(4),
                padding: rem(12),
                backgroundColor: isDragOver ? 'var(--mantine-color-blue-0)' : 'var(--mantine-color-gray-0)',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              <Group justify="center" gap="xs">
                <IconUpload size={16} color="var(--mantine-color-gray-6)" />
                <Text size="xs" c="dimmed">
                  Drag more files here or click to select
                </Text>
              </Group>
            </Box>
          </Stack>
        </Paper>
      ) : (
        /* Initial upload area when no files */
        <Box
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          style={{
            border: `2px dashed ${isDragOver ? 'var(--mantine-color-blue-5)' : 'var(--mantine-color-gray-4)'}`,
            borderRadius: rem(8),
            padding: rem(20),
            backgroundColor: isDragOver ? 'var(--mantine-color-blue-0)' : 'var(--mantine-color-gray-0)',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
          onClick={() => fileInputRef.current?.click()}
        >
          <Stack align="center" gap="md">
            <IconUpload size={32} color="var(--mantine-color-gray-6)" />
            <Stack align="center" gap="xs">
              <Text size="sm" ta="center" fw={500}>
                {placeholder}
              </Text>
              {description && (
                <Text size="xs" c="dimmed" ta="center">
                  {description}
                </Text>
              )}
            </Stack>
            
            <Group gap="sm">
              <Button
                variant="light"
                size="xs"
                leftSection={<IconFile size={14} />}
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
              >
                Select Files
              </Button>
              
              {allowFolders && (
                <Button
                  variant="light"
                  size="xs"
                  leftSection={<IconFolder size={14} />}
                  onClick={(e) => {
                    e.stopPropagation();
                    folderInputRef.current?.click();
                  }}
                >
                  Select Folder
                </Button>
              )}
            </Group>
          </Stack>
        </Box>
      )}
    </Stack>
  );
}

export default FileDropzone;