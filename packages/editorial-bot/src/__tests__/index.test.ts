import { editorialBot } from '../index';

describe('Editorial Bot', () => {
  it('should have correct bot metadata', () => {
    expect(editorialBot.id).toBe('editorial-bot');
    expect(editorialBot.name).toBe('Editorial Bot');
    expect(editorialBot.description).toBe('Assists with manuscript editorial workflows, status updates, reviewer assignments, and action editor management');
    expect(editorialBot.version).toBe('2.3.0');
  });

  it('should have the expected commands', () => {
    expect(editorialBot.commands).toHaveLength(5);

    const commandNames = editorialBot.commands.map(cmd => cmd.name);
    expect(commandNames).toContain('accept');
    expect(commandNames).toContain('reject');
    expect(commandNames).toContain('assign-editor');
    expect(commandNames).toContain('invite-reviewer');
    expect(commandNames).toContain('help');
  });

  it('should have the expected keywords', () => {
    expect(editorialBot.keywords).toEqual(['editorial decision', 'review status', 'invite reviewer', 'assign editor', 'manuscript status', 'make decision']);
  });

  it('should have the expected permissions', () => {
    expect(editorialBot.permissions).toEqual(['read_manuscript', 'update_manuscript', 'assign_reviewers', 'make_editorial_decision']);
  });

  describe('accept command', () => {
    const acceptCommand = editorialBot.commands.find(cmd => cmd.name === 'accept');

    it('should exist and have correct metadata', () => {
      expect(acceptCommand).toBeDefined();
      expect(acceptCommand!.description).toBe('Accept a manuscript for publication and initiate publication workflow');
      expect(acceptCommand!.permissions).toEqual(['make_editorial_decision']);
    });

    it('should have correct parameters', () => {
      expect(acceptCommand!.parameters).toHaveLength(1);

      const reasonParam = acceptCommand!.parameters.find(p => p.name === 'reason');
      expect(reasonParam).toBeDefined();
      expect(reasonParam!.type).toBe('string');
      expect(reasonParam!.required).toBe(false);
    });

    it('should execute successfully with reason', async () => {
      const mockContext = {
        manuscriptId: 'test-manuscript-123',
        conversationId: 'test-conversation-456',
        triggeredBy: {
          messageId: 'test-message-789',
          userId: 'test-user-001',
          userRole: 'ADMIN',
          trigger: 'MENTION' as const
        },
        journal: { id: 'test-journal', settings: {} },
        config: {}
      };

      const result = await acceptCommand!.execute({ reason: 'High quality research' }, mockContext);

      expect(result).toBeDefined();
      expect(result.messages).toBeDefined();
      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].content).toContain('Manuscript Accepted for Publication');
      expect(result.messages[0].content).toContain('ACCEPTED');
      expect(result.messages[0].content).toContain('High quality research');
      expect(result.messages[0].content).toContain('test-manuscript-123');

      expect(result.actions).toBeDefined();
      expect(result.actions).toHaveLength(2);
      expect(result.actions![0].type).toBe('UPDATE_MANUSCRIPT_STATUS');
      expect(result.actions![0].data.status).toBe('ACCEPTED');
      expect(result.actions![1].type).toBe('EXECUTE_PUBLICATION_WORKFLOW');
    });

    it('should execute successfully without reason', async () => {
      const mockContext = {
        manuscriptId: 'test-manuscript-123',
        conversationId: 'test-conversation-456',
        triggeredBy: {
          messageId: 'test-message-789',
          userId: 'test-user-001',
          userRole: 'ADMIN',
          trigger: 'MENTION' as const
        },
        journal: { id: 'test-journal', settings: {} },
        config: {}
      };

      const result = await acceptCommand!.execute({}, mockContext);

      expect(result.messages[0].content).toContain('Manuscript Accepted for Publication');
      expect(result.messages[0].content).toContain('ACCEPTED');
      expect(result.messages[0].content).not.toContain('Reason:');
    });
  });

  describe('reject command', () => {
    const rejectCommand = editorialBot.commands.find(cmd => cmd.name === 'reject');

    it('should exist and have correct metadata', () => {
      expect(rejectCommand).toBeDefined();
      expect(rejectCommand!.description).toBe('Reject a manuscript');
      expect(rejectCommand!.permissions).toEqual(['make_editorial_decision']);
    });

    it('should have correct parameters', () => {
      expect(rejectCommand!.parameters).toHaveLength(1);

      const reasonParam = rejectCommand!.parameters.find(p => p.name === 'reason');
      expect(reasonParam).toBeDefined();
      expect(reasonParam!.type).toBe('string');
      expect(reasonParam!.required).toBe(false);
    });

    it('should execute successfully with reason', async () => {
      const mockContext = {
        manuscriptId: 'test-manuscript-123',
        conversationId: 'test-conversation-456',
        triggeredBy: {
          messageId: 'test-message-789',
          userId: 'test-user-001',
          userRole: 'ADMIN',
          trigger: 'MENTION' as const
        },
        journal: { id: 'test-journal', settings: {} },
        config: {}
      };

      const result = await rejectCommand!.execute({ reason: 'Insufficient methodology' }, mockContext);

      expect(result).toBeDefined();
      expect(result.messages[0].content).toContain('Manuscript Rejected');
      expect(result.messages[0].content).toContain('REJECTED');
      expect(result.messages[0].content).toContain('Insufficient methodology');
      expect(result.messages[0].content).toContain('test-manuscript-123');

      expect(result.actions).toBeDefined();
      expect(result.actions).toHaveLength(1);
      expect(result.actions![0].type).toBe('UPDATE_MANUSCRIPT_STATUS');
      expect(result.actions![0].data.status).toBe('REJECTED');
      expect(result.actions![0].data.reason).toBe('Insufficient methodology');
    });

    it('should execute successfully without reason', async () => {
      const mockContext = {
        manuscriptId: 'test-manuscript-123',
        conversationId: 'test-conversation-456',
        triggeredBy: {
          messageId: 'test-message-789',
          userId: 'test-user-001',
          userRole: 'ADMIN',
          trigger: 'MENTION' as const
        },
        journal: { id: 'test-journal', settings: {} },
        config: {}
      };

      const result = await rejectCommand!.execute({}, mockContext);

      expect(result.messages[0].content).toContain('Manuscript Rejected');
      expect(result.messages[0].content).toContain('REJECTED');
      expect(result.messages[0].content).not.toContain('Reason:');
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
          userRole: 'ADMIN',
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
          userRole: 'ADMIN',
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
          userRole: 'ADMIN',
          trigger: 'MENTION' as const
        },
        journal: { id: 'test-journal', settings: {} },
        config: {}
      };

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
          userRole: 'ADMIN',
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

});
