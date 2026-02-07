import { useState, useCallback } from 'react';
import { notifications } from '@mantine/notifications';
import { IconCheck, IconAlertCircle } from '@tabler/icons-react';
import { API_URL } from '@/lib/api';

interface BotConfigFile {
  id: string;
  filename: string;
  description?: string;
  mimetype: string;
  size: number;
  checksum: string;
  uploadedAt: string;
  updatedAt: string;
  uploadedBy: {
    id: string;
    name: string;
    email: string;
  };
  downloadUrl: string;
}

export const useBotFileUpload = () => {
  const [files, setFiles] = useState<BotConfigFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const fetchFiles = useCallback(async (botId: string) => {
    try {
      const response = await fetch(`${API_URL}/api/bot-config-files/${botId}/files`, {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to fetch bot files');
      }

      const data = await response.json();
      setFiles(data.files || []);
    } catch (err) {
      console.error('Error fetching bot files:', err);
      setFiles([]);
    }
  }, []);

  const uploadFile = useCallback(async (
    botId: string,
    file: File,
    description?: string
  ) => {
    try {
      setIsUploading(true);
      setUploadProgress(0);

      const formData = new FormData();
      formData.append('file', file);
      if (description) {
        formData.append('description', description);
      }

      // Simulate progress (in real implementation, you'd use XMLHttpRequest for actual progress)
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90));
      }, 100);

      const response = await fetch(`${API_URL}/api/bot-config-files/${botId}/files`, {
        method: 'POST',
        credentials: 'include',
        body: formData
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to upload file');
      }

      notifications.show({
        title: 'Success',
        message: 'File uploaded successfully',
        color: 'green',
        icon: <IconCheck size={16} />
      });

      // Refresh files list
      await fetchFiles(botId);
    } catch (err) {
      notifications.show({
        title: 'Error',
        message: err instanceof Error ? err.message : 'Failed to upload file',
        color: 'red',
        icon: <IconAlertCircle size={16} />
      });
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  }, [fetchFiles]);

  const deleteFile = useCallback(async (botId: string, fileId: string) => {
    try {
      const response = await fetch(`${API_URL}/api/bot-config-files/${fileId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete file');
      }

      notifications.show({
        title: 'Success',
        message: 'File deleted successfully',
        color: 'green',
        icon: <IconCheck size={16} />
      });

      // Refresh files list
      await fetchFiles(botId);
    } catch (err) {
      notifications.show({
        title: 'Error',
        message: err instanceof Error ? err.message : 'Failed to delete file',
        color: 'red',
        icon: <IconAlertCircle size={16} />
      });
    }
  }, [fetchFiles]);

  return {
    files,
    isUploading,
    uploadProgress,
    fetchFiles,
    uploadFile,
    deleteFile
  };
};