/**
 * Markdown Renderer Bot - Seed Data Tests
 *
 * These tests use real seed data files from disk to test the markdown renderer
 * against realistic academic content. The tests run without needing the API server.
 *
 * Prerequisites:
 * - Run `npm run db:seed` to generate seed data files
 * - Seed files should exist in apps/api/uploads/manuscripts/
 */

import { markdownRendererBot } from '../index';
import {
  SeedDataTestRunner,
  describeSeedDataTests,
  BotTestHarness,
  assertBotResponse,
  MockFile,
  SeedPaperInfo
} from '@colloquium/bots/testing';
type MockFileType = MockFile;
type SeedPaperInfoType = SeedPaperInfo;

// Mock puppeteer
jest.mock('puppeteer', () => ({
  launch: jest.fn().mockResolvedValue({
    newPage: jest.fn().mockResolvedValue({
      setContent: jest.fn(),
      pdf: jest.fn().mockResolvedValue(Buffer.from('mock-pdf-content')),
    }),
    close: jest.fn(),
  }),
}));

// Mock DOMPurify
jest.mock('dompurify', () => ({
  __esModule: true,
  default: () => ({
    sanitize: jest.fn((html) => html),
  }),
}));

// Mock JSDOM
jest.mock('jsdom', () => ({
  JSDOM: jest.fn().mockImplementation(() => ({
    window: {
      DOMPurify: jest.fn(),
    },
  })),
}));

// Mock marked to actually process some markdown
jest.mock('marked', () => {
  const convert = (content: string) => {
    // Simple markdown to HTML conversion for testing
    return content
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/^(.+)$/gm, '<p>$1</p>');
  };
  const mockMarked = jest.fn(convert);
  (mockMarked as any).setOptions = jest.fn();
  (mockMarked as any).parse = jest.fn(convert);
  return {
    marked: mockMarked,
  };
});

// Mock Handlebars
jest.mock('handlebars', () => ({
  compile: jest.fn((template: string) =>
    jest.fn((data: any) =>
      template.replace(/\{\{\{?(\w+)\}?\}\}/g, (match: string, key: string) => data[key] || '')
    )
  ),
}));

describe('Markdown Renderer - Seed Data Tests', () => {
  let runner: SeedDataTestRunner;

  beforeAll(() => {
    runner = new SeedDataTestRunner();
  });

  describe('Seed Data Availability', () => {
    it('should detect if seed data is available', () => {
      const hasSeedData = runner.hasSeedData();
      console.log(`Seed data available: ${hasSeedData}`);
      console.log(`Uploads directory: ${runner.getUploadsDir()}`);

      // This test always passes but logs the status
      expect(typeof hasSeedData).toBe('boolean');
    });

    it('should list available seed papers', () => {
      const papers = runner.getAvailablePapers();
      console.log(`Found ${papers.length} seed papers:`);
      papers.forEach((paper: SeedPaperInfoType) => {
        console.log(`  - ${paper.key}: ${paper.title}`);
        console.log(`    Markdown: ${paper.markdownFile}`);
        console.log(`    Bibliography: ${paper.bibliographyFile || 'none'}`);
        console.log(`    Images: ${paper.imageFiles.join(', ') || 'none'}`);
      });

      expect(Array.isArray(papers)).toBe(true);
    });
  });

  // These tests only run if seed data is available
  describeSeedDataTests('Rendering with real seed content', (seedRunner: SeedDataTestRunner) => {
    describe('ML Peer Review Paper', () => {
      let harness: BotTestHarness<typeof markdownRendererBot>;

      beforeEach(() => {
        harness = seedRunner.createHarnessForPaper(markdownRendererBot, 'mlPeerReview');

        // Mock Pandoc service
        harness.getMockServer().addEndpoint({
          method: 'POST',
          path: /\/convert/,
          response: () => ({
            ok: true,
            status: 200,
            text: async () => '<html><body><p>Rendered ML paper content</p></body></html>',
            arrayBuffer: async () => new TextEncoder().encode('<html><body><p>Rendered</p></body></html>').buffer
          })
        });
      });

      afterEach(() => {
        harness.cleanup();
      });

      it('should load ML peer review paper files', () => {
        const files = harness.getFiles();

        expect(files.length).toBeGreaterThanOrEqual(2); // At least markdown and bib

        const mdFile = files.find((f: MockFileType) => f.filename.includes('.md'));
        expect(mdFile).toBeDefined();
        expect(mdFile!.content).toBeDefined();

        // Verify content is realistic
        const content = typeof mdFile!.content === 'string'
          ? mdFile!.content
          : mdFile!.content.toString();
        expect(content.toLowerCase()).toContain('machine learning');
      });

      it('should have bibliography file with citations', () => {
        const files = harness.getFiles();

        const bibFile = files.find((f: MockFileType) => f.filename.includes('.bib'));
        expect(bibFile).toBeDefined();

        const content = typeof bibFile!.content === 'string'
          ? bibFile!.content
          : bibFile!.content.toString();

        // Verify it contains BibTeX entries
        expect(content).toContain('@article');
        expect(content).toContain('author');
      });
    });

    describe('Colloquium Platform Paper', () => {
      let harness: BotTestHarness<typeof markdownRendererBot>;

      beforeEach(() => {
        harness = seedRunner.createHarnessForPaper(markdownRendererBot, 'colloquiumPlatform');

        harness.getMockServer().addEndpoint({
          method: 'POST',
          path: /\/convert/,
          response: () => ({
            ok: true,
            status: 200,
            text: async () => '<html><body><p>Rendered content</p></body></html>',
            arrayBuffer: async () => new TextEncoder().encode('<html></html>').buffer
          })
        });
      });

      afterEach(() => {
        harness.cleanup();
      });

      it('should load Colloquium platform paper', () => {
        const files = harness.getFiles();
        const mdFile = files.find((f: MockFileType) => f.filename.includes('.md'));

        expect(mdFile).toBeDefined();

        const content = typeof mdFile!.content === 'string'
          ? mdFile!.content
          : mdFile!.content.toString();

        expect(content).toContain('Colloquium');
        expect(content.toLowerCase()).toContain('academic publishing');
      });
    });

    describe('Climate Modeling Paper', () => {
      let harness: BotTestHarness<typeof markdownRendererBot>;

      beforeEach(() => {
        harness = seedRunner.createHarnessForPaper(markdownRendererBot, 'climateModeling');

        harness.getMockServer().addEndpoint({
          method: 'POST',
          path: /\/convert/,
          response: () => ({
            ok: true,
            status: 200,
            text: async () => '<html><body><p>Rendered content</p></body></html>',
            arrayBuffer: async () => new TextEncoder().encode('<html></html>').buffer
          })
        });
      });

      afterEach(() => {
        harness.cleanup();
      });

      it('should load climate modeling paper with multiple images', () => {
        const files = harness.getFiles();

        const mdFile = files.find((f: MockFileType) => f.filename.includes('.md'));
        expect(mdFile).toBeDefined();

        // Climate paper has multiple images
        const imageFiles = files.filter((f: MockFileType) => f.fileType === 'ASSET');
        expect(imageFiles.length).toBeGreaterThanOrEqual(1);
      });

      it('should have image files that are valid PNGs', () => {
        const files = harness.getFiles();
        const imageFiles = files.filter((f: MockFileType) => f.fileType === 'ASSET');

        for (const imgFile of imageFiles) {
          expect(imgFile.mimetype).toBe('image/png');

          // PNG files start with specific magic bytes
          if (Buffer.isBuffer(imgFile.content)) {
            const header = imgFile.content.slice(0, 8);
            // PNG signature: 137 80 78 71 13 10 26 10
            expect(header[0]).toBe(137);
            expect(header[1]).toBe(80); // P
            expect(header[2]).toBe(78); // N
            expect(header[3]).toBe(71); // G
          }
        }
      });
    });

    describe('Cross-paper tests', () => {
      it('should be able to load all available papers', () => {
        const papers = seedRunner.getAvailablePapers();

        for (const paper of papers) {
          const files = seedRunner.loadPaperFiles(paper.key);

          expect(files.length).toBeGreaterThan(0);

          const mdFile = files.find((f: MockFileType) => f.fileType === 'SOURCE');
          expect(mdFile).toBeDefined();
          expect(mdFile!.content).toBeDefined();
        }
      });

      it('should have consistent file structure across papers', () => {
        const papers = seedRunner.getAvailablePapers();

        for (const paper of papers) {
          // Each paper should have a markdown file
          expect(paper.markdownFile).toBeDefined();
          expect(paper.markdownFile).toMatch(/\.md$/);

          // Each paper should have a title
          expect(paper.title).toBeDefined();
          expect(paper.title.length).toBeGreaterThan(0);
        }
      });
    });
  });
});

describe('Seed Data Runner', () => {
  it('should handle missing paper gracefully', () => {
    const runner = new SeedDataTestRunner();

    expect(() => {
      runner.loadPaperFiles('nonexistent-paper');
    }).toThrow(/not found/i);
  });

  it('should handle missing file gracefully', () => {
    const runner = new SeedDataTestRunner();

    expect(() => {
      runner.readFile('nonexistent-file.md');
    }).toThrow(/not found/i);
  });
});
