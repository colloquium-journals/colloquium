import { Router } from 'express';
import { prisma } from '@colloquium/database';
import { authenticate, requirePermission, optionalAuth, generateBotServiceToken } from '../middleware/auth';
import { Permission, GlobalRole } from '@colloquium/auth';
import { WorkflowConfig, WorkflowPhase } from '@colloquium/types';
import { botExecutor } from '../bots';
import { broadcastToConversation } from './events';
import { botActionProcessor } from '../services/botActionProcessor';
import { addBotJob } from '../jobs';
import { randomUUID } from 'crypto';
import {
  canUserSeeMessageWithWorkflow,
  maskMessageAuthor,
  getViewerRole,
  MaskedAuthor
} from '../services/workflowVisibility';
import {
  canUserParticipate,
  handleAuthorResponse,
  getParticipationStatus
} from '../services/workflowParticipation';

const router = Router();

// Helper function to get workflow config from journal settings
async function getWorkflowConfig(): Promise<WorkflowConfig | null> {
  try {
    const settings = await prisma.journal_settings.findFirst({
      where: { id: 'singleton' },
      select: { settings: true }
    });

    if (settings?.settings && typeof settings.settings === 'object') {
      const journalSettings = settings.settings as any;
      return journalSettings.workflowConfig || null;
    }
    return null;
  } catch (error) {
    console.error('Failed to get workflow config:', error);
    return null;
  }
}

// Helper function to determine if user can see a message based on privacy level
export async function canUserSeeMessage(userId: string | undefined, userRole: string | undefined, messagePrivacy: string, manuscriptId: string) {
  
  if (!userId || !userRole) {
    return messagePrivacy === 'PUBLIC';
  }


  switch (messagePrivacy) {
    case 'PUBLIC':
      return true;
    
    case 'AUTHOR_VISIBLE':
      // Check if user is author, reviewer, editor, or admin
      if (userRole === 'ADMIN' || userRole === 'EDITOR_IN_CHIEF' || userRole === 'ACTION_EDITOR') return true;
      
      // Check if user is an author of the manuscript
      const authorRelation = await prisma.manuscript_authors.findFirst({
        where: { 
          manuscriptId,
          userId 
        }
      });
      if (authorRelation) return true;
      
      // Check if user is assigned as reviewer
      const reviewerAssignment = await prisma.review_assignments.findFirst({
        where: {
          manuscriptId,
          reviewerId: userId
        }
      });
      return !!reviewerAssignment;
    
    case 'REVIEWER_ONLY':
      // Only reviewers, editors, and admins
      if (userRole === 'ADMIN' || userRole === 'EDITOR_IN_CHIEF' || userRole === 'ACTION_EDITOR') return true;
      
      const reviewAssignment = await prisma.review_assignments.findFirst({
        where: {
          manuscriptId,
          reviewerId: userId
        }
      });
      return !!reviewAssignment;
    
    case 'EDITOR_ONLY':
      return userRole === 'ADMIN' || userRole === 'EDITOR_IN_CHIEF' || userRole === 'ACTION_EDITOR';
    
    case 'ADMIN_ONLY':
      return userRole === 'ADMIN';
    
    default:
      return false;
  }
}

// Helper function to get default privacy level based on user role
function getDefaultPrivacyLevel(userRole: string | undefined): string {
  switch (userRole) {
    case 'ADMIN':
    case 'EDITOR_IN_CHIEF':
    case 'ACTION_EDITOR':
      return 'AUTHOR_VISIBLE';
    case 'USER':
    default:
      return 'AUTHOR_VISIBLE';
  }
}

// GET /api/conversations - List conversations
router.get('/', optionalAuth, async (req, res, next) => {
  try {
    const { 
      manuscriptId,
      search,
      manuscriptStatus,
      page = '1',
      limit = '20'
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // Build where clause
    const where: any = {};
    if (manuscriptId) where.manuscriptId = manuscriptId as string;
    
    // Initialize manuscript filter object
    let manuscriptFilter: any = {};
    
    // Filter by manuscript status
    if (manuscriptStatus === 'active') {
      // Show only manuscripts in review process
      manuscriptFilter.status = {
        in: ['SUBMITTED', 'UNDER_REVIEW', 'REVISION_REQUESTED', 'REVISED', 'ACCEPTED']
      };
    } else if (manuscriptStatus === 'completed') {
      // Show only completed manuscripts
      manuscriptFilter.status = {
        in: ['PUBLISHED', 'REJECTED', 'RETRACTED']
      };
    }
    
    // Add search functionality
    if (search && typeof search === 'string' && search.trim()) {
      const searchTerm = search.trim();
      where.OR = [
        {
          title: {
            contains: searchTerm,
            mode: 'insensitive'
          },
          ...(Object.keys(manuscriptFilter).length > 0 && { manuscripts: manuscriptFilter })
        },
        {
          manuscripts: {
            title: {
              contains: searchTerm,
              mode: 'insensitive'
            },
            ...manuscriptFilter
          }
        },
        {
          manuscripts: {
            authors: {
              hasSome: [searchTerm]
            },
            ...manuscriptFilter
          }
        }
      ];
    } else if (Object.keys(manuscriptFilter).length > 0) {
      // Apply manuscript filter when no search term
      where.manuscripts = manuscriptFilter;
    }

    // Get conversations with related data
    const [conversations, total] = await Promise.all([
      prisma.conversations.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { updatedAt: 'desc' },
        include: {
          manuscripts: {
            select: {
              id: true,
              title: true,
              authors: true,
              status: true
            }
          },
          _count: {
            select: {
              messages: true,
              conversation_participants: true
            }
          },
          messages: {
            take: 1,
            orderBy: { createdAt: 'desc' },
            include: {
              users: {
                select: {
                  id: true,
                  username: true,
                  name: true,
                  email: true
                }
              }
            }
          }
        }
      }),
      prisma.conversations.count({ where })
    ]);

    // Format response
    const formattedConversations = conversations.map(conv => ({
      id: conv.id,
      title: conv.title,
      manuscript: conv.manuscripts,
      messageCount: conv._count.messages,
      participantCount: conv._count.conversation_participants,
      lastMessage: conv.messages[0] ? {
        id: conv.messages[0].id,
        content: conv.messages[0].content,
        author: conv.messages[0].users,
        createdAt: conv.messages[0].createdAt,
        isBot: conv.messages[0].isBot
      } : null,
      createdAt: conv.createdAt,
      updatedAt: conv.updatedAt
    }));

    res.json({
      conversations: formattedConversations,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/conversations/:id - Get conversation + messages
router.get('/:id', optionalAuth, async (req, res, next) => {
  try {
    const { id } = req.params;

    const conversation = await prisma.conversations.findUnique({
      where: { id },
      include: {
        manuscripts: {
          select: {
            id: true,
            title: true,
            authors: true,
            status: true,
            workflowPhase: true,
            workflowRound: true,
            releasedAt: true,
            action_editors: {
              select: {
                editorId: true
              }
            }
          }
        },
        conversation_participants: {
          include: {
            users: {
              select: {
                id: true,
                username: true,
                name: true,
                email: true,
                role: true
              }
            }
          }
        },
        messages: {
          orderBy: { createdAt: 'asc' },
          include: {
            users: {
              select: {
                id: true,
                username: true,
                name: true,
                email: true
              }
            }
          }
        }
      }
    });

    if (!conversation) {
      return res.status(404).json({
        error: 'Conversation not found',
        message: `No conversation found with ID: ${id}`
      });
    }

    // Get workflow config for additional visibility rules
    const workflowConfig = await getWorkflowConfig();
    const manuscriptContext = {
      id: conversation.manuscriptId,
      workflowPhase: conversation.manuscripts.workflowPhase,
      workflowRound: conversation.manuscripts.workflowRound
    };

    // Filter messages based on user's permission to see them
    console.log(`Found ${conversation.messages.length} total messages for conversation ${id}`);
    const visibleMessages = [];
    const messageVisibilityMap = [];

    for (const msg of conversation.messages) {
      // First check privacy-based visibility
      const canSeePrivacy = await canUserSeeMessage(
        req.user?.id,
        req.user?.role,
        msg.privacy,
        conversation.manuscriptId
      );

      // Then apply workflow-based visibility if config exists
      let canSeeWorkflow = true;
      if (workflowConfig && canSeePrivacy) {
        canSeeWorkflow = await canUserSeeMessageWithWorkflow(
          req.user?.id,
          req.user?.role,
          msg.authorId,
          msg.privacy,
          conversation.manuscriptId,
          workflowConfig,
          manuscriptContext
        );
      }

      const canSee = canSeePrivacy && canSeeWorkflow;

      messageVisibilityMap.push({
        id: msg.id,
        visible: canSee,
        createdAt: msg.createdAt
      });

      if (canSee) {
        visibleMessages.push(msg);
      }
    }
    console.log(`Returning ${visibleMessages.length} visible messages`);

    // Apply identity masking to visible message authors
    const maskedMessages = await Promise.all(
      visibleMessages.map(async msg => {
        const maskedAuthor = await maskMessageAuthor(
          msg.users,
          req.user?.id,
          req.user?.role,
          conversation.manuscriptId,
          workflowConfig,
          manuscriptContext.workflowPhase
        );

        return {
          id: msg.id,
          content: msg.content,
          privacy: msg.privacy,
          author: maskedAuthor,
          createdAt: msg.createdAt,
          updatedAt: msg.updatedAt,
          parentId: msg.parentId,
          isBot: msg.isBot,
          metadata: msg.metadata
        };
      })
    );

    // Get participation status for the current user
    let participationStatus = null;
    if (req.user?.id) {
      participationStatus = await getParticipationStatus(
        req.user.id,
        req.user.role,
        conversation.manuscriptId,
        workflowConfig,
        { ...manuscriptContext, status: conversation.manuscripts.status }
      );
    }

    // Format response
    const formattedConversation = {
      id: conversation.id,
      title: conversation.title,
      manuscript: {
        ...conversation.manuscripts,
        workflowPhase: conversation.manuscripts.workflowPhase,
        workflowRound: conversation.manuscripts.workflowRound,
        releasedAt: conversation.manuscripts.releasedAt
      },
      participants: conversation.conversation_participants.map(p => ({
        id: p.id,
        role: p.role,
        user: p.users
      })),
      totalMessageCount: conversation.messages.length,
      visibleMessageCount: maskedMessages.length,
      messageVisibilityMap,
      messages: maskedMessages,
      workflow: workflowConfig ? {
        phase: manuscriptContext.workflowPhase,
        round: manuscriptContext.workflowRound,
        hasConfig: true
      } : null,
      participation: participationStatus,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt
    };

    res.json(formattedConversation);
  } catch (error) {
    next(error);
  }
});

// PUT /api/conversations/:id - Update conversation settings
router.put('/:id', async (req, res, next) => {
  try {
    // TODO: Implement conversation update
    res.json({ message: 'Conversation updated' });
  } catch (error) {
    next(error);
  }
});

// POST /api/conversations/:id/messages - Post new message
router.post('/:id/messages', authenticate, (req, res, next) => {
  const { Permission } = require('@colloquium/auth');
  return requirePermission(Permission.CREATE_CONVERSATION)(req, res, next);
}, async (req, res, next) => {
  try {
    const { id: conversationId } = req.params;
    const { content, parentId, privacy } = req.body;

    // Validate required fields
    if (!content || !content.trim()) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Message content is required'
      });
    }

    // Verify conversation exists and get manuscript info
    const conversation = await prisma.conversations.findUnique({
      where: { id: conversationId },
      select: {
        id: true,
        title: true,
        manuscriptId: true,
        manuscripts: {
          select: {
            workflowPhase: true,
            workflowRound: true,
            status: true
          }
        }
      }
    });

    if (!conversation) {
      return res.status(404).json({
        error: 'Conversation not found',
        message: `No conversation found with ID: ${conversationId}`
      });
    }

    // Check workflow-based participation permission
    const workflowConfig = await getWorkflowConfig();
    if (workflowConfig) {
      const manuscriptContext = {
        id: conversation.manuscriptId,
        workflowPhase: conversation.manuscripts.workflowPhase,
        workflowRound: conversation.manuscripts.workflowRound,
        status: conversation.manuscripts.status
      };

      const participationResult = await canUserParticipate(
        req.user!.id,
        req.user!.role,
        conversation.manuscriptId,
        workflowConfig,
        manuscriptContext
      );

      if (!participationResult.allowed) {
        return res.status(403).json({
          error: 'Participation Not Allowed',
          message: participationResult.reason || 'You cannot participate in this discussion at this time'
        });
      }
    }

    // Verify parent message exists if provided
    if (parentId) {
      const parentMessage = await prisma.messages.findUnique({
        where: { id: parentId },
        select: { id: true, conversationId: true }
      });

      if (!parentMessage || parentMessage.conversationId !== conversationId) {
        return res.status(400).json({
          error: 'Invalid parent message',
          message: 'Parent message not found or belongs to different conversation'
        });
      }
    }

    // Determine privacy level (use provided privacy or default based on user role)
    const messagePrivacy = privacy || getDefaultPrivacyLevel(req.user!.role);

    // Create the message
    console.log('Creating message with data:', {
      content: content.trim(),
      conversationId,
      authorId: req.user!.id,
      parentId: parentId || null,
      privacy: messagePrivacy,
      isBot: false
    });

    const message = await prisma.messages.create({
      data: {
        id: randomUUID(),
        content: content.trim(),
        conversationId,
        authorId: req.user!.id,
        parentId: parentId || null,
        privacy: messagePrivacy,
        isBot: false,
        updatedAt: new Date()
      },
      include: {
        users: {
          select: {
            id: true,
            username: true,
            name: true,
            email: true
          }
        }
      }
    });

    console.log('Message created successfully:', message.id);

    // Update conversation's updatedAt timestamp
    await prisma.conversations.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() }
    });

    // Handle author response cycle if workflow config is enabled
    let phaseChangeInfo = null;
    if (workflowConfig) {
      const cycleResult = await handleAuthorResponse(
        conversation.manuscriptId,
        req.user!.id,
        workflowConfig
      );

      if (cycleResult.phaseChanged) {
        phaseChangeInfo = {
          newPhase: cycleResult.newPhase,
          newRound: cycleResult.newRound
        };

        // Broadcast phase change event
        await broadcastToConversation(conversationId, {
          type: 'workflow-phase-changed',
          phase: cycleResult.newPhase,
          round: cycleResult.newRound,
          manuscriptId: conversation.manuscriptId
        }, conversation.manuscriptId);
      }
    }

    // Queue bot processing for asynchronous execution
    // Check if the message contains bot mentions before queuing
    const hasBotMentions = content.includes('@') && /[@][\w-]+/.test(content);
    
    if (hasBotMentions) {
      try {
        console.log(`Queuing bot processing for message ${message.id} with content: "${content.substring(0, 100)}..."`);
        
        // Add job to the bot processing queue (uses PostgreSQL via graphile-worker)
        await addBotJob({
          messageId: message.id,
          conversationId,
          userId: req.user!.id,
          manuscriptId: conversation.manuscriptId
        });
        
        console.log(`Bot processing job queued successfully for message ${message.id}`);
      } catch (queueError) {
        console.error('Failed to queue bot processing:', queueError);
        // Don't fail the message creation if queue fails
        // TODO: Could optionally create a system message about the failure
      }
    } else {
      console.log('No bot mentions detected, skipping bot processing queue');
    }

    // Format response
    const formattedMessage = {
      id: message.id,
      content: message.content,
      privacy: message.privacy,
      author: message.users,
      createdAt: message.createdAt,
      updatedAt: message.updatedAt,
      parentId: message.parentId,
      isBot: message.isBot
    };

    // Broadcast the new message via SSE with permission filtering
    await broadcastToConversation(conversationId, {
      type: 'new-message',
      message: formattedMessage
    }, conversation.manuscriptId);

    // Bot responses are now broadcast immediately when created above

    res.status(201).json({
      message: 'Message posted successfully',
      data: formattedMessage
    });
  } catch (error) {
    next(error);
  }
});

// NOTE: Conversations are now automatically created when manuscripts are submitted
// Standalone conversation creation has been removed to ensure all discussions
// are tied to specific manuscript submissions

export default router;