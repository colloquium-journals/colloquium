"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticateWithBots = exports.requireAuth = exports.optionalAuth = exports.requireAnyRole = exports.requireRole = exports.requireGlobalPermission = exports.requirePermission = exports.authenticate = void 0;
exports.generateBotServiceToken = generateBotServiceToken;
const auth_1 = require("@colloquium/auth");
const database_1 = require("@colloquium/database");
const authenticate = async (req, res, next) => {
    try {
        // Get token from cookie or Authorization header
        const token = req.cookies['auth-token'] ||
            (req.headers.authorization?.startsWith('Bearer ') ?
                req.headers.authorization.slice(7) : null);
        if (!token) {
            return res.status(401).json({
                error: 'Not Authenticated',
                message: 'No authentication token provided'
            });
        }
        try {
            const payload = (0, auth_1.verifyJWT)(token);
            // Get fresh user data from database
            const user = await database_1.prisma.users.findUnique({
                where: { id: payload.userId },
                select: {
                    id: true,
                    email: true,
                    name: true,
                    role: true,
                    orcidId: true,
                    createdAt: true
                }
            });
            if (!user) {
                return res.status(401).json({
                    error: 'User Not Found',
                    message: 'User account no longer exists'
                });
            }
            // Add user to request object (cast role to match auth package enum)
            req.user = {
                ...user,
                role: user.role
            };
            console.log(`DEBUG: Authenticated user - email: ${user.email}, role: ${user.role}`);
            next();
        }
        catch (jwtError) {
            return res.status(401).json({
                error: 'Invalid Token',
                message: 'Authentication token is invalid or expired'
            });
        }
    }
    catch (error) {
        next(error);
    }
};
exports.authenticate = authenticate;
const requirePermission = (permission) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                error: 'Not Authenticated',
                message: 'Authentication required'
            });
        }
        if (!(0, auth_1.hasPermission)(req.user.role, permission)) {
            return res.status(403).json({
                error: 'Insufficient Permissions',
                message: `This action requires ${permission} permission`
            });
        }
        next();
    };
};
exports.requirePermission = requirePermission;
const requireGlobalPermission = (permission) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                error: 'Not Authenticated',
                message: 'Authentication required'
            });
        }
        if (!(0, auth_1.hasGlobalPermission)(req.user.role, permission)) {
            return res.status(403).json({
                error: 'Insufficient Permissions',
                message: `This action requires ${permission} permission`
            });
        }
        next();
    };
};
exports.requireGlobalPermission = requireGlobalPermission;
const requireRole = (role) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                error: 'Not Authenticated',
                message: 'Authentication required'
            });
        }
        if (req.user.role !== role) {
            return res.status(403).json({
                error: 'Insufficient Permissions',
                message: `This action requires ${role} role`
            });
        }
        next();
    };
};
exports.requireRole = requireRole;
const requireAnyRole = (roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                error: 'Not Authenticated',
                message: 'Authentication required'
            });
        }
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                error: 'Insufficient Permissions',
                message: `This action requires one of: ${roles.join(', ')}`
            });
        }
        next();
    };
};
exports.requireAnyRole = requireAnyRole;
// Optional authentication - doesn't fail if no token provided
const optionalAuth = async (req, res, next) => {
    try {
        const token = req.cookies['auth-token'] ||
            (req.headers.authorization?.startsWith('Bearer ') ?
                req.headers.authorization.slice(7) : null);
        if (token) {
            try {
                const payload = (0, auth_1.verifyJWT)(token);
                const user = await database_1.prisma.users.findUnique({
                    where: { id: payload.userId },
                    select: {
                        id: true,
                        email: true,
                        name: true,
                        role: true,
                        orcidId: true,
                        createdAt: true
                    }
                });
                if (user) {
                    req.user = {
                        ...user,
                        role: user.role
                    };
                }
            }
            catch (jwtError) {
                // Ignore invalid tokens for optional auth
            }
        }
        next();
    }
    catch (error) {
        next(error);
    }
};
exports.optionalAuth = optionalAuth;
// Alias for authenticate for convenience
exports.requireAuth = exports.authenticate;
// Bot service token generation
function generateBotServiceToken(botId, manuscriptId, permissions = []) {
    return (0, auth_1.generateJWT)({
        userId: `bot-${botId}`,
        email: `${botId}@colloquium.bot`,
        role: 'BOT',
        botId,
        manuscriptId,
        permissions,
        type: 'BOT_SERVICE_TOKEN'
    });
}
// Bot service token verification
function verifyBotServiceToken(token) {
    try {
        const payload = (0, auth_1.verifyJWT)(token);
        if (payload.type !== 'BOT_SERVICE_TOKEN') {
            throw new Error('Invalid token type');
        }
        return payload;
    }
    catch (error) {
        throw new Error('Invalid bot service token');
    }
}
// Authentication middleware that supports both user and bot tokens
const authenticateWithBots = async (req, res, next) => {
    try {
        // Check for bot service token first
        const botToken = req.headers['x-bot-token'];
        if (botToken) {
            try {
                const botPayload = verifyBotServiceToken(botToken);
                req.botContext = {
                    botId: botPayload.botId,
                    manuscriptId: botPayload.manuscriptId,
                    permissions: botPayload.permissions || [],
                    type: 'BOT_SERVICE_TOKEN'
                };
                console.log(`DEBUG: Authenticated bot - botId: ${botPayload.botId}, manuscriptId: ${botPayload.manuscriptId}`);
                return next();
            }
            catch (botError) {
                return res.status(401).json({
                    error: 'Invalid Bot Token',
                    message: 'Bot service token is invalid or expired'
                });
            }
        }
        // Fallback to regular user authentication
        return (0, exports.authenticate)(req, res, next);
    }
    catch (error) {
        next(error);
    }
};
exports.authenticateWithBots = authenticateWithBots;
