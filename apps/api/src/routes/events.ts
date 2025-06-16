import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';

const router = Router();

// Store active SSE connections
const connections = new Map<string, Response[]>();

// SSE endpoint for conversation events
router.get('/conversations/:conversationId', authenticate, (req: Request, res: Response) => {
  const conversationId = req.params.conversationId;
  const userId = req.user!.id;

  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': req.headers.origin || '*',
    'Access-Control-Allow-Credentials': 'true'
  });

  // Send initial connection event
  res.write(`data: ${JSON.stringify({ type: 'connected', conversationId })}\n\n`);

  // Store this connection
  if (!connections.has(conversationId)) {
    connections.set(conversationId, []);
  }
  connections.get(conversationId)!.push(res);

  console.log(`📡 SSE: User ${userId} connected to conversation ${conversationId}`);
  console.log(`📡 SSE: ${connections.get(conversationId)!.length} total connections for conversation ${conversationId}`);

  // Send periodic heartbeat to keep connection alive
  const heartbeat = setInterval(() => {
    try {
      res.write(`data: ${JSON.stringify({ type: 'heartbeat', timestamp: Date.now() })}\n\n`);
    } catch (error) {
      clearInterval(heartbeat);
    }
  }, 30000); // Every 30 seconds

  // Handle client disconnect
  req.on('close', () => {
    clearInterval(heartbeat);
    
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
    clearInterval(heartbeat);
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
  
  const data = JSON.stringify(eventData);
  const deadConnections: Response[] = [];

  // Send to all connections
  conversationConnections.forEach((connection) => {
    try {
      connection.write(`data: ${data}\n\n`);
    } catch (error) {
      console.error('📡 SSE: Failed to write to connection:', error);
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

export default router;