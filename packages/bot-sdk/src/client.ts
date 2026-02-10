import { createHttpClient } from './http';
import { createManuscriptClient, ManuscriptClient } from './manuscripts';
import { createFileClient, FileClient } from './files';
import { createUserClient, UserClient } from './users';
import { createReviewerClient, ReviewerClient } from './reviewers';

export interface BotClientContext {
  manuscriptId: string;
  serviceToken?: string;
  config?: Record<string, unknown>;
}

export interface BotClient {
  manuscripts: ManuscriptClient;
  files: FileClient;
  users: UserClient;
  reviewers: ReviewerClient;
  apiUrl: string;
}

export function createBotClient(context: BotClientContext): BotClient {
  const apiUrl =
    (context.config?.apiUrl as string) ||
    process.env.API_URL ||
    'http://localhost:4000';

  const serviceToken = context.serviceToken || '';

  const http = createHttpClient(apiUrl, serviceToken);

  return {
    manuscripts: createManuscriptClient(http, context.manuscriptId),
    files: createFileClient(http, context.manuscriptId),
    users: createUserClient(http),
    reviewers: createReviewerClient(http, context.manuscriptId),
    apiUrl,
  };
}
