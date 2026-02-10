import { z } from 'zod';

export enum ManuscriptStatus {
  SUBMITTED = 'SUBMITTED',
  UNDER_REVIEW = 'UNDER_REVIEW',
  REVISION_REQUESTED = 'REVISION_REQUESTED',
  REVISED = 'REVISED',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  PUBLISHED = 'PUBLISHED',
  RETRACTED = 'RETRACTED'
}

export enum ReviewStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  DECLINED = 'DECLINED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED'
}

export enum ParticipantRole {
  OBSERVER = 'OBSERVER',
  PARTICIPANT = 'PARTICIPANT',
  MODERATOR = 'MODERATOR'
}

export enum ConversationType {
  EDITORIAL = 'EDITORIAL',
  REVIEW = 'REVIEW',
  SEMI_PUBLIC = 'SEMI_PUBLIC',
  PUBLIC = 'PUBLIC',
  AUTHOR_ONLY = 'AUTHOR_ONLY'
}

export enum PrivacyLevel {
  PRIVATE = 'PRIVATE',
  SEMI_PUBLIC = 'SEMI_PUBLIC',
  PUBLIC = 'PUBLIC'
}

export enum WorkflowPhase {
  REVIEW = 'REVIEW',
  DELIBERATION = 'DELIBERATION',
  RELEASED = 'RELEASED',
  AUTHOR_RESPONDING = 'AUTHOR_RESPONDING',
}

export const WorkflowConfigSchema = z.object({
  author: z.object({
    seesReviews: z.enum(['realtime', 'on_release', 'never']),
    seesReviewerIdentity: z.enum(['always', 'never', 'on_release']),
    canParticipate: z.enum(['anytime', 'on_release', 'invited']),
  }),
  reviewers: z.object({
    seeEachOther: z.enum(['realtime', 'after_all_submit', 'never']),
    seeAuthorIdentity: z.enum(['always', 'never']),
    seeAuthorResponses: z.enum(['realtime', 'on_release']),
  }),
  phases: z.object({
    enabled: z.boolean(),
    authorResponseStartsNewCycle: z.boolean(),
    requireAllReviewsBeforeRelease: z.boolean(),
  }),
});

export type WorkflowConfig = z.infer<typeof WorkflowConfigSchema>;

// API Response types
export interface ApiResponse<T = any> {
  data?: T;
  error?: {
    message: string;
    details?: any;
    type: string;
  };
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
  };
}

// Auth types
export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  role: string;
}

export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

// API request validation schemas
export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  redirectUrl: z.string().url().optional()
});

export const manuscriptSubmissionSchema = z.object({
  title: z.string().min(1, 'Title is required').max(500, 'Title too long'),
  abstract: z.string().min(1, 'Abstract is required').max(5000, 'Abstract too long'),
  content: z.string().min(1, 'Content is required'),
  authors: z.array(z.object({
    userId: z.string().optional(),
    email: z.string().email().optional(),
    name: z.string().min(1, 'Author name is required'),
    isCorresponding: z.boolean().default(false)
  })).min(1, 'At least one author is required')
});

export const conversationSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
  type: z.nativeEnum(ConversationType),
  privacy: z.nativeEnum(PrivacyLevel),
  participants: z.array(z.string()).optional()
});

export const messageSchema = z.object({
  content: z.string().min(1, 'Message content is required').max(10000, 'Message too long'),
  parentId: z.string().optional(),
  metadata: z.record(z.any()).optional()
});

export const userUpdateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long').optional(),
  bio: z.string().max(1000, 'Bio too long').optional(),
  affiliation: z.string().max(200, 'Affiliation too long').optional(),
  website: z.string().url('Invalid website URL').optional()
});

export const journalSettingsSchema = z.object({
  name: z.string().min(1, 'Journal name is required').max(200, 'Name too long'),
  description: z.string().max(1000, 'Description too long').optional(),
  logoUrl: z.string().url('Invalid logo URL').optional(),
  settings: z.object({
    allowPublicSubmissions: z.boolean().default(true),
    requireOrcid: z.boolean().default(false),
    enableBots: z.boolean().default(true),
    reviewDeadlineDays: z.number().int().min(1).max(365).default(30),
    revisionDeadlineDays: z.number().int().min(1).max(365).default(60)
  }).optional()
});

export const botConfigSchema = z.object({
  config: z.record(z.any()),
  isEnabled: z.boolean().optional()
});

// Bot framework types
export interface BotContext {
  conversationId: string;
  manuscriptId: string;
  triggeredBy: {
    messageId: string;
    userId: string;
    userRole: string;
    trigger: BotTrigger;
  };
  journal: {
    id: string;
    settings: Record<string, any>;
  };
  config: Record<string, any>;
  serviceToken?: string; // Bot service token for API authentication

  // Pre-fetched manuscript data (avoids extra API round-trips in bots)
  manuscript?: {
    title: string;
    abstract: string | null;
    authors: string[];
    status: string;
    keywords: string[];
    workflowPhase: string | null;
    workflowRound: number;
  };
  // Pre-fetched file list
  files?: Array<{
    id: string;
    originalName: string;
    filename: string;
    fileType: string;
    mimetype: string;
    size: number;
  }>;
}

export interface BotResponse {
  botId?: string;
  messages?: {
    content: string;
    replyTo?: string;
    attachments?: BotAttachment[];
    actions?: BotMessageAction[];
  }[];
  actions?: BotAction[];
  errors?: string[];
}

export interface BotAttachment {
  type: 'file' | 'report' | 'analysis';
  filename: string;
  data: any;
  mimetype?: string;
}

export interface BotAction {
  type: 'UPDATE_MANUSCRIPT_STATUS' | 'ASSIGN_REVIEWER' | 'CREATE_CONVERSATION' | 'RESPOND_TO_REVIEW' | 'SUBMIT_REVIEW' | 'MAKE_EDITORIAL_DECISION' | 'ASSIGN_ACTION_EDITOR' | 'EXECUTE_PUBLICATION_WORKFLOW' | 'UPDATE_WORKFLOW_PHASE' | 'SEND_MANUAL_REMINDER';
  data: Record<string, any>;
}

export interface BotMessageAction {
  id: string;
  label: string;
  style?: 'primary' | 'secondary' | 'danger';
  confirmText?: string;
  targetUserId?: string;
  targetRoles?: string[];
  handler: {
    botId: string;
    action: string;
    params: Record<string, any>;
  };
  resultContent?: string;
  resultLabel?: string;
  triggered?: boolean;
  triggeredBy?: string;
  triggeredAt?: string;
}

export interface BotActionHandlerResult {
  success: boolean;
  updatedContent?: string;
  updatedLabel?: string;
  error?: string;
}

export type BotActionHandler = (
  params: Record<string, any>,
  context: BotActionHandlerContext
) => Promise<BotActionHandlerResult>;

export interface BotActionHandlerContext {
  manuscriptId: string;
  conversationId: string;
  messageId: string;
  triggeredBy: { userId: string; userRole: string };
  serviceToken: string;
}

export enum BotTrigger {
  MENTION = 'mention',
  KEYWORD = 'keyword',
  MANUSCRIPT_SUBMITTED = 'manuscript_submitted',
  REVIEW_COMPLETE = 'review_complete',
  SCHEDULED = 'scheduled',
}

export enum BotEventName {
  MANUSCRIPT_SUBMITTED = 'manuscript.submitted',
  MANUSCRIPT_STATUS_CHANGED = 'manuscript.statusChanged',
  FILE_UPLOADED = 'file.uploaded',
  REVIEWER_ASSIGNED = 'reviewer.assigned',
  REVIEWER_STATUS_CHANGED = 'reviewer.statusChanged',
  WORKFLOW_PHASE_CHANGED = 'workflow.phaseChanged',
  DECISION_RELEASED = 'decision.released',
}

export interface BotEventPayload {
  [BotEventName.MANUSCRIPT_SUBMITTED]: { manuscriptId: string };
  [BotEventName.MANUSCRIPT_STATUS_CHANGED]: { previousStatus: string; newStatus: string };
  [BotEventName.FILE_UPLOADED]: { file: { id: string; name: string; type: string; mimetype: string } };
  [BotEventName.REVIEWER_ASSIGNED]: { reviewerId: string; dueDate: string | null; status: string };
  [BotEventName.REVIEWER_STATUS_CHANGED]: { reviewerId: string; previousStatus: string; newStatus: string };
  [BotEventName.WORKFLOW_PHASE_CHANGED]: { previousPhase: string | null; newPhase: string; round: number };
  [BotEventName.DECISION_RELEASED]: { decision: string; round: number };
}

export type BotEventHandler<E extends BotEventName> = (
  context: BotContext,
  payload: BotEventPayload[E]
) => Promise<BotResponse | void>;

export enum BotPermission {
  READ_MANUSCRIPT = 'read_manuscript',
  READ_FILES = 'read_files',
  READ_CONVERSATIONS = 'read_conversations',
  WRITE_MESSAGES = 'write_messages',
  UPDATE_MANUSCRIPT = 'update_manuscript',
  ASSIGN_REVIEWERS = 'assign_reviewers',
  MAKE_EDITORIAL_DECISION = 'make_editorial_decision',
}

export enum BotApiPermission {
  READ_MANUSCRIPT = 'read_manuscript',
  READ_FILES = 'read_manuscript_files',
  UPLOAD_FILES = 'upload_files',
  READ_CONVERSATIONS = 'read_conversations',
  WRITE_MESSAGES = 'write_messages',
  UPDATE_METADATA = 'update_metadata',
  MANAGE_REVIEWERS = 'manage_reviewers',
  MANAGE_WORKFLOW = 'manage_workflow',
  BOT_STORAGE = 'bot_storage',
  INVOKE_BOTS = 'invoke_bots',
}

export const PipelineStepSchema = z.object({
  bot: z.string(),
  command: z.string(),
  parameters: z.record(z.any()).optional(),
});

export const PipelineConfigSchema = z.object({
  pipelines: z.record(z.string(), z.array(PipelineStepSchema)).optional(),
});

export type PipelineStep = z.infer<typeof PipelineStepSchema>;
export type PipelineConfig = z.infer<typeof PipelineConfigSchema>;

export interface Bot {
  id: string;
  name: string;
  description: string;
  version: string;
  triggers: BotTrigger[];
  permissions: BotPermission[];
  supportsFileUploads?: boolean;
  execute: (context: BotContext) => Promise<BotResponse>;
}

// Command framework types
export interface BotCommandParameter {
  name: string;
  description: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'enum';
  required: boolean;
  defaultValue?: any;
  enumValues?: string[];
  validation?: z.ZodSchema;
  examples?: string[];
}

export interface BotCommand {
  name: string;
  description: string;
  usage: string;
  parameters: BotCommandParameter[];
  examples: string[];
  permissions: string[];
  help?: string; // Optional detailed help content for this specific command
  execute: (params: Record<string, any>, context: any) => Promise<any>;
}

export interface BotCustomHelpSection {
  title: string;
  content: string;
  position: 'before' | 'after';
}

// Bot installation context for hooks
export interface BotInstallationContext {
  botId: string;
  config: Record<string, any>;
  serviceToken?: string;
  uploadFile: (filename: string, content: Buffer, mimetype: string, description?: string) => Promise<{ id: string; downloadUrl: string }>;
}

export interface CommandBot {
  id: string;
  name: string;
  description: string;
  version: string;
  commands: BotCommand[];
  keywords: string[];
  triggers: string[];
  permissions: string[];
  supportsFileUploads?: boolean;
  help: {
    overview: string;
    quickStart: string;
    examples: string[];
  };
  customHelpSections?: BotCustomHelpSection[];
  onInstall?: (context: BotInstallationContext) => Promise<void>;
  actionHandlers?: Record<string, BotActionHandler>;
  events?: {
    [E in BotEventName]?: BotEventHandler<E>;
  };
}

export interface ParsedCommand {
  botId: string;
  command: string;
  parameters: Record<string, any>;
  rawText: string;
  isUnrecognized?: boolean;
}

// Type helpers
export type CreateManuscriptData = z.infer<typeof manuscriptSubmissionSchema>;
export type CreateConversationData = z.infer<typeof conversationSchema>;
export type CreateMessageData = z.infer<typeof messageSchema>;
export type UpdateUserData = z.infer<typeof userUpdateSchema>;
export type UpdateJournalSettingsData = z.infer<typeof journalSettingsSchema>;
export type UpdateBotConfigData = z.infer<typeof botConfigSchema>;
export type LoginData = z.infer<typeof loginSchema>;

// Re-export workflow templates (after WorkflowConfig is defined to avoid circular dependency)
export * from './workflowTemplates';

// Re-export CRediT roles
export * from './creditRoles';

// Re-export JATS types for PMC compliance
export * from './jatsTypes';