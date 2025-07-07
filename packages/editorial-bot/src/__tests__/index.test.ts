import { editorialBot } from '../index';

describe('Editorial Bot', () => {
  it('should have correct bot metadata', () => {
    expect(editorialBot.id).toBe('editorial-bot');
    expect(editorialBot.name).toBe('Editorial Bot');
    expect(editorialBot.description).toBe('Assists with manuscript editorial workflows, status updates, reviewer assignments, and action editor management');
    expect(editorialBot.version).toBe('2.3.0');
  });

  it('should have the expected commands', () => {
    expect(editorialBot.commands).toHaveLength(10);
    
    const commandNames = editorialBot.commands.map(cmd => cmd.name);
    expect(commandNames).toContain('status');
    expect(commandNames).toContain('assign-editor');
    expect(commandNames).toContain('assign-reviewer');
    expect(commandNames).toContain('invite-reviewer');
    expect(commandNames).toContain('accept-review');
    expect(commandNames).toContain('summary');
    expect(commandNames).toContain('decision');
    expect(commandNames).toContain('respond');
    expect(commandNames).toContain('submit');
    expect(commandNames).toContain('help');
  });

  it('should have the expected keywords', () => {
    expect(editorialBot.keywords).toEqual(['editorial decision', 'review status', 'assign reviewer', 'assign editor', 'manuscript status', 'make decision']);
  });

  it('should have the expected permissions', () => {
    expect(editorialBot.permissions).toEqual(['read_manuscript', 'update_manuscript', 'assign_reviewers', 'make_editorial_decision']);
  });

  describe('status command', () => {
    const statusCommand = editorialBot.commands.find(cmd => cmd.name === 'status');

    it('should exist and have correct metadata', () => {
      expect(statusCommand).toBeDefined();
      expect(statusCommand!.description).toBe('Update the status of a manuscript');
      expect(statusCommand!.permissions).toEqual(['update_manuscript']);
    });

    it('should have correct parameters', () => {
      expect(statusCommand!.parameters).toHaveLength(2);
      
      const newStatusParam = statusCommand!.parameters.find(p => p.name === 'newStatus');
      expect(newStatusParam).toBeDefined();
      expect(newStatusParam!.type).toBe('enum');
      expect(newStatusParam!.required).toBe(true);
      expect(newStatusParam!.enumValues).toContain('ACCEPTED');
      expect(newStatusParam!.enumValues).toContain('REJECTED');
      
      const reasonParam = statusCommand!.parameters.find(p => p.name === 'reason');
      expect(reasonParam).toBeDefined();
      expect(reasonParam!.type).toBe('string');
      expect(reasonParam!.required).toBe(false);
    });

    it('should execute successfully with status change', async () => {
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

      const result = await statusCommand!.execute({ newStatus: 'ACCEPTED', reason: 'High quality research' }, mockContext);
      
      expect(result).toBeDefined();
      expect(result.messages).toBeDefined();
      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].content).toContain('Manuscript Status Updated');
      expect(result.messages[0].content).toContain('ACCEPTED');
      expect(result.messages[0].content).toContain('High quality research');
      expect(result.messages[0].content).toContain('test-manuscript-123');
      
      expect(result.actions).toBeDefined();
      expect(result.actions).toHaveLength(1);
      expect(result.actions![0].type).toBe('UPDATE_MANUSCRIPT_STATUS');
      expect(result.actions![0].data.status).toBe('ACCEPTED');
    });

    it('should handle different status types correctly', async () => {
      const mockContext = {
        manuscriptId: 'test-manuscript-123',
        conversationId: 'test-conversation-456',
        triggeredBy: {
          messageId: 'test-message-789',
          userId: 'test-user-001',
          trigger: 'MENTION' as const
        },
        journal: { id: 'test-journal', settings: {} },
        config: {}
      };

      const statusTests = ['UNDER_REVIEW', 'REVISION_REQUESTED', 'REJECTED', 'PUBLISHED'];
      
      for (const status of statusTests) {
        const result = await statusCommand!.execute({ newStatus: status }, mockContext);
        expect(result.messages[0].content).toContain(status.replace('_', ' '));
      }
    });
  });

  describe('assign-editor command', () => {
    const assignEditorCommand = editorialBot.commands.find(cmd => cmd.name === 'assign-editor');

    it('should exist and have correct metadata', () => {
      expect(assignEditorCommand).toBeDefined();
      expect(assignEditorCommand!.description).toBe('Assign an action editor to a manuscript');
      expect(assignEditorCommand!.permissions).toEqual(['assign_reviewers']);
    });

    it('should have correct parameters', () => {
      expect(assignEditorCommand!.parameters).toHaveLength(2);
      
      const editorParam = assignEditorCommand!.parameters.find(p => p.name === 'editor');
      expect(editorParam).toBeDefined();
      expect(editorParam!.type).toBe('string');
      expect(editorParam!.required).toBe(true);
      expect(editorParam!.description).toContain('@mention of the user to assign as action editor');
      
      const messageParam = assignEditorCommand!.parameters.find(p => p.name === 'message');
      expect(messageParam).toBeDefined();
      expect(messageParam!.type).toBe('string');
      expect(messageParam!.required).toBe(false);
    });

    it('should execute successfully with action editor assignment', async () => {
      const mockContext = {
        manuscriptId: 'test-manuscript-123',
        conversationId: 'test-conversation-456',
        userId: 'test-user-001',
        triggeredBy: {
          messageId: 'test-message-789',
          userId: 'test-user-001',
          trigger: 'MENTION' as const
        },
        journal: { id: 'test-journal', settings: {} },
        config: {}
      };

      const result = await assignEditorCommand!.execute({ 
        editor: '@DrEditor',
        message: 'Please handle this urgently'
      }, mockContext);
      
      expect(result).toBeDefined();
      expect(result.messages[0].content).toContain('Action Editor Assigned');
      expect(result.messages[0].content).toContain('@DrEditor');
      expect(result.messages[0].content).toContain('Please handle this urgently');
      expect(result.messages[0].content).toContain('test-manuscript-123');
      
      expect(result.actions).toBeDefined();
      expect(result.actions).toHaveLength(1);
      expect(result.actions![0].type).toBe('ASSIGN_ACTION_EDITOR');
      expect(result.actions![0].data.editor).toBe('@DrEditor');
      expect(result.actions![0].data.customMessage).toBe('Please handle this urgently');
    });

    it('should execute successfully without optional message', async () => {
      const mockContext = {
        manuscriptId: 'test-manuscript-123',
        conversationId: 'test-conversation-456',
        userId: 'test-user-001',
        triggeredBy: {
          messageId: 'test-message-789',
          userId: 'test-user-001',
          trigger: 'MENTION' as const
        },
        journal: { id: 'test-journal', settings: {} },
        config: {}
      };

      const result = await assignEditorCommand!.execute({ 
        editor: '@SeniorEditor'
      }, mockContext);
      
      expect(result).toBeDefined();
      expect(result.messages[0].content).toContain('Action Editor Assigned');
      expect(result.messages[0].content).toContain('@SeniorEditor');
      expect(result.messages[0].content).not.toContain('Message:');
      
      expect(result.actions![0].data.editor).toBe('@SeniorEditor');
      expect(result.actions![0].data.customMessage).toBeUndefined();
    });

    it('should handle @mention processing correctly', async () => {
      const mockContext = {
        manuscriptId: 'test-manuscript-123',
        conversationId: 'test-conversation-456',
        userId: 'test-user-001',
        triggeredBy: {
          messageId: 'test-message-789',
          userId: 'test-user-001',
          trigger: 'MENTION' as const
        },
        journal: { id: 'test-journal', settings: {} },
        config: {}
      };

      // Test with non-@mention input (should be automatically prefixed)
      const result = await assignEditorCommand!.execute({ 
        editor: 'ManagingEditor'
      }, mockContext);
      
      expect(result).toBeDefined();
      expect(result.messages[0].content).toContain('@ManagingEditor');
      expect(result.actions![0].data.editor).toBe('@ManagingEditor');
    });

    it('should include all expected information in response', async () => {
      const mockContext = {
        manuscriptId: 'test-manuscript-123',
        conversationId: 'test-conversation-456',
        userId: 'test-user-001',
        triggeredBy: {
          messageId: 'test-message-789',
          userId: 'test-user-001',
          trigger: 'MENTION' as const
        },
        journal: { id: 'test-journal', settings: {} },
        config: {}
      };

      const result = await assignEditorCommand!.execute({ 
        editor: '@DrEditor',
        message: 'Complex case requiring expertise'
      }, mockContext);
      
      const content = result.messages[0].content;
      
      expect(content).toContain('**Action Editor Assigned**');
      expect(content).toContain('**Manuscript ID:**');
      expect(content).toContain('**Action Editor:**');
      expect(content).toContain('**Message:**');
      expect(content).toContain('Assignment notification has been sent');
    });
  });

  describe('assign-reviewer command', () => {
    const assignReviewerCommand = editorialBot.commands.find(cmd => cmd.name === 'assign-reviewer');

    it('should exist and have correct metadata', () => {
      expect(assignReviewerCommand).toBeDefined();
      expect(assignReviewerCommand!.description).toBe('Assign accepted reviewers to start the review process');
      expect(assignReviewerCommand!.permissions).toEqual(['assign_reviewers']);
    });

    it('should have correct parameters', () => {
      expect(assignReviewerCommand!.parameters).toHaveLength(2);
      
      const reviewersParam = assignReviewerCommand!.parameters.find(p => p.name === 'reviewers');
      expect(reviewersParam).toBeDefined();
      expect(reviewersParam!.type).toBe('string');
      expect(reviewersParam!.required).toBe(true);
      expect(reviewersParam!.description).toContain('@mentions');
      
      const deadlineParam = assignReviewerCommand!.parameters.find(p => p.name === 'deadline');
      expect(deadlineParam).toBeDefined();
      expect(deadlineParam!.type).toBe('string');
      expect(deadlineParam!.required).toBe(false);
      expect(deadlineParam!.description).toContain('optional');
    });

    it('should execute successfully with reviewer assignment', async () => {
      const mockContext = {
        manuscriptId: 'test-manuscript-123',
        conversationId: 'test-conversation-456',
        userId: 'test-user-001', // Add userId for permission checking
        triggeredBy: {
          messageId: 'test-message-789',
          userId: 'test-user-001',
          trigger: 'MENTION' as const
        },
        journal: { id: 'test-journal', settings: {} },
        config: {}
      };

      const reviewers = ['@DrSmith', '@ProfJohnson'];
      const result = await assignReviewerCommand!.execute({ 
        reviewers: reviewers.join(','), 
        deadline: '2024-02-15'
      }, mockContext);
      
      expect(result).toBeDefined();
      expect(result.messages[0].content).toContain('Reviewers Assigned');
      expect(result.messages[0].content).toContain('@DrSmith, @ProfJohnson');
      expect(result.messages[0].content).toContain('2024-02-15');
      
      expect(result.actions![0].type).toBe('ASSIGN_REVIEWER');
      expect(result.actions![0].data.reviewers).toEqual(reviewers);
    });

    it('should execute successfully without deadline (no default)', async () => {
      const mockContext = {
        manuscriptId: 'test-manuscript-123',
        conversationId: 'test-conversation-456',
        userId: 'test-user-001', // Add userId for permission checking
        triggeredBy: {
          messageId: 'test-message-789',
          userId: 'test-user-001',
          trigger: 'MENTION' as const
        },
        journal: { id: 'test-journal', settings: {} },
        config: {}
      };

      const reviewers = ['@DrSmith', '@ProfJohnson'];
      const result = await assignReviewerCommand!.execute({ 
        reviewers: reviewers.join(',')
      }, mockContext);
      
      expect(result).toBeDefined();
      expect(result.messages[0].content).toContain('Reviewers Assigned');
      expect(result.messages[0].content).toContain('@DrSmith, @ProfJohnson');
      expect(result.messages[0].content).toContain('No deadline specified');
      
      expect(result.actions![0].type).toBe('ASSIGN_REVIEWER');
      expect(result.actions![0].data.reviewers).toEqual(reviewers);
      expect(result.actions![0].data.deadline).toBe(null);
    });

    it('should execute successfully with only reviewers (minimal parameters)', async () => {
      const mockContext = {
        manuscriptId: 'test-manuscript-123',
        conversationId: 'test-conversation-456',
        userId: 'test-user-001', // Add userId for permission checking
        triggeredBy: {
          messageId: 'test-message-789',
          userId: 'test-user-001',
          trigger: 'MENTION' as const
        },
        journal: { id: 'test-journal', settings: {} },
        config: {}
      };

      const reviewers = ['@StatisticsExpert'];
      const result = await assignReviewerCommand!.execute({ reviewers: reviewers.join(',') }, mockContext);
      
      expect(result).toBeDefined();
      expect(result.messages[0].content).toContain('Reviewers Assigned');
      expect(result.messages[0].content).toContain('@StatisticsExpert');
      expect(result.messages[0].content).toContain('No deadline specified');
      
      expect(result.actions![0].data.deadline).toBe(null);
    });

    it('should handle @mention processing correctly', async () => {
      const mockContext = {
        manuscriptId: 'test-manuscript-123',
        conversationId: 'test-conversation-456',
        userId: 'test-user-001', // Add userId for permission checking
        triggeredBy: {
          messageId: 'test-message-789',
          userId: 'test-user-001',
          trigger: 'MENTION' as const
        },
        journal: { id: 'test-journal', settings: {} },
        config: {}
      };

      // Test with mixed @mention and non-@mention inputs
      const reviewers = ['DrSmith', '@ProfJohnson', 'StatisticsExpert'];
      const result = await assignReviewerCommand!.execute({ reviewers: reviewers.join(',') }, mockContext);
      
      expect(result).toBeDefined();
      expect(result.messages[0].content).toContain('@DrSmith, @ProfJohnson, @StatisticsExpert');
      expect(result.actions![0].data.reviewers).toEqual(['@DrSmith', '@ProfJohnson', '@StatisticsExpert']);
    });
  });

  describe('decision command', () => {
    const decisionCommand = editorialBot.commands.find(cmd => cmd.name === 'decision');

    it('should exist and have correct metadata', () => {
      expect(decisionCommand).toBeDefined();
      expect(decisionCommand!.description).toBe('Make an editorial decision on a manuscript');
      expect(decisionCommand!.permissions).toEqual(['make_editorial_decision']);
    });

    it('should execute successfully with editorial decision', async () => {
      const mockContext = {
        manuscriptId: 'test-manuscript-123',
        conversationId: 'test-conversation-456',
        triggeredBy: {
          messageId: 'test-message-789',
          userId: 'test-user-001',
          trigger: 'MENTION' as const
        },
        journal: { id: 'test-journal', settings: {} },
        config: {}
      };

      const result = await decisionCommand!.execute({ decision: 'accept' }, mockContext);
      
      expect(result.messages[0].content).toContain('Editorial Decision: ACCEPT');
      expect(result.messages[0].content).toContain('ACCEPTED');
      expect(result.messages[0].content).toContain('Manuscript Accepted for Publication');
      
      expect(result.actions![0].type).toBe('MAKE_EDITORIAL_DECISION');
      expect(result.actions![0].data.decision).toBe('accept');
    });

    it('should handle all decision types correctly', async () => {
      const mockContext = {
        manuscriptId: 'test-manuscript-123',
        conversationId: 'test-conversation-456',
        triggeredBy: {
          messageId: 'test-message-789',
          userId: 'test-user-001',
          trigger: 'MENTION' as const
        },
        journal: { id: 'test-journal', settings: {} },
        config: {}
      };

      const decisions = ['accept', 'minor_revision', 'major_revision', 'reject'];
      
      for (const decision of decisions) {
        const result = await decisionCommand!.execute({ decision }, mockContext);
        expect(result.messages[0].content).toContain('Editorial Decision');
        expect(result.actions![0].data.decision).toBe(decision);
      }
    });
  });

  describe('summary command', () => {
    const summaryCommand = editorialBot.commands.find(cmd => cmd.name === 'summary');

    it('should exist and have correct metadata', () => {
      expect(summaryCommand).toBeDefined();
      expect(summaryCommand!.description).toBe('Generate a summary showing status, assigned editor, invited reviewers, and review progress');
      expect(summaryCommand!.permissions).toEqual(['read_manuscript']);
    });

    it('should execute successfully with brief format', async () => {
      const mockContext = {
        manuscriptId: 'test-manuscript-123',
        conversationId: 'test-conversation-456',
        triggeredBy: {
          messageId: 'test-message-789',
          userId: 'test-user-001',
          trigger: 'MENTION' as const
        },
        journal: { id: 'test-journal', settings: {} },
        config: {}
      };

      const result = await summaryCommand!.execute({ format: 'brief' }, mockContext);
      
      expect(result.messages[0].content).toContain('Manuscript Review Summary');
      expect(result.messages[0].content).toContain('Status:');
      expect(result.messages[0].content).toContain('Assigned Editor:');
      expect(result.messages[0].content).toContain('🔄 **Assigned Reviewers');
      expect(result.messages[0].content).toContain('Review Progress:');
      expect(result.messages[0].content).not.toContain('Average Score:');
    });

    it('should execute successfully with detailed format', async () => {
      const mockContext = {
        manuscriptId: 'test-manuscript-123',
        conversationId: 'test-conversation-456',
        triggeredBy: {
          messageId: 'test-message-789',
          userId: 'test-user-001',
          trigger: 'MENTION' as const
        },
        journal: { id: 'test-journal', settings: {} },
        config: {}
      };

      const result = await summaryCommand!.execute({ format: 'detailed' }, mockContext);
      
      expect(result.messages[0].content).toContain('Reviewer Status:');
      expect(result.messages[0].content).toContain('Next Steps:');
      expect(result.messages[0].content).toContain('Assigned Editor:');
      expect(result.messages[0].content).not.toContain('Average Score:');
    });

    it('should include all required information in summary', async () => {
      const mockContext = {
        manuscriptId: 'test-manuscript-123',
        conversationId: 'test-conversation-456',
        triggeredBy: {
          messageId: 'test-message-789',
          userId: 'test-user-001',
          trigger: 'MENTION' as const
        },
        journal: { id: 'test-journal', settings: {} },
        config: {}
      };

      const result = await summaryCommand!.execute({ format: 'brief' }, mockContext);
      const content = result.messages[0].content;
      
      // Check that it includes status, editor, and reviewers (real data structure)
      expect(content).toContain('**Status:**');
      expect(content).toContain('**Assigned Editor:**');
      expect(content).toContain('🔄 **Assigned Reviewers');
      expect(content).toContain('**Review Progress:**');
      
      // Ensure average score is removed
      expect(content).not.toContain('Average Score');
      expect(content).not.toContain('7.5');
    });
  });

});