import { Job } from 'bull';
import { prisma } from '@colloquium/database';
import { botExecutor } from '../bots/index';
import { broadcastToConversation } from '../routes/events';
import { generateBotServiceToken } from '../middleware/auth';
import { BotProcessingJob } from './index';
import { randomUUID } from 'crypto';
import { BotActionProcessor } from '../services/botActionProcessor';

export const processBotJob = async (job: Job<BotProcessingJob>) => {
  const { messageId, conversationId, userId, manuscriptId } = job.data;
  
  
  try {
    // Fetch the message and related data
    const message = await prisma.messages.findUnique({
      where: { id: messageId },
      include: {
        users: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    if (!message) {
      throw new Error(`Message ${messageId} not found`);
    }

    const user = await prisma.users.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw new Error(`User ${userId} not found`);
    }

    // Generate service token for bot API calls
    const serviceToken = generateBotServiceToken('system', manuscriptId || '', ['read_manuscript_files', 'upload_files']);

    // Process the message using the bot executor
    const botResponses = await botExecutor.processMessage(message.content, {
      conversationId,
      manuscriptId: manuscriptId || '',
      triggeredBy: {
        messageId: message.id,
        userId: user.id,
        userRole: user.role,
        trigger: 'MENTION' as any
      },
      journal: {
        id: 'default', // TODO: Get actual journal ID
        settings: {}
      },
      config: {},
      serviceToken
    });

    if (botResponses && botResponses.length > 0) {
      
      // Process each bot response
      for (const botResponse of botResponses) {
        if (botResponse.messages && botResponse.botId) {
          const botUserId = botExecutor.getBotUserId(botResponse.botId || '');
          if (!botUserId) {
            console.error(`No user ID found for bot: ${botResponse.botId}`);
            continue;
          }

          // Create bot response messages
          for (const botMessage of botResponse.messages) {
            const messageData: any = {
              id: randomUUID(),
              content: botMessage.content,
              conversationId: message.conversationId,
              authorId: botUserId,
              parentId: botMessage.replyTo || message.id,
              privacy: message.privacy,
              isBot: true,
              updatedAt: new Date()
            };

            if (botMessage.actions?.length) {
              messageData.metadata = { actions: botMessage.actions };
            }

            const responseMessage = await prisma.messages.create({
              data: messageData,
              include: {
                users: {
                  select: {
                    id: true,
                    name: true,
                    email: true
                  }
                }
              }
            });

            // Format the message for broadcasting
            const formattedMessage = {
              id: responseMessage.id,
              content: responseMessage.content,
              privacy: responseMessage.privacy,
              author: (responseMessage as any).users,
              createdAt: responseMessage.createdAt,
              updatedAt: responseMessage.updatedAt,
              parentId: responseMessage.parentId,
              isBot: responseMessage.isBot,
              metadata: responseMessage.metadata
            };

            // Broadcast the bot response via SSE with permission filtering
            await broadcastToConversation(conversationId, {
              type: 'new-message',
              message: formattedMessage
            }, manuscriptId);

          }
        }

        // Process bot actions (file uploads, status changes, etc.)
        if (botResponse.actions && botResponse.actions.length > 0) {
          const actionProcessor = new BotActionProcessor();
          const actionContext = {
            manuscriptId: manuscriptId || '',
            userId: userId,
            conversationId: conversationId
          };
          
          try {
            await actionProcessor.processActions(botResponse.actions, actionContext);
          } catch (actionError) {
            console.error(`Failed to process bot actions:`, actionError);
            // Continue with other processing even if actions fail
          }
        }

        // Log bot errors for monitoring but don't create separate warning messages
        // since bots should handle their own error messaging
        if (botResponse.errors && botResponse.errors.length > 0) {
          console.warn(`Bot ${botResponse.botId} reported errors:`, botResponse.errors);
        }
      }
    }

    return {
      success: true,
      messageId,
      botResultsCount: botResponses?.length || 0,
      processedAt: new Date().toISOString()
    };

  } catch (error) {
    console.error(`Bot processing failed for message ${messageId}:`, error);
    
    // Create a user-visible error message for critical failures
    try {
      // Try to get system bot user ID, fallback to first available bot user
      let systemBotUserId: string | undefined;
      try {
        systemBotUserId = botExecutor.getBotUserId('system') || botExecutor.getBotUserId('bot-editorial');
      } catch (err) {
        console.warn('Could not find system bot user ID');
      }

      if (systemBotUserId) {
        const errorMessage = await prisma.messages.create({
          data: {
            id: randomUUID(),
            content: `❌ **Bot Processing Failed**\n\nSorry, there was an error processing your bot command. Please try again or contact support if the issue persists.`,
            conversationId: conversationId,
            authorId: systemBotUserId,
            isBot: true,
            parentId: messageId,
            privacy: 'AUTHOR_VISIBLE',
            updatedAt: new Date()
          },
          include: {
            users: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          }
        });

        // Broadcast error message
        broadcastToConversation(conversationId, {
          type: 'new-message',
          message: {
            id: errorMessage.id,
            content: errorMessage.content,
            privacy: errorMessage.privacy,
            author: errorMessage.users,
            createdAt: errorMessage.createdAt,
            updatedAt: errorMessage.updatedAt,
            parentId: errorMessage.parentId,
            isBot: errorMessage.isBot
          }
        });
      }
    } catch (broadcastError) {
      console.error(`Failed to broadcast error message:`, broadcastError);
    }

    throw error; // Re-throw to mark the job as failed
  }
};

