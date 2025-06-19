import { editorialBot } from '../../core/editorialBot';

describe('Editorial Bot - Accept/Reject Commands', () => {
  const mockContext = {
    manuscriptId: 'manuscript-123',
    triggeredBy: {
      messageId: 'message-123',
      userId: 'user-123',
      trigger: 'mention' as const
    },
    journal: {
      id: 'journal-123',
      settings: {}
    },
    config: {},
    conversationId: 'conversation-123'
  };

  describe('respond command', () => {
    const respondCommand = editorialBot.commands.find(cmd => cmd.name === 'respond');

    beforeEach(() => {
      expect(respondCommand).toBeDefined();
    });

    it('should accept a review invitation', async () => {
      const params = {
        assignmentId: 'assignment-123',
        response: 'accept',
        message: 'Happy to review this work'
      };

      const result = await respondCommand!.execute(params, mockContext);

      expect(result.messages).toHaveLength(1);
      expect(result.messages![0].content).toContain('Review Invitation Response');
      expect(result.messages![0].content).toContain('assignment-123');
      expect(result.messages![0].content).toContain('ACCEPT');
      expect(result.messages![0].content).toContain('Happy to review this work');
      expect(result.messages![0].content).toContain('Review invitation accepted');

      expect(result.actions).toHaveLength(1);
      expect(result.actions![0].type).toBe('RESPOND_TO_REVIEW');
      expect(result.actions![0].data.assignmentId).toBe('assignment-123');
      expect(result.actions![0].data.response).toBe('ACCEPT');
      expect(result.actions![0].data.message).toBe('Happy to review this work');
    });

    it('should decline a review invitation', async () => {
      const params = {
        assignmentId: 'assignment-456',
        response: 'decline',
        message: 'I have a conflict of interest'
      };

      const result = await respondCommand!.execute(params, mockContext);

      expect(result.messages).toHaveLength(1);
      expect(result.messages![0].content).toContain('Review Invitation Response');
      expect(result.messages![0].content).toContain('assignment-456');
      expect(result.messages![0].content).toContain('DECLINE');
      expect(result.messages![0].content).toContain('I have a conflict of interest');
      expect(result.messages![0].content).toContain('Review invitation declined');

      expect(result.actions).toHaveLength(1);
      expect(result.actions![0].type).toBe('RESPOND_TO_REVIEW');
      expect(result.actions![0].data.assignmentId).toBe('assignment-456');
      expect(result.actions![0].data.response).toBe('DECLINE');
      expect(result.actions![0].data.message).toBe('I have a conflict of interest');
    });

    it('should handle response without message', async () => {
      const params = {
        assignmentId: 'assignment-789',
        response: 'accept'
      };

      const result = await respondCommand!.execute(params, mockContext);

      expect(result.messages).toHaveLength(1);
      expect(result.messages![0].content).toContain('Review Invitation Response');
      expect(result.messages![0].content).toContain('ACCEPT');
      expect(result.messages![0].content).not.toContain('Message:');

      expect(result.actions![0].data.message).toBeUndefined();
    });

    it('should include timestamp in response', async () => {
      const params = {
        assignmentId: 'assignment-123',
        response: 'accept'
      };

      const result = await respondCommand!.execute(params, mockContext);

      expect(result.messages![0].content).toContain('Processed:');
      expect(result.messages![0].content).toMatch(/\d{1,2}\/\d{1,2}\/\d{4}/); // Date pattern
    });

    it('should have correct command metadata', () => {
      expect(respondCommand!.name).toBe('respond');
      expect(respondCommand!.description).toContain('Respond to a review invitation');
      expect(respondCommand!.usage).toContain('@editorial-bot respond');
      expect(respondCommand!.permissions).toContain('read_manuscript');
      
      // Check parameters
      expect(respondCommand!.parameters).toHaveLength(3);
      expect(respondCommand!.parameters[0].name).toBe('assignmentId');
      expect(respondCommand!.parameters[0].required).toBe(true);
      expect(respondCommand!.parameters[1].name).toBe('response');
      expect(respondCommand!.parameters[1].required).toBe(true);
      expect(respondCommand!.parameters[1].enumValues).toEqual(['accept', 'decline']);
      expect(respondCommand!.parameters[2].name).toBe('message');
      expect(respondCommand!.parameters[2].required).toBe(false);

      // Check examples
      expect(respondCommand!.examples).toHaveLength(3);
      expect(respondCommand!.examples[0]).toContain('accept');
      expect(respondCommand!.examples[1]).toContain('decline');
      expect(respondCommand!.examples[2]).toContain('message=');
    });
  });

  describe('submit command', () => {
    const submitCommand = editorialBot.commands.find(cmd => cmd.name === 'submit');

    beforeEach(() => {
      expect(submitCommand).toBeDefined();
    });

    it('should submit a review with all fields', async () => {
      const params = {
        assignmentId: 'assignment-123',
        recommendation: 'minor_revision',
        review: 'This manuscript presents interesting findings but needs minor revisions in the methodology section.',
        score: '8',
        confidential: 'The statistical analysis could be more robust.'
      };

      const result = await submitCommand!.execute(params, mockContext);

      expect(result.messages).toHaveLength(1);
      expect(result.messages![0].content).toContain('Review Submitted');
      expect(result.messages![0].content).toContain('assignment-123');
      expect(result.messages![0].content).toContain('MINOR REVISION');
      expect(result.messages![0].content).toContain('8/10');
      expect(result.messages![0].content).toContain('Confidential comments have been shared');

      expect(result.actions).toHaveLength(1);
      expect(result.actions![0].type).toBe('SUBMIT_REVIEW');
      expect(result.actions![0].data.assignmentId).toBe('assignment-123');
      expect(result.actions![0].data.reviewContent).toBe(params.review);
      expect(result.actions![0].data.recommendation).toBe('MINOR_REVISION');
      expect(result.actions![0].data.confidentialComments).toBe(params.confidential);
      expect(result.actions![0].data.score).toBe(8);
    });

    it('should submit a review without optional fields', async () => {
      const params = {
        assignmentId: 'assignment-456',
        recommendation: 'accept',
        review: 'Excellent manuscript with clear methodology and strong conclusions.'
      };

      const result = await submitCommand!.execute(params, mockContext);

      expect(result.messages![0].content).toContain('Review Submitted');
      expect(result.messages![0].content).toContain('ACCEPT');
      expect(result.messages![0].content).not.toContain('/10');
      expect(result.messages![0].content).not.toContain('Confidential comments');

      expect(result.actions![0].data.score).toBeUndefined();
      expect(result.actions![0].data.confidentialComments).toBeUndefined();
    });

    it('should handle all recommendation types', async () => {
      const recommendations = ['accept', 'minor_revision', 'major_revision', 'reject'];
      
      for (const recommendation of recommendations) {
        const params = {
          assignmentId: 'assignment-test',
          recommendation,
          review: 'Test review content for recommendation type.'
        };

        const result = await submitCommand!.execute(params, mockContext);
        
        expect(result.messages![0].content).toContain(recommendation.replace('_', ' ').toUpperCase());
        expect(result.actions![0].data.recommendation).toBe(recommendation.toUpperCase());
      }
    });

    it('should parse score as integer', async () => {
      const params = {
        assignmentId: 'assignment-789',
        recommendation: 'minor_revision',
        review: 'Good work with room for improvement.',
        score: '7'
      };

      const result = await submitCommand!.execute(params, mockContext);

      expect(result.actions![0].data.score).toBe(7);
      expect(typeof result.actions![0].data.score).toBe('number');
    });

    it('should include timestamp in submission', async () => {
      const params = {
        assignmentId: 'assignment-123',
        recommendation: 'accept',
        review: 'Excellent work.'
      };

      const result = await submitCommand!.execute(params, mockContext);

      expect(result.messages![0].content).toContain('Submitted:');
      expect(result.messages![0].content).toMatch(/\d{1,2}\/\d{1,2}\/\d{4}/); // Date pattern
    });

    it('should have correct command metadata', () => {
      expect(submitCommand!.name).toBe('submit');
      expect(submitCommand!.description).toContain('Submit a review for a manuscript');
      expect(submitCommand!.usage).toContain('@editorial-bot submit');
      expect(submitCommand!.permissions).toContain('read_manuscript');
      
      // Check parameters
      expect(submitCommand!.parameters).toHaveLength(5);
      expect(submitCommand!.parameters[0].name).toBe('assignmentId');
      expect(submitCommand!.parameters[0].required).toBe(true);
      expect(submitCommand!.parameters[1].name).toBe('recommendation');
      expect(submitCommand!.parameters[1].required).toBe(true);
      expect(submitCommand!.parameters[1].enumValues).toEqual(['accept', 'minor_revision', 'major_revision', 'reject']);
      expect(submitCommand!.parameters[2].name).toBe('review');
      expect(submitCommand!.parameters[2].required).toBe(true);
      expect(submitCommand!.parameters[3].name).toBe('score');
      expect(submitCommand!.parameters[3].required).toBe(false);
      expect(submitCommand!.parameters[4].name).toBe('confidential');
      expect(submitCommand!.parameters[4].required).toBe(false);

      // Check examples
      expect(submitCommand!.examples).toHaveLength(3);
      expect(submitCommand!.examples[0]).toContain('recommendation="accept"');
      expect(submitCommand!.examples[1]).toContain('score="7"');
      expect(submitCommand!.examples[2]).toContain('confidential=');
    });
  });

  describe('bot metadata', () => {
    it('should have updated version', () => {
      expect(editorialBot.version).toBe('2.1.0');
    });

    it('should include new commands in commands array', () => {
      const commandNames = editorialBot.commands.map(cmd => cmd.name);
      expect(commandNames).toContain('respond');
      expect(commandNames).toContain('submit');
      expect(commandNames).toContain('status');
      expect(commandNames).toContain('assign');
      expect(commandNames).toContain('summary');
      expect(commandNames).toContain('help');
    });

    it('should have correct bot metadata', () => {
      expect(editorialBot.id).toBe('editorial-bot');
      expect(editorialBot.name).toBe('Editorial Bot');
      expect(editorialBot.description).toContain('editorial workflows');
      expect(editorialBot.keywords).toContain('editorial decision');
      expect(editorialBot.permissions).toContain('read_manuscript');
      expect(editorialBot.permissions).toContain('update_manuscript');
      expect(editorialBot.permissions).toContain('assign_reviewers');
    });
  });
});