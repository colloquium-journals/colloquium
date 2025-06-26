import { Router } from 'express';
import { prisma } from '@colloquium/database';
import { authenticate, requirePermission, optionalAuth } from '../middleware/auth';
import { Permission, GlobalRole } from '@colloquium/auth';
import { botExecutor } from '../bots';
import { broadcastToConversation } from './events';
import { botActionProcessor } from '../services/botActionProcessor';

const router = Router();

// Helper function to determine if user can see a message based on privacy level
async function canUserSeeMessage(userId: string | undefined, userRole: string | undefined, messagePrivacy: string, manuscriptId: string) {
  console.log(`Checking permissions - userId: ${userId}, userRole: ${userRole}, messagePrivacy: ${messagePrivacy}, manuscriptId: ${manuscriptId}`);
  
  if (!userId || !userRole) {
    console.log('No user ID or role, only allowing PUBLIC messages');
    return messagePrivacy === 'PUBLIC';
  }

  // Special debug logging for this specific case
  if (messagePrivacy === 'AUTHOR_VISIBLE') {
    console.log(`DEBUG: Checking AUTHOR_VISIBLE message - userRole is '${userRole}', checking if it matches ADMIN, EDITOR_IN_CHIEF, or MANAGING_EDITOR`);
  }

  switch (messagePrivacy) {
    case 'PUBLIC':
      return true;
    
    case 'AUTHOR_VISIBLE':
      // Check if user is author, reviewer, editor, or admin
      if (userRole === 'ADMIN' || userRole === 'EDITOR_IN_CHIEF' || userRole === 'MANAGING_EDITOR') return true;
      
      // Check if user is an author of the manuscript
      const authorRelation = await prisma.manuscriptAuthor.findFirst({
        where: { 
          manuscriptId,
          userId 
        }
      });
      if (authorRelation) return true;
      
      // Check if user is assigned as reviewer
      const reviewerAssignment = await prisma.reviewAssignment.findFirst({
        where: {
          manuscriptId,
          reviewerId: userId
        }
      });
      return !!reviewerAssignment;
    
    case 'REVIEWER_ONLY':
      // Only reviewers, editors, and admins
      if (userRole === 'ADMIN' || userRole === 'EDITOR_IN_CHIEF' || userRole === 'MANAGING_EDITOR') return true;
      
      const reviewAssignment = await prisma.reviewAssignment.findFirst({
        where: {
          manuscriptId,
          reviewerId: userId
        }
      });
      return !!reviewAssignment;
    
    case 'EDITOR_ONLY':
      return userRole === 'ADMIN' || userRole === 'EDITOR_IN_CHIEF' || userRole === 'MANAGING_EDITOR';
    
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
    case 'MANAGING_EDITOR':
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
          ...(Object.keys(manuscriptFilter).length > 0 && { manuscript: manuscriptFilter })
        },
        {
          manuscript: {
            title: {
              contains: searchTerm,
              mode: 'insensitive'
            },
            ...manuscriptFilter
          }
        },
        {
          manuscript: {
            authors: {
              hasSome: [searchTerm]
            },
            ...manuscriptFilter
          }
        }
      ];
    } else if (Object.keys(manuscriptFilter).length > 0) {
      // Apply manuscript filter when no search term
      where.manuscript = manuscriptFilter;
    }

    // Get conversations with related data
    const [conversations, total] = await Promise.all([
      prisma.conversation.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { updatedAt: 'desc' },
        include: {
          manuscript: {
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
              participants: true
            }
          },
          messages: {
            take: 1,
            orderBy: { createdAt: 'desc' },
            include: {
              author: {
                select: {
                  id: true,
                  name: true,
                  email: true
                }
              }
            }
          }
        }
      }),
      prisma.conversation.count({ where })
    ]);

    // Format response
    const formattedConversations = conversations.map(conv => ({
      id: conv.id,
      title: conv.title,
      manuscript: conv.manuscript,
      messageCount: conv._count.messages,
      participantCount: conv._count.participants,
      lastMessage: conv.messages[0] ? {
        id: conv.messages[0].id,
        content: conv.messages[0].content,
        author: conv.messages[0].author,
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

    const conversation = await prisma.conversation.findUnique({
      where: { id },
      include: {
        manuscript: {
          select: {
            id: true,
            title: true,
            authors: true
          }
        },
        participants: {
          include: {
            user: {
              select: {
                id: true,
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
            author: {
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

    if (!conversation) {
      return res.status(404).json({
        error: 'Conversation not found',
        message: `No conversation found with ID: ${id}`
      });
    }

    // Filter messages based on user's permission to see them
    console.log(`Found ${conversation.messages.length} total messages for conversation ${id}`);
    const visibleMessages = [];
    for (const msg of conversation.messages) {
      const canSee = await canUserSeeMessage(
        req.user?.id, 
        req.user?.role, 
        msg.privacy, 
        conversation.manuscriptId
      );
      console.log(`Message ${msg.id} (privacy: ${msg.privacy}) - can user see: ${canSee}`);
      if (canSee) {
        visibleMessages.push(msg);
      }
    }
    console.log(`Returning ${visibleMessages.length} visible messages`);

    // Format response
    const formattedConversation = {
      id: conversation.id,
      title: conversation.title,
      manuscript: conversation.manuscript,
      participants: conversation.participants.map(p => ({
        id: p.id,
        role: p.role,
        user: p.user
      })),
      messages: visibleMessages.map(msg => ({
        id: msg.id,
        content: msg.content,
        privacy: msg.privacy,
        author: msg.author,
        createdAt: msg.createdAt,
        updatedAt: msg.updatedAt,
        parentId: msg.parentId,
        isBot: msg.isBot
      })),
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
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { 
        id: true, 
        title: true, 
        manuscriptId: true 
      }
    });

    if (!conversation) {
      return res.status(404).json({
        error: 'Conversation not found',
        message: `No conversation found with ID: ${conversationId}`
      });
    }

    // Verify parent message exists if provided
    if (parentId) {
      const parentMessage = await prisma.message.findUnique({
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

    const message = await prisma.message.create({
      data: {
        content: content.trim(),
        conversationId,
        authorId: req.user!.id,
        parentId: parentId || null,
        privacy: messagePrivacy,
        isBot: false
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    console.log('Message created successfully:', message.id);

    // Update conversation's updatedAt timestamp
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() }
    });

    // Process message for bot commands (asynchronously)
    try {
      const botResponses = await botExecutor.processMessage(content, {
        conversationId,
        manuscriptId: conversation.manuscriptId,
        triggeredBy: {
          messageId: message.id,
          userId: req.user!.id,
          trigger: 'MENTION' as any
        },
        journal: {
          id: 'default', // TODO: Get actual journal ID
          settings: {}
        },
        config: {}
      });

      // Create bot response messages
      for (const botResponse of botResponses) {
        if (botResponse.messages && botResponse.botId) {
          const botUserId = botExecutor.getBotUserId(botResponse.botId);
          if (!botUserId) {
            console.error(`No user ID found for bot: ${botResponse.botId}`);
            continue;
          }

          for (const botMessage of botResponse.messages) {
            const createdBotMessage = await prisma.message.create({
              data: {
                content: botMessage.content,
                conversationId,
                authorId: botUserId,
                parentId: botMessage.replyTo || message.id,
                privacy: 'AUTHOR_VISIBLE',
                isBot: true
              },
              include: {
                author: {
                  select: {
                    id: true,
                    name: true,
                    email: true
                  }
                }
              }
            });

            // Immediately broadcast bot response
            const formattedBotMessage = {
              id: createdBotMessage.id,
              content: createdBotMessage.content,
              privacy: createdBotMessage.privacy,
              author: createdBotMessage.author,
              createdAt: createdBotMessage.createdAt,
              updatedAt: createdBotMessage.updatedAt,
              parentId: createdBotMessage.parentId,
              isBot: createdBotMessage.isBot
            };

            broadcastToConversation(conversationId, {
              type: 'new-message',
              message: formattedBotMessage
            });
          }

          // Process bot actions
          if (botResponse.actions && botResponse.actions.length > 0) {
            try {
              await botActionProcessor.processActions(botResponse.actions, {
                manuscriptId: conversation.manuscriptId,
                userId: req.user!.id,
                conversationId
              });
            } catch (actionError) {
              console.error('Failed to process bot actions:', actionError);
              // Create an error message for failed actions
              const actionErrorMessage = await prisma.message.create({
                data: {
                  content: `⚠️ **Action Processing Error:** Some bot actions could not be completed. Please check the logs or retry manually.`,
                  conversationId,
                  authorId: botUserId,
                  parentId: message.id,
                  privacy: 'EDITOR_ONLY', // Only show to editors
                  isBot: true
                },
                include: {
                  author: {
                    select: {
                      id: true,
                      name: true,
                      email: true
                    }
                  }
                }
              });

              // Immediately broadcast action error message
              broadcastToConversation(conversationId, {
                type: 'new-message',
                message: {
                  id: actionErrorMessage.id,
                  content: actionErrorMessage.content,
                  privacy: actionErrorMessage.privacy,
                  author: actionErrorMessage.author,
                  createdAt: actionErrorMessage.createdAt,
                  updatedAt: actionErrorMessage.updatedAt,
                  parentId: actionErrorMessage.parentId,
                  isBot: actionErrorMessage.isBot
                }
              });
            }
          }
        }

        if (botResponse.errors && botResponse.errors.length > 0) {
          console.error('Bot execution errors:', botResponse.errors);
          
          if (botResponse.botId) {
            const botUserId = botExecutor.getBotUserId(botResponse.botId);
            if (botUserId) {
              // Create error message for debugging
              const errorMessage = await prisma.message.create({
                data: {
                  content: `❌ **Bot Error:** ${botResponse.errors.join(', ')}`,
                  conversationId,
                  authorId: botUserId,
                  parentId: message.id,
                  privacy: 'AUTHOR_VISIBLE', // Make errors visible to users for better UX
                  isBot: true
                },
                include: {
                  author: {
                    select: {
                      id: true,
                      name: true,
                      email: true
                    }
                  }
                }
              });

              // Immediately broadcast error message
              broadcastToConversation(conversationId, {
                type: 'new-message',
                message: {
                  id: errorMessage.id,
                  content: errorMessage.content,
                  privacy: errorMessage.privacy,
                  author: errorMessage.author,
                  createdAt: errorMessage.createdAt,
                  updatedAt: errorMessage.updatedAt,
                  parentId: errorMessage.parentId,
                  isBot: errorMessage.isBot
                }
              });
            }
          }
        }
      }
    } catch (error) {
      console.error('Bot processing failed:', error);
      // Don't fail the whole request if bot processing fails
    }

    // Format response
    const formattedMessage = {
      id: message.id,
      content: message.content,
      privacy: message.privacy,
      author: message.author,
      createdAt: message.createdAt,
      updatedAt: message.updatedAt,
      parentId: message.parentId,
      isBot: message.isBot
    };

    // Broadcast the new message via SSE
    broadcastToConversation(conversationId, {
      type: 'new-message',
      message: formattedMessage
    });

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