import { botExecutor, getBotPermissions } from '../bots/index';
import { generateBotServiceToken } from '../middleware/auth';
import { broadcastToConversation } from '../routes/events';
import { prisma } from '@colloquium/database';
import { PipelineStepJob, addPipelineStepJob } from './index';
import { randomUUID } from 'crypto';
import { BotActionProcessor } from '../services/botActionProcessor';

export async function processPipelineStep(payload: PipelineStepJob): Promise<void> {
  const { manuscriptId, steps, stepIndex } = payload;

  if (stepIndex >= steps.length) return;

  const step = steps[stepIndex];
  const { bot: botId, command, parameters = {} } = step;

  const commandBots = botExecutor.getCommandBots();
  const bot = commandBots.find(b => b.id === botId);
  if (!bot) {
    console.error(`Pipeline step ${stepIndex}: bot ${botId} not found`);
    return;
  }

  const installedBots = botExecutor.getInstalledBots();
  const installation = installedBots.find(ib => ib.botId === botId);
  if (!installation || installation.config.isEnabled === false) {
    console.error(`Pipeline step ${stepIndex}: bot ${botId} not installed or enabled`);
    return;
  }

  const serviceToken = generateBotServiceToken(botId, manuscriptId, getBotPermissions(botId));

  const result = await botExecutor.executeCommandBot(
    {
      botId,
      command,
      parameters,
      rawText: `@${botId} ${command}`,
    },
    {
      conversationId: '',
      manuscriptId,
      triggeredBy: {
        messageId: '',
        userId: 'system',
        userRole: 'SYSTEM',
        trigger: 'EVENT' as any,
      },
      journal: { id: 'default', settings: {} },
      config: { apiUrl: process.env.API_URL || 'http://localhost:4000', ...installation.config },
      serviceToken,
    }
  );

  if (result.messages?.length) {
    const conversation = await prisma.conversations.findFirst({
      where: { manuscriptId, type: 'REVIEW' },
      orderBy: { createdAt: 'asc' },
    });

    if (conversation) {
      const botUserId = botExecutor.getBotUserId(botId);
      if (botUserId) {
        for (const botMessage of result.messages) {
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

          const responseMessage = await prisma.messages.create({
            data: messageData,
            include: { users: { select: { id: true, name: true, email: true } } },
          });

          await broadcastToConversation(conversation.id, {
            type: 'new-message',
            message: {
              id: responseMessage.id,
              content: responseMessage.content,
              privacy: responseMessage.privacy,
              author: (responseMessage as any).users,
              createdAt: responseMessage.createdAt,
              updatedAt: responseMessage.updatedAt,
              parentId: responseMessage.parentId,
              isBot: responseMessage.isBot,
              metadata: responseMessage.metadata,
            },
          }, manuscriptId);
        }
      }
    }
  }

  if (result.actions?.length) {
    const actionProcessor = new BotActionProcessor();
    try {
      await actionProcessor.processActions(result.actions, { manuscriptId, userId: 'system', conversationId: '' });
    } catch (actionError) {
      console.error('Failed to process pipeline bot actions:', actionError);
    }
  }

  if (result.errors?.length) {
    console.error(`Pipeline step ${stepIndex} (${botId}/${command}) errors:`, result.errors);
    return;
  }

  // Queue next step
  if (stepIndex + 1 < steps.length) {
    await addPipelineStepJob({
      manuscriptId,
      steps,
      stepIndex: stepIndex + 1,
    });
  }
}
