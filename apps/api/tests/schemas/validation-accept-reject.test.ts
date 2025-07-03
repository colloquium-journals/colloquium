import { ReviewInvitationResponseSchema, ReviewSubmissionSchema } from '../../src/schemas/validation';

describe('Validation Schemas - Accept/Reject', () => {
  describe('ReviewInvitationResponseSchema', () => {
    it('should validate valid ACCEPT response', () => {
      const validData = {
        response: 'ACCEPT',
        message: 'Happy to review this work',
        availableUntil: '2024-03-01T00:00:00.000Z'
      };

      const result = ReviewInvitationResponseSchema.safeParse(validData);
      expect(result.success).toBe(true);
      
      if (result.success) {
        expect(result.data.response).toBe('ACCEPT');
        expect(result.data.message).toBe('Happy to review this work');
        expect(result.data.availableUntil).toBeInstanceOf(Date);
      }
    });

    it('should validate valid DECLINE response', () => {
      const validData = {
        response: 'DECLINE',
        message: 'I have a conflict of interest'
      };

      const result = ReviewInvitationResponseSchema.safeParse(validData);
      expect(result.success).toBe(true);
      
      if (result.success) {
        expect(result.data.response).toBe('DECLINE');
        expect(result.data.message).toBe('I have a conflict of interest');
        expect(result.data.availableUntil).toBeUndefined();
      }
    });

    it('should validate response without optional fields', () => {
      const validData = {
        response: 'ACCEPT'
      };

      const result = ReviewInvitationResponseSchema.safeParse(validData);
      expect(result.success).toBe(true);
      
      if (result.success) {
        expect(result.data.response).toBe('ACCEPT');
        expect(result.data.message).toBeUndefined();
        expect(result.data.availableUntil).toBeUndefined();
      }
    });

    it('should reject invalid response enum', () => {
      const invalidData = {
        response: 'INVALID_RESPONSE'
      };

      const result = ReviewInvitationResponseSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      
      if (!result.success) {
        expect(result.error.issues[0].path).toEqual(['response']);
        expect(result.error.issues[0].message).toContain('Invalid enum value');
      }
    });

    it('should reject message that is too long', () => {
      const invalidData = {
        response: 'ACCEPT',
        message: 'a'.repeat(501) // 501 characters, over the 500 limit
      };

      const result = ReviewInvitationResponseSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      
      if (!result.success) {
        expect(result.error.issues[0].path).toEqual(['message']);
        expect(result.error.issues[0].message).toBe('Message too long');
      }
    });

    it('should coerce string dates to Date objects', () => {
      const validData = {
        response: 'ACCEPT',
        availableUntil: '2024-03-01'
      };

      const result = ReviewInvitationResponseSchema.safeParse(validData);
      expect(result.success).toBe(true);
      
      if (result.success) {
        expect(result.data.availableUntil).toBeInstanceOf(Date);
        expect(result.data.availableUntil?.getFullYear()).toBe(2024);
      }
    });

    it('should reject invalid date formats', () => {
      const invalidData = {
        response: 'ACCEPT',
        availableUntil: 'not-a-date'
      };

      const result = ReviewInvitationResponseSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      
      if (!result.success) {
        expect(result.error.issues[0].path).toEqual(['availableUntil']);
      }
    });

    it('should require response field', () => {
      const invalidData = {
        message: 'A message without response'
      };

      const result = ReviewInvitationResponseSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      
      if (!result.success) {
        expect(result.error.issues[0].path).toEqual(['response']);
        expect(result.error.issues[0].code).toBe('invalid_type');
      }
    });
  });

  describe('ReviewSubmissionSchema', () => {
    it('should validate complete review submission', () => {
      const validData = {
        reviewContent: 'This manuscript presents interesting findings with solid methodology and clear presentation.',
        recommendation: 'MINOR_REVISION',
        confidentialComments: 'The statistical analysis could be strengthened.',
        score: 8,
        attachments: ['file1.pdf', 'file2.docx']
      };

      const result = ReviewSubmissionSchema.safeParse(validData);
      expect(result.success).toBe(true);
      
      if (result.success) {
        expect(result.data.reviewContent).toBe(validData.reviewContent);
        expect(result.data.recommendation).toBe('MINOR_REVISION');
        expect(result.data.confidentialComments).toBe(validData.confidentialComments);
        expect(result.data.score).toBe(8);
        expect(result.data.attachments).toEqual(['file1.pdf', 'file2.docx']);
      }
    });

    it('should validate minimal review submission', () => {
      const validData = {
        reviewContent: 'Excellent manuscript.',
        recommendation: 'ACCEPT'
      };

      const result = ReviewSubmissionSchema.safeParse(validData);
      expect(result.success).toBe(true);
      
      if (result.success) {
        expect(result.data.reviewContent).toBe('Excellent manuscript.');
        expect(result.data.recommendation).toBe('ACCEPT');
        expect(result.data.confidentialComments).toBeUndefined();
        expect(result.data.score).toBeUndefined();
        expect(result.data.attachments).toEqual([]);
      }
    });

    it('should validate all recommendation types', () => {
      const recommendations = ['ACCEPT', 'MINOR_REVISION', 'MAJOR_REVISION', 'REJECT'];
      
      for (const recommendation of recommendations) {
        const validData = {
          reviewContent: 'Test review content for validation.',
          recommendation
        };

        const result = ReviewSubmissionSchema.safeParse(validData);
        expect(result.success).toBe(true);
        
        if (result.success) {
          expect(result.data.recommendation).toBe(recommendation);
        }
      }
    });

    it('should reject review content that is too short', () => {
      const invalidData = {
        reviewContent: 'Too short',
        recommendation: 'ACCEPT'
      };

      const result = ReviewSubmissionSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      
      if (!result.success) {
        expect(result.error.issues[0].path).toEqual(['reviewContent']);
        expect(result.error.issues[0].message).toBe('Review must be at least 10 characters');
      }
    });

    it('should reject invalid recommendation enum', () => {
      const invalidData = {
        reviewContent: 'This is a valid review content with sufficient length.',
        recommendation: 'INVALID_RECOMMENDATION'
      };

      const result = ReviewSubmissionSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      
      if (!result.success) {
        expect(result.error.issues[0].path).toEqual(['recommendation']);
        expect(result.error.issues[0].message).toContain('Invalid enum value');
      }
    });

    it('should validate score range 1-10', () => {
      const validScores = [1, 5, 10];
      
      for (const score of validScores) {
        const validData = {
          reviewContent: 'Valid review content for score testing.',
          recommendation: 'ACCEPT',
          score
        };

        const result = ReviewSubmissionSchema.safeParse(validData);
        expect(result.success).toBe(true);
        
        if (result.success) {
          expect(result.data.score).toBe(score);
        }
      }
    });

    it('should reject score below 1', () => {
      const invalidData = {
        reviewContent: 'Valid review content for score testing.',
        recommendation: 'ACCEPT',
        score: 0
      };

      const result = ReviewSubmissionSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      
      if (!result.success) {
        expect(result.error.issues[0].path).toEqual(['score']);
        expect(result.error.issues[0].message).toContain('Number must be greater than or equal to 1');
      }
    });

    it('should reject score above 10', () => {
      const invalidData = {
        reviewContent: 'Valid review content for score testing.',
        recommendation: 'ACCEPT',
        score: 11
      };

      const result = ReviewSubmissionSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      
      if (!result.success) {
        expect(result.error.issues[0].path).toEqual(['score']);
        expect(result.error.issues[0].message).toContain('Number must be less than or equal to 10');
      }
    });

    it('should require reviewContent field', () => {
      const invalidData = {
        recommendation: 'ACCEPT'
      };

      const result = ReviewSubmissionSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      
      if (!result.success) {
        expect(result.error.issues[0].path).toEqual(['reviewContent']);
        expect(result.error.issues[0].code).toBe('invalid_type');
      }
    });

    it('should require recommendation field', () => {
      const invalidData = {
        reviewContent: 'This is a valid review content.'
      };

      const result = ReviewSubmissionSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      
      if (!result.success) {
        expect(result.error.issues[0].path).toEqual(['recommendation']);
        expect(result.error.issues[0].code).toBe('invalid_type');
      }
    });

    it('should handle empty attachments array', () => {
      const validData = {
        reviewContent: 'Review without attachments.',
        recommendation: 'ACCEPT',
        attachments: []
      };

      const result = ReviewSubmissionSchema.safeParse(validData);
      expect(result.success).toBe(true);
      
      if (result.success) {
        expect(result.data.attachments).toEqual([]);
      }
    });

    it('should default attachments to empty array', () => {
      const validData = {
        reviewContent: 'Review without explicit attachments.',
        recommendation: 'ACCEPT'
      };

      const result = ReviewSubmissionSchema.safeParse(validData);
      expect(result.success).toBe(true);
      
      if (result.success) {
        expect(result.data.attachments).toEqual([]);
      }
    });
  });
});