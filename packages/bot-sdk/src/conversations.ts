import { HttpClient } from './http';

export interface ConversationMessage {
  id: string;
  content: string;
  privacy: string;
  author: { id: string; name: string | null; email: string };
  createdAt: string;
  parentId: string | null;
  isBot: boolean;
  metadata: Record<string, unknown> | null;
}

export interface ConversationInfo {
  id: string;
  title: string;
  type: string;
}

export function createConversationClient(http: HttpClient, manuscriptId: string) {
  return {
    async getMessages(
      conversationId: string,
      options?: { limit?: number; before?: string }
    ): Promise<{ messages: ConversationMessage[]; hasMore: boolean }> {
      const params = new URLSearchParams();
      if (options?.limit) params.set('limit', String(options.limit));
      if (options?.before) params.set('before', options.before);
      const qs = params.toString();
      const path = `/api/conversations/${conversationId}/messages${qs ? `?${qs}` : ''}`;
      return http.getJSON(path);
    },

    async postMessage(
      conversationId: string,
      content: string,
      options?: { parentId?: string; privacy?: string }
    ): Promise<ConversationMessage> {
      const res = await http.postJSON<{ data: ConversationMessage }>(
        `/api/conversations/${conversationId}/messages`,
        { content, ...options }
      );
      return res.data;
    },

    async listConversations(): Promise<ConversationInfo[]> {
      const res = await http.getJSON<{ conversations: ConversationInfo[] }>(
        `/api/conversations?manuscriptId=${manuscriptId}`
      );
      return res.conversations;
    },
  };
}

export type ConversationClient = ReturnType<typeof createConversationClient>;
