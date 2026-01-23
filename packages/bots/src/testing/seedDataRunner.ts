/**
 * Seed Data Test Runner
 *
 * Enables testing bots against real seed data files without running the API server
 */

import * as fs from 'fs';
import * as path from 'path';
import { CommandBot, BotContext } from '@colloquium/types';
import { MockApiServer, MockManuscriptData } from './mockApiServer';
import { MockFile, createMockFile } from './mockFiles';
import { BotTestHarness, createTestHarness } from './testHarness';
import { createMockContext } from './mockContext';

// Import the papers structure from seed-content if available
// This allows the runner to know about available papers
interface PaperDefinition {
  title: string;
  abstract: string;
  content: string;
  images: { filename: string; generator: () => Buffer }[];
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
export class SeedDataTestRunner {
  private uploadsDir: string;
  private papers: Record<string, PaperDefinition> | null = null;

  constructor(options: SeedDataRunnerOptions = {}) {
    // Default to the standard uploads directory
    // Try multiple possible paths based on where the code might be running from
    if (options.uploadsDir) {
      this.uploadsDir = options.uploadsDir;
    } else {
      // Try to find the uploads directory relative to common locations
      const possiblePaths = [
        // From bots package source
        path.resolve(__dirname, '../../../../../../apps/api/uploads/manuscripts'),
        // From bots package dist
        path.resolve(__dirname, '../../../../../../../apps/api/uploads/manuscripts'),
        // From other packages in the monorepo
        path.resolve(process.cwd(), '../../apps/api/uploads/manuscripts'),
        path.resolve(process.cwd(), '../apps/api/uploads/manuscripts'),
        path.resolve(process.cwd(), 'apps/api/uploads/manuscripts'),
      ];

      // Find the first path that exists
      let foundPath: string | undefined;
      for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
          foundPath = p;
          break;
        }
      }

      // Use found path or fallback to the first option
      this.uploadsDir = foundPath ?? possiblePaths[0];
    }

    if (options.papers) {
      this.papers = options.papers;
    }
  }

  /**
   * Gets available seed papers and their files
   */
  getAvailablePapers(): SeedPaperInfo[] {
    const papers: SeedPaperInfo[] = [];

    // Known paper keys from seed-content
    const knownPapers = ['mlPeerReview', 'colloquiumPlatform', 'climateModeling'];

    for (const key of knownPapers) {
      const mdPath = path.join(this.uploadsDir, `${key}.md`);
      const bibPath = path.join(this.uploadsDir, `${key}-references.bib`);

      if (fs.existsSync(mdPath)) {
        const imageFiles: string[] = [];
        const imagePaths: string[] = [];

        // Find associated images based on paper key
        const imagePatterns: Record<string, string[]> = {
          'mlPeerReview': ['performance-results.png'],
          'colloquiumPlatform': ['system-architecture.png'],
          'climateModeling': ['coupling-diagram.png', 'heat-feedback.png']
        };

        for (const imgFile of imagePatterns[key] ?? []) {
          const imgPath = path.join(this.uploadsDir, imgFile);
          if (fs.existsSync(imgPath)) {
            imageFiles.push(imgFile);
            imagePaths.push(imgPath);
          }
        }

        papers.push({
          key,
          title: this.getPaperTitle(key),
          markdownFile: `${key}.md`,
          markdownPath: mdPath,
          bibliographyFile: fs.existsSync(bibPath) ? `${key}-references.bib` : undefined,
          bibliographyPath: fs.existsSync(bibPath) ? bibPath : undefined,
          imageFiles,
          imagePaths
        });
      }
    }

    return papers;
  }

  /**
   * Gets the title for a known paper
   */
  private getPaperTitle(key: string): string {
    const titles: Record<string, string> = {
      'mlPeerReview': 'Machine Learning Applications in Automated Peer Review Systems',
      'colloquiumPlatform': 'A Novel Approach to Academic Publishing: The Colloquium Platform',
      'climateModeling': 'Interdisciplinary Approaches to Climate Change Modeling: Integrating Physical and Social Systems'
    };
    return titles[key] ?? key;
  }

  /**
   * Reads a file from the uploads directory
   */
  readFile(filename: string): string | Buffer {
    const filePath = path.join(this.uploadsDir, filename);

    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    // Determine if binary or text based on extension
    const ext = path.extname(filename).toLowerCase();
    const binaryExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.pdf', '.bib'];

    if (binaryExtensions.includes(ext)) {
      return fs.readFileSync(filePath);
    }

    return fs.readFileSync(filePath, 'utf-8');
  }

  /**
   * Loads files for a specific paper as MockFiles
   */
  loadPaperFiles(paperKey: string): MockFile[] {
    const paperInfo = this.getAvailablePapers().find(p => p.key === paperKey);

    if (!paperInfo) {
      throw new Error(`Paper "${paperKey}" not found. Available papers: ${this.getAvailablePapers().map(p => p.key).join(', ')}`);
    }

    const files: MockFile[] = [];

    // Load markdown file
    const mdContent = this.readFile(paperInfo.markdownFile);
    files.push(createMockFile({
      id: `${paperKey}-md`,
      filename: paperInfo.markdownFile,
      originalName: paperInfo.markdownFile,
      fileType: 'SOURCE',
      mimetype: 'text/markdown',
      content: mdContent
    }));

    // Load bibliography file if present
    if (paperInfo.bibliographyFile && paperInfo.bibliographyPath) {
      const bibContent = this.readFile(paperInfo.bibliographyFile);
      files.push(createMockFile({
        id: `${paperKey}-bib`,
        filename: paperInfo.bibliographyFile,
        originalName: paperInfo.bibliographyFile,
        fileType: 'BIBLIOGRAPHY',
        mimetype: 'application/x-bibtex',
        content: bibContent
      }));
    }

    // Load image files
    for (let i = 0; i < paperInfo.imageFiles.length; i++) {
      const imgFilename = paperInfo.imageFiles[i];
      const imgContent = this.readFile(imgFilename);
      files.push(createMockFile({
        id: `${paperKey}-img-${i}`,
        filename: imgFilename,
        originalName: imgFilename,
        fileType: 'ASSET',
        mimetype: 'image/png',
        content: imgContent
      }));
    }

    return files;
  }

  /**
   * Creates a test harness pre-configured with seed data for a specific paper
   */
  createHarnessForPaper<T extends CommandBot>(bot: T, paperKey: string): BotTestHarness<T> {
    const paperInfo = this.getAvailablePapers().find(p => p.key === paperKey);

    if (!paperInfo) {
      throw new Error(`Paper "${paperKey}" not found`);
    }

    const files = this.loadPaperFiles(paperKey);

    return createTestHarness(bot, {
      files,
      manuscriptData: {
        id: `seed-${paperKey}`,
        title: paperInfo.title,
        authors: ['Seed Data Author'],
        status: 'SUBMITTED'
      },
      context: {
        manuscriptId: `seed-${paperKey}`
      }
    });
  }

  /**
   * Sets up a mock API server that serves real seed files for a paper
   */
  setupMockApiWithSeedData(paperKey: string): MockApiServer {
    const files = this.loadPaperFiles(paperKey);
    const paperInfo = this.getAvailablePapers().find(p => p.key === paperKey);

    return MockApiServer.withManuscriptAndFiles(
      {
        id: `seed-${paperKey}`,
        title: paperInfo?.title ?? paperKey,
        authors: ['Seed Data Author'],
        status: 'SUBMITTED'
      },
      files
    );
  }

  /**
   * Checks if seed data files are available
   */
  hasSeedData(): boolean {
    return this.getAvailablePapers().length > 0;
  }

  /**
   * Gets the uploads directory path
   */
  getUploadsDir(): string {
    return this.uploadsDir;
  }
}

/**
 * Creates a seed data test runner
 */
export function createSeedDataRunner(options: SeedDataRunnerOptions = {}): SeedDataTestRunner {
  return new SeedDataTestRunner(options);
}

/**
 * Helper to skip tests if seed data is not available
 */
export function describeSeedDataTests(
  name: string,
  fn: (runner: SeedDataTestRunner) => void
): void {
  const runner = new SeedDataTestRunner();

  if (runner.hasSeedData()) {
    describe(name, () => fn(runner));
  } else {
    describe.skip(`${name} (seed data not available)`, () => {
      it('skipped - seed data not found', () => {});
    });
  }
}
