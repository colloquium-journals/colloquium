import { BotActionProcessor } from '../../src/services/botActionProcessor';
import { BotAction } from '@colloquium/types';

// Mock the database module
jest.mock('@colloquium/database', () => ({
  prisma: {
    manuscripts: {
      findUnique: jest.fn(),
      update: jest.fn()
    },
    users: {
      findUnique: jest.fn(),
      create: jest.fn()
    },
    review_assignments: {
      findUnique: jest.fn(),
      create: jest.fn()
    },
    conversations: {
      create: jest.fn()
    },
    conversation_participants: {
      create: jest.fn()
    },
    messages: {
      create: jest.fn()
    }
  }
}));

// Mock nodemailer
jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({
    sendMail: jest.fn().mockResolvedValue({
      messageId: 'test-message-id'
    })
  }))
}));

describe('BotActionProcessor', () => {
  const { prisma } = require('@colloquium/database');
  let processor: BotActionProcessor;
  
  const mockContext = {
    manuscriptId: 'manuscript-123',
    userId: 'user-123',
    conversationId: 'conversation-123'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    processor = new BotActionProcessor();
  });

  describe('processActions', () => {
    it('should process multiple actions successfully', async () => {
      const actions: BotAction[] = [
        {
          type: 'UPDATE_MANUSCRIPT_STATUS',
          data: { status: 'UNDER_REVIEW', reason: 'Ready for review' }
        },
        {
          type: 'ASSIGN_REVIEWER',
          data: { 
            reviewers: ['reviewer@example.com'], 
            deadline: '2024-12-31',
            customMessage: 'Please review this manuscript' 
          }
        }
      ];

      // Mock manuscript
      const mockManuscript = {
        id: 'manuscript-123',
        title: 'Test Manuscript',
        status: 'SUBMITTED',
        authorRelations: []
      };
      
      prisma.manuscripts.findUnique.mockResolvedValue(mockManuscript);
      prisma.manuscripts.update.mockResolvedValue({ ...mockManuscript, status: 'UNDER_REVIEW' });
      
      // Mock reviewer
      const mockReviewer = {
        id: 'reviewer-123',
        email: 'reviewer@example.com',
        role: 'USER'
      };
      
      prisma.users.findUnique.mockResolvedValue(mockReviewer);
      prisma.review_assignments.findUnique.mockResolvedValue(null);
      prisma.review_assignments.create.mockResolvedValue({
        id: 'assignment-123',
        manuscriptId: mockContext.manuscriptId,
        reviewerId: mockReviewer.id,
        status: 'PENDING'
      });

      await processor.processActions(actions, mockContext);

      // Verify manuscript status was updated
      expect(prisma.manuscripts.update).toHaveBeenCalledWith({
        where: { id: mockContext.manuscriptId },
        data: {
          status: 'UNDER_REVIEW',
          updatedAt: expect.any(Date)
        },
        include: expect.any(Object)
      });

      // Verify review assignment was created
      expect(prisma.review_assignments.create).toHaveBeenCalledWith({
        data: {
          manuscriptId: mockContext.manuscriptId,
          reviewerId: mockReviewer.id,
          status: 'PENDING',
          dueDate: expect.any(Date)
        }
      });

      // Verify system message was created for status update
      expect(prisma.messages.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          content: expect.stringContaining('Manuscript Status Updated by Editorial Bot'),
          conversationId: mockContext.conversationId,
          authorId: mockContext.userId,
          privacy: 'EDITOR_ONLY',
          isBot: true,
          metadata: expect.objectContaining({
            botAction: 'UPDATE_MANUSCRIPT_STATUS',
            newStatus: 'UNDER_REVIEW',
            reason: 'Ready for review'
          })
        })
      });
    });

    it('should continue processing actions even if one fails', async () => {
      const actions: BotAction[] = [
        {
          type: 'UPDATE_MANUSCRIPT_STATUS',
          data: { status: 'INVALID_STATUS' } // This should fail
        },
        {
          type: 'ASSIGN_REVIEWER',
          data: { reviewers: ['reviewer@example.com'] }
        }
      ];

      // Mock for successful reviewer assignment
      const mockManuscript = {
        id: 'manuscript-123',
        title: 'Test Manuscript',
        authorRelations: []
      };
      
      const mockReviewer = {
        id: 'reviewer-123',
        email: 'reviewer@example.com'
      };

      prisma.manuscripts.findUnique.mockResolvedValue(mockManuscript);
      prisma.users.findUnique.mockResolvedValue(mockReviewer);
      prisma.review_assignments.findUnique.mockResolvedValue(null);
      prisma.review_assignments.create.mockResolvedValue({
        id: 'assignment-123'
      });

      // Should not throw error despite invalid status
      await expect(processor.processActions(actions, mockContext)).resolves.not.toThrow();

      // Should still process the second action
      expect(prisma.review_assignments.create).toHaveBeenCalled();
    });
  });

  describe('ASSIGN_REVIEWER action', () => {
    it('should create new user if reviewer does not exist', async () => {
      const action: BotAction = {
        type: 'ASSIGN_REVIEWER',
        data: { 
          reviewers: ['newreviewer@example.com'],
          deadline: '2024-12-31'
        }
      };

      const mockManuscript = {
        id: 'manuscript-123',
        title: 'Test Manuscript',
        authorRelations: []
      };

      prisma.manuscripts.findUnique.mockResolvedValue(mockManuscript);
      prisma.users.findUnique.mockResolvedValue(null); // User doesn't exist
      
      const newUser = {
        id: 'new-user-123',
        email: 'newreviewer@example.com',
        role: 'USER'
      };
      
      prisma.users.create.mockResolvedValue(newUser);
      prisma.review_assignments.findUnique.mockResolvedValue(null);
      prisma.review_assignments.create.mockResolvedValue({
        id: 'assignment-123'
      });

      await processor.processActions([action], mockContext);

      // Should create new user
      expect(prisma.users.create).toHaveBeenCalledWith({
        data: {
          email: 'newreviewer@example.com',
          role: 'USER'
        }
      });

      // Should create assignment with new user
      expect(prisma.review_assignments.create).toHaveBeenCalledWith({
        data: {
          manuscriptId: mockContext.manuscriptId,
          reviewerId: newUser.id,
          status: 'PENDING',
          dueDate: expect.any(Date)
        }
      });
    });

    it('should skip if reviewer is already assigned', async () => {
      const action: BotAction = {
        type: 'ASSIGN_REVIEWER',
        data: { reviewers: ['existing@example.com'] }
      };

      const mockManuscript = {
        id: 'manuscript-123',
        title: 'Test Manuscript',
        authorRelations: []
      };

      const mockReviewer = {
        id: 'reviewer-123',
        email: 'existing@example.com'
      };

      const existingAssignment = {
        id: 'assignment-123',
        status: 'PENDING'
      };

      prisma.manuscripts.findUnique.mockResolvedValue(mockManuscript);
      prisma.users.findUnique.mockResolvedValue(mockReviewer);
      prisma.review_assignments.findUnique.mockResolvedValue(existingAssignment);

      await processor.processActions([action], mockContext);

      // Should not create new assignment
      expect(prisma.review_assignments.create).not.toHaveBeenCalled();
    });
  });

  describe('UPDATE_MANUSCRIPT_STATUS action', () => {
    it('should update manuscript status and create system message', async () => {
      const action: BotAction = {
        type: 'UPDATE_MANUSCRIPT_STATUS',
        data: { 
          status: 'ACCEPTED', 
          reason: 'High quality research' 
        }
      };

      const mockManuscript = {
        id: 'manuscript-123',
        status: 'UNDER_REVIEW',
        authorRelations: []
      };

      prisma.manuscripts.findUnique.mockResolvedValue({ status: 'UNDER_REVIEW' });
      prisma.manuscripts.update.mockResolvedValue({
        ...mockManuscript,
        status: 'ACCEPTED'
      });

      await processor.processActions([action], mockContext);

      expect(prisma.manuscripts.update).toHaveBeenCalledWith({
        where: { id: mockContext.manuscriptId },
        data: {
          status: 'ACCEPTED',
          updatedAt: expect.any(Date)
        },
        include: { authorRelations: { include: { user: true } } }
      });

      expect(prisma.messages.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          content: expect.stringMatching(/ACCEPTED.*High quality research/s),
          privacy: 'EDITOR_ONLY',
          isBot: true
        })
      });
    });

    it('should allow publishing from ACCEPTED status', async () => {
      const action: BotAction = {
        type: 'UPDATE_MANUSCRIPT_STATUS',
        data: { 
          status: 'PUBLISHED', 
          reason: 'Ready for publication' 
        }
      };

      const mockManuscript = {
        id: 'manuscript-123',
        status: 'ACCEPTED',
        authorRelations: []
      };

      prisma.manuscripts.findUnique.mockResolvedValue({ status: 'ACCEPTED' });
      prisma.manuscripts.update.mockResolvedValue({
        ...mockManuscript,
        status: 'PUBLISHED'
      });

      await processor.processActions([action], mockContext);

      expect(prisma.manuscripts.update).toHaveBeenCalledWith({
        where: { id: mockContext.manuscriptId },
        data: {
          status: 'PUBLISHED',
          updatedAt: expect.any(Date)
        },
        include: { authorRelations: { include: { user: true } } }
      });
    });

    it('should reject publishing from non-ACCEPTED status', async () => {
      const action: BotAction = {
        type: 'UPDATE_MANUSCRIPT_STATUS',
        data: { status: 'PUBLISHED' }
      };

      prisma.manuscripts.findUnique.mockResolvedValue({ status: 'UNDER_REVIEW' });

      await expect(processor.processActions([action], mockContext)).resolves.not.toThrow();
      
      // Should not update manuscript due to validation error
      expect(prisma.manuscripts.update).not.toHaveBeenCalled();
    });

    it('should allow REJECTED status from any state', async () => {
      const action: BotAction = {
        type: 'UPDATE_MANUSCRIPT_STATUS',
        data: { 
          status: 'REJECTED', 
          reason: 'Insufficient methodology' 
        }
      };

      prisma.manuscripts.findUnique.mockResolvedValue({ status: 'UNDER_REVIEW' });
      prisma.manuscripts.update.mockResolvedValue({
        id: 'manuscript-123',
        status: 'REJECTED',
        authorRelations: []
      });

      await processor.processActions([action], mockContext);

      expect(prisma.manuscripts.update).toHaveBeenCalledWith({
        where: { id: mockContext.manuscriptId },
        data: {
          status: 'REJECTED',
          updatedAt: expect.any(Date)
        },
        include: { authorRelations: { include: { user: true } } }
      });
    });

    it('should allow retracting from PUBLISHED status', async () => {
      const action: BotAction = {
        type: 'UPDATE_MANUSCRIPT_STATUS',
        data: { 
          status: 'RETRACTED', 
          reason: 'Data integrity issues' 
        }
      };

      prisma.manuscripts.findUnique.mockResolvedValue({ status: 'PUBLISHED' });
      prisma.manuscripts.update.mockResolvedValue({
        id: 'manuscript-123',
        status: 'RETRACTED',
        authorRelations: []
      });

      await processor.processActions([action], mockContext);

      expect(prisma.manuscripts.update).toHaveBeenCalledWith({
        where: { id: mockContext.manuscriptId },
        data: {
          status: 'RETRACTED',
          updatedAt: expect.any(Date)
        },
        include: { authorRelations: { include: { user: true } } }
      });
    });

    it('should reject retracting from non-PUBLISHED status', async () => {
      const action: BotAction = {
        type: 'UPDATE_MANUSCRIPT_STATUS',
        data: { status: 'RETRACTED' }
      };

      prisma.manuscripts.findUnique.mockResolvedValue({ status: 'ACCEPTED' });

      await expect(processor.processActions([action], mockContext)).resolves.not.toThrow();
      
      // Should not update manuscript due to validation error
      expect(prisma.manuscripts.update).not.toHaveBeenCalled();
    });

    it('should reject invalid status', async () => {
      const action: BotAction = {
        type: 'UPDATE_MANUSCRIPT_STATUS',
        data: { status: 'INVALID_STATUS' }
      };

      await expect(processor.processActions([action], mockContext)).resolves.not.toThrow();
      
      // Should not update manuscript
      expect(prisma.manuscripts.update).not.toHaveBeenCalled();
    });
  });

  describe('CREATE_CONVERSATION action', () => {
    it('should create conversation with participants', async () => {
      const action: BotAction = {
        type: 'CREATE_CONVERSATION',
        data: {
          title: 'Editorial Discussion',
          type: 'EDITORIAL',
          privacy: 'PRIVATE',
          participantIds: ['participant-1', 'participant-2']
        }
      };

      const newConversation = {
        id: 'conversation-456',
        title: 'Editorial Discussion'
      };

      prisma.conversations.create.mockResolvedValue(newConversation);

      await processor.processActions([action], mockContext);

      expect(prisma.conversations.create).toHaveBeenCalledWith({
        data: {
          title: 'Editorial Discussion',
          type: 'EDITORIAL',
          privacy: 'PRIVATE',
          manuscriptId: mockContext.manuscriptId
        }
      });

      // Should add the command user and specified participants
      expect(prisma.conversation_participants.create).toHaveBeenCalledTimes(3);
      expect(prisma.conversation_participants.create).toHaveBeenCalledWith({
        data: {
          conversationId: newConversation.id,
          userId: mockContext.userId,
          role: 'MODERATOR'
        }
      });
    });
  });
});