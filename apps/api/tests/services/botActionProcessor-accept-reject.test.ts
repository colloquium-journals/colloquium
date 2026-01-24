import { BotActionProcessor } from '../../src/services/botActionProcessor';
import { prisma } from '@colloquium/database';

// Test utilities
const createTestUser = async (userData: any = {}) => {
  const { randomUUID } = require('crypto');
  return await prisma.users.create({
    data: {
      email: userData.email || 'test@example.com',
      username: userData.username || `test-user-${randomUUID().slice(0, 8)}`,
      name: userData.name || 'Test User',
      role: userData.role || 'USER',
      ...userData
    }
  });
};

const createTestManuscript = async (authorId: string) => {
  const manuscript = await prisma.manuscripts.create({
    data: {
      title: 'Test Manuscript',
      abstract: 'Test abstract for manuscript',
      content: 'Test content',
      status: 'SUBMITTED'
    }
  });

  await prisma.manuscriptAuthor.create({
    data: {
      manuscriptId: manuscript.id,
      userId: authorId,
      isCorresponding: true
    }
  });

  return manuscript;
};

jest.mock('nodemailer', () => ({
  createTransporter: jest.fn(() => ({
    sendMail: jest.fn().mockResolvedValue({ messageId: 'test-message-id' })
  }))
}));

describe('BotActionProcessor - Accept/Reject Actions', () => {
  let botActionProcessor: BotActionProcessor;
  let reviewer: any;
  let manuscript: any;
  let reviewAssignment: any;
  let editorialConversation: any;
  let reviewConversation: any;

  beforeEach(async () => {
    botActionProcessor = new BotActionProcessor();
    
    // Create test data
    reviewer = await createTestUser({ role: 'USER', email: 'reviewer@test.com' });
    const author = await createTestUser({ role: 'USER', email: 'author@test.com' });
    manuscript = await createTestManuscript(author.id);
    
    reviewAssignment = await prisma.review_assignments.create({
      data: {
        manuscriptId: manuscript.id,
        reviewerId: reviewer.id,
        status: 'PENDING',
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      }
    });

    editorialConversation = await prisma.conversations.create({
      data: {
        title: 'Editorial Discussion',
        type: 'EDITORIAL',
        privacy: 'PRIVATE',
        manuscriptId: manuscript.id
      }
    });

    reviewConversation = await prisma.conversations.create({
      data: {
        title: 'Review Discussion',
        type: 'REVIEW',
        privacy: 'SEMI_PUBLIC',
        manuscriptId: manuscript.id
      }
    });
  });

  afterEach(async () => {
    await prisma.messages.deleteMany();
    await prisma.conversation_participants.deleteMany();
    await prisma.conversations.deleteMany();
    await prisma.review_assignments.deleteMany();
    await prisma.manuscriptAuthor.deleteMany();
    await prisma.manuscripts.deleteMany();
    await prisma.users.deleteMany();
  });

  describe('handleRespondToReview', () => {
    it('should process ACCEPT response correctly', async () => {
      const actions = [{
        type: 'RESPOND_TO_REVIEW' as const,
        data: {
          assignmentId: reviewAssignment.id,
          response: 'ACCEPT',
          message: 'Happy to review this work'
        }
      }];

      const context = {
        manuscriptId: manuscript.id,
        userId: reviewer.id,
        conversationId: editorialConversation.id
      };

      await botActionProcessor.processActions(actions, context);

      // Verify assignment status was updated
      const updatedAssignment = await prisma.review_assignments.findUnique({
        where: { id: reviewAssignment.id }
      });
      expect(updatedAssignment?.status).toBe('ACCEPTED');

      // Verify notification message was created
      const messages = await prisma.messages.findMany({
        where: {
          conversationId: editorialConversation.id,
          isBot: true
        }
      });
      expect(messages).toHaveLength(1);
      expect(messages[0].content).toContain('Review Invitation Accepted via Bot');
      expect(messages[0].content).toContain('Happy to review this work');
      expect(messages[0].privacy).toBe('EDITOR_ONLY');
    });

    it('should process DECLINE response correctly', async () => {
      const actions = [{
        type: 'RESPOND_TO_REVIEW' as const,
        data: {
          assignmentId: reviewAssignment.id,
          response: 'DECLINE',
          message: 'I have a conflict of interest'
        }
      }];

      const context = {
        manuscriptId: manuscript.id,
        userId: reviewer.id,
        conversationId: editorialConversation.id
      };

      await botActionProcessor.processActions(actions, context);

      // Verify assignment status was updated
      const updatedAssignment = await prisma.review_assignments.findUnique({
        where: { id: reviewAssignment.id }
      });
      expect(updatedAssignment?.status).toBe('DECLINED');

      // Verify notification message was created
      const messages = await prisma.messages.findMany({
        where: {
          conversationId: editorialConversation.id,
          isBot: true
        }
      });
      expect(messages).toHaveLength(1);
      expect(messages[0].content).toContain('Review Invitation Declined via Bot');
      expect(messages[0].content).toContain('I have a conflict of interest');
    });

    it('should handle non-existent assignment', async () => {
      const actions = [{
        type: 'RESPOND_TO_REVIEW' as const,
        data: {
          assignmentId: '123e4567-e89b-12d3-a456-426614174000',
          response: 'ACCEPT'
        }
      }];

      const context = {
        manuscriptId: manuscript.id,
        userId: reviewer.id,
        conversationId: editorialConversation.id
      };

      // Should not throw but should log error
      await expect(botActionProcessor.processActions(actions, context)).resolves.not.toThrow();
    });

    it('should handle wrong user responding', async () => {
      const otherUser = await createTestUser({ role: 'USER', email: 'other@test.com' });
      
      const actions = [{
        type: 'RESPOND_TO_REVIEW' as const,
        data: {
          assignmentId: reviewAssignment.id,
          response: 'ACCEPT'
        }
      }];

      const context = {
        manuscriptId: manuscript.id,
        userId: otherUser.id,
        conversationId: editorialConversation.id
      };

      // Should not throw but should log error
      await expect(botActionProcessor.processActions(actions, context)).resolves.not.toThrow();
      
      // Assignment should not be updated
      const assignment = await prisma.review_assignments.findUnique({
        where: { id: reviewAssignment.id }
      });
      expect(assignment?.status).toBe('PENDING');
    });

    it('should handle already responded assignment', async () => {
      // Accept first
      await prisma.review_assignments.update({
        where: { id: reviewAssignment.id },
        data: { status: 'ACCEPTED' }
      });

      const actions = [{
        type: 'RESPOND_TO_REVIEW' as const,
        data: {
          assignmentId: reviewAssignment.id,
          response: 'DECLINE'
        }
      }];

      const context = {
        manuscriptId: manuscript.id,
        userId: reviewer.id,
        conversationId: editorialConversation.id
      };

      // Should not throw but should log error
      await expect(botActionProcessor.processActions(actions, context)).resolves.not.toThrow();
      
      // Assignment should remain ACCEPTED
      const assignment = await prisma.review_assignments.findUnique({
        where: { id: reviewAssignment.id }
      });
      expect(assignment?.status).toBe('ACCEPTED');
    });
  });

  describe('handleSubmitReview', () => {
    beforeEach(async () => {
      // Accept the review assignment first
      await prisma.review_assignments.update({
        where: { id: reviewAssignment.id },
        data: { status: 'ACCEPTED' }
      });
    });

    it('should process review submission correctly', async () => {
      const actions = [{
        type: 'SUBMIT_REVIEW' as const,
        data: {
          assignmentId: reviewAssignment.id,
          reviewContent: 'This manuscript presents solid research with clear methodology.',
          recommendation: 'MINOR_REVISION',
          score: 8,
          confidentialComments: 'The conclusion could be strengthened.'
        }
      }];

      const context = {
        manuscriptId: manuscript.id,
        userId: reviewer.id,
        conversationId: reviewConversation.id
      };

      await botActionProcessor.processActions(actions, context);

      // Verify assignment was marked as completed
      const updatedAssignment = await prisma.review_assignments.findUnique({
        where: { id: reviewAssignment.id }
      });
      expect(updatedAssignment?.status).toBe('COMPLETED');
      expect(updatedAssignment?.completedAt).toBeTruthy();

      // Verify review message was created
      const reviewMessages = await prisma.messages.findMany({
        where: {
          conversationId: reviewConversation.id,
          privacy: 'AUTHOR_VISIBLE',
          isBot: true
        }
      });
      expect(reviewMessages).toHaveLength(1);
      expect(reviewMessages[0].content).toContain('Review Submitted via Bot');
      expect(reviewMessages[0].content).toContain('MINOR_REVISION');
      expect(reviewMessages[0].content).toContain('This manuscript presents solid research');
      expect(reviewMessages[0].content).toContain('8/10');

      // Verify confidential comments were created separately
      const confidentialMessages = await prisma.messages.findMany({
        where: {
          conversationId: reviewConversation.id,
          privacy: 'EDITOR_ONLY',
          isBot: true
        }
      });
      expect(confidentialMessages).toHaveLength(1);
      expect(confidentialMessages[0].content).toContain('Confidential Comments (via Bot)');
      expect(confidentialMessages[0].content).toContain('The conclusion could be strengthened.');
    });

    it('should handle submission without confidential comments', async () => {
      const actions = [{
        type: 'SUBMIT_REVIEW' as const,
        data: {
          assignmentId: reviewAssignment.id,
          reviewContent: 'Well-written manuscript with clear findings.',
          recommendation: 'ACCEPT'
        }
      }];

      const context = {
        manuscriptId: manuscript.id,
        userId: reviewer.id,
        conversationId: reviewConversation.id
      };

      await botActionProcessor.processActions(actions, context);

      // Verify only one message was created (no confidential comments)
      const messages = await prisma.messages.findMany({
        where: {
          conversationId: reviewConversation.id,
          isBot: true
        }
      });
      expect(messages).toHaveLength(1);
      expect(messages[0].privacy).toBe('AUTHOR_VISIBLE');
    });

    it('should handle submission without score', async () => {
      const actions = [{
        type: 'SUBMIT_REVIEW' as const,
        data: {
          assignmentId: reviewAssignment.id,
          reviewContent: 'Comprehensive review of the methodology.',
          recommendation: 'MAJOR_REVISION'
        }
      }];

      const context = {
        manuscriptId: manuscript.id,
        userId: reviewer.id,
        conversationId: reviewConversation.id
      };

      await botActionProcessor.processActions(actions, context);

      const messages = await prisma.messages.findMany({
        where: {
          conversationId: reviewConversation.id,
          privacy: 'AUTHOR_VISIBLE',
          isBot: true
        }
      });
      expect(messages[0].content).not.toContain('/10');
    });

    it('should handle wrong assignment status', async () => {
      // Set assignment back to PENDING
      await prisma.review_assignments.update({
        where: { id: reviewAssignment.id },
        data: { status: 'PENDING' }
      });

      const actions = [{
        type: 'SUBMIT_REVIEW' as const,
        data: {
          assignmentId: reviewAssignment.id,
          reviewContent: 'Test review',
          recommendation: 'ACCEPT'
        }
      }];

      const context = {
        manuscriptId: manuscript.id,
        userId: reviewer.id,
        conversationId: reviewConversation.id
      };

      // Should not throw but should log error
      await expect(botActionProcessor.processActions(actions, context)).resolves.not.toThrow();
      
      // Assignment should not be updated to COMPLETED
      const assignment = await prisma.review_assignments.findUnique({
        where: { id: reviewAssignment.id }
      });
      expect(assignment?.status).toBe('PENDING');
    });

    it('should handle wrong user submitting', async () => {
      const otherUser = await createTestUser({ role: 'USER', email: 'other2@test.com' });
      
      const actions = [{
        type: 'SUBMIT_REVIEW' as const,
        data: {
          assignmentId: reviewAssignment.id,
          reviewContent: 'Test review',
          recommendation: 'ACCEPT'
        }
      }];

      const context = {
        manuscriptId: manuscript.id,
        userId: otherUser.id,
        conversationId: reviewConversation.id
      };

      // Should not throw but should log error
      await expect(botActionProcessor.processActions(actions, context)).resolves.not.toThrow();
      
      // Assignment should not be updated
      const assignment = await prisma.review_assignments.findUnique({
        where: { id: reviewAssignment.id }
      });
      expect(assignment?.status).toBe('ACCEPTED');
    });

    it('should handle non-existent assignment', async () => {
      const actions = [{
        type: 'SUBMIT_REVIEW' as const,
        data: {
          assignmentId: '123e4567-e89b-12d3-a456-426614174000',
          reviewContent: 'Test review',
          recommendation: 'ACCEPT'
        }
      }];

      const context = {
        manuscriptId: manuscript.id,
        userId: reviewer.id,
        conversationId: reviewConversation.id
      };

      // Should not throw but should log error
      await expect(botActionProcessor.processActions(actions, context)).resolves.not.toThrow();
    });
  });
});