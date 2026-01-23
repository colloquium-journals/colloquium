import { z } from 'zod';
export declare enum UserRole {
    AUTHOR = "AUTHOR",
    REVIEWER = "REVIEWER",
    EDITOR = "EDITOR",
    ADMIN = "ADMIN"
}
export declare enum ManuscriptStatus {
    SUBMITTED = "SUBMITTED",
    UNDER_REVIEW = "UNDER_REVIEW",
    REVISION_REQUESTED = "REVISION_REQUESTED",
    REVISED = "REVISED",
    ACCEPTED = "ACCEPTED",
    REJECTED = "REJECTED",
    PUBLISHED = "PUBLISHED"
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
    orcidId: z.ZodOptional<z.ZodString>;
    bio: z.ZodOptional<z.ZodString>;
    affiliation: z.ZodOptional<z.ZodString>;
    website: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    orcidId?: string | undefined;
    bio?: string | undefined;
    affiliation?: string | undefined;
    website?: string | undefined;
}, {
    name?: string | undefined;
    orcidId?: string | undefined;
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
}
export interface BotResponse {
    botId?: string;
    messages?: {
        content: string;
        replyTo?: string;
        attachments?: BotAttachment[];
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
    type: 'UPDATE_MANUSCRIPT_STATUS' | 'ASSIGN_REVIEWER' | 'CREATE_CONVERSATION' | 'RESPOND_TO_REVIEW' | 'SUBMIT_REVIEW' | 'MAKE_EDITORIAL_DECISION' | 'ASSIGN_ACTION_EDITOR' | 'EXECUTE_PUBLICATION_WORKFLOW';
    data: Record<string, any>;
}
export declare enum BotTrigger {
    MENTION = "mention",
    KEYWORD = "keyword",
    MANUSCRIPT_SUBMITTED = "manuscript_submitted",
    REVIEW_COMPLETE = "review_complete",
    SCHEDULED = "scheduled"
}
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
//# sourceMappingURL=index.d.ts.map