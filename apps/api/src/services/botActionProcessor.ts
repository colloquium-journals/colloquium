import { prisma } from '@colloquium/database';
import { BotAction, WorkflowPhase } from '@colloquium/types';
import * as nodemailer from 'nodemailer';
import { randomUUID } from 'crypto';
import { broadcastToConversation } from '../routes/events';

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
      
      case 'MAKE_EDITORIAL_DECISION':
        await this.handleMakeEditorialDecision(action.data, context);
        break;
      
      case 'ASSIGN_ACTION_EDITOR':
        await this.handleAssignActionEditor(action.data, context);
        break;
      
      case 'EXECUTE_PUBLICATION_WORKFLOW':
        await this.handleExecutePublicationWorkflow(action.data, context);
        break;

      case 'UPDATE_WORKFLOW_PHASE':
        await this.handleUpdateWorkflowPhase(action.data, context);
        break;

      case 'SEND_MANUAL_REMINDER':
        await this.handleSendManualReminder(
          action.data as { reviewer: string; customMessage?: string; triggeredBy?: string },
          context
        );
        break;

      default:
        console.warn(`Unknown bot action type: ${action.type}`);
    }
  }

  private async handleAssignReviewer(data: any, context: ActionContext): Promise<void> {
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
          const baseUsername = email.toLowerCase().split('@')[0]
            .replace(/[^a-z0-9-]/g, '-')
            .replace(/^[^a-z]/, 'u')
            .slice(0, 27);
          const paddedUsername = baseUsername.length < 3 ? baseUsername + 'x'.repeat(3 - baseUsername.length) : baseUsername;
          let username = paddedUsername;
          let suffix = 2;
          while (await prisma.users.findUnique({ where: { username }, select: { id: true } })) {
            username = `${paddedUsername}-${suffix}`;
            suffix++;
          }

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

  private async handleUpdateManuscriptStatus(data: any, context: ActionContext): Promise<void> {
    const { status, reason } = data;
    const { manuscriptId } = context;

    // Validate the status
    const validStatuses = ['SUBMITTED', 'UNDER_REVIEW', 'REVISION_REQUESTED', 'REVISED', 'ACCEPTED', 'REJECTED', 'PUBLISHED', 'RETRACTED'];
    if (!validStatuses.includes(status)) {
      throw new Error(`Invalid manuscript status: ${status}`);
    }

    // Get current manuscript to check state transitions
    const currentManuscript = await prisma.manuscripts.findUnique({
      where: { id: manuscriptId },
      select: { status: true }
    });

    if (!currentManuscript) {
      throw new Error(`Manuscript ${manuscriptId} not found`);
    }

    // Validate state transitions
    if (status === 'PUBLISHED' && currentManuscript.status !== 'ACCEPTED') {
      throw new Error(`Cannot publish manuscript. Manuscripts can only be published from ACCEPTED status, but current status is ${currentManuscript.status}`);
    }
    
    if (status === 'RETRACTED' && currentManuscript.status !== 'PUBLISHED') {
      throw new Error(`Cannot retract manuscript. Manuscripts can only be retracted from PUBLISHED status, but current status is ${currentManuscript.status}`);
    }

    // Update the manuscript status
    const updatedManuscript = await prisma.manuscripts.update({
      where: { id: manuscriptId },
      data: {
        status,
        updatedAt: new Date()
      },
      include: {
        manuscript_authors: {
          include: { users: true }
        }
      }
    });

    // Handle asset publishing/unpublishing based on status change
    try {
      const { publishedAssetManager } = await import('./publishedAssetManager');
      
      if (status === 'PUBLISHED' && currentManuscript.status !== 'PUBLISHED') {
        // Manuscript is being published - publish assets to static hosting
        await publishedAssetManager.publishManuscriptAssets(manuscriptId);
        console.log(`Assets published to static hosting for manuscript: ${manuscriptId}`);
      } else if (status === 'RETRACTED' && currentManuscript.status === 'PUBLISHED') {
        // Manuscript is being retracted - remove assets from static hosting
        await publishedAssetManager.unpublishManuscriptAssets(manuscriptId);
        console.log(`Assets unpublished from static hosting for manuscript: ${manuscriptId}`);
      }
    } catch (error) {
      console.error(`Failed to manage asset publishing for manuscript ${manuscriptId}:`, error);
      // Continue with status update - asset management failure shouldn't block the operation
    }

    // Create a system message in the conversation documenting the status change
    await prisma.messages.create({
      data: {
        id: randomUUID(),
        content: `📋 **Manuscript Status Updated by Editorial Bot**\n\n**New Status:** ${status.replace('_', ' ')}\n${reason ? `**Reason:** ${reason}\n` : ''}**Updated:** ${new Date().toLocaleString()}`,
        conversationId: context.conversationId,
        authorId: context.userId,
        privacy: 'EDITOR_ONLY',
        isBot: true,
        updatedAt: new Date(),
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
    const conversation = await prisma.conversations.create({
      data: {
        id: randomUUID(),
        title,
        type: type || 'EDITORIAL',
        privacy: privacy || 'PRIVATE',
        manuscriptId,
        updatedAt: new Date()
      }
    });

    // Add participants
    const participants = [userId, ...participantIds]; // Include the bot command user
    const uniqueParticipants = Array.from(new Set(participants)); // Remove duplicates

    for (const participantId of uniqueParticipants) {
      await prisma.conversation_participants.create({
        data: {
          id: randomUUID(),
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
    const assignment = await prisma.review_assignments.findUnique({
      where: { id: assignmentId },
      include: {
        users: true,
        manuscripts: true
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
    await prisma.review_assignments.update({
      where: { id: assignmentId },
      data: { status: newStatus }
    });

    // Create notification message in editorial conversation
    const editorialConversation = await prisma.conversations.findFirst({
      where: {
        manuscriptId: assignment.manuscriptId,
        type: 'EDITORIAL'
      }
    });

    if (editorialConversation) {
      const responseMessage = response === 'ACCEPT' 
        ? `✅ **Review Invitation Accepted via Bot**\n\n**Reviewer:** ${assignment.users.name || assignment.users.email}\n**Manuscript:** ${assignment.manuscripts.title}${message ? `\n**Message:** ${message}` : ''}`
        : `❌ **Review Invitation Declined via Bot**\n\n**Reviewer:** ${assignment.users.name || assignment.users.email}\n**Manuscript:** ${assignment.manuscripts.title}${message ? `\n**Reason:** ${message}` : ''}`;

      await prisma.messages.create({
        data: {
          id: randomUUID(),
          content: responseMessage,
          conversationId: editorialConversation.id,
          authorId: userId,
          privacy: 'EDITOR_ONLY',
          isBot: true,
          updatedAt: new Date(),
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
    const assignment = await prisma.review_assignments.findUnique({
      where: { id: assignmentId },
      include: {
        users: true,
        manuscripts: true
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
    await prisma.review_assignments.update({
      where: { id: assignmentId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date()
      }
    });

    // Create message in review conversation
    const reviewConversation = await prisma.conversations.findFirst({
      where: {
        manuscriptId: assignment.manuscriptId,
        type: 'REVIEW'
      }
    });

    if (reviewConversation) {
      await prisma.messages.create({
        data: {
          id: randomUUID(),
          content: `📝 **Review Submitted via Bot**\n\n**Reviewer:** ${assignment.users.name || assignment.users.email}\n\n**Recommendation:** ${recommendation}\n\n**Review:**\n${reviewContent}${score ? `\n\n**Score:** ${score}/10` : ''}`,
          conversationId: reviewConversation.id,
          authorId: userId,
          privacy: 'PUBLIC',
          isBot: true,
          updatedAt: new Date(),
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
        await prisma.messages.create({
          data: {
            id: randomUUID(),
            content: `🔒 **Confidential Comments (via Bot)**\n\n${confidentialComments}`,
            conversationId: reviewConversation.id,
            authorId: userId,
            privacy: 'EDITOR_ONLY',
            isBot: true,
            updatedAt: new Date(),
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

  private async handleMakeEditorialDecision(data: any, context: ActionContext): Promise<void> {
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
        // Set publishedAt if accepted
        ...(status === 'ACCEPTED' && { publishedAt: new Date() })
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
        
        const recommendations = manuscript.review_assignments.reduce((acc, review) => {
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
    const authorEmails = manuscript.manuscript_authors.map(ar => ar.users.email);
    for (const email of authorEmails) {
      try {
        await this.sendDecisionEmail(email, manuscript, decision, conversationId);
      } catch (emailError) {
        console.error(`Failed to send decision email to ${email}:`, emailError);
      }
    }

    // If revision requested, create author conversation
    if (status === 'REVISION_REQUESTED') {
      await this.createRevisionConversation(manuscriptId, userId, revisionType);
    }

    console.log(`Editorial decision '${decision}' made for manuscript ${manuscriptId} via bot`);
  }

  private async sendDecisionEmail(email: string, manuscript: any, decision: string, conversationId: string): Promise<void> {
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

  private async createRevisionConversation(manuscriptId: string, editorId: string, revisionType?: string): Promise<void> {
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

  private async handleAssignActionEditor(data: any, context: ActionContext): Promise<void> {
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

  private async handleExecutePublicationWorkflow(data: any, context: ActionContext): Promise<void> {
    const { manuscriptId, acceptedDate, reason, triggeredBy } = data;
    const { userId, conversationId } = context;

    console.log(`Starting publication workflow for manuscript ${manuscriptId}`);

    // Get manuscript with current status
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

    // Verify manuscript is in correct status for publication
    if (manuscript.status !== 'ACCEPTED') {
      throw new Error(`Cannot execute publication workflow. Manuscript status is ${manuscript.status}, expected ACCEPTED`);
    }

    // Step 1: Generate DOI if not already assigned
    let doi = manuscript.doi;
    if (!doi) {
      doi = await this.generateDOI(manuscriptId);
      console.log(`Generated DOI for manuscript ${manuscriptId}: ${doi}`);
    }

    // Step 2: Update manuscript to PUBLISHED status with publication metadata
    const publishedManuscript = await prisma.manuscripts.update({
      where: { id: manuscriptId },
      data: {
        status: 'PUBLISHED',
        publishedAt: new Date(),
        doi: doi,
        updatedAt: new Date()
      }
    });

    // Step 2.5: Publish assets to static hosting for better performance
    try {
      const { publishedAssetManager } = await import('./publishedAssetManager');
      await publishedAssetManager.publishManuscriptAssets(manuscriptId);
      console.log(`Assets published to static hosting for manuscript: ${manuscriptId}`);
    } catch (error) {
      console.error(`Failed to publish assets to static hosting for manuscript ${manuscriptId}:`, error);
      // Continue with publication - asset publishing failure shouldn't block publication
    }

    // Step 3: Create publication workflow completion message
    const publicationMessage = `🚀 **Publication Workflow Completed**\n\n` +
      `**Manuscript:** ${manuscript.title}\n` +
      `**DOI:** ${doi}\n` +
      `**Published:** ${new Date().toLocaleString()}\n` +
      `**Triggered by:** ${triggeredBy}\n` +
      `${reason ? `**Acceptance reason:** ${reason}\n` : ''}` +
      `\n✅ **Manuscript is now published and publicly available**\n` +
      `📊 **Publication metrics and indexing will be processed automatically**`;

    // Step 4: Add publication message to editorial conversation
    const editorialConversation = await prisma.conversations.findFirst({
      where: {
        manuscriptId,
        type: 'EDITORIAL'
      }
    });

    if (editorialConversation) {
      await prisma.messages.create({
        data: {
          id: randomUUID(),
          content: publicationMessage,
          conversationId: editorialConversation.id,
          authorId: userId,
          privacy: 'EDITOR_ONLY',
          isBot: true,
          updatedAt: new Date(),
          metadata: {
            type: 'publication_workflow_completed',
            doi,
            publishedAt: publishedManuscript.publishedAt?.toISOString(),
            triggeredBy,
            reason,
            via: 'bot'
          }
        }
      });
    }

    // Step 5: Send publication notification emails to authors
    const authorEmails = manuscript.manuscript_authors.map(ar => ar.users.email);
    for (const email of authorEmails) {
      try {
        await this.sendPublicationEmail(email, publishedManuscript, doi, conversationId);
        console.log(`Publication notification sent to ${email}`);
      } catch (emailError) {
        console.error(`Failed to send publication email to ${email}:`, emailError);
      }
    }

    // Step 6: Broadcast publication event via SSE
    await broadcastToConversation(conversationId, {
      type: 'manuscript-published',
      manuscript: {
        id: manuscriptId,
        title: manuscript.title,
        doi,
        publishedAt: publishedManuscript.publishedAt?.toISOString(),
        status: 'PUBLISHED'
      }
    }, manuscriptId);

    console.log(`Publication workflow completed for manuscript ${manuscriptId}. DOI: ${doi}`);
  }

  private async generateDOI(manuscriptId: string): Promise<string> {
    // Generate a DOI-like identifier for the manuscript
    // In a real implementation, this would integrate with a DOI service like CrossRef
    const timestamp = Date.now();
    const shortId = manuscriptId.substring(0, 8);
    return `10.1000/colloquium.${timestamp}.${shortId}`;
  }

  private async sendPublicationEmail(email: string, manuscript: any, doi: string, conversationId: string): Promise<void> {
    const subject = `🎉 Published: ${manuscript.title}`;
    
    const htmlContent = `
      <div style="max-width: 600px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <h1 style="color: #16a34a; margin-bottom: 24px;">
          🎉 Your manuscript has been published!
        </h1>
        
        <div style="background-color: #f0f9ff; padding: 20px; margin: 24px 0; border-radius: 6px; border-left: 4px solid #0284c7;">
          <h2 style="margin-top: 0; color: #0c4a6e;">${manuscript.title}</h2>
          <p><strong>DOI:</strong> <a href="https://doi.org/${doi}" style="color: #0284c7;">${doi}</a></p>
          <p><strong>Published:</strong> ${manuscript.publishedAt ? new Date(manuscript.publishedAt).toLocaleDateString() : new Date().toLocaleDateString()}</p>
          <p><strong>Status:</strong> Published</p>
        </div>
        
        <div style="background-color: #d1fae5; padding: 16px; margin: 24px 0; border-radius: 6px; border-left: 4px solid #10b981;">
          <h3 style="margin-top: 0; color: #065f46;">🚀 What happens next?</h3>
          <ul style="margin-bottom: 0; color: #065f46;">
            <li>Your manuscript is now publicly available</li>
            <li>It will be indexed by search engines and academic databases</li>
            <li>Citation metrics will be tracked automatically</li>
            <li>The DOI link will resolve to your published work</li>
          </ul>
        </div>
        
        <div style="margin: 32px 0;">
          <a href="${process.env.FRONTEND_URL}/manuscripts/${manuscript.id}" 
             style="display: inline-block; background-color: #16a34a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-right: 16px;">
            View Published Manuscript
          </a>
          <a href="${process.env.FRONTEND_URL}/conversations/${conversationId}" 
             style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
            View Conversation
          </a>
        </div>
        
        <p style="color: #6b7280; font-size: 14px; margin-top: 32px;">
          This publication was processed via Editorial Bot automation.
        </p>
      </div>
    `;

    const textContent = `
🎉 Your manuscript has been published!

Title: ${manuscript.title}
DOI: ${doi}
Published: ${manuscript.publishedAt ? new Date(manuscript.publishedAt).toLocaleDateString() : new Date().toLocaleDateString()}

Your manuscript is now publicly available and will be indexed by search engines and academic databases.

View published manuscript: ${process.env.FRONTEND_URL}/manuscripts/${manuscript.id}
View conversation: ${process.env.FRONTEND_URL}/conversations/${conversationId}

This publication was processed via Editorial Bot automation.
    `;

    await transporter.sendMail({
      from: process.env.FROM_EMAIL || 'noreply@colloquium.example.com',
      to: email,
      subject,
      html: htmlContent,
      text: textContent
    });
  }

  private async handleUpdateWorkflowPhase(data: any, context: ActionContext): Promise<void> {
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
        a => a.status !== 'COMPLETED'
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
      const authorEmails = manuscript.manuscript_authors.map(a => a.users.email);
      for (const email of authorEmails) {
        try {
          await this.sendReleaseNotificationEmail(email, manuscript, decision, conversationId);
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
            await this.sendDeliberationNotificationEmail(reviewer.email, manuscript, conversationId);
          }
        } catch (emailError) {
          console.error(`Failed to send deliberation notification:`, emailError);
        }
      }
    }

    console.log(`Workflow phase updated for manuscript ${manuscriptId}: ${phase}`);
  }

  private async sendReleaseNotificationEmail(email: string, manuscript: any, decision: string | undefined, conversationId: string): Promise<void> {
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

  private async sendDeliberationNotificationEmail(email: string, manuscript: any, conversationId: string): Promise<void> {
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

  private async handleSendManualReminder(
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
    const { sendManualReminder } = await import('./deadlineReminderProcessor');

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

}

export const botActionProcessor = new BotActionProcessor();
