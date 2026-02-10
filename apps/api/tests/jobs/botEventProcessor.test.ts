jest.mock('@colloquium/database', () => ({
  prisma: {
    manuscripts: {
      findUnique: jest.fn(),
    },
    manuscript_files: {
      findMany: jest.fn(),
    },
    conversations: {
      findFirst: jest.fn(),
    },
    messages: {
      create: jest.fn(),
    },
  },
}));

jest.mock('../../src/bots/index', () => ({
  botExecutor: {
    getInstalledBots: jest.fn(),
    getBotUserId: jest.fn(),
  },
  getBotPermissions: jest.fn().mockReturnValue(['read_manuscript', 'read_manuscript_files', 'bot_storage']),
}));

jest.mock('../../src/routes/events', () => ({
  broadcastToConversation: jest.fn(),
}));

jest.mock('../../src/middleware/auth', () => ({
  generateBotServiceToken: jest.fn().mockReturnValue('mock-token'),
}));

jest.mock('../../src/services/botActionProcessor', () => ({
  BotActionProcessor: jest.fn().mockImplementation(() => ({
    processActions: jest.fn(),
  })),
}));

import { processBotEventJob } from '../../src/jobs/botEventProcessor';
import { botExecutor } from '../../src/bots/index';
import { prisma } from '@colloquium/database';
import { broadcastToConversation } from '../../src/routes/events';

// Use string values matching BotEventName enum
const REVIEWER_ASSIGNED = 'reviewer.assigned';
const FILE_UPLOADED = 'file.uploaded';

describe('botEventProcessor', () => {
  const mockHandler = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    (botExecutor.getInstalledBots as jest.Mock).mockReturnValue([
      {
        botId: 'bot-checklist',
        bot: {
          events: {
            [REVIEWER_ASSIGNED]: mockHandler,
          },
        },
        config: {},
      },
    ]);

    (prisma.manuscripts.findUnique as jest.Mock).mockResolvedValue({
      title: 'Test Paper',
      abstract: 'Abstract',
      status: 'UNDER_REVIEW',
      keywords: ['test'],
      workflowPhase: 'REVIEW',
      workflowRound: 1,
      manuscript_authors: [{ users: { name: 'Author One' } }],
    });

    (prisma.manuscript_files.findMany as jest.Mock).mockResolvedValue([]);
  });

  it('should invoke the bot event handler with correct context and payload', async () => {
    mockHandler.mockResolvedValue(undefined);

    await processBotEventJob({
      eventName: REVIEWER_ASSIGNED,
      botId: 'bot-checklist',
      manuscriptId: 'ms-1',
      payload: { reviewerId: 'r-1', dueDate: null, status: 'ACCEPTED' },
    });

    expect(mockHandler).toHaveBeenCalledTimes(1);
    const [context, payload] = mockHandler.mock.calls[0];
    expect(context.manuscriptId).toBe('ms-1');
    expect(context.serviceToken).toBe('mock-token');
    expect(context.manuscript?.title).toBe('Test Paper');
    expect(payload).toEqual({ reviewerId: 'r-1', dueDate: null, status: 'ACCEPTED' });
  });

  it('should create messages when handler returns them', async () => {
    mockHandler.mockResolvedValue({
      messages: [{ content: 'Auto checklist generated' }],
    });

    (prisma.conversations.findFirst as jest.Mock).mockResolvedValue({
      id: 'conv-1',
    });
    (botExecutor.getBotUserId as jest.Mock).mockReturnValue('bot-user-1');
    (prisma.messages.create as jest.Mock).mockResolvedValue({
      id: 'msg-1',
      content: 'Auto checklist generated',
      privacy: 'AUTHOR_VISIBLE',
      users: { id: 'bot-user-1', name: 'Checklist Bot', email: 'bot@test.com' },
      createdAt: new Date(),
      updatedAt: new Date(),
      parentId: null,
      isBot: true,
      metadata: null,
    });

    await processBotEventJob({
      eventName: REVIEWER_ASSIGNED,
      botId: 'bot-checklist',
      manuscriptId: 'ms-1',
      payload: { reviewerId: 'r-1', dueDate: null, status: 'ACCEPTED' },
    });

    expect(prisma.messages.create).toHaveBeenCalledTimes(1);
    expect(broadcastToConversation).toHaveBeenCalledTimes(1);
  });

  it('should skip if bot is not found', async () => {
    await processBotEventJob({
      eventName: REVIEWER_ASSIGNED,
      botId: 'bot-nonexistent',
      manuscriptId: 'ms-1',
      payload: { reviewerId: 'r-1', dueDate: null, status: 'ACCEPTED' },
    });

    expect(mockHandler).not.toHaveBeenCalled();
  });

  it('should skip if handler for event is not found', async () => {
    await processBotEventJob({
      eventName: FILE_UPLOADED,
      botId: 'bot-checklist',
      manuscriptId: 'ms-1',
      payload: { file: { id: 'f-1', name: 'test.pdf', type: 'SOURCE', mimetype: 'application/pdf' } },
    });

    expect(mockHandler).not.toHaveBeenCalled();
  });

  it('should not create messages when handler returns void', async () => {
    mockHandler.mockResolvedValue(undefined);

    await processBotEventJob({
      eventName: REVIEWER_ASSIGNED,
      botId: 'bot-checklist',
      manuscriptId: 'ms-1',
      payload: { reviewerId: 'r-1', dueDate: null, status: 'ACCEPTED' },
    });

    expect(prisma.messages.create).not.toHaveBeenCalled();
  });
});
