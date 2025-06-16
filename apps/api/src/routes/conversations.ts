import { Router } from 'express';
import { prisma } from '@colloquium/database';
import { authenticate, requirePermission, optionalAuth } from '../middleware/auth';
import { Permission } from '@colloquium/auth';
import { botExecutor } from '../bots';
import { broadcastToConversation } from './events';

const router = Router();

// Helper function to determine if user can see a message based on privacy level
async function canUserSeeMessage(userId: string | undefined, userRole: string | undefined, messagePrivacy: string, manuscriptId: string) {
  if (!userId || !userRole) {
    return messagePrivacy === 'PUBLIC';
  }

  switch (messagePrivacy) {
    case 'PUBLIC':
      return true;
    
    case 'AUTHOR_VISIBLE':
      // Check if user is author, reviewer, editor, or admin
      if (userRole === 'EDITOR' || userRole === 'ADMIN') return true;
      
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
      if (userRole === 'EDITOR' || userRole === 'ADMIN') return true;
      
      const reviewAssignment = await prisma.reviewAssignment.findFirst({
        where: {
          manuscriptId,
          reviewerId: userId
        }
      });
      return !!reviewAssignment;
    
    case 'EDITOR_ONLY':
      return userRole === 'EDITOR' || userRole === 'ADMIN';
    
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
    case 'EDITOR':
      return 'AUTHOR_VISIBLE';
    case 'REVIEWER':
      return 'REVIEWER_ONLY';
    case 'AUTHOR':
    default:
      return 'AUTHOR_VISIBLE';
  }
}

// GET /api/conversations - List conversations
router.get('/', optionalAuth, async (req, res, next) => {
  try {
    const { 
      manuscriptId,
      type,
      privacy,
      page = '1',
      limit = '20'
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // Build where clause
    const where: any = {};
    if (manuscriptId) where.manuscriptId = manuscriptId as string;
    if (type) where.type = type as string;
    if (privacy) where.privacy = privacy as string;

    // Filter conversations based on authentication and privacy
    if (!req.user) {
      // Unauthenticated users can only see PUBLIC conversations
      where.privacy = 'PUBLIC';
    } else {
      // Authenticated users have more complex filtering rules
      if (!privacy) { // Only apply automatic filtering if privacy filter isn't explicitly set
        if (req.user.role === 'ADMIN' || req.user.role === 'EDITOR') {
          // Admins and editors can see all conversations (no additional filter)
        } else {
          // Authors and reviewers can see:
          // 1. PUBLIC conversations
          // 2. SEMI_PUBLIC conversations 
          // 3. PRIVATE conversations they participate in
          const userAccessiblePrivacyLevels = ['PUBLIC', 'SEMI_PUBLIC'];
          
          where.OR = [
            { privacy: { in: userAccessiblePrivacyLevels } },
            {
              privacy: 'PRIVATE',
              participants: {
                some: {
                  userId: req.user.id
                }
              }
            }
          ];
        }
      }
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
              authors: true
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
      type: conv.type,
      privacy: conv.privacy,
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
    const visibleMessages = [];
    for (const msg of conversation.messages) {
      const canSee = await canUserSeeMessage(
        req.user?.id, 
        req.user?.role, 
        msg.privacy, 
        conversation.manuscriptId
      );
      if (canSee) {
        visibleMessages.push(msg);
      }
    }

    // Format response
    const formattedConversation = {
      id: conversation.id,
      title: conversation.title,
      type: conversation.type,
      privacy: conversation.privacy,
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
router.post('/:id/messages', authenticate, requirePermission(Permission.CREATE_CONVERSATION), async (req, res, next) => {
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
            await prisma.message.create({
              data: {
                content: botMessage.content,
                conversationId,
                authorId: botUserId,
                parentId: botMessage.replyTo || message.id,
                privacy: 'AUTHOR_VISIBLE',
                isBot: true
              }
            });
          }
        }

        if (botResponse.errors && botResponse.errors.length > 0) {
          console.error('Bot execution errors:', botResponse.errors);
          
          if (botResponse.botId) {
            const botUserId = botExecutor.getBotUserId(botResponse.botId);
            if (botUserId) {
              // Create error message for debugging
              await prisma.message.create({
                data: {
                  content: `❌ **Bot Error:** ${botResponse.errors.join(', ')}`,
                  conversationId,
                  authorId: botUserId,
                  parentId: message.id,
                  privacy: 'AUTHOR_VISIBLE', // Make errors visible to users for better UX
                  isBot: true
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

    // Fetch and broadcast any bot responses that were created
    setTimeout(async () => {
      try {
        // Give bots a moment to process and create responses
        const botMessages = await prisma.message.findMany({
          where: {
            conversationId,
            isBot: true,
            createdAt: {
              gte: new Date(Date.now() - 5000) // Messages created in the last 5 seconds
            }
          },
          include: {
            author: {
              select: { 
                id: true, 
                firstName: true, 
                lastName: true, 
                email: true, 
                role: true 
              }
            }
          },
          orderBy: { createdAt: 'asc' }
        });

        // Broadcast each bot message
        for (const botMessage of botMessages) {
          const formattedBotMessage = {
            id: botMessage.id,
            content: botMessage.content,
            privacy: botMessage.privacy,
            author: botMessage.author,
            createdAt: botMessage.createdAt,
            updatedAt: botMessage.updatedAt,
            parentId: botMessage.parentId,
            isBot: botMessage.isBot
          };

          broadcastToConversation(conversationId, {
            type: 'new-message',
            message: formattedBotMessage
          });
        }
      } catch (error) {
        console.error('Error broadcasting bot messages:', error);
      }
    }, 1000); // Wait 1 second for bot processing

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