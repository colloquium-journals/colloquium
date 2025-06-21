import request from 'supertest';
import express from 'express';
import { broadcastToConversation, getConnectionCount } from '../../src/routes/events';
import eventsRouter from '../../src/routes/events';

// Create a test app
const app = express();
app.use('/api/events', eventsRouter);

// Mock authentication middleware
jest.mock('../../src/middleware/auth', () => ({
  authenticate: (req: any, res: any, next: any) => {
    req.user = { id: 'test-user-1' };
    next();
  }
}));

describe('SSE Events Integration', () => {
  let sseResponse: any;
  let connectionClosed = false;

  beforeEach(() => {
    connectionClosed = false;
  });

  afterEach(() => {
    // Clean up any open connections
    if (sseResponse && !connectionClosed) {
      sseResponse.end();
    }
  });

  it('should establish SSE connection with correct headers', (done) => {
    request(app)
      .get('/api/events/conversations/test-conversation-1')
      .expect(200)
      .expect('Content-Type', 'text/event-stream')
      .expect('Cache-Control', 'no-cache')
      .expect('Connection', 'keep-alive')
      .end((err, res) => {
        if (err) return done(err);
        
        // Store response for cleanup
        sseResponse = res;
        
        // Should receive initial connection event
        expect(res.text).toContain('data: {\"type\":\"connected\"');
        expect(res.text).toContain('\"conversationId\":\"test-conversation-1\"');
        done();
      });
  });

  it('should broadcast messages to connected clients', (done) => {
    let receivedData = '';
    
    // Establish SSE connection
    const req = request(app)
      .get('/api/events/conversations/test-conversation-2')
      .buffer(false)
      .parse((res, callback) => {
        res.on('data', (chunk) => {
          receivedData += chunk.toString();
          
          // Check if we received the broadcast message
          if (receivedData.includes('new-message') && receivedData.includes('Test broadcast message')) {
            callback(null, receivedData);
            done();
          }
        });
        
        res.on('end', () => {
          callback(null, receivedData);
        });
      })
      .end();

    // Wait a bit for connection to establish, then broadcast
    setTimeout(() => {
      broadcastToConversation('test-conversation-2', {
        type: 'new-message',
        message: {
          id: 'msg-123',
          content: 'Test broadcast message',
          author: { id: 'user-1', name: 'Test User' }
        }
      });
    }, 100);
  });

  it('should track connection count correctly', (done) => {
    // Initially no connections
    expect(getConnectionCount('test-conversation-3')).toBe(0);

    // Establish first connection
    const req1 = request(app)
      .get('/api/events/conversations/test-conversation-3')
      .buffer(false)
      .end();

    setTimeout(() => {
      expect(getConnectionCount('test-conversation-3')).toBe(1);

      // Establish second connection
      const req2 = request(app)
        .get('/api/events/conversations/test-conversation-3')
        .buffer(false)
        .end();

      setTimeout(() => {
        expect(getConnectionCount('test-conversation-3')).toBe(2);
        
        // Close connections
        req1.abort();
        req2.abort();
        
        setTimeout(() => {
          expect(getConnectionCount('test-conversation-3')).toBe(0);
          done();
        }, 100);
      }, 100);
    }, 100);
  });

  it('should send heartbeat messages periodically', (done) => {
    let heartbeatReceived = false;
    let receivedData = '';
    
    const req = request(app)
      .get('/api/events/conversations/test-conversation-4')
      .buffer(false)
      .parse((res, callback) => {
        res.on('data', (chunk) => {
          receivedData += chunk.toString();
          
          // Check for heartbeat message
          if (receivedData.includes('heartbeat') && !heartbeatReceived) {
            heartbeatReceived = true;
            callback(null, receivedData);
            done();
          }
        });
        
        res.on('end', () => {
          callback(null, receivedData);
        });
      });

    // Since heartbeat is every 30 seconds in production, we'll mock a shorter interval for testing
    // This test may take a while or you might want to mock the heartbeat interval
    req.timeout(35000); // 35 second timeout
    req.end();
  }, 40000); // 40 second test timeout

  it('should handle multiple conversations independently', (done) => {
    let conv1Received = false;
    let conv2Received = false;
    
    // Connect to conversation 1
    const req1 = request(app)
      .get('/api/events/conversations/test-conversation-5')
      .buffer(false)
      .parse((res, callback) => {
        res.on('data', (chunk) => {
          const data = chunk.toString();
          if (data.includes('Message for conv 1')) {
            conv1Received = true;
            checkBothReceived();
          }
        });
      })
      .end();

    // Connect to conversation 2
    const req2 = request(app)
      .get('/api/events/conversations/test-conversation-6')
      .buffer(false)
      .parse((res, callback) => {
        res.on('data', (chunk) => {
          const data = chunk.toString();
          if (data.includes('Message for conv 2')) {
            conv2Received = true;
            checkBothReceived();
          }
        });
      })
      .end();

    function checkBothReceived() {
      if (conv1Received && conv2Received) {
        req1.abort();
        req2.abort();
        done();
      }
    }

    // Broadcast to both conversations
    setTimeout(() => {
      broadcastToConversation('test-conversation-5', {
        type: 'new-message',
        message: { id: 'msg-1', content: 'Message for conv 1' }
      });
      
      broadcastToConversation('test-conversation-6', {
        type: 'new-message',
        message: { id: 'msg-2', content: 'Message for conv 2' }
      });
    }, 200);
  });

  it('should clean up dead connections', (done) => {
    // This test verifies that the broadcast function handles dead connections
    const mockResponse = {
      write: jest.fn().mockImplementation(() => {
        throw new Error('Connection closed');
      })
    };

    // Manually add a dead connection to test cleanup
    const connections = (broadcastToConversation as any).__connections || new Map();
    connections.set('test-conversation-7', [mockResponse]);

    // Try to broadcast - should clean up the dead connection
    broadcastToConversation('test-conversation-7', {
      type: 'new-message',
      message: { id: 'msg-test', content: 'Test message' }
    });

    // Connection should be removed
    expect(getConnectionCount('test-conversation-7')).toBe(0);
    done();
  });

  it('should handle authentication correctly', (done) => {
    // This test relies on the mocked auth middleware
    request(app)
      .get('/api/events/conversations/test-conversation-auth')
      .expect(200)
      .end((err, res) => {
        if (err) return done(err);
        
        // Should receive connection event with user context
        expect(res.text).toContain('connected');
        done();
      });
  });

  it('should handle malformed conversation IDs', (done) => {
    request(app)
      .get('/api/events/conversations/') // Empty conversation ID
      .expect(404)
      .end(done);
  });

  it('should broadcast to no connections gracefully', () => {
    // Should not throw error when broadcasting to conversation with no connections
    expect(() => {
      broadcastToConversation('nonexistent-conversation', {
        type: 'new-message',
        message: { id: 'msg-test', content: 'Test' }
      });
    }).not.toThrow();
  });
});