/**
 * Mock file utilities for bot testing
 */
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
/**
 * Creates a mock file with the given options
 */
export declare function createMockFile(options: Partial<MockFile> & {
    filename?: string;
    originalName?: string;
}): MockFile;
/**
 * Pre-built mock markdown file
 */
export declare const mockMarkdownFile: MockFile;
/**
 * Pre-built mock bibliography file
 */
export declare const mockBibliographyFile: MockFile;
/**
 * Pre-built mock image file
 */
export declare const mockImageFile: MockFile;
/**
 * Creates a set of mock files for a typical manuscript submission
 */
export declare function createMockManuscriptFiles(options?: {
    markdownContent?: string;
    bibliographyContent?: string;
    includeImages?: boolean;
    imageCount?: number;
}): MockFile[];
//# sourceMappingURL=mockFiles.d.ts.map