import { editorialBot } from '../index';

describe('Editorial Bot - Decision Making Tests', () => {
  const mockContext = {
    manuscriptId: 'manuscript-123',
    conversationId: 'conversation-456',
    triggeredBy: {
      messageId: 'message-789',
      userId: 'editor-001',
      userRole: 'ADMIN',
      trigger: 'MENTION' as const
    },
    journal: {
      id: 'test-journal',
      settings: {}
    },
    config: {}
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('accept command - manuscript acceptance workflow', () => {
    const acceptCommand = editorialBot.commands.find(cmd => cmd.name === 'accept')!;

    it('should accept manuscript and initiate publication workflow', async () => {
      const result = await acceptCommand.execute(
        { reason: 'All reviews completed, ready for publication' },
        mockContext
      );

      expect(result).toBeDefined();
      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].content).toContain('Manuscript Accepted for Publication');
      expect(result.messages[0].content).toContain('ACCEPTED');
      expect(result.messages[0].content).toContain('All reviews completed, ready for publication');

      expect(result.actions).toHaveLength(2);
      expect(result.actions![0].type).toBe('UPDATE_MANUSCRIPT_STATUS');
      expect(result.actions![0].data.status).toBe('ACCEPTED');
      expect(result.actions![0].data.reason).toBe('All reviews completed, ready for publication');
      expect(result.actions![1].type).toBe('EXECUTE_PUBLICATION_WORKFLOW');
    });

    it('should include manuscript ID in acceptance message', async () => {
      const result = await acceptCommand.execute(
        { reason: 'Publication ready' },
        mockContext
      );

      expect(result.messages[0].content).toContain(mockContext.manuscriptId);
      expect(result.messages[0].content).toContain('Publication ready');
    });

    it('should handle acceptance without reason', async () => {
      const result = await acceptCommand.execute(
        {},
        mockContext
      );

      expect(result.messages[0].content).toContain('Manuscript Accepted for Publication');
      expect(result.messages[0].content).toContain('ACCEPTED');
      expect(result.actions![0].data.status).toBe('ACCEPTED');
      expect(result.actions![0].data.reason).toBeUndefined();
    });

    it('should generate publication workflow action with correct data', async () => {
      const result = await acceptCommand.execute(
        { reason: 'Excellent research' },
        mockContext
      );

      const pubAction = result.actions![1];
      expect(pubAction.type).toBe('EXECUTE_PUBLICATION_WORKFLOW');
      expect(pubAction.data.manuscriptId).toBe('manuscript-123');
      expect(pubAction.data.reason).toBe('Excellent research');
      expect(pubAction.data.triggeredBy).toBe('editorial-decision');
      expect(pubAction.data.acceptedDate).toBeDefined();
    });

    it('should include notification info in acceptance message', async () => {
      const result = await acceptCommand.execute(
        { reason: 'High quality research' },
        mockContext
      );

      expect(result.messages[0].content).toContain('Authors will be automatically notified');
      expect(result.messages[0].content).toContain('Publication workflow initiated');
    });
  });

  describe('reject command - manuscript rejection workflow', () => {
    const rejectCommand = editorialBot.commands.find(cmd => cmd.name === 'reject')!;

    it('should reject manuscript with reason', async () => {
      const result = await rejectCommand.execute(
        { reason: 'Insufficient methodology' },
        mockContext
      );

      expect(result.messages[0].content).toContain('Manuscript Rejected');
      expect(result.messages[0].content).toContain('REJECTED');
      expect(result.messages[0].content).toContain('Insufficient methodology');
      expect(result.actions![0].type).toBe('UPDATE_MANUSCRIPT_STATUS');
      expect(result.actions![0].data.status).toBe('REJECTED');
      expect(result.actions![0].data.reason).toBe('Insufficient methodology');
    });

    it('should reject manuscript without reason', async () => {
      const result = await rejectCommand.execute(
        {},
        mockContext
      );

      expect(result.messages[0].content).toContain('Manuscript Rejected');
      expect(result.messages[0].content).toContain('REJECTED');
      expect(result.actions![0].data.status).toBe('REJECTED');
      expect(result.actions![0].data.reason).toBeUndefined();
    });

    it('should include manuscript ID in rejection message', async () => {
      const result = await rejectCommand.execute(
        { reason: 'Does not meet journal scope' },
        mockContext
      );

      expect(result.messages[0].content).toContain(mockContext.manuscriptId);
    });

    it('should include author notification info', async () => {
      const result = await rejectCommand.execute(
        { reason: 'Quality issues' },
        mockContext
      );

      expect(result.messages[0].content).toContain('Authors will be automatically notified');
    });
  });

  describe('complete editorial workflow - accept with publication', () => {
    const acceptCommand = editorialBot.commands.find(cmd => cmd.name === 'accept')!;
    const rejectCommand = editorialBot.commands.find(cmd => cmd.name === 'reject')!;

    it('should demonstrate accept workflow generates both status and publication actions', async () => {
      const result = await acceptCommand.execute(
        { reason: 'High quality research' },
        mockContext
      );

      expect(result.messages[0].content).toContain('Manuscript Accepted for Publication');
      expect(result.actions).toHaveLength(2);
      expect(result.actions![0].type).toBe('UPDATE_MANUSCRIPT_STATUS');
      expect(result.actions![0].data.status).toBe('ACCEPTED');
      expect(result.actions![1].type).toBe('EXECUTE_PUBLICATION_WORKFLOW');
    });

    it('should demonstrate reject workflow generates only status action', async () => {
      const result = await rejectCommand.execute(
        { reason: 'Insufficient methodology' },
        mockContext
      );

      expect(result.messages[0].content).toContain('Manuscript Rejected');
      expect(result.actions).toHaveLength(1);
      expect(result.actions![0].type).toBe('UPDATE_MANUSCRIPT_STATUS');
      expect(result.actions![0].data.status).toBe('REJECTED');
    });
  });

  describe('message formatting and content', () => {
    const acceptCommand = editorialBot.commands.find(cmd => cmd.name === 'accept')!;
    const rejectCommand = editorialBot.commands.find(cmd => cmd.name === 'reject')!;

    it('should format acceptance message with emoji and proper text', async () => {
      const result = await acceptCommand.execute(
        { reason: 'Editorial board approval' },
        mockContext
      );

      const message = result.messages[0].content;

      expect(message).toContain('🎉');
      expect(message).toContain('Manuscript Accepted for Publication');
      expect(message).toContain('ACCEPTED');
      expect(message).toContain('Editorial board approval');
      expect(message).toContain(mockContext.manuscriptId);
    });

    it('should format rejection message with emoji and proper text', async () => {
      const result = await rejectCommand.execute(
        { reason: 'Lacks novelty' },
        mockContext
      );

      const message = result.messages[0].content;

      expect(message).toContain('❌');
      expect(message).toContain('Manuscript Rejected');
      expect(message).toContain('REJECTED');
      expect(message).toContain('Lacks novelty');
      expect(message).toContain(mockContext.manuscriptId);
    });

    it('should include decision date in messages', async () => {
      const acceptResult = await acceptCommand.execute(
        { reason: 'Good work' },
        mockContext
      );

      expect(acceptResult.messages[0].content).toContain('Decision Date:');

      const rejectResult = await rejectCommand.execute(
        { reason: 'Poor quality' },
        mockContext
      );

      expect(rejectResult.messages[0].content).toContain('Decision Date:');
    });
  });

  describe('permission checks', () => {
    it('should have make_editorial_decision permission on accept command', () => {
      const acceptCommand = editorialBot.commands.find(cmd => cmd.name === 'accept')!;
      expect(acceptCommand.permissions).toContain('make_editorial_decision');
    });

    it('should have make_editorial_decision permission on reject command', () => {
      const rejectCommand = editorialBot.commands.find(cmd => cmd.name === 'reject')!;
      expect(rejectCommand.permissions).toContain('make_editorial_decision');
    });
  });
});
