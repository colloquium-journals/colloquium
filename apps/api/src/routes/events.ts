import { Router, Request, Response } from 'express';
import { authenticate, optionalAuth } from '../middleware/auth';
import { prisma } from '@colloquium/database';
import { WorkflowConfig } from '@colloquium/types';
import { maskMessageAuthor } from '../services/workflowVisibility';

const router = Router();

// Helper function to get workflow config from journal settings
async function getWorkflowConfig(): Promise<WorkflowConfig | null> {
  try {
    const settings = await prisma.journal_settings.findFirst({
      where: { id: 'singleton' },
      select: { settings: true }
    });

    if (settings?.settings && typeof settings.settings === 'object') {
      const journalSettings = settings.settings as any;
      return journalSettings.workflowConfig || null;
    }
    return null;
  } catch (error) {
    console.error('Failed to get workflow config:', error);
    return null;
  }
}

// Helper function to get manuscript workflow context
async function getManuscriptWorkflowContext(manuscriptId: string) {
  const manuscript = await prisma.manuscripts.findUnique({
    where: { id: manuscriptId },
    select: {
      workflowPhase: true,
      workflowRound: true
    }
  });

  return manuscript || { workflowPhase: 'REVIEW', workflowRound: 1 };
}

// Store active SSE connections with user context
interface AuthenticatedConnection {
  response: Response;
  userId: string | null;
  userRole: string | null;
}

const connections = new Map<string, AuthenticatedConnection[]>();

// Test endpoint to verify events route is working
router.get('/test', (req: Request, res: Response) => {
  res.json({ 
    message: 'Events route is working',
    timestamp: new Date().toISOString()
  });
});

// SSE endpoint for conversation events  
router.get('/conversations/:conversationId', async (req: Request, res: Response) => {
  
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
      const { verifyJWT } = await import('@colloquium/auth');
      const { prisma } = await import('@colloquium/database');
      
      const payload = verifyJWT(token as string);
      
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
  } catch (error) {
    // Keep this error log as it's important for debugging auth issues
    console.error(`SSE authentication failed for conversation ${conversationId}:`, (error as Error).message);
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
  } catch (error) {
    console.error(`SSE: Failed to send connection event:`, error);
  }

  // Store this connection with user context
  if (!connections.has(conversationId)) {
    connections.set(conversationId, []);
  }
  connections.get(conversationId)!.push({
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
import { canUserSeeMessage } from './conversations';

// Function to broadcast message to authorized connections in a conversation
export async function broadcastToConversation(conversationId: string, eventData: any, manuscriptId?: string) {
  const conversationConnections = connections.get(conversationId);

  if (!conversationConnections || conversationConnections.length === 0) {
    return;
  }

  // For message events, we need to check permissions per user and apply identity masking
  if (eventData.type === 'new-message' && eventData.message && manuscriptId) {
    const message = eventData.message;

    // Get workflow config and manuscript context for masking
    const workflowConfig = await getWorkflowConfig();
    const manuscriptContext = await getManuscriptWorkflowContext(manuscriptId);

    const deadConnections: AuthenticatedConnection[] = [];

    // Check each connection's permission to see this message
    for (let index = 0; index < conversationConnections.length; index++) {
      const connection = conversationConnections[index];

      try {
        // Check if this user can see the message
        const canSee = await canUserSeeMessage(
          connection.userId || undefined,
          connection.userRole || undefined,
          message.privacy,
          manuscriptId
        );

        if (canSee) {
          // Apply identity masking based on viewer's context
          let maskedMessage = { ...message };

          if (workflowConfig && message.author) {
            const maskedAuthor = await maskMessageAuthor(
              message.author,
              connection.userId || undefined,
              connection.userRole || undefined,
              manuscriptId,
              workflowConfig,
              manuscriptContext.workflowPhase
            );
            maskedMessage = { ...message, author: maskedAuthor };
          }

          const data = JSON.stringify({ ...eventData, message: maskedMessage });
          connection.response.write(`data: ${data}\n\n`);
          connection.response.flush();
        }
      } catch (error) {
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
  } else {
    // For non-message events (like heartbeats), broadcast to all
    const data = JSON.stringify(eventData);
    const deadConnections: AuthenticatedConnection[] = [];
    
    conversationConnections.forEach((connection, index) => {
      try {
        console.log(`📡 SSE: Sending non-message event to connection ${index}`);
        connection.response.write(`data: ${data}\n\n`);
        connection.response.flush();
      } catch (error) {
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
export function getConnectionCount(conversationId?: string): number {
  if (conversationId) {
    return connections.get(conversationId)?.length || 0;
  }
  
  let total = 0;
  connections.forEach(conns => total += conns.length);
  return total;
}

// Add this new function to close all connections on shutdown
export function closeAllConnections() {
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

export default router;