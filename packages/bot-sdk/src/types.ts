export interface ManuscriptData {
  id: string;
  title: string;
  abstract: string | null;
  status: string;
  authors: Array<{
    id: string;
    name: string | null;
    email: string;
    isCorresponding?: boolean;
  }>;
  keywords: string[];
  workflowPhase: string | null;
  workflowRound: number;
  submittedAt?: string;
  publishedAt?: string;
  doi?: string;
  volume?: string;
  issue?: string;
  elocationId?: string;
  action_editors?: {
    users_action_editors_editorIdTousers?: {
      id: string;
      name: string | null;
    };
  };
  reviewAssignments?: ReviewerAssignment[];
  [key: string]: unknown;
}

export interface FileData {
  id: string;
  originalName: string;
  filename: string;
  fileType: string;
  mimetype: string;
  size: number;
  downloadUrl: string;
  detectedFormat?: string;
}

export interface UserData {
  id: string;
  name: string | null;
  email: string;
  username?: string;
  role: string;
  bio?: string | null;
  affiliation?: string | null;
}

export interface ReviewerAssignment {
  id: string;
  manuscriptId: string;
  reviewerId: string;
  status: string;
  assignedAt: string;
  dueDate: string | null;
  responseToken?: string;
  users?: {
    id: string;
    name: string | null;
    username?: string;
    email: string;
  };
}
