import { createBotClient, FileData, ManuscriptData } from '@colloquium/bot-sdk';

export async function getManuscriptFiles(manuscriptId: string, serviceToken: string, apiUrl?: string): Promise<FileData[]> {
  const client = createBotClient({
    manuscriptId,
    serviceToken,
    config: apiUrl ? { apiUrl } : undefined,
  });
  return client.files.list();
}

export function findMarkdownFile(files: FileData[]): FileData | null {
  let markdownFile = files.find(file =>
    file.fileType === 'SOURCE' &&
    (file.mimetype?.includes('markdown') ||
     file.originalName.match(/\.(md|markdown)$/i) ||
     file.detectedFormat === 'markdown')
  );

  if (!markdownFile) {
    markdownFile = files.find(file =>
      file.mimetype?.includes('markdown') ||
      file.originalName.match(/\.(md|markdown)$/i) ||
      file.detectedFormat === 'markdown'
    );
  }

  if (!markdownFile) {
    markdownFile = files.find(file =>
      file.originalName.match(/\.(md|markdown)$/i)
    );
  }

  return markdownFile || null;
}

export async function downloadFile(downloadUrl: string, serviceToken: string, apiUrl?: string): Promise<string> {
  const client = createBotClient({
    manuscriptId: '',
    serviceToken,
    config: apiUrl ? { apiUrl } : undefined,
  });
  return client.files.downloadByUrl(downloadUrl);
}

export function findBibliographyFile(files: FileData[]): FileData | null {
  return files.find(file =>
    file.originalName.match(/\.(bib|bibtex)$/i) ||
    file.detectedFormat === 'bibtex'
  ) || null;
}

export async function getManuscriptMetadata(manuscriptId: string, serviceToken: string, apiUrl?: string): Promise<ManuscriptData> {
  const client = createBotClient({
    manuscriptId,
    serviceToken,
    config: apiUrl ? { apiUrl } : undefined,
  });
  return client.manuscripts.get();
}

export async function uploadRenderedFile(
  manuscriptId: string,
  filename: string,
  content: string | Buffer,
  mimeType: string = 'text/html',
  serviceToken: string,
  apiUrl?: string
): Promise<{ id: string; filename: string; downloadUrl: string; size: number }> {
  const client = createBotClient({
    manuscriptId,
    serviceToken,
    config: apiUrl ? { apiUrl } : undefined,
  });

  const result = await client.files.upload(filename, content, {
    fileType: 'RENDERED',
    renderedBy: 'bot-markdown-renderer',
    mimetype: mimeType,
  });

  return {
    ...result,
    downloadUrl: `${client.apiUrl}${result.downloadUrl}`,
  };
}
