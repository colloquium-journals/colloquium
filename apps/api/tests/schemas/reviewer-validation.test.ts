import {
  ReviewAssignmentCreateSchema,
  ReviewAssignmentUpdateSchema,
  ReviewerInvitationSchema,
  ReviewerSearchSchema,
  BulkReviewerAssignmentSchema,
  ReviewDecisionSchema
} from '../../src/schemas/validation';

describe('Reviewer Validation Schemas', () => {
  describe('ReviewAssignmentCreateSchema', () => {
    it('should validate valid review assignment data', () => {
      const validData = {
        manuscriptId: '123e4567-e89b-12d3-a456-426614174000',
        reviewerId: '123e4567-e89b-12d3-a456-426614174001',
        dueDate: '2024-12-31T23:59:59.999Z',
        message: 'Please review this manuscript'
      };

      const result = ReviewAssignmentCreateSchema.parse(validData);
      expect(result.manuscriptId).toBe(validData.manuscriptId);
      expect(result.reviewerId).toBe(validData.reviewerId);
      expect(result.dueDate).toBeInstanceOf(Date);
      expect(result.message).toBe(validData.message);
    });

    it('should reject invalid UUIDs', () => {
      expect(() => ReviewAssignmentCreateSchema.parse({
        manuscriptId: 'invalid-uuid',
        reviewerId: '123e4567-e89b-12d3-a456-426614174001'
      })).toThrow('Invalid ID format');
    });

    it('should allow optional fields to be omitted', () => {
      const minimalData = {
        manuscriptId: '123e4567-e89b-12d3-a456-426614174000',
        reviewerId: '123e4567-e89b-12d3-a456-426614174001'
      };

      const result = ReviewAssignmentCreateSchema.parse(minimalData);
      expect(result.manuscriptId).toBe(minimalData.manuscriptId);
      expect(result.reviewerId).toBe(minimalData.reviewerId);
      expect(result.dueDate).toBeUndefined();
      expect(result.message).toBeUndefined();
    });
  });

  describe('ReviewAssignmentUpdateSchema', () => {
    it('should validate status updates', () => {
      const validStatuses = ['PENDING', 'ACCEPTED', 'DECLINED', 'IN_PROGRESS', 'COMPLETED'];
      
      validStatuses.forEach(status => {
        const result = ReviewAssignmentUpdateSchema.parse({ status });
        expect(result.status).toBe(status);
      });
    });

    it('should reject invalid status', () => {
      expect(() => ReviewAssignmentUpdateSchema.parse({
        status: 'INVALID_STATUS'
      })).toThrow();
    });

    it('should validate date fields', () => {
      const data = {
        dueDate: '2024-12-31T23:59:59.999Z',
        completedAt: '2024-01-01T00:00:00.000Z'
      };

      const result = ReviewAssignmentUpdateSchema.parse(data);
      expect(result.dueDate).toBeInstanceOf(Date);
      expect(result.completedAt).toBeInstanceOf(Date);
    });
  });

  describe('ReviewerInvitationSchema', () => {
    it('should validate reviewer invitation data', () => {
      const validData = {
        manuscriptId: '123e4567-e89b-12d3-a456-426614174000',
        reviewerEmails: ['reviewer1@example.com', 'reviewer2@university.edu'],
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        message: 'Would you be willing to review this manuscript?',
        autoAssign: false
      };

      const result = ReviewerInvitationSchema.parse(validData);
      expect(result.manuscriptId).toBe(validData.manuscriptId);
      expect(result.reviewerEmails).toEqual(validData.reviewerEmails);
      expect(result.dueDate).toBeInstanceOf(Date);
      expect(result.message).toBe(validData.message);
      expect(result.autoAssign).toBe(false);
    });

    it('should require at least one reviewer email', () => {
      expect(() => ReviewerInvitationSchema.parse({
        manuscriptId: '123e4567-e89b-12d3-a456-426614174000',
        reviewerEmails: [],
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      })).toThrow('At least one reviewer email is required');
    });

    it('should validate email formats', () => {
      expect(() => ReviewerInvitationSchema.parse({
        manuscriptId: '123e4567-e89b-12d3-a456-426614174000',
        reviewerEmails: ['invalid-email', 'valid@example.com'],
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      })).toThrow();
    });

    it('should reject past due dates', () => {
      expect(() => ReviewerInvitationSchema.parse({
        manuscriptId: '123e4567-e89b-12d3-a456-426614174000',
        reviewerEmails: ['reviewer@example.com'],
        dueDate: new Date(Date.now() - 24 * 60 * 60 * 1000) // Yesterday
      })).toThrow('Due date must be in the future');
    });

    it('should apply default values', () => {
      const minimalData = {
        manuscriptId: '123e4567-e89b-12d3-a456-426614174000',
        reviewerEmails: ['reviewer@example.com'],
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      };

      const result = ReviewerInvitationSchema.parse(minimalData);
      expect(result.autoAssign).toBe(false);
    });

    it('should validate message length', () => {
      const longMessage = 'a'.repeat(1001); // 1001 characters
      
      expect(() => ReviewerInvitationSchema.parse({
        manuscriptId: '123e4567-e89b-12d3-a456-426614174000',
        reviewerEmails: ['reviewer@example.com'],
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        message: longMessage
      })).toThrow('Message too long');
    });
  });

  describe('ReviewerSearchSchema', () => {
    it('should validate search parameters', () => {
      const validData = {
        query: 'machine learning',
        manuscriptId: '123e4567-e89b-12d3-a456-426614174000',
        excludeConflicts: true,
        limit: 25
      };

      const result = ReviewerSearchSchema.parse(validData);
      expect(result.query).toBe(validData.query);
      expect(result.manuscriptId).toBe(validData.manuscriptId);
      expect(result.excludeConflicts).toBe(true);
      expect(result.limit).toBe(25);
    });

    it('should require search query', () => {
      expect(() => ReviewerSearchSchema.parse({
        manuscriptId: '123e4567-e89b-12d3-a456-426614174000'
      })).toThrow();
    });

    it('should apply default values', () => {
      const minimalData = {
        query: 'artificial intelligence'
      };

      const result = ReviewerSearchSchema.parse(minimalData);
      expect(result.excludeConflicts).toBe(true);
      expect(result.limit).toBe(20);
    });

    it('should validate limit constraints', () => {
      expect(() => ReviewerSearchSchema.parse({
        query: 'test',
        limit: 0
      })).toThrow();

      expect(() => ReviewerSearchSchema.parse({
        query: 'test',
        limit: 51
      })).toThrow();
    });
  });

  describe('BulkReviewerAssignmentSchema', () => {
    it('should validate bulk assignment data', () => {
      const validData = {
        manuscriptId: '123e4567-e89b-12d3-a456-426614174000',
        assignments: [
          {
            reviewerId: '123e4567-e89b-12d3-a456-426614174001',
            dueDate: '2024-12-31T23:59:59.999Z',
            message: 'Please review this'
          },
          {
            reviewerId: '123e4567-e89b-12d3-a456-426614174002'
          }
        ]
      };

      const result = BulkReviewerAssignmentSchema.parse(validData);
      expect(result.manuscriptId).toBe(validData.manuscriptId);
      expect(result.assignments).toHaveLength(2);
      expect(result.assignments[0].dueDate).toBeInstanceOf(Date);
    });

    it('should require at least one assignment', () => {
      expect(() => BulkReviewerAssignmentSchema.parse({
        manuscriptId: '123e4567-e89b-12d3-a456-426614174000',
        assignments: []
      })).toThrow('At least one assignment is required');
    });
  });

  describe('ReviewDecisionSchema', () => {
    it('should validate review decision data', () => {
      const validData = {
        manuscriptId: '123e4567-e89b-12d3-a456-426614174000',
        decision: 'ACCEPT' as const,
        comments: 'This manuscript makes significant contributions to the field.',
        publicComments: 'Well-written and methodologically sound.',
        attachments: ['file1.pdf', 'file2.pdf']
      };

      const result = ReviewDecisionSchema.parse(validData);
      expect(result.manuscriptId).toBe(validData.manuscriptId);
      expect(result.decision).toBe('ACCEPT');
      expect(result.comments).toBe(validData.comments);
      expect(result.publicComments).toBe(validData.publicComments);
      expect(result.attachments).toEqual(validData.attachments);
    });

    it('should validate decision options', () => {
      const validDecisions = ['ACCEPT', 'REJECT', 'REVISION_REQUESTED'];
      
      validDecisions.forEach(decision => {
        const result = ReviewDecisionSchema.parse({
          manuscriptId: '123e4567-e89b-12d3-a456-426614174000',
          decision,
          comments: 'Valid decision comments'
        });
        expect(result.decision).toBe(decision);
      });
    });

    it('should require decision comments', () => {
      expect(() => ReviewDecisionSchema.parse({
        manuscriptId: '123e4567-e89b-12d3-a456-426614174000',
        decision: 'ACCEPT',
        comments: ''
      })).toThrow('Decision comments are required');
    });

    it('should reject invalid decisions', () => {
      expect(() => ReviewDecisionSchema.parse({
        manuscriptId: '123e4567-e89b-12d3-a456-426614174000',
        decision: 'MAYBE',
        comments: 'Uncertain decision'
      })).toThrow();
    });

    it('should apply default values', () => {
      const minimalData = {
        manuscriptId: '123e4567-e89b-12d3-a456-426614174000',
        decision: 'REVISION_REQUESTED' as const,
        comments: 'Please address the following concerns.'
      };

      const result = ReviewDecisionSchema.parse(minimalData);
      expect(result.attachments).toEqual([]);
    });
  });
});