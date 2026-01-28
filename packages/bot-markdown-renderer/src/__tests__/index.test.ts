import { markdownRendererBot } from '../index';

// Mock fetch for API calls
global.fetch = jest.fn();

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
    sanitize: jest.fn((html) => html), // Just return the input for testing
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
  compile: jest.fn((template: string) => jest.fn((data: any) => template.replace(/\{\{(\w+)\}\}/g, (match: string, key: string) => data[key] || ''))),
}));

describe('Markdown Renderer Bot', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default fetch mocks
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/files')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            files: [{
              originalName: 'manuscript.md',
              fileType: 'SOURCE',
              mimetype: 'text/markdown',
              downloadUrl: 'http://localhost/download/manuscript.md'
            }]
          })
        });
      }
      if (url.includes('/manuscripts/')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            title: 'Test Manuscript',
            authors: ['John Doe', 'Jane Smith'],
            abstract: 'This is a test abstract',
            submittedAt: '2024-01-15'
          })
        });
      }
      if (url.includes('download')) {
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve('# Test Manuscript\n\nThis is test content.')
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({})
      });
    });
  });

  it('should have correct bot metadata', () => {
    expect(markdownRendererBot.id).toBe('bot-markdown-renderer');
    expect(markdownRendererBot.name).toBe('Markdown Renderer');
    expect(markdownRendererBot.description).toBe('Renders Markdown manuscripts into professional PDFs using configurable journal templates and multiple rendering engines');
    expect(markdownRendererBot.version).toBe('1.0.0');
  });

  it('should have the expected commands', () => {
    expect(markdownRendererBot.commands).toHaveLength(3);
    
    const commandNames = markdownRendererBot.commands.map(cmd => cmd.name);
    expect(commandNames).toContain('render');
    expect(commandNames).toContain('templates');
    expect(commandNames).toContain('upload-template');
  });

  it('should have the expected keywords', () => {
    expect(markdownRendererBot.keywords).toEqual(['markdown', 'render', 'template', 'pdf', 'latex', 'typst', 'academic']);
  });

  it('should have the expected permissions', () => {
    expect(markdownRendererBot.permissions).toEqual(['read_manuscript_files', 'upload_files']);
  });

  it('should support file uploads', () => {
    expect(markdownRendererBot.supportsFileUploads).toBe(true);
  });

  describe('render command', () => {
    const renderCommand = markdownRendererBot.commands.find(cmd => cmd.name === 'render');

    it('should exist and have correct metadata', () => {
      expect(renderCommand).toBeDefined();
      expect(renderCommand!.description).toBe('Render Markdown files to PDF or HTML using journal templates');
      expect(renderCommand!.permissions).toEqual(['read_manuscript_files', 'upload_files']);
    });

    it('should have correct parameters', () => {
      expect(renderCommand!.parameters).toHaveLength(3);

      const outputParam = renderCommand!.parameters.find(p => p.name === 'output');
      expect(outputParam).toBeDefined();
      expect(outputParam!.type).toBe('string');
      expect(outputParam!.required).toBe(false);
      expect(outputParam!.enumValues).toEqual(['pdf', 'html', 'pdf,html']);

      const templateParam = renderCommand!.parameters.find(p => p.name === 'template');
      expect(templateParam).toBeDefined();
      expect(templateParam!.type).toBe('string');
      expect(templateParam!.required).toBe(false);

      const engineParam = renderCommand!.parameters.find(p => p.name === 'engine');
      expect(engineParam).toBeDefined();
      expect(engineParam!.type).toBe('string');
      expect(engineParam!.required).toBe(false);
      expect(engineParam!.enumValues).toEqual(['typst', 'latex', 'html']);
    });

    it('should execute successfully with default parameters', async () => {
      const mockContext = {
        manuscriptId: 'test-manuscript-123',
        conversationId: 'test-conversation-456',
        serviceToken: 'test-bot-token',
        triggeredBy: {
          messageId: 'test-message-789',
          userId: 'test-user-001',
          userRole: 'USER',
          trigger: 'MENTION' as const
        },
        journal: {
          id: 'test-journal',
          settings: { name: 'Test Journal' }
        },
        config: {}
      };

      // Mock FormData for file upload
      global.FormData = jest.fn().mockImplementation(() => ({
        append: jest.fn(),
      }));

      // Mock Blob
      global.Blob = jest.fn().mockImplementation((content, options) => ({
        size: Array.isArray(content) ? content[0].length : content.length,
        type: options?.type || 'application/pdf'
      }));

      (global.fetch as jest.Mock).mockImplementation((url: string, options?: any) => {
        // Pandoc service
        if (url.includes('localhost:8080/convert')) {
          return Promise.resolve({
            ok: true,
            arrayBuffer: () => Promise.resolve(Buffer.from('mock-pdf-content').buffer)
          });
        }
        // File upload
        if (options?.method === 'POST') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              files: [{
                id: 'file-123',
                filename: 'manuscript.pdf',
                downloadUrl: '/api/articles/test-manuscript-123/files/file-123/download',
                size: 1024
              }]
            })
          });
        }
        // Download file (check before /files since download URLs contain both)
        if (url.includes('/download')) {
          return Promise.resolve({
            ok: true,
            text: () => Promise.resolve('# Test Manuscript\n\nContent here.')
          });
        }
        // Files list
        if (url.includes('/files')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              files: [{
                originalName: 'manuscript.md',
                fileType: 'SOURCE',
                mimetype: 'text/markdown',
                downloadUrl: '/api/articles/test-manuscript-123/files/1/download'
              }]
            })
          });
        }
        // Manuscript metadata
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            title: 'Test Manuscript',
            authors: ['John Doe'],
            abstract: 'Test abstract'
          })
        });
      });

      const result = await renderCommand!.execute({}, mockContext);

      expect(result).toBeDefined();
      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].content).toContain('Markdown Rendered Successfully');
      expect(result.messages[0].content).toContain('manuscript.md');
    });

    it('should handle missing markdown file', async () => {
      const mockContext = {
        manuscriptId: 'test-manuscript-123',
        conversationId: 'test-conversation-456',
        serviceToken: 'test-bot-token',
        triggeredBy: {
          messageId: 'test-message-789',
          userId: 'test-user-001',
          userRole: 'USER',
          trigger: 'MENTION' as const
        },
        journal: { id: 'test-journal', settings: {} },
        config: {}
      };

      // Mock no markdown files
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          files: [{
            originalName: 'document.pdf',
            fileType: 'SOURCE',
            mimetype: 'application/pdf'
          }]
        })
      });

      const result = await renderCommand!.execute({}, mockContext);

      expect(result.messages[0].content).toContain('No Markdown File Found');
    });

    it('should handle different output formats', async () => {
      const mockContext = {
        manuscriptId: 'test-manuscript-123',
        conversationId: 'test-conversation-456',
        serviceToken: 'test-bot-token',
        triggeredBy: {
          messageId: 'test-message-789',
          userId: 'test-user-001',
          userRole: 'USER',
          trigger: 'MENTION' as const
        },
        journal: { id: 'test-journal', settings: {} },
        config: {}
      };

      global.FormData = jest.fn().mockImplementation(() => ({
        append: jest.fn(),
      }));

      global.Blob = jest.fn().mockImplementation(() => ({
        size: 1024,
      }));

      (global.fetch as jest.Mock).mockImplementation((url: string, options?: any) => {
        if (url.includes('localhost:8080/convert')) {
          return Promise.resolve({
            ok: true,
            arrayBuffer: () => Promise.resolve(Buffer.from('mock-pdf').buffer)
          });
        }
        if (options?.method === 'POST') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              files: [{ id: 'f1', filename: 'manuscript.pdf', downloadUrl: '/download/f1', size: 512 }]
            })
          });
        }
        if (url.includes('/files')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              files: [{ originalName: 'manuscript.md', fileType: 'SOURCE', mimetype: 'text/markdown', downloadUrl: '/download/md' }]
            })
          });
        }
        if (url.includes('/download')) {
          return Promise.resolve({ ok: true, text: () => Promise.resolve('# Title\n\nBody') });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ title: 'Test', authors: ['A'], abstract: 'B' })
        });
      });

      const result = await renderCommand!.execute({ output: 'pdf' }, mockContext);
      expect(result.messages[0].content).toContain('Markdown Rendered Successfully');
    });

    it('should handle custom CSS parameter', async () => {
      const mockContext = {
        manuscriptId: 'test-manuscript-123',
        conversationId: 'test-conversation-456',
        serviceToken: 'test-bot-token',
        triggeredBy: {
          messageId: 'test-message-789',
          userId: 'test-user-001',
          userRole: 'USER',
          trigger: 'MENTION' as const
        },
        journal: { id: 'test-journal', settings: {} },
        config: {}
      };

      global.FormData = jest.fn().mockImplementation(() => ({
        append: jest.fn(),
      }));

      global.Blob = jest.fn().mockImplementation(() => ({
        size: 1024,
      }));

      (global.fetch as jest.Mock).mockImplementation((url: string, options?: any) => {
        if (url.includes('localhost:8080/convert')) {
          return Promise.resolve({
            ok: true,
            arrayBuffer: () => Promise.resolve(Buffer.from('mock-pdf').buffer)
          });
        }
        if (options?.method === 'POST') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              files: [{ id: 'f1', filename: 'manuscript.pdf', downloadUrl: '/download/f1', size: 512 }]
            })
          });
        }
        if (url.includes('/files')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              files: [{ originalName: 'manuscript.md', fileType: 'SOURCE', mimetype: 'text/markdown', downloadUrl: '/download/md' }]
            })
          });
        }
        if (url.includes('/download')) {
          return Promise.resolve({ ok: true, text: () => Promise.resolve('# Title\n\nBody') });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ title: 'Test', authors: ['A'], abstract: 'B' })
        });
      });

      const result = await renderCommand!.execute({
        customCss: 'body { font-size: 18px; }'
      }, mockContext);

      expect(result.messages[0].content).toContain('Markdown Rendered Successfully');
    });
  });

  describe('templates command', () => {
    const templatesCommand = markdownRendererBot.commands.find(cmd => cmd.name === 'templates');

    it('should exist and have correct metadata', () => {
      expect(templatesCommand).toBeDefined();
      expect(templatesCommand!.description).toBe('List available journal templates');
      expect(templatesCommand!.permissions).toEqual([]);
    });

    it('should execute successfully', async () => {
      const mockContext = {
        manuscriptId: 'test-manuscript-123',
        conversationId: 'test-conversation-456',
        triggeredBy: {
          messageId: 'test-message-789',
          userId: 'test-user-001',
          userRole: 'USER',
          trigger: 'MENTION' as const
        },
        journal: { id: 'test-journal', settings: {} },
        config: {}
      };

      const result = await templatesCommand!.execute({}, mockContext);
      
      expect(result.messages[0].content).toContain('Available Journal Templates');
      expect(result.messages[0].content).toContain('Academic Standard');
      expect(result.messages[0].content).toContain('Colloquium Journal Style');
      expect(result.messages[0].content).toContain('Minimal');
      expect(result.messages[0].content).toContain('Usage Examples');
    });

    it('should list configured templates when available', async () => {
      const mockContext = {
        manuscriptId: 'test-manuscript-123',
        conversationId: 'test-conversation-456',
        triggeredBy: {
          messageId: 'test-message-789',
          userId: 'test-user-001',
          userRole: 'USER',
          trigger: 'MENTION' as const
        },
        journal: { id: 'test-journal', settings: {} },
        config: {
          templates: {
            'custom-academic': {
              name: 'custom-academic',
              title: 'Custom Academic Template',
              description: 'A custom academic template',
              defaultEngine: 'typst',
              files: [
                { fileId: 'file-001', filename: 'custom-academic.typ', engine: 'typst' }
              ]
            }
          }
        }
      };

      const result = await templatesCommand!.execute({}, mockContext);

      expect(result.messages[0].content).toContain('Configured Templates');
      expect(result.messages[0].content).toContain('Custom Academic Template');
    });

    it('should handle custom templates from config', async () => {
      const mockContext = {
        manuscriptId: 'test-manuscript-123',
        conversationId: 'test-conversation-456',
        triggeredBy: {
          messageId: 'test-message-789',
          userId: 'test-user-001',
          userRole: 'USER',
          trigger: 'MENTION' as const
        },
        journal: { id: 'test-journal', settings: {} },
        config: {
          customTemplates: {
            'my-template': {
              title: 'My Custom Template',
              description: 'A custom template'
            }
          }
        }
      };

      const result = await templatesCommand!.execute({}, mockContext);
      
      expect(result.messages[0].content).toContain('Custom Templates (Legacy)');
      expect(result.messages[0].content).toContain('My Custom Template');
    });
  });

  describe('upload-template command', () => {
    const uploadTemplateCommand = markdownRendererBot.commands.find(cmd => cmd.name === 'upload-template');

    it('should exist and have correct metadata', () => {
      expect(uploadTemplateCommand).toBeDefined();
      expect(uploadTemplateCommand!.description).toBe('Instructions for uploading custom journal templates');
      expect(uploadTemplateCommand!.permissions).toEqual([]);
    });

    it('should execute successfully with instructions', async () => {
      const mockContext = {
        manuscriptId: 'test-manuscript-123',
        conversationId: 'test-conversation-456',
        triggeredBy: {
          messageId: 'test-message-789',
          userId: 'test-user-001',
          userRole: 'USER',
          trigger: 'MENTION' as const
        },
        journal: { id: 'test-journal', settings: {} },
        config: {}
      };

      const result = await uploadTemplateCommand!.execute({}, mockContext);
      
      expect(result.messages[0].content).toContain('Upload Custom Journal Templates');
      expect(result.messages[0].content).toContain('Step 1: Prepare Your Template Files');
      expect(result.messages[0].content).toContain('Step 2: Upload Files');
      expect(result.messages[0].content).toContain('Step 3: Use Your Template');
      expect(result.messages[0].content).toContain('Available Template Variables');
      expect(result.messages[0].content).toContain('{{title}}');
      expect(result.messages[0].content).toContain('{{content}}');
    });
  });

  describe('author data processing', () => {
    const renderCommand = markdownRendererBot.commands.find(cmd => cmd.name === 'render');

    beforeEach(() => {
      global.FormData = jest.fn().mockImplementation(() => ({
        append: jest.fn(),
      }));

      global.Blob = jest.fn().mockImplementation(() => ({
        size: 1024,
      }));
    });

    it('should process authorRelations with structured names (givenNames/surname)', async () => {
      const mockContext = {
        manuscriptId: 'test-manuscript-123',
        conversationId: 'test-conversation-456',
        serviceToken: 'test-bot-token',
        triggeredBy: {
          messageId: 'test-message-789',
          userId: 'test-user-001',
          userRole: 'USER',
          trigger: 'MENTION' as const
        },
        journal: { id: 'test-journal', settings: { name: 'Test Journal' } },
        config: {}
      };

      (global.fetch as jest.Mock).mockImplementation((url: string, options?: any) => {
        if (url.includes('localhost:8080/convert')) {
          return Promise.resolve({
            ok: true,
            arrayBuffer: () => Promise.resolve(Buffer.from('mock-pdf').buffer)
          });
        }
        if (options?.method === 'POST') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              files: [{ id: 'f1', filename: 'manuscript.pdf', downloadUrl: '/download/f1', size: 512 }]
            })
          });
        }
        if (url.includes('/files')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              files: [{ originalName: 'manuscript.md', fileType: 'SOURCE', mimetype: 'text/markdown', downloadUrl: '/download/md' }]
            })
          });
        }
        if (url.includes('/download')) {
          return Promise.resolve({ ok: true, text: () => Promise.resolve('# Title\n\nBody') });
        }
        // Manuscript metadata with authorRelations
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            title: 'Test Article',
            abstract: 'Test abstract',
            authorRelations: [
              {
                order: 1,
                isCorresponding: true,
                user: {
                  id: 'user-1',
                  name: 'John Adam Smith',
                  givenNames: 'John Adam',
                  surname: 'Smith',
                  email: 'john@example.com',
                  orcidId: '0000-0001-2345-6789',
                  affiliation: 'Test University'
                }
              },
              {
                order: 2,
                isCorresponding: false,
                user: {
                  id: 'user-2',
                  name: 'Jane Doe',
                  givenNames: null,
                  surname: null,
                  email: 'jane@example.com'
                }
              }
            ]
          })
        });
      });

      const result = await renderCommand!.execute({}, mockContext);

      // The render should complete successfully
      expect(result.messages[0].content).toContain('Markdown Rendered Successfully');
    });

    it('should process simple authors array and parse names', async () => {
      const mockContext = {
        manuscriptId: 'test-manuscript-123',
        conversationId: 'test-conversation-456',
        serviceToken: 'test-bot-token',
        triggeredBy: {
          messageId: 'test-message-789',
          userId: 'test-user-001',
          userRole: 'USER',
          trigger: 'MENTION' as const
        },
        journal: { id: 'test-journal', settings: { name: 'Test Journal' } },
        config: {}
      };

      (global.fetch as jest.Mock).mockImplementation((url: string, options?: any) => {
        if (url.includes('localhost:8080/convert')) {
          return Promise.resolve({
            ok: true,
            arrayBuffer: () => Promise.resolve(Buffer.from('mock-pdf').buffer)
          });
        }
        if (options?.method === 'POST') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              files: [{ id: 'f1', filename: 'manuscript.pdf', downloadUrl: '/download/f1', size: 512 }]
            })
          });
        }
        if (url.includes('/files')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              files: [{ originalName: 'manuscript.md', fileType: 'SOURCE', mimetype: 'text/markdown', downloadUrl: '/download/md' }]
            })
          });
        }
        if (url.includes('/download')) {
          return Promise.resolve({ ok: true, text: () => Promise.resolve('# Title\n\nBody') });
        }
        // Manuscript metadata with simple authors array
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            title: 'Test Article',
            abstract: 'Test abstract',
            authors: ['John Smith', 'Jane A. Doe', 'Smith, Robert']
          })
        });
      });

      const result = await renderCommand!.execute({}, mockContext);

      expect(result.messages[0].content).toContain('Markdown Rendered Successfully');
    });

    it('should include publication metadata in template variables', async () => {
      const mockContext = {
        manuscriptId: 'test-manuscript-123',
        conversationId: 'test-conversation-456',
        serviceToken: 'test-bot-token',
        triggeredBy: {
          messageId: 'test-message-789',
          userId: 'test-user-001',
          userRole: 'USER',
          trigger: 'MENTION' as const
        },
        journal: {
          id: 'test-journal',
          settings: {
            name: 'Test Journal',
            issn: '1234-5678',
            eissn: '8765-4321'
          }
        },
        config: {}
      };

      (global.fetch as jest.Mock).mockImplementation((url: string, options?: any) => {
        if (url.includes('localhost:8080/convert')) {
          return Promise.resolve({
            ok: true,
            arrayBuffer: () => Promise.resolve(Buffer.from('mock-pdf').buffer)
          });
        }
        if (options?.method === 'POST') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              files: [{ id: 'f1', filename: 'manuscript.pdf', downloadUrl: '/download/f1', size: 512 }]
            })
          });
        }
        if (url.includes('/files')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              files: [{ originalName: 'manuscript.md', fileType: 'SOURCE', mimetype: 'text/markdown', downloadUrl: '/download/md' }]
            })
          });
        }
        if (url.includes('/download')) {
          return Promise.resolve({ ok: true, text: () => Promise.resolve('# Title\n\nBody') });
        }
        // Manuscript metadata with publication fields
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            title: 'Test Article',
            abstract: 'Test abstract',
            authors: ['John Smith'],
            doi: '10.12345/2024.test',
            publishedAt: '2024-06-15T00:00:00.000Z',
            volume: '5',
            issue: '2',
            elocationId: 'e123'
          })
        });
      });

      const result = await renderCommand!.execute({}, mockContext);

      expect(result.messages[0].content).toContain('Markdown Rendered Successfully');
    });
  });
});