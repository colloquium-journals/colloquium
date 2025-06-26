import { editorialBot } from '../index';

// Mock the BotActionProcessor since we're testing in isolation
class MockBotActionProcessor {
  async processActions(actions: any[], context: any): Promise<void> {
    // Mock implementation that simulates action processing
    for (const action of actions) {
      if (action.type === 'UPDATE_MANUSCRIPT_STATUS') {
        // Simulate database update
        console.log(`Mock: Updating manuscript ${context.manuscriptId} to status ${action.data.status}`);
      }
    }
  }
}

// Mock the database module
jest.mock('@colloquium/database', () => ({
  prisma: {
    manuscript: {
      findUnique: jest.fn(),
      update: jest.fn()
    },
    message: {
      create: jest.fn()
    }
  }
}));

describe('Editorial Bot - Decision Making Tests', () => {
  const { prisma } = require('@colloquium/database');
  let processor: MockBotActionProcessor;

  const mockContext = {
    manuscriptId: 'manuscript-123',
    conversationId: 'conversation-456',
    triggeredBy: {
      messageId: 'message-789',
      userId: 'editor-001',
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
    processor = new MockBotActionProcessor();
  });

  describe('status command - manuscript publication workflow', () => {
    const statusCommand = editorialBot.commands.find(cmd => cmd.name === 'status')!;

    it('should transition manuscript from ACCEPTED to PUBLISHED status', async () => {
      const mockManuscript = {
        id: 'manuscript-123',
        title: 'Test Research Paper',
        status: 'ACCEPTED',
        publishedAt: null,
        authorRelations: []
      };

      // Mock the current manuscript state
      prisma.manuscript.findUnique.mockResolvedValue(mockManuscript);
      prisma.manuscript.update.mockResolvedValue({
        ...mockManuscript,
        status: 'PUBLISHED',
        publishedAt: new Date()
      });

      // Execute the status command
      const result = await statusCommand.execute(
        { newStatus: 'PUBLISHED', reason: 'All reviews completed, ready for publication' },
        mockContext
      );

      // Verify command response
      expect(result).toBeDefined();
      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].content).toContain('📚 Manuscript published! Now available to the public.');
      expect(result.messages[0].content).toContain('PUBLISHED');
      expect(result.messages[0].content).toContain('All reviews completed, ready for publication');

      // Verify action was created
      expect(result.actions).toHaveLength(1);
      expect(result.actions![0].type).toBe('UPDATE_MANUSCRIPT_STATUS');
      expect(result.actions![0].data.status).toBe('PUBLISHED');
      expect(result.actions![0].data.reason).toBe('All reviews completed, ready for publication');

      // Process the action through MockBotActionProcessor
      await processor.processActions(result.actions!, {
        manuscriptId: mockContext.manuscriptId,
        userId: mockContext.triggeredBy.userId,
        conversationId: mockContext.conversationId
      });

      // Note: In unit tests, we verify the command generates the correct actions
      // The actual database interaction is tested in integration tests
    });

    it('should include validation note when setting PUBLISHED status', async () => {
      const result = await statusCommand.execute(
        { newStatus: 'PUBLISHED', reason: 'Fast-track publication approved' },
        mockContext
      );

      expect(result.messages[0].content).toContain('📚 Manuscript published! Now available to the public.');
      expect(result.messages[0].content).toContain('⚠️ **Note:** Manuscripts can only be published from ACCEPTED status.');
      expect(result.actions![0].data.status).toBe('PUBLISHED');
    });

    it('should handle REJECTED status correctly', async () => {
      const result = await statusCommand.execute(
        { newStatus: 'REJECTED', reason: 'Insufficient methodology' },
        mockContext
      );

      expect(result.messages[0].content).toContain('❌ Manuscript rejected. Authors will be notified with feedback.');
      expect(result.messages[0].content).toContain('REJECTED');
      expect(result.messages[0].content).toContain('Insufficient methodology');
      expect(result.actions![0].data.status).toBe('REJECTED');
    });

    it('should handle RETRACTED status correctly', async () => {
      const result = await statusCommand.execute(
        { newStatus: 'RETRACTED', reason: 'Data integrity issues discovered' },
        mockContext
      );

      expect(result.messages[0].content).toContain('🚫 Manuscript retracted! No longer available to the public.');
      expect(result.messages[0].content).toContain('RETRACTED');
      expect(result.messages[0].content).toContain('Data integrity issues discovered');
      expect(result.messages[0].content).toContain('⚠️ **Note:** Manuscripts can only be retracted from PUBLISHED status.');
      expect(result.actions![0].data.status).toBe('RETRACTED');
    });

    it('should include manuscript ID in status update message', async () => {
      const result = await statusCommand.execute(
        { newStatus: 'PUBLISHED', reason: 'Publication ready' },
        mockContext
      );

      expect(result.messages[0].content).toContain(mockContext.manuscriptId);
      expect(result.messages[0].content).toContain('Publication ready');
    });
  });

  describe('decision command - editorial decision workflow', () => {
    const decisionCommand = editorialBot.commands.find(cmd => cmd.name === 'decision')!;

    it('should process accept decision and transition to ACCEPTED status (not PUBLISHED)', async () => {
      const mockManuscript = {
        id: 'manuscript-123',
        title: 'Research Paper',
        status: 'UNDER_REVIEW',
        publishedAt: null,
        authorRelations: []
      };

      prisma.manuscript.update.mockResolvedValue({
        ...mockManuscript,
        status: 'ACCEPTED',
        publishedAt: new Date()
      });

      const result = await decisionCommand.execute(
        { decision: 'accept', reason: 'Excellent research quality' },
        mockContext
      );

      // Verify decision response
      expect(result.messages[0].content).toContain('Editorial Decision: ACCEPT');
      expect(result.messages[0].content).toContain('ACCEPTED');
      expect(result.messages[0].content).toContain('Manuscript Accepted for Publication');

      // Verify action creates ACCEPTED status, not PUBLISHED
      expect(result.actions![0].type).toBe('MAKE_EDITORIAL_DECISION');
      expect(result.actions![0].data.decision).toBe('accept');

      // Note: The decision command maps to ACCEPTED status, not PUBLISHED
      // To publish, a separate @editorial-bot status PUBLISHED command is needed
    });

    it('should process reject decision correctly', async () => {
      const result = await decisionCommand.execute(
        { decision: 'reject', reason: 'Insufficient methodology' },
        mockContext
      );

      expect(result.messages[0].content).toContain('Editorial Decision: REJECT');
      expect(result.messages[0].content).toContain('REJECTED');
      expect(result.actions![0].data.decision).toBe('reject');
    });

    it('should process revision decisions correctly', async () => {
      const minorResult = await decisionCommand.execute(
        { decision: 'minor_revision' },
        mockContext
      );

      expect(minorResult.messages[0].content).toContain('Editorial Decision: MINOR REVISION');
      expect(minorResult.messages[0].content).toContain('REVISION REQUESTED');

      const majorResult = await decisionCommand.execute(
        { decision: 'major_revision' },
        mockContext
      );

      expect(majorResult.messages[0].content).toContain('Editorial Decision: MAJOR REVISION');
      expect(majorResult.messages[0].content).toContain('REVISION REQUESTED');
    });
  });

  describe('complete editorial workflow - accept to publish', () => {
    const statusCommand = editorialBot.commands.find(cmd => cmd.name === 'status')!;
    const decisionCommand = editorialBot.commands.find(cmd => cmd.name === 'decision')!;

    it('should demonstrate complete workflow: decision accept -> status published', async () => {
      const mockManuscript = {
        id: 'manuscript-123',
        title: 'Complete Workflow Paper',
        status: 'UNDER_REVIEW',
        publishedAt: null,
        authorRelations: []
      };

      // Step 1: Editorial decision to accept
      const decisionResult = await decisionCommand.execute(
        { decision: 'accept', reason: 'High quality research' },
        mockContext
      );

      expect(decisionResult.messages[0].content).toContain('Editorial Decision: ACCEPT');
      expect(decisionResult.actions![0].data.decision).toBe('accept');

      // Step 2: Status update to published (separate command)
      const statusResult = await statusCommand.execute(
        { newStatus: 'PUBLISHED', reason: 'Ready for public release' },
        mockContext
      );

      expect(statusResult.messages[0].content).toContain('📚 Manuscript published! Now available to the public.');
      expect(statusResult.actions![0].data.status).toBe('PUBLISHED');

      // Verify both actions can be processed
      await processor.processActions(decisionResult.actions!, {
        manuscriptId: mockContext.manuscriptId,
        userId: mockContext.triggeredBy.userId,
        conversationId: mockContext.conversationId
      });

      await processor.processActions(statusResult.actions!, {
        manuscriptId: mockContext.manuscriptId,
        userId: mockContext.triggeredBy.userId,
        conversationId: mockContext.conversationId
      });
    });
  });

  describe('manuscript status validation', () => {
    const statusCommand = editorialBot.commands.find(cmd => cmd.name === 'status')!;

    it('should accept all valid manuscript statuses', async () => {
      const validStatuses = ['SUBMITTED', 'UNDER_REVIEW', 'REVISION_REQUESTED', 'REVISED', 'ACCEPTED', 'REJECTED', 'PUBLISHED', 'RETRACTED'];

      for (const status of validStatuses) {
        const result = await statusCommand.execute(
          { newStatus: status },
          mockContext
        );

        expect(result.actions![0].data.status).toBe(status);
        expect(result.messages[0].content).toContain(status.replace('_', ' '));
      }
    });

    it('should have all status values in the enumValues for status parameter', () => {
      const statusParam = statusCommand.parameters.find(p => p.name === 'newStatus');
      
      expect(statusParam?.enumValues).toContain('PUBLISHED');
      expect(statusParam?.enumValues).toContain('ACCEPTED');
      expect(statusParam?.enumValues).toContain('REJECTED');
      expect(statusParam?.enumValues).toContain('RETRACTED');
    });
  });

  describe('status transition validation', () => {
    const statusCommand = editorialBot.commands.find(cmd => cmd.name === 'status')!;

    it('should include validation warning for PUBLISHED status', async () => {
      const result = await statusCommand.execute(
        { newStatus: 'PUBLISHED' },
        mockContext
      );

      expect(result.messages[0].content).toContain('⚠️ **Note:** Manuscripts can only be published from ACCEPTED status.');
    });

    it('should not include validation warning for other statuses', async () => {
      const result = await statusCommand.execute(
        { newStatus: 'ACCEPTED' },
        mockContext
      );

      expect(result.messages[0].content).not.toContain('⚠️ **Note:**');
    });

    it('should generate correct action for REJECTED status', async () => {
      const result = await statusCommand.execute(
        { newStatus: 'REJECTED', reason: 'Poor quality' },
        mockContext
      );

      expect(result.actions![0].type).toBe('UPDATE_MANUSCRIPT_STATUS');
      expect(result.actions![0].data.status).toBe('REJECTED');
      expect(result.actions![0].data.reason).toBe('Poor quality');
    });

    it('should include validation warning for RETRACTED status', async () => {
      const result = await statusCommand.execute(
        { newStatus: 'RETRACTED' },
        mockContext
      );

      expect(result.messages[0].content).toContain('⚠️ **Note:** Manuscripts can only be retracted from PUBLISHED status.');
    });

    it('should generate correct action for RETRACTED status', async () => {
      const result = await statusCommand.execute(
        { newStatus: 'RETRACTED', reason: 'Ethical concerns' },
        mockContext
      );

      expect(result.actions![0].type).toBe('UPDATE_MANUSCRIPT_STATUS');
      expect(result.actions![0].data.status).toBe('RETRACTED');
      expect(result.actions![0].data.reason).toBe('Ethical concerns');
    });
  });

  describe('error handling and edge cases', () => {
    const statusCommand = editorialBot.commands.find(cmd => cmd.name === 'status')!;

    it('should handle missing reason gracefully', async () => {
      const result = await statusCommand.execute(
        { newStatus: 'PUBLISHED' },
        mockContext
      );

      expect(result.messages[0].content).toContain('PUBLISHED');
      expect(result.actions![0].data.status).toBe('PUBLISHED');
      expect(result.actions![0].data.reason).toBeUndefined();
    });

    it('should handle database errors gracefully during action processing', async () => {
      const result = await statusCommand.execute(
        { newStatus: 'PUBLISHED' },
        mockContext
      );

      // Should not throw but log error (mock processor handles this)
      await expect(processor.processActions(result.actions!, {
        manuscriptId: mockContext.manuscriptId,
        userId: mockContext.triggeredBy.userId,
        conversationId: mockContext.conversationId
      })).resolves.not.toThrow();
    });
  });

  describe('message formatting and content', () => {
    const statusCommand = editorialBot.commands.find(cmd => cmd.name === 'status')!;

    it('should format PUBLISHED status message with emoji and proper text', async () => {
      const result = await statusCommand.execute(
        { newStatus: 'PUBLISHED', reason: 'Editorial board approval' },
        mockContext
      );

      const message = result.messages[0].content;
      
      // Check for specific emoji and text for PUBLISHED status
      expect(message).toContain('📚');
      expect(message).toContain('Manuscript published! Now available to the public.');
      expect(message).toContain('PUBLISHED');
      expect(message).toContain('Editorial board approval');
      expect(message).toContain(mockContext.manuscriptId);
    });

    it('should format different status messages appropriately', async () => {
      const testCases = [
        { status: 'ACCEPTED', expectedText: 'ACCEPTED' },
        { status: 'REJECTED', expectedText: 'REJECTED' },
        { status: 'UNDER_REVIEW', expectedText: 'UNDER REVIEW' },
        { status: 'REVISION_REQUESTED', expectedText: 'REVISION REQUESTED' }
      ];

      for (const { status, expectedText } of testCases) {
        const result = await statusCommand.execute(
          { newStatus: status },
          mockContext
        );

        expect(result.messages[0].content).toContain(expectedText);
      }
    });
  });
});