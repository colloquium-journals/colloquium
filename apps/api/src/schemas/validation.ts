import { z } from 'zod';

// Common validation schemas
export const IdSchema = z.string().uuid('Invalid ID format');
export const EmailSchema = z.string().email('Invalid email format');
export const PaginationSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20)
});

// User-related schemas
export const UserCreateSchema = z.object({
  email: EmailSchema,
  name: z.string().min(1, 'Name is required'),
  role: z.enum(['ADMIN', 'EDITOR', 'REVIEWER', 'AUTHOR']).default('AUTHOR'),
  orcidId: z.string().optional()
});

export const UserUpdateSchema = z.object({
  name: z.string().min(1, 'Name is required').optional(),
  bio: z.string().optional(),
  affiliations: z.array(z.string()).optional()
});

// Conversation-related schemas
export const ConversationCreateSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  type: z.enum(['PRIVATE_EDIT', 'PRIVATE_REVIEW', 'SEMI_PUBLIC', 'PUBLIC_REVIEW']),
  manuscriptId: IdSchema.optional(),
  participantIds: z.array(IdSchema).default([]),
  description: z.string().optional()
});

export const ConversationUpdateSchema = z.object({
  title: z.string().min(1, 'Title is required').optional(),
  status: z.enum(['ACTIVE', 'CLOSED', 'ARCHIVED']).optional(),
  description: z.string().optional()
});

// Message-related schemas
export const MessageCreateSchema = z.object({
  content: z.string().min(1, 'Message content is required'),
  conversationId: IdSchema,
  type: z.enum(['TEXT', 'BOT_COMMAND', 'SYSTEM']).default('TEXT'),
  parentId: IdSchema.optional(),
  mentions: z.array(IdSchema).default([]),
  botMentions: z.array(z.string()).default([])
});

export const MessageUpdateSchema = z.object({
  content: z.string().min(1, 'Message content is required')
});

// Manuscript-related schemas
export const ManuscriptCreateSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  abstract: z.string().min(1, 'Abstract is required'),
  authors: z.array(z.object({
    name: z.string().min(1, 'Author name is required'),
    email: EmailSchema,
    affiliation: z.string().optional(),
    orcidId: z.string().optional()
  })).min(1, 'At least one author is required'),
  keywords: z.array(z.string()).default([]),
  manuscriptType: z.enum(['RESEARCH_ARTICLE', 'REVIEW', 'SHORT_COMMUNICATION', 'OPINION']).default('RESEARCH_ARTICLE'),
  conflictOfInterest: z.string().optional(),
  funding: z.string().optional(),
  ethicsStatement: z.string().optional()
});

export const ManuscriptUpdateSchema = z.object({
  title: z.string().min(1, 'Title is required').optional(),
  abstract: z.string().min(1, 'Abstract is required').optional(),
  authors: z.array(z.object({
    name: z.string().min(1, 'Author name is required'),
    email: EmailSchema,
    affiliation: z.string().optional(),
    orcidId: z.string().optional()
  })).min(1, 'At least one author is required').optional(),
  keywords: z.array(z.string()).optional(),
  manuscriptType: z.enum(['RESEARCH_ARTICLE', 'REVIEW', 'SHORT_COMMUNICATION', 'OPINION']).optional(),
  status: z.enum(['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'REVISION_REQUESTED', 'ACCEPTED', 'REJECTED', 'PUBLISHED']).optional(),
  conflictOfInterest: z.string().optional(),
  funding: z.string().optional(),
  ethicsStatement: z.string().optional()
});

// Bot-related schemas
export const BotInstallSchema = z.object({
  name: z.string().min(1, 'Bot name is required'),
  version: z.string().min(1, 'Version is required'),
  source: z.string().url('Invalid source URL').or(z.string().min(1, 'Source is required')),
  config: z.record(z.any()).optional()
});

export const BotConfigUpdateSchema = z.object({
  config: z.record(z.any()),
  enabled: z.boolean().optional()
});

// File upload schemas
export const FileUploadSchema = z.object({
  filename: z.string().min(1, 'Filename is required'),
  mimeType: z.string().min(1, 'MIME type is required'),
  size: z.number().min(1, 'File size must be greater than 0')
});

// Query parameter schemas
export const ConversationQuerySchema = z.object({
  ...PaginationSchema.shape,
  type: z.enum(['PRIVATE_EDIT', 'PRIVATE_REVIEW', 'SEMI_PUBLIC', 'PUBLIC_REVIEW']).optional(),
  status: z.enum(['ACTIVE', 'CLOSED', 'ARCHIVED']).optional(),
  manuscriptId: IdSchema.optional()
});

export const MessageQuerySchema = z.object({
  ...PaginationSchema.shape,
  conversationId: IdSchema,
  since: z.coerce.date().optional(),
  before: z.coerce.date().optional()
});

export const ManuscriptQuerySchema = z.object({
  ...PaginationSchema.shape,
  status: z.enum(['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'REVISION_REQUESTED', 'ACCEPTED', 'REJECTED', 'PUBLISHED']).optional(),
  authorId: IdSchema.optional(),
  manuscriptType: z.enum(['RESEARCH_ARTICLE', 'REVIEW', 'SHORT_COMMUNICATION', 'OPINION']).optional()
});

export const UserQuerySchema = z.object({
  ...PaginationSchema.shape,
  role: z.enum(['ADMIN', 'EDITOR', 'REVIEWER', 'AUTHOR']).optional(),
  search: z.string().optional()
});

// Review assignment schemas
export const ReviewAssignmentCreateSchema = z.object({
  manuscriptId: IdSchema,
  reviewerId: IdSchema,
  dueDate: z.coerce.date().optional(),
  message: z.string().optional()
});

export const ReviewAssignmentUpdateSchema = z.object({
  status: z.enum(['PENDING', 'ACCEPTED', 'DECLINED', 'IN_PROGRESS', 'COMPLETED']).optional(),
  dueDate: z.coerce.date().optional(),
  completedAt: z.coerce.date().optional()
});

export const ReviewerInvitationSchema = z.object({
  manuscriptId: IdSchema,
  reviewerEmails: z.array(EmailSchema).min(1, 'At least one reviewer email is required'),
  dueDate: z.coerce.date().min(new Date(), 'Due date must be in the future'),
  message: z.string().max(1000, 'Message too long').optional(),
  autoAssign: z.boolean().default(false)
});

export const ReviewerSearchSchema = z.object({
  query: z.string().min(1, 'Search query is required'),
  manuscriptId: IdSchema.optional(),
  excludeConflicts: z.boolean().default(true),
  limit: z.coerce.number().min(1).max(50).default(20)
});

export const BulkReviewerAssignmentSchema = z.object({
  manuscriptId: IdSchema,
  assignments: z.array(z.object({
    reviewerId: IdSchema,
    dueDate: z.coerce.date().optional(),
    message: z.string().optional()
  })).min(1, 'At least one assignment is required')
});

export const ReviewDecisionSchema = z.object({
  manuscriptId: IdSchema,
  decision: z.enum(['ACCEPT', 'REJECT', 'REVISION_REQUESTED']),
  comments: z.string().min(1, 'Decision comments are required'),
  publicComments: z.string().optional(),
  attachments: z.array(z.string()).default([])
});

// Review invitation response schemas
export const ReviewInvitationResponseSchema = z.object({
  response: z.enum(['ACCEPT', 'DECLINE']),
  message: z.string().max(500, 'Message too long').optional(),
  availableUntil: z.coerce.date().optional()
});

export const ReviewSubmissionSchema = z.object({
  reviewContent: z.string().min(10, 'Review must be at least 10 characters'),
  recommendation: z.enum(['ACCEPT', 'MINOR_REVISION', 'MAJOR_REVISION', 'REJECT']),
  confidentialComments: z.string().optional(),
  score: z.number().min(1).max(10).optional(),
  attachments: z.array(z.string()).default([])
});