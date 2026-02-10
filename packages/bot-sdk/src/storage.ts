import { HttpClient } from './http';

export interface StorageClient {
  get<T = unknown>(key: string): Promise<T | null>;
  set(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<void>;
  list(): Promise<Array<{ key: string; updatedAt: string }>>;
}

export function createStorageClient(http: HttpClient): StorageClient {
  return {
    async get<T>(key: string) {
      try {
        const data = await http.getJSON<{ value: T }>(`/api/bot-storage/${encodeURIComponent(key)}`);
        return data?.value ?? null;
      } catch (error: unknown) {
        if (error && typeof error === 'object' && 'status' in error && (error as { status: number }).status === 404) return null;
        throw error;
      }
    },
    async set(key, value) {
      await http.putJSON(`/api/bot-storage/${encodeURIComponent(key)}`, { value });
    },
    async delete(key) {
      await http.deleteRequest(`/api/bot-storage/${encodeURIComponent(key)}`);
    },
    async list() {
      return http.getJSON(`/api/bot-storage`);
    },
  };
}
