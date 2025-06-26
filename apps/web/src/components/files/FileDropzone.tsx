'use client';

import { useCallback, useRef, useState, useEffect } from 'react';
import { 
  Stack, 
  Group, 
  Text, 
  Button,
  Box,
  rem
} from '@mantine/core';
import { 
  IconUpload,
  IconFolder,
  IconFile,
  IconX
} from '@tabler/icons-react';
import { buildFileTree, FileWithPath } from '@/utils/fileTree';
import { FileTreeView, FileNode } from './FileTreeView';

interface FileDropzoneProps {
  onFilesChange: (files: File[]) => void;
  accept?: string;
  maxFileSize?: number;
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
      // Ensure webkitRelativePath is set for compatibility
      const fileWithPath = file as FileWithPath;
      if (!fileWithPath.webkitRelativePath) {
        (fileWithPath as any).webkitRelativePath = file.name;
      }
      return fileWithPath;
    });
    
    // Validate file sizes
    const oversizedFiles = filesArray.filter(file => file.size > maxFileSize);
    if (oversizedFiles.length > 0) {
      alert(`Some files are too large. Maximum size is ${Math.round(maxFileSize / (1024 * 1024))}MB`);
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

      {/* Upload area */}
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

      {/* File tree display */}
      {fileTree.length > 0 && (
        <Stack gap="xs">
          <Group justify="space-between" align="center">
            <Text size="sm" fw={500}>
              Uploaded Files ({value.length} files)
            </Text>
            <Button
              variant="subtle"
              size="xs"
              color="red"
              leftSection={<IconX size={12} />}
              onClick={clearAll}
            >
              Clear All
            </Button>
          </Group>
          
          <FileTreeView
            files={fileTree}
            onRemoveFile={removeFile}
            onDownloadFile={downloadFile}
            showActions={true}
          />
        </Stack>
      )}
    </Stack>
  );
}

export default FileDropzone;