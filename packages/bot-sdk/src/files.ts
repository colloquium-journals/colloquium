import { HttpClient } from './http';
import { FileData } from './types';

export function createFileClient(http: HttpClient, manuscriptId: string) {
  return {
    async list(filter?: { fileType?: string }): Promise<FileData[]> {
      const data = await http.getJSON<{ files: FileData[] }>(
        `/api/articles/${manuscriptId}/files`
      );
      const files = data.files || [];
      if (filter?.fileType) {
        return files.filter(f => f.fileType === filter.fileType);
      }
      return files;
    },

    async download(fileId: string): Promise<string> {
      const response = await http.request(
        `/api/articles/${manuscriptId}/files/${fileId}/download`
      );
      return response.text();
    },

    async downloadByUrl(url: string): Promise<string> {
      const response = await http.request(url);
      return response.text();
    },

    async upload(
      filename: string,
      content: string | Buffer,
      options: {
        fileType?: string;
        renderedBy?: string;
        mimetype?: string;
      } = {}
    ): Promise<{ id: string; filename: string; downloadUrl: string; size: number }> {
      const formData = new FormData();
      const mimeType = options.mimetype || 'application/octet-stream';

      const blob = typeof content === 'string'
        ? new Blob([content], { type: mimeType })
        : new Blob([new Uint8Array(content) as BlobPart], { type: mimeType });

      formData.append('files', blob, filename);

      if (options.fileType) {
        formData.append('fileType', options.fileType);
      }
      if (options.renderedBy) {
        formData.append('renderedBy', options.renderedBy);
      }

      const response = await http.request(
        `/api/articles/${manuscriptId}/files`,
        { method: 'POST', body: formData }
      );

      const result = await response.json() as { files: Array<{ id: string; filename: string; downloadUrl: string }> };
      const fileResult = result.files[0];

      return {
        ...fileResult,
        size: typeof content === 'string' ? Buffer.byteLength(content, 'utf-8') : content.length,
      };
    },
  };
}

export type FileClient = ReturnType<typeof createFileClient>;
