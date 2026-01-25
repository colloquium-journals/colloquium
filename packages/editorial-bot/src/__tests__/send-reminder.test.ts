import { editorialBot } from '../index';

describe('Editorial Bot - send-reminder command', () => {
  const sendReminderCommand = editorialBot.commands.find(cmd => cmd.name === 'send-reminder');

  it('should exist in the command list', () => {
    expect(sendReminderCommand).toBeDefined();
  });

  it('should have correct metadata', () => {
    expect(sendReminderCommand!.name).toBe('send-reminder');
    expect(sendReminderCommand!.description).toBe('Send a manual reminder to a reviewer about their pending review');
    expect(sendReminderCommand!.permissions).toEqual(['assign_reviewers']);
  });

  it('should have correct parameters', () => {
    expect(sendReminderCommand!.parameters).toHaveLength(2);

    const reviewerParam = sendReminderCommand!.parameters.find(p => p.name === 'reviewer');
    expect(reviewerParam).toBeDefined();
    expect(reviewerParam!.type).toBe('string');
    expect(reviewerParam!.required).toBe(true);

    const messageParam = sendReminderCommand!.parameters.find(p => p.name === 'message');
    expect(messageParam).toBeDefined();
    expect(messageParam!.type).toBe('string');
    expect(messageParam!.required).toBe(false);
  });

  it('should have examples', () => {
    expect(sendReminderCommand!.examples).toBeDefined();
    expect(sendReminderCommand!.examples.length).toBeGreaterThan(0);
    expect(sendReminderCommand!.examples).toContain('@bot-editorial send-reminder @DrSmith');
  });

  it('should have help documentation', () => {
    expect(sendReminderCommand!.help).toBeDefined();
    expect(sendReminderCommand!.help).toContain('send-reminder');
    expect(sendReminderCommand!.help).toContain('reviewer');
    expect(sendReminderCommand!.help).toContain('message');
  });

  describe('execute', () => {
    const mockContext = {
      manuscriptId: 'test-manuscript-123',
      conversationId: 'test-conversation-456',
      triggeredBy: {
        messageId: 'test-message-789',
        userId: 'test-user-001',
        userRole: 'ADMIN' as const,
        trigger: 'MENTION' as const
      },
      journal: { id: 'test-journal', settings: {} },
      config: {}
    };

    it('should execute with reviewer only', async () => {
      const result = await sendReminderCommand!.execute(
        { reviewer: '@DrSmith' },
        mockContext
      );

      expect(result).toBeDefined();
      expect(result.messages).toBeDefined();
      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].content).toContain('Manual Reminder');
      expect(result.messages[0].content).toContain('@DrSmith');
      expect(result.messages[0].content).toContain('test-manuscript-123');

      expect(result.actions).toBeDefined();
      expect(result.actions).toHaveLength(1);
      expect(result.actions![0].type).toBe('SEND_MANUAL_REMINDER');
      expect(result.actions![0].data.reviewer).toBe('@DrSmith');
      expect(result.actions![0].data.manuscriptId).toBe('test-manuscript-123');
    });

    it('should execute with reviewer and custom message', async () => {
      const result = await sendReminderCommand!.execute(
        { reviewer: '@DrSmith', message: 'Please prioritize this review' },
        mockContext
      );

      expect(result.messages[0].content).toContain('Manual Reminder');
      expect(result.messages[0].content).toContain('@DrSmith');
      expect(result.messages[0].content).toContain('Please prioritize this review');

      expect(result.actions![0].data.customMessage).toBe('Please prioritize this review');
    });

    it('should handle reviewer without @ prefix', async () => {
      const result = await sendReminderCommand!.execute(
        { reviewer: 'DrSmith' },
        mockContext
      );

      // The processMentions function should add @ prefix
      expect(result.actions![0].data.reviewer).toBe('@DrSmith');
    });

    it('should include triggeredBy in action data', async () => {
      const result = await sendReminderCommand!.execute(
        { reviewer: '@DrSmith' },
        mockContext
      );

      expect(result.actions![0].data.triggeredBy).toBe('test-user-001');
    });
  });
});

describe('Editorial Bot - send-reminder in help', () => {
  const helpCommand = editorialBot.commands.find(cmd => cmd.name === 'help');

  it('should include send-reminder in command list for help lookup', async () => {
    const mockContext = {
      manuscriptId: 'test-manuscript-123',
      conversationId: 'test-conversation-456',
      triggeredBy: {
        messageId: 'test-message-789',
        userId: 'test-user-001',
        userRole: 'ADMIN' as const,
        trigger: 'MENTION' as const
      },
      journal: { id: 'test-journal', settings: {} },
      config: {}
    };

    // Test help for send-reminder command
    const result = await helpCommand!.execute({ command: 'send-reminder' }, mockContext);

    expect(result.messages[0].content).toContain('send-reminder');
    expect(result.messages[0].content).not.toContain('Command Not Found');
  });
});
