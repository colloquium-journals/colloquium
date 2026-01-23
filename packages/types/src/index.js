"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BotPermission = exports.BotTrigger = exports.botConfigSchema = exports.journalSettingsSchema = exports.userUpdateSchema = exports.messageSchema = exports.conversationSchema = exports.manuscriptSubmissionSchema = exports.loginSchema = exports.PrivacyLevel = exports.ConversationType = exports.ParticipantRole = exports.ReviewStatus = exports.ManuscriptStatus = exports.UserRole = void 0;
const zod_1 = require("zod");
// Enum definitions that match the Prisma schema
var UserRole;
(function (UserRole) {
    UserRole["AUTHOR"] = "AUTHOR";
    UserRole["REVIEWER"] = "REVIEWER";
    UserRole["EDITOR"] = "EDITOR";
    UserRole["ADMIN"] = "ADMIN";
})(UserRole || (exports.UserRole = UserRole = {}));
var ManuscriptStatus;
(function (ManuscriptStatus) {
    ManuscriptStatus["SUBMITTED"] = "SUBMITTED";
    ManuscriptStatus["UNDER_REVIEW"] = "UNDER_REVIEW";
    ManuscriptStatus["REVISION_REQUESTED"] = "REVISION_REQUESTED";
    ManuscriptStatus["REVISED"] = "REVISED";
    ManuscriptStatus["ACCEPTED"] = "ACCEPTED";
    ManuscriptStatus["REJECTED"] = "REJECTED";
    ManuscriptStatus["PUBLISHED"] = "PUBLISHED";
})(ManuscriptStatus || (exports.ManuscriptStatus = ManuscriptStatus = {}));
var ReviewStatus;
(function (ReviewStatus) {
    ReviewStatus["PENDING"] = "PENDING";
    ReviewStatus["ACCEPTED"] = "ACCEPTED";
    ReviewStatus["DECLINED"] = "DECLINED";
    ReviewStatus["IN_PROGRESS"] = "IN_PROGRESS";
    ReviewStatus["COMPLETED"] = "COMPLETED";
})(ReviewStatus || (exports.ReviewStatus = ReviewStatus = {}));
var ParticipantRole;
(function (ParticipantRole) {
    ParticipantRole["OBSERVER"] = "OBSERVER";
    ParticipantRole["PARTICIPANT"] = "PARTICIPANT";
    ParticipantRole["MODERATOR"] = "MODERATOR";
})(ParticipantRole || (exports.ParticipantRole = ParticipantRole = {}));
var ConversationType;
(function (ConversationType) {
    ConversationType["EDITORIAL"] = "EDITORIAL";
    ConversationType["REVIEW"] = "REVIEW";
    ConversationType["SEMI_PUBLIC"] = "SEMI_PUBLIC";
    ConversationType["PUBLIC"] = "PUBLIC";
    ConversationType["AUTHOR_ONLY"] = "AUTHOR_ONLY";
})(ConversationType || (exports.ConversationType = ConversationType = {}));
var PrivacyLevel;
(function (PrivacyLevel) {
    PrivacyLevel["PRIVATE"] = "PRIVATE";
    PrivacyLevel["SEMI_PUBLIC"] = "SEMI_PUBLIC";
    PrivacyLevel["PUBLIC"] = "PUBLIC";
})(PrivacyLevel || (exports.PrivacyLevel = PrivacyLevel = {}));
// API request validation schemas
exports.loginSchema = zod_1.z.object({
    email: zod_1.z.string().email('Invalid email address'),
    redirectUrl: zod_1.z.string().url().optional()
});
exports.manuscriptSubmissionSchema = zod_1.z.object({
    title: zod_1.z.string().min(1, 'Title is required').max(500, 'Title too long'),
    abstract: zod_1.z.string().min(1, 'Abstract is required').max(5000, 'Abstract too long'),
    content: zod_1.z.string().min(1, 'Content is required'),
    authors: zod_1.z.array(zod_1.z.object({
        userId: zod_1.z.string().optional(),
        email: zod_1.z.string().email().optional(),
        name: zod_1.z.string().min(1, 'Author name is required'),
        isCorresponding: zod_1.z.boolean().default(false)
    })).min(1, 'At least one author is required')
});
exports.conversationSchema = zod_1.z.object({
    title: zod_1.z.string().min(1, 'Title is required').max(200, 'Title too long'),
    type: zod_1.z.nativeEnum(ConversationType),
    privacy: zod_1.z.nativeEnum(PrivacyLevel),
    participants: zod_1.z.array(zod_1.z.string()).optional()
});
exports.messageSchema = zod_1.z.object({
    content: zod_1.z.string().min(1, 'Message content is required').max(10000, 'Message too long'),
    parentId: zod_1.z.string().optional(),
    metadata: zod_1.z.record(zod_1.z.any()).optional()
});
exports.userUpdateSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Name is required').max(100, 'Name too long').optional(),
    orcidId: zod_1.z.string().regex(/^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/, 'Invalid ORCID format').optional(),
    bio: zod_1.z.string().max(1000, 'Bio too long').optional(),
    affiliation: zod_1.z.string().max(200, 'Affiliation too long').optional(),
    website: zod_1.z.string().url('Invalid website URL').optional()
});
exports.journalSettingsSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Journal name is required').max(200, 'Name too long'),
    description: zod_1.z.string().max(1000, 'Description too long').optional(),
    logoUrl: zod_1.z.string().url('Invalid logo URL').optional(),
    settings: zod_1.z.object({
        allowPublicSubmissions: zod_1.z.boolean().default(true),
        requireOrcid: zod_1.z.boolean().default(false),
        enableBots: zod_1.z.boolean().default(true),
        reviewDeadlineDays: zod_1.z.number().int().min(1).max(365).default(30),
        revisionDeadlineDays: zod_1.z.number().int().min(1).max(365).default(60)
    }).optional()
});
exports.botConfigSchema = zod_1.z.object({
    config: zod_1.z.record(zod_1.z.any()),
    isEnabled: zod_1.z.boolean().optional()
});
var BotTrigger;
(function (BotTrigger) {
    BotTrigger["MENTION"] = "mention";
    BotTrigger["KEYWORD"] = "keyword";
    BotTrigger["MANUSCRIPT_SUBMITTED"] = "manuscript_submitted";
    BotTrigger["REVIEW_COMPLETE"] = "review_complete";
    BotTrigger["SCHEDULED"] = "scheduled";
})(BotTrigger || (exports.BotTrigger = BotTrigger = {}));
var BotPermission;
(function (BotPermission) {
    BotPermission["READ_MANUSCRIPT"] = "read_manuscript";
    BotPermission["READ_FILES"] = "read_files";
    BotPermission["READ_CONVERSATIONS"] = "read_conversations";
    BotPermission["WRITE_MESSAGES"] = "write_messages";
    BotPermission["UPDATE_MANUSCRIPT"] = "update_manuscript";
    BotPermission["ASSIGN_REVIEWERS"] = "assign_reviewers";
    BotPermission["MAKE_EDITORIAL_DECISION"] = "make_editorial_decision";
})(BotPermission || (exports.BotPermission = BotPermission = {}));
