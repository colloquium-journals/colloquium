import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '@colloquium/database';
import { requireAuth } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';

const router = Router();

// Schema for updating checkbox state
const updateCheckboxStateSchema = z.object({
  body: z.object({
    checkboxId: z.string().min(1, 'Checkbox ID is required'),
    checked: z.boolean()
  })
});

// Schema for getting checkbox states
const getCheckboxStatesSchema = z.object({
  query: z.object({
    messageIds: z.string().optional() // Comma-separated list of message IDs
  })
});

/**
 * Update checkbox state for a message
 * PUT /api/messages/:messageId/checkbox-states
 */
router.put('/:messageId/checkbox-states', 
  requireAuth,
  validateRequest(updateCheckboxStateSchema),
  async (req, res) => {
    try {
      const { messageId } = req.params;
      const { checkboxId, checked } = req.body;
      const userId = req.user!.id;

      // Verify the message exists and user has access
      const message = await prisma.message.findFirst({
        where: { 
          id: messageId,
          conversation: {
            participants: {
              some: { userId }
            }
          }
        },
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
          error: 'Message not found or access denied' 
        });
      }

      // Upsert checkbox state
      const checkboxState = await prisma.messageCheckboxState.upsert({
        where: {
          messageId_userId_checkboxId: {
            messageId,
            userId,
            checkboxId
          }
        },
        update: {
          checked,
          updatedAt: new Date()
        },
        create: {
          messageId,
          userId,
          checkboxId,
          checked
        }
      });

      res.json({ success: true, checkboxState });
    } catch (error) {
      console.error('Error updating checkbox state:', error);
      res.status(500).json({ 
        error: 'Failed to update checkbox state' 
      });
    }
  }
);

/**
 * Get checkbox states for messages
 * GET /api/checkbox-states?messageIds=id1,id2,id3
 */
router.get('/', 
  requireAuth,
  validateRequest(getCheckboxStatesSchema),
  async (req, res) => {
    try {
      const { messageIds } = req.query;
      const userId = req.user!.id;

      if (!messageIds) {
        return res.json({ checkboxStates: [] });
      }

      const messageIdArray = messageIds.split(',').filter(id => id.trim());
      
      if (messageIdArray.length === 0) {
        return res.json({ checkboxStates: [] });
      }

      // Get checkbox states for the user and specified messages
      const checkboxStates = await prisma.messageCheckboxState.findMany({
        where: {
          messageId: { in: messageIdArray },
          userId,
          message: {
            conversation: {
              participants: {
                some: { userId }
              }
            }
          }
        },
        select: {
          messageId: true,
          checkboxId: true,
          checked: true,
          updatedAt: true
        }
      });

      // Group by messageId for easier frontend consumption
      const groupedStates = checkboxStates.reduce((acc, state) => {
        if (!acc[state.messageId]) {
          acc[state.messageId] = {};
        }
        acc[state.messageId][state.checkboxId] = {
          checked: state.checked,
          updatedAt: state.updatedAt
        };
        return acc;
      }, {} as Record<string, Record<string, { checked: boolean; updatedAt: Date }>>);

      res.json({ 
        checkboxStates: groupedStates,
        count: checkboxStates.length 
      });
    } catch (error) {
      console.error('Error fetching checkbox states:', error);
      res.status(500).json({ 
        error: 'Failed to fetch checkbox states' 
      });
    }
  }
);

/**
 * Get checkbox states for a specific message
 * GET /api/messages/:messageId/checkbox-states
 */
router.get('/:messageId/checkbox-states', 
  requireAuth,
  async (req, res) => {
    try {
      const { messageId } = req.params;
      const userId = req.user!.id;

      // Verify access to the message
      const message = await prisma.message.findFirst({
        where: { 
          id: messageId,
          conversation: {
            participants: {
              some: { userId }
            }
          }
        }
      });

      if (!message) {
        return res.status(404).json({ 
          error: 'Message not found or access denied' 
        });
      }

      // Get checkbox states for this message and user
      const checkboxStates = await prisma.messageCheckboxState.findMany({
        where: {
          messageId,
          userId
        },
        select: {
          checkboxId: true,
          checked: true,
          updatedAt: true
        }
      });

      // Convert to key-value format
      const statesMap = checkboxStates.reduce((acc, state) => {
        acc[state.checkboxId] = {
          checked: state.checked,
          updatedAt: state.updatedAt
        };
        return acc;
      }, {} as Record<string, { checked: boolean; updatedAt: Date }>);

      res.json({ 
        messageId,
        checkboxStates: statesMap,
        count: checkboxStates.length 
      });
    } catch (error) {
      console.error('Error fetching message checkbox states:', error);
      res.status(500).json({ 
        error: 'Failed to fetch checkbox states' 
      });
    }
  }
);

/**
 * Delete checkbox state
 * DELETE /api/messages/:messageId/checkbox-states/:checkboxId
 */
router.delete('/:messageId/checkbox-states/:checkboxId', 
  requireAuth,
  async (req, res) => {
    try {
      const { messageId, checkboxId } = req.params;
      const userId = req.user!.id;

      // Verify access to the message
      const message = await prisma.message.findFirst({
        where: { 
          id: messageId,
          conversation: {
            participants: {
              some: { userId }
            }
          }
        }
      });

      if (!message) {
        return res.status(404).json({ 
          error: 'Message not found or access denied' 
        });
      }

      // Delete the checkbox state
      const deleted = await prisma.messageCheckboxState.deleteMany({
        where: {
          messageId,
          userId,
          checkboxId
        }
      });

      if (deleted.count === 0) {
        return res.status(404).json({ 
          error: 'Checkbox state not found' 
        });
      }

      res.json({ success: true, deletedCount: deleted.count });
    } catch (error) {
      console.error('Error deleting checkbox state:', error);
      res.status(500).json({ 
        error: 'Failed to delete checkbox state' 
      });
    }
  }
);

export default router;