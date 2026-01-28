import { referenceCheckBot } from '../index';

describe('Reference Check Bot', () => {
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
    expect(referenceCheckBot.permissions).toEqual(['read_manuscript']);
  });

  describe('check-doi command', () => {
    const checkDoiCommand = referenceCheckBot.commands.find(cmd => cmd.name === 'check-doi');

    it('should exist and have correct metadata', () => {
      expect(checkDoiCommand).toBeDefined();
      expect(checkDoiCommand!.description).toBe('Check all references in the manuscript for DOI presence and validity');
      expect(checkDoiCommand!.permissions).toEqual(['read_manuscript']);
    });

    it('should have correct parameters', () => {
      expect(checkDoiCommand!.parameters).toHaveLength(2);
      
      const paramNames = checkDoiCommand!.parameters.map(p => p.name);
      expect(paramNames).toContain('detailed');
      expect(paramNames).toContain('timeout');
    });

    it('should execute successfully with default parameters', async () => {
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
      };

      const result = await checkDoiCommand!.execute({}, mockContext);
      
      expect(result).toBeDefined();
      expect(result.messages).toBeDefined();
      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].content).toContain('DOI Reference Check');
      expect(result.messages[0].content).toContain('test-manuscript-123');
    });

    it('should handle detailed parameter', async () => {
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
      };

      const result = await checkDoiCommand!.execute({ detailed: true }, mockContext);
      
      expect(result.messages[0].content).toContain('Detailed metadata: Yes');
    });

    it('should include JSON report attachment', async () => {
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