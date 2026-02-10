import { HttpClient } from './http';
import { ReviewerAssignment } from './types';

export function createReviewerClient(http: HttpClient, manuscriptId: string) {
  return {
    async list(): Promise<ReviewerAssignment[]> {
      const data = await http.getJSON<{ assignments: ReviewerAssignment[] }>(
        `/api/reviewers/assignments/${manuscriptId}`
      );
      return data.assignments || [];
    },

    async assign(
      reviewerId: string,
      options?: { status?: string; dueDate?: string }
    ): Promise<{ assignment: ReviewerAssignment }> {
      return http.postJSON<{ assignment: ReviewerAssignment }>(
        `/api/articles/${manuscriptId}/reviewers`,
        { reviewerId, ...options }
      );
    },
  };
}

export type ReviewerClient = ReturnType<typeof createReviewerClient>;
