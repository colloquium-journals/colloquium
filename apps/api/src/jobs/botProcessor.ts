import { Job } from 'bull';
import { prisma } from '@colloquium/database';
import { botExecutor } from '../bots/index';
import { broadcastToConversation } from '../routes/events';
import { generateBotServiceToken } from '../middleware/auth';
import { BotProcessingJob } from './index';

export const processBotJob = async (job: Job<BotProcessingJob>) => {
  const { messageId, conversationId, userId, manuscriptId } = job.data;
  
  console.log(`Processing bot job for message ${messageId} in conversation ${conversationId}`);
  
  try {
    // Fetch the message and related data
    const message = await prisma.message.findUnique({
      where: { id: messageId },
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

    if (!message) {
      throw new Error(`Message ${messageId} not found`);
    }

    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw new Error(`User ${userId} not found`);
    }

    console.log(`Processing bot mentions for message: "${message.content.substring(0, 100)}..."`);

    // Generate service token for bot API calls
    const serviceToken = generateBotServiceToken('system', manuscriptId || '', ['read_manuscript_files', 'upload_files']);

    // Process the message using the bot executor
    const botResponses = await botExecutor.processMessage(message.content, {
      conversationId,
      manuscriptId: manuscriptId || '',
      triggeredBy: {
        messageId: message.id,
        userId: user.id,
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
      console.log(`Bot processing completed with ${botResponses.length} results`);
      
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
            const responseMessage = await prisma.message.create({
              data: {
                content: botMessage.content,
                conversationId: message.conversationId,
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

            // Format the message for broadcasting
            const formattedMessage = {
              id: responseMessage.id,
              content: responseMessage.content,
              privacy: responseMessage.privacy,
              author: responseMessage.author,
              createdAt: responseMessage.createdAt,
              updatedAt: responseMessage.updatedAt,
              parentId: responseMessage.parentId,
              isBot: responseMessage.isBot
            };

            // Broadcast the bot response via SSE with permission filtering
            await broadcastToConversation(conversationId, {
              type: 'new-message',
              message: formattedMessage
            }, manuscriptId);

            console.log(`Bot response message created and broadcasted: ${responseMessage.id}`);
          }
        }

        // Process bot actions (file uploads, status changes, etc.)
        if (botResponse.actions && botResponse.actions.length > 0) {
          for (const action of botResponse.actions) {
            try {
              await processBotAction(action, conversationId, user);
            } catch (actionError) {
              console.error(`Failed to process bot action:`, actionError);
              // Continue with other actions even if one fails
            }
          }
        }

        // Handle bot errors
        if (botResponse.errors && botResponse.errors.length > 0) {
          console.warn(`Bot ${botResponse.botId} reported errors:`, botResponse.errors);
          
          const botUserId = botExecutor.getBotUserId(botResponse.botId || '');
          if (botUserId) {
            // Create an error message visible to users
            const errorMessage = await prisma.message.create({
              data: {
                content: `⚠️ **Bot Processing Warning**\n\nThe ${botResponse.botId} bot encountered some issues while processing your request. Some features may not work as expected.`,
                conversationId: message.conversationId,
                authorId: botUserId,
                parentId: message.id,
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

            // Broadcast error message
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
    } else {
      console.log('No bot results generated for this message');
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
        systemBotUserId = botExecutor.getBotUserId('system') || botExecutor.getBotUserId('editorial-bot');
      } catch (err) {
        console.warn('Could not find system bot user ID');
      }

      if (systemBotUserId) {
        const errorMessage = await prisma.message.create({
          data: {
            content: `❌ **Bot Processing Failed**\n\nSorry, there was an error processing your bot command. Please try again or contact support if the issue persists.`,
            conversationId: conversationId,
            authorId: systemBotUserId,
            isBot: true,
            parentId: messageId,
            privacy: 'AUTHOR_VISIBLE'
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

        // Broadcast error message
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
    } catch (broadcastError) {
      console.error(`Failed to broadcast error message:`, broadcastError);
    }

    throw error; // Re-throw to mark the job as failed
  }
};

// Helper function to process bot actions (file uploads, status changes, etc.)
async function processBotAction(action: any, conversationId: string, user: any) {
  console.log(`Processing bot action:`, action.type);
  
  switch (action.type) {
    case 'FILE_UPLOADED':
      // Handle file upload actions
      console.log(`Bot uploaded file: ${action.data?.filename}`);
      
      // Broadcast file upload event
      broadcastToConversation(conversationId, {
        type: 'file_uploaded',
        data: action.data
      });
      break;
      
    case 'STATUS_CHANGED':
      // Handle manuscript status changes
      if (action.data?.manuscriptId && action.data?.status) {
        await prisma.manuscript.update({
          where: { id: action.data.manuscriptId },
          data: { status: action.data.status }
        });
        
        // Broadcast status change
        broadcastToConversation(conversationId, {
          type: 'manuscript_status_changed',
          data: action.data
        });
      }
      break;
      
    case 'REVIEWER_ASSIGNED':
      // Handle reviewer assignment actions
      console.log(`Bot assigned reviewer: ${action.data?.reviewerId}`);
      
      // Broadcast reviewer assignment
      broadcastToConversation(conversationId, {
        type: 'reviewer_assigned',
        data: action.data
      });
      break;
      
    default:
      console.log(`Unknown bot action type: ${action.type}`);
  }
}