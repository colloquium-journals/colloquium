import { editorialBot } from '../editorialBot';

describe('Editorial Bot', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Bot Configuration', () => {
    it('should have correct basic properties', () => {
      expect(editorialBot.id).toBe('editorial-bot');
      expect(editorialBot.name).toBe('Editorial Bot');
      expect(editorialBot.description).toContain('manuscript editorial workflows');
      expect(editorialBot.version).toBe('2.0.0');
    });

    it('should have all required commands', () => {
      const commandNames = editorialBot.commands.map(cmd => cmd.name);
      expect(commandNames).toEqual(['status', 'assign', 'summary', 'help']);
    });

    it('should have appropriate keywords', () => {
      expect(editorialBot.keywords).toContain('editorial decision');
      expect(editorialBot.keywords).toContain('review status');
    });

    it('should have correct triggers', () => {
      expect(editorialBot.triggers).toContain('MANUSCRIPT_SUBMITTED');
      expect(editorialBot.triggers).toContain('REVIEW_COMPLETE');
    });
  });

  describe('Status Command', () => {
    const statusCommand = editorialBot.commands.find(cmd => cmd.name === 'status')!;

    it('should have correct configuration', () => {
      expect(statusCommand.name).toBe('status');
      expect(statusCommand.description).toContain('Update the status of a manuscript');
      expect(statusCommand.parameters).toHaveLength(2);
      expect(statusCommand.permissions).toEqual(['update_manuscript']);
    });

    it('should accept valid status values', () => {
      const statusParam = statusCommand.parameters.find(p => p.name === 'newStatus')!;
      expect(statusParam.enumValues).toContain('SUBMITTED');
      expect(statusParam.enumValues).toContain('UNDER_REVIEW');
      expect(statusParam.enumValues).toContain('ACCEPTED');
      expect(statusParam.enumValues).toContain('REJECTED');
    });

    it('should execute with valid parameters', async () => {
      const context = testUtils.createMockBotContext();
      const result = await statusCommand.execute(
        { newStatus: 'UNDER_REVIEW', reason: 'Ready for review' },
        context
      );

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].content).toContain('Manuscript Status Updated');
      expect(result.messages[0].content).toContain('UNDER REVIEW');
      expect(result.messages[0].content).toContain('Ready for review');
      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].type).toBe('UPDATE_MANUSCRIPT_STATUS');
    });

    it('should handle different status types correctly', async () => {
      const context = testUtils.createMockBotContext();
      
      const acceptedResult = await statusCommand.execute(
        { newStatus: 'ACCEPTED' },
        context
      );
      expect(acceptedResult.messages[0].content).toContain('🎉 Manuscript accepted!');

      const rejectedResult = await statusCommand.execute(
        { newStatus: 'REJECTED' },
        context
      );
      expect(rejectedResult.messages[0].content).toContain('❌ Manuscript rejected.');
    });
  });

  describe('Assign Command', () => {
    const assignCommand = editorialBot.commands.find(cmd => cmd.name === 'assign')!;

    it('should have correct configuration', () => {
      expect(assignCommand.name).toBe('assign');
      expect(assignCommand.description).toContain('Assign reviewers to a manuscript');
      expect(assignCommand.permissions).toEqual(['assign_reviewers']);
    });

    it('should execute with reviewer emails', async () => {
      const context = testUtils.createMockBotContext();
      const result = await assignCommand.execute(
        { 
          reviewers: ['reviewer1@university.edu', 'reviewer2@institution.org'],
          deadline: '2024-02-15'
        },
        context
      );

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].content).toContain('Reviewers Assigned');
      expect(result.messages[0].content).toContain('reviewer1@university.edu');
      expect(result.messages[0].content).toContain('2024-02-15');
      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].type).toBe('ASSIGN_REVIEWER');
    });
  });

  describe('Summary Command', () => {
    const summaryCommand = editorialBot.commands.find(cmd => cmd.name === 'summary')!;

    it('should execute with brief format', async () => {
      const context = testUtils.createMockBotContext();
      const result = await summaryCommand.execute(
        { format: 'brief' },
        context
      );

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].content).toContain('Manuscript Review Summary');
      expect(result.messages[0].content).toContain('Status:');
      expect(result.messages[0].content).toContain('Progress:');
    });

    it('should execute with detailed format', async () => {
      const context = testUtils.createMockBotContext();
      const result = await summaryCommand.execute(
        { format: 'detailed' },
        context
      );

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].content).toContain('Assigned Reviewers:');
      expect(result.messages[0].content).toContain('Next Steps:');
    });
  });

  describe('Help Command', () => {
    const helpCommand = editorialBot.commands.find(cmd => cmd.name === 'help')!;

    it('should provide general help', async () => {
      const context = testUtils.createMockBotContext();
      const result = await helpCommand.execute({}, context);

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].content).toContain('Editorial Bot Help');
      expect(result.messages[0].content).toContain('status');
      expect(result.messages[0].content).toContain('assign');
      expect(result.messages[0].content).toContain('summary');
    });

    it('should provide specific command help', async () => {
      const context = testUtils.createMockBotContext();
      const result = await helpCommand.execute({ command: 'status' }, context);

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].content).toContain('Help: status');
      expect(result.messages[0].content).toContain('Update the status of a manuscript');
      expect(result.messages[0].content).toContain('Parameters:');
    });

    it('should handle unknown command help requests', async () => {
      const context = testUtils.createMockBotContext();
      const result = await helpCommand.execute({ command: 'unknown' }, context);

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].content).toContain("Command 'unknown' not found");
    });
  });
});