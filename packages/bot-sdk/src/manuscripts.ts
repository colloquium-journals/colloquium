import { HttpClient } from './http';
import { ManuscriptData } from './types';

export interface WorkflowState {
  phase: string | null;
  round: number;
  status: string;
  releasedAt: string | null;
  reviewAssignments: Array<{
    reviewerId: string;
    status: string;
    dueDate: string | null;
    assignedAt: string;
  }>;
  actionEditor: { editorId: string; assignedAt: string } | null;
}

export interface MetadataUpdate {
  title?: string;
  abstract?: string;
  keywords?: string[];
  subjects?: string[];
}

export function createManuscriptClient(http: HttpClient, manuscriptId: string) {
  return {
    async get(): Promise<ManuscriptData> {
      return http.getJSON<ManuscriptData>(`/api/articles/${manuscriptId}`);
    },

    async getWorkflow(): Promise<WorkflowState> {
      return http.getJSON<WorkflowState>(`/api/articles/${manuscriptId}/workflow`);
    },

    async updateMetadata(data: MetadataUpdate): Promise<ManuscriptData> {
      return http.patchJSON<ManuscriptData>(`/api/articles/${manuscriptId}/metadata`, data);
    },
  };
}

export type ManuscriptClient = ReturnType<typeof createManuscriptClient>;
