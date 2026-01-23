"use strict";
/**
 * Mock file utilities for bot testing
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.mockImageFile = exports.mockBibliographyFile = exports.mockMarkdownFile = void 0;
exports.createMockFile = createMockFile;
exports.createMockManuscriptFiles = createMockManuscriptFiles;
let fileIdCounter = 0;
/**
 * Creates a mock file with the given options
 */
function createMockFile(options) {
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
        downloadUrl: options.downloadUrl ?? `http://localhost:4000/api/articles/test/files/${id}/download`,
        size: options.size ?? (typeof content === 'string' ? Buffer.byteLength(content) : content.length)
    };
}
/**
 * Guesses MIME type from filename extension
 */
function guessMimeType(filename) {
    const ext = filename.split('.').pop()?.toLowerCase();
    const mimeTypes = {
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
exports.mockMarkdownFile = createMockFile({
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
exports.mockBibliographyFile = createMockFile({
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
exports.mockImageFile = createMockFile({
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
function createMockManuscriptFiles(options = {}) {
    const files = [];
    // Add markdown file
    files.push(createMockFile({
        id: 'manuscript-md',
        filename: 'manuscript.md',
        originalName: 'manuscript.md',
        fileType: 'SOURCE',
        mimetype: 'text/markdown',
        content: options.markdownContent ?? exports.mockMarkdownFile.content
    }));
    // Add bibliography file if content provided
    if (options.bibliographyContent !== undefined || options.bibliographyContent === undefined) {
        files.push(createMockFile({
            id: 'references-bib',
            filename: 'references.bib',
            originalName: 'references.bib',
            fileType: 'BIBLIOGRAPHY',
            mimetype: 'application/x-bibtex',
            content: options.bibliographyContent ?? exports.mockBibliographyFile.content
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
