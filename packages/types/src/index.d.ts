import { z } from 'zod';
export declare enum ManuscriptStatus {
    SUBMITTED = "SUBMITTED",
    UNDER_REVIEW = "UNDER_REVIEW",
    REVISION_REQUESTED = "REVISION_REQUESTED",
    REVISED = "REVISED",
    ACCEPTED = "ACCEPTED",
    REJECTED = "REJECTED",
    PUBLISHED = "PUBLISHED",
    RETRACTED = "RETRACTED"
}
export declare enum ReviewStatus {
    PENDING = "PENDING",
    ACCEPTED = "ACCEPTED",
    DECLINED = "DECLINED",
    IN_PROGRESS = "IN_PROGRESS",
    COMPLETED = "COMPLETED"
}
export declare enum ParticipantRole {
    OBSERVER = "OBSERVER",
    PARTICIPANT = "PARTICIPANT",
    MODERATOR = "MODERATOR"
}
export declare enum ConversationType {
    EDITORIAL = "EDITORIAL",
    REVIEW = "REVIEW",
    SEMI_PUBLIC = "SEMI_PUBLIC",
    PUBLIC = "PUBLIC",
    AUTHOR_ONLY = "AUTHOR_ONLY"
}
export declare enum PrivacyLevel {
    PRIVATE = "PRIVATE",
    SEMI_PUBLIC = "SEMI_PUBLIC",
    PUBLIC = "PUBLIC"
}
export declare enum WorkflowPhase {
    REVIEW = "REVIEW",
    DELIBERATION = "DELIBERATION",
    RELEASED = "RELEASED",
    AUTHOR_RESPONDING = "AUTHOR_RESPONDING"
}
export declare const WorkflowConfigSchema: z.ZodObject<{
    author: z.ZodObject<{
        seesReviews: z.ZodEnum<["realtime", "on_release", "never"]>;
        seesReviewerIdentity: z.ZodEnum<["always", "never", "on_release"]>;
        canParticipate: z.ZodEnum<["anytime", "on_release", "invited"]>;
    }, "strip", z.ZodTypeAny, {
        seesReviews: "never" | "realtime" | "on_release";
        seesReviewerIdentity: "never" | "on_release" | "always";
        canParticipate: "on_release" | "anytime" | "invited";
    }, {
        seesReviews: "never" | "realtime" | "on_release";
        seesReviewerIdentity: "never" | "on_release" | "always";
        canParticipate: "on_release" | "anytime" | "invited";
    }>;
    reviewers: z.ZodObject<{
        seeEachOther: z.ZodEnum<["realtime", "after_all_submit", "never"]>;
        seeAuthorIdentity: z.ZodEnum<["always", "never"]>;
        seeAuthorResponses: z.ZodEnum<["realtime", "on_release"]>;
    }, "strip", z.ZodTypeAny, {
        seeEachOther: "never" | "realtime" | "after_all_submit";
        seeAuthorIdentity: "never" | "always";
        seeAuthorResponses: "realtime" | "on_release";
    }, {
        seeEachOther: "never" | "realtime" | "after_all_submit";
        seeAuthorIdentity: "never" | "always";
        seeAuthorResponses: "realtime" | "on_release";
    }>;
    phases: z.ZodObject<{
        enabled: z.ZodBoolean;
        authorResponseStartsNewCycle: z.ZodBoolean;
        requireAllReviewsBeforeRelease: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        enabled: boolean;
        authorResponseStartsNewCycle: boolean;
        requireAllReviewsBeforeRelease: boolean;
    }, {
        enabled: boolean;
        authorResponseStartsNewCycle: boolean;
        requireAllReviewsBeforeRelease: boolean;
    }>;
}, "strip", z.ZodTypeAny, {
    author: {
        seesReviews: "never" | "realtime" | "on_release";
        seesReviewerIdentity: "never" | "on_release" | "always";
        canParticipate: "on_release" | "anytime" | "invited";
    };
    reviewers: {
        seeEachOther: "never" | "realtime" | "after_all_submit";
        seeAuthorIdentity: "never" | "always";
        seeAuthorResponses: "realtime" | "on_release";
    };
    phases: {
        enabled: boolean;
        authorResponseStartsNewCycle: boolean;
        requireAllReviewsBeforeRelease: boolean;
    };
}, {
    author: {
        seesReviews: "never" | "realtime" | "on_release";
        seesReviewerIdentity: "never" | "on_release" | "always";
        canParticipate: "on_release" | "anytime" | "invited";
    };
    reviewers: {
        seeEachOther: "never" | "realtime" | "after_all_submit";
        seeAuthorIdentity: "never" | "always";
        seeAuthorResponses: "realtime" | "on_release";
    };
    phases: {
        enabled: boolean;
        authorResponseStartsNewCycle: boolean;
        requireAllReviewsBeforeRelease: boolean;
    };
}>;
export type WorkflowConfig = z.infer<typeof WorkflowConfigSchema>;
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
export declare const loginSchema: z.ZodObject<{
    email: z.ZodString;
    redirectUrl: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    email: string;
    redirectUrl?: string | undefined;
}, {
    email: string;
    redirectUrl?: string | undefined;
}>;
export declare const manuscriptSubmissionSchema: z.ZodObject<{
    title: z.ZodString;
    abstract: z.ZodString;
    content: z.ZodString;
    authors: z.ZodArray<z.ZodObject<{
        userId: z.ZodOptional<z.ZodString>;
        email: z.ZodOptional<z.ZodString>;
        name: z.ZodString;
        isCorresponding: z.ZodDefault<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        isCorresponding: boolean;
        email?: string | undefined;
        userId?: string | undefined;
    }, {
        name: string;
        email?: string | undefined;
        userId?: string | undefined;
        isCorresponding?: boolean | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    title: string;
    abstract: string;
    content: string;
    authors: {
        name: string;
        isCorresponding: boolean;
        email?: string | undefined;
        userId?: string | undefined;
    }[];
}, {
    title: string;
    abstract: string;
    content: string;
    authors: {
        name: string;
        email?: string | undefined;
        userId?: string | undefined;
        isCorresponding?: boolean | undefined;
    }[];
}>;
export declare const conversationSchema: z.ZodObject<{
    title: z.ZodString;
    type: z.ZodNativeEnum<typeof ConversationType>;
    privacy: z.ZodNativeEnum<typeof PrivacyLevel>;
    participants: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    type: ConversationType;
    title: string;
    privacy: PrivacyLevel;
    participants?: string[] | undefined;
}, {
    type: ConversationType;
    title: string;
    privacy: PrivacyLevel;
    participants?: string[] | undefined;
}>;
export declare const messageSchema: z.ZodObject<{
    content: z.ZodString;
    parentId: z.ZodOptional<z.ZodString>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
}, "strip", z.ZodTypeAny, {
    content: string;
    parentId?: string | undefined;
    metadata?: Record<string, any> | undefined;
}, {
    content: string;
    parentId?: string | undefined;
    metadata?: Record<string, any> | undefined;
}>;
export declare const userUpdateSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    bio: z.ZodOptional<z.ZodString>;
    affiliation: z.ZodOptional<z.ZodString>;
    website: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    bio?: string | undefined;
    affiliation?: string | undefined;
    website?: string | undefined;
}, {
    name?: string | undefined;
    bio?: string | undefined;
    affiliation?: string | undefined;
    website?: string | undefined;
}>;
export declare const journalSettingsSchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    logoUrl: z.ZodOptional<z.ZodString>;
    settings: z.ZodOptional<z.ZodObject<{
        allowPublicSubmissions: z.ZodDefault<z.ZodBoolean>;
        requireOrcid: z.ZodDefault<z.ZodBoolean>;
        enableBots: z.ZodDefault<z.ZodBoolean>;
        reviewDeadlineDays: z.ZodDefault<z.ZodNumber>;
        revisionDeadlineDays: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        allowPublicSubmissions: boolean;
        requireOrcid: boolean;
        enableBots: boolean;
        reviewDeadlineDays: number;
        revisionDeadlineDays: number;
    }, {
        allowPublicSubmissions?: boolean | undefined;
        requireOrcid?: boolean | undefined;
        enableBots?: boolean | undefined;
        reviewDeadlineDays?: number | undefined;
        revisionDeadlineDays?: number | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    name: string;
    description?: string | undefined;
    logoUrl?: string | undefined;
    settings?: {
        allowPublicSubmissions: boolean;
        requireOrcid: boolean;
        enableBots: boolean;
        reviewDeadlineDays: number;
        revisionDeadlineDays: number;
    } | undefined;
}, {
    name: string;
    description?: string | undefined;
    logoUrl?: string | undefined;
    settings?: {
        allowPublicSubmissions?: boolean | undefined;
        requireOrcid?: boolean | undefined;
        enableBots?: boolean | undefined;
        reviewDeadlineDays?: number | undefined;
        revisionDeadlineDays?: number | undefined;
    } | undefined;
}>;
export declare const botConfigSchema: z.ZodObject<{
    config: z.ZodRecord<z.ZodString, z.ZodAny>;
    isEnabled: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    config: Record<string, any>;
    isEnabled?: boolean | undefined;
}, {
    config: Record<string, any>;
    isEnabled?: boolean | undefined;
}>;
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
    serviceToken?: string;
    manuscript?: {
        title: string;
        abstract: string | null;
        authors: string[];
        status: string;
        keywords: string[];
        workflowPhase: string | null;
        workflowRound: number;
    };
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
export type BotActionHandler = (params: Record<string, any>, context: BotActionHandlerContext) => Promise<BotActionHandlerResult>;
export interface BotActionHandlerContext {
    manuscriptId: string;
    conversationId: string;
    messageId: string;
    triggeredBy: {
        userId: string;
        userRole: string;
    };
    serviceToken: string;
}
export declare enum BotTrigger {
    MENTION = "mention",
    KEYWORD = "keyword",
    MANUSCRIPT_SUBMITTED = "manuscript_submitted",
    REVIEW_COMPLETE = "review_complete",
    SCHEDULED = "scheduled"
}
export declare enum BotEventName {
    MANUSCRIPT_SUBMITTED = "manuscript.submitted",
    MANUSCRIPT_STATUS_CHANGED = "manuscript.statusChanged",
    FILE_UPLOADED = "file.uploaded",
    REVIEWER_ASSIGNED = "reviewer.assigned",
    REVIEWER_STATUS_CHANGED = "reviewer.statusChanged",
    WORKFLOW_PHASE_CHANGED = "workflow.phaseChanged",
    DECISION_RELEASED = "decision.released"
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
export type BotEventHandler<E extends BotEventName> = (context: BotContext, payload: BotEventPayload[E]) => Promise<BotResponse | void>;
export declare enum BotPermission {
    READ_MANUSCRIPT = "read_manuscript",
    READ_FILES = "read_files",
    READ_CONVERSATIONS = "read_conversations",
    WRITE_MESSAGES = "write_messages",
    UPDATE_MANUSCRIPT = "update_manuscript",
    ASSIGN_REVIEWERS = "assign_reviewers",
    MAKE_EDITORIAL_DECISION = "make_editorial_decision"
}
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
    help?: string;
    execute: (params: Record<string, any>, context: any) => Promise<any>;
}
export interface BotCustomHelpSection {
    title: string;
    content: string;
    position: 'before' | 'after';
}
export interface BotInstallationContext {
    botId: string;
    config: Record<string, any>;
    serviceToken?: string;
    uploadFile: (filename: string, content: Buffer, mimetype: string, description?: string) => Promise<{
        id: string;
        downloadUrl: string;
    }>;
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
export type CreateManuscriptData = z.infer<typeof manuscriptSubmissionSchema>;
export type CreateConversationData = z.infer<typeof conversationSchema>;
export type CreateMessageData = z.infer<typeof messageSchema>;
export type UpdateUserData = z.infer<typeof userUpdateSchema>;
export type UpdateJournalSettingsData = z.infer<typeof journalSettingsSchema>;
export type UpdateBotConfigData = z.infer<typeof botConfigSchema>;
export type LoginData = z.infer<typeof loginSchema>;
export * from './workflowTemplates';
export * from './creditRoles';
export * from './jatsTypes';
//# sourceMappingURL=index.d.ts.map