import { prisma } from '@colloquium/database';
import { BotAction } from '@colloquium/types';
import * as nodemailer from 'nodemailer';

// Email transporter (should be configured centrally)
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'localhost',
  port: parseInt(process.env.SMTP_PORT || '1025'),
  secure: false,
  auth: process.env.SMTP_USER ? {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  } : undefined,
  tls: {
    rejectUnauthorized: false
  }
});

export interface ActionContext {
  manuscriptId: string;
  userId: string;
  conversationId: string;
}

export class BotActionProcessor {
  async processActions(actions: BotAction[], context: ActionContext): Promise<void> {
    for (const action of actions) {
      try {
        await this.processAction(action, context);
      } catch (error) {
        console.error(`Failed to process bot action ${action.type}:`, error);
        // Continue processing other actions even if one fails
      }
    }
  }

  private async processAction(action: BotAction, context: ActionContext): Promise<void> {
    switch (action.type) {
      case 'ASSIGN_REVIEWER':
        await this.handleAssignReviewer(action.data, context);
        break;
      
      case 'UPDATE_MANUSCRIPT_STATUS':
        await this.handleUpdateManuscriptStatus(action.data, context);
        break;
      
      case 'CREATE_CONVERSATION':
        await this.handleCreateConversation(action.data, context);
        break;
      
      case 'RESPOND_TO_REVIEW':
        await this.handleRespondToReview(action.data, context);
        break;
      
      case 'SUBMIT_REVIEW':
        await this.handleSubmitReview(action.data, context);
        break;
      
      default:
        console.warn(`Unknown bot action type: ${action.type}`);
    }
  }

  private async handleAssignReviewer(data: any, context: ActionContext): Promise<void> {
    const { reviewers, deadline, customMessage } = data;
    const { manuscriptId } = context;

    // Verify manuscript exists
    const manuscript = await prisma.manuscript.findUnique({
      where: { id: manuscriptId },
      include: {
        authorRelations: {
          include: { user: true }
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
        let reviewer = await prisma.user.findUnique({
          where: { email: email.toLowerCase() }
        });

        // If user doesn't exist, create them as a potential reviewer
        if (!reviewer) {
          reviewer = await prisma.user.create({
            data: {
              email: email.toLowerCase(),
              role: 'USER'
            }
          });
        }

        // Check if already assigned to this manuscript
        const existingAssignment = await prisma.reviewAssignment.findUnique({
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
        const assignment = await prisma.reviewAssignment.create({
          data: {
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

  private async handleUpdateManuscriptStatus(data: any, context: ActionContext): Promise<void> {
    const { status, reason } = data;
    const { manuscriptId } = context;

    // Validate the status
    const validStatuses = ['SUBMITTED', 'UNDER_REVIEW', 'REVISION_REQUESTED', 'REVISED', 'ACCEPTED', 'REJECTED', 'PUBLISHED'];
    if (!validStatuses.includes(status)) {
      throw new Error(`Invalid manuscript status: ${status}`);
    }

    // Update the manuscript status
    const updatedManuscript = await prisma.manuscript.update({
      where: { id: manuscriptId },
      data: {
        status,
        updatedAt: new Date()
      },
      include: {
        authorRelations: {
          include: { user: true }
        }
      }
    });

    // Create a system message in the conversation documenting the status change
    await prisma.message.create({
      data: {
        content: `📋 **Manuscript Status Updated by Editorial Bot**\n\n**New Status:** ${status.replace('_', ' ')}\n${reason ? `**Reason:** ${reason}\n` : ''}**Updated:** ${new Date().toLocaleString()}`,
        conversationId: context.conversationId,
        authorId: context.userId,
        privacy: 'EDITOR_ONLY',
        isBot: true,
        metadata: {
          botAction: 'UPDATE_MANUSCRIPT_STATUS',
          previousStatus: updatedManuscript.status,
          newStatus: status,
          reason
        }
      }
    });

    console.log(`Manuscript ${manuscriptId} status updated to ${status} by bot`);
  }

  private async handleCreateConversation(data: any, context: ActionContext): Promise<void> {
    const { title, type, privacy, participantIds = [] } = data;
    const { manuscriptId, userId } = context;

    // Create the conversation
    const conversation = await prisma.conversation.create({
      data: {
        title,
        type: type || 'EDITORIAL',
        privacy: privacy || 'PRIVATE',
        manuscriptId
      }
    });

    // Add participants
    const participants = [userId, ...participantIds]; // Include the bot command user
    const uniqueParticipants = [...new Set(participants)]; // Remove duplicates

    for (const participantId of uniqueParticipants) {
      await prisma.conversationParticipant.create({
        data: {
          conversationId: conversation.id,
          userId: participantId,
          role: participantId === userId ? 'MODERATOR' : 'PARTICIPANT'
        }
      });
    }

    console.log(`Created conversation ${conversation.id} for manuscript ${manuscriptId} by bot`);
  }

  private async handleRespondToReview(data: any, context: ActionContext): Promise<void> {
    const { assignmentId, response, message } = data;
    const { userId } = context;

    // Find the review assignment
    const assignment = await prisma.reviewAssignment.findUnique({
      where: { id: assignmentId },
      include: {
        reviewer: true,
        manuscript: true
      }
    });

    if (!assignment) {
      throw new Error(`Review assignment ${assignmentId} not found`);
    }

    // Verify the user is the assigned reviewer
    if (assignment.reviewerId !== userId) {
      throw new Error('You can only respond to your own review invitations');
    }

    // Check if already responded
    if (assignment.status !== 'PENDING') {
      throw new Error(`You have already ${assignment.status.toLowerCase()} this review invitation`);
    }

    // Update the assignment status
    const newStatus = response === 'ACCEPT' ? 'ACCEPTED' : 'DECLINED';
    await prisma.reviewAssignment.update({
      where: { id: assignmentId },
      data: { status: newStatus }
    });

    // Create notification message in editorial conversation
    const editorialConversation = await prisma.conversation.findFirst({
      where: {
        manuscriptId: assignment.manuscriptId,
        type: 'EDITORIAL'
      }
    });

    if (editorialConversation) {
      const responseMessage = response === 'ACCEPT' 
        ? `✅ **Review Invitation Accepted via Bot**\n\n**Reviewer:** ${assignment.reviewer.name || assignment.reviewer.email}\n**Manuscript:** ${assignment.manuscript.title}${message ? `\n**Message:** ${message}` : ''}`
        : `❌ **Review Invitation Declined via Bot**\n\n**Reviewer:** ${assignment.reviewer.name || assignment.reviewer.email}\n**Manuscript:** ${assignment.manuscript.title}${message ? `\n**Reason:** ${message}` : ''}`;

      await prisma.message.create({
        data: {
          content: responseMessage,
          conversationId: editorialConversation.id,
          authorId: userId,
          privacy: 'EDITOR_ONLY',
          isBot: true,
          metadata: {
            type: 'review_invitation_response',
            assignmentId,
            response: newStatus,
            via: 'bot'
          }
        }
      });
    }

    console.log(`Review invitation ${response.toLowerCase()}ed for assignment ${assignmentId} via bot`);
  }

  private async handleSubmitReview(data: any, context: ActionContext): Promise<void> {
    const { assignmentId, reviewContent, recommendation, confidentialComments, score } = data;
    const { userId } = context;

    // Find the review assignment
    const assignment = await prisma.reviewAssignment.findUnique({
      where: { id: assignmentId },
      include: {
        reviewer: true,
        manuscript: true
      }
    });

    if (!assignment) {
      throw new Error(`Review assignment ${assignmentId} not found`);
    }

    // Verify the user is the assigned reviewer
    if (assignment.reviewerId !== userId) {
      throw new Error('You can only submit reviews for your own assignments');
    }

    // Check if review is in the right status
    if (!['ACCEPTED', 'IN_PROGRESS'].includes(assignment.status)) {
      throw new Error(`Cannot submit review for assignment with status: ${assignment.status}`);
    }

    // Update assignment to completed
    await prisma.reviewAssignment.update({
      where: { id: assignmentId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date()
      }
    });

    // Create message in review conversation
    const reviewConversation = await prisma.conversation.findFirst({
      where: {
        manuscriptId: assignment.manuscriptId,
        type: 'REVIEW'
      }
    });

    if (reviewConversation) {
      await prisma.message.create({
        data: {
          content: `📝 **Review Submitted via Bot**\n\n**Reviewer:** ${assignment.reviewer.name || assignment.reviewer.email}\n\n**Recommendation:** ${recommendation}\n\n**Review:**\n${reviewContent}${score ? `\n\n**Score:** ${score}/10` : ''}`,
          conversationId: reviewConversation.id,
          authorId: userId,
          privacy: 'AUTHOR_VISIBLE',
          isBot: true,
          metadata: {
            type: 'review_submission',
            assignmentId,
            recommendation,
            score,
            hasConfidentialComments: !!confidentialComments,
            via: 'bot'
          }
        }
      });

      // Create confidential comments for editors only
      if (confidentialComments) {
        await prisma.message.create({
          data: {
            content: `🔒 **Confidential Comments (via Bot)**\n\n${confidentialComments}`,
            conversationId: reviewConversation.id,
            authorId: userId,
            privacy: 'EDITOR_ONLY',
            isBot: true,
            metadata: {
              type: 'confidential_review_comments',
              assignmentId,
              via: 'bot'
            }
          }
        });
      }
    }

    console.log(`Review submitted for assignment ${assignmentId} via bot`);
  }
}

export const botActionProcessor = new BotActionProcessor();