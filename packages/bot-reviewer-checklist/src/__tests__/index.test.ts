import { reviewerChecklistBot } from '../index';

// Mock fetch for SDK API calls
const mockReviewerAssignments = {
  assignments: [
    {
      id: 'assignment-1',
      manuscriptId: 'test-manuscript-123',
      reviewerId: 'test-user-001',
      status: 'ACCEPTED',
      assignedAt: '2024-01-01T00:00:00Z',
      dueDate: '2024-02-01T00:00:00Z',
      users: { id: 'test-user-001', name: 'Current User', email: 'user@test.com' }
    },
    {
      id: 'assignment-2',
      manuscriptId: 'test-manuscript-123',
      reviewerId: 'reviewer-002',
      status: 'ACCEPTED',
      assignedAt: '2024-01-01T00:00:00Z',
      dueDate: '2024-02-01T00:00:00Z',
      users: { id: 'reviewer-002', name: 'Dr. Smith', email: 'smith@test.com' }
    }
  ]
};

beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(mockReviewerAssignments),
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('Reviewer Checklist Bot', () => {
  it('should have correct bot metadata', () => {
    expect(reviewerChecklistBot.id).toBe('bot-reviewer-checklist');
    expect(reviewerChecklistBot.name).toBe('Reviewer Checklist');
    expect(reviewerChecklistBot.description).toBe('Generates customizable review checklists for assigned reviewers using configurable templates');
    expect(reviewerChecklistBot.version).toBe('1.0.0');
  });

  it('should have the expected commands', () => {
    expect(reviewerChecklistBot.commands).toHaveLength(2);
    
    const commandNames = reviewerChecklistBot.commands.map(cmd => cmd.name);
    expect(commandNames).toContain('generate');
    expect(commandNames).toContain('help');
  });

  it('should have the expected keywords', () => {
    expect(reviewerChecklistBot.keywords).toEqual(['checklist', 'review', 'criteria', 'evaluation']);
  });

  it('should have the expected permissions', () => {
    expect(reviewerChecklistBot.permissions).toEqual(['read_manuscript', 'send_messages']);
  });

  describe('generate command', () => {
    const generateCommand = reviewerChecklistBot.commands.find(cmd => cmd.name === 'generate');

    it('should exist and have correct metadata', () => {
      expect(generateCommand).toBeDefined();
      expect(generateCommand!.description).toBe('Generate a checklist for reviewers. By default, generates checklists for all assigned reviewers without one. Can target a specific reviewer by @mention or ID.');
      expect(generateCommand!.permissions).toEqual(['read_manuscript', 'send_messages']);
    });

    it('should have correct parameters', () => {
      expect(generateCommand!.parameters).toHaveLength(1);
      
      const reviewerParam = generateCommand!.parameters.find(p => p.name === 'reviewer');
      expect(reviewerParam).toBeDefined();
      expect(reviewerParam!.type).toBe('string');
      expect(reviewerParam!.required).toBe(false);
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

      const result = await generateCommand!.execute({}, mockContext);
      
      expect(result).toBeDefined();
      expect(result.messages).toBeDefined();
      expect(result.messages).toHaveLength(3); // Summary message + 2 checklists (Current User and Dr. Smith)
      expect(result.messages[0].content).toContain('Checklists Generated');
      expect(result.messages[1].content).toContain('# Reviewer Checklist');
      expect(result.messages[1].content).toContain('- [ ]'); // Contains checkbox items
      expect(result.messages[1].content).toContain('methodology'); // Contains default criteria
    });

    it('should handle reviewer @mention parameter', async () => {
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

      // Test @mention functionality - "Dr. Smith" is one of our mock reviewers
      const result = await generateCommand!.execute({ reviewer: '@Dr. Smith' }, mockContext);
      
      expect(result.messages[0].content).toContain('Generated checklist for');
    });

    it('should include template-based content', async () => {
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

      const result = await generateCommand!.execute({}, mockContext);
      
      // Should contain template-based content
      expect(result.messages[1].content).toContain('methodology');
      expect(result.messages[1].content).toContain('Data analysis methods');
      expect(result.messages[1].content).toContain('This checklist is editable');
    });

    it('should organize content by sections', async () => {
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

      const result = await generateCommand!.execute({}, mockContext);
      
      // Should contain section headers from template
      expect(result.messages[1].content).toContain('## Scientific Rigor');
      expect(result.messages[1].content).toContain('## Technical Quality');
      expect(result.messages[1].content).toContain('## Ethics and Standards');
    });

    it('should handle reviewer not found gracefully', async () => {
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

      const result = await generateCommand!.execute({ reviewer: '@NonExistentReviewer' }, mockContext);
      
      expect(result.messages[0].content).toContain('Reviewer Not Found');
      expect(result.messages[0].content).toContain('Available reviewers:');
    });

    it('should handle partial name matching', async () => {
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

      // Test partial name matching with "Smith" (should match "Dr. Smith")
      const result = await generateCommand!.execute({ reviewer: 'Smith' }, mockContext);
      
      expect(result.messages[0].content).toContain('Generated checklist for');
    });
  });

  describe('help command', () => {
    const helpCommand = reviewerChecklistBot.commands.find(cmd => cmd.name === 'help');

    it('should exist and have correct metadata', () => {
      expect(helpCommand).toBeDefined();
      expect(helpCommand!.description).toBe('Show available commands and usage');
      expect(helpCommand!.permissions).toEqual([]);
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
      expect(result.messages[0].content).toContain('Reviewer Checklist Bot');
      expect(result.messages[0].content).toContain('generate');
      expect(result.messages[0].content).toContain('Generates checklists for all assigned reviewers without one');
      expect(result.messages[0].content).toContain('Examples:');
    });
  });
});