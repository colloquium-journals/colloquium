"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.canUserSeeMessage = canUserSeeMessage;
const express_1 = require("express");
const database_1 = require("@colloquium/database");
const auth_1 = require("../middleware/auth");
const events_1 = require("./events");
const jobs_1 = require("../jobs");
const crypto_1 = require("crypto");
const router = (0, express_1.Router)();
// Helper function to determine if user can see a message based on privacy level
async function canUserSeeMessage(userId, userRole, messagePrivacy, manuscriptId) {
    if (!userId || !userRole) {
        return messagePrivacy === 'PUBLIC';
    }
    switch (messagePrivacy) {
        case 'PUBLIC':
            return true;
        case 'AUTHOR_VISIBLE':
            // Check if user is author, reviewer, editor, or admin
            if (userRole === 'ADMIN' || userRole === 'EDITOR_IN_CHIEF' || userRole === 'ACTION_EDITOR')
                return true;
            // Check if user is an author of the manuscript
            const authorRelation = await database_1.prisma.manuscript_authors.findFirst({
                where: {
                    manuscriptId,
                    userId
                }
            });
            if (authorRelation)
                return true;
            // Check if user is assigned as reviewer
            const reviewerAssignment = await database_1.prisma.review_assignments.findFirst({
                where: {
                    manuscriptId,
                    reviewerId: userId
                }
            });
            return !!reviewerAssignment;
        case 'REVIEWER_ONLY':
            // Only reviewers, editors, and admins
            if (userRole === 'ADMIN' || userRole === 'EDITOR_IN_CHIEF' || userRole === 'ACTION_EDITOR')
                return true;
            const reviewAssignment = await database_1.prisma.review_assignments.findFirst({
                where: {
                    manuscriptId,
                    reviewerId: userId
                }
            });
            return !!reviewAssignment;
        case 'EDITOR_ONLY':
            return userRole === 'ADMIN' || userRole === 'EDITOR_IN_CHIEF' || userRole === 'ACTION_EDITOR';
        case 'ADMIN_ONLY':
            return userRole === 'ADMIN';
        default:
            return false;
    }
}
// Helper function to get default privacy level based on user role
function getDefaultPrivacyLevel(userRole) {
    switch (userRole) {
        case 'ADMIN':
        case 'EDITOR_IN_CHIEF':
        case 'ACTION_EDITOR':
            return 'AUTHOR_VISIBLE';
        case 'USER':
        default:
            return 'AUTHOR_VISIBLE';
    }
}
// GET /api/conversations - List conversations
router.get('/', auth_1.optionalAuth, async (req, res, next) => {
    try {
        const { manuscriptId, search, manuscriptStatus, page = '1', limit = '20' } = req.query;
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const skip = (pageNum - 1) * limitNum;
        // Build where clause
        const where = {};
        if (manuscriptId)
            where.manuscriptId = manuscriptId;
        // Initialize manuscript filter object
        let manuscriptFilter = {};
        // Filter by manuscript status
        if (manuscriptStatus === 'active') {
            // Show only manuscripts in review process
            manuscriptFilter.status = {
                in: ['SUBMITTED', 'UNDER_REVIEW', 'REVISION_REQUESTED', 'REVISED', 'ACCEPTED']
            };
        }
        else if (manuscriptStatus === 'completed') {
            // Show only completed manuscripts
            manuscriptFilter.status = {
                in: ['PUBLISHED', 'REJECTED', 'RETRACTED']
            };
        }
        // Add search functionality
        if (search && typeof search === 'string' && search.trim()) {
            const searchTerm = search.trim();
            where.OR = [
                {
                    title: {
                        contains: searchTerm,
                        mode: 'insensitive'
                    },
                    ...(Object.keys(manuscriptFilter).length > 0 && { manuscripts: manuscriptFilter })
                },
                {
                    manuscripts: {
                        title: {
                            contains: searchTerm,
                            mode: 'insensitive'
                        },
                        ...manuscriptFilter
                    }
                },
                {
                    manuscripts: {
                        authors: {
                            hasSome: [searchTerm]
                        },
                        ...manuscriptFilter
                    }
                }
            ];
        }
        else if (Object.keys(manuscriptFilter).length > 0) {
            // Apply manuscript filter when no search term
            where.manuscripts = manuscriptFilter;
        }
        // Get conversations with related data
        const [conversations, total] = await Promise.all([
            database_1.prisma.conversations.findMany({
                where,
                skip,
                take: limitNum,
                orderBy: { updatedAt: 'desc' },
                include: {
                    manuscripts: {
                        select: {
                            id: true,
                            title: true,
                            authors: true,
                            status: true
                        }
                    },
                    _count: {
                        select: {
                            messages: true,
                            conversation_participants: true
                        }
                    },
                    messages: {
                        take: 1,
                        orderBy: { createdAt: 'desc' },
                        include: {
                            users: {
                                select: {
                                    id: true,
                                    name: true,
                                    email: true
                                }
                            }
                        }
                    }
                }
            }),
            database_1.prisma.conversations.count({ where })
        ]);
        // Format response
        const formattedConversations = conversations.map(conv => ({
            id: conv.id,
            title: conv.title,
            manuscript: conv.manuscripts,
            messageCount: conv._count.messages,
            participantCount: conv._count.conversation_participants,
            lastMessage: conv.messages[0] ? {
                id: conv.messages[0].id,
                content: conv.messages[0].content,
                author: conv.messages[0].users,
                createdAt: conv.messages[0].createdAt,
                isBot: conv.messages[0].isBot
            } : null,
            createdAt: conv.createdAt,
            updatedAt: conv.updatedAt
        }));
        res.json({
            conversations: formattedConversations,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                pages: Math.ceil(total / limitNum)
            }
        });
    }
    catch (error) {
        next(error);
    }
});
// GET /api/conversations/:id - Get conversation + messages
router.get('/:id', auth_1.optionalAuth, async (req, res, next) => {
    try {
        const { id } = req.params;
        const conversation = await database_1.prisma.conversations.findUnique({
            where: { id },
            include: {
                manuscripts: {
                    select: {
                        id: true,
                        title: true,
                        authors: true,
                        status: true,
                        action_editors: {
                            include: {
                                users_action_editors_editorIdTousers: {
                                    select: {
                                        id: true,
                                        name: true,
                                        email: true,
                                        affiliation: true
                                    }
                                }
                            }
                        }
                    }
                },
                conversation_participants: {
                    include: {
                        users: {
                            select: {
                                id: true,
                                name: true,
                                email: true,
                                role: true
                            }
                        }
                    }
                },
                messages: {
                    orderBy: { createdAt: 'asc' },
                    include: {
                        users: {
                            select: {
                                id: true,
                                name: true,
                                email: true
                            }
                        }
                    }
                }
            }
        });
        if (!conversation) {
            return res.status(404).json({
                error: 'Conversation not found',
                message: `No conversation found with ID: ${id}`
            });
        }
        // Filter messages based on user's permission to see them
        console.log(`Found ${conversation.messages.length} total messages for conversation ${id}`);
        const visibleMessages = [];
        const messageVisibilityMap = [];
        for (const msg of conversation.messages) {
            const canSee = await canUserSeeMessage(req.user?.id, req.user?.role, msg.privacy, conversation.manuscriptId);
            console.log(`Message ${msg.id} (privacy: ${msg.privacy}) - can user see: ${canSee}`);
            messageVisibilityMap.push({
                id: msg.id,
                visible: canSee,
                createdAt: msg.createdAt
            });
            if (canSee) {
                visibleMessages.push(msg);
            }
        }
        console.log(`Returning ${visibleMessages.length} visible messages`);
        // Format response
        const formattedConversation = {
            id: conversation.id,
            title: conversation.title,
            manuscript: conversation.manuscripts,
            participants: conversation.conversation_participants.map(p => ({
                id: p.id,
                role: p.role,
                user: p.users
            })),
            totalMessageCount: conversation.messages.length,
            visibleMessageCount: visibleMessages.length,
            messageVisibilityMap,
            messages: visibleMessages.map(msg => ({
                id: msg.id,
                content: msg.content,
                privacy: msg.privacy,
                author: msg.users,
                createdAt: msg.createdAt,
                updatedAt: msg.updatedAt,
                parentId: msg.parentId,
                isBot: msg.isBot
            })),
            createdAt: conversation.createdAt,
            updatedAt: conversation.updatedAt
        };
        res.json(formattedConversation);
    }
    catch (error) {
        next(error);
    }
});
// PUT /api/conversations/:id - Update conversation settings
router.put('/:id', async (req, res, next) => {
    try {
        // TODO: Implement conversation update
        res.json({ message: 'Conversation updated' });
    }
    catch (error) {
        next(error);
    }
});
// POST /api/conversations/:id/messages - Post new message
router.post('/:id/messages', auth_1.authenticate, (req, res, next) => {
    const { Permission } = require('@colloquium/auth');
    return (0, auth_1.requirePermission)(Permission.CREATE_CONVERSATION)(req, res, next);
}, async (req, res, next) => {
    try {
        const { id: conversationId } = req.params;
        const { content, parentId, privacy } = req.body;
        // Validate required fields
        if (!content || !content.trim()) {
            return res.status(400).json({
                error: 'Validation Error',
                message: 'Message content is required'
            });
        }
        // Verify conversation exists and get manuscript info
        const conversation = await database_1.prisma.conversations.findUnique({
            where: { id: conversationId },
            select: {
                id: true,
                title: true,
                manuscriptId: true
            }
        });
        if (!conversation) {
            return res.status(404).json({
                error: 'Conversation not found',
                message: `No conversation found with ID: ${conversationId}`
            });
        }
        // Verify parent message exists if provided
        if (parentId) {
            const parentMessage = await database_1.prisma.messages.findUnique({
                where: { id: parentId },
                select: { id: true, conversationId: true }
            });
            if (!parentMessage || parentMessage.conversationId !== conversationId) {
                return res.status(400).json({
                    error: 'Invalid parent message',
                    message: 'Parent message not found or belongs to different conversation'
                });
            }
        }
        // Determine privacy level (use provided privacy or default based on user role)
        const messagePrivacy = privacy || getDefaultPrivacyLevel(req.user.role);
        // Create the message
        console.log('Creating message with data:', {
            content: content.trim(),
            conversationId,
            authorId: req.user.id,
            parentId: parentId || null,
            privacy: messagePrivacy,
            isBot: false
        });
        const message = await database_1.prisma.messages.create({
            data: {
                id: (0, crypto_1.randomUUID)(),
                content: content.trim(),
                conversationId,
                authorId: req.user.id,
                parentId: parentId || null,
                privacy: messagePrivacy,
                isBot: false,
                updatedAt: new Date()
            },
            include: {
                users: {
                    select: {
                        id: true,
                        name: true,
                        email: true
                    }
                }
            }
        });
        console.log('Message created successfully:', message.id);
        // Update conversation's updatedAt timestamp
        await database_1.prisma.conversations.update({
            where: { id: conversationId },
            data: { updatedAt: new Date() }
        });
        // Queue bot processing for asynchronous execution
        // Check if the message contains bot mentions before queuing
        const hasBotMentions = content.includes('@') && /[@][\w-]+/.test(content);
        if (hasBotMentions) {
            try {
                console.log(`Queuing bot processing for message ${message.id} with content: "${content.substring(0, 100)}..."`);
                const botQueue = (0, jobs_1.getBotQueue)();
                // Add job to the bot processing queue
                await botQueue.add('bot-processing', {
                    messageId: message.id,
                    conversationId,
                    userId: req.user.id,
                    manuscriptId: conversation.manuscriptId
                }, {
                    attempts: 3,
                    backoff: {
                        type: 'exponential',
                        delay: 2000,
                    },
                    removeOnComplete: true, // Remove completed jobs to save memory
                    removeOnFail: false, // Keep failed jobs for debugging
                });
                console.log(`Bot processing job queued successfully for message ${message.id}`);
            }
            catch (queueError) {
                console.error('Failed to queue bot processing:', queueError);
                // Don't fail the message creation if queue fails
                // TODO: Could optionally create a system message about the failure
            }
        }
        else {
            console.log('No bot mentions detected, skipping bot processing queue');
        }
        // Format response
        const formattedMessage = {
            id: message.id,
            content: message.content,
            privacy: message.privacy,
            author: message.users,
            createdAt: message.createdAt,
            updatedAt: message.updatedAt,
            parentId: message.parentId,
            isBot: message.isBot
        };
        // Broadcast the new message via SSE with permission filtering
        await (0, events_1.broadcastToConversation)(conversationId, {
            type: 'new-message',
            message: formattedMessage
        }, conversation.manuscriptId);
        // Bot responses are now broadcast immediately when created above
        res.status(201).json({
            message: 'Message posted successfully',
            data: formattedMessage
        });
    }
    catch (error) {
        next(error);
    }
});
// NOTE: Conversations are now automatically created when manuscripts are submitted
// Standalone conversation creation has been removed to ensure all discussions
// are tied to specific manuscript submissions
exports.default = router;
