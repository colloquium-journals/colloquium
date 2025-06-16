import { referenceBot } from '../referenceBot';
import { BotContext } from '@colloquium/types';

describe('Reference Bot', () => {
  const mockContext: BotContext = {
    conversationId: 'test-conversation',
    manuscriptId: 'test-manuscript',
    triggeredBy: {
      messageId: 'test-message',
      userId: 'test-user',
      trigger: 'mention' as any
    },
    journal: {
      id: 'test-journal',
      settings: {}
    },
    config: {}
  };

  test('should have correct bot metadata', () => {
    expect(referenceBot.id).toBe('reference-bot');
    expect(referenceBot.name).toBe('Reference Bot');
    expect(referenceBot.version).toBe('1.0.0');
    expect(referenceBot.commands).toHaveLength(2);
  });

  test('should have check-doi command', () => {
    const checkDoiCommand = referenceBot.commands.find(cmd => cmd.name === 'check-doi');
    expect(checkDoiCommand).toBeDefined();
    expect(checkDoiCommand?.description).toContain('references');
    expect(checkDoiCommand?.permissions).toContain('read_manuscript');
  });

  test('should have help command', () => {
    const helpCommand = referenceBot.commands.find(cmd => cmd.name === 'help');
    expect(helpCommand).toBeDefined();
    expect(helpCommand?.description).toContain('help');
  });

  test('help command should execute successfully', async () => {
    const helpCommand = referenceBot.commands.find(cmd => cmd.name === 'help');
    expect(helpCommand).toBeDefined();
    
    if (helpCommand) {
      const result = await helpCommand.execute({}, mockContext);
      expect(result.messages).toBeDefined();
      expect(result.messages).toHaveLength(1);
      expect(result.messages![0].content).toContain('Reference Bot Help');
    }
  });

  test('check-doi command should execute with default parameters', async () => {
    const checkDoiCommand = referenceBot.commands.find(cmd => cmd.name === 'check-doi');
    expect(checkDoiCommand).toBeDefined();
    
    if (checkDoiCommand) {
      const result = await checkDoiCommand.execute({
        detailed: false,
        timeout: 30
      }, mockContext);
      
      expect(result.messages).toBeDefined();
      expect(result.messages).toHaveLength(1);
      expect(result.messages![0].content).toContain('DOI Reference Check');
      expect(result.messages![0].attachments).toBeDefined();
      expect(result.messages![0].attachments).toHaveLength(1);
      expect(result.messages![0].attachments![0].filename).toContain('doi-check-report');
    }
  });

  test('check-doi command should handle detailed parameter', async () => {
    const checkDoiCommand = referenceBot.commands.find(cmd => cmd.name === 'check-doi');
    expect(checkDoiCommand).toBeDefined();
    
    if (checkDoiCommand) {
      const result = await checkDoiCommand.execute({
        detailed: true,
        timeout: 30
      }, mockContext);
      
      expect(result.messages).toBeDefined();
      expect(result.messages![0].content).toContain('Detailed metadata: Yes');
    }
  });

  test('bot should have correct triggers and permissions', () => {
    expect(referenceBot.triggers).toContain('MANUSCRIPT_SUBMITTED');
    expect(referenceBot.permissions).toContain('read_manuscript');
    expect(referenceBot.keywords).toContain('references');
    expect(referenceBot.keywords).toContain('doi');
  });
});