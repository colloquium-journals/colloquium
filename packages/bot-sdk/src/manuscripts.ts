import { HttpClient } from './http';
import { ManuscriptData } from './types';

export function createManuscriptClient(http: HttpClient, manuscriptId: string) {
  return {
    async get(): Promise<ManuscriptData> {
      return http.getJSON<ManuscriptData>(`/api/articles/${manuscriptId}`);
    },
  };
}

export type ManuscriptClient = ReturnType<typeof createManuscriptClient>;
