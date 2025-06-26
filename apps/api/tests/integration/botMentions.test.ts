import request from 'supertest';
import app from '../../src/app';
import { prisma, ConversationType, GlobalRole } from '@colloquium/database';
import { botExecutor } from '@colloquium/bots';
import { sign } from 'jsonwebtoken';

describe('Bot Mentions Integration', () => {
  let authToken: string;
  let userId: string;
  let conversationId: string;

  beforeAll(async () => {
    // Create test user
    const user = await prisma.user.create({
      data: {
        email: 'test@example.com',
        name: 'Test User',
        role: GlobalRole.USER
      }
    });
    userId = user.id;

    // Create auth token
    authToken = sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );

    // Create test conversation
    // Create test manuscript first
    const manuscript = await prisma.manuscript.create({
      data: {
        title: 'Test Manuscript',
        abstract: 'Test abstract',
        content: 'Test content'
      }
    });

    const conversation = await prisma.conversation.create({
      data: {
        title: 'Test Conversation',
        type: ConversationType.EDITORIAL,
        privacy: 'PRIVATE',
        manuscriptId: manuscript.id
      }
    });
    conversationId = conversation.id;
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.message.deleteMany({ where: { conversationId } });
    await prisma.conversation.deleteMany({ where: { id: conversationId } });
    await prisma.user.deleteMany({ where: { id: userId } });
  });

  describe('Simple Bot Mentions', () => {
    it('should trigger help command for simple editorial bot mention', async () => {
      const response = await request(app)
        .post(`/api/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          content: 'Hello @editorial-bot'
        });

      expect(response.status).toBe(201);
      expect(response.body.message.content).toBe('Hello @editorial-bot');

      // Wait a bit for bot processing
      await new Promise(resolve => setTimeout(resolve, 100));

      // Check for bot response
      const messages = await prisma.message.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'desc' },
        take: 2
      });

      expect(messages).toHaveLength(2);
      
      // User message
      expect(messages[1].content).toBe('Hello @editorial-bot');
      expect(messages[1].isBot).toBe(false);
      
      // Bot response
      expect(messages[0].isBot).toBe(true);
      expect(messages[0].content).toContain('Editorial Bot Help');
    });

    it('should trigger help command for simple plagiarism bot mention', async () => {
      const response = await request(app)
        .post(`/api/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          content: '@plagiarism-bot please help'
        });

      expect(response.status).toBe(201);

      // Wait for bot processing
      await new Promise(resolve => setTimeout(resolve, 100));

      // Check for bot response
      const messages = await prisma.message.findMany({
        where: { 
          conversationId,
          isBot: true
        },
        orderBy: { createdAt: 'desc' },
        take: 1
      });

      expect(messages).toHaveLength(1);
      expect(messages[0].content).toContain('Plagiarism Bot Help');
    });
  });

  describe('Bot Commands', () => {
    it('should execute editorial bot status command', async () => {
      const response = await request(app)
        .post(`/api/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          content: '@editorial-bot status UNDER_REVIEW reason="Ready for review"'
        });

      expect(response.status).toBe(201);

      // Wait for bot processing
      await new Promise(resolve => setTimeout(resolve, 100));

      // Check for bot response
      const messages = await prisma.message.findMany({
        where: { 
          conversationId,
          isBot: true
        },
        orderBy: { createdAt: 'desc' },
        take: 1
      });

      expect(messages).toHaveLength(1);
      expect(messages[0].content).toContain('Manuscript Status Updated');
      expect(messages[0].content).toContain('UNDER_REVIEW');
      expect(messages[0].content).toContain('Ready for review');
    });

    it('should execute plagiarism bot check command', async () => {
      const response = await request(app)
        .post(`/api/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          content: '@plagiarism-bot check threshold=0.1 databases=crossref,pubmed'
        });

      expect(response.status).toBe(201);

      // Wait for bot processing (plagiarism check has a delay)
      await new Promise(resolve => setTimeout(resolve, 2500));

      // Check for bot response
      const messages = await prisma.message.findMany({
        where: { 
          conversationId,
          isBot: true
        },
        orderBy: { createdAt: 'desc' },
        take: 1
      });

      expect(messages).toHaveLength(1);
      expect(messages[0].content).toContain('Plagiarism Check Complete');
      expect(messages[0].content).toContain('10.0%'); // threshold as percentage
    });
  });

  describe('Bot Name Resolution', () => {
    it('should resolve editorial-bot by exact ID', async () => {
      const response = await request(app)
        .post(`/api/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          content: '@editorial-bot help'
        });

      expect(response.status).toBe(201);

      await new Promise(resolve => setTimeout(resolve, 100));

      const messages = await prisma.message.findMany({
        where: { 
          conversationId,
          isBot: true
        },
        orderBy: { createdAt: 'desc' },
        take: 1
      });

      expect(messages[0].content).toContain('Editorial Bot Help');
    });

    it('should resolve editorial by first word match', async () => {
      const response = await request(app)
        .post(`/api/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          content: '@editorial help'
        });

      expect(response.status).toBe(201);

      await new Promise(resolve => setTimeout(resolve, 100));

      const messages = await prisma.message.findMany({
        where: { 
          conversationId,
          isBot: true
        },
        orderBy: { createdAt: 'desc' },
        take: 1
      });

      expect(messages[0].content).toContain('Editorial Bot Help');
    });

    it('should not respond to unknown bot names', async () => {
      const initialMessageCount = await prisma.message.count({
        where: { conversationId }
      });

      const response = await request(app)
        .post(`/api/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          content: '@unknown-bot help'
        });

      expect(response.status).toBe(201);

      await new Promise(resolve => setTimeout(resolve, 100));

      const finalMessageCount = await prisma.message.count({
        where: { conversationId }
      });

      // Should only have the user message, no bot response
      expect(finalMessageCount).toBe(initialMessageCount + 1);
    });
  });

  describe('Error Handling', () => {
    it('should handle unrecognized commands gracefully', async () => {
      const response = await request(app)
        .post(`/api/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          content: '@editorial-bot unknowncommand some parameters'
        });

      expect(response.status).toBe(201);

      await new Promise(resolve => setTimeout(resolve, 100));

      // Bot should still respond (likely with an error message or help)
      const messages = await prisma.message.findMany({
        where: { 
          conversationId,
          isBot: true
        },
        orderBy: { createdAt: 'desc' },
        take: 1
      });

      expect(messages).toHaveLength(1);
      // The bot should handle unrecognized commands gracefully
    });

    it('should handle invalid parameters gracefully', async () => {
      const response = await request(app)
        .post(`/api/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          content: '@editorial-bot status INVALID_STATUS'
        });

      expect(response.status).toBe(201);

      await new Promise(resolve => setTimeout(resolve, 100));

      const messages = await prisma.message.findMany({
        where: { 
          conversationId,
          isBot: true
        },
        orderBy: { createdAt: 'desc' },
        take: 1
      });

      expect(messages).toHaveLength(1);
      // Bot should respond with validation error or help
    });
  });

  describe('Multiple Bot Mentions', () => {
    it('should handle multiple bot mentions in one message', async () => {
      const response = await request(app)
        .post(`/api/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          content: '@editorial-bot help @plagiarism-bot help'
        });

      expect(response.status).toBe(201);

      // Wait for bot processing
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should have responses from both bots
      const messages = await prisma.message.findMany({
        where: { 
          conversationId,
          isBot: true
        },
        orderBy: { createdAt: 'desc' },
        take: 2
      });

      expect(messages).toHaveLength(2);
      
      // Check that we got responses from both bots
      const contents = messages.map((m: any) => m.content);
      expect(contents.some((content: string) => content.includes('Editorial Bot'))).toBe(true);
      expect(contents.some((content: string) => content.includes('Plagiarism Bot'))).toBe(true);
    });
  });
});