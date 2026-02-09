import { prisma } from '@colloquium/database';
import { randomUUID } from 'crypto';
import { broadcastToConversation } from '../../routes/events';
import { transporter } from '../emailService';
import { ActionContext } from '../botActionProcessor';

export async function handleMakeEditorialDecision(data: any, context: ActionContext): Promise<void> {
  const { decision, status, revisionType } = data;
  const { manuscriptId, userId, conversationId } = context;

  // Get manuscript with all related data
  const manuscript = await prisma.manuscripts.findUnique({
    where: { id: manuscriptId },
    include: {
      manuscript_authors: {
        include: { users: true }
      },
      review_assignments: {
        include: {
          users: true
        },
        where: {
          status: 'COMPLETED'
        }
      }
    }
  });

  if (!manuscript) {
    throw new Error(`Manuscript ${manuscriptId} not found`);
  }

  // Update manuscript status
  const updatedManuscript = await prisma.manuscripts.update({
    where: { id: manuscriptId },
    data: {
      status,
      updatedAt: new Date(),
      // Set acceptedDate if accepted
      ...(status === 'ACCEPTED' && { acceptedDate: new Date() })
    }
  });

  // Create decision message in editorial conversation
  const editorialConversation = await prisma.conversations.findFirst({
    where: {
      manuscriptId,
      type: 'EDITORIAL'
    }
  });

  if (editorialConversation) {
    let decisionMessage = `⚖️ **Editorial Decision: ${decision.replace('_', ' ').toUpperCase()}**\n\n`;
    decisionMessage += `**Manuscript:** ${manuscript.title}\n`;
    decisionMessage += `**Decision Date:** ${new Date().toLocaleString()}\n`;


    if (revisionType) {
      decisionMessage += `**Revision Type:** ${revisionType.toUpperCase()}\n`;
    }

    // Add review summary
    if (manuscript.review_assignments.length > 0) {
      decisionMessage += `\n**Review Summary:**\n`;
      decisionMessage += `- ${manuscript.review_assignments.length} review(s) completed\n`;

      const recommendations = manuscript.review_assignments.reduce((acc: Record<string, number>, review: any) => {
        const rec = (review as any).metadata?.recommendation || 'unknown';
        acc[rec] = (acc[rec] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      Object.entries(recommendations).forEach(([rec, count]) => {
        decisionMessage += `- ${rec}: ${count}\n`;
      });
    }

    await prisma.messages.create({
      data: {
        id: randomUUID(),
        content: decisionMessage,
        conversationId: editorialConversation.id,
        authorId: userId,
        privacy: 'EDITOR_ONLY',
        isBot: true,
        updatedAt: new Date(),
        metadata: {
          type: 'editorial_decision',
          decision,
          previousStatus: manuscript.status,
          newStatus: status,
          revisionType,
          via: 'bot'
        }
      }
    });
  }

  // Automatically send notification emails to authors
  const authorEmails = manuscript.manuscript_authors.map((ar: any) => ar.users.email);
  for (const email of authorEmails) {
    try {
      await sendDecisionEmail(email, manuscript, decision, conversationId);
    } catch (emailError) {
      console.error(`Failed to send decision email to ${email}:`, emailError);
    }
  }

  // If revision requested, create author conversation
  if (status === 'REVISION_REQUESTED') {
    await createRevisionConversation(manuscriptId, userId, revisionType);
  }

  console.log(`Editorial decision '${decision}' made for manuscript ${manuscriptId} via bot`);
}

async function sendDecisionEmail(email: string, manuscript: any, decision: string, conversationId: string): Promise<void> {
  const decisionLabels: Record<string, string> = {
    'accept': 'Accepted',
    'minor_revision': 'Minor Revisions Required',
    'major_revision': 'Major Revisions Required',
    'reject': 'Rejected'
  };

  const decisionLabel = decisionLabels[decision] || decision;
  const isPositive = decision === 'accept';
  const isRevision = decision.includes('revision');

  const subject = `Editorial Decision: ${manuscript.title} - ${decisionLabel}`;

  const htmlContent = `
    <div style="max-width: 600px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <h1 style="color: ${isPositive ? '#16a34a' : isRevision ? '#d97706' : '#dc2626'}; margin-bottom: 24px;">
        Editorial Decision: ${decisionLabel}
      </h1>

      <div style="background-color: #f9fafb; padding: 20px; margin: 24px 0; border-radius: 6px;">
        <h2 style="margin-top: 0; color: #374151;">${manuscript.title}</h2>
        <p><strong>Decision:</strong> ${decisionLabel}</p>
        <p><strong>Decision Date:</strong> ${new Date().toLocaleDateString()}</p>
      </div>


        <div style="margin: 24px 0;">
          <p>Please check the manuscript conversation for any additional feedback from the editorial team.</p>
          <p><a href="${process.env.FRONTEND_URL}/conversations/${conversationId}" style="color: #2563eb;">View Conversation</a></p>
        </div>


      ${isRevision ? `
        <div style="background-color: #fef3c7; padding: 16px; margin: 24px 0; border-radius: 6px; border-left: 4px solid #f59e0b;">
          <h3 style="margin-top: 0; color: #92400e;">Next Steps</h3>
          <p>Please address the reviewer comments and submit a revised version of your manuscript. You can access the review conversation and submit your revision through the platform.</p>
        </div>
      ` : ''}

      ${isPositive ? `
        <div style="background-color: #d1fae5; padding: 16px; margin: 24px 0; border-radius: 6px; border-left: 4px solid #10b981;">
          <h3 style="margin-top: 0; color: #065f46;">Congratulations!</h3>
          <p>Your manuscript has been accepted for publication. Our editorial team will be in touch regarding the next steps in the publication process.</p>
        </div>
      ` : ''}

      <p style="color: #6b7280; font-size: 14px; margin-top: 32px;">
        This decision was processed via Editorial Bot automation.
      </p>
    </div>
  `;

  await transporter.sendMail({
    from: process.env.FROM_EMAIL || 'noreply@colloquium.example.com',
    to: email,
    subject,
    html: htmlContent,
    text: `
Editorial Decision: ${decisionLabel}

Manuscript: ${manuscript.title}
Decision: ${decisionLabel}
Date: ${new Date().toLocaleDateString()}

Please check the manuscript conversation for additional details.
View at: ${process.env.FRONTEND_URL}/conversations/${conversationId}

${isRevision ? 'Please address the reviewer comments and submit a revised version.\n' : ''}
${isPositive ? 'Congratulations! Your manuscript has been accepted for publication.\n' : ''}
    `
  });
}

async function createRevisionConversation(manuscriptId: string, editorId: string, revisionType?: string): Promise<void> {
  // Check if revision conversation already exists
  const existingConversation = await prisma.conversations.findFirst({
    where: {
      manuscriptId,
      title: { contains: 'Revision' }
    }
  });

  if (existingConversation) {
    return; // Don't create duplicate revision conversations
  }

  // Create revision conversation
  const conversation = await prisma.conversations.create({
    data: {
      id: randomUUID(),
      title: `${revisionType || 'Manuscript'} Revision Discussion`,
      type: 'SEMI_PUBLIC',
      privacy: 'PUBLIC',
      manuscriptId,
      updatedAt: new Date()
    }
  });

  // Add editor as moderator
  await prisma.conversation_participants.create({
    data: {
      id: randomUUID(),
      conversationId: conversation.id,
      userId: editorId,
      role: 'MODERATOR'
    }
  });

  // Add authors as participants
  const manuscript = await prisma.manuscripts.findUnique({
    where: { id: manuscriptId },
    include: {
      manuscript_authors: true
    }
  });

  if (manuscript) {
    for (const authorRel of manuscript.manuscript_authors) {
      await prisma.conversation_participants.create({
        data: {
          id: randomUUID(),
          conversationId: conversation.id,
          userId: authorRel.userId,
          role: 'PARTICIPANT'
        }
      });
    }
  }

  // Create initial message
  await prisma.messages.create({
    data: {
      id: randomUUID(),
      content: `📝 **Revision Discussion Created**\n\nThis conversation is for discussing the ${revisionType || 'manuscript'} revisions. Please use this space to:\n\n- Address reviewer comments\n- Discuss specific changes\n- Ask questions about the revision requirements\n\nUse @bot-editorial commands to update manuscript status when revisions are complete.`,
      conversationId: conversation.id,
      authorId: editorId,
      privacy: 'PUBLIC',
      isBot: true,
      updatedAt: new Date(),
      metadata: {
        type: 'revision_conversation_created',
        revisionType
      }
    }
  });
}

export async function handleAssignActionEditor(data: any, context: ActionContext): Promise<void> {
  const { editor, customMessage, assignedBy } = data;
  const { manuscriptId } = context;

  // Remove @ symbol to get username for lookup
  const username = editor.replace('@', '');

  // Find user by name
  const user = await prisma.users.findFirst({
    where: { name: username },
    select: {
      id: true,
      name: true,
      email: true,
      role: true
    }
  });

  if (!user) {
    throw new Error(`User ${editor} not found`);
  }

  // Verify manuscript exists
  const manuscript = await prisma.manuscripts.findUnique({
    where: { id: manuscriptId },
    include: {
      action_editors: {
        include: {
          users_action_editors_editorIdTousers: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        }
      }
    }
  });

  if (!manuscript) {
    throw new Error(`Manuscript ${manuscriptId} not found`);
  }

  // Check if action editor already assigned
  if (manuscript.action_editors) {
    // Update existing assignment
    const updatedAssignment = await prisma.action_editors.update({
      where: { manuscriptId },
      data: {
        editorId: user.id,
        assignedAt: new Date()
      },
      include: {
        users_action_editors_editorIdTousers: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        }
      }
    });

    console.log(`Action editor updated for manuscript ${manuscriptId}: ${user.name} (was ${manuscript.action_editors.users_action_editors_editorIdTousers.name})`);
  } else {
    // Create new assignment
    const newAssignment = await prisma.action_editors.create({
      data: {
        id: randomUUID(),
        manuscriptId,
        editorId: user.id,
        assignedAt: new Date()
      },
      include: {
        users_action_editors_editorIdTousers: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        }
      }
    });

    console.log(`Action editor assigned for manuscript ${manuscriptId}: ${user.name}`);
  }

  // Broadcast action editor assignment to all conversation participants
  await broadcastToConversation(context.conversationId, {
    type: 'action-editor-assigned',
    assignment: {
      manuscriptId,
      editor: {
        id: user.id,
        name: user.name,
        email: user.email
      },
      assignedAt: new Date().toISOString()
    }
  }, manuscriptId);

  // Create notification message in editorial conversation
  const editorialConversation = await prisma.conversations.findFirst({
    where: {
      manuscriptId,
      type: 'EDITORIAL'
    }
  });

  if (editorialConversation) {
    let notificationMessage = `👤 **Action Editor Assignment via Bot**\n\n`;
    notificationMessage += `**Assigned Editor:** ${user.name} (@${user.name})\n`;
    notificationMessage += `**Email:** ${user.email}\n`;

    if (customMessage) {
      notificationMessage += `**Message:** ${customMessage}\n`;
    }

    notificationMessage += `**Assigned:** ${new Date().toLocaleString()}\n`;

    await prisma.messages.create({
      data: {
        id: randomUUID(),
        content: notificationMessage,
        conversationId: editorialConversation.id,
        authorId: assignedBy || context.userId,
        privacy: 'EDITOR_ONLY',
        isBot: true,
        updatedAt: new Date(),
        metadata: {
          type: 'action_editor_assignment',
          editorId: user.id,
          assignedEditor: user.name,
          via: 'bot'
        }
      }
    });
  }

  // Send notification email to the assigned editor
  try {
    await transporter.sendMail({
      from: process.env.FROM_EMAIL || 'noreply@colloquium.example.com',
      to: user.email,
      subject: `Action Editor Assignment: ${manuscript.title}`,
      html: `
        <div style="max-width: 600px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
          <h1 style="color: #2563eb; margin-bottom: 24px;">Action Editor Assignment</h1>
          <p>You have been assigned as the action editor for:</p>
          <h2 style="margin: 16px 0;">${manuscript.title}</h2>

          ${customMessage ? `
            <div style="background-color: #f9fafb; padding: 16px; margin: 24px 0; border-radius: 6px;">
              <h3 style="margin-top: 0;">Message from Assigning Editor:</h3>
              <p style="margin-bottom: 0;">${customMessage}</p>
            </div>
          ` : ''}

          <p><strong>Assignment Date:</strong> ${new Date().toLocaleDateString()}</p>

          <div style="margin: 32px 0;">
            <a href="${process.env.FRONTEND_URL}/manuscripts/${manuscriptId}"
               style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
              View Manuscript
            </a>
          </div>

          <p style="color: #6b7280; font-size: 14px;">
            Assignment made via Editorial Bot automation.
          </p>
        </div>
      `,
      text: `
Action Editor Assignment

You have been assigned as the action editor for: ${manuscript.title}

${customMessage ? `Message from Assigning Editor: ${customMessage}\n\n` : ''}

Assignment Date: ${new Date().toLocaleDateString()}

View manuscript: ${process.env.FRONTEND_URL}/manuscripts/${manuscriptId}
      `
    });
  } catch (emailError) {
    console.error('Failed to send action editor assignment email:', emailError);
  }
}

export async function handleUpdateWorkflowPhase(data: any, context: ActionContext): Promise<void> {
  const { phase, decision, notes, requireAllReviewsComplete } = data;
  const { manuscriptId, userId, conversationId } = context;

  console.log(`Updating workflow phase for manuscript ${manuscriptId} to ${phase}`);

  // Get manuscript with current state
  const manuscript = await prisma.manuscripts.findUnique({
    where: { id: manuscriptId },
    include: {
      review_assignments: {
        where: { status: { in: ['ACCEPTED', 'IN_PROGRESS', 'COMPLETED'] } },
        select: { status: true, reviewerId: true }
      },
      manuscript_authors: {
        include: { users: { select: { email: true, name: true } } }
      }
    }
  });

  if (!manuscript) {
    throw new Error(`Manuscript ${manuscriptId} not found`);
  }

  // Validate reviews complete if required
  if (requireAllReviewsComplete && phase === 'RELEASED') {
    const incompleteReviews = manuscript.review_assignments.filter(
      (a: any) => a.status !== 'COMPLETED'
    );
    if (incompleteReviews.length > 0) {
      throw new Error(`Cannot release: ${incompleteReviews.length} review(s) are not yet complete`);
    }
  }

  // Update manuscript phase
  const updatedManuscript = await prisma.manuscripts.update({
    where: { id: manuscriptId },
    data: {
      workflowPhase: phase,
      releasedAt: phase === 'RELEASED' ? new Date() : undefined,
      updatedAt: new Date()
    }
  });

  // Create workflow release record
  await prisma.workflow_releases.create({
    data: {
      id: randomUUID(),
      manuscriptId,
      round: manuscript.workflowRound,
      releasedBy: userId,
      decisionType: decision,
      notes
    }
  });

  // Create system message documenting the phase change
  const phaseLabels: Record<string, string> = {
    'REVIEW': 'Review Phase',
    'DELIBERATION': 'Deliberation Phase',
    'RELEASED': 'Released to Authors',
    'AUTHOR_RESPONDING': 'Author Response Phase'
  };

  let notificationMessage = `🔄 **Workflow Phase Updated**\n\n`;
  notificationMessage += `**New Phase:** ${phaseLabels[phase] || phase}\n`;
  notificationMessage += `**Round:** ${manuscript.workflowRound}\n`;
  if (decision) {
    notificationMessage += `**Decision:** ${decision}\n`;
  }
  if (notes) {
    notificationMessage += `**Notes:** ${notes}\n`;
  }
  notificationMessage += `**Updated:** ${new Date().toLocaleString()}\n`;

  await prisma.messages.create({
    data: {
      id: randomUUID(),
      content: notificationMessage,
      conversationId,
      authorId: userId,
      privacy: 'EDITOR_ONLY',
      isBot: true,
      updatedAt: new Date(),
      metadata: {
        type: 'workflow_phase_change',
        previousPhase: manuscript.workflowPhase,
        newPhase: phase,
        round: manuscript.workflowRound,
        decision,
        via: 'bot'
      }
    }
  });

  // Broadcast phase change via SSE
  await broadcastToConversation(conversationId, {
    type: 'workflow-phase-changed',
    phase,
    round: manuscript.workflowRound,
    decision,
    manuscriptId
  }, manuscriptId);

  // Send notification emails based on phase
  if (phase === 'RELEASED') {
    const authorEmails = manuscript.manuscript_authors.map((a: any) => a.users.email);
    for (const email of authorEmails) {
      try {
        await sendReleaseNotificationEmail(email, manuscript, decision, conversationId);
      } catch (emailError) {
        console.error(`Failed to send release notification to ${email}:`, emailError);
      }
    }
  }

  if (phase === 'DELIBERATION') {
    // Notify reviewers that deliberation has begun
    for (const assignment of manuscript.review_assignments) {
      try {
        const reviewer = await prisma.users.findUnique({
          where: { id: assignment.reviewerId },
          select: { email: true }
        });
        if (reviewer) {
          await sendDeliberationNotificationEmail(reviewer.email, manuscript, conversationId);
        }
      } catch (emailError) {
        console.error(`Failed to send deliberation notification:`, emailError);
      }
    }
  }

  console.log(`Workflow phase updated for manuscript ${manuscriptId}: ${phase}`);
}

async function sendReleaseNotificationEmail(email: string, manuscript: any, decision: string | undefined, conversationId: string): Promise<void> {
  const subject = `Reviews Released: ${manuscript.title}`;

  const htmlContent = `
    <div style="max-width: 600px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <h1 style="color: #2563eb; margin-bottom: 24px;">Reviews Have Been Released</h1>

      <div style="background-color: #f9fafb; padding: 20px; margin: 24px 0; border-radius: 6px;">
        <h2 style="margin-top: 0; color: #374151;">${manuscript.title}</h2>
        ${decision ? `<p><strong>Editorial Decision:</strong> ${decision}</p>` : ''}
        <p><strong>Release Date:</strong> ${new Date().toLocaleDateString()}</p>
      </div>

      <p>The reviews for your manuscript are now available. You can view the reviewer comments and respond to them through the conversation.</p>

      <div style="margin: 32px 0;">
        <a href="${process.env.FRONTEND_URL}/conversations/${conversationId}"
           style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
          View Reviews
        </a>
      </div>

      <p style="color: #6b7280; font-size: 14px; margin-top: 32px;">
        This notification was sent via Editorial Bot automation.
      </p>
    </div>
  `;

  await transporter.sendMail({
    from: process.env.FROM_EMAIL || 'noreply@colloquium.example.com',
    to: email,
    subject,
    html: htmlContent,
    text: `Reviews Released: ${manuscript.title}\n\n${decision ? `Decision: ${decision}\n` : ''}View reviews: ${process.env.FRONTEND_URL}/conversations/${conversationId}`
  });
}

async function sendDeliberationNotificationEmail(email: string, manuscript: any, conversationId: string): Promise<void> {
  const subject = `Deliberation Phase: ${manuscript.title}`;

  const htmlContent = `
    <div style="max-width: 600px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <h1 style="color: #2563eb; margin-bottom: 24px;">Deliberation Phase Has Begun</h1>

      <div style="background-color: #f9fafb; padding: 20px; margin: 24px 0; border-radius: 6px;">
        <h2 style="margin-top: 0; color: #374151;">${manuscript.title}</h2>
        <p>All reviews have been submitted and the manuscript has entered the deliberation phase.</p>
      </div>

      <p>You can now see other reviewers' assessments and participate in the deliberation discussion.</p>

      <div style="margin: 32px 0;">
        <a href="${process.env.FRONTEND_URL}/conversations/${conversationId}"
           style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
          View Conversation
        </a>
      </div>

      <p style="color: #6b7280; font-size: 14px; margin-top: 32px;">
        This notification was sent via Editorial Bot automation.
      </p>
    </div>
  `;

  await transporter.sendMail({
    from: process.env.FROM_EMAIL || 'noreply@colloquium.example.com',
    to: email,
    subject,
    html: htmlContent,
    text: `Deliberation Phase: ${manuscript.title}\n\nView conversation: ${process.env.FRONTEND_URL}/conversations/${conversationId}`
  });
}

export async function handleSendManualReminder(
  data: { reviewer: string; customMessage?: string; triggeredBy?: string },
  context: ActionContext
): Promise<void> {
  const { reviewer, customMessage, triggeredBy } = data;
  const { manuscriptId, conversationId } = context;

  // Remove @ symbol to get username for lookup
  const username = reviewer.replace('@', '');

  // Find reviewer user by name or username
  const reviewerUser = await prisma.users.findFirst({
    where: {
      OR: [
        { name: username },
        { username: username }
      ]
    },
    select: {
      id: true,
      name: true,
      email: true,
      username: true,
    }
  });

  if (!reviewerUser) {
    console.error(`Reviewer ${reviewer} not found`);
    // Post error message to conversation
    await prisma.messages.create({
      data: {
        id: randomUUID(),
        content: `❌ **Reminder Failed**\n\nCould not find reviewer ${reviewer}. Please check the username and try again.`,
        conversationId,
        authorId: triggeredBy || context.userId,
        privacy: 'EDITOR_ONLY',
        isBot: true,
        updatedAt: new Date(),
        metadata: {
          type: 'reminder_error',
          reviewer,
          error: 'User not found'
        }
      }
    });
    return;
  }

  // Find their active assignment for this manuscript
  const assignment = await prisma.review_assignments.findFirst({
    where: {
      manuscriptId,
      reviewerId: reviewerUser.id,
      status: { in: ['ACCEPTED', 'IN_PROGRESS'] }
    },
    include: {
      manuscripts: {
        select: { title: true }
      }
    }
  });

  if (!assignment) {
    console.error(`No active assignment found for reviewer ${reviewer} on manuscript ${manuscriptId}`);
    await prisma.messages.create({
      data: {
        id: randomUUID(),
        content: `❌ **Reminder Failed**\n\nNo active review assignment found for ${reviewer} on this manuscript. The reviewer may have declined, completed their review, or not yet accepted the invitation.`,
        conversationId,
        authorId: triggeredBy || context.userId,
        privacy: 'EDITOR_ONLY',
        isBot: true,
        updatedAt: new Date(),
        metadata: {
          type: 'reminder_error',
          reviewer,
          error: 'No active assignment'
        }
      }
    });
    return;
  }

  if (!assignment.dueDate) {
    console.error(`No due date set for assignment ${assignment.id}`);
    await prisma.messages.create({
      data: {
        id: randomUUID(),
        content: `❌ **Reminder Failed**\n\nNo due date set for ${reviewer}'s review assignment. Please set a due date first.`,
        conversationId,
        authorId: triggeredBy || context.userId,
        privacy: 'EDITOR_ONLY',
        isBot: true,
        updatedAt: new Date(),
        metadata: {
          type: 'reminder_error',
          reviewer,
          error: 'No due date'
        }
      }
    });
    return;
  }

  // Import and use the sendManualReminder function
  const { sendManualReminder } = await import('../deadlineReminderProcessor');

  const result = await sendManualReminder(
    assignment.id,
    triggeredBy || context.userId,
    customMessage
  );

  if (!result.success) {
    console.error(`Manual reminder failed: ${result.error}`);
    await prisma.messages.create({
      data: {
        id: randomUUID(),
        content: `❌ **Reminder Failed**\n\nCould not send reminder to ${reviewer}: ${result.error}`,
        conversationId,
        authorId: triggeredBy || context.userId,
        privacy: 'EDITOR_ONLY',
        isBot: true,
        updatedAt: new Date(),
        metadata: {
          type: 'reminder_error',
          reviewer,
          error: result.error
        }
      }
    });
    return;
  }

  console.log(`Manual reminder sent successfully to ${reviewer} for manuscript ${manuscriptId}`);
}
