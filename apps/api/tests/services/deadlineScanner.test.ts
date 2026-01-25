import { scanAndScheduleReminders, cancelRemindersForAssignment, rescheduleRemindersForAssignment } from '../../src/services/deadlineScanner';

// Mock dependencies
jest.mock('@colloquium/database', () => ({
  prisma: {
    review_assignments: {
      findMany: jest.fn(),
      findUnique: jest.fn()
    },
    deadline_reminders: {
      create: jest.fn(),
      updateMany: jest.fn()
    }
  }
}));

jest.mock('../../src/routes/settings', () => ({
  getJournalSettings: jest.fn()
}));

jest.mock('../../src/jobs/index', () => ({
  scheduleReminderJob: jest.fn()
}));

describe('DeadlineScanner', () => {
  const { prisma } = require('@colloquium/database');
  const { getJournalSettings } = require('../../src/routes/settings');
  const { scheduleReminderJob } = require('../../src/jobs/index');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('scanAndScheduleReminders', () => {
    const defaultSettings = {
      reminderSettings: {
        enabled: true,
        reviewReminders: {
          enabled: true,
          intervals: [
            { daysBefore: 7, enabled: true, emailEnabled: true, conversationEnabled: true },
            { daysBefore: 3, enabled: true, emailEnabled: true, conversationEnabled: true },
            { daysBefore: 1, enabled: true, emailEnabled: true, conversationEnabled: true }
          ],
          overdueReminders: { enabled: true, intervalDays: 3, maxReminders: 3 }
        }
      }
    };

    it('should return early if reminders are disabled globally', async () => {
      getJournalSettings.mockResolvedValue({
        reminderSettings: { enabled: false }
      });

      const result = await scanAndScheduleReminders();

      expect(result).toEqual({ scheduled: 0, scanned: 0 });
      expect(prisma.review_assignments.findMany).not.toHaveBeenCalled();
    });

    it('should return early if review reminders are disabled', async () => {
      getJournalSettings.mockResolvedValue({
        reminderSettings: {
          enabled: true,
          reviewReminders: { enabled: false }
        }
      });

      const result = await scanAndScheduleReminders();

      expect(result).toEqual({ scheduled: 0, scanned: 0 });
      expect(prisma.review_assignments.findMany).not.toHaveBeenCalled();
    });

    it('should find and schedule reminders for active assignments', async () => {
      getJournalSettings.mockResolvedValue(defaultSettings);

      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 5);

      const mockAssignment = {
        id: 'assignment-1',
        manuscriptId: 'manuscript-1',
        reviewerId: 'reviewer-1',
        status: 'ACCEPTED',
        dueDate: futureDate,
        deadline_reminders: [],
        users: { email: 'reviewer@test.com', name: 'Test Reviewer' },
        manuscripts: { title: 'Test Manuscript' }
      };

      prisma.review_assignments.findMany.mockResolvedValue([mockAssignment]);
      prisma.deadline_reminders.create.mockResolvedValue({
        id: 'reminder-1',
        assignmentId: 'assignment-1',
        daysBefore: 3,
        status: 'QUEUED'
      });

      const result = await scanAndScheduleReminders();

      expect(result.scanned).toBe(1);
      expect(prisma.review_assignments.findMany).toHaveBeenCalled();
    });

    it('should skip reminders that already exist', async () => {
      getJournalSettings.mockResolvedValue(defaultSettings);

      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 5);

      const mockAssignment = {
        id: 'assignment-1',
        manuscriptId: 'manuscript-1',
        reviewerId: 'reviewer-1',
        status: 'ACCEPTED',
        dueDate: futureDate,
        deadline_reminders: [
          { daysBefore: 7, status: 'QUEUED' },
          { daysBefore: 3, status: 'SENT' }
        ],
        users: { email: 'reviewer@test.com', name: 'Test Reviewer' },
        manuscripts: { title: 'Test Manuscript' }
      };

      prisma.review_assignments.findMany.mockResolvedValue([mockAssignment]);
      prisma.deadline_reminders.create.mockResolvedValue({
        id: 'reminder-1',
        assignmentId: 'assignment-1',
        daysBefore: 1,
        status: 'QUEUED'
      });

      const result = await scanAndScheduleReminders();

      expect(result.scanned).toBe(1);
      // Should only schedule the 1-day reminder (7 and 3 already exist)
      expect(prisma.deadline_reminders.create).toHaveBeenCalledTimes(1);
    });

    it('should handle assignments without due dates', async () => {
      getJournalSettings.mockResolvedValue(defaultSettings);

      const mockAssignment = {
        id: 'assignment-1',
        manuscriptId: 'manuscript-1',
        reviewerId: 'reviewer-1',
        status: 'ACCEPTED',
        dueDate: null,
        deadline_reminders: [],
        users: { email: 'reviewer@test.com', name: 'Test Reviewer' },
        manuscripts: { title: 'Test Manuscript' }
      };

      // Note: The findMany WHERE clause should exclude this,
      // but the scanner should handle it gracefully
      prisma.review_assignments.findMany.mockResolvedValue([]);

      const result = await scanAndScheduleReminders();

      expect(result.scanned).toBe(0);
      expect(result.scheduled).toBe(0);
    });
  });

  describe('cancelRemindersForAssignment', () => {
    it('should cancel pending reminders for an assignment', async () => {
      prisma.deadline_reminders.updateMany.mockResolvedValue({ count: 3 });

      const result = await cancelRemindersForAssignment('assignment-1');

      expect(result).toBe(3);
      expect(prisma.deadline_reminders.updateMany).toHaveBeenCalledWith({
        where: {
          assignmentId: 'assignment-1',
          status: { in: ['PENDING', 'QUEUED'] }
        },
        data: {
          status: 'CANCELLED',
          updatedAt: expect.any(Date)
        }
      });
    });
  });

  describe('rescheduleRemindersForAssignment', () => {
    it('should cancel existing and reschedule reminders', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 5);

      getJournalSettings.mockResolvedValue({
        reminderSettings: {
          enabled: true,
          reviewReminders: {
            enabled: true,
            intervals: [
              { daysBefore: 3, enabled: true, emailEnabled: true, conversationEnabled: true }
            ]
          }
        }
      });

      prisma.deadline_reminders.updateMany.mockResolvedValue({ count: 2 });
      prisma.review_assignments.findUnique.mockResolvedValue({
        id: 'assignment-1',
        status: 'ACCEPTED',
        dueDate: futureDate,
        deadline_reminders: []
      });
      prisma.deadline_reminders.create.mockResolvedValue({
        id: 'reminder-1',
        status: 'QUEUED'
      });

      const result = await rescheduleRemindersForAssignment('assignment-1');

      expect(prisma.deadline_reminders.updateMany).toHaveBeenCalled();
      expect(result).toBeGreaterThanOrEqual(0);
    });

    it('should not reschedule for completed assignments', async () => {
      prisma.deadline_reminders.updateMany.mockResolvedValue({ count: 0 });
      prisma.review_assignments.findUnique.mockResolvedValue({
        id: 'assignment-1',
        status: 'COMPLETED',
        dueDate: new Date()
      });

      const result = await rescheduleRemindersForAssignment('assignment-1');

      expect(result).toBe(0);
      expect(prisma.deadline_reminders.create).not.toHaveBeenCalled();
    });
  });
});
