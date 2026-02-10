import { Router } from 'express';
import { prisma } from '@colloquium/database';
import { authenticate, requireGlobalPermission, optionalAuth, generateBotServiceToken, authenticateWithBots } from '../middleware/auth';
import { GlobalPermission, GlobalRole } from '@colloquium/auth';
import { WorkflowConfig, WorkflowPhase, BotApiPermission } from '@colloquium/types';
import { botExecutor } from '../bots';
import { broadcastToConversation } from './events';
import { botActionProcessor } from '../services/botActionProcessor';
import { addBotJob } from '../jobs';
import { randomUUID } from 'crypto';
import {
  canUserSeeMessageWithWorkflow,
  maskMessageAuthor,
  getViewerRole,
  computeEffectiveVisibility,
  batchPrefetchAuthorRoles,
  areAllReviewsComplete,
  MaskedAuthor,
  EffectiveVisibility,
  ViewerRole
} from '../services/workflowVisibility';
import {
  canUserParticipate,
  handleAuthorResponse,
  getParticipationStatus
} from '../services/workflowParticipation';
import { getJournalSettings } from './settings';
import { getUserInvolvedManuscriptIds } from '../services/userInvolvement';
import { getWorkflowConfig } from '../services/workflowConfig';
import { requireBotPermission } from '../middleware/botPermissions';

const router = Router();

// Helper function to determine if user can see a message based on privacy level
// Optional prefetchedIsAuthor/prefetchedIsReviewer skip per-message DB queries when provided
export async function canUserSeeMessage(
  userId: string | undefined,
  userRole: string | undefined,
  messagePrivacy: string,
  manuscriptId: string,
  prefetchedIsAuthor?: boolean,
  prefetchedIsReviewer?: boolean
) {

  if (!userId || !userRole) {
    return messagePrivacy === 'PUBLIC';
  }


  switch (messagePrivacy) {
    case 'PUBLIC':
      return true;

    case 'AUTHOR_VISIBLE':
      // Check if user is author, reviewer, editor, or admin
      if (userRole === 'ADMIN' || userRole === 'EDITOR_IN_CHIEF' || userRole === 'ACTION_EDITOR') return true;

      // Use pre-fetched value or fall back to DB query
      const isAuthor = prefetchedIsAuthor ?? !!await prisma.manuscript_authors.findFirst({
        where: {
          manuscriptId,
          userId
        }
      });
      if (isAuthor) return true;

      // Use pre-fetched value or fall back to DB query
      const isReviewer = prefetchedIsReviewer ?? !!await prisma.review_assignments.findFirst({
        where: {
          manuscriptId,
          reviewerId: userId
        }
      });
      return isReviewer;

    case 'REVIEWER_ONLY':
      // Only reviewers, editors, and admins
      if (userRole === 'ADMIN' || userRole === 'EDITOR_IN_CHIEF' || userRole === 'ACTION_EDITOR') return true;

      const isReviewerOnly = prefetchedIsReviewer ?? !!await prisma.review_assignments.findFirst({
        where: {
          manuscriptId,
          reviewerId: userId
        }
      });
      return isReviewerOnly;

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

    // Check publicSubmissionsVisible setting
    const journalSettings = await getJournalSettings();
    const userId = req.user?.id;
    const userRole = req.user?.role;

    // Build where clause
    const where: any = {};
    if (manuscriptId) where.manuscriptId = manuscriptId as string;

    // Apply involvement filter if publicSubmissionsVisible is false
    if (!journalSettings.publicSubmissionsVisible) {
      // ADMIN and EDITOR_IN_CHIEF see all
      if (userRole !== 'ADMIN' && userRole !== 'EDITOR_IN_CHIEF') {
        if (!userId) {
          // Non-authenticated users see nothing
          return res.json({
            conversations: [],
            pagination: {
              page: pageNum,
              limit: limitNum,
              total: 0,
              pages: 0
            }
          });
        }

        // Get manuscripts where user is involved
        const involvedManuscriptIds = await getUserInvolvedManuscriptIds(userId);

        if (involvedManuscriptIds.length === 0) {
          // User has no involvement, return empty list
          return res.json({
            conversations: [],
            pagination: {
              page: pageNum,
              limit: limitNum,
              total: 0,
              pages: 0
            }
          });
        }

        // Filter to only involved manuscripts
        where.manuscriptId = { in: involvedManuscriptIds };
      }
    }

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
        _count: {
          select: { messages: true }
        }
      }
    });

    if (!conversation) {
      return res.status(404).json({
        error: 'Conversation not found',
        message: `No conversation found with ID: ${id}`
      });
    }

    // Parse pagination params
    const messageLimit = Math.min(Math.max(parseInt(req.query.messageLimit as string) || 50, 1), 200);
    const messageBefore = req.query.messageBefore as string | undefined;

    // Fetch messages with cursor-based pagination
    // To get the last N messages, we fetch in desc order and reverse
    const messageQuery: any = {
      where: { conversationId: id },
      orderBy: { createdAt: 'desc' as const },
      take: messageLimit + 1, // fetch one extra to detect hasMoreMessages
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
    };

    if (messageBefore) {
      messageQuery.cursor = { id: messageBefore };
      messageQuery.skip = 1; // skip the cursor itself
    }

    const rawMessages = await prisma.messages.findMany(messageQuery);

    // Detect if there are more messages before the current page
    const hasMoreMessages = rawMessages.length > messageLimit;
    if (hasMoreMessages) {
      rawMessages.pop(); // remove the extra message used for detection
    }

    // Reverse to get chronological order (we fetched desc to get the last N)
    rawMessages.reverse();

    // Attach messages to conversation object for downstream processing
    const conversationWithMessages = {
      ...conversation,
      messages: rawMessages
    };

    const totalMessageCount = conversation._count.messages;

    // Get workflow config for additional visibility rules
    const workflowConfig = await getWorkflowConfig();
    const manuscriptContext = {
      id: conversation.manuscriptId,
      workflowPhase: conversation.manuscripts.workflowPhase,
      workflowRound: conversation.manuscripts.workflowRound
    };

    // Pre-fetch the viewer's manuscript relationships to avoid N+1 queries
    const userId = req.user?.id;
    const userRole = req.user?.role;
    let prefetchedIsAuthor: boolean | undefined;
    let prefetchedIsReviewer: boolean | undefined;
    let prefetchedViewerRole: ViewerRole | undefined;

    if (userId) {
      const [authorRelation, reviewerRelation] = await Promise.all([
        prisma.manuscript_authors.findFirst({
          where: { manuscriptId: conversation.manuscriptId, userId },
          select: { id: true }
        }),
        prisma.review_assignments.findFirst({
          where: { manuscriptId: conversation.manuscriptId, reviewerId: userId },
          select: { id: true }
        })
      ]);
      prefetchedIsAuthor = !!authorRelation;
      prefetchedIsReviewer = !!reviewerRelation;
      prefetchedViewerRole = await getViewerRole(
        userId, userRole, conversation.manuscriptId,
        prefetchedIsAuthor, prefetchedIsReviewer
      );
    }

    // Batch-prefetch all message author roles (3 queries total instead of up to 3 per unique author)
    const authorRoleCache = new Map<string, ViewerRole>();
    const allAuthorIds = conversationWithMessages.messages.map(msg => msg.authorId);
    const [, prefetchedAllReviewsComplete] = await Promise.all([
      batchPrefetchAuthorRoles(allAuthorIds, conversation.manuscriptId, authorRoleCache),
      areAllReviewsComplete(conversation.manuscriptId)
    ]);

    // Filter messages based on user's permission to see them
    const visibleMessages = [];
    const messageVisibilityMap = [];

    for (const msg of conversationWithMessages.messages) {
      // First check privacy-based visibility
      const canSeePrivacy = await canUserSeeMessage(
        userId,
        userRole,
        msg.privacy,
        conversation.manuscriptId,
        prefetchedIsAuthor,
        prefetchedIsReviewer
      );

      // Then apply workflow-based visibility if config exists
      let canSeeWorkflow = true;
      if (workflowConfig && canSeePrivacy) {
        canSeeWorkflow = await canUserSeeMessageWithWorkflow(
          userId,
          userRole,
          msg.authorId,
          msg.privacy,
          conversation.manuscriptId,
          workflowConfig,
          manuscriptContext,
          prefetchedViewerRole,
          authorRoleCache,
          prefetchedAllReviewsComplete
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
    // Apply identity masking and compute effective visibility for visible messages
    const maskedMessages = await Promise.all(
      visibleMessages.map(async msg => {
        const maskedAuthor = await maskMessageAuthor(
          msg.users,
          userId,
          userRole,
          conversation.manuscriptId,
          workflowConfig,
          manuscriptContext.workflowPhase,
          prefetchedViewerRole,
          authorRoleCache,
          prefetchedAllReviewsComplete
        );

        const effectiveVisibility = await computeEffectiveVisibility(
          msg.privacy,
          msg.authorId,
          conversation.manuscriptId,
          workflowConfig,
          manuscriptContext.workflowPhase,
          authorRoleCache,
          prefetchedAllReviewsComplete
        );

        return {
          id: msg.id,
          content: msg.content,
          privacy: msg.privacy,
          effectiveVisibility,
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
      totalMessageCount,
      hasMoreMessages,
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

// GET /api/conversations/:id/messages - Bot-accessible message reading endpoint
router.get('/:id/messages', authenticateWithBots, requireBotPermission(BotApiPermission.READ_CONVERSATIONS), async (req, res, next) => {
  try {
    const { id } = req.params;

    const conversation = await prisma.conversations.findUnique({
      where: { id },
      select: { id: true, manuscriptId: true },
    });

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    if (req.botContext && req.botContext.manuscriptId !== conversation.manuscriptId) {
      return res.status(403).json({ error: 'Bot can only access conversations for its assigned manuscript' });
    }

    const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 50, 1), 200);
    const before = req.query.before as string | undefined;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const query: any = {
      where: {
        conversationId: id,
        privacy: { in: ['PUBLIC', 'AUTHOR_VISIBLE'] },
      },
      orderBy: { createdAt: 'desc' as const },
      take: limit + 1,
      include: {
        users: {
          select: { id: true, name: true, email: true },
        },
      },
    };

    if (before) {
      query.cursor = { id: before };
      query.skip = 1;
    }

    const rawMessages = await prisma.messages.findMany(query);

    const hasMore = rawMessages.length > limit;
    if (hasMore) rawMessages.pop();

    rawMessages.reverse();

    const messages = rawMessages.map(msg => ({
      id: msg.id,
      content: msg.content,
      privacy: msg.privacy,
      author: (msg as any).users,
      createdAt: msg.createdAt,
      parentId: msg.parentId,
      isBot: msg.isBot,
      metadata: msg.metadata,
    }));

    res.json({ messages, hasMore });
  } catch (error) {
    next(error);
  }
});

// POST /api/conversations/:id/messages - Post new message
router.post('/:id/messages', authenticateWithBots, (req, res, next) => {
  // Skip permission check for bot requests (they use requireBotPermission instead)
  if (req.botContext) {
    if (!req.botContext.permissions.includes(BotApiPermission.WRITE_MESSAGES)) {
      return res.status(403).json({ error: `Missing permission: ${BotApiPermission.WRITE_MESSAGES}` });
    }
    return next();
  }
  return requireGlobalPermission(GlobalPermission.CREATE_CONVERSATION)(req, res, next);
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

    const isBotRequest = !!req.botContext;

    // Bots can only post to conversations for their assigned manuscript
    if (isBotRequest && req.botContext!.manuscriptId !== conversation.manuscriptId) {
      return res.status(403).json({
        error: 'Bot can only post to conversations for its assigned manuscript'
      });
    }

    // Check workflow-based participation permission (skip for bots)
    const workflowConfig = await getWorkflowConfig();
    if (!isBotRequest && workflowConfig) {
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

    // Determine author ID and bot flag
    let authorId: string;
    if (isBotRequest) {
      const botUserId = botExecutor.getBotUserId(req.botContext!.botId);
      if (!botUserId) {
        return res.status(500).json({ error: 'Bot user not found' });
      }
      authorId = botUserId;
    } else {
      authorId = req.user!.id;
    }

    // Determine privacy level (use provided privacy or default based on user role)
    const messagePrivacy = privacy || (isBotRequest ? 'AUTHOR_VISIBLE' : getDefaultPrivacyLevel(req.user!.role));

    // Create the message
    console.log('Creating message with data:', {
      content: content.trim(),
      conversationId,
      authorId,
      parentId: parentId || null,
      privacy: messagePrivacy,
      isBot: isBotRequest
    });

    const message = await prisma.messages.create({
      data: {
        id: randomUUID(),
        content: content.trim(),
        conversationId,
        authorId,
        parentId: parentId || null,
        privacy: messagePrivacy,
        isBot: isBotRequest,
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

    // Handle author response cycle if workflow config is enabled (skip for bots)
    let phaseChangeInfo = null;
    if (!isBotRequest && workflowConfig) {
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

    // Queue bot processing for asynchronous execution (skip for bot-posted messages to prevent loops)
    if (!isBotRequest) {
      const hasBotMentions = content.includes('@') && /[@][\w-]+/.test(content);

      if (hasBotMentions) {
        try {
          console.log(`Queuing bot processing for message ${message.id} with content: "${content.substring(0, 100)}..."`);

          await addBotJob({
            messageId: message.id,
            conversationId,
            userId: req.user!.id,
            manuscriptId: conversation.manuscriptId
          });

          console.log(`Bot processing job queued successfully for message ${message.id}`);
        } catch (queueError) {
          console.error('Failed to queue bot processing:', queueError);
        }
      } else {
        console.log('No bot mentions detected, skipping bot processing queue');
      }
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