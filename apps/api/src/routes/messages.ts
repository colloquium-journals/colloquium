import { Router } from 'express';
import { prisma } from '@colloquium/database';
import { validateRequest, asyncHandler } from '../middleware/validation';
import { MessageUpdateSchema, IdSchema } from '../schemas/validation';
import { requireAuth, generateBotServiceToken } from '../middleware/auth';
import { canUserSeeMessage } from './conversations';
import { broadcastToConversation } from './events';
import { botExecutor } from '../bots/index';
import { z } from 'zod';
import { BotMessageAction } from '@colloquium/types';

// Enhanced message edit schema with reason
const MessageEditSchema = z.object({
  content: z.string().min(1, 'Content cannot be empty').max(10000, 'Content is too long'),
  reason: z.string().optional()
});

// Privacy update schema
const PrivacyUpdateSchema = z.object({
  privacy: z.enum(['PUBLIC', 'AUTHOR_VISIBLE', 'REVIEWER_ONLY', 'EDITOR_ONLY', 'ADMIN_ONLY'])
});

const router = Router();

// PUT /api/messages/:id - Edit message
router.put('/:id', 
  requireAuth,
  validateRequest({
    params: z.object({ id: IdSchema }),
    body: MessageEditSchema
  }),
  asyncHandler(async (req: any, res: any) => {
    const { id } = req.params;
    const { content, reason } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Check if message exists and get conversation context
    const existingMessage = await prisma.messages.findUnique({
      where: { id },
      include: {
        users: true,
        conversations: {
          include: {
            conversation_participants: {
              include: {
                users: true
              }
            },
            manuscripts: true
          }
        }
      }
    });

    if (!existingMessage) {
      return res.status(404).json({
        error: {
          message: 'Message not found',
          type: 'NotFoundError'
        }
      });
    }

    // Enhanced permission checking
    const isAuthor = existingMessage.authorId === userId;
    const isAdmin = userRole === 'ADMIN';
    const isEditorInChief = userRole === 'EDITOR_IN_CHIEF';
    const isManagingEditor = userRole === 'MANAGING_EDITOR';
    
    // Check if user is a participant in the conversation
    const isParticipant = existingMessage.conversations.conversation_participants.some((p: any) => p.userId === userId);
    
    if (!isAuthor && !isAdmin && !isEditorInChief && !isManagingEditor) {
      return res.status(403).json({
        error: {
          message: 'You do not have permission to edit this message',
          type: 'ForbiddenError'
        }
      });
    }

    if (!isParticipant && !isAdmin && !isEditorInChief && !isManagingEditor) {
      return res.status(403).json({
        error: {
          message: 'You must be a participant in this conversation to edit messages',
          type: 'ForbiddenError'
        }
      });
    }

    // Check if message is too old to edit (24 hours for authors, unlimited for admins/editors)
    const hoursSinceCreated = (Date.now() - existingMessage.createdAt.getTime()) / (1000 * 60 * 60);
    if (isAuthor && hoursSinceCreated > 24) {
      return res.status(400).json({
        error: {
          message: 'You can only edit your own messages within 24 hours of creation',
          type: 'ValidationError'
        }
      });
    }

    // Create edit history record and update message in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // TODO: Implement messageEdit model in database schema
      // For now, skip edit history creation

      // Update the message
      const updatedMessage = await tx.messages.update({
        where: { id },
        data: {
          content,
          editedAt: new Date()
        },
        include: {
          users: {
            select: { id: true, name: true, email: true }
          }
        }
      });

      return updatedMessage;
    });

    res.json({
      message: 'Message updated successfully',
      data: result
    });
  })
);

// GET /api/messages/:id/edit-history - Get message edit history
router.get('/:id/edit-history',
  requireAuth,
  validateRequest({
    params: z.object({ id: IdSchema })
  }),
  asyncHandler(async (req: any, res: any) => {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Check if message exists and user has access
    const message = await prisma.messages.findUnique({
      where: { id },
      include: {
        conversations: {
          include: {
            conversation_participants: true
          }
        }
      }
    });

    if (!message) {
      return res.status(404).json({
        error: {
          message: 'Message not found',
          type: 'NotFoundError'
        }
      });
    }

    // Check permissions
    const isParticipant = message.conversations.conversation_participants.some((p: any) => p.userId === userId);
    const isAdmin = userRole === 'ADMIN';
    const isEditor = userRole === 'EDITOR_IN_CHIEF' || userRole === 'MANAGING_EDITOR';

    if (!isParticipant && !isAdmin && !isEditor) {
      return res.status(403).json({
        error: {
          message: 'You do not have permission to view edit history',
          type: 'ForbiddenError'
        }
      });
    }

    // TODO: Implement messageEdit model in database schema
    // For now, return empty edit history
    const editHistory: any[] = [];

    res.json({
      messageId: id,
      editHistory,
      totalEdits: editHistory.length
    });
  })
);

// PATCH /api/messages/:id/privacy - Update message visibility
router.patch('/:id/privacy',
  requireAuth,
  validateRequest({
    params: z.object({ id: IdSchema }),
    body: PrivacyUpdateSchema
  }),
  asyncHandler(async (req: any, res: any) => {
    const { id } = req.params;
    const { privacy } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Get message with conversation and manuscript context
    const message = await prisma.messages.findUnique({
      where: { id },
      include: {
        users: {
          select: { id: true, name: true, email: true }
        },
        conversations: {
          include: {
            manuscripts: {
              include: {
                action_editors: true
              }
            }
          }
        }
      }
    });

    if (!message) {
      return res.status(404).json({
        error: {
          message: 'Message not found',
          type: 'NotFoundError'
        }
      });
    }

    const manuscriptId = message.conversations.manuscriptId;
    const isAdmin = userRole === 'ADMIN';
    const isEditorInChief = userRole === 'EDITOR_IN_CHIEF';
    const isManagingEditor = userRole === 'MANAGING_EDITOR';
    const isAssignedActionEditor = message.conversations.manuscripts?.action_editors?.editorId === userId;

    // Permission check: Admin, Editor-in-Chief, Managing Editor, or assigned Action Editor
    const hasEditPermission = isAdmin || isEditorInChief || isManagingEditor || isAssignedActionEditor;

    if (!hasEditPermission) {
      return res.status(403).json({
        error: {
          message: 'You do not have permission to change message visibility',
          type: 'ForbiddenError'
        }
      });
    }

    // For action editors: verify they can see the current message
    if (isAssignedActionEditor && !isAdmin && !isEditorInChief && !isManagingEditor) {
      const canSee = await canUserSeeMessage(userId, userRole, message.privacy, manuscriptId);
      if (!canSee) {
        return res.status(403).json({
          error: {
            message: 'You cannot change visibility of a message you cannot see',
            type: 'ForbiddenError'
          }
        });
      }
    }

    // Update the message privacy
    const updatedMessage = await prisma.messages.update({
      where: { id },
      data: {
        privacy: privacy as any,
        updatedAt: new Date()
      },
      include: {
        users: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    // Broadcast the privacy change via SSE
    await broadcastToConversation(message.conversationId, {
      type: 'message-privacy-changed',
      messageId: id,
      privacy,
      updatedBy: { id: userId, name: req.user.name }
    }, manuscriptId);

    res.json({
      message: 'Message visibility updated successfully',
      data: {
        id: updatedMessage.id,
        privacy: updatedMessage.privacy,
        author: updatedMessage.users
      }
    });
  })
);

// DELETE /api/messages/:id - Delete message
router.delete('/:id',
  requireAuth,
  validateRequest({
    params: z.object({ id: IdSchema })
  }),
  asyncHandler(async (req: any, res: any) => {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Check if message exists
    const existingMessage = await prisma.messages.findUnique({
      where: { id },
      include: { users: true }
    });

    if (!existingMessage) {
      return res.status(404).json({
        error: {
          message: 'Message not found',
          type: 'NotFoundError'
        }
      });
    }

    // Check permissions: user owns message OR user is admin/editor
    const canDelete = existingMessage.authorId === userId || 
                     ['ADMIN', 'EDITOR'].includes(userRole);

    if (!canDelete) {
      return res.status(403).json({
        error: {
          message: 'You do not have permission to delete this message',
          type: 'ForbiddenError'
        }
      });
    }

    // Soft delete the message
    await prisma.messages.update({
      where: { id },
      data: {
        deleted: true,
        deletedAt: new Date()
      }
    });

    res.json({
      message: 'Message deleted successfully'
    });
  })
);

// POST /api/messages/:id/actions/:actionId - Trigger a bot message action
router.post('/:id/actions/:actionId',
  requireAuth,
  asyncHandler(async (req: any, res: any) => {
    const { id: messageId, actionId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    const message = await prisma.messages.findUnique({
      where: { id: messageId },
      include: {
        conversations: {
          include: {
            manuscripts: true
          }
        }
      }
    });

    if (!message) {
      return res.status(404).json({
        error: { message: 'Message not found', type: 'NotFoundError' }
      });
    }

    const metadata = message.metadata as any;
    if (!metadata?.actions?.length) {
      return res.status(404).json({
        error: { message: 'No actions found on this message', type: 'NotFoundError' }
      });
    }

    const actions = metadata.actions as BotMessageAction[];
    const action = actions.find(a => a.id === actionId);

    if (!action) {
      return res.status(404).json({
        error: { message: 'Action not found', type: 'NotFoundError' }
      });
    }

    if (action.triggered) {
      return res.status(400).json({
        error: { message: 'This action has already been triggered', type: 'ValidationError' }
      });
    }

    // Authorization check
    if (action.targetUserId && action.targetUserId !== userId) {
      return res.status(403).json({
        error: { message: 'You are not authorized to trigger this action', type: 'ForbiddenError' }
      });
    }

    if (action.targetRoles?.length && !action.targetRoles.includes(userRole)) {
      return res.status(403).json({
        error: { message: 'Your role is not authorized to trigger this action', type: 'ForbiddenError' }
      });
    }

    const manuscriptId = message.conversations.manuscriptId || '';
    const serviceToken = generateBotServiceToken('system', manuscriptId, ['read_manuscript_files', 'upload_files']);

    const handlerResult = await botExecutor.executeActionHandler(
      action.handler.botId,
      action.handler.action,
      action.handler.params,
      {
        manuscriptId,
        conversationId: message.conversationId,
        messageId,
        triggeredBy: { userId, userRole },
        serviceToken
      }
    );

    if (!handlerResult.success) {
      return res.status(400).json({
        error: { message: handlerResult.error || 'Action handler failed', type: 'ActionError' }
      });
    }

    // Update action in metadata
    const updatedActions = actions.map(a => {
      if (a.id === actionId) {
        return {
          ...a,
          triggered: true,
          triggeredBy: userId,
          triggeredAt: new Date().toISOString(),
          ...(handlerResult.updatedLabel && { resultLabel: handlerResult.updatedLabel })
        };
      }
      return a;
    });

    const updatedContent = handlerResult.updatedContent || message.content;
    const updatedMetadata = { ...metadata, actions: updatedActions };

    const updatedMessage = await prisma.messages.update({
      where: { id: messageId },
      data: {
        content: updatedContent,
        metadata: updatedMetadata,
        updatedAt: new Date()
      },
      include: {
        users: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    const formattedMessage = {
      id: updatedMessage.id,
      content: updatedMessage.content,
      privacy: updatedMessage.privacy,
      author: updatedMessage.users,
      createdAt: updatedMessage.createdAt,
      updatedAt: updatedMessage.updatedAt,
      parentId: updatedMessage.parentId,
      isBot: updatedMessage.isBot,
      metadata: updatedMessage.metadata
    };

    await broadcastToConversation(message.conversationId, {
      type: 'message-updated',
      message: formattedMessage
    }, manuscriptId);

    res.json({ data: formattedMessage });
  })
);

export default router;