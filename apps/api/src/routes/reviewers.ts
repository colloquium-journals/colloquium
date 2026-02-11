import { Router } from 'express';
import { prisma } from '@colloquium/database';
import { requireAuth, requireAnyRole, optionalAuth, authenticateWithBots } from '../middleware/auth';
import { generateUniqueUsername } from '../utils/usernameGeneration';
import { validateRequest, asyncHandler } from '../middleware/validation';
import { z } from 'zod';
import { 
  ReviewAssignmentCreateSchema, 
  ReviewAssignmentUpdateSchema,
  ReviewerInvitationSchema,
  ReviewerSearchSchema,
  BulkReviewerAssignmentSchema,
  ReviewInvitationResponseSchema,
  ReviewSubmissionSchema,
  IdSchema,
  PaginationSchema
} from '../schemas/validation';
import { transporter } from '../services/emailService';
import { errors } from '../utils/errorResponse';
import { BotEventName } from '@colloquium/types';
import { dispatchBotEvent } from '../services/botEventDispatcher';

const router = Router();

// GET /api/reviewers/search - Search for potential reviewers
router.get('/search',
  requireAuth,
  (req, res, next) => {
    const { GlobalRole } = require('@colloquium/auth');
    return requireAnyRole([GlobalRole.ADMIN, GlobalRole.EDITOR_IN_CHIEF, GlobalRole.MANAGING_EDITOR])(req, res, next);
  },
  validateRequest({
    query: ReviewerSearchSchema
  }),
  asyncHandler(async (req: any, res: any) => {
    const { query, manuscriptId, excludeConflicts, limit } = req.query;

    // Build search conditions
    const searchConditions: any = {
      OR: [
        { name: { contains: query, mode: 'insensitive' } },
        { email: { contains: query, mode: 'insensitive' } },
        { bio: { contains: query, mode: 'insensitive' } },
        { affiliation: { contains: query, mode: 'insensitive' } }
      ],
      role: { in: ['USER', 'MANAGING_EDITOR', 'EDITOR_IN_CHIEF'] } // Potential reviewers
    };

    // Exclude users who already have assignments for this manuscript
    if (manuscriptId && excludeConflicts) {
      const existingAssignments = await prisma.review_assignments.findMany({
        where: { manuscriptId },
        select: { reviewerId: true }
      });
      
      const assignedReviewerIds = existingAssignments.map(a => a.reviewerId);
      if (assignedReviewerIds.length > 0) {
        searchConditions.id = { notIn: assignedReviewerIds };
      }

      // Also exclude manuscript authors
      const manuscript = await prisma.manuscripts.findUnique({
        where: { id: manuscriptId },
        include: { manuscript_authors: true }
      });

      if (manuscript) {
        const authorIds = manuscript.manuscript_authors.map(ar => ar.userId);
        if (authorIds.length > 0) {
          searchConditions.id = searchConditions.id || {};
          searchConditions.id.notIn = [...(searchConditions.id.notIn || []), ...authorIds];
        }
      }
    }

    const reviewers = await prisma.users.findMany({
      where: searchConditions,
      select: {
        id: true,
        name: true,
        email: true,
        bio: true,
        affiliation: true,
        orcidId: true,
        createdAt: true
      },
      take: limit,
      orderBy: [
        { name: 'asc' },
        { email: 'asc' }
      ]
    });

    res.json({
      reviewers,
      total: reviewers.length,
      query: {
        query,
        manuscriptId,
        excludeConflicts,
        limit
      }
    });
  })
);

// POST /api/reviewers/invite - Send reviewer invitations
router.post('/invite',
  requireAuth,
  (req, res, next) => {
    const { GlobalRole } = require('@colloquium/auth');
    return requireAnyRole([GlobalRole.ADMIN, GlobalRole.EDITOR_IN_CHIEF, GlobalRole.MANAGING_EDITOR])(req, res, next);
  },
  validateRequest({
    body: ReviewerInvitationSchema
  }),
  asyncHandler(async (req: any, res: any) => {
    const { manuscriptId, reviewerEmails, dueDate, message, autoAssign } = req.body;
    const inviterId = req.user.id;

    // Verify manuscript exists and user has permission
    const manuscript = await prisma.manuscripts.findUnique({
      where: { id: manuscriptId },
      include: {
        manuscript_authors: {
          include: { users: true }
        }
      }
    });

    if (!manuscript) {
      return errors.notFound(res, 'Manuscript not found');
    }

    const results = {
      successful: [] as any[],
      failed: [] as any[],
      alreadyInvited: [] as any[]
    };

    for (const email of reviewerEmails) {
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
              id: require('crypto').randomUUID(),
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
            id: require('crypto').randomUUID(),
            manuscriptId,
            reviewerId: reviewer.id,
            status: autoAssign ? 'ACCEPTED' : 'PENDING',
            dueDate: dueDate ? new Date(dueDate) : undefined
          }
        });

        // Send invitation email
        if (!autoAssign) {
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
                  
                  ${message ? `
                    <div style="background-color: #f9fafb; padding: 16px; margin: 24px 0; border-radius: 6px;">
                      <h3 style="margin-top: 0;">Message from Editor:</h3>
                      <p style="margin-bottom: 0;">${message}</p>
                    </div>
                  ` : ''}
                  
                  <p><strong>Review due date:</strong> ${dueDate ? new Date(dueDate).toLocaleDateString() : 'To be determined'}</p>
                  
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
                    If you cannot click the buttons above, visit: ${invitationUrl}
                  </p>
                </div>
              `,
              text: `
Review Invitation

You have been invited to review: ${manuscript.title}

${message ? `Message from Editor: ${message}\n\n` : ''}

Review due: ${dueDate ? new Date(dueDate).toLocaleDateString() : 'To be determined'}

Accept: ${invitationUrl}?action=accept
Decline: ${invitationUrl}?action=decline
              `
            });
          } catch (emailError) {
            console.error('Failed to send review invitation:', emailError);
          }
        }

        results.successful.push({
          email,
          reviewerId: reviewer.id,
          assignmentId: assignment.id,
          status: assignment.status
        });

        // Fire-and-forget: dispatch reviewer.assigned event
        setImmediate(async () => {
          try {
            await dispatchBotEvent(BotEventName.REVIEWER_ASSIGNED, manuscriptId, {
              reviewerId: reviewer.id,
              dueDate: dueDate || null,
              status: assignment.status,
            });
          } catch (err) {
            console.error('Failed to dispatch reviewer.assigned event:', err);
          }
        });

      } catch (error) {
        console.error(`Failed to invite reviewer ${email}:`, error);
        results.failed.push({
          email,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    res.json({
      message: `Sent ${results.successful.length} invitations successfully`,
      results
    });
  })
);

// POST /api/reviewers/assign - Assign reviewer directly (no invitation)
router.post('/assign',
  requireAuth,
  (req, res, next) => {
    const { GlobalRole } = require('@colloquium/auth');
    return requireAnyRole([GlobalRole.ADMIN, GlobalRole.EDITOR_IN_CHIEF, GlobalRole.MANAGING_EDITOR])(req, res, next);
  },
  validateRequest({
    body: ReviewAssignmentCreateSchema
  }),
  asyncHandler(async (req: any, res: any) => {
    const { manuscriptId, reviewerId, dueDate, message } = req.body;

    // Verify manuscript exists
    const manuscript = await prisma.manuscripts.findUnique({
      where: { id: manuscriptId }
    });

    if (!manuscript) {
      return errors.notFound(res, 'Manuscript not found');
    }

    // Verify reviewer exists
    const reviewer = await prisma.users.findUnique({
      where: { id: reviewerId }
    });

    if (!reviewer) {
      return errors.notFound(res, 'Reviewer not found');
    }

    // Check if already assigned
    const existingAssignment = await prisma.review_assignments.findUnique({
      where: {
        manuscriptId_reviewerId: {
          manuscriptId,
          reviewerId
        }
      }
    });

    if (existingAssignment) {
      return errors.conflict(res, 'Reviewer is already assigned to this manuscript');
    }

    // Create assignment
    const assignment = await prisma.review_assignments.create({
      data: {
        id: require('crypto').randomUUID(),
        manuscriptId,
        reviewerId,
        status: 'ACCEPTED',
        dueDate: dueDate ? new Date(dueDate) : undefined
      },
      include: {
        users: {
          select: { id: true, name: true, email: true }
        },
        manuscripts: {
          select: { id: true, title: true }
        }
      }
    });

    res.status(201).json({
      message: 'Reviewer assigned successfully',
      assignment
    });

    // Fire-and-forget: dispatch reviewer.assigned event
    setImmediate(async () => {
      try {
        await dispatchBotEvent(BotEventName.REVIEWER_ASSIGNED, manuscriptId, {
          reviewerId,
          dueDate: dueDate || null,
          status: 'ACCEPTED',
        });
      } catch (err) {
        console.error('Failed to dispatch reviewer.assigned event:', err);
      }
    });
  })
);

// GET /api/reviewers/assignments/:manuscriptId - Get review assignments for a manuscript
router.get('/assignments/:manuscriptId',
  authenticateWithBots,
  (req: any, res, next) => {
    if (req.botContext) return next();
    const { GlobalRole } = require('@colloquium/auth');
    return requireAnyRole([GlobalRole.ADMIN, GlobalRole.EDITOR_IN_CHIEF, GlobalRole.MANAGING_EDITOR])(req, res, next);
  },
  validateRequest({
    params: z.object({ manuscriptId: IdSchema })
  }),
  asyncHandler(async (req: any, res: any) => {
    const { manuscriptId } = req.params;

    const assignments = await prisma.review_assignments.findMany({
      where: { manuscriptId },
      include: {
        users: {
          select: {
            id: true,
            name: true,
            email: true,
            affiliation: true,
            orcidId: true
          }
        }
      },
      orderBy: { assignedAt: 'desc' }
    });

    res.json({
      assignments,
      summary: {
        total: assignments.length,
        pending: assignments.filter(a => a.status === 'PENDING').length,
        accepted: assignments.filter(a => a.status === 'ACCEPTED').length,
        declined: assignments.filter(a => a.status === 'DECLINED').length,
        inProgress: assignments.filter(a => a.status === 'IN_PROGRESS').length,
        completed: assignments.filter(a => a.status === 'COMPLETED').length
      }
    });
  })
);

// PUT /api/reviewers/assignments/:id - Update review assignment
router.put('/assignments/:id',
  requireAuth,
  validateRequest({
    params: z.object({ id: IdSchema }),
    body: ReviewAssignmentUpdateSchema
  }),
  asyncHandler(async (req: any, res: any) => {
    const { id } = req.params;
    const { status, dueDate, completedAt } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Get the assignment
    const assignment = await prisma.review_assignments.findUnique({
      where: { id },
      include: {
        users: true,
        manuscripts: true
      }
    });

    if (!assignment) {
      return errors.notFound(res, 'Review assignment not found');
    }

    // Check permissions: reviewer can update their own assignments, editors can update any
    const canUpdate = assignment.reviewerId === userId || 
                     ['ADMIN', 'EDITOR_IN_CHIEF', 'MANAGING_EDITOR'].includes(userRole);

    if (!canUpdate) {
      return errors.forbidden(res, 'You do not have permission to update this assignment');
    }

    // Update the assignment
    const updateData: any = {};
    if (status !== undefined) updateData.status = status;
    if (dueDate !== undefined) updateData.dueDate = new Date(dueDate);
    if (completedAt !== undefined) updateData.completedAt = new Date(completedAt);

    // Auto-set completion date when status changes to COMPLETED
    if (status === 'COMPLETED' && !completedAt) {
      updateData.completedAt = new Date();
    }

    const previousStatus = assignment.status;
    const updatedAssignment = await prisma.review_assignments.update({
      where: { id },
      data: updateData,
      include: {
        users: {
          select: { id: true, name: true, email: true }
        },
        manuscripts: {
          select: { id: true, title: true }
        }
      }
    });

    res.json({
      message: 'Review assignment updated successfully',
      assignment: updatedAssignment
    });

    // Fire-and-forget: dispatch reviewer.statusChanged event if status changed
    if (status && status !== previousStatus) {
      setImmediate(async () => {
        try {
          await dispatchBotEvent(BotEventName.REVIEWER_STATUS_CHANGED, assignment.manuscriptId, {
            reviewerId: assignment.reviewerId,
            previousStatus,
            newStatus: status,
          });
        } catch (err) {
          console.error('Failed to dispatch reviewer.statusChanged event:', err);
        }
      });
    }
  })
);

// DELETE /api/reviewers/assignments/:id - Remove review assignment
router.delete('/assignments/:id',
  requireAuth,
  (req, res, next) => {
    const { GlobalRole } = require('@colloquium/auth');
    return requireAnyRole([GlobalRole.ADMIN, GlobalRole.EDITOR_IN_CHIEF, GlobalRole.MANAGING_EDITOR])(req, res, next);
  },
  validateRequest({
    params: z.object({ id: IdSchema })
  }),
  asyncHandler(async (req: any, res: any) => {
    const { id } = req.params;

    const assignment = await prisma.review_assignments.findUnique({
      where: { id }
    });

    if (!assignment) {
      return errors.notFound(res, 'Review assignment not found');
    }

    await prisma.review_assignments.delete({
      where: { id }
    });

    res.json({
      message: 'Review assignment removed successfully'
    });
  })
);

// POST /api/reviewers/bulk-assign - Bulk assign reviewers
router.post('/bulk-assign',
  requireAuth,
  (req, res, next) => {
    const { GlobalRole } = require('@colloquium/auth');
    return requireAnyRole([GlobalRole.ADMIN, GlobalRole.EDITOR_IN_CHIEF, GlobalRole.MANAGING_EDITOR])(req, res, next);
  },
  validateRequest({
    body: BulkReviewerAssignmentSchema
  }),
  asyncHandler(async (req: any, res: any) => {
    const { manuscriptId, assignments } = req.body;

    // Verify manuscript exists
    const manuscript = await prisma.manuscripts.findUnique({
      where: { id: manuscriptId }
    });

    if (!manuscript) {
      return errors.notFound(res, 'Manuscript not found');
    }

    const results = {
      successful: [] as any[],
      failed: [] as any[],
      skipped: [] as any[]
    };

    for (const assignment of assignments) {
      try {
        // Check if reviewer exists
        const reviewer = await prisma.users.findUnique({
          where: { id: assignment.reviewerId }
        });

        if (!reviewer) {
          results.failed.push({
            reviewerId: assignment.reviewerId,
            error: 'Reviewer not found'
          });
          continue;
        }

        // Check if already assigned
        const existing = await prisma.review_assignments.findUnique({
          where: {
            manuscriptId_reviewerId: {
              manuscriptId,
              reviewerId: assignment.reviewerId
            }
          }
        });

        if (existing) {
          results.skipped.push({
            reviewerId: assignment.reviewerId,
            reason: 'Already assigned'
          });
          continue;
        }

        // Create assignment
        const newAssignment = await prisma.review_assignments.create({
          data: {
            id: require('crypto').randomUUID(),
            manuscriptId,
            reviewerId: assignment.reviewerId,
            status: 'ACCEPTED',
            dueDate: assignment.dueDate ? new Date(assignment.dueDate) : undefined
          },
          include: {
            users: {
              select: { id: true, name: true, email: true }
            }
          }
        });

        results.successful.push(newAssignment);

        // Fire-and-forget: dispatch reviewer.assigned event
        setImmediate(async () => {
          try {
            await dispatchBotEvent(BotEventName.REVIEWER_ASSIGNED, manuscriptId, {
              reviewerId: assignment.reviewerId,
              dueDate: assignment.dueDate || null,
              status: 'ACCEPTED',
            });
          } catch (err) {
            console.error('Failed to dispatch reviewer.assigned event:', err);
          }
        });

      } catch (error) {
        results.failed.push({
          reviewerId: assignment.reviewerId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    res.json({
      message: `Successfully assigned ${results.successful.length} reviewers`,
      results
    });
  })
);

// POST /api/reviewers/invitations/:id/respond - Respond to review invitation
router.post('/invitations/:id/respond',
  requireAuth,
  validateRequest({
    params: z.object({ id: IdSchema }),
    body: ReviewInvitationResponseSchema
  }),
  asyncHandler(async (req: any, res: any) => {
    const { id } = req.params;
    const { response, message, availableUntil } = req.body;
    const userId = req.user.id;

    // Find the review assignment
    const assignment = await prisma.review_assignments.findUnique({
      where: { id },
      include: {
        users: true,
        manuscripts: {
          include: {
            manuscript_authors: {
              include: { users: true }
            }
          }
        }
      }
    });

    if (!assignment) {
      return errors.notFound(res, 'Review invitation not found');
    }

    // Verify the user is the assigned reviewer
    if (assignment.reviewerId !== userId) {
      return errors.forbidden(res, 'You can only respond to your own review invitations');
    }

    // Check if already responded
    if (assignment.status !== 'PENDING') {
      return errors.validation(res, `You have already ${assignment.status.toLowerCase()} this review invitation`);
    }

    // Update the assignment status
    const newStatus = response === 'ACCEPT' ? 'IN_PROGRESS' : 'DECLINED';
    const updatedAssignment = await prisma.review_assignments.update({
      where: { id },
      data: {
        status: newStatus,
        ...(response === 'ACCEPT' && availableUntil && { dueDate: new Date(availableUntil) })
      },
      include: {
        users: {
          select: { id: true, name: true, email: true }
        },
        manuscripts: {
          select: { id: true, title: true }
        }
      }
    });

    // Fire-and-forget: dispatch reviewer.statusChanged event
    setImmediate(async () => {
      try {
        await dispatchBotEvent(BotEventName.REVIEWER_STATUS_CHANGED, assignment.manuscriptId, {
          reviewerId: assignment.reviewerId,
          previousStatus: 'PENDING',
          newStatus,
        });
      } catch (err) {
        console.error('Failed to dispatch reviewer.statusChanged event:', err);
      }
    });

    // Create a message in the manuscript's editorial conversation to notify editors
    const editorialConversation = await prisma.conversations.findFirst({
      where: {
        manuscriptId: assignment.manuscriptId,
        type: 'EDITORIAL'
      }
    });

    if (editorialConversation) {
      const responseMessage = response === 'ACCEPT'
        ? `✅ **Review Invitation Accepted**\n\n**Reviewer:** ${assignment.users.name || assignment.users.email}\n**Manuscript:** ${assignment.manuscripts.title}${message ? `\n**Message:** ${message}` : ''}`
        : `❌ **Review Invitation Declined**\n\n**Reviewer:** ${assignment.users.name || assignment.users.email}\n**Manuscript:** ${assignment.manuscripts.title}${message ? `\n**Reason:** ${message}` : ''}`;

      await prisma.messages.create({
        data: {
          id: require('crypto').randomUUID(),
          content: responseMessage,
          conversationId: editorialConversation.id,
          authorId: userId,
          privacy: 'EDITOR_ONLY',
          updatedAt: new Date(),
          metadata: {
            type: 'review_invitation_response',
            assignmentId: assignment.id,
            response: newStatus
          }
        }
      });
    }

    // Send notification email to editors
    try {
      const editors = await prisma.users.findMany({
        where: {
          role: { in: ['ADMIN', 'EDITOR_IN_CHIEF', 'ACTION_EDITOR'] }
        },
        select: { email: true, name: true }
      });

      const emailSubject = `Review ${response === 'ACCEPT' ? 'Accepted' : 'Declined'}: ${assignment.manuscripts.title}`;
      const emailContent = `
        <h2>Review Invitation ${response === 'ACCEPT' ? 'Accepted' : 'Declined'}</h2>
        <p><strong>Reviewer:</strong> ${assignment.users.name || assignment.users.email}</p>
        <p><strong>Manuscript:</strong> ${assignment.manuscripts.title}</p>
        ${message ? `<p><strong>${response === 'ACCEPT' ? 'Message' : 'Reason'}:</strong> ${message}</p>` : ''}
        ${response === 'ACCEPT' && availableUntil ? `<p><strong>Available until:</strong> ${new Date(availableUntil).toLocaleDateString()}</p>` : ''}
      `;

      for (const editor of editors) {
        await transporter.sendMail({
          from: process.env.FROM_EMAIL || 'noreply@colloquium.example.com',
          to: editor.email,
          subject: emailSubject,
          html: `
            <div style="max-width: 600px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
              <h1 style="color: #2563eb; margin-bottom: 24px;">Review Response Notification</h1>
              ${emailContent}
              <p style="color: #6b7280; font-size: 14px; margin-top: 24px;">
                This is an automated notification from the Colloquium editorial system.
              </p>
            </div>
          `,
          text: `Review Invitation ${response}\n\nReviewer: ${assignment.users.name || assignment.users.email}\nManuscript: ${assignment.manuscripts.title}${message ? `\n${response === 'ACCEPT' ? 'Message' : 'Reason'}: ${message}` : ''}`
        });
      }
    } catch (emailError) {
      console.error('Failed to send editor notification email:', emailError);
    }

    res.json({
      message: `Review invitation ${response === 'ACCEPT' ? 'accepted' : 'declined'} successfully`,
      assignment: updatedAssignment,
      status: newStatus
    });
  })
);

// POST /api/reviewers/assignments/:id/submit - Submit review
router.post('/assignments/:id/submit',
  requireAuth,
  validateRequest({
    params: z.object({ id: IdSchema }),
    body: ReviewSubmissionSchema
  }),
  asyncHandler(async (req: any, res: any) => {
    const { id } = req.params;
    const { reviewContent, recommendation, confidentialComments, score, attachments } = req.body;
    const userId = req.user.id;

    // Find the review assignment
    const assignment = await prisma.review_assignments.findUnique({
      where: { id },
      include: {
        users: true,
        manuscripts: {
          include: {
            manuscript_authors: {
              include: { users: true }
            }
          }
        }
      }
    });

    if (!assignment) {
      return errors.notFound(res, 'Review assignment not found');
    }

    // Verify the user is the assigned reviewer
    if (assignment.reviewerId !== userId) {
      return errors.forbidden(res, 'You can only submit reviews for your own assignments');
    }

    // Check if review is in the right status
    if (!['ACCEPTED', 'IN_PROGRESS'].includes(assignment.status)) {
      return errors.validation(res, `Cannot submit review for assignment with status: ${assignment.status}`);
    }

    // Update assignment to completed
    const previousStatus = assignment.status;
    const updatedAssignment = await prisma.review_assignments.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date()
      }
    });

    // Fire-and-forget: dispatch reviewer.statusChanged event
    setImmediate(async () => {
      try {
        await dispatchBotEvent(BotEventName.REVIEWER_STATUS_CHANGED, assignment.manuscriptId, {
          reviewerId: assignment.reviewerId,
          previousStatus,
          newStatus: 'COMPLETED',
        });
      } catch (err) {
        console.error('Failed to dispatch reviewer.statusChanged event:', err);
      }
    });

    // Create review submission record (you might want to add this to your schema)
    const reviewSubmission = {
      assignmentId: id,
      reviewContent,
      recommendation,
      confidentialComments,
      score,
      attachments,
      submittedAt: new Date()
    };

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
          id: require('crypto').randomUUID(),
          content: `📝 **Review Submitted**\n\n**Reviewer:** ${assignment.users.name || assignment.users.email}\n\n**Recommendation:** ${recommendation}\n\n**Review:**\n${reviewContent}${score ? `\n\n**Score:** ${score}/10` : ''}`,
          conversationId: reviewConversation.id,
          authorId: userId,
          privacy: 'AUTHOR_VISIBLE',
          updatedAt: new Date(),
          metadata: {
            type: 'review_submission',
            assignmentId: id,
            recommendation,
            score,
            hasConfidentialComments: !!confidentialComments
          }
        }
      });

      // Create confidential comments for editors only
      if (confidentialComments) {
        await prisma.messages.create({
          data: {
            id: require('crypto').randomUUID(),
            content: `🔒 **Confidential Comments**\n\n${confidentialComments}`,
            conversationId: reviewConversation.id,
            authorId: userId,
            privacy: 'EDITOR_ONLY',
            updatedAt: new Date(),
            metadata: {
              type: 'confidential_review_comments',
              assignmentId: id
            }
          }
        });
      }
    }

    // Notify editors
    try {
      const editors = await prisma.users.findMany({
        where: {
          role: { in: ['ADMIN', 'EDITOR_IN_CHIEF', 'ACTION_EDITOR'] }
        },
        select: { email: true, name: true }
      });

      for (const editor of editors) {
        await transporter.sendMail({
          from: process.env.FROM_EMAIL || 'noreply@colloquium.example.com',
          to: editor.email,
          subject: `Review Submitted: ${assignment.manuscripts.title}`,
          html: `
            <div style="max-width: 600px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
              <h1 style="color: #2563eb; margin-bottom: 24px;">Review Submitted</h1>
              <p><strong>Reviewer:</strong> ${assignment.users.name || assignment.users.email}</p>
              <p><strong>Manuscript:</strong> ${assignment.manuscripts.title}</p>
              <p><strong>Recommendation:</strong> ${recommendation}</p>
              ${score ? `<p><strong>Score:</strong> ${score}/10</p>` : ''}
              <p style="color: #6b7280; font-size: 14px; margin-top: 24px;">
                View the full review in the manuscript conversation.
              </p>
            </div>
          `,
          text: `Review Submitted\n\nReviewer: ${assignment.users.name || assignment.users.email}\nManuscript: ${assignment.manuscripts.title}\nRecommendation: ${recommendation}${score ? `\nScore: ${score}/10` : ''}`
        });
      }
    } catch (emailError) {
      console.error('Failed to send review submission notification:', emailError);
    }

    res.json({
      message: 'Review submitted successfully',
      assignment: updatedAssignment,
      submission: reviewSubmission
    });
  })
);

// GET /api/reviewers/invitations/:id/public - Public endpoint for email-based responses
router.get('/invitations/:id/public',
  optionalAuth,
  validateRequest({
    params: z.object({
      id: IdSchema
    }),
    query: z.object({
      action: z.enum(['accept', 'decline']).optional(),
      token: z.string().optional()
    }).optional()
  }),
  asyncHandler(async (req: any, res: any) => {
    const { id } = req.params;
    const { action } = req.query;

    // Find the review assignment
    const assignment = await prisma.review_assignments.findUnique({
      where: { id },
      include: {
        users: {
          select: { id: true, name: true, email: true }
        },
        manuscripts: {
          select: {
            id: true,
            title: true,
            abstract: true,
            submittedAt: true
          }
        }
      }
    });

    if (!assignment) {
      return errors.notFound(res, 'Review invitation not found');
    }

    // Verify authorization when processing an action (valid token OR matching authenticated user)
    if (action) {
      const { token } = req.query;
      const hasValidToken = token && token === assignment.responseToken;
      const isAuthenticatedReviewer = req.user && req.user.id === assignment.reviewerId;

      if (!hasValidToken && !isAuthenticatedReviewer) {
        if (req.user) {
          return errors.forbidden(res, 'This invitation was sent to another reviewer. Only the invited reviewer can respond.');
        }
        return errors.forbidden(res, 'Invalid or missing invitation token. Please use the link from your invitation email.');
      }
    }

    // Check if invitation is still pending
    if (assignment.status !== 'PENDING') {
      const statusMessage = assignment.status === 'IN_PROGRESS'
        ? 'This invitation has already been accepted.'
        : assignment.status === 'DECLINED'
        ? 'This invitation has already been declined.'
        : `This invitation status is: ${assignment.status}`;

      return errors.validation(res, statusMessage);
    }

    // If action is provided, process the response
    if (action) {
      const newStatus = action === 'accept' ? 'IN_PROGRESS' : 'DECLINED';
      
      try {
        // Update the assignment status
        const updatedAssignment = await prisma.review_assignments.update({
          where: { id },
          data: { status: newStatus },
          include: {
            users: {
              select: { id: true, name: true, email: true }
            },
            manuscripts: {
              select: { id: true, title: true }
            }
          }
        });

        // Fire-and-forget: dispatch reviewer.statusChanged event
        setImmediate(async () => {
          try {
            await dispatchBotEvent(BotEventName.REVIEWER_STATUS_CHANGED, assignment.manuscriptId, {
              reviewerId: assignment.reviewerId,
              previousStatus: 'PENDING',
              newStatus,
            });
          } catch (err) {
            console.error('Failed to dispatch reviewer.statusChanged event:', err);
          }
        });

        // Post bot message to the conversation
        try {
          // Find the conversation for this manuscript
          const conversation = await prisma.conversations.findFirst({
            where: { manuscriptId: updatedAssignment.manuscripts.id }
          });

          if (conversation) {
            // Get the editorial bot user
            const editorialBotUser = await prisma.users.findUnique({
              where: { email: 'editorial-bot@colloquium.bot' }
            });

            if (editorialBotUser) {
              const reviewerName = updatedAssignment.users.name || updatedAssignment.users.email;
              const actionText = newStatus === 'IN_PROGRESS' ? 'accepted' : 'declined';
              const messageContent = `📋 **Reviewer Invitation ${newStatus === 'IN_PROGRESS' ? 'Accepted' : 'Declined'}**\n\n**${reviewerName}** has ${actionText} the review invitation for "${updatedAssignment.manuscripts.title}".`;

              // Create the bot message
              await prisma.messages.create({
                data: {
                  id: require('crypto').randomUUID(),
                  content: messageContent,
                  conversationId: conversation.id,
                  authorId: editorialBotUser.id,
                  privacy: 'EDITOR_ONLY',
                  isBot: true,
                  updatedAt: new Date()
                }
              });
            }
          }
        } catch (botMessageError) {
          console.error('Failed to post bot message:', botMessageError);
        }

        // Broadcast SSE update to manuscript conversations
        try {
          const { broadcastToConversation } = await import('./events');
          await broadcastToConversation(`manuscript-${assignment.manuscriptId}`, {
            type: 'reviewer-invitation-response',
            response: {
              assignmentId: id,
              status: newStatus,
              reviewer: assignment.users,
              manuscriptId: assignment.manuscriptId,
              respondedAt: new Date().toISOString()
            }
          }, assignment.manuscriptId);
        } catch (sseError) {
          console.error('Failed to broadcast SSE update:', sseError);
        }

        // Return success page
        return res.status(200).json({
          message: `Review invitation ${action}ed successfully`,
          status: newStatus,
          reviewer: assignment.users.name || assignment.users.email,
          manuscript: assignment.manuscripts.title,
          redirectUrl: process.env.FRONTEND_URL ? `${process.env.FRONTEND_URL}/review-response-success?status=${newStatus}` : null
        });
        
      } catch (error) {
        console.error('Failed to update invitation status:', error);
        return res.status(500).json({ error: 'Internal Server Error', message: 'Failed to process invitation response' });
      }
    }

    // If no action provided, return invitation details for display
    return res.status(200).json({
      invitation: {
        id: assignment.id,
        status: assignment.status,
        dueDate: assignment.dueDate,
        reviewer: assignment.users,
        manuscript: {
          title: assignment.manuscripts.title,
          abstract: assignment.manuscripts.abstract,
          submittedAt: assignment.manuscripts.submittedAt
        },
        acceptUrl: `${req.protocol}://${req.get('host')}${req.baseUrl}/invitations/${id}/public?action=accept`,
        declineUrl: `${req.protocol}://${req.get('host')}${req.baseUrl}/invitations/${id}/public?action=decline`
      }
    });
  })
);

// POST /api/reviewers/invitations/:id/respond-public - Public endpoint for form-based responses
router.post('/invitations/:id/respond-public',
  optionalAuth,
  validateRequest({
    params: z.object({
      id: IdSchema
    }),
    body: z.object({
      action: z.enum(['accept', 'decline']),
      message: z.string().optional(),
      token: z.string().optional()
    })
  }),
  asyncHandler(async (req: any, res: any) => {
    const { id } = req.params;
    const { action, message, token } = req.body;

    // Find the review assignment
    const assignment = await prisma.review_assignments.findUnique({
      where: { id },
      include: {
        users: {
          select: { id: true, name: true, email: true }
        },
        manuscripts: {
          select: { id: true, title: true }
        }
      }
    });

    if (!assignment) {
      return errors.notFound(res, 'Review invitation not found');
    }

    // Verify authorization (valid token OR matching authenticated user)
    const hasValidToken = token && token === assignment.responseToken;
    const isAuthenticatedReviewer = req.user && req.user.id === assignment.reviewerId;

    if (!hasValidToken && !isAuthenticatedReviewer) {
      if (req.user) {
        return errors.forbidden(res, 'This invitation was sent to another reviewer. Only the invited reviewer can respond.');
      }
      return errors.forbidden(res, 'Invalid or missing invitation token. Please use the link from your invitation email.');
    }

    // Check if invitation is still pending
    if (assignment.status !== 'PENDING') {
      return errors.validation(res, `This invitation has already been ${assignment.status.toLowerCase()}`);
    }

    const newStatus = action === 'accept' ? 'IN_PROGRESS' : 'DECLINED';

    try {
      // Update the assignment status
      const updatedAssignment = await prisma.review_assignments.update({
        where: { id },
        data: { status: newStatus }
      });

      // Fire-and-forget: dispatch reviewer.statusChanged event
      setImmediate(async () => {
        try {
          await dispatchBotEvent(BotEventName.REVIEWER_STATUS_CHANGED, assignment.manuscriptId, {
            reviewerId: assignment.reviewerId,
            previousStatus: 'PENDING',
            newStatus,
          });
        } catch (err) {
          console.error('Failed to dispatch reviewer.statusChanged event:', err);
        }
      });

      // Create notification in editorial conversation
      try {
        const editorialConversation = await prisma.conversations.findFirst({
          where: {
            manuscriptId: assignment.manuscriptId,
            type: 'EDITORIAL'
          }
        });

        if (editorialConversation) {
          const responseMessage = action === 'accept' 
            ? `✅ **Review Invitation Accepted via Email**\n\n**Reviewer:** ${assignment.users.name || assignment.users.email}\n**Manuscript:** ${assignment.manuscripts.title}${message ? `\n**Message:** ${message}` : ''}`
            : `❌ **Review Invitation Declined via Email**\n\n**Reviewer:** ${assignment.users.name || assignment.users.email}\n**Manuscript:** ${assignment.manuscripts.title}${message ? `\n**Reason:** ${message}` : ''}`;

          await prisma.messages.create({
            data: {
              id: require('crypto').randomUUID(),
              content: responseMessage,
              conversationId: editorialConversation.id,
              authorId: assignment.users.id,
              privacy: 'EDITOR_ONLY',
              isBot: true,
              updatedAt: new Date(),
              metadata: {
                type: 'review_invitation_response',
                assignmentId: id,
                response: newStatus,
                via: 'email'
              }
            }
          });
        }
      } catch (conversationError) {
        console.error('Failed to create conversation message:', conversationError);
      }

      // Send notification emails to editors
      try {
        const editors = await prisma.users.findMany({
          where: {
            role: { in: ['ADMIN', 'EDITOR_IN_CHIEF', 'ACTION_EDITOR'] }
          },
          select: { email: true, name: true }
        });

        const emailSubject = `Review ${action === 'accept' ? 'Accepted' : 'Declined'}: ${assignment.manuscripts.title}`;
        
        for (const editor of editors) {
          await transporter.sendMail({
            from: process.env.FROM_EMAIL || 'noreply@colloquium.example.com',
            to: editor.email,
            subject: emailSubject,
            html: `
              <div style="max-width: 600px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                <h1 style="color: #2563eb; margin-bottom: 24px;">Review Response via Email</h1>
                <p><strong>Reviewer:</strong> ${assignment.users.name || assignment.users.email}</p>
                <p><strong>Manuscript:</strong> ${assignment.manuscripts.title}</p>
                <p><strong>Response:</strong> ${action === 'accept' ? 'Accepted' : 'Declined'}</p>
                ${message ? `<p><strong>${action === 'accept' ? 'Message' : 'Reason'}:</strong> ${message}</p>` : ''}
                <p style="color: #6b7280; font-size: 14px; margin-top: 24px;">
                  This response was submitted via email link.
                </p>
              </div>
            `,
            text: `Review ${action === 'accept' ? 'Accepted' : 'Declined'}\n\nReviewer: ${assignment.users.name || assignment.users.email}\nManuscript: ${assignment.manuscripts.title}\nResponse: ${action === 'accept' ? 'Accepted' : 'Declined'}${message ? `\n${action === 'accept' ? 'Message' : 'Reason'}: ${message}` : ''}`
          });
        }
      } catch (emailError) {
        console.error('Failed to send editor notification email:', emailError);
      }

      res.status(200).json({
        message: `Review invitation ${action}ed successfully`,
        status: newStatus,
        reviewer: assignment.users.name || assignment.users.email,
        manuscript: assignment.manuscripts.title
      });

    } catch (error) {
      console.error('Failed to process invitation response:', error);
      res.status(500).json({ error: 'Internal Server Error', message: 'Failed to process invitation response' });
    }
  })
);

// GET /api/reviewers/invitations/:id - Get review invitation details
router.get('/invitations/:id',
  requireAuth,
  validateRequest({
    params: z.object({ id: IdSchema })
  }),
  asyncHandler(async (req: any, res: any) => {
    const { id } = req.params;
    const userId = req.user.id;

    const assignment = await prisma.review_assignments.findUnique({
      where: { id },
      include: {
        users: {
          select: { id: true, name: true, email: true }
        },
        manuscripts: {
          select: {
            id: true,
            title: true,
            abstract: true,
            submittedAt: true,
            manuscript_authors: {
              include: {
                users: {
                  select: {
                    name: true,
                    email: true,
                    affiliation: true
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!assignment) {
      return errors.notFound(res, 'Review invitation not found');
    }

    // Verify the user is the assigned reviewer
    if (assignment.reviewerId !== userId) {
      return errors.forbidden(res, 'You can only view your own review invitations');
    }

    res.json({
      invitation: assignment
    });
  })
);

export default router;