import { Router } from 'express';
import { prisma } from '@colloquium/database';
import { validateRequest, asyncHandler } from '../middleware/validation';
import { MessageUpdateSchema, IdSchema } from '../schemas/validation';
import { requireAuth } from '../middleware/auth';
import { z } from 'zod';

const router = Router();

// PUT /api/messages/:id - Edit message
router.put('/:id', 
  requireAuth,
  validateRequest({
    params: z.object({ id: IdSchema }),
    body: MessageUpdateSchema
  }),
  asyncHandler(async (req: any, res: any) => {
    const { id } = req.params;
    const { content } = req.body;
    const userId = req.user.id;

    // Check if message exists and user owns it
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

    if (existingMessage.authorId !== userId) {
      return res.status(403).json({
        error: {
          message: 'You can only edit your own messages',
          type: 'ForbiddenError'
        }
      });
    }

    // Check if message is too old to edit (24 hours)
    const hoursSinceCreated = (Date.now() - existingMessage.createdAt.getTime()) / (1000 * 60 * 60);
    if (hoursSinceCreated > 24) {
      return res.status(400).json({
        error: {
          message: 'Messages can only be edited within 24 hours of creation',
          type: 'ValidationError'
        }
      });
    }

    // Update the message
    const updatedMessage = await prisma.message.update({
      where: { id },
      data: {
        content,
        editedAt: new Date()
      },
      include: {
        author: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    res.json({
      message: 'Message updated successfully',
      data: updatedMessage
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