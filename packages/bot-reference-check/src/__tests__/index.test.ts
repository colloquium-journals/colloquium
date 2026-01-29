import { referenceCheckBot } from '../index';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Sample manuscript content with references
const sampleManuscriptContent = `
# Sample Manuscript

## Introduction
This is a sample manuscript with references.

## Methods
We used various techniques as described in the literature.

## Results
Our findings are consistent with previous work.

## References

1. Smith, J., & Jones, M. (2023). Advanced machine learning techniques. Nature Methods, 15(3), 123-130. https://doi.org/10.1038/s41592-020-0935-4

2. Brown, A. et al. (2022). Data analysis in computational biology. Cell, 180(4), 567-580.

3. Wilson, K. (2021). Statistical methods for biological research. Journal of Methods, 10(2), 45-60.
`;

// Mock file list response
const mockFilesResponse = {
  files: [
    {
      id: 'file-1',
      filename: 'manuscript.md',
      originalName: 'manuscript.md',
      fileType: 'SOURCE',
      mimetype: 'text/markdown',
      size: 1234,
      downloadUrl: '/api/articles/test-manuscript-123/files/file-1/download'
    }
  ]
};

describe('Reference Check Bot', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('should have correct bot metadata', () => {
    expect(referenceCheckBot.id).toBe('bot-reference-check');
    expect(referenceCheckBot.name).toBe('Reference Check Bot');
    expect(referenceCheckBot.description).toBe('Validates DOIs resolve to real papers and flags references missing DOIs');
    expect(referenceCheckBot.version).toBe('1.0.0');
  });

  it('should have the expected commands (before help injection)', () => {
    expect(referenceCheckBot.commands).toHaveLength(1);

    const commandNames = referenceCheckBot.commands.map(cmd => cmd.name);
    expect(commandNames).toContain('check-doi');
    expect(commandNames).not.toContain('help'); // Help command will be injected by the framework
  });

  it('should have the expected keywords', () => {
    expect(referenceCheckBot.keywords).toEqual(['references', 'doi', 'citation', 'bibliography', 'validation']);
  });

  it('should have the expected permissions', () => {
    expect(referenceCheckBot.permissions).toEqual(['read_manuscript', 'read_manuscript_files']);
  });

  describe('check-doi command', () => {
    const checkDoiCommand = referenceCheckBot.commands.find(cmd => cmd.name === 'check-doi');

    it('should exist and have correct metadata', () => {
      expect(checkDoiCommand).toBeDefined();
      expect(checkDoiCommand!.description).toBe('Check all references in the manuscript for DOI presence and validity');
      expect(checkDoiCommand!.permissions).toEqual(['read_manuscript', 'read_manuscript_files']);
    });

    it('should have correct parameters', () => {
      expect(checkDoiCommand!.parameters).toHaveLength(2);

      const paramNames = checkDoiCommand!.parameters.map(p => p.name);
      expect(paramNames).toContain('detailed');
      expect(paramNames).toContain('timeout');
    });

    it('should return auth error when no service token provided', async () => {
      const mockContext = {
        manuscriptId: 'test-manuscript-123',
        conversationId: 'test-conversation-456',
        triggeredBy: {
          messageId: 'test-message-789',
          userId: 'test-user-001',
          userRole: 'USER',
          trigger: 'MENTION' as const
        },
        journal: {
          id: 'test-journal',
          settings: {}
        },
        config: {}
        // No serviceToken
      };

      const result = await checkDoiCommand!.execute({}, mockContext);

      expect(result).toBeDefined();
      expect(result.messages).toBeDefined();
      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].content).toContain('Authentication Error');
    });

    it('should execute successfully with service token', async () => {
      // Mock the files API call
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/files') && !url.includes('/download')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockFilesResponse)
          });
        }
        if (url.includes('/download')) {
          return Promise.resolve({
            ok: true,
            text: () => Promise.resolve(sampleManuscriptContent)
          });
        }
        // CrossRef API - mock a successful DOI resolution
        if (url.includes('crossref.org')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({
              message: {
                title: ['Test Paper Title'],
                author: [{ given: 'John', family: 'Smith' }],
                published: { 'date-parts': [[2023]] },
                'container-title': ['Nature Methods']
              }
            })
          });
        }
        return Promise.reject(new Error('Unknown URL'));
      });

      const mockContext = {
        manuscriptId: 'test-manuscript-123',
        conversationId: 'test-conversation-456',
        triggeredBy: {
          messageId: 'test-message-789',
          userId: 'test-user-001',
          userRole: 'USER',
          trigger: 'MENTION' as const
        },
        journal: {
          id: 'test-journal',
          settings: {}
        },
        config: {},
        serviceToken: 'test-bot-token-123'
      };

      const result = await checkDoiCommand!.execute({}, mockContext);

      expect(result).toBeDefined();
      expect(result.messages).toBeDefined();
      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].content).toContain('DOI Reference Check');
      expect(result.messages[0].content).toContain('test-manuscript-123');
      expect(result.messages[0].content).toContain('**Source file:** manuscript.md');
    });

    it('should handle detailed parameter', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/files') && !url.includes('/download')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockFilesResponse)
          });
        }
        if (url.includes('/download')) {
          return Promise.resolve({
            ok: true,
            text: () => Promise.resolve(sampleManuscriptContent)
          });
        }
        if (url.includes('crossref.org')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({
              message: {
                title: ['Test Paper Title'],
                author: [{ given: 'John', family: 'Smith' }],
                published: { 'date-parts': [[2023]] },
                'container-title': ['Nature Methods']
              }
            })
          });
        }
        return Promise.reject(new Error('Unknown URL'));
      });

      const mockContext = {
        manuscriptId: 'test-manuscript-123',
        conversationId: 'test-conversation-456',
        triggeredBy: {
          messageId: 'test-message-789',
          userId: 'test-user-001',
          userRole: 'USER',
          trigger: 'MENTION' as const
        },
        journal: {
          id: 'test-journal',
          settings: {}
        },
        config: {},
        serviceToken: 'test-bot-token-123'
      };

      const result = await checkDoiCommand!.execute({ detailed: true }, mockContext);

      expect(result.messages[0].content).toContain('Detailed metadata: Yes');
    });

    it('should include JSON report attachment', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/files') && !url.includes('/download')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockFilesResponse)
          });
        }
        if (url.includes('/download')) {
          return Promise.resolve({
            ok: true,
            text: () => Promise.resolve(sampleManuscriptContent)
          });
        }
        if (url.includes('crossref.org')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({
              message: {
                title: ['Test Paper Title'],
                author: [{ given: 'John', family: 'Smith' }],
                published: { 'date-parts': [[2023]] },
                'container-title': ['Nature Methods']
              }
            })
          });
        }
        return Promise.reject(new Error('Unknown URL'));
      });

      const mockContext = {
        manuscriptId: 'test-manuscript-123',
        conversationId: 'test-conversation-456',
        triggeredBy: {
          messageId: 'test-message-789',
          userId: 'test-user-001',
          userRole: 'USER',
          trigger: 'MENTION' as const
        },
        journal: {
          id: 'test-journal',
          settings: {}
        },
        config: {},
        serviceToken: 'test-bot-token-123'
      };

      const result = await checkDoiCommand!.execute({}, mockContext);

      expect(result.messages[0].attachments).toBeDefined();
      expect(result.messages[0].attachments).toHaveLength(1);
      expect(result.messages[0].attachments![0].type).toBe('report');
      expect(result.messages[0].attachments![0].filename).toBe('doi-check-report-test-manuscript-123.json');
      expect(result.messages[0].attachments![0].mimetype).toBe('application/json');

      // Verify the JSON structure
      const reportData = JSON.parse(result.messages[0].attachments![0].data);
      expect(reportData.manuscriptId).toBe('test-manuscript-123');
      expect(reportData.summary).toBeDefined();
      expect(reportData.issues).toBeDefined();
      expect(reportData.detailedResults).toBeDefined();
    });

    it('should handle no files found', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/files')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ files: [] })
          });
        }
        return Promise.reject(new Error('Unknown URL'));
      });

      const mockContext = {
        manuscriptId: 'test-manuscript-123',
        conversationId: 'test-conversation-456',
        triggeredBy: {
          messageId: 'test-message-789',
          userId: 'test-user-001',
          userRole: 'USER',
          trigger: 'MENTION' as const
        },
        journal: {
          id: 'test-journal',
          settings: {}
        },
        config: {},
        serviceToken: 'test-bot-token-123'
      };

      const result = await checkDoiCommand!.execute({}, mockContext);

      expect(result.messages[0].content).toContain('No files found');
    });
  });

  it('should have proper help metadata for framework injection', () => {
    expect(referenceCheckBot.help).toBeDefined();
    expect(referenceCheckBot.help!.overview).toBeDefined();
    expect(referenceCheckBot.help!.quickStart).toBeDefined();
    expect(referenceCheckBot.help!.examples).toBeDefined();
    expect(referenceCheckBot.customHelpSections).toBeDefined();
    expect(referenceCheckBot.customHelpSections!.length).toBeGreaterThan(0);
  });
});
