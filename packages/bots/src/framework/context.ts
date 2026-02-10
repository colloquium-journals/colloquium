import { BotContext, BotTrigger } from '@colloquium/types';

export function createBotContext(params: {
  conversationId: string;
  manuscriptId: string;
  triggeredBy: {
    messageId: string;
    userId: string;
    userRole: string;
    trigger: BotTrigger;
  };
  journal?: {
    id: string;
    settings: Record<string, any>;
  };
  config?: Record<string, any>;
  serviceToken?: string;
  manuscript?: BotContext['manuscript'];
  files?: BotContext['files'];
}): BotContext {
  return {
    conversationId: params.conversationId,
    manuscriptId: params.manuscriptId,
    triggeredBy: params.triggeredBy,
    journal: params.journal || {
      id: 'default',
      settings: {}
    },
    config: params.config || {},
    serviceToken: params.serviceToken,
    manuscript: params.manuscript,
    files: params.files,
  };
}
