import { Router, Request, Response } from 'express';
import { authenticate, optionalAuth } from '../middleware/auth';

const router = Router();

// Store active SSE connections
const connections = new Map<string, Response[]>();

// Test endpoint to verify events route is working
router.get('/test', (req: Request, res: Response) => {
  res.json({ 
    message: 'Events route is working',
    timestamp: new Date().toISOString()
  });
});

// SSE endpoint for conversation events  
router.get('/conversations/:conversationId', async (req: Request, res: Response) => {
  console.log(`🔥 SSE: Endpoint hit! ConversationId: ${req.params.conversationId}`);
  console.log(`🔥 SSE: Request headers:`, {
    userAgent: req.headers['user-agent'],
    accept: req.headers.accept,
    origin: req.headers.origin,
    cookie: req.headers.cookie ? 'present' : 'missing'
  });
  
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
        console.log(`📡 SSE: Authenticated user ${user.email} (${user.id}) connecting to conversation ${conversationId}`);
      }
    }
    
    if (!authenticatedUser) {
      console.log(`📡 SSE: Anonymous user connecting to conversation ${conversationId} (no valid auth token)`);
    }
  } catch (error) {
    console.log(`📡 SSE: Auth failed for conversation ${conversationId}:`, (error as Error).message);
  }
  
  const userId = authenticatedUser?.id || 'anonymous';
  const userEmail = authenticatedUser?.email || 'anonymous';

  // Check if this is a proper EventSource request
  const isEventSource = req.headers.accept?.includes('text/event-stream');
  console.log(`📡 SSE: Is EventSource request: ${isEventSource}`);
  console.log(`📡 SSE: Accept header: ${req.headers.accept}`);

  // Define a whitelist of allowed origins for security
  const allowedOrigins = ['http://localhost:3000', 'http://localhost:3001', 'http://127.0.0.1:3000', 'http://127.0.0.1:3001']; // Add your web app's URL
  const origin = req.headers.origin || '';
  console.log(`📡 SSE: Request origin: "${origin}", allowed origins:`, allowedOrigins);
  
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

  console.log(`📡 SSE: Headers sent, sending initial connection event`);

  // Send initial connection event
  const connectionEvent = JSON.stringify({ type: 'connected', conversationId });
  console.log(`📡 SSE: About to send connection event: ${connectionEvent}`);
  
  try {
    res.write(`data: ${connectionEvent}\n\n`);
    res.flush(); // Force flush the data
    console.log(`📡 SSE: Sent connection event: ${connectionEvent}`);
    
    
  } catch (error) {
    console.error(`📡 SSE: Failed to send connection event:`, error);
  }

  // Store this connection
  if (!connections.has(conversationId)) {
    connections.set(conversationId, []);
  }
  connections.get(conversationId)!.push(res);

  console.log(`📡 SSE: User ${userId} connected to conversation ${conversationId}`);
  console.log(`📡 SSE: ${connections.get(conversationId)!.length} total connections for conversation ${conversationId}`);


  // Handle client disconnect
  req.on('close', () => {
    // Remove this connection from the store
    const conversationConnections = connections.get(conversationId);
    if (conversationConnections) {
      const index = conversationConnections.indexOf(res);
      if (index > -1) {
        conversationConnections.splice(index, 1);
      }
      
      // Clean up empty conversation arrays
      if (conversationConnections.length === 0) {
        connections.delete(conversationId);
      }
    }
    
    console.log(`📡 SSE: User ${userId} disconnected from conversation ${conversationId}`);
  });

  req.on('error', (error) => {
    console.error(`📡 SSE: Connection error for user ${userId}:`, error);
  });
});

// Function to broadcast message to all connections in a conversation
export function broadcastToConversation(conversationId: string, eventData: any) {
  const conversationConnections = connections.get(conversationId);
  
  if (!conversationConnections || conversationConnections.length === 0) {
    console.log(`📡 SSE: No connections to broadcast to for conversation ${conversationId}`);
    return;
  }

  console.log(`📡 SSE: Broadcasting to ${conversationConnections.length} connections in conversation ${conversationId}`);
  console.log(`📡 SSE: Event data being sent:`, eventData);
  
  const data = JSON.stringify(eventData);
  console.log(`📡 SSE: Serialized data:`, data);
  const deadConnections: Response[] = [];

  // Send to all connections
  conversationConnections.forEach((connection, index) => {
    try {
      console.log(`📡 SSE: Sending to connection ${index}:`, `data: ${data}\\n\\n`);
      connection.write(`data: ${data}\n\n`);
      connection.flush(); // Force flush the data
      console.log(`📡 SSE: Successfully sent to connection ${index}`);
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
    conns.forEach(res => {
      res.end(); // Gracefully end the response stream
    });
  });
  connections.clear();
  console.log('🔌 All SSE connections have been closed.');
}

export default router;