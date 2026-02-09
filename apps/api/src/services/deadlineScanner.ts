import { prisma } from '@colloquium/database';
import { getJournalSettings, ReminderInterval, OverdueReminderSettings } from '../routes/settings';
import { scheduleReminderJob } from '../jobs/index';
import { randomUUID } from 'crypto';

// Type for review assignment with deadline reminders
interface AssignmentWithReminders {
  id: string;
  dueDate: Date | null;
  status: string;
  deadline_reminders: Array<{
    daysBefore: number;
    status: string;
  }>;
}

// Type for existing reminder in the map
interface ExistingReminder {
  daysBefore: number;
  status: string;
}

function calculateReminderTime(dueDate: Date, daysBefore: number): Date {
  const reminderDate = new Date(dueDate);
  reminderDate.setDate(reminderDate.getDate() - daysBefore);
  // Set to 9 AM in server timezone
  // Note: This uses the server's local timezone. For multi-timezone deployments,
  // consider storing user timezone preferences and adjusting accordingly.
  reminderDate.setHours(9, 0, 0, 0);
  return reminderDate;
}

function generateJobKey(assignmentId: string, daysBefore: number): string {
  return `reminder-${assignmentId}-${daysBefore}`;
}

async function scheduleRemindersForAssignment(
  assignment: AssignmentWithReminders,
  intervals: ReminderInterval[],
  existingReminders: Map<number, ExistingReminder>
): Promise<number> {
  // Skip if no due date set
  if (!assignment.dueDate) return 0;

  let scheduledCount = 0;
  const now = new Date();
  const dueDate = assignment.dueDate;

  for (const interval of intervals) {
    if (!interval.enabled) continue;

    // Skip if reminder already exists for this interval
    if (existingReminders.has(interval.daysBefore)) {
      continue;
    }

    const reminderTime = calculateReminderTime(dueDate, interval.daysBefore);

    // Skip if reminder time is in the past (but still create the record for tracking)
    // Only skip if it's more than 1 hour in the past
    const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    if (reminderTime < hourAgo) {
      continue;
    }

    const jobKey = generateJobKey(assignment.id, interval.daysBefore);

    try {
      // Create the reminder record
      const reminder = await prisma.deadline_reminders.create({
        data: {
          id: randomUUID(),
          assignmentId: assignment.id,
          daysBefore: interval.daysBefore,
          scheduledFor: reminderTime,
          status: 'QUEUED',
          jobKey,
        },
      });

      // Schedule the job — if scheduling fails, mark the reminder as FAILED
      try {
        await scheduleReminderJob(
          {
            reminderId: reminder.id,
            assignmentId: assignment.id,
            daysBefore: interval.daysBefore,
          },
          reminderTime,
          jobKey
        );
      } catch (scheduleError) {
        await prisma.deadline_reminders.update({
          where: { id: reminder.id },
          data: { status: 'FAILED', updatedAt: new Date() },
        });
        throw scheduleError;
      }

      scheduledCount++;
      console.log(`Scheduled reminder for assignment ${assignment.id}: ${interval.daysBefore} days before (${reminderTime.toISOString()})`);
    } catch (error) {
      // Handle unique constraint violation (reminder already exists)
      const prismaError = error as { code?: string };
      if (prismaError.code === 'P2002') {
        console.log(`Reminder already exists for assignment ${assignment.id}, daysBefore ${interval.daysBefore}`);
        continue;
      }
      throw error;
    }
  }

  return scheduledCount;
}

async function scheduleOverdueRemindersForAssignment(
  assignment: AssignmentWithReminders,
  overdueSettings: OverdueReminderSettings,
  existingReminders: Map<number, ExistingReminder>
): Promise<number> {
  if (!overdueSettings.enabled) return 0;

  // Skip if no due date set
  if (!assignment.dueDate) return 0;

  let scheduledCount = 0;
  const now = new Date();
  const dueDate = new Date(assignment.dueDate);

  // Only schedule overdue reminders if the assignment is actually overdue
  if (dueDate >= now) return 0;

  const daysPastDue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

  // Calculate which overdue reminders should be scheduled
  // daysBefore is negative for overdue (e.g., -3 means 3 days overdue)
  for (let i = 1; i <= overdueSettings.maxReminders; i++) {
    const overdueDays = i * overdueSettings.intervalDays;
    const daysBefore = -overdueDays;

    // Skip if we haven't reached this overdue milestone yet
    if (daysPastDue < overdueDays) continue;

    // Skip if reminder already exists
    if (existingReminders.has(daysBefore)) {
      continue;
    }

    const reminderTime = new Date(); // Schedule immediately for overdue
    reminderTime.setHours(9, 0, 0, 0);

    // If it's past 9 AM today, schedule for now
    if (reminderTime < now) {
      reminderTime.setTime(now.getTime() + 60 * 1000); // 1 minute from now
    }

    const jobKey = generateJobKey(assignment.id, daysBefore);

    try {
      const reminder = await prisma.deadline_reminders.create({
        data: {
          id: randomUUID(),
          assignmentId: assignment.id,
          daysBefore,
          scheduledFor: reminderTime,
          status: 'QUEUED',
          jobKey,
        },
      });

      try {
        await scheduleReminderJob(
          {
            reminderId: reminder.id,
            assignmentId: assignment.id,
            daysBefore,
          },
          reminderTime,
          jobKey
        );
      } catch (scheduleError) {
        await prisma.deadline_reminders.update({
          where: { id: reminder.id },
          data: { status: 'FAILED', updatedAt: new Date() },
        });
        throw scheduleError;
      }

      scheduledCount++;
      console.log(`Scheduled overdue reminder for assignment ${assignment.id}: ${-daysBefore} days overdue`);
    } catch (error) {
      const prismaError = error as { code?: string };
      if (prismaError.code === 'P2002') {
        console.log(`Overdue reminder already exists for assignment ${assignment.id}, daysBefore ${daysBefore}`);
        continue;
      }
      throw error;
    }
  }

  return scheduledCount;
}

export async function scanAndScheduleReminders(): Promise<{ scheduled: number; scanned: number }> {
  console.log('Starting deadline reminder scan...');

  const settings = await getJournalSettings();

  // Check if reminders are enabled
  if (!settings.reminderSettings?.enabled) {
    console.log('Reminders are disabled globally');
    return { scheduled: 0, scanned: 0 };
  }

  const reviewReminders = settings.reminderSettings.reviewReminders;
  if (!reviewReminders?.enabled) {
    console.log('Review reminders are disabled');
    return { scheduled: 0, scanned: 0 };
  }

  const intervals = reviewReminders.intervals.filter((i: ReminderInterval) => i.enabled);
  if (intervals.length === 0 && !reviewReminders.overdueReminders?.enabled) {
    console.log('No reminder intervals enabled');
    return { scheduled: 0, scanned: 0 };
  }

  // Calculate look-ahead window based on maximum interval
  const maxDays = Math.max(...intervals.map((i: ReminderInterval) => i.daysBefore), 0);
  const lookAhead = new Date(Date.now() + (maxDays + 1) * 24 * 60 * 60 * 1000);

  // Find active assignments with upcoming deadlines
  const assignments = await prisma.review_assignments.findMany({
    where: {
      status: { in: ['ACCEPTED', 'IN_PROGRESS'] },
      dueDate: { not: null },
      OR: [
        // Assignments with deadlines within the look-ahead window
        { dueDate: { lte: lookAhead } },
        // Also include overdue assignments
        { dueDate: { lt: new Date() } },
      ],
    },
    include: {
      deadline_reminders: {
        where: { status: { in: ['QUEUED', 'SENT'] } },
      },
      users: {
        select: { email: true, name: true },
      },
      manuscripts: {
        select: { title: true },
      },
    },
  });

  console.log(`Found ${assignments.length} active assignments with deadlines`);

  let totalScheduled = 0;

  for (const assignment of assignments) {
    // Build map of existing reminders by daysBefore
    const existingReminders = new Map<number, any>();
    for (const reminder of assignment.deadline_reminders) {
      existingReminders.set(reminder.daysBefore, reminder);
    }

    // Schedule regular reminders
    const regularCount = await scheduleRemindersForAssignment(
      assignment,
      intervals,
      existingReminders
    );
    totalScheduled += regularCount;

    // Schedule overdue reminders
    if (reviewReminders.overdueReminders?.enabled) {
      const overdueCount = await scheduleOverdueRemindersForAssignment(
        assignment,
        reviewReminders.overdueReminders,
        existingReminders
      );
      totalScheduled += overdueCount;
    }
  }

  console.log(`Deadline scan complete: ${totalScheduled} reminders scheduled from ${assignments.length} assignments`);

  return { scheduled: totalScheduled, scanned: assignments.length };
}

export async function cancelRemindersForAssignment(assignmentId: string): Promise<number> {
  const result = await prisma.deadline_reminders.updateMany({
    where: {
      assignmentId,
      status: { in: ['PENDING', 'QUEUED'] },
    },
    data: {
      status: 'CANCELLED',
      updatedAt: new Date(),
    },
  });

  console.log(`Cancelled ${result.count} pending reminders for assignment ${assignmentId}`);
  return result.count;
}

export async function rescheduleRemindersForAssignment(assignmentId: string): Promise<number> {
  // Cancel existing pending/queued reminders
  await cancelRemindersForAssignment(assignmentId);

  // Fetch the assignment
  const assignment = await prisma.review_assignments.findUnique({
    where: { id: assignmentId },
    include: {
      deadline_reminders: {
        where: { status: { in: ['QUEUED', 'SENT'] } },
      },
    },
  });

  if (!assignment || !assignment.dueDate) {
    return 0;
  }

  if (!['ACCEPTED', 'IN_PROGRESS'].includes(assignment.status)) {
    return 0;
  }

  const settings = await getJournalSettings();
  if (!settings.reminderSettings?.enabled || !settings.reminderSettings.reviewReminders?.enabled) {
    return 0;
  }

  const intervals = settings.reminderSettings.reviewReminders.intervals.filter(
    (i: ReminderInterval) => i.enabled
  );

  // Build map of sent reminders (don't reschedule those)
  const sentReminders = new Map<number, any>();
  for (const reminder of assignment.deadline_reminders) {
    if (reminder.status === 'SENT') {
      sentReminders.set(reminder.daysBefore, reminder);
    }
  }

  return scheduleRemindersForAssignment(assignment, intervals, sentReminders);
}
