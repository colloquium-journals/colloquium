jest.mock('../../src/bots/index', () => ({
  botExecutor: {
    getInstalledBots: jest.fn(),
  },
}));

jest.mock('../../src/jobs/index', () => ({
  addBotEventJob: jest.fn(),
}));

import { dispatchBotEvent } from '../../src/services/botEventDispatcher';
import { botExecutor } from '../../src/bots/index';
import { addBotEventJob } from '../../src/jobs/index';

// Use string values matching BotEventName enum
const REVIEWER_ASSIGNED = 'reviewer.assigned' as any;
const MANUSCRIPT_SUBMITTED = 'manuscript.submitted' as any;
const FILE_UPLOADED = 'file.uploaded' as any;

describe('botEventDispatcher', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should queue jobs for bots that subscribe to the event', async () => {
    (botExecutor.getInstalledBots as jest.Mock).mockReturnValue([
      {
        botId: 'bot-checklist',
        bot: {
          events: {
            [REVIEWER_ASSIGNED]: async () => {},
          },
        },
        config: { isEnabled: true },
      },
      {
        botId: 'bot-no-events',
        bot: {},
        config: { isEnabled: true },
      },
    ]);

    await dispatchBotEvent(REVIEWER_ASSIGNED, 'ms-1', { reviewerId: 'r-1', dueDate: null, status: 'ACCEPTED' });

    expect(addBotEventJob).toHaveBeenCalledTimes(1);
    expect(addBotEventJob).toHaveBeenCalledWith({
      eventName: REVIEWER_ASSIGNED,
      botId: 'bot-checklist',
      manuscriptId: 'ms-1',
      payload: { reviewerId: 'r-1', dueDate: null, status: 'ACCEPTED' },
    });
  });

  it('should skip disabled bots', async () => {
    (botExecutor.getInstalledBots as jest.Mock).mockReturnValue([
      {
        botId: 'bot-disabled',
        bot: {
          events: {
            [MANUSCRIPT_SUBMITTED]: async () => {},
          },
        },
        config: { isEnabled: false },
      },
    ]);

    await dispatchBotEvent(MANUSCRIPT_SUBMITTED, 'ms-1', { manuscriptId: 'ms-1' });

    expect(addBotEventJob).not.toHaveBeenCalled();
  });

  it('should skip bots without matching event handler', async () => {
    (botExecutor.getInstalledBots as jest.Mock).mockReturnValue([
      {
        botId: 'bot-checklist',
        bot: {
          events: {
            [REVIEWER_ASSIGNED]: async () => {},
          },
        },
        config: { isEnabled: true },
      },
    ]);

    await dispatchBotEvent(FILE_UPLOADED, 'ms-1', { file: { id: 'f-1', name: 'test.pdf', type: 'SOURCE', mimetype: 'application/pdf' } });

    expect(addBotEventJob).not.toHaveBeenCalled();
  });

  it('should queue jobs for multiple matching bots', async () => {
    (botExecutor.getInstalledBots as jest.Mock).mockReturnValue([
      {
        botId: 'bot-a',
        bot: { events: { [MANUSCRIPT_SUBMITTED]: async () => {} } },
        config: { isEnabled: true },
      },
      {
        botId: 'bot-b',
        bot: { events: { [MANUSCRIPT_SUBMITTED]: async () => {} } },
        config: { isEnabled: true },
      },
    ]);

    await dispatchBotEvent(MANUSCRIPT_SUBMITTED, 'ms-1', { manuscriptId: 'ms-1' });

    expect(addBotEventJob).toHaveBeenCalledTimes(2);
  });

  it('should treat bots without isEnabled field as enabled', async () => {
    (botExecutor.getInstalledBots as jest.Mock).mockReturnValue([
      {
        botId: 'bot-default',
        bot: { events: { [MANUSCRIPT_SUBMITTED]: async () => {} } },
        config: {},
      },
    ]);

    await dispatchBotEvent(MANUSCRIPT_SUBMITTED, 'ms-1', { manuscriptId: 'ms-1' });

    expect(addBotEventJob).toHaveBeenCalledTimes(1);
  });
});
