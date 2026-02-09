'use client';

import { useState } from 'react';
import {
  Text,
  Group,
  Stack,
  Box,
  Button,
  Divider,
  TextInput,
  Textarea,
  TagsInput,
} from '@mantine/core';
import {
  IconUpload,
} from '@tabler/icons-react';
import FileDropzone from '../files/FileDropzone';
import { API_URL } from '@/lib/api';

interface SubmissionEditPanelProps {
  submissionId: string;
  editData: {
    title: string;
    abstract: string;
    keywords: string[];
  };
  onEditDataChange: (data: { title: string; abstract: string; keywords: string[] }) => void;
  savingEdits: boolean;
  onSaveEdits: () => void;
  onRefresh: () => void;
}

export function SubmissionEditPanel({
  submissionId,
  editData,
  onEditDataChange,
  savingEdits,
  onSaveEdits,
  onRefresh,
}: SubmissionEditPanelProps) {
  const [revisionFiles, setRevisionFiles] = useState<File[]>([]);
  const [uploadingRevision, setUploadingRevision] = useState(false);

  const handleRevisionUpload = async () => {
    if (revisionFiles.length === 0) return;

    setUploadingRevision(true);

    try {
      const formData = new FormData();

      // Add files
      revisionFiles.forEach(file => {
        formData.append('files', file);
      });

      // Add metadata
      const metadata = {
        uploadType: 'revision',
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString()
      };
      formData.append('metadata', JSON.stringify(metadata));

      const response = await fetch(`${API_URL}/api/articles/${submissionId}/files`, {
        method: 'POST',
        credentials: 'include',
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to upload revision files');
      }

      const result = await response.json();

      // Clear the upload files
      setRevisionFiles([]);

      // Refresh the submission data to show new files
      onRefresh();

    } catch (err) {
      console.error('Error uploading revision:', err);
      alert(err instanceof Error ? err.message : 'Failed to upload revision files');
    } finally {
      setUploadingRevision(false);
    }
  };

  return (
    <>
      <TextInput
        value={editData.title}
        onChange={(e) => onEditDataChange({ ...editData, title: e.target.value })}
        placeholder="Article title"
        size="xl"
        variant="filled"
        mb="sm"
        styles={{
          input: {
            fontSize: '1.75rem',
            fontWeight: 700,
            lineHeight: 1.3
          }
        }}
      />

      <Textarea
        value={editData.abstract}
        onChange={(e) => onEditDataChange({ ...editData, abstract: e.target.value })}
        placeholder="Abstract"
        minRows={4}
        autosize
        variant="filled"
        style={{ maxWidth: '80%' }}
      />

      <Stack gap="lg" mt="sm" style={{ maxWidth: '80%' }}>
        <TagsInput
          value={editData.keywords}
          onChange={(keywords) => onEditDataChange({ ...editData, keywords })}
          placeholder="Add keywords (press Enter to add)"
          label="Keywords"
          variant="filled"
        />

        {/* File Revision Upload - Only in Edit Mode */}
        <Box>
          <Divider mb="md" />
          <Stack gap="md">
            <Group gap="xs" align="center">
              <IconUpload size={16} />
              <Text fw={500} size="sm">Upload Revised Files (Optional)</Text>
            </Group>

            <Text size="sm" c="dimmed">
              Upload revised versions of your manuscript files. These will be added as new versions.
            </Text>

            <FileDropzone
              value={revisionFiles}
              onFilesChange={setRevisionFiles}
              accept=".md,.tex,.pdf,.docx,.doc"
              placeholder="Upload revised manuscript files"
              description="Supported: Markdown, LaTeX, PDF, Word • Max 50MB per file"
              allowFolders={false}
              maxFileSize={50 * 1024 * 1024}
            />

            {revisionFiles.length > 0 && (
              <Group justify="flex-end">
                <Button
                  variant="light"
                  color="gray"
                  size="sm"
                  onClick={() => setRevisionFiles([])}
                  disabled={uploadingRevision || savingEdits}
                >
                  Clear Files
                </Button>
                <Button
                  leftSection={<IconUpload size={16} />}
                  size="sm"
                  onClick={handleRevisionUpload}
                  loading={uploadingRevision}
                  disabled={savingEdits}
                >
                  Upload Files
                </Button>
              </Group>
            )}
          </Stack>
        </Box>
      </Stack>
    </>
  );
}
