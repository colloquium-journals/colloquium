import { Router } from 'express';
import { prisma } from '@colloquium/database';
import { validateRequest, asyncHandler } from '../middleware/validation';
import { MessageUpdateSchema, IdSchema } from '../schemas/validation';
import { requireAuth } from '../middleware/auth';
import { z } from 'zod';

// Enhanced message edit schema with reason
const MessageEditSchema = z.object({
  content: z.string().min(1, 'Content cannot be empty').max(10000, 'Content is too long'),
  reason: z.string().optional()
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
    const existingMessage = await prisma.message.findUnique({
      where: { id },
      include: { 
        author: true,
        conversation: {
          include: {
            participants: {
              include: {
                user: true
              }
            },
            manuscript: true
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
    const isParticipant = existingMessage.conversation.participants.some(p => p.userId === userId);
    
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
      // Create edit history record
      await tx.messageEdit.create({
        data: {
          messageId: id,
          editorId: userId,
          originalContent: existingMessage.content,
          newContent: content,
          reason: reason || (isAuthor ? 'Author edit' : 'Editor moderation')
        }
      });

      // Update the message
      const updatedMessage = await tx.message.update({
        where: { id },
        data: {
          content,
          editedAt: new Date()
        },
        include: {
          author: {
            select: { id: true, name: true, email: true }
          },
          editHistory: {
            include: {
              editor: {
                select: { id: true, name: true, email: true }
              }
            },
            orderBy: { editedAt: 'desc' }
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
    const message = await prisma.message.findUnique({
      where: { id },
      include: {
        conversation: {
          include: {
            participants: true
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
    const isParticipant = message.conversation.participants.some(p => p.userId === userId);
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

    // Get edit history
    const editHistory = await prisma.messageEdit.findMany({
      where: { messageId: id },
      include: {
        editor: {
          select: { id: true, name: true, email: true }
        }
      },
      orderBy: { editedAt: 'desc' }
    });

    res.json({
      messageId: id,
      editHistory,
      totalEdits: editHistory.length
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
    const existingMessage = await prisma.message.findUnique({
      where: { id },
      include: { author: true }
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
    await prisma.message.update({
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

export default router;