import { BotContext, BotTrigger } from '@colloquium/types';

export function createBotContext(params: {
  conversationId: string;
  manuscriptId: string;
  triggeredBy: {
    messageId: string;
    userId: string;
    trigger: BotTrigger;
  };
  journal?: {
    id: string;
    settings: Record<string, any>;
  };
  config?: Record<string, any>;
}): BotContext {
  return {
    conversationId: params.conversationId,
    manuscriptId: params.manuscriptId,
    triggeredBy: params.triggeredBy,
    journal: params.journal || {
      id: 'default',
      settings: {}
    },
    config: params.config || {}
  };
}