import {
  loginSchema,
  manuscriptSubmissionSchema,
  conversationSchema,
  messageSchema,
  userUpdateSchema,
  ManuscriptStatus,
  ConversationType,
  PrivacyLevel,
  BotTrigger,
  BotPermission
} from '../index';

describe('Type Schemas', () => {
  describe('loginSchema', () => {
    it('should validate valid login data', () => {
      const validLogin = {
        email: 'test@example.com',
        redirectUrl: 'https://example.com/redirect'
      };
      
      const result = loginSchema.safeParse(validLogin);
      expect(result.success).toBe(true);
      
      if (result.success) {
        expect(result.data.email).toBe(validLogin.email);
        expect(result.data.redirectUrl).toBe(validLogin.redirectUrl);
      }
    });

    it('should reject invalid email format', () => {
      const invalidLogin = {
        email: 'invalid-email',
        redirectUrl: 'https://example.com'
      };
      
      const result = loginSchema.safeParse(invalidLogin);
      expect(result.success).toBe(false);
    });

    it('should allow missing redirectUrl', () => {
      const loginWithoutRedirect = {
        email: 'test@example.com'
      };
      
      const result = loginSchema.safeParse(loginWithoutRedirect);
      expect(result.success).toBe(true);
    });
  });

  describe('manuscriptSubmissionSchema', () => {
    it('should validate valid manuscript data', () => {
      const validManuscript = {
        title: 'Test Manuscript',
        abstract: 'This is a test abstract for the manuscript.',
        content: 'This is the full content of the manuscript.',
        authors: [
          {
            name: 'John Doe',
            email: 'john@example.com',
            isCorresponding: true
          }
        ]
      };
      
      const result = manuscriptSubmissionSchema.safeParse(validManuscript);
      expect(result.success).toBe(true);
      
      if (result.success) {
        expect(result.data.title).toBe(validManuscript.title);
        expect(result.data.authors).toHaveLength(1);
      }
    });

    it('should reject manuscript without title', () => {
      const invalidManuscript = {
        abstract: 'Abstract here',
        content: 'Content here',
        authors: [{ name: 'Author Name', isCorresponding: false }]
      };
      
      const result = manuscriptSubmissionSchema.safeParse(invalidManuscript);
      expect(result.success).toBe(false);
    });

    it('should require at least one author', () => {
      const manuscriptWithoutAuthors = {
        title: 'Test Title',
        abstract: 'Abstract here',
        content: 'Content here',
        authors: []
      };
      
      const result = manuscriptSubmissionSchema.safeParse(manuscriptWithoutAuthors);
      expect(result.success).toBe(false);
    });
  });

  describe('conversationSchema', () => {
    it('should validate valid conversation data', () => {
      const validConversation = {
        title: 'Test Conversation',
        type: 'EDITORIAL' as const,
        privacy: 'PRIVATE' as const,
        participants: ['user1', 'user2']
      };
      
      const result = conversationSchema.safeParse(validConversation);
      expect(result.success).toBe(true);
      
      if (result.success) {
        expect(result.data.title).toBe(validConversation.title);
        expect(result.data.type).toBe(validConversation.type);
      }
    });

    it('should reject invalid conversation type', () => {
      const invalidConversation = {
        title: 'Test Conversation',
        type: 'INVALID_TYPE',
        privacy: 'PRIVATE'
      };
      
      const result = conversationSchema.safeParse(invalidConversation);
      expect(result.success).toBe(false);
    });
  });

  describe('messageSchema', () => {
    it('should validate valid message data', () => {
      const validMessage = {
        content: 'This is a test message',
        parentId: 'parent-message-id',
        metadata: { type: 'user', timestamp: Date.now() }
      };
      
      const result = messageSchema.safeParse(validMessage);
      expect(result.success).toBe(true);
    });

    it('should reject empty message content', () => {
      const invalidMessage = {
        content: '',
        parentId: 'parent-id'
      };
      
      const result = messageSchema.safeParse(invalidMessage);
      expect(result.success).toBe(false);
    });
  });

  describe('userUpdateSchema', () => {
    it('should validate valid user update data', () => {
      const validUpdate = {
        name: 'John Doe',
        bio: 'A researcher'
      };

      const result = userUpdateSchema.safeParse(validUpdate);
      expect(result.success).toBe(true);
    });
  });

  describe('Enum Values', () => {
    it('should contain all expected manuscript statuses', () => {
      const expectedStatuses = [
        'SUBMITTED',
        'UNDER_REVIEW',
        'REVISION_REQUESTED',
        'REVISED',
        'ACCEPTED',
        'REJECTED',
        'PUBLISHED',
        'RETRACTED'
      ];
      
      expectedStatuses.forEach(status => {
        expect(Object.values(ManuscriptStatus)).toContain(status);
      });
    });

    it('should contain all expected conversation types', () => {
      const expectedTypes = [
        'EDITORIAL',
        'REVIEW', 
        'SEMI_PUBLIC',
        'PUBLIC',
        'AUTHOR_ONLY'
      ];
      
      expectedTypes.forEach(type => {
        expect(Object.values(ConversationType)).toContain(type);
      });
    });

    it('should contain all expected privacy levels', () => {
      const expectedPrivacy = [
        'PRIVATE',
        'SEMI_PUBLIC', 
        'PUBLIC'
      ];
      
      expectedPrivacy.forEach(privacy => {
        expect(Object.values(PrivacyLevel)).toContain(privacy);
      });
    });

    it('should contain all expected bot triggers', () => {
      const expectedTriggers = [
        'mention',
        'keyword',
        'manuscript_submitted',
        'review_complete',
        'scheduled'
      ];
      
      expectedTriggers.forEach(trigger => {
        expect(Object.values(BotTrigger)).toContain(trigger);
      });
    });

    it('should contain all expected bot permissions', () => {
      const expectedPermissions = [
        'read_manuscript',
        'read_files',
        'read_conversations',
        'write_messages',
        'update_manuscript',
        'assign_reviewers'
      ];
      
      expectedPermissions.forEach(permission => {
        expect(Object.values(BotPermission)).toContain(permission);
      });
    });
  });

  describe('Schema Validation Edge Cases', () => {
    it('should handle maximum length validation', () => {
      const longTitle = 'a'.repeat(501); // Exceeds 500 char limit
      const invalidManuscript = {
        title: longTitle,
        abstract: 'Abstract',
        content: 'Content',
        authors: [{ name: 'Author', isCorresponding: false }]
      };
      
      const result = manuscriptSubmissionSchema.safeParse(invalidManuscript);
      expect(result.success).toBe(false);
    });

    it('should validate email formats in authors', () => {
      const manuscriptWithInvalidEmail = {
        title: 'Title',
        abstract: 'Abstract',
        content: 'Content',
        authors: [
          {
            name: 'Author',
            email: 'invalid-email',
            isCorresponding: false
          }
        ]
      };
      
      const result = manuscriptSubmissionSchema.safeParse(manuscriptWithInvalidEmail);
      expect(result.success).toBe(false);
    });
  });
});