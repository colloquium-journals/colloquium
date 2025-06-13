import { z } from 'zod';
// Enum definitions that match the Prisma schema
export var UserRole;
(function (UserRole) {
    UserRole["AUTHOR"] = "AUTHOR";
    UserRole["REVIEWER"] = "REVIEWER";
    UserRole["EDITOR"] = "EDITOR";
    UserRole["ADMIN"] = "ADMIN";
})(UserRole || (UserRole = {}));
export var ConversationType;
(function (ConversationType) {
    ConversationType["EDITORIAL"] = "EDITORIAL";
    ConversationType["REVIEW"] = "REVIEW";
    ConversationType["SEMI_PUBLIC"] = "SEMI_PUBLIC";
    ConversationType["PUBLIC"] = "PUBLIC";
    ConversationType["AUTHOR_ONLY"] = "AUTHOR_ONLY";
})(ConversationType || (ConversationType = {}));
export var PrivacyLevel;
(function (PrivacyLevel) {
    PrivacyLevel["PRIVATE"] = "PRIVATE";
    PrivacyLevel["SEMI_PUBLIC"] = "SEMI_PUBLIC";
    PrivacyLevel["PUBLIC"] = "PUBLIC";
})(PrivacyLevel || (PrivacyLevel = {}));
export var ManuscriptStatus;
(function (ManuscriptStatus) {
    ManuscriptStatus["SUBMITTED"] = "SUBMITTED";
    ManuscriptStatus["UNDER_REVIEW"] = "UNDER_REVIEW";
    ManuscriptStatus["REVISION_REQUESTED"] = "REVISION_REQUESTED";
    ManuscriptStatus["REVISED"] = "REVISED";
    ManuscriptStatus["ACCEPTED"] = "ACCEPTED";
    ManuscriptStatus["REJECTED"] = "REJECTED";
    ManuscriptStatus["PUBLISHED"] = "PUBLISHED";
})(ManuscriptStatus || (ManuscriptStatus = {}));
export var ReviewStatus;
(function (ReviewStatus) {
    ReviewStatus["PENDING"] = "PENDING";
    ReviewStatus["ACCEPTED"] = "ACCEPTED";
    ReviewStatus["DECLINED"] = "DECLINED";
    ReviewStatus["IN_PROGRESS"] = "IN_PROGRESS";
    ReviewStatus["COMPLETED"] = "COMPLETED";
})(ReviewStatus || (ReviewStatus = {}));
export var ParticipantRole;
(function (ParticipantRole) {
    ParticipantRole["OBSERVER"] = "OBSERVER";
    ParticipantRole["PARTICIPANT"] = "PARTICIPANT";
    ParticipantRole["MODERATOR"] = "MODERATOR";
})(ParticipantRole || (ParticipantRole = {}));
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
    type: z.enum(['EDITORIAL', 'REVIEW', 'SEMI_PUBLIC', 'PUBLIC', 'AUTHOR_ONLY']),
    privacy: z.enum(['PRIVATE', 'SEMI_PUBLIC', 'PUBLIC']),
    participants: z.array(z.string()).optional()
});
export const messageSchema = z.object({
    content: z.string().min(1, 'Message content is required').max(10000, 'Message too long'),
    parentId: z.string().optional(),
    metadata: z.record(z.any()).optional()
});
export const userUpdateSchema = z.object({
    name: z.string().min(1, 'Name is required').max(100, 'Name too long').optional(),
    orcidId: z.string().regex(/^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/, 'Invalid ORCID format').optional()
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
export var BotTrigger;
(function (BotTrigger) {
    BotTrigger["MENTION"] = "mention";
    BotTrigger["KEYWORD"] = "keyword";
    BotTrigger["MANUSCRIPT_SUBMITTED"] = "manuscript_submitted";
    BotTrigger["REVIEW_COMPLETE"] = "review_complete";
    BotTrigger["SCHEDULED"] = "scheduled";
})(BotTrigger || (BotTrigger = {}));
export var BotPermission;
(function (BotPermission) {
    BotPermission["READ_MANUSCRIPT"] = "read_manuscript";
    BotPermission["READ_FILES"] = "read_files";
    BotPermission["READ_CONVERSATIONS"] = "read_conversations";
    BotPermission["WRITE_MESSAGES"] = "write_messages";
    BotPermission["UPDATE_MANUSCRIPT"] = "update_manuscript";
    BotPermission["ASSIGN_REVIEWERS"] = "assign_reviewers";
})(BotPermission || (BotPermission = {}));
//# sourceMappingURL=index.js.map