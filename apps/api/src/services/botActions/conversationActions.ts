import { prisma } from '@colloquium/database';
import { randomUUID } from 'crypto';
import { ActionContext } from '../botActionProcessor';

export async function handleCreateConversation(data: any, context: ActionContext): Promise<void> {
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

export async function handleUpdateManuscriptStatus(data: any, context: ActionContext): Promise<void> {
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
    const { publishedAssetManager } = await import('../publishedAssetManager');

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
