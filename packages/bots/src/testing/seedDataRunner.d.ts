/**
 * Seed Data Test Runner
 *
 * Enables testing bots against real seed data files without running the API server
 */
import { CommandBot } from '@colloquium/types';
import { MockApiServer } from './mockApiServer';
import { MockFile } from './mockFiles';
import { BotTestHarness } from './testHarness';
interface PaperDefinition {
    title: string;
    abstract: string;
    content: string;
    images: {
        filename: string;
        generator: () => Buffer;
    }[];
    bibliography?: {
        filename: string;
        content: string;
    };
}
export interface SeedPaperInfo {
    key: string;
    title: string;
    markdownFile: string;
    markdownPath: string;
    bibliographyFile?: string;
    bibliographyPath?: string;
    imageFiles: string[];
    imagePaths: string[];
}
export interface SeedDataRunnerOptions {
    uploadsDir?: string;
    papers?: Record<string, PaperDefinition>;
}
/**
 * Test runner that uses real seed data files
 */
export declare class SeedDataTestRunner {
    private uploadsDir;
    private papers;
    constructor(options?: SeedDataRunnerOptions);
    /**
     * Gets available seed papers and their files
     */
    getAvailablePapers(): SeedPaperInfo[];
    /**
     * Gets the title for a known paper
     */
    private getPaperTitle;
    /**
     * Reads a file from the uploads directory
     */
    readFile(filename: string): string | Buffer;
    /**
     * Loads files for a specific paper as MockFiles
     */
    loadPaperFiles(paperKey: string): MockFile[];
    /**
     * Creates a test harness pre-configured with seed data for a specific paper
     */
    createHarnessForPaper<T extends CommandBot>(bot: T, paperKey: string): BotTestHarness<T>;
    /**
     * Sets up a mock API server that serves real seed files for a paper
     */
    setupMockApiWithSeedData(paperKey: string): MockApiServer;
    /**
     * Checks if seed data files are available
     */
    hasSeedData(): boolean;
    /**
     * Gets the uploads directory path
     */
    getUploadsDir(): string;
}
/**
 * Creates a seed data test runner
 */
export declare function createSeedDataRunner(options?: SeedDataRunnerOptions): SeedDataTestRunner;
/**
 * Helper to skip tests if seed data is not available
 */
export declare function describeSeedDataTests(name: string, fn: (runner: SeedDataTestRunner) => void): void;
export {};
//# sourceMappingURL=seedDataRunner.d.ts.map