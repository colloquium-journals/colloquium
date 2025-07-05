import { BotActionProcessor } from '../../src/services/botActionProcessor';
import { prisma } from '@colloquium/database';
import * as nodemailer from 'nodemailer';
import { randomUUID } from 'crypto';

// Mock nodemailer
const mockSendMail = jest.fn().mockResolvedValue({ messageId: 'test-message-id' });
jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({
    sendMail: mockSendMail
  }))
}));

// Test utilities
const createTestUser = async (userData: any = {}) => {
  return await prisma.users.create({
    data: {
      id: randomUUID(),
      email: userData.email || 'test@example.com',
      name: userData.name || 'Test User',
      role: userData.role || 'USER',
      updatedAt: new Date(),
      ...userData
    }
  });
};

const createTestManuscript = async (authorId: string, manuscriptData: any = {}) => {
  const manuscript = await prisma.manuscripts.create({
    data: {
      id: randomUUID(),
      title: manuscriptData.title || 'Test Manuscript',
      abstract: manuscriptData.abstract || 'Test abstract for manuscript',
      content: manuscriptData.content || 'Test content',
      status: manuscriptData.status || 'SUBMITTED',
      updatedAt: new Date(),
      ...manuscriptData
    }
  });

  await prisma.manuscript_authors.create({
    data: {
      id: randomUUID(),
      manuscriptId: manuscript.id,
      userId: authorId,
      isCorresponding: true
    }
  });

  return manuscript;
};

describe('Email Notifications', () => {
  let botActionProcessor: BotActionProcessor;
  let author: any;
  let reviewer: any;
  let editor: any;
  let manuscript: any;
  let editorialConversation: any;

  beforeEach(async () => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Set up test environment variables
    process.env.SMTP_HOST = 'test-smtp.example.com';
    process.env.SMTP_PORT = '587';
    process.env.FROM_EMAIL = 'test@colloquium.example.com';
    process.env.FRONTEND_URL = 'https://test.colloquium.example.com';
    
    botActionProcessor = new BotActionProcessor();
    
    // Create test users
    author = await createTestUser({ role: 'USER', email: 'author@test.com', name: 'Test Author' });
    reviewer = await createTestUser({ role: 'USER', email: 'reviewer@test.com', name: 'Test Reviewer' });
    editor = await createTestUser({ role: 'EDITOR', email: 'editor@test.com', name: 'Test Editor' });
    
    // Create test manuscript
    manuscript = await createTestManuscript(author.id, { title: 'Test Manuscript Title' });
    
    // Create editorial conversation
    editorialConversation = await prisma.conversations.create({
      data: {
        id: randomUUID(),
        title: 'Editorial Discussion',
        type: 'EDITORIAL',
        privacy: 'PRIVATE',
        manuscriptId: manuscript.id,
        updatedAt: new Date()
      }
    });
  });

  afterEach(async () => {
    // Clean up test data
    await prisma.messages.deleteMany();
    await prisma.conversation_participants.deleteMany();
    await prisma.conversations.deleteMany();
    await prisma.action_editors.deleteMany();
    await prisma.review_assignments.deleteMany();
    await prisma.manuscript_authors.deleteMany();
    await prisma.manuscripts.deleteMany();
    await prisma.users.deleteMany();
  });

  describe('Review Invitation Emails', () => {
    it('should send review invitation email with correct content', async () => {
      const actions = [{
        type: 'ASSIGN_REVIEWER' as const,
        data: {
          reviewers: ['reviewer@test.com'],
          deadline: new Date('2024-12-31'),
          customMessage: 'Please review this important manuscript'
        }
      }];

      const context = {
        manuscriptId: manuscript.id,
        userId: editor.id,
        conversationId: editorialConversation.id
      };

      await botActionProcessor.processActions(actions, context);

      // Verify email was sent
      expect(mockSendMail).toHaveBeenCalledTimes(1);
      
      const emailCall = mockSendMail.mock.calls[0][0];
      expect(emailCall.to).toBe('reviewer@test.com');
      expect(emailCall.from).toBe('test@colloquium.example.com');
      expect(emailCall.subject).toBe('Review Invitation: Test Manuscript Title');
      
      // Check email content
      expect(emailCall.html).toContain('Review Invitation');
      expect(emailCall.html).toContain('Test Manuscript Title');
      expect(emailCall.html).toContain('Please review this important manuscript');
      expect(emailCall.html).toContain('December 31, 2024'); // Due date
      expect(emailCall.html).toContain('Accept Review');
      expect(emailCall.html).toContain('Decline Review');
      
      // Check text version
      expect(emailCall.text).toContain('Review Invitation');
      expect(emailCall.text).toContain('Test Manuscript Title');
      expect(emailCall.text).toContain('Please review this important manuscript');
    });

    it('should send review invitation email without custom message', async () => {
      const actions = [{
        type: 'ASSIGN_REVIEWER' as const,
        data: {
          reviewers: ['reviewer@test.com'],
          deadline: new Date('2024-12-31')
        }
      }];

      const context = {
        manuscriptId: manuscript.id,
        userId: editor.id,
        conversationId: editorialConversation.id
      };

      await botActionProcessor.processActions(actions, context);

      expect(mockSendMail).toHaveBeenCalledTimes(1);
      
      const emailCall = mockSendMail.mock.calls[0][0];
      expect(emailCall.html).not.toContain('Message from Editor');
      expect(emailCall.text).not.toContain('Message from Editor');
    });

    it('should handle email sending failures gracefully', async () => {
      // Mock email failure
      mockSendMail.mockRejectedValueOnce(new Error('SMTP connection failed'));

      const actions = [{
        type: 'ASSIGN_REVIEWER' as const,
        data: {
          reviewers: ['reviewer@test.com']
        }
      }];

      const context = {
        manuscriptId: manuscript.id,
        userId: editor.id,
        conversationId: editorialConversation.id
      };

      // Should not throw error
      await expect(botActionProcessor.processActions(actions, context)).resolves.not.toThrow();
      
      // Should still create review assignment
      const assignment = await prisma.review_assignments.findFirst({
        where: { manuscriptId: manuscript.id }
      });
      expect(assignment).toBeTruthy();
    });
  });

  describe('Editorial Decision Emails', () => {
    beforeEach(async () => {
      // Create review assignment and conversation for editorial decisions
      await prisma.review_assignments.create({
        data: {
          id: randomUUID(),
          manuscriptId: manuscript.id,
          reviewerId: reviewer.id,
          status: 'COMPLETED',
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        }
      });
    });

    it('should send acceptance email with correct content', async () => {
      const actions = [{
        type: 'MAKE_EDITORIAL_DECISION' as const,
        data: {
          decision: 'accept',
          status: 'ACCEPTED'
        }
      }];

      const context = {
        manuscriptId: manuscript.id,
        userId: editor.id,
        conversationId: editorialConversation.id
      };

      await botActionProcessor.processActions(actions, context);

      expect(mockSendMail).toHaveBeenCalledTimes(1);
      
      const emailCall = mockSendMail.mock.calls[0][0];
      expect(emailCall.to).toBe('author@test.com');
      expect(emailCall.from).toBe('test@colloquium.example.com');
      expect(emailCall.subject).toBe('Editorial Decision: Test Manuscript Title - Accepted');
      
      // Check acceptance content
      expect(emailCall.html).toContain('Editorial Decision: Accepted');
      expect(emailCall.html).toContain('Test Manuscript Title');
      expect(emailCall.html).toContain('Congratulations!');
      expect(emailCall.html).toContain('accepted for publication');
      expect(emailCall.html).toContain('color: #16a34a'); // Green color for acceptance
      
      // Check text version
      expect(emailCall.text).toContain('Congratulations! Your manuscript has been accepted for publication');
    });

    it('should send rejection email with correct content', async () => {
      const actions = [{
        type: 'MAKE_EDITORIAL_DECISION' as const,
        data: {
          decision: 'reject',
          status: 'REJECTED'
        }
      }];

      const context = {
        manuscriptId: manuscript.id,
        userId: editor.id,
        conversationId: editorialConversation.id
      };

      await botActionProcessor.processActions(actions, context);

      expect(mockSendMail).toHaveBeenCalledTimes(1);
      
      const emailCall = mockSendMail.mock.calls[0][0];
      expect(emailCall.subject).toBe('Editorial Decision: Test Manuscript Title - Rejected');
      
      // Check rejection content
      expect(emailCall.html).toContain('Editorial Decision: Rejected');
      expect(emailCall.html).toContain('color: #dc2626'); // Red color for rejection
      expect(emailCall.html).not.toContain('Congratulations!');
      expect(emailCall.html).not.toContain('Next Steps');
    });

    it('should send minor revision email with correct content', async () => {
      const actions = [{
        type: 'MAKE_EDITORIAL_DECISION' as const,
        data: {
          decision: 'minor_revision',
          status: 'REVISION_REQUESTED',
          revisionType: 'MINOR'
        }
      }];

      const context = {
        manuscriptId: manuscript.id,
        userId: editor.id,
        conversationId: editorialConversation.id
      };

      await botActionProcessor.processActions(actions, context);

      expect(mockSendMail).toHaveBeenCalledTimes(1);
      
      const emailCall = mockSendMail.mock.calls[0][0];
      expect(emailCall.subject).toBe('Editorial Decision: Test Manuscript Title - Minor Revisions Required');
      
      // Check revision content
      expect(emailCall.html).toContain('Minor Revisions Required');
      expect(emailCall.html).toContain('color: #d97706'); // Orange color for revisions
      expect(emailCall.html).toContain('Next Steps');
      expect(emailCall.html).toContain('address the reviewer comments');
      expect(emailCall.html).toContain('submit a revised version');
    });

    it('should send major revision email with correct content', async () => {
      const actions = [{
        type: 'MAKE_EDITORIAL_DECISION' as const,
        data: {
          decision: 'major_revision',
          status: 'REVISION_REQUESTED',
          revisionType: 'MAJOR'
        }
      }];

      const context = {
        manuscriptId: manuscript.id,
        userId: editor.id,
        conversationId: editorialConversation.id
      };

      await botActionProcessor.processActions(actions, context);

      expect(mockSendMail).toHaveBeenCalledTimes(1);
      
      const emailCall = mockSendMail.mock.calls[0][0];
      expect(emailCall.subject).toBe('Editorial Decision: Test Manuscript Title - Major Revisions Required');
      expect(emailCall.html).toContain('Major Revisions Required');
    });

    it('should handle multiple authors correctly', async () => {
      // Add second author
      const secondAuthor = await createTestUser({ 
        role: 'USER', 
        email: 'second.author@test.com', 
        name: 'Second Author' 
      });
      
      await prisma.manuscript_authors.create({
        data: {
          id: randomUUID(),
          manuscriptId: manuscript.id,
          userId: secondAuthor.id,
          isCorresponding: false
        }
      });

      const actions = [{
        type: 'MAKE_EDITORIAL_DECISION' as const,
        data: {
          decision: 'accept',
          status: 'ACCEPTED'
        }
      }];

      const context = {
        manuscriptId: manuscript.id,
        userId: editor.id,
        conversationId: editorialConversation.id
      };

      await botActionProcessor.processActions(actions, context);

      // Should send email to both authors
      expect(mockSendMail).toHaveBeenCalledTimes(2);
      
      const emailCalls = mockSendMail.mock.calls;
      const recipients = emailCalls.map(call => call[0].to);
      expect(recipients).toContain('author@test.com');
      expect(recipients).toContain('second.author@test.com');
    });

    it('should handle email sending failures gracefully', async () => {
      // Mock email failure
      mockSendMail.mockRejectedValueOnce(new Error('SMTP connection failed'));

      const actions = [{
        type: 'MAKE_EDITORIAL_DECISION' as const,
        data: {
          decision: 'accept',
          status: 'ACCEPTED'
        }
      }];

      const context = {
        manuscriptId: manuscript.id,
        userId: editor.id,
        conversationId: editorialConversation.id
      };

      // Should not throw error
      await expect(botActionProcessor.processActions(actions, context)).resolves.not.toThrow();
      
      // Should still update manuscript status
      const updatedManuscript = await prisma.manuscripts.findUnique({
        where: { id: manuscript.id }
      });
      expect(updatedManuscript?.status).toBe('ACCEPTED');
    });
  });

  describe('Action Editor Assignment Emails', () => {
    it('should send action editor assignment email with correct content', async () => {
      const actions = [{
        type: 'ASSIGN_ACTION_EDITOR' as const,
        data: {
          editor: '@Test Editor',
          customMessage: 'Please take over this manuscript'
        }
      }];

      const context = {
        manuscriptId: manuscript.id,
        userId: editor.id,
        conversationId: editorialConversation.id
      };

      await botActionProcessor.processActions(actions, context);

      expect(mockSendMail).toHaveBeenCalledTimes(1);
      
      const emailCall = mockSendMail.mock.calls[0][0];
      expect(emailCall.to).toBe('editor@test.com');
      expect(emailCall.from).toBe('test@colloquium.example.com');
      expect(emailCall.subject).toBe('Action Editor Assignment: Test Manuscript Title');
      
      // Check email content
      expect(emailCall.html).toContain('Action Editor Assignment');
      expect(emailCall.html).toContain('Test Manuscript Title');
      expect(emailCall.html).toContain('Please take over this manuscript');
      expect(emailCall.html).toContain('View Manuscript');
      expect(emailCall.html).toContain(`/manuscripts/${manuscript.id}`);
      
      // Check text version
      expect(emailCall.text).toContain('Action Editor Assignment');
      expect(emailCall.text).toContain('Please take over this manuscript');
    });

    it('should send action editor assignment email without custom message', async () => {
      const actions = [{
        type: 'ASSIGN_ACTION_EDITOR' as const,
        data: {
          editor: '@Test Editor'
        }
      }];

      const context = {
        manuscriptId: manuscript.id,
        userId: editor.id,
        conversationId: editorialConversation.id
      };

      await botActionProcessor.processActions(actions, context);

      expect(mockSendMail).toHaveBeenCalledTimes(1);
      
      const emailCall = mockSendMail.mock.calls[0][0];
      expect(emailCall.html).not.toContain('Message from Assigning Editor');
      expect(emailCall.text).not.toContain('Message from Assigning Editor');
    });

    it('should handle email sending failures gracefully', async () => {
      // Mock email failure
      mockSendMail.mockRejectedValueOnce(new Error('SMTP connection failed'));

      const actions = [{
        type: 'ASSIGN_ACTION_EDITOR' as const,
        data: {
          editor: '@Test Editor'
        }
      }];

      const context = {
        manuscriptId: manuscript.id,
        userId: editor.id,
        conversationId: editorialConversation.id
      };

      // Should not throw error
      await expect(botActionProcessor.processActions(actions, context)).resolves.not.toThrow();
      
      // Should still create action editor assignment
      const assignment = await prisma.action_editors.findFirst({
        where: { manuscriptId: manuscript.id }
      });
      expect(assignment).toBeTruthy();
    });
  });

  describe('Email Configuration', () => {
    it('should use environment variables for email configuration', () => {
      expect(nodemailer.createTransport).toHaveBeenCalledWith({
        host: 'test-smtp.example.com',
        port: 587,
        secure: false,
        auth: undefined, // No auth configured in test
        tls: {
          rejectUnauthorized: false
        }
      });
    });

    it('should use default values when environment variables are not set', () => {
      // Clear environment variables
      delete process.env.SMTP_HOST;
      delete process.env.SMTP_PORT;
      delete process.env.FROM_EMAIL;
      delete process.env.FRONTEND_URL;
      
      // Create new instance to test defaults
      const newProcessor = new BotActionProcessor();
      
      // Check that default values are used in email content
      expect(nodemailer.createTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          host: 'localhost',
          port: 1025
        })
      );
    });
  });

  describe('Email Content Validation', () => {
    it('should include all required elements in review invitation emails', async () => {
      const actions = [{
        type: 'ASSIGN_REVIEWER' as const,
        data: {
          reviewers: ['reviewer@test.com'],
          deadline: new Date('2024-12-31'),
          customMessage: 'Test message'
        }
      }];

      const context = {
        manuscriptId: manuscript.id,
        userId: editor.id,
        conversationId: editorialConversation.id
      };

      await botActionProcessor.processActions(actions, context);

      const emailCall = mockSendMail.mock.calls[0][0];
      
      // Required elements
      expect(emailCall.html).toContain('Review Invitation');
      expect(emailCall.html).toContain(manuscript.title);
      expect(emailCall.html).toContain('Test message');
      expect(emailCall.html).toContain('December 31, 2024');
      expect(emailCall.html).toContain('Accept Review');
      expect(emailCall.html).toContain('Decline Review');
      expect(emailCall.html).toContain('Editorial Bot automation');
      
      // Should have both accept and decline URLs
      expect(emailCall.html).toMatch(/action=accept/);
      expect(emailCall.html).toMatch(/action=decline/);
    });

    it('should include all required elements in editorial decision emails', async () => {
      const actions = [{
        type: 'MAKE_EDITORIAL_DECISION' as const,
        data: {
          decision: 'accept',
          status: 'ACCEPTED'
        }
      }];

      const context = {
        manuscriptId: manuscript.id,
        userId: editor.id,
        conversationId: editorialConversation.id
      };

      await botActionProcessor.processActions(actions, context);

      const emailCall = mockSendMail.mock.calls[0][0];
      
      // Required elements
      expect(emailCall.html).toContain('Editorial Decision: Accepted');
      expect(emailCall.html).toContain(manuscript.title);
      expect(emailCall.html).toContain('Decision Date:');
      expect(emailCall.html).toContain('View Conversation');
      expect(emailCall.html).toContain('Editorial Bot automation');
      expect(emailCall.html).toContain(`/conversations/${editorialConversation.id}`);
    });

    it('should include all required elements in action editor assignment emails', async () => {
      const actions = [{
        type: 'ASSIGN_ACTION_EDITOR' as const,
        data: {
          editor: '@Test Editor',
          customMessage: 'Test assignment message'
        }
      }];

      const context = {
        manuscriptId: manuscript.id,
        userId: editor.id,
        conversationId: editorialConversation.id
      };

      await botActionProcessor.processActions(actions, context);

      const emailCall = mockSendMail.mock.calls[0][0];
      
      // Required elements
      expect(emailCall.html).toContain('Action Editor Assignment');
      expect(emailCall.html).toContain(manuscript.title);
      expect(emailCall.html).toContain('Test assignment message');
      expect(emailCall.html).toContain('Assignment Date:');
      expect(emailCall.html).toContain('View Manuscript');
      expect(emailCall.html).toContain('Editorial Bot automation');
      expect(emailCall.html).toContain(`/manuscripts/${manuscript.id}`);
    });
  });
});