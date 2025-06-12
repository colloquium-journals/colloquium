import { Bot, BotContext, BotResponse, BotTrigger } from '@colloquium/types';

export class BotExecutor {
  private bots: Map<string, Bot> = new Map();
  private installations: Map<string, any> = new Map();

  registerBot(bot: Bot): void {
    this.bots.set(bot.id, bot);
  }

  unregisterBot(botId: string): void {
    this.bots.delete(botId);
    this.installations.delete(botId);
  }

  installBot(botId: string, config: any): void {
    if (!this.bots.has(botId)) {
      throw new Error(`Bot ${botId} is not registered`);
    }
    this.installations.set(botId, { ...config, isEnabled: true });
  }

  uninstallBot(botId: string): void {
    this.installations.delete(botId);
  }

  async executeBot(botId: string, context: BotContext): Promise<BotResponse> {
    const bot = this.bots.get(botId);
    if (!bot) {
      throw new Error(`Bot ${botId} is not registered`);
    }

    const installation = this.installations.get(botId);
    if (!installation || !installation.isEnabled) {
      throw new Error(`Bot ${botId} is not installed or is disabled`);
    }

    try {
      // Merge installation config with context
      const enhancedContext: BotContext = {
        ...context,
        config: { ...context.config, ...installation }
      };

      // Execute bot with timeout
      const timeoutMs = process.env.BOT_EXECUTION_TIMEOUT ? 
        parseInt(process.env.BOT_EXECUTION_TIMEOUT) : 30000;

      const response = await Promise.race([
        bot.execute(enhancedContext),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Bot execution timeout')), timeoutMs)
        )
      ]);

      return response;
    } catch (error) {
      console.error(`Bot ${botId} execution failed:`, error);
      return {
        errors: [error instanceof Error ? error.message : 'Unknown error occurred']
      };
    }
  }

  async executeBotsByTrigger(trigger: BotTrigger, context: BotContext): Promise<BotResponse[]> {
    const responses: BotResponse[] = [];

    for (const [botId, bot] of this.bots.entries()) {
      const installation = this.installations.get(botId);
      
      if (!installation || !installation.isEnabled) {
        continue;
      }

      if (bot.triggers.includes(trigger)) {
        try {
          const response = await this.executeBot(botId, context);
          responses.push(response);
        } catch (error) {
          console.error(`Failed to execute bot ${botId}:`, error);
          responses.push({
            errors: [error instanceof Error ? error.message : 'Unknown error occurred']
          });
        }
      }
    }

    return responses;
  }

  getInstalledBots(): Array<{ botId: string; bot: Bot; config: any }> {
    const installed: Array<{ botId: string; bot: Bot; config: any }> = [];

    for (const [botId, config] of this.installations.entries()) {
      const bot = this.bots.get(botId);
      if (bot) {
        installed.push({ botId, bot, config });
      }
    }

    return installed;
  }

  getAvailableBots(): Bot[] {
    return Array.from(this.bots.values());
  }
}

// Global bot executor instance
export const botExecutor = new BotExecutor();