import { prisma } from '@colloquium/database';
import { DeadlineReminderJob } from '../jobs/index';
import { getJournalSettings, ReminderInterval, JournalSettingsData } from '../routes/settings';
import { generateAutomatedReminderEmail, generateManualReminderEmail, generateReminderConversationMessage } from '../templates/reminderEmails';
import { broadcastToConversation } from '../routes/events';
import { randomUUID } from 'crypto';
import { transporter } from './emailService';

function findIntervalSettings(daysBefore: number, settings: JournalSettingsData): ReminderInterval | null {
  const reminderSettings = settings.reminderSettings;
  if (!reminderSettings?.enabled || !reminderSettings.reviewReminders?.enabled) {
    return null;
  }

  const reviewReminders = reminderSettings.reviewReminders;

  // Check regular intervals
  if (daysBefore >= 0) {
    return reviewReminders.intervals.find((i: ReminderInterval) => i.daysBefore === daysBefore && i.enabled) || null;
  }

  // For overdue reminders (daysBefore < 0), check if overdue reminders are enabled
  if (reviewReminders.overdueReminders?.enabled) {
    return {
      daysBefore,
      enabled: true,
      emailEnabled: true,
      conversationEnabled: true,
    };
  }

  return null;
}

export async function processDeadlineReminder(job: DeadlineReminderJob): Promise<void> {
  const { reminderId, assignmentId, daysBefore } = job;

  // Fetch the reminder with all related data
  const reminder = await prisma.deadline_reminders.findUnique({
    where: { id: reminderId },
    include: {
      review_assignments: {
        include: {
          users: {
            select: {
              id: true,
              email: true,
              name: true,
              username: true,
            },
          },
          manuscripts: {
            include: {
              conversations: {
                where: { type: 'EDITORIAL' },
                take: 1,
              },
            },
          },
        },
      },
    },
  });

  // Skip if reminder not found or already sent
  if (!reminder) {
    console.log(`Reminder ${reminderId} not found, skipping`);
    return;
  }

  if (reminder.status === 'SENT') {
    console.log(`Reminder ${reminderId} already sent, skipping`);
    return;
  }

  if (reminder.status === 'CANCELLED') {
    console.log(`Reminder ${reminderId} was cancelled, skipping`);
    return;
  }

  const assignment = reminder.review_assignments;

  // Check if assignment is still active (not completed or declined)
  if (!['ACCEPTED', 'IN_PROGRESS'].includes(assignment.status)) {
    console.log(`Assignment ${assignmentId} is ${assignment.status}, cancelling reminder`);
    await prisma.deadline_reminders.update({
      where: { id: reminderId },
      data: { status: 'CANCELLED', updatedAt: new Date() },
    });
    return;
  }

  // Get journal settings to check interval configuration
  const settings = await getJournalSettings();
  const interval = findIntervalSettings(daysBefore, settings);

  if (!interval) {
    console.log(`No enabled interval found for daysBefore=${daysBefore}, cancelling reminder`);
    await prisma.deadline_reminders.update({
      where: { id: reminderId },
      data: { status: 'CANCELLED', updatedAt: new Date() },
    });
    return;
  }

  const reviewer = assignment.users;
  const manuscript = assignment.manuscripts;
  const editorialConversation = manuscript.conversations[0];

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const submitUrl = `${frontendUrl}/manuscripts/${manuscript.id}/review`;
  const conversationUrl = editorialConversation
    ? `${frontendUrl}/conversations/${editorialConversation.id}`
    : `${frontendUrl}/manuscripts/${manuscript.id}`;

  let emailSent = false;
  let conversationPosted = false;
  const errors: string[] = [];

  // Send email if enabled
  if (interval.emailEnabled) {
    try {
      const emailContent = generateAutomatedReminderEmail({
        reviewerEmail: reviewer.email,
        reviewerName: reviewer.name || reviewer.username,
        manuscriptTitle: manuscript.title,
        manuscriptId: manuscript.id,
        dueDate: assignment.dueDate!,
        daysBefore,
        submitUrl,
        conversationUrl,
      });

      await transporter.sendMail({
        from: process.env.FROM_EMAIL || 'noreply@colloquium.example.com',
        to: reviewer.email,
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text,
      });

      emailSent = true;
      console.log(`Reminder email sent to ${reviewer.email} for assignment ${assignmentId}`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown email error';
      errors.push(`Email failed: ${errorMsg}`);
      console.error(`Failed to send reminder email to ${reviewer.email}:`, errorMsg);
    }
  }

  // Post to conversation if enabled
  if (interval.conversationEnabled && editorialConversation) {
    try {
      const messageContent = generateReminderConversationMessage(
        reviewer.username,
        daysBefore,
        assignment.dueDate!,
        false
      );

      // Use upsert to avoid race condition when multiple reminders process simultaneously
      const botUser = await prisma.users.upsert({
        where: { username: 'bot-editorial' },
        update: {},
        create: {
          id: randomUUID(),
          email: 'bot-editorial@system.local',
          username: 'bot-editorial',
          name: 'Editorial Bot',
          role: 'BOT',
          updatedAt: new Date(),
        },
      });

      const message = await prisma.messages.create({
        data: {
          id: randomUUID(),
          content: messageContent,
          conversationId: editorialConversation.id,
          authorId: botUser.id,
          privacy: 'EDITOR_ONLY',
          isBot: true,
          updatedAt: new Date(),
          metadata: {
            type: 'deadline_reminder',
            assignmentId,
            daysBefore,
            reminderId,
            automated: true,
          },
        },
      });

      // Broadcast the message via SSE (non-critical, don't fail on error)
      try {
        await broadcastToConversation(editorialConversation.id, {
          type: 'new-message',
          message: {
            id: message.id,
            content: message.content,
            conversationId: message.conversationId,
            authorId: message.authorId,
            isBot: message.isBot,
            privacy: message.privacy,
            createdAt: message.createdAt.toISOString(),
          },
        }, manuscript.id);
      } catch (broadcastError) {
        console.warn(`SSE broadcast failed for reminder ${reminderId}:`, broadcastError);
      }

      conversationPosted = true;
      console.log(`Reminder posted to conversation ${editorialConversation.id} for assignment ${assignmentId}`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown conversation error';
      errors.push(`Conversation post failed: ${errorMsg}`);
      console.error(`Failed to post reminder to conversation:`, errorMsg);
    }
  }

  // Determine overall success - at least one notification method must succeed
  const atLeastOneSucceeded = emailSent || conversationPosted;

  if (atLeastOneSucceeded) {
    // Mark reminder as sent (even if one method failed, the reminder was delivered)
    await prisma.deadline_reminders.update({
      where: { id: reminderId },
      data: {
        status: 'SENT',
        sentAt: new Date(),
        updatedAt: new Date(),
        errorMessage: errors.length > 0 ? errors.join('; ') : null,
      },
    });

    console.log(`Reminder ${reminderId} processed successfully${errors.length > 0 ? ' (with partial failures)' : ''}`);
  } else if (errors.length > 0) {
    // Both methods failed
    await prisma.deadline_reminders.update({
      where: { id: reminderId },
      data: {
        status: 'FAILED',
        errorMessage: errors.join('; '),
        updatedAt: new Date(),
      },
    });

    console.error(`Reminder ${reminderId} failed: ${errors.join('; ')}`);
    throw new Error(`Reminder failed: ${errors.join('; ')}`);
  } else {
    // No notification methods were enabled/applicable
    console.log(`Reminder ${reminderId} had no notification methods to execute`);
    await prisma.deadline_reminders.update({
      where: { id: reminderId },
      data: {
        status: 'SENT',
        sentAt: new Date(),
        updatedAt: new Date(),
      },
    });
  }
}

export async function sendManualReminder(
  assignmentId: string,
  senderId: string,
  customMessage?: string
): Promise<{ success: boolean; error?: string }> {
  const assignment = await prisma.review_assignments.findUnique({
    where: { id: assignmentId },
    include: {
      users: {
        select: {
          id: true,
          email: true,
          name: true,
          username: true,
        },
      },
      manuscripts: {
        include: {
          conversations: {
            where: { type: 'EDITORIAL' },
            take: 1,
          },
        },
      },
    },
  });

  if (!assignment) {
    return { success: false, error: 'Assignment not found' };
  }

  if (!['ACCEPTED', 'IN_PROGRESS'].includes(assignment.status)) {
    return { success: false, error: `Cannot send reminder: assignment status is ${assignment.status}` };
  }

  if (!assignment.dueDate) {
    return { success: false, error: 'Cannot send reminder: no due date set for this assignment' };
  }

  const sender = await prisma.users.findUnique({
    where: { id: senderId },
    select: { name: true, username: true },
  });

  const reviewer = assignment.users;
  const manuscript = assignment.manuscripts;
  const editorialConversation = manuscript.conversations[0];

  const now = new Date();
  const dueDate = new Date(assignment.dueDate);
  const diffTime = dueDate.getTime() - now.getTime();
  const daysBefore = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const submitUrl = `${frontendUrl}/manuscripts/${manuscript.id}/review`;
  const conversationUrl = editorialConversation
    ? `${frontendUrl}/conversations/${editorialConversation.id}`
    : `${frontendUrl}/manuscripts/${manuscript.id}`;

  try {
    // Send email
    const emailContent = generateManualReminderEmail({
      reviewerEmail: reviewer.email,
      reviewerName: reviewer.name || reviewer.username,
      manuscriptTitle: manuscript.title,
      manuscriptId: manuscript.id,
      dueDate: assignment.dueDate,
      daysBefore,
      submitUrl,
      conversationUrl,
      customMessage,
      senderName: sender?.name || sender?.username,
    });

    await transporter.sendMail({
      from: process.env.FROM_EMAIL || 'noreply@colloquium.example.com',
      to: reviewer.email,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
    });

    // Post to conversation if available
    if (editorialConversation) {
      const messageContent = generateReminderConversationMessage(
        reviewer.username,
        daysBefore,
        assignment.dueDate,
        true,
        customMessage
      );

      const message = await prisma.messages.create({
        data: {
          id: randomUUID(),
          content: messageContent,
          conversationId: editorialConversation.id,
          authorId: senderId,
          privacy: 'EDITOR_ONLY',
          isBot: false,
          updatedAt: new Date(),
          metadata: {
            type: 'deadline_reminder',
            assignmentId,
            daysBefore,
            manual: true,
            customMessage,
          },
        },
      });

      // Broadcast the message via SSE
      await broadcastToConversation(editorialConversation.id, {
        type: 'new-message',
        message: {
          id: message.id,
          content: message.content,
          conversationId: message.conversationId,
          authorId: message.authorId,
          isBot: message.isBot,
          privacy: message.privacy,
          createdAt: message.createdAt.toISOString(),
        },
      }, manuscript.id);
    }

    console.log(`Manual reminder sent to ${reviewer.email} for assignment ${assignmentId}`);
    return { success: true };
  } catch (error) {
    console.error(`Failed to send manual reminder for ${assignmentId}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send reminder',
    };
  }
}
