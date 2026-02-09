const DEFAULT_API_URL = process.env.API_URL || 'http://localhost:4000';

export async function getManuscriptFiles(manuscriptId: string, serviceToken: string, apiUrl: string = DEFAULT_API_URL): Promise<any[]> {
  const url = `${apiUrl}/api/articles/${manuscriptId}/files`;

  const response = await fetch(url, {
    headers: {
      'x-bot-token': serviceToken,
      'content-type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch manuscript files: ${response.statusText}`);
  }

  const data = await response.json();
  return data.files || [];
}

export function findMarkdownFile(files: any[]): any | null {
  // Try to find markdown files with multiple criteria, prioritizing SOURCE files
  let markdownFile = files.find(file =>
    file.fileType === 'SOURCE' &&
    (file.mimetype?.includes('markdown') ||
     file.originalName.match(/\.(md|markdown)$/i) ||
     file.detectedFormat === 'markdown')
  );

  // If no SOURCE markdown file found, look for any markdown file
  if (!markdownFile) {
    markdownFile = files.find(file =>
      file.mimetype?.includes('markdown') ||
      file.originalName.match(/\.(md|markdown)$/i) ||
      file.detectedFormat === 'markdown'
    );
  }

  // Final fallback: look for files with .md/.markdown extension regardless of other fields
  if (!markdownFile) {
    markdownFile = files.find(file =>
      file.originalName.match(/\.(md|markdown)$/i)
    );
  }

  return markdownFile;
}

export async function downloadFile(downloadUrl: string, serviceToken: string, apiUrl: string = DEFAULT_API_URL): Promise<string> {
  // Convert relative URL to absolute URL for internal API calls
  const fullUrl = downloadUrl.startsWith('http') ? downloadUrl : `${apiUrl}${downloadUrl}`;

  const response = await fetch(fullUrl, {
    headers: {
      'x-bot-token': serviceToken
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to download file: ${response.statusText}`);
  }

  return await response.text();
}

export function findBibliographyFile(files: any[]): any | null {
  return files.find(file =>
    file.originalName.match(/\.(bib|bibtex)$/i) ||
    file.detectedFormat === 'bibtex'
  );
}

export async function getManuscriptMetadata(manuscriptId: string, serviceToken: string, apiUrl: string = DEFAULT_API_URL): Promise<any> {
  const response = await fetch(`${apiUrl}/api/articles/${manuscriptId}`, {
    headers: {
      'x-bot-token': serviceToken,
      'content-type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch manuscript metadata: ${response.statusText}`);
  }

  return await response.json();
}

export async function uploadRenderedFile(
  manuscriptId: string,
  filename: string,
  content: string | Buffer,
  mimeType: string = 'text/html',
  serviceToken: string,
  apiUrl: string = DEFAULT_API_URL
): Promise<any> {
  const formData = new FormData();

  const blob = typeof content === 'string'
    ? new Blob([content], { type: mimeType })
    : new Blob([new Uint8Array(content) as BlobPart], { type: mimeType });

  formData.append('files', blob, filename);
  formData.append('fileType', 'RENDERED');
  formData.append('renderedBy', 'bot-markdown-renderer');

  const response = await fetch(`${apiUrl}/api/articles/${manuscriptId}/files`, {
    method: 'POST',
    headers: {
      'x-bot-token': serviceToken
    },
    body: formData
  });

  if (!response.ok) {
    throw new Error(`Failed to upload rendered file: ${response.statusText}`);
  }

  const result = await response.json();

  // Add size information for tracking and fix download URL
  const fileResult = result.files[0];
  return {
    ...fileResult,
    size: typeof content === 'string' ? content.length : content.length,
    downloadUrl: `${apiUrl}${fileResult.downloadUrl}`
  };
}
