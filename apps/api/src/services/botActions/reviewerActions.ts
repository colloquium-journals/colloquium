import { prisma } from '@colloquium/database';
import { randomUUID } from 'crypto';
import { broadcastToConversation } from '../../routes/events';
import { transporter } from '../emailService';
import { generateUniqueUsername } from '../../utils/usernameGeneration';
import { ActionContext } from '../botActionProcessor';

export async function handleAssignReviewer(data: any, context: ActionContext): Promise<void> {
  const { reviewers, deadline, customMessage } = data;
  const { manuscriptId } = context;

  // Verify manuscript exists
  const manuscript = await prisma.manuscripts.findUnique({
    where: { id: manuscriptId },
    include: {
      manuscript_authors: {
        include: { users: true }
      }
    }
  });

  if (!manuscript) {
    throw new Error(`Manuscript ${manuscriptId} not found`);
  }

  const results = {
    successful: [] as any[],
    failed: [] as any[],
    alreadyInvited: [] as any[]
  };

  for (const email of reviewers) {
    try {
      // Check if user exists
      let reviewer = await prisma.users.findUnique({
        where: { email: email.toLowerCase() }
      });

      // If user doesn't exist, create them as a potential reviewer
      if (!reviewer) {
        const username = await generateUniqueUsername(email);

        reviewer = await prisma.users.create({
          data: {
            id: randomUUID(),
            email: email.toLowerCase(),
            username,
            role: 'USER',
            updatedAt: new Date()
          }
        });
      }

      // Check if already assigned to this manuscript
      const existingAssignment = await prisma.review_assignments.findUnique({
        where: {
          manuscriptId_reviewerId: {
            manuscriptId,
            reviewerId: reviewer.id
          }
        }
      });

      if (existingAssignment) {
        results.alreadyInvited.push({
          email,
          reviewerId: reviewer.id,
          status: existingAssignment.status
        });
        continue;
      }

      // Create review assignment
      const assignment = await prisma.review_assignments.create({
        data: {
          id: randomUUID(),
          manuscriptId,
          reviewerId: reviewer.id,
          status: 'PENDING',
          dueDate: deadline ? new Date(deadline) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days default
        }
      });

      // Send invitation email
      const invitationUrl = `${process.env.FRONTEND_URL}/review-invitations/${assignment.id}`;

      try {
        await transporter.sendMail({
          from: process.env.FROM_EMAIL || 'noreply@colloquium.example.com',
          to: reviewer.email,
          subject: `Review Invitation: ${manuscript.title}`,
          html: `
            <div style="max-width: 600px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
              <h1 style="color: #2563eb; margin-bottom: 24px;">Review Invitation</h1>
              <p>You have been invited to review the manuscript:</p>
              <h2 style="margin: 16px 0;">${manuscript.title}</h2>

              ${customMessage ? `
                <div style="background-color: #f9fafb; padding: 16px; margin: 24px 0; border-radius: 6px;">
                  <h3 style="margin-top: 0;">Message from Editor:</h3>
                  <p style="margin-bottom: 0;">${customMessage}</p>
                </div>
              ` : ''}

              <p><strong>Review due date:</strong> ${assignment.dueDate ? assignment.dueDate.toLocaleDateString() : 'To be determined'}</p>

              <div style="margin: 32px 0;">
                <a href="${invitationUrl}?action=accept"
                   style="display: inline-block; background-color: #16a34a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-right: 16px;">
                  Accept Review
                </a>
                <a href="${invitationUrl}?action=decline"
                   style="display: inline-block; background-color: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
                  Decline Review
                </a>
              </div>

              <p style="color: #6b7280; font-size: 14px;">
                Invitation sent via Editorial Bot automation.
              </p>
            </div>
          `,
          text: `
Review Invitation

You have been invited to review: ${manuscript.title}

${customMessage ? `Message from Editor: ${customMessage}\n\n` : ''}

Review due: ${assignment.dueDate ? assignment.dueDate.toLocaleDateString() : 'To be determined'}

Accept: ${invitationUrl}?action=accept
Decline: ${invitationUrl}?action=decline
          `
        });
      } catch (emailError) {
        console.error('Failed to send review invitation:', emailError);
      }

      results.successful.push({
        email,
        reviewerId: reviewer.id,
        assignmentId: assignment.id,
        status: assignment.status
      });

      // Broadcast reviewer assignment to all conversation participants
      await broadcastToConversation(context.conversationId, {
        type: 'reviewer-assigned',
        assignment: {
          manuscriptId,
          reviewer: {
            id: reviewer.id,
            email: reviewer.email,
            name: reviewer.name || reviewer.email
          },
          assignmentId: assignment.id,
          status: assignment.status,
          dueDate: assignment.dueDate?.toISOString(),
          assignedAt: new Date().toISOString()
        }
      }, manuscriptId);

    } catch (error) {
      console.error(`Failed to assign reviewer ${email}:`, error);
      results.failed.push({
        email,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  console.log(`Bot reviewer assignment completed: ${results.successful.length} successful, ${results.failed.length} failed, ${results.alreadyInvited.length} already invited`);
}
