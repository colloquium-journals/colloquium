import {
  IdSchema,
  EmailSchema,
  PaginationSchema,
  UserCreateSchema,
  UserUpdateSchema,
  ConversationCreateSchema,
  ConversationUpdateSchema,
  MessageCreateSchema,
  MessageUpdateSchema,
  ManuscriptCreateSchema,
  ManuscriptUpdateSchema,
  BotInstallSchema,
  BotConfigUpdateSchema,
  FileUploadSchema,
  ConversationQuerySchema,
  MessageQuerySchema,
  ManuscriptQuerySchema,
  UserQuerySchema
} from '../../src/schemas/validation';

describe('Validation Schemas', () => {
  describe('IdSchema', () => {
    it('should validate valid UUID', () => {
      const validId = '123e4567-e89b-12d3-a456-426614174000';
      expect(() => IdSchema.parse(validId)).not.toThrow();
    });

    it('should reject invalid UUID', () => {
      expect(() => IdSchema.parse('invalid-id')).toThrow('Invalid ID format');
      expect(() => IdSchema.parse('123')).toThrow('Invalid ID format');
      expect(() => IdSchema.parse('')).toThrow('Invalid ID format');
    });
  });

  describe('EmailSchema', () => {
    it('should validate valid email addresses', () => {
      const validEmails = [
        'test@example.com',
        'user.name@domain.co.uk',
        'user+tag@domain.org',
        'user123@subdomain.domain.com'
      ];

      validEmails.forEach(email => {
        expect(() => EmailSchema.parse(email)).not.toThrow();
      });
    });

    it('should reject invalid email addresses', () => {
      const invalidEmails = [
        'invalid-email',
        '@domain.com',
        'user@',
        'user@domain',
        '',
        'user space@domain.com'
      ];

      invalidEmails.forEach(email => {
        expect(() => EmailSchema.parse(email)).toThrow('Invalid email format');
      });
    });
  });

  describe('PaginationSchema', () => {
    it('should validate and transform valid pagination params', () => {
      const result = PaginationSchema.parse({ page: '2', limit: '50' });
      expect(result).toEqual({ page: 2, limit: 50 });
    });

    it('should apply default values', () => {
      const result = PaginationSchema.parse({});
      expect(result).toEqual({ page: 1, limit: 20 });
    });

    it('should reject invalid pagination params', () => {
      expect(() => PaginationSchema.parse({ page: '0' })).toThrow();
      expect(() => PaginationSchema.parse({ limit: '0' })).toThrow();
      expect(() => PaginationSchema.parse({ limit: '101' })).toThrow();
    });
  });

  describe('UserCreateSchema', () => {
    it('should validate valid user creation data', () => {
      const validData = {
        email: 'user@example.com',
        name: 'John Doe',
        role: 'AUTHOR' as const,
        orcidId: '0000-0000-0000-0000'
      };

      const result = UserCreateSchema.parse(validData);
      expect(result).toEqual(validData);
    });

    it('should apply default role', () => {
      const data = {
        email: 'user@example.com',
        name: 'John Doe'
      };

      const result = UserCreateSchema.parse(data);
      expect(result.role).toBe('AUTHOR');
    });

    it('should reject invalid user creation data', () => {
      expect(() => UserCreateSchema.parse({
        email: 'invalid-email',
        name: 'John Doe'
      })).toThrow();

      expect(() => UserCreateSchema.parse({
        email: 'user@example.com',
        name: ''
      })).toThrow();

      expect(() => UserCreateSchema.parse({
        email: 'user@example.com',
        name: 'John Doe',
        role: 'INVALID_ROLE'
      })).toThrow();
    });
  });

  describe('UserUpdateSchema', () => {
    it('should validate valid user update data', () => {
      const validData = {
        name: 'Jane Doe',
        bio: 'A researcher in the field',
        affiliations: ['University A', 'Institute B']
      };

      const result = UserUpdateSchema.parse(validData);
      expect(result).toEqual(validData);
    });

    it('should allow partial updates', () => {
      const partialData = { name: 'Jane Doe' };
      const result = UserUpdateSchema.parse(partialData);
      expect(result).toEqual(partialData);
    });

    it('should reject invalid update data', () => {
      expect(() => UserUpdateSchema.parse({ name: '' })).toThrow();
    });
  });

  describe('ConversationCreateSchema', () => {
    it('should validate valid conversation creation data', () => {
      const validData = {
        title: 'Test Conversation',
        type: 'PRIVATE_REVIEW' as const,
        manuscriptId: '123e4567-e89b-12d3-a456-426614174000',
        participantIds: ['123e4567-e89b-12d3-a456-426614174001'],
        description: 'Test description'
      };

      const result = ConversationCreateSchema.parse(validData);
      expect(result).toEqual(validData);
    });

    it('should apply default values', () => {
      const minimalData = {
        title: 'Test Conversation',
        type: 'PUBLIC_REVIEW' as const
      };

      const result = ConversationCreateSchema.parse(minimalData);
      expect(result.participantIds).toEqual([]);
    });

    it('should reject invalid conversation data', () => {
      expect(() => ConversationCreateSchema.parse({
        title: '',
        type: 'PRIVATE_REVIEW'
      })).toThrow();

      expect(() => ConversationCreateSchema.parse({
        title: 'Test',
        type: 'INVALID_TYPE'
      })).toThrow();
    });
  });

  describe('MessageCreateSchema', () => {
    it('should validate valid message creation data', () => {
      const validData = {
        content: 'Test message content',
        conversationId: '123e4567-e89b-12d3-a456-426614174000',
        type: 'TEXT' as const,
        parentId: '123e4567-e89b-12d3-a456-426614174001',
        mentions: ['123e4567-e89b-12d3-a456-426614174002'],
        botMentions: ['@bot-plagiarism-checker']
      };

      const result = MessageCreateSchema.parse(validData);
      expect(result).toEqual(validData);
    });

    it('should apply default values', () => {
      const minimalData = {
        content: 'Test message',
        conversationId: '123e4567-e89b-12d3-a456-426614174000'
      };

      const result = MessageCreateSchema.parse(minimalData);
      expect(result.type).toBe('TEXT');
      expect(result.mentions).toEqual([]);
      expect(result.botMentions).toEqual([]);
    });

    it('should reject invalid message data', () => {
      expect(() => MessageCreateSchema.parse({
        content: '',
        conversationId: '123e4567-e89b-12d3-a456-426614174000'
      })).toThrow();

      expect(() => MessageCreateSchema.parse({
        content: 'Test',
        conversationId: 'invalid-id'
      })).toThrow();
    });
  });

  describe('ManuscriptCreateSchema', () => {
    it('should validate valid manuscript creation data', () => {
      const validData = {
        title: 'Research Paper Title',
        abstract: 'This is the abstract of the research paper.',
        authors: [{
          name: 'John Doe',
          email: 'john@example.com',
          affiliation: 'University A',
          orcidId: '0000-0000-0000-0000'
        }],
        keywords: ['research', 'science'],
        manuscriptType: 'RESEARCH_ARTICLE' as const,
        conflictOfInterest: 'None declared',
        funding: 'Funded by Grant XYZ',
        ethicsStatement: 'Ethics approval obtained'
      };

      const result = ManuscriptCreateSchema.parse(validData);
      expect(result).toEqual(validData);
    });

    it('should apply default values', () => {
      const minimalData = {
        title: 'Test Title',
        abstract: 'Test abstract',
        authors: [{
          name: 'Author Name',
          email: 'author@example.com'
        }]
      };

      const result = ManuscriptCreateSchema.parse(minimalData);
      expect(result.keywords).toEqual([]);
      expect(result.manuscriptType).toBe('RESEARCH_ARTICLE');
    });

    it('should reject invalid manuscript data', () => {
      expect(() => ManuscriptCreateSchema.parse({
        title: '',
        abstract: 'Abstract',
        authors: [{ name: 'Author', email: 'author@example.com' }]
      })).toThrow();

      expect(() => ManuscriptCreateSchema.parse({
        title: 'Title',
        abstract: '',
        authors: [{ name: 'Author', email: 'author@example.com' }]
      })).toThrow();

      expect(() => ManuscriptCreateSchema.parse({
        title: 'Title',
        abstract: 'Abstract',
        authors: [] // No authors
      })).toThrow();

      expect(() => ManuscriptCreateSchema.parse({
        title: 'Title',
        abstract: 'Abstract',
        authors: [{ name: '', email: 'author@example.com' }] // Empty name
      })).toThrow();
    });
  });

  describe('BotInstallSchema', () => {
    it('should validate valid bot installation data', () => {
      const validData = {
        name: 'bot-plagiarism-checker',
        version: '1.0.0',
        source: 'https://github.com/user/repo',
        config: { threshold: 0.8 }
      };

      const result = BotInstallSchema.parse(validData);
      expect(result).toEqual(validData);
    });

    it('should accept non-URL source', () => {
      const data = {
        name: 'local-bot',
        version: '1.0.0',
        source: 'npm:local-bot'
      };

      const result = BotInstallSchema.parse(data);
      expect(result).toEqual(data);
    });

    it('should reject invalid bot installation data', () => {
      expect(() => BotInstallSchema.parse({
        name: '',
        version: '1.0.0',
        source: 'https://github.com/user/repo'
      })).toThrow();

      expect(() => BotInstallSchema.parse({
        name: 'bot',
        version: '',
        source: 'https://github.com/user/repo'
      })).toThrow();
    });
  });

  describe('FileUploadSchema', () => {
    it('should validate valid file upload data', () => {
      const validData = {
        filename: 'document.pdf',
        mimeType: 'application/pdf',
        size: 1024000
      };

      const result = FileUploadSchema.parse(validData);
      expect(result).toEqual(validData);
    });

    it('should reject invalid file upload data', () => {
      expect(() => FileUploadSchema.parse({
        filename: '',
        mimeType: 'application/pdf',
        size: 1024
      })).toThrow();

      expect(() => FileUploadSchema.parse({
        filename: 'file.pdf',
        mimeType: '',
        size: 1024
      })).toThrow();

      expect(() => FileUploadSchema.parse({
        filename: 'file.pdf',
        mimeType: 'application/pdf',
        size: 0
      })).toThrow();
    });
  });

  describe('Query Schemas', () => {
    describe('ConversationQuerySchema', () => {
      it('should validate valid conversation query', () => {
        const validQuery = {
          page: '1',
          limit: '10',
          type: 'PRIVATE_REVIEW',
          status: 'ACTIVE',
          manuscriptId: '123e4567-e89b-12d3-a456-426614174000'
        };

        const result = ConversationQuerySchema.parse(validQuery);
        expect(result.page).toBe(1);
        expect(result.limit).toBe(10);
        expect(result.type).toBe('PRIVATE_REVIEW');
      });
    });

    describe('MessageQuerySchema', () => {
      it('should validate valid message query', () => {
        const validQuery = {
          conversationId: '123e4567-e89b-12d3-a456-426614174000',
          since: '2023-01-01T00:00:00.000Z',
          before: '2023-12-31T23:59:59.999Z'
        };

        const result = MessageQuerySchema.parse(validQuery);
        expect(result.conversationId).toBe('123e4567-e89b-12d3-a456-426614174000');
        expect(result.since).toBeInstanceOf(Date);
        expect(result.before).toBeInstanceOf(Date);
      });
    });

    describe('UserQuerySchema', () => {
      it('should validate valid user query', () => {
        const validQuery = {
          role: 'AUTHOR',
          search: 'john doe'
        };

        const result = UserQuerySchema.parse(validQuery);
        expect(result.role).toBe('AUTHOR');
        expect(result.search).toBe('john doe');
      });
    });
  });
});