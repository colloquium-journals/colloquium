"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BotPermission = exports.BotTrigger = exports.botConfigSchema = exports.journalSettingsSchema = exports.userUpdateSchema = exports.messageSchema = exports.conversationSchema = exports.manuscriptSubmissionSchema = exports.loginSchema = exports.WorkflowConfigSchema = exports.WorkflowPhase = exports.PrivacyLevel = exports.ConversationType = exports.ParticipantRole = exports.ReviewStatus = exports.ManuscriptStatus = void 0;
const zod_1 = require("zod");
var ManuscriptStatus;
(function (ManuscriptStatus) {
    ManuscriptStatus["SUBMITTED"] = "SUBMITTED";
    ManuscriptStatus["UNDER_REVIEW"] = "UNDER_REVIEW";
    ManuscriptStatus["REVISION_REQUESTED"] = "REVISION_REQUESTED";
    ManuscriptStatus["REVISED"] = "REVISED";
    ManuscriptStatus["ACCEPTED"] = "ACCEPTED";
    ManuscriptStatus["REJECTED"] = "REJECTED";
    ManuscriptStatus["PUBLISHED"] = "PUBLISHED";
    ManuscriptStatus["RETRACTED"] = "RETRACTED";
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
var WorkflowPhase;
(function (WorkflowPhase) {
    WorkflowPhase["REVIEW"] = "REVIEW";
    WorkflowPhase["DELIBERATION"] = "DELIBERATION";
    WorkflowPhase["RELEASED"] = "RELEASED";
    WorkflowPhase["AUTHOR_RESPONDING"] = "AUTHOR_RESPONDING";
})(WorkflowPhase || (exports.WorkflowPhase = WorkflowPhase = {}));
exports.WorkflowConfigSchema = zod_1.z.object({
    author: zod_1.z.object({
        seesReviews: zod_1.z.enum(['realtime', 'on_release', 'never']),
        seesReviewerIdentity: zod_1.z.enum(['always', 'never', 'on_release']),
        canParticipate: zod_1.z.enum(['anytime', 'on_release', 'invited']),
    }),
    reviewers: zod_1.z.object({
        seeEachOther: zod_1.z.enum(['realtime', 'after_all_submit', 'never']),
        seeAuthorIdentity: zod_1.z.enum(['always', 'never']),
        seeAuthorResponses: zod_1.z.enum(['realtime', 'on_release']),
    }),
    phases: zod_1.z.object({
        enabled: zod_1.z.boolean(),
        authorResponseStartsNewCycle: zod_1.z.boolean(),
        requireAllReviewsBeforeRelease: zod_1.z.boolean(),
    }),
});
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
// Re-export workflow templates (after WorkflowConfig is defined to avoid circular dependency)
__exportStar(require("./workflowTemplates"), exports);
// Re-export CRediT roles
__exportStar(require("./creditRoles"), exports);
// Re-export JATS types for PMC compliance
__exportStar(require("./jatsTypes"), exports);
//# sourceMappingURL=index.js.map