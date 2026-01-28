/**
 * Markdown Renderer Bot Tests using the Bot Testing Framework
 *
 * These tests demonstrate how to use the testing utilities from @colloquium/bots/testing
 * to test bot commands with mocked dependencies.
 */

import { markdownRendererBot } from '../index';
import {
  BotTestHarness,
  createTestHarness,
  createMockFile,
  createMockManuscriptFiles,
  mockMarkdownFile,
  mockBibliographyFile,
  assertBotResponse,
  assertBotMessageNotContains
} from '@colloquium/bots/testing';

// Mock puppeteer (not used in harness tests but needed for module loading)
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

// Mock marked
jest.mock('marked', () => {
  const mockMarked = jest.fn((content: string) => `<p>${content}</p>`);
  (mockMarked as any).setOptions = jest.fn();
  return {
    marked: mockMarked,
  };
});

// Mock Handlebars
jest.mock('handlebars', () => ({
  compile: jest.fn((template: string) =>
    jest.fn((data: any) =>
      template.replace(/\{\{(\w+)\}\}/g, (match: string, key: string) => data[key] || '')
    )
  ),
}));

describe('Markdown Renderer Bot - Test Harness', () => {
  let harness: BotTestHarness<typeof markdownRendererBot>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    if (harness) {
      harness.cleanup();
    }
  });

  describe('Bot Metadata', () => {
    it('should have correct bot metadata', () => {
      expect(markdownRendererBot.id).toBe('bot-markdown-renderer');
      expect(markdownRendererBot.name).toBe('Markdown Renderer');
      expect(markdownRendererBot.version).toBe('1.0.0');
    });

    it('should have the expected commands', () => {
      const commandNames = markdownRendererBot.commands.map(cmd => cmd.name);
      expect(commandNames).toContain('render');
      expect(commandNames).toContain('templates');
      expect(commandNames).toContain('upload-template');
    });
  });

  describe('render command with test harness', () => {
    it('should handle missing markdown file', async () => {
      harness = createTestHarness(markdownRendererBot, {
        files: [
          createMockFile({
            filename: 'document.pdf',
            originalName: 'document.pdf',
            fileType: 'SOURCE',
            mimetype: 'application/pdf',
            content: Buffer.from('pdf content')
          })
        ]
      });

      const result = await harness.executeCommand('render', {});

      assertBotResponse(result, {
        messageContains: 'No Markdown File Found'
      });
    });

    it('should render markdown file with test harness', async () => {
      // Create harness with markdown files
      harness = createTestHarness(markdownRendererBot, {
        files: createMockManuscriptFiles({
          markdownContent: '# Test Paper\n\nThis is test content.',
          bibliographyContent: mockBibliographyFile.content as string
        }),
        manuscriptData: {
          title: 'Test Manuscript',
          authors: [{ name: 'Test Author', isCorresponding: true }],
          abstract: 'This is a test abstract'
        }
      });

      // Add custom endpoint for Pandoc service mock
      harness.getMockServer().addEndpoint({
        method: 'POST',
        path: /\/convert/,
        response: () => ({
          ok: true,
          status: 200,
          text: async () => '<html><body><p>Rendered content</p></body></html>',
          arrayBuffer: async () => new TextEncoder().encode('<html><body><p>Rendered</p></body></html>').buffer
        })
      });

      const result = await harness.executeCommand('render', { output: 'html' });

      // Verify the response
      assertBotResponse(result, {
        messageCount: 1
      });

      // Should contain success message or error (depending on template availability)
      expect(result.messages).toBeDefined();
      expect(result.messages!.length).toBeGreaterThan(0);
    });

    it('should use custom context options', async () => {
      harness = createTestHarness(markdownRendererBot)
        .withFiles([mockMarkdownFile])
        .withManuscript({
          title: 'Custom Title',
          authors: ['Author One', 'Author Two']
        })
        .withConfig({
          templateName: 'minimal',
          outputFormats: ['html']
        });

      const context = harness.getContext();

      expect(context.config.templateName).toBe('minimal');
      expect(context.config.outputFormats).toEqual(['html']);
    });

    it('should track API requests', async () => {
      harness = createTestHarness(markdownRendererBot, {
        files: [mockMarkdownFile]
      });

      harness.clearRequestLog();

      // Execute command
      try {
        await harness.executeCommand('render', {});
      } catch {
        // Ignore errors, we just want to check the request log
      }

      const requests = harness.getRequestLog();

      // Should have made requests to fetch files
      expect(requests.length).toBeGreaterThan(0);
    });
  });

  describe('templates command with test harness', () => {
    it('should list available templates', async () => {
      harness = createTestHarness(markdownRendererBot);

      const result = await harness.executeCommand('templates', {});

      assertBotResponse(result, {
        messageContains: ['Available Journal Templates', 'Usage Examples']
      });
    });

    it('should show custom templates from config', async () => {
      harness = createTestHarness(markdownRendererBot)
        .withConfig({
          customTemplates: {
            'my-template': {
              title: 'My Custom Template',
              description: 'A custom template for testing'
            }
          }
        });

      const result = await harness.executeCommand('templates', {});

      assertBotResponse(result, {
        messageContains: 'My Custom Template'
      });
    });
  });

  describe('upload-template command with test harness', () => {
    it('should provide upload instructions', async () => {
      harness = createTestHarness(markdownRendererBot);

      const result = await harness.executeCommand('upload-template', {});

      assertBotResponse(result, {
        messageContains: [
          'Upload Custom Journal Templates',
          'Step 1',
          'Step 2',
          'Step 3',
          '{{title}}',
          '{{content}}'
        ]
      });
    });
  });

  describe('Error handling', () => {
    it('should handle missing service token', async () => {
      harness = createTestHarness(markdownRendererBot, {
        context: {
          serviceToken: undefined
        },
        files: [mockMarkdownFile]
      });

      // Override context to remove service token
      harness.withContext({ serviceToken: '' });

      const result = await harness.executeCommand('render', {});

      assertBotResponse(result, {
        messageContains: 'Authentication Error'
      });
    });

    it('should handle API errors gracefully', async () => {
      harness = createTestHarness(markdownRendererBot)
        .withFiles([mockMarkdownFile]);

      // Add endpoint that returns error
      harness.getMockServer().addEndpoint({
        method: 'GET',
        path: /\/api\/articles/,
        response: () => ({
          ok: false,
          status: 500,
          json: async () => ({ error: 'Internal Server Error' })
        })
      });

      const result = await harness.executeCommand('render', {});

      // Should contain error message
      expect(result.messages).toBeDefined();
      expect(result.messages!.length).toBeGreaterThan(0);
    });
  });

  describe('Assertion helpers', () => {
    it('should work with assertBotMessageNotContains', async () => {
      harness = createTestHarness(markdownRendererBot);

      const result = await harness.executeCommand('templates', {});

      assertBotMessageNotContains(result, 'ERROR');
      assertBotMessageNotContains(result, ['FAILED', 'CRASH']);
    });
  });
});
