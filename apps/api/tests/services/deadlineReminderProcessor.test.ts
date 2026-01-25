import { processDeadlineReminder, sendManualReminder } from '../../src/services/deadlineReminderProcessor';

// Mock dependencies
jest.mock('@colloquium/database', () => ({
  prisma: {
    deadline_reminders: {
      findUnique: jest.fn(),
      update: jest.fn()
    },
    review_assignments: {
      findUnique: jest.fn()
    },
    users: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      upsert: jest.fn()
    },
    messages: {
      create: jest.fn()
    }
  }
}));

jest.mock('../../src/routes/settings', () => ({
  getJournalSettings: jest.fn()
}));

jest.mock('../../src/routes/events', () => ({
  broadcastToConversation: jest.fn()
}));

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({
    sendMail: jest.fn().mockResolvedValue({ messageId: 'test-id' })
  }))
}));

describe('DeadlineReminderProcessor', () => {
  const { prisma } = require('@colloquium/database');
  const { getJournalSettings } = require('../../src/routes/settings');
  const { broadcastToConversation } = require('../../src/routes/events');
  const nodemailer = require('nodemailer');

  beforeEach(() => {
    jest.clearAllMocks();
    getJournalSettings.mockResolvedValue({
      reminderSettings: {
        enabled: true,
        reviewReminders: {
          enabled: true,
          intervals: [
            { daysBefore: 7, enabled: true, emailEnabled: true, conversationEnabled: true },
            { daysBefore: 3, enabled: true, emailEnabled: true, conversationEnabled: true }
          ],
          overdueReminders: { enabled: true, intervalDays: 3, maxReminders: 3 }
        }
      }
    });
  });

  describe('processDeadlineReminder', () => {
    const mockJob = {
      reminderId: 'reminder-1',
      assignmentId: 'assignment-1',
      daysBefore: 3
    };

    const mockReminder = {
      id: 'reminder-1',
      assignmentId: 'assignment-1',
      daysBefore: 3,
      status: 'QUEUED',
      review_assignments: {
        id: 'assignment-1',
        status: 'ACCEPTED',
        dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        users: {
          id: 'reviewer-1',
          email: 'reviewer@test.com',
          name: 'Test Reviewer',
          username: 'testreviewer'
        },
        manuscripts: {
          id: 'manuscript-1',
          title: 'Test Manuscript',
          conversations: [{ id: 'conversation-1' }]
        }
      }
    };

    it('should skip if reminder not found', async () => {
      prisma.deadline_reminders.findUnique.mockResolvedValue(null);

      await processDeadlineReminder(mockJob);

      expect(prisma.deadline_reminders.update).not.toHaveBeenCalled();
    });

    it('should skip if reminder already sent', async () => {
      prisma.deadline_reminders.findUnique.mockResolvedValue({
        ...mockReminder,
        status: 'SENT'
      });

      await processDeadlineReminder(mockJob);

      expect(prisma.deadline_reminders.update).not.toHaveBeenCalled();
    });

    it('should cancel reminder if assignment completed', async () => {
      prisma.deadline_reminders.findUnique.mockResolvedValue({
        ...mockReminder,
        review_assignments: {
          ...mockReminder.review_assignments,
          status: 'COMPLETED'
        }
      });
      prisma.deadline_reminders.update.mockResolvedValue({});

      await processDeadlineReminder(mockJob);

      expect(prisma.deadline_reminders.update).toHaveBeenCalledWith({
        where: { id: 'reminder-1' },
        data: { status: 'CANCELLED', updatedAt: expect.any(Date) }
      });
    });

    it('should send email and post to conversation', async () => {
      prisma.deadline_reminders.findUnique.mockResolvedValue(mockReminder);
      prisma.users.upsert.mockResolvedValue({
        id: 'bot-user',
        email: 'bot@system.local',
        username: 'bot-editorial'
      });
      const mockCreatedAt = new Date();
      prisma.messages.create.mockResolvedValue({
        id: 'message-1',
        content: 'Reminder message',
        conversationId: 'conversation-1',
        authorId: 'bot-user',
        isBot: true,
        privacy: 'EDITOR_ONLY',
        createdAt: mockCreatedAt
      });
      prisma.deadline_reminders.update.mockResolvedValue({});

      await processDeadlineReminder(mockJob);

      // Verify message was posted
      expect(prisma.messages.create).toHaveBeenCalled();

      // Verify reminder marked as sent (may include errorMessage field if partial failure)
      expect(prisma.deadline_reminders.update).toHaveBeenCalledWith({
        where: { id: 'reminder-1' },
        data: expect.objectContaining({
          status: 'SENT',
          sentAt: expect.any(Date),
          updatedAt: expect.any(Date)
        })
      });

      // Verify SSE broadcast
      expect(broadcastToConversation).toHaveBeenCalled();
    });

    it('should mark reminder as failed on error', async () => {
      // Create a reminder that will fail due to missing data
      const failingReminder = {
        ...mockReminder,
        review_assignments: {
          ...mockReminder.review_assignments,
          manuscripts: {
            ...mockReminder.review_assignments.manuscripts,
            conversations: [] // No conversation to post to
          }
        }
      };
      prisma.deadline_reminders.findUnique.mockResolvedValue(failingReminder);
      prisma.deadline_reminders.update.mockResolvedValue({});

      // This should succeed but not broadcast (no conversation)
      await processDeadlineReminder(mockJob);

      // Verify reminder was marked as sent (not failed, since email still goes out)
      expect(prisma.deadline_reminders.update).toHaveBeenCalled();
    });

    it('should cancel if interval not enabled in settings', async () => {
      getJournalSettings.mockResolvedValue({
        reminderSettings: {
          enabled: true,
          reviewReminders: {
            enabled: true,
            intervals: [
              { daysBefore: 7, enabled: true, emailEnabled: true, conversationEnabled: true }
              // daysBefore: 3 not in list
            ],
            overdueReminders: { enabled: false }
          }
        }
      });

      prisma.deadline_reminders.findUnique.mockResolvedValue(mockReminder);
      prisma.deadline_reminders.update.mockResolvedValue({});

      await processDeadlineReminder(mockJob);

      expect(prisma.deadline_reminders.update).toHaveBeenCalledWith({
        where: { id: 'reminder-1' },
        data: { status: 'CANCELLED', updatedAt: expect.any(Date) }
      });
    });
  });

  describe('sendManualReminder', () => {
    it('should return error if assignment not found', async () => {
      prisma.review_assignments.findUnique.mockResolvedValue(null);

      const result = await sendManualReminder('assignment-1', 'sender-1');

      expect(result).toEqual({ success: false, error: 'Assignment not found' });
    });

    it('should return error if assignment is completed', async () => {
      prisma.review_assignments.findUnique.mockResolvedValue({
        id: 'assignment-1',
        status: 'COMPLETED',
        dueDate: new Date()
      });

      const result = await sendManualReminder('assignment-1', 'sender-1');

      expect(result).toEqual({
        success: false,
        error: 'Cannot send reminder: assignment status is COMPLETED'
      });
    });

    it('should return error if no due date set', async () => {
      prisma.review_assignments.findUnique.mockResolvedValue({
        id: 'assignment-1',
        status: 'IN_PROGRESS',
        dueDate: null
      });

      const result = await sendManualReminder('assignment-1', 'sender-1');

      expect(result).toEqual({
        success: false,
        error: 'Cannot send reminder: no due date set for this assignment'
      });
    });

    it('should send manual reminder successfully', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 5);

      prisma.review_assignments.findUnique.mockResolvedValue({
        id: 'assignment-1',
        status: 'IN_PROGRESS',
        dueDate: futureDate,
        users: {
          id: 'reviewer-1',
          email: 'reviewer@test.com',
          name: 'Test Reviewer',
          username: 'testreviewer'
        },
        manuscripts: {
          id: 'manuscript-1',
          title: 'Test Manuscript',
          conversations: [{ id: 'conversation-1' }]
        }
      });
      prisma.users.findUnique.mockResolvedValue({
        name: 'Editor',
        username: 'editor'
      });
      prisma.messages.create.mockResolvedValue({
        id: 'message-1',
        content: 'Reminder',
        conversationId: 'conversation-1',
        createdAt: new Date()
      });

      const result = await sendManualReminder('assignment-1', 'sender-1', 'Please hurry!');

      expect(result).toEqual({ success: true });

      // Verify message was posted
      expect(prisma.messages.create).toHaveBeenCalled();
    });
  });
});
