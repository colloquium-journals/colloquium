import { HttpClient } from './http';

export interface BotInvocationResponse {
  messages?: Array<{
    content: string;
    replyTo?: string;
  }>;
  actions?: Array<{
    type: string;
    data: Record<string, unknown>;
  }>;
  errors?: string[];
}

export function createBotInvocationClient(http: HttpClient) {
  return {
    async invoke(
      botId: string,
      command: string,
      parameters?: Record<string, unknown>
    ): Promise<BotInvocationResponse> {
      return http.postJSON('/api/bots/invoke', { botId, command, parameters });
    },
  };
}

export type BotInvocationClient = ReturnType<typeof createBotInvocationClient>;
