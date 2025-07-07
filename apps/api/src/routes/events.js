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
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.broadcastToConversation = broadcastToConversation;
exports.getConnectionCount = getConnectionCount;
exports.closeAllConnections = closeAllConnections;
const express_1 = require("express");
const router = (0, express_1.Router)();
const connections = new Map();
// Test endpoint to verify events route is working
router.get('/test', (req, res) => {
    res.json({
        message: 'Events route is working',
        timestamp: new Date().toISOString()
    });
});
// SSE endpoint for conversation events  
router.get('/conversations/:conversationId', async (req, res) => {
    const conversationId = req.params.conversationId;
    // Try to authenticate using cookies or query parameter
    let authenticatedUser = null;
    try {
        // First try cookie authentication
        const token = req.cookies['auth-token'] ||
            req.query.token || // Allow token via query parameter for SSE
            (req.headers.authorization?.startsWith('Bearer ') ?
                req.headers.authorization.slice(7) : null);
        if (token) {
            const { verifyJWT } = await Promise.resolve().then(() => __importStar(require('@colloquium/auth')));
            const { prisma } = await Promise.resolve().then(() => __importStar(require('@colloquium/database')));
            const payload = verifyJWT(token);
            // Get user from database
            const user = await prisma.users.findUnique({
                where: { id: payload.userId },
                select: {
                    id: true,
                    email: true,
                    name: true,
                    role: true
                }
            });
            if (user) {
                authenticatedUser = user;
            }
        }
    }
    catch (error) {
        // Keep this error log as it's important for debugging auth issues
        console.error(`SSE authentication failed for conversation ${conversationId}:`, error.message);
    }
    const userId = authenticatedUser?.id || null;
    // Define a whitelist of allowed origins for security
    const allowedOrigins = ['http://localhost:3000', 'http://localhost:3001', 'http://127.0.0.1:3000', 'http://127.0.0.1:3001']; // Add your web app's URL
    const origin = req.headers.origin || '';
    if (!allowedOrigins.includes(origin)) {
        console.error(`📡 SSE: Origin not allowed: ${origin}`);
        return res.status(403).json({ error: 'Origin not allowed' });
    }
    // Set SSE headers
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': origin, // Use the validated origin
        'Access-Control-Allow-Credentials': 'true'
    });
    // Flush the headers to establish the connection immediately
    res.flushHeaders();
    // Send initial connection event
    const connectionEvent = JSON.stringify({ type: 'connected', conversationId });
    try {
        res.write(`data: ${connectionEvent}\n\n`);
        res.flush(); // Force flush the data
    }
    catch (error) {
        console.error(`SSE: Failed to send connection event:`, error);
    }
    // Store this connection with user context
    if (!connections.has(conversationId)) {
        connections.set(conversationId, []);
    }
    connections.get(conversationId).push({
        response: res,
        userId: authenticatedUser?.id || null,
        userRole: authenticatedUser?.role || null
    });
    // Handle client disconnect
    req.on('close', () => {
        // Remove this connection from the store
        const conversationConnections = connections.get(conversationId);
        if (conversationConnections) {
            const index = conversationConnections.findIndex(conn => conn.response === res);
            if (index > -1) {
                conversationConnections.splice(index, 1);
            }
            // Clean up empty conversation arrays
            if (conversationConnections.length === 0) {
                connections.delete(conversationId);
            }
        }
    });
    req.on('error', (error) => {
        console.error(`📡 SSE: Connection error for user ${userId}:`, error);
    });
});
// Import the permission checking function
const conversations_1 = require("./conversations");
// Function to broadcast message to authorized connections in a conversation
async function broadcastToConversation(conversationId, eventData, manuscriptId) {
    const conversationConnections = connections.get(conversationId);
    if (!conversationConnections || conversationConnections.length === 0) {
        return;
    }
    // For message events, we need to check permissions per user
    if (eventData.type === 'new-message' && eventData.message && manuscriptId) {
        const message = eventData.message;
        const deadConnections = [];
        // Check each connection's permission to see this message
        for (let index = 0; index < conversationConnections.length; index++) {
            const connection = conversationConnections[index];
            try {
                // Check if this user can see the message
                const canSee = await (0, conversations_1.canUserSeeMessage)(connection.userId || undefined, connection.userRole || undefined, message.privacy, manuscriptId);
                if (canSee) {
                    const data = JSON.stringify(eventData);
                    connection.response.write(`data: ${data}\n\n`);
                    connection.response.flush();
                }
            }
            catch (error) {
                console.error(`📡 SSE: Failed to write to connection ${index}:`, error);
                deadConnections.push(connection);
            }
        }
        // Remove dead connections
        deadConnections.forEach((deadConnection) => {
            const index = conversationConnections.indexOf(deadConnection);
            if (index > -1) {
                conversationConnections.splice(index, 1);
            }
        });
    }
    else {
        // For non-message events (like heartbeats), broadcast to all
        const data = JSON.stringify(eventData);
        const deadConnections = [];
        conversationConnections.forEach((connection, index) => {
            try {
                console.log(`📡 SSE: Sending non-message event to connection ${index}`);
                connection.response.write(`data: ${data}\n\n`);
                connection.response.flush();
            }
            catch (error) {
                console.error(`📡 SSE: Failed to write to connection ${index}:`, error);
                deadConnections.push(connection);
            }
        });
        // Remove dead connections
        deadConnections.forEach((deadConnection) => {
            const index = conversationConnections.indexOf(deadConnection);
            if (index > -1) {
                conversationConnections.splice(index, 1);
            }
        });
    }
    // Clean up empty conversation arrays
    if (conversationConnections.length === 0) {
        connections.delete(conversationId);
    }
}
// Function to get connection count for debugging
function getConnectionCount(conversationId) {
    if (conversationId) {
        return connections.get(conversationId)?.length || 0;
    }
    let total = 0;
    connections.forEach(conns => total += conns.length);
    return total;
}
// Add this new function to close all connections on shutdown
function closeAllConnections() {
    console.log('🔌 Shutting down: Closing all active SSE connections...');
    connections.forEach((conns, conversationId) => {
        console.log(`🔌 Closing ${conns.length} connections for conversation ${conversationId}`);
        conns.forEach(conn => {
            conn.response.end(); // Gracefully end the response stream
        });
    });
    connections.clear();
    console.log('🔌 All SSE connections have been closed.');
}
exports.default = router;
