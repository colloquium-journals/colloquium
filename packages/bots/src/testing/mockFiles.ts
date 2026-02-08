/**
 * Mock file utilities for bot testing
 */

const DEFAULT_API_URL = process.env.API_URL || 'http://localhost:4000';

export type MockFileType = 'SOURCE' | 'ASSET' | 'BIBLIOGRAPHY' | 'RENDERED';

export interface MockFile {
  id: string;
  filename: string;
  originalName: string;
  fileType: MockFileType;
  mimetype: string;
  content: string | Buffer;
  downloadUrl?: string;
  size?: number;
}

let fileIdCounter = 0;

/**
 * Creates a mock file with the given options
 */
export function createMockFile(options: Partial<MockFile> & { filename?: string; originalName?: string }): MockFile {
  const id = options.id ?? `mock-file-${++fileIdCounter}`;
  const filename = options.filename ?? options.originalName ?? 'untitled';
  const content = options.content ?? '';

  return {
    id,
    filename,
    originalName: options.originalName ?? filename,
    fileType: options.fileType ?? 'SOURCE',
    mimetype: options.mimetype ?? guessMimeType(filename),
    content,
    downloadUrl: options.downloadUrl ?? `${DEFAULT_API_URL}/api/articles/test/files/${id}/download`,
    size: options.size ?? (typeof content === 'string' ? Buffer.byteLength(content) : content.length)
  };
}

/**
 * Guesses MIME type from filename extension
 */
function guessMimeType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  const mimeTypes: Record<string, string> = {
    'md': 'text/markdown',
    'markdown': 'text/markdown',
    'txt': 'text/plain',
    'html': 'text/html',
    'css': 'text/css',
    'js': 'application/javascript',
    'json': 'application/json',
    'bib': 'application/x-bibtex',
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'gif': 'image/gif',
    'svg': 'image/svg+xml',
    'pdf': 'application/pdf',
  };
  return mimeTypes[ext ?? ''] ?? 'application/octet-stream';
}

/**
 * Pre-built mock markdown file
 */
export const mockMarkdownFile: MockFile = createMockFile({
  id: 'mock-markdown-1',
  filename: 'manuscript.md',
  originalName: 'manuscript.md',
  fileType: 'SOURCE',
  mimetype: 'text/markdown',
  content: `# Test Manuscript

## Abstract

This is a test abstract for the manuscript.

## Introduction

This is the introduction section.

## Methods

This is the methods section.

## Results

This is the results section with some citations [@smith2023; @jones2024].

## Discussion

This is the discussion section.

## Conclusion

This is the conclusion.

## References
`
});

/**
 * Pre-built mock bibliography file
 */
export const mockBibliographyFile: MockFile = createMockFile({
  id: 'mock-bib-1',
  filename: 'references.bib',
  originalName: 'references.bib',
  fileType: 'BIBLIOGRAPHY',
  mimetype: 'application/x-bibtex',
  content: `@article{smith2023,
  author = {Smith, John},
  title = {A Test Article},
  journal = {Journal of Testing},
  year = {2023},
  volume = {1},
  pages = {1--10}
}

@article{jones2024,
  author = {Jones, Jane},
  title = {Another Test Article},
  journal = {Testing Quarterly},
  year = {2024},
  volume = {2},
  pages = {11--20}
}
`
});

/**
 * Pre-built mock image file
 */
export const mockImageFile: MockFile = createMockFile({
  id: 'mock-image-1',
  filename: 'figure1.png',
  originalName: 'figure1.png',
  fileType: 'ASSET',
  mimetype: 'image/png',
  content: Buffer.from('mock-image-data'),
  size: 1024
});

/**
 * Creates a set of mock files for a typical manuscript submission
 */
export function createMockManuscriptFiles(options: {
  markdownContent?: string;
  bibliographyContent?: string;
  includeImages?: boolean;
  imageCount?: number;
} = {}): MockFile[] {
  const files: MockFile[] = [];

  // Add markdown file
  files.push(createMockFile({
    id: 'manuscript-md',
    filename: 'manuscript.md',
    originalName: 'manuscript.md',
    fileType: 'SOURCE',
    mimetype: 'text/markdown',
    content: options.markdownContent ?? mockMarkdownFile.content
  }));

  // Add bibliography file if content provided
  if (options.bibliographyContent !== undefined || options.bibliographyContent === undefined) {
    files.push(createMockFile({
      id: 'references-bib',
      filename: 'references.bib',
      originalName: 'references.bib',
      fileType: 'BIBLIOGRAPHY',
      mimetype: 'application/x-bibtex',
      content: options.bibliographyContent ?? mockBibliographyFile.content
    }));
  }

  // Add image files if requested
  if (options.includeImages !== false) {
    const imageCount = options.imageCount ?? 1;
    for (let i = 1; i <= imageCount; i++) {
      files.push(createMockFile({
        id: `figure-${i}`,
        filename: `figure${i}.png`,
        originalName: `figure${i}.png`,
        fileType: 'ASSET',
        mimetype: 'image/png',
        content: Buffer.from(`mock-image-${i}`),
        size: 1024 * i
      }));
    }
  }

  return files;
}
