'use client';

import { useState } from 'react';
import { sanitizeHTML } from '@/lib/sanitize';
import {
  Paper,
  Title,
  Text,
  Group,
  Badge,
  Stack,
  Box,
  Loader,
  Button,
  ActionIcon,
  Collapse,
  useComputedColorScheme
} from '@mantine/core';
import {
  IconDownload,
  IconFiles,
  IconEye,
  IconChevronDown,
  IconChevronRight,
} from '@tabler/icons-react';
import { getFileIcon, getFileTypeColor, formatFileSize, getFileTypeLabel } from './submissionUtils';
import { API_URL } from '@/lib/api';

interface FileData {
  id: string;
  filename: string;
  originalName: string;
  size: number;
  fileType: string;
  mimetype: string;
  uploadedAt: string;
}

interface SubmissionFilesSectionProps {
  submissionId: string;
  files: FileData[];
}

export function SubmissionFilesSection({ submissionId, files }: SubmissionFilesSectionProps) {
  const colorScheme = useComputedColorScheme('light');
  const dark = colorScheme === 'dark';
  const [filesExpanded, setFilesExpanded] = useState(false);
  const [showHTML, setShowHTML] = useState(false);
  const [htmlContent, setHtmlContent] = useState<string>('');
  const [loadingHTML, setLoadingHTML] = useState(false);

  const getRenderedPDF = () => {
    return files
      .filter(f => f.fileType === 'RENDERED' && f.mimetype === 'application/pdf')
      .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())[0] || null;
  };

  const getRenderedHTML = () => {
    return files
      .filter(f => f.fileType === 'RENDERED' && f.mimetype === 'text/html')
      .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())[0] || null;
  };

  const scopeHTMLContent = (htmlContent: string): string => {
    const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;

    let scopedHTML = htmlContent;
    let match;

    while ((match = styleRegex.exec(htmlContent)) !== null) {
      const originalCSS = match[1];

      if (originalCSS.includes('.rendered-document') || originalCSS.includes('/* scoped */')) {
        continue;
      }

      const scopedCSS = originalCSS
        .replace(/\bbody\s*{/g, '.rendered-document {')
        .replace(/^(\s*)([a-zA-Z][a-zA-Z0-9]*(?:\s*,\s*[a-zA-Z][a-zA-Z0-9]*)*)\s*{/gm, '$1.rendered-document $2 {')
        .replace(/^(\s*)(\.[a-zA-Z][a-zA-Z0-9_-]*(?:\s*,\s*\.[a-zA-Z][a-zA-Z0-9_-]*)*)\s*{/gm, '$1.rendered-document $2 {')
        .replace(/^(\s*)([^@}]+?)\s*{/gm, (fullMatch, indent, selector) => {
          if (selector.includes('@') || selector.includes('.rendered-document') || selector.trim().startsWith('/*')) {
            return fullMatch;
          }
          return `${indent}.rendered-document ${selector.trim()} {`;
        });

      const finalCSS = `/* CSS automatically scoped for safe embedding */\n${scopedCSS}`;

      scopedHTML = scopedHTML.replace(match[0], `<style>${finalCSS}</style>`);
    }

    if (!scopedHTML.includes('class="rendered-document"')) {
      scopedHTML = scopedHTML.replace(
        /<body[^>]*>([\s\S]*?)<\/body>/i,
        '<body><div class="rendered-document">$1</div></body>'
      );
    }

    return scopedHTML;
  };

  const handleViewHTML = async () => {
    const htmlFile = getRenderedHTML();
    if (!htmlFile) return;

    setLoadingHTML(true);
    try {
      const response = await fetch(`${API_URL}/api/articles/${submissionId}/files/${htmlFile.id}/download?inline=true`, {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch HTML: ${response.status} ${response.statusText}`);
      }

      const htmlText = await response.text();
      const scopedHTML = scopeHTMLContent(htmlText);
      setHtmlContent(scopedHTML);
      setShowHTML(true);
    } catch (error) {
      console.error('Error fetching HTML content:', error);
    } finally {
      setLoadingHTML(false);
    }
  };

  const handleDownload = async (fileId?: string) => {
    if (files.length === 0) return;

    const fileToDownload = fileId
      ? files.find(f => f.id === fileId)
      : files
          .filter(f => f.fileType === 'RENDERED')
          .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())[0] ||
        files.find(f => f.fileType === 'SOURCE') ||
        files[0];

    if (!fileToDownload) return;

    try {
      console.log(`Downloading file: ${fileToDownload.originalName} (${fileToDownload.fileType})`);
      const response = await fetch(`${API_URL}/api/articles/${submissionId}/files/${fileToDownload.id}/download`, {
        credentials: 'include'
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Download failed:', response.status, errorText);
        throw new Error(`Failed to download file: ${response.status} ${response.statusText}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileToDownload.originalName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading file:', error);
      alert(`Failed to download file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  return (
    <>
      <Box>
        <Group justify="space-between" align="center">
          <Group
            gap="xs"
            style={{ cursor: 'pointer', flex: 1 }}
            onClick={() => setFilesExpanded(!filesExpanded)}
          >
            {filesExpanded ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
            <IconFiles size={16} />
            <Text fw={500} size="sm">Files</Text>
            <Badge size="sm" variant="light" color="blue">
              {files.length}
            </Badge>
          </Group>

          <Group gap="xs">
            {getRenderedHTML() && (
              <Button
                size="md"
                variant="filled"
                color="green"
                leftSection={loadingHTML ? <Loader size={18} /> : <IconEye size={18} />}
                onClick={handleViewHTML}
                loading={loadingHTML}
              >
                View HTML
              </Button>
            )}
            {getRenderedPDF() && (
              <Button
                size="md"
                variant="filled"
                color="blue"
                leftSection={<IconDownload size={18} />}
                onClick={() => handleDownload(getRenderedPDF()?.id)}
              >
                Download PDF
              </Button>
            )}
          </Group>
        </Group>

        <Collapse in={filesExpanded}>
          <Stack gap="xs" mt="xs">
            {files
              .sort((a, b) => {
                const typeOrder = { 'RENDERED': 0, 'SOURCE': 1, 'ASSET': 2, 'SUPPLEMENTARY': 3 };
                const aOrder = typeOrder[a.fileType as keyof typeof typeOrder] ?? 4;
                const bOrder = typeOrder[b.fileType as keyof typeof typeOrder] ?? 4;
                if (aOrder !== bOrder) return aOrder - bOrder;
                return new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime();
              })
              .map((file, index) => (
                <Group key={file.id} justify="space-between" p="xs"
                       style={{
                         backgroundColor: index === 0 && file.fileType === 'RENDERED'
                           ? (dark ? 'var(--mantine-color-dark-5)' : 'var(--mantine-color-blue-0)')
                           : (dark ? 'var(--mantine-color-dark-6)' : 'var(--mantine-color-gray-0)'),
                         borderRadius: 'var(--mantine-radius-sm)',
                         border: index === 0 && file.fileType === 'RENDERED'
                           ? '1px solid var(--mantine-color-blue-4)'
                           : `1px solid ${dark ? 'var(--mantine-color-dark-4)' : 'var(--mantine-color-gray-3)'}`
                       }}>
                  <Group gap="sm" style={{ flex: 1, minWidth: 0 }}>
                    {getFileIcon(file.fileType, file.mimetype)}
                    <Box style={{ flex: 1, minWidth: 0 }}>
                      <Group gap="xs" align="center">
                        <Text size="sm" fw={500} truncate style={{ flex: 1 }}>
                          {file.originalName}
                        </Text>
                        <Badge
                          size="xs"
                          variant="light"
                          color={getFileTypeColor(file.fileType)}
                        >
                          {file.fileType}
                        </Badge>
                        {index === 0 && file.fileType === 'RENDERED' && (
                          <Badge size="xs" variant="filled" color="blue">
                            Latest
                          </Badge>
                        )}
                      </Group>
                      <Text size="xs" c="dimmed" truncate>
                        {formatFileSize(file.size)} • {getFileTypeLabel(file.mimetype)}
                      </Text>
                    </Box>
                  </Group>
                  <ActionIcon
                    variant="light"
                    color="blue"
                    size="sm"
                    onClick={() => handleDownload(file.id)}
                  >
                    <IconDownload size={14} />
                  </ActionIcon>
                </Group>
              ))}
          </Stack>
        </Collapse>
      </Box>

      {/* HTML Content Display */}
      {showHTML && htmlContent && (
        <Box mt="xl">
          <Group justify="space-between" align="center" mb="md">
            <Title order={3}>Rendered HTML</Title>
            <Button
              variant="light"
              color="gray"
              size="sm"
              onClick={() => setShowHTML(false)}
            >
              Hide
            </Button>
          </Group>
          <Paper
            p="xl"
            withBorder
            style={{
              maxHeight: '80vh',
              overflow: 'auto'
            }}
          >
            <div
              dangerouslySetInnerHTML={{ __html: sanitizeHTML(htmlContent) }}
              style={{
                lineHeight: '1.6',
                fontSize: '14px'
              }}
            />
          </Paper>
        </Box>
      )}
    </>
  );
}
