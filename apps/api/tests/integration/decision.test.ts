import request from 'supertest';
import app from '../../src/app';
import { prisma } from '@colloquium/database';
import jwt from 'jsonwebtoken';

describe('Simplified Editorial Decision Workflow', () => {
  let editorToken: string;
  let manuscriptId: string;
  let conversationId: string;
  let editorId: string;

  beforeAll(async () => {
    // Create test editor
    const editor = await prisma.users.create({
      data: {
        email: 'editor@test.com',
        username: 'test-editor',
        name: 'Test Editor',
        role: 'EDITOR_IN_CHIEF'
      }
    });
    editorId = editor.id;

    // Generate JWT token for editor
    editorToken = jwt.sign(
      { userId: editor.id, email: editor.email, role: editor.role },
      process.env.JWT_SECRET || 'test-secret'
    );

    // Create test manuscript
    const manuscript = await prisma.manuscripts.create({
      data: {
        title: 'Test Manuscript for Bot Decision Workflow',
        abstract: 'Test abstract',
        content: 'Test content',
        status: 'UNDER_REVIEW',
        authors: ['Test Author']
      }
    });
    manuscriptId = manuscript.id;

    // Create manuscript conversation
    const conversation = await prisma.conversations.create({
      data: {
        title: 'Manuscript Discussion',
        type: 'SEMI_PUBLIC',
        privacy: 'SEMI_PUBLIC',
        manuscriptId
      }
    });
    conversationId = conversation.id;

    // Add editor as participant
    await prisma.conversation_participants.create({
      data: {
        conversationId,
        userId: editorId,
        role: 'MODERATOR'
      }
    });

    // Create some mock completed reviews
    const reviewer1 = await prisma.users.create({
      data: {
        email: 'reviewer1@test.com',
        username: 'reviewer-one',
        name: 'Reviewer 1',
        role: 'USER'
      }
    });

    const reviewer2 = await prisma.users.create({
      data: {
        email: 'reviewer2@test.com',
        username: 'reviewer-two',
        name: 'Reviewer 2',
        role: 'USER'
      }
    });

    await prisma.review_assignments.create({
      data: {
        manuscriptId,
        reviewerId: reviewer1.id,
        status: 'COMPLETED',
        completedAt: new Date()
      }
    });

    await prisma.review_assignments.create({
      data: {
        manuscriptId,
        reviewerId: reviewer2.id,
        status: 'COMPLETED',
        completedAt: new Date()
      }
    });
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.messages.deleteMany({});
    await prisma.conversation_participants.deleteMany({});
    await prisma.conversations.deleteMany({});
    await prisma.review_assignments.deleteMany({});
    await prisma.manuscripts.deleteMany({});
    await prisma.users.deleteMany({});
  });

  describe('Bot-Only Decision Workflow', () => {
    it('should process decision command without additional parameters', async () => {
      // Add context messages to the conversation (like a discussion)
      await request(app)
        .post(`/api/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${editorToken}`)
        .send({
          content: 'The reviews are in. Both reviewers recommend acceptance with minor revisions. The methodology is sound and the findings are significant.'
        });

      // Make decision via bot command (simplified)
      const botCommand = '@bot-editorial decision accept';
      
      const response = await request(app)
        .post(`/api/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${editorToken}`)
        .send({
          content: botCommand,
          metadata: {
            type: 'bot_command',
            command: 'decision'
          }
        });

      expect(response.status).toBe(201);
      
      // Allow time for bot processing
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Verify manuscript status was updated
      const updatedManuscript = await prisma.manuscripts.findUnique({
        where: { id: manuscriptId }
      });
      expect(updatedManuscript?.status).toBe('ACCEPTED');
      expect(updatedManuscript?.publishedAt).toBeTruthy();
      
      // Verify bot response message was created
      const botMessages = await prisma.messages.findMany({
        where: {
          conversationId,
          isBot: true
        }
      });
      expect(botMessages.length).toBeGreaterThan(0);
      
      // Check for decision message
      const decisionMessage = botMessages.find(msg => 
        msg.content.includes('Editorial Decision: ACCEPT')
      );
      expect(decisionMessage).toBeTruthy();
    });

    it('should process revision decision and create revision conversation', async () => {
      // Create new manuscript for revision test
      const revisionManuscript = await prisma.manuscripts.create({
        data: {
          title: 'Revision Test Manuscript',
          abstract: 'Test abstract',
          content: 'Test content',
          status: 'UNDER_REVIEW',
          authors: ['Test Author']
        }
      });

      // Create conversation
      const revisionConversation = await prisma.conversations.create({
        data: {
          title: 'Revision Discussion',
          type: 'SEMI_PUBLIC',
          privacy: 'SEMI_PUBLIC',
          manuscriptId: revisionManuscript.id
        }
      });

      // Add editor as participant
      await prisma.conversation_participants.create({
        data: {
          conversationId: revisionConversation.id,
          userId: editorId,
          role: 'MODERATOR'
        }
      });

      // Add reasoning in conversation thread
      await request(app)
        .post(`/api/conversations/${revisionConversation.id}/messages`)
        .set('Authorization', `Bearer ${editorToken}`)
        .send({
          content: 'The paper has potential but needs minor revisions to the methodology section. Please address the statistical analysis and clarify the sampling method.'
        });

      // Make revision decision
      const botCommand = '@bot-editorial decision minor_revision';
      
      const response = await request(app)
        .post(`/api/conversations/${revisionConversation.id}/messages`)
        .set('Authorization', `Bearer ${editorToken}`)
        .send({
          content: botCommand,
          metadata: {
            type: 'bot_command',
            command: 'decision'
          }
        });

      expect(response.status).toBe(201);
      
      // Allow time for processing
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Verify manuscript status
      const updatedManuscript = await prisma.manuscripts.findUnique({
        where: { id: revisionManuscript.id }
      });
      expect(updatedManuscript?.status).toBe('REVISION_REQUESTED');
      
      // Check if revision conversation was created
      const revisionConversations = await prisma.conversations.findMany({
        where: {
          manuscriptId: revisionManuscript.id,
          title: { contains: 'Revision' }
        }
      });
      expect(revisionConversations.length).toBeGreaterThan(0);
    });

    it('should reject invalid decision types', async () => {
      const invalidCommand = '@bot-editorial decision invalid_decision';
      
      const response = await request(app)
        .post(`/api/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${editorToken}`)
        .send({
          content: invalidCommand,
          metadata: {
            type: 'bot_command',
            command: 'decision'
          }
        });

      // The message should be created but bot processing should fail gracefully
      expect(response.status).toBe(201);
      
      // Allow time for processing
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Check that an error or help message was posted by the bot
      const botMessages = await prisma.messages.findMany({
        where: {
          conversationId,
          isBot: true,
          content: { contains: 'invalid' }
        }
      });
      
      // Bot should respond with error or validation message
      expect(botMessages.length).toBeGreaterThan(0);
    });

    it('should show summary of available decisions', async () => {
      const summaryCommand = '@bot-editorial summary';
      
      const response = await request(app)
        .post(`/api/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${editorToken}`)
        .send({
          content: summaryCommand,
          metadata: {
            type: 'bot_command',
            command: 'summary'
          }
        });

      expect(response.status).toBe(201);
      
      // Allow time for processing
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Check for summary message
      const botMessages = await prisma.messages.findMany({
        where: {
          conversationId,
          isBot: true,
          content: { contains: 'Summary' }
        }
      });
      
      expect(botMessages.length).toBeGreaterThan(0);
    });
  });
});