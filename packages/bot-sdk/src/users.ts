import { HttpClient } from './http';
import { UserData } from './types';

export function createUserClient(http: HttpClient) {
  return {
    async get(userId: string): Promise<UserData> {
      return http.getJSON<UserData>(`/api/users/${userId}`);
    },

    async search(query: string): Promise<UserData[]> {
      const data = await http.getJSON<{ users: UserData[] }>(
        `/api/users?search=${encodeURIComponent(query)}`
      );
      return data.users || [];
    },
  };
}

export type UserClient = ReturnType<typeof createUserClient>;
