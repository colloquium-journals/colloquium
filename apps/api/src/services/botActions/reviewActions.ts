import { prisma } from '@colloquium/database';
import { randomUUID } from 'crypto';
import { ActionContext } from '../botActionProcessor';

export async function handleRespondToReview(data: any, context: ActionContext): Promise<void> {
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

export async function handleSubmitReview(data: any, context: ActionContext): Promise<void> {
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
