interface ReminderEmailParams {
  reviewerEmail: string;
  reviewerName: string;
  manuscriptTitle: string;
  manuscriptId: string;
  dueDate: Date;
  daysBefore: number;
  submitUrl: string;
  conversationUrl: string;
}

interface ManualReminderEmailParams extends ReminderEmailParams {
  customMessage?: string;
  senderName?: string;
}

function getUrgencyColor(daysBefore: number): string {
  if (daysBefore <= 0) return '#dc2626'; // Red - overdue or due today
  if (daysBefore <= 1) return '#ea580c'; // Orange - due tomorrow
  if (daysBefore <= 3) return '#d97706'; // Amber - 2-3 days
  return '#2563eb'; // Blue - plenty of time
}

function getUrgencyText(daysBefore: number): string {
  if (daysBefore < 0) {
    const overdueDays = Math.abs(daysBefore);
    return overdueDays === 1 ? '1 day overdue' : `${overdueDays} days overdue`;
  }
  if (daysBefore === 0) return 'Due today';
  if (daysBefore === 1) return 'Due tomorrow';
  return `Due in ${daysBefore} days`;
}

function getSubjectLine(daysBefore: number, manuscriptTitle: string): string {
  const truncatedTitle = manuscriptTitle.length > 50
    ? manuscriptTitle.substring(0, 47) + '...'
    : manuscriptTitle;

  if (daysBefore < 0) {
    const overdueDays = Math.abs(daysBefore);
    return `OVERDUE: Review for "${truncatedTitle}" was due ${overdueDays} day${overdueDays === 1 ? '' : 's'} ago`;
  }
  if (daysBefore === 0) return `DUE TODAY: Review for "${truncatedTitle}"`;
  if (daysBefore === 1) return `Due Tomorrow: Review for "${truncatedTitle}"`;
  if (daysBefore <= 3) return `Reminder: Review for "${truncatedTitle}" due in ${daysBefore} days`;
  return `Review Reminder: "${truncatedTitle}" due in ${daysBefore} days`;
}

export function generateAutomatedReminderEmail(params: ReminderEmailParams): { subject: string; html: string; text: string } {
  const { reviewerName, manuscriptTitle, dueDate, daysBefore, submitUrl, conversationUrl } = params;
  const urgencyColor = getUrgencyColor(daysBefore);
  const urgencyText = getUrgencyText(daysBefore);
  const subject = getSubjectLine(daysBefore, manuscriptTitle);
  const formattedDueDate = dueDate.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const html = `
    <div style="max-width: 600px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <div style="background-color: ${urgencyColor}; color: white; padding: 16px 24px; border-radius: 6px 6px 0 0;">
        <h1 style="margin: 0; font-size: 20px;">Review Reminder</h1>
        <p style="margin: 8px 0 0 0; opacity: 0.9;">${urgencyText}</p>
      </div>

      <div style="border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 6px 6px; padding: 24px;">
        <p>Dear ${reviewerName || 'Reviewer'},</p>

        <p>This is a reminder about your pending review for:</p>

        <div style="background-color: #f9fafb; padding: 16px; margin: 24px 0; border-radius: 6px; border-left: 4px solid ${urgencyColor};">
          <h2 style="margin-top: 0; color: #374151; font-size: 18px;">${manuscriptTitle}</h2>
          <p style="margin-bottom: 0;"><strong>Due Date:</strong> ${formattedDueDate}</p>
        </div>

        ${daysBefore <= 0 ? `
          <div style="background-color: #fef2f2; padding: 16px; margin: 24px 0; border-radius: 6px; border-left: 4px solid #dc2626;">
            <p style="margin: 0; color: #991b1b;">
              <strong>${daysBefore === 0 ? 'Your review is due today.' : `Your review is ${Math.abs(daysBefore)} day${Math.abs(daysBefore) === 1 ? '' : 's'} overdue.`}</strong>
              Please submit your review as soon as possible, or contact the editorial team if you need an extension.
            </p>
          </div>
        ` : ''}

        <div style="margin: 32px 0; text-align: center;">
          <a href="${submitUrl}"
             style="display: inline-block; background-color: ${urgencyColor}; color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: 500;">
            Submit Review
          </a>
        </div>

        <p style="color: #6b7280; font-size: 14px;">
          You can also view the conversation and manuscript details by
          <a href="${conversationUrl}" style="color: #2563eb;">clicking here</a>.
        </p>

        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />

        <p style="color: #9ca3af; font-size: 12px; margin: 0;">
          This is an automated reminder from the Editorial Bot.
          If you have questions about this review or need to request an extension, please contact the editorial team.
        </p>
      </div>
    </div>
  `;

  const text = `
Review Reminder - ${urgencyText}

Dear ${reviewerName || 'Reviewer'},

This is a reminder about your pending review for:

"${manuscriptTitle}"
Due Date: ${formattedDueDate}

${daysBefore <= 0 ? `Your review is ${daysBefore === 0 ? 'due today' : `${Math.abs(daysBefore)} day${Math.abs(daysBefore) === 1 ? '' : 's'} overdue`}. Please submit your review as soon as possible, or contact the editorial team if you need an extension.\n\n` : ''}
Submit your review: ${submitUrl}
View conversation: ${conversationUrl}

This is an automated reminder from the Editorial Bot.
  `.trim();

  return { subject, html, text };
}

export function generateManualReminderEmail(params: ManualReminderEmailParams): { subject: string; html: string; text: string } {
  const { reviewerName, manuscriptTitle, dueDate, daysBefore, submitUrl, conversationUrl, customMessage, senderName } = params;
  const urgencyColor = getUrgencyColor(daysBefore);
  const urgencyText = getUrgencyText(daysBefore);
  const formattedDueDate = dueDate.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const subject = customMessage
    ? `Review Reminder: "${manuscriptTitle.substring(0, 40)}${manuscriptTitle.length > 40 ? '...' : ''}"`
    : getSubjectLine(daysBefore, manuscriptTitle);

  const html = `
    <div style="max-width: 600px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <div style="background-color: #2563eb; color: white; padding: 16px 24px; border-radius: 6px 6px 0 0;">
        <h1 style="margin: 0; font-size: 20px;">Review Reminder</h1>
        ${senderName ? `<p style="margin: 8px 0 0 0; opacity: 0.9;">From: ${senderName}</p>` : ''}
      </div>

      <div style="border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 6px 6px; padding: 24px;">
        <p>Dear ${reviewerName || 'Reviewer'},</p>

        ${customMessage ? `
          <div style="background-color: #f0f9ff; padding: 16px; margin: 24px 0; border-radius: 6px; border-left: 4px solid #2563eb;">
            <h3 style="margin-top: 0; color: #1e40af;">Message from the Editor:</h3>
            <p style="margin-bottom: 0; color: #374151;">${customMessage}</p>
          </div>
        ` : '<p>This is a reminder about your pending review.</p>'}

        <div style="background-color: #f9fafb; padding: 16px; margin: 24px 0; border-radius: 6px; border-left: 4px solid ${urgencyColor};">
          <h2 style="margin-top: 0; color: #374151; font-size: 18px;">${manuscriptTitle}</h2>
          <p><strong>Due Date:</strong> ${formattedDueDate}</p>
          <p style="margin-bottom: 0;"><strong>Status:</strong> ${urgencyText}</p>
        </div>

        <div style="margin: 32px 0; text-align: center;">
          <a href="${submitUrl}"
             style="display: inline-block; background-color: #2563eb; color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: 500;">
            Submit Review
          </a>
        </div>

        <p style="color: #6b7280; font-size: 14px;">
          You can also view the conversation and manuscript details by
          <a href="${conversationUrl}" style="color: #2563eb;">clicking here</a>.
        </p>

        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />

        <p style="color: #9ca3af; font-size: 12px; margin: 0;">
          This reminder was sent via the Editorial Bot.
        </p>
      </div>
    </div>
  `;

  const text = `
Review Reminder${senderName ? ` from ${senderName}` : ''}

Dear ${reviewerName || 'Reviewer'},

${customMessage ? `Message from the Editor:\n${customMessage}\n\n` : 'This is a reminder about your pending review.\n\n'}
Manuscript: "${manuscriptTitle}"
Due Date: ${formattedDueDate}
Status: ${urgencyText}

Submit your review: ${submitUrl}
View conversation: ${conversationUrl}

This reminder was sent via the Editorial Bot.
  `.trim();

  return { subject, html, text };
}

export function generateReminderConversationMessage(
  reviewerName: string,
  daysBefore: number,
  dueDate: Date,
  isManual: boolean = false,
  customMessage?: string
): string {
  const urgencyText = getUrgencyText(daysBefore);
  const formattedDueDate = dueDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  let emoji = '📧';
  if (daysBefore <= 0) emoji = '⚠️';
  else if (daysBefore <= 1) emoji = '⏰';
  else if (daysBefore <= 3) emoji = '📅';

  let message = `${emoji} **Review Reminder ${isManual ? '(Manual)' : ''}**\n\n`;
  message += `**Reviewer:** @${reviewerName}\n`;
  message += `**Due Date:** ${formattedDueDate}\n`;
  message += `**Status:** ${urgencyText}\n`;

  if (customMessage) {
    message += `\n**Message:** ${customMessage}\n`;
  }

  message += `\n_Reminder sent at ${new Date().toLocaleString()}_`;

  return message;
}
