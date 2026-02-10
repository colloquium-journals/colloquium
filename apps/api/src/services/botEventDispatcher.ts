import { BotEventName } from '@colloquium/types';
import { botExecutor } from '../bots/index';
import { addBotEventJob } from '../jobs/index';

export async function dispatchBotEvent(
  eventName: BotEventName,
  manuscriptId: string,
  payload: Record<string, unknown>
): Promise<void> {
  const installedBots = botExecutor.getInstalledBots();

  for (const { botId, bot, config } of installedBots) {
    if (!config.isEnabled && config.isEnabled !== undefined) continue;
    if (!bot.events?.[eventName]) continue;

    await addBotEventJob({
      eventName,
      botId,
      manuscriptId,
      payload,
    });
  }
}
