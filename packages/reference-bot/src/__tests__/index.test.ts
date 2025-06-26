import { referenceBot } from '../index';

describe('Reference Bot', () => {
  it('should have correct bot metadata', () => {
    expect(referenceBot.id).toBe('reference-bot');
    expect(referenceBot.name).toBe('Reference Bot');
    expect(referenceBot.description).toBe('Validates references and checks DOI availability and correctness');
    expect(referenceBot.version).toBe('1.0.0');
  });

  it('should have the expected commands', () => {
    expect(referenceBot.commands).toHaveLength(2);
    
    const commandNames = referenceBot.commands.map(cmd => cmd.name);
    expect(commandNames).toContain('check-doi');
    expect(commandNames).toContain('help');
  });

  it('should have the expected keywords', () => {
    expect(referenceBot.keywords).toEqual(['references', 'doi', 'citation', 'bibliography']);
  });

  it('should have the expected permissions', () => {
    expect(referenceBot.permissions).toEqual(['read_manuscript']);
  });

  describe('check-doi command', () => {
    const checkDoiCommand = referenceBot.commands.find(cmd => cmd.name === 'check-doi');

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

  describe('help command', () => {
    const helpCommand = referenceBot.commands.find(cmd => cmd.name === 'help');

    it('should exist and have correct metadata', () => {
      expect(helpCommand).toBeDefined();
      expect(helpCommand!.description).toBe('Show detailed help for the reference bot');
      expect(helpCommand!.permissions).toEqual([]);
    });

    it('should execute successfully', async () => {
      const mockContext = {
        manuscriptId: 'test-manuscript-123',
        conversationId: 'test-conversation-456',
        triggeredBy: {
          messageId: 'test-message-789',
          userId: 'test-user-001',
          trigger: 'MENTION' as const
        },
        journal: {
          id: 'test-journal',
          settings: {}
        },
        config: {}
      };

      const result = await helpCommand!.execute({}, mockContext);
      
      expect(result).toBeDefined();
      expect(result.messages).toBeDefined();
      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].content).toContain('Reference Bot Help');
      expect(result.messages[0].content).toContain('check-doi');
      expect(result.messages[0].content).toContain('Examples:');
    });
  });
});