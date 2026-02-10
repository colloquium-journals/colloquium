import { prisma } from '@colloquium/database';
import { BotEventName } from '@colloquium/types';
import { botExecutor, getBotPermissions } from '../bots/index';
import { broadcastToConversation } from '../routes/events';
import { generateBotServiceToken } from '../middleware/auth';
import { BotEventJob } from './index';
import { randomUUID } from 'crypto';
import { BotActionProcessor } from '../services/botActionProcessor';

export const processBotEventJob = async (payload: BotEventJob) => {
  const { eventName, botId, manuscriptId, payload: eventPayload } = payload;

  const installedBots = botExecutor.getInstalledBots();
  const botEntry = installedBots.find(b => b.botId === botId);
  if (!botEntry) return;

  const handler = botEntry.bot.events?.[eventName as BotEventName];
  if (!handler) return;

  const serviceToken = generateBotServiceToken(botId, manuscriptId, getBotPermissions(botId));

  let manuscriptData: { title: string; abstract: string | null; authors: string[]; status: string; keywords: string[]; workflowPhase: string | null; workflowRound: number } | undefined;
  let filesData: Array<{ id: string; originalName: string; filename: string; fileType: string; mimetype: string; size: number }> | undefined;
  let conversationData: { id: string; privacy: string; messageCount: number } | undefined;

  try {
    const [manuscript, files] = await Promise.all([
      prisma.manuscripts.findUnique({
        where: { id: manuscriptId },
        select: {
          title: true,
          abstract: true,
          status: true,
          keywords: true,
          workflowPhase: true,
          workflowRound: true,
          manuscript_authors: {
            select: { users: { select: { name: true } } }
          }
        }
      }),
      prisma.manuscript_files.findMany({
        where: { manuscriptId },
        select: { id: true, originalName: true, filename: true, fileType: true, mimetype: true, size: true }
      })
    ]);

    if (manuscript) {
      manuscriptData = {
        title: manuscript.title,
        abstract: manuscript.abstract,
        authors: manuscript.manuscript_authors.map(
          (ma: { users: { name: string | null } }) => ma.users.name || 'Unknown'
        ),
        status: manuscript.status,
        keywords: manuscript.keywords as string[],
        workflowPhase: manuscript.workflowPhase,
        workflowRound: manuscript.workflowRound,
      };
    }

    filesData = files.map((f: { id: string; originalName: string; filename: string; fileType: string; mimetype: string; size: number }) => ({
      id: f.id,
      originalName: f.originalName,
      filename: f.filename,
      fileType: f.fileType,
      mimetype: f.mimetype,
      size: f.size,
    }));
    // Pre-fetch conversation metadata (use REVIEW conversation)
    const conversation = await prisma.conversations.findFirst({
      where: { manuscriptId, type: 'REVIEW' },
      orderBy: { createdAt: 'asc' },
      select: { id: true, privacy: true },
    });
    if (conversation) {
      const msgCount = await prisma.messages.count({ where: { conversationId: conversation.id } });
      conversationData = {
        id: conversation.id,
        privacy: conversation.privacy,
        messageCount: msgCount,
      };
    }
  } catch (prefetchError) {
    console.warn('Failed to pre-fetch manuscript/files for bot event context:', prefetchError);
  }

  const context = {
    conversationId: conversationData?.id || '',
    manuscriptId,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    triggeredBy: { messageId: '', userId: 'system', userRole: 'SYSTEM', trigger: 'EVENT' as any },
    journal: { id: 'default', settings: {} },
    config: { apiUrl: process.env.API_URL || 'http://localhost:4000', ...botEntry.config },
    serviceToken,
    manuscript: manuscriptData,
    files: filesData,
    conversation: conversationData,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const response = await handler(context, eventPayload as any);

  if (response?.messages?.length) {
    const conversation = await prisma.conversations.findFirst({
      where: { manuscriptId, type: 'REVIEW' },
      orderBy: { createdAt: 'asc' },
    });

    if (conversation) {
      const botUserId = botExecutor.getBotUserId(botId);
      if (!botUserId) {
        console.error(`No user ID found for bot: ${botId}`);
        return;
      }

      for (const botMessage of response.messages) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const messageData: any = {
          id: randomUUID(),
          content: botMessage.content,
          conversationId: conversation.id,
          authorId: botUserId,
          privacy: 'AUTHOR_VISIBLE',
          isBot: true,
          updatedAt: new Date(),
        };
        if (botMessage.actions?.length) {
          messageData.metadata = { actions: botMessage.actions };
        }

        const responseMessage = await prisma.messages.create({
          data: messageData,
          include: {
            users: {
              select: { id: true, name: true, email: true }
            }
          }
        });

        const formattedMessage = {
          id: responseMessage.id,
          content: responseMessage.content,
          privacy: responseMessage.privacy,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          author: (responseMessage as any).users,
          createdAt: responseMessage.createdAt,
          updatedAt: responseMessage.updatedAt,
          parentId: responseMessage.parentId,
          isBot: responseMessage.isBot,
          metadata: responseMessage.metadata
        };

        await broadcastToConversation(conversation.id, {
          type: 'new-message',
          message: formattedMessage
        }, manuscriptId);
      }
    }
  }

  if (response?.actions?.length) {
    const actionProcessor = new BotActionProcessor();
    const actionContext = {
      manuscriptId,
      userId: 'system',
      conversationId: ''
    };

    try {
      await actionProcessor.processActions(response.actions, actionContext);
    } catch (actionError) {
      console.error('Failed to process bot event actions:', actionError);
    }
  }
};
