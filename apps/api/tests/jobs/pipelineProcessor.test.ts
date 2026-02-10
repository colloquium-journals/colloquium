jest.mock('@colloquium/database', () => ({
  prisma: {
    conversations: { findFirst: jest.fn() },
    messages: { create: jest.fn() },
  },
}));

jest.mock('../../src/bots/index', () => ({
  botExecutor: {
    getCommandBots: jest.fn(() => [
      { id: 'bot-ref', name: 'Ref Check', commands: [{ name: 'check' }], permissions: [] },
    ]),
    getInstalledBots: jest.fn(() => [
      { botId: 'bot-ref', bot: { id: 'bot-ref' }, config: { isEnabled: true } },
    ]),
    executeCommandBot: jest.fn(async () => ({
      messages: [{ content: 'Step result' }],
    })),
    getBotUserId: jest.fn(() => 'bot-ref-user'),
  },
  getBotPermissions: jest.fn(() => ['read_manuscript']),
}));

jest.mock('../../src/middleware/auth', () => ({
  generateBotServiceToken: jest.fn(() => 'step-token'),
}));

jest.mock('../../src/routes/events', () => ({
  broadcastToConversation: jest.fn(),
}));

jest.mock('../../src/services/botActionProcessor', () => ({
  BotActionProcessor: jest.fn().mockImplementation(() => ({
    processActions: jest.fn(),
  })),
}));

jest.mock('../../src/jobs/index', () => ({
  addPipelineStepJob: jest.fn(),
}));

import { processPipelineStep } from '../../src/jobs/pipelineProcessor';
import { prisma } from '@colloquium/database';
import { addPipelineStepJob } from '../../src/jobs/index';
import { botExecutor } from '../../src/bots/index';

describe('pipelineProcessor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.conversations.findFirst as jest.Mock).mockResolvedValue({ id: 'conv-1' });
    (prisma.messages.create as jest.Mock).mockResolvedValue({
      id: 'msg-1',
      content: 'Step result',
      privacy: 'AUTHOR_VISIBLE',
      createdAt: new Date(),
      updatedAt: new Date(),
      parentId: null,
      isBot: true,
      metadata: null,
      users: { id: 'bot-ref-user', name: 'Ref Check', email: 'bot-ref@colloquium.bot' },
    });
  });

  it('should execute the current pipeline step', async () => {
    await processPipelineStep({
      manuscriptId: 'ms-1',
      steps: [{ bot: 'bot-ref', command: 'check' }],
      stepIndex: 0,
    });

    expect(botExecutor.executeCommandBot).toHaveBeenCalled();
  });

  it('should queue the next step on success', async () => {
    await processPipelineStep({
      manuscriptId: 'ms-1',
      steps: [
        { bot: 'bot-ref', command: 'check' },
        { bot: 'bot-ref', command: 'validate' },
      ],
      stepIndex: 0,
    });

    expect(addPipelineStepJob).toHaveBeenCalledWith({
      manuscriptId: 'ms-1',
      steps: expect.any(Array),
      stepIndex: 1,
    });
  });

  it('should not queue next step on last step', async () => {
    await processPipelineStep({
      manuscriptId: 'ms-1',
      steps: [{ bot: 'bot-ref', command: 'check' }],
      stepIndex: 0,
    });

    expect(addPipelineStepJob).not.toHaveBeenCalled();
  });

  it('should stop pipeline on errors', async () => {
    (botExecutor.executeCommandBot as jest.Mock).mockResolvedValueOnce({
      errors: ['Something failed'],
    });

    await processPipelineStep({
      manuscriptId: 'ms-1',
      steps: [
        { bot: 'bot-ref', command: 'check' },
        { bot: 'bot-ref', command: 'validate' },
      ],
      stepIndex: 0,
    });

    expect(addPipelineStepJob).not.toHaveBeenCalled();
  });

  it('should skip step when bot is not found', async () => {
    (botExecutor.getCommandBots as jest.Mock).mockReturnValueOnce([]);

    await processPipelineStep({
      manuscriptId: 'ms-1',
      steps: [{ bot: 'bot-unknown', command: 'check' }],
      stepIndex: 0,
    });

    expect(botExecutor.executeCommandBot).not.toHaveBeenCalled();
  });

  it('should do nothing for out-of-range stepIndex', async () => {
    await processPipelineStep({
      manuscriptId: 'ms-1',
      steps: [{ bot: 'bot-ref', command: 'check' }],
      stepIndex: 5,
    });

    expect(botExecutor.executeCommandBot).not.toHaveBeenCalled();
  });
});
