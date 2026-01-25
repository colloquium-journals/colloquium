import request from 'supertest';
import app from '../../src/app';
import { prisma } from '@colloquium/database';
import jwt from 'jsonwebtoken';

describe('Editorial Bot - Status Transition Integration Tests', () => {
  let editorToken: string;
  let editorId: string;
  let articleId: string;
  let conversationId: string;

  beforeAll(async () => {
    // Create test editor
    const editor = await prisma.users.create({
      data: {
        email: 'editor@colloquium.test',
        username: 'editorial-test-editor',
        name: 'Editorial Bot Test Editor',
        role: 'EDITOR_IN_CHIEF'
      }
    });
    editorId = editor.id;

    // Generate JWT token for editor
    editorToken = jwt.sign(
      { userId: editor.id, email: editor.email, role: editor.role },
      process.env.JWT_SECRET || 'test-secret'
    );
  });

  beforeEach(async () => {
    // Create fresh article for each test
    const article = await prisma.article.create({
      data: {
        title: 'Test Article for Status Transitions',
        abstract: 'Abstract for status transition testing',
        content: 'Content for testing editorial bot status changes',
        status: 'UNDER_REVIEW',
        authors: ['Test Author']
      }
    });
    articleId = article.id;

    // Create article conversation
    const conversation = await prisma.conversations.create({
      data: {
        title: 'Editorial Discussion',
        type: 'SEMI_PUBLIC',
        privacy: 'SEMI_PUBLIC',
        articleId
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
  });

  afterEach(async () => {
    // Clean up test data
    await prisma.messages.deleteMany({
      where: { conversationId }
    });
    await prisma.conversation_participants.deleteMany({
      where: { conversationId }
    });
    await prisma.conversations.deleteMany({
      where: { id: conversationId }
    });
    await prisma.article.deleteMany({
      where: { id: articleId }
    });
  });

  afterAll(async () => {
    // Clean up editor
    await prisma.users.deleteMany({
      where: { email: 'editor@colloquium.test' }
    });
  });

  describe('Editorial Decision to Acceptance Workflow', () => {
    it('should accept article and set publishedAt date', async () => {
      // Post editorial decision to accept
      const decisionResponse = await request(app)
        .post(`/api/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${editorToken}`)
        .send({
          content: '@bot-editorial decision accept reason="Excellent research quality and methodology"',
          metadata: {
            type: 'bot_command',
            command: 'decision'
          }
        });

      expect(decisionResponse.status).toBe(201);

      // Allow time for bot processing
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Verify article status was updated to ACCEPTED
      const updatedArticle = await prisma.article.findUnique({
        where: { id: articleId }
      });

      expect(updatedArticle).toBeDefined();
      expect(updatedArticle!.status).toBe('ACCEPTED');
      expect(updatedArticle!.publishedAt).toBeTruthy();

      // Verify bot response message was created
      const botMessages = await prisma.messages.findMany({
        where: {
          conversationId,
          isBot: true,
          content: { contains: 'Editorial Decision: ACCEPT' }
        }
      });

      expect(botMessages).toHaveLength(1);
      expect(botMessages[0].content).toContain('Article Accepted for Publication');
      expect(botMessages[0].content).toContain('ACCEPTED');
    });

    it('should reject article correctly', async () => {
      const decisionResponse = await request(app)
        .post(`/api/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${editorToken}`)
        .send({
          content: '@bot-editorial decision reject reason="Insufficient methodology"'
        });

      expect(decisionResponse.status).toBe(201);
      await new Promise(resolve => setTimeout(resolve, 1000));

      const updatedArticle = await prisma.article.findUnique({
        where: { id: articleId }
      });

      expect(updatedArticle!.status).toBe('REJECTED');
      expect(updatedArticle!.publishedAt).toBeNull();

      const botMessages = await prisma.messages.findMany({
        where: {
          conversationId,
          isBot: true,
          content: { contains: 'Editorial Decision: REJECT' }
        }
      });

      expect(botMessages).toHaveLength(1);
      expect(botMessages[0].content).toContain('REJECTED');
    });
  });

  describe('Status Command - Publication Workflow', () => {
    it('should publish article using status command', async () => {
      // First set article to ACCEPTED status
      await prisma.article.update({
        where: { id: articleId },
        data: { status: 'ACCEPTED' }
      });

      // Post status command to publish
      const statusResponse = await request(app)
        .post(`/api/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${editorToken}`)
        .send({
          content: '@bot-editorial status PUBLISHED reason="All editorial requirements met"'
        });

      expect(statusResponse.status).toBe(201);
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Verify article status was updated to PUBLISHED
      const publishedArticle = await prisma.article.findUnique({
        where: { id: articleId }
      });

      expect(publishedArticle).toBeDefined();
      expect(publishedArticle!.status).toBe('PUBLISHED');

      // Verify bot response message contains publication confirmation
      const botMessages = await prisma.messages.findMany({
        where: {
          conversationId,
          isBot: true,
          content: { contains: 'Article published! Now available to the public' }
        }
      });

      expect(botMessages).toHaveLength(1);
      expect(botMessages[0].content).toContain('📚');
      expect(botMessages[0].content).toContain('PUBLISHED');
      expect(botMessages[0].content).toContain('All editorial requirements met');
    });

    it('should reject direct publication from UNDER_REVIEW (validation test)', async () => {
      const statusResponse = await request(app)
        .post(`/api/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${editorToken}`)
        .send({
          content: '@bot-editorial status PUBLISHED reason="Fast-track publication approved"'
        });

      expect(statusResponse.status).toBe(201);
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Article status should remain unchanged due to validation
      const unchangedArticle = await prisma.article.findUnique({
        where: { id: articleId }
      });

      expect(unchangedArticle!.status).toBe('UNDER_REVIEW'); // Should not change

      // Should have an error message from the bot
      const errorMessages = await prisma.messages.findMany({
        where: {
          conversationId,
          isBot: true,
          content: { contains: 'Cannot publish article' }
        }
      });

      expect(errorMessages.length).toBeGreaterThan(0);
    });

    it('should reject publication from REVISION_REQUESTED status', async () => {
      // Set initial status to revision requested
      await prisma.article.update({
        where: { id: articleId },
        data: { status: 'REVISION_REQUESTED' }
      });

      const statusResponse = await request(app)
        .post(`/api/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${editorToken}`)
        .send({
          content: '@bot-editorial status PUBLISHED reason="Revisions completed satisfactorily"'
        });

      expect(statusResponse.status).toBe(201);
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Should remain in REVISION_REQUESTED due to validation
      const unchangedArticle = await prisma.article.findUnique({
        where: { id: articleId }
      });

      expect(unchangedArticle!.status).toBe('REVISION_REQUESTED');
    });

    it('should allow rejection from any status', async () => {
      const statusResponse = await request(app)
        .post(`/api/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${editorToken}`)
        .send({
          content: '@bot-editorial status REJECTED reason="Insufficient methodology"'
        });

      expect(statusResponse.status).toBe(201);
      await new Promise(resolve => setTimeout(resolve, 1000));

      const rejectedArticle = await prisma.article.findUnique({
        where: { id: articleId }
      });

      expect(rejectedArticle!.status).toBe('REJECTED');

      const botMessages = await prisma.messages.findMany({
        where: {
          conversationId,
          isBot: true,
          content: { contains: 'REJECTED' }
        }
      });

      expect(botMessages).toHaveLength(1);
      expect(botMessages[0].content).toContain('Insufficient methodology');
    });

    it('should allow retracting from PUBLISHED status', async () => {
      // First publish the article
      await prisma.article.update({
        where: { id: articleId },
        data: { status: 'PUBLISHED' }
      });

      const statusResponse = await request(app)
        .post(`/api/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${editorToken}`)
        .send({
          content: '@bot-editorial status RETRACTED reason="Data integrity issues discovered"'
        });

      expect(statusResponse.status).toBe(201);
      await new Promise(resolve => setTimeout(resolve, 1000));

      const retractedArticle = await prisma.article.findUnique({
        where: { id: articleId }
      });

      expect(retractedArticle!.status).toBe('RETRACTED');

      const botMessages = await prisma.messages.findMany({
        where: {
          conversationId,
          isBot: true,
          content: { contains: 'RETRACTED' }
        }
      });

      expect(botMessages).toHaveLength(1);
      expect(botMessages[0].content).toContain('🚫 Article retracted! No longer available to the public.');
      expect(botMessages[0].content).toContain('Data integrity issues discovered');
    });

    it('should reject retracting from non-PUBLISHED status', async () => {
      // Ensure article is not in PUBLISHED status
      await prisma.article.update({
        where: { id: articleId },
        data: { status: 'ACCEPTED' }
      });

      const statusResponse = await request(app)
        .post(`/api/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${editorToken}`)
        .send({
          content: '@bot-editorial status RETRACTED reason="Attempting to retract non-published paper"'
        });

      expect(statusResponse.status).toBe(201);
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Should remain in ACCEPTED due to validation
      const unchangedArticle = await prisma.article.findUnique({
        where: { id: articleId }
      });

      expect(unchangedArticle!.status).toBe('ACCEPTED');

      // Should have an error message from the bot
      const errorMessages = await prisma.messages.findMany({
        where: {
          conversationId,
          isBot: true,
          content: { contains: 'Cannot retract article' }
        }
      });

      expect(errorMessages.length).toBeGreaterThan(0);
    });
  });

  describe('RETRACTED Article Visibility', () => {
    it('should show RETRACTED articles in public listings', async () => {
      // First publish a article, then retract it
      await prisma.article.update({
        where: { id: articleId },
        data: { status: 'PUBLISHED' }
      });

      // Retract the article
      const retractResponse = await request(app)
        .post(`/api/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${editorToken}`)
        .send({
          content: '@bot-editorial status RETRACTED reason="Data integrity concerns"'
        });

      expect(retractResponse.status).toBe(201);
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Verify article is retracted
      const retractedArticle = await prisma.article.findUnique({
        where: { id: articleId }
      });
      expect(retractedArticle!.status).toBe('RETRACTED');

      // Test public listings (without authentication)
      const publicListResponse = await request(app)
        .get('/api/articles')
        .query({ status: 'ALL' });

      expect(publicListResponse.status).toBe(200);
      const publicData = publicListResponse.body;
      
      // RETRACTED article should appear in public listings
      const retractedInList = publicData.articles.find((m: any) => m.id === articleId);
      expect(retractedInList).toBeDefined();
      expect(retractedInList.status).toBe('RETRACTED');
    });

    it('should show RETRACTED articles in search results', async () => {
      // Ensure article is retracted
      await prisma.article.update({
        where: { id: articleId },
        data: { status: 'RETRACTED' }
      });

      // Search for the article by title
      const article = await prisma.article.findUnique({
        where: { id: articleId }
      });

      const searchResponse = await request(app)
        .get('/api/articles')
        .query({ 
          search: article!.title.split(' ')[0], // Search by first word of title
          status: 'ALL'
        });

      expect(searchResponse.status).toBe(200);
      const searchData = searchResponse.body;
      
      // RETRACTED article should appear in search results
      const foundArticle = searchData.articles.find((m: any) => m.id === articleId);
      expect(foundArticle).toBeDefined();
      expect(foundArticle.status).toBe('RETRACTED');
    });

    it('should allow public access to individual RETRACTED article details', async () => {
      // Ensure article is retracted
      await prisma.article.update({
        where: { id: articleId },
        data: { status: 'RETRACTED' }
      });

      // Access article details without authentication
      const detailResponse = await request(app)
        .get(`/api/articles/${articleId}`);

      expect(detailResponse.status).toBe(200);
      const articleData = detailResponse.body;
      
      expect(articleData.id).toBe(articleId);
      expect(articleData.status).toBe('RETRACTED');
      expect(articleData.title).toBeDefined();
      expect(articleData.abstract).toBeDefined();
    });

    it('should exclude RETRACTED articles when specifically requesting PUBLISHED only', async () => {
      // Ensure article is retracted
      await prisma.article.update({
        where: { id: articleId },
        data: { status: 'RETRACTED' }
      });

      // Request only PUBLISHED articles
      const publishedOnlyResponse = await request(app)
        .get('/api/articles')
        .query({ status: 'PUBLISHED' });

      expect(publishedOnlyResponse.status).toBe(200);
      const publishedData = publishedOnlyResponse.body;
      
      // RETRACTED article should NOT appear when filtering for PUBLISHED only
      const retractedInPublished = publishedData.articles.find((m: any) => m.id === articleId);
      expect(retractedInPublished).toBeUndefined();
    });
  });

  describe('Complete Editorial Workflow - Accept then Publish', () => {
    it('should demonstrate full workflow: accept decision -> publish status', async () => {
      // Step 1: Editorial decision to accept
      const decisionResponse = await request(app)
        .post(`/api/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${editorToken}`)
        .send({
          content: '@bot-editorial decision accept reason="Comprehensive research with strong methodology"'
        });

      expect(decisionResponse.status).toBe(201);
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Verify acceptance
      let article = await prisma.article.findUnique({
        where: { id: articleId }
      });
      expect(article!.status).toBe('ACCEPTED');

      // Step 2: Status update to published
      const publishResponse = await request(app)
        .post(`/api/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${editorToken}`)
        .send({
          content: '@bot-editorial status PUBLISHED reason="Ready for public distribution"'
        });

      expect(publishResponse.status).toBe(201);
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Verify publication
      article = await prisma.article.findUnique({
        where: { id: articleId }
      });
      expect(article!.status).toBe('PUBLISHED');

      // Verify both bot messages were created
      const allBotMessages = await prisma.messages.findMany({
        where: {
          conversationId,
          isBot: true
        },
        orderBy: { createdAt: 'asc' }
      });

      expect(allBotMessages).toHaveLength(2);
      expect(allBotMessages[0].content).toContain('Editorial Decision: ACCEPT');
      expect(allBotMessages[1].content).toContain('Article published!');
    });

    it('should handle revision workflow correctly', async () => {
      // Decision: minor revision
      const revisionResponse = await request(app)
        .post(`/api/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${editorToken}`)
        .send({
          content: '@bot-editorial decision minor_revision reason="Minor methodology clarifications needed"'
        });

      expect(revisionResponse.status).toBe(201);
      await new Promise(resolve => setTimeout(resolve, 1000));

      let article = await prisma.article.findUnique({
        where: { id: articleId }
      });
      expect(article!.status).toBe('REVISION_REQUESTED');

      // Later: direct publication after revisions
      const publishResponse = await request(app)
        .post(`/api/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${editorToken}`)
        .send({
          content: '@bot-editorial status PUBLISHED reason="Revisions completed and approved"'
        });

      expect(publishResponse.status).toBe(201);
      await new Promise(resolve => setTimeout(resolve, 1000));

      article = await prisma.article.findUnique({
        where: { id: articleId }
      });
      expect(article!.status).toBe('PUBLISHED');
    });
  });

  describe('Status Validation and Error Handling', () => {
    it('should handle invalid status gracefully', async () => {
      const invalidResponse = await request(app)
        .post(`/api/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${editorToken}`)
        .send({
          content: '@bot-editorial status INVALID_STATUS'
        });

      expect(invalidResponse.status).toBe(201);
      await new Promise(resolve => setTimeout(resolve, 500));

      // Article status should remain unchanged
      const article = await prisma.article.findUnique({
        where: { id: articleId }
      });
      expect(article!.status).toBe('UNDER_REVIEW');

      // Bot should respond with error message
      const errorMessages = await prisma.messages.findMany({
        where: {
          conversationId,
          isBot: true,
          content: { contains: 'invalid' }
        }
      });
      expect(errorMessages.length).toBeGreaterThan(0);
    });

    it('should handle valid status transitions with proper validation', async () => {
      // Test transitions that should always work
      const unconditionalStatuses = ['SUBMITTED', 'UNDER_REVIEW', 'REVISION_REQUESTED', 'REVISED', 'ACCEPTED', 'REJECTED'];
      
      for (const status of unconditionalStatuses) {
        const response = await request(app)
          .post(`/api/conversations/${conversationId}/messages`)
          .set('Authorization', `Bearer ${editorToken}`)
          .send({
            content: `@bot-editorial status ${status} reason="Testing ${status} transition"`
          });

        expect(response.status).toBe(201);
        await new Promise(resolve => setTimeout(resolve, 300));

        const article = await prisma.article.findUnique({
          where: { id: articleId }
        });
        expect(article!.status).toBe(status);
      }

      // Test PUBLISHED (only works from ACCEPTED)
      await prisma.article.update({
        where: { id: articleId },
        data: { status: 'ACCEPTED' }
      });

      const publishResponse = await request(app)
        .post(`/api/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${editorToken}`)
        .send({
          content: `@bot-editorial status PUBLISHED reason="Testing PUBLISHED transition"`
        });

      expect(publishResponse.status).toBe(201);
      await new Promise(resolve => setTimeout(resolve, 300));

      let article = await prisma.article.findUnique({
        where: { id: articleId }
      });
      expect(article!.status).toBe('PUBLISHED');

      // Test RETRACTED (only works from PUBLISHED)
      const retractResponse = await request(app)
        .post(`/api/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${editorToken}`)
        .send({
          content: `@bot-editorial status RETRACTED reason="Testing RETRACTED transition"`
        });

      expect(retractResponse.status).toBe(201);
      await new Promise(resolve => setTimeout(resolve, 300));

      article = await prisma.article.findUnique({
        where: { id: articleId }
      });
      expect(article!.status).toBe('RETRACTED');
    });
  });

  describe('Message Content and Formatting', () => {
    it('should include article ID in status update messages', async () => {
      const statusResponse = await request(app)
        .post(`/api/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${editorToken}`)
        .send({
          content: '@bot-editorial status PUBLISHED'
        });

      expect(statusResponse.status).toBe(201);
      await new Promise(resolve => setTimeout(resolve, 1000));

      const botMessages = await prisma.messages.findMany({
        where: {
          conversationId,
          isBot: true
        }
      });

      expect(botMessages[0].content).toContain(articleId);
    });

    it('should format PUBLISHED status with special emoji and text', async () => {
      const statusResponse = await request(app)
        .post(`/api/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${editorToken}`)
        .send({
          content: '@bot-editorial status PUBLISHED reason="Final publication ready"'
        });

      expect(statusResponse.status).toBe(201);
      await new Promise(resolve => setTimeout(resolve, 1000));

      const botMessages = await prisma.messages.findMany({
        where: {
          conversationId,
          isBot: true,
          content: { contains: 'Article published!' }
        }
      });

      expect(botMessages).toHaveLength(1);
      expect(botMessages[0].content).toContain('📚');
      expect(botMessages[0].content).toContain('Now available to the public');
      expect(botMessages[0].content).toContain('Final publication ready');
    });
  });
});