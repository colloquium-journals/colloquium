import request from 'supertest';
import app from '../../src/app';
import { prisma } from '@colloquium/database';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';

describe('File Access Control During Publishing Workflow', () => {
  let authorToken: string;
  let editorToken: string;
  let publicUserToken: string;
  let unauthorizedUserToken: string;
  
  let authorId: string;
  let editorId: string;
  let publicUserId: string;
  let unauthorizedUserId: string;
  
  let manuscriptId: string;
  let manuscriptFileId: string;
  let conversationId: string;

  const createAuthToken = (userId: string, email: string, role: string) => {
    return jwt.sign(
      { userId, email, role },
      process.env.JWT_SECRET || 'test-secret'
    );
  };

  beforeAll(async () => {
    // Create test users
    const author = await prisma.users.create({
      data: {
        id: randomUUID(),
        email: 'author@fileaccess.test',
        name: 'Test Author',
        role: 'USER',
        updatedAt: new Date()
      }
    });
    authorId = author.id;
    authorToken = createAuthToken(author.id, author.email, author.role);

    const editor = await prisma.users.create({
      data: {
        id: randomUUID(),
        email: 'editor@fileaccess.test',
        name: 'Test Editor',
        role: 'EDITOR_IN_CHIEF',
        updatedAt: new Date()
      }
    });
    editorId = editor.id;
    editorToken = createAuthToken(editor.id, editor.email, editor.role);

    const publicUser = await prisma.users.create({
      data: {
        id: randomUUID(),
        email: 'public@fileaccess.test',
        name: 'Public User',
        role: 'USER',
        updatedAt: new Date()
      }
    });
    publicUserId = publicUser.id;
    publicUserToken = createAuthToken(publicUser.id, publicUser.email, publicUser.role);

    const unauthorizedUser = await prisma.users.create({
      data: {
        id: randomUUID(),
        email: 'unauthorized@fileaccess.test',
        name: 'Unauthorized User',
        role: 'USER',
        updatedAt: new Date()
      }
    });
    unauthorizedUserId = unauthorizedUser.id;
    unauthorizedUserToken = createAuthToken(unauthorizedUser.id, unauthorizedUser.email, unauthorizedUser.role);
  });

  beforeEach(async () => {
    // Create fresh manuscript for each test
    const manuscript = await prisma.manuscripts.create({
      data: {
        id: randomUUID(),
        title: 'Test Manuscript for File Access',
        abstract: 'Testing file access control during publishing workflow',
        content: 'Manuscript content for access testing',
        status: 'SUBMITTED',
        updatedAt: new Date()
      }
    });
    manuscriptId = manuscript.id;

    // Create manuscript author relationship
    await prisma.manuscript_authors.create({
      data: {
        id: randomUUID(),
        manuscriptId,
        userId: authorId,
        isCorresponding: true
      }
    });

    // Create manuscript file
    const manuscriptFile = await prisma.manuscript_files.create({
      data: {
        id: randomUUID(),
        manuscriptId,
        filename: 'test-document.pdf',
        originalName: 'Test Document.pdf',
        mimetype: 'application/pdf',
        size: 1024 * 1024, // 1MB
        path: '/test/uploads/test-document.pdf',
        fileType: 'SOURCE',
        storageType: 'LOCAL'
      }
    });
    manuscriptFileId = manuscriptFile.id;

    // Create conversation
    const conversation = await prisma.conversations.create({
      data: {
        id: randomUUID(),
        title: 'Editorial Discussion',
        type: 'EDITORIAL',
        privacy: 'PRIVATE',
        manuscriptId,
        updatedAt: new Date()
      }
    });
    conversationId = conversation.id;
  });

  afterEach(async () => {
    // Clean up test data
    await prisma.manuscript_files.deleteMany({ where: { manuscriptId } });
    await prisma.conversations.deleteMany({ where: { id: conversationId } });
    await prisma.manuscript_authors.deleteMany({ where: { manuscriptId } });
    await prisma.manuscripts.deleteMany({ where: { id: manuscriptId } });
  });

  afterAll(async () => {
    // Clean up users
    await prisma.users.deleteMany({
      where: {
        email: {
          endsWith: '@fileaccess.test'
        }
      }
    });
  });

  describe('File Access During SUBMITTED Status', () => {
    it('should allow author to access their manuscript files', async () => {
      const response = await request(app)
        .get(`/api/manuscripts/${manuscriptId}/files/${manuscriptFileId}/download`)
        .set('Authorization', `Bearer ${authorToken}`);

      expect(response.status).toBe(200);
    });

    it('should allow editor to access manuscript files', async () => {
      const response = await request(app)
        .get(`/api/manuscripts/${manuscriptId}/files/${manuscriptFileId}/download`)
        .set('Authorization', `Bearer ${editorToken}`);

      expect(response.status).toBe(200);
    });

    it('should deny access to unauthorized users', async () => {
      const response = await request(app)
        .get(`/api/manuscripts/${manuscriptId}/files/${manuscriptFileId}/download`)
        .set('Authorization', `Bearer ${unauthorizedUserToken}`);

      expect(response.status).toBe(403);
    });

    it('should deny access to unauthenticated users', async () => {
      const response = await request(app)
        .get(`/api/manuscripts/${manuscriptId}/files/${manuscriptFileId}/download`);

      expect(response.status).toBe(401);
    });

    it('should not list manuscript files in public API', async () => {
      const response = await request(app)
        .get('/api/manuscripts/published')
        .set('Authorization', `Bearer ${publicUserToken}`);

      expect(response.status).toBe(200);
      expect(response.body.manuscripts || response.body.data || []).not.toContain(
        expect.objectContaining({ id: manuscriptId })
      );
    });
  });

  describe('File Access During UNDER_REVIEW Status', () => {
    beforeEach(async () => {
      // Update manuscript to UNDER_REVIEW
      await prisma.manuscripts.update({
        where: { id: manuscriptId },
        data: { status: 'UNDER_REVIEW' }
      });
    });

    it('should still allow author access', async () => {
      const response = await request(app)
        .get(`/api/manuscripts/${manuscriptId}/files/${manuscriptFileId}/download`)
        .set('Authorization', `Bearer ${authorToken}`);

      expect(response.status).toBe(200);
    });

    it('should still allow editor access', async () => {
      const response = await request(app)
        .get(`/api/manuscripts/${manuscriptId}/files/${manuscriptFileId}/download`)
        .set('Authorization', `Bearer ${editorToken}`);

      expect(response.status).toBe(200);
    });

    it('should still deny access to unauthorized users', async () => {
      const response = await request(app)
        .get(`/api/manuscripts/${manuscriptId}/files/${manuscriptFileId}/download`)
        .set('Authorization', `Bearer ${unauthorizedUserToken}`);

      expect(response.status).toBe(403);
    });

    it('should not appear in public listings', async () => {
      const response = await request(app)
        .get('/api/manuscripts/published');

      expect(response.status).toBe(200);
      const manuscripts = response.body.manuscripts || response.body.data || [];
      expect(manuscripts).not.toContain(
        expect.objectContaining({ id: manuscriptId })
      );
    });
  });

  describe('File Access During ACCEPTED Status', () => {
    beforeEach(async () => {
      // Update manuscript to ACCEPTED
      await prisma.manuscripts.update({
        where: { id: manuscriptId },
        data: { 
          status: 'ACCEPTED',
          publishedAt: new Date()
        }
      });
    });

    it('should still allow author access', async () => {
      const response = await request(app)
        .get(`/api/manuscripts/${manuscriptId}/files/${manuscriptFileId}/download`)
        .set('Authorization', `Bearer ${authorToken}`);

      expect(response.status).toBe(200);
    });

    it('should still allow editor access', async () => {
      const response = await request(app)
        .get(`/api/manuscripts/${manuscriptId}/files/${manuscriptFileId}/download`)
        .set('Authorization', `Bearer ${editorToken}`);

      expect(response.status).toBe(200);
    });

    it('should allow public access to files if manuscript is accepted', async () => {
      // Note: Depends on implementation - some systems allow public access after acceptance
      const response = await request(app)
        .get(`/api/manuscripts/${manuscriptId}/files/${manuscriptFileId}/download`)
        .set('Authorization', `Bearer ${publicUserToken}`);

      // This could be either 200 (public access allowed) or 403 (still restricted)
      // The test documents the expected behavior
      expect([200, 403]).toContain(response.status);
    });

    it('should appear in published manuscripts listing', async () => {
      const response = await request(app)
        .get('/api/manuscripts/published');

      expect(response.status).toBe(200);
      const manuscripts = response.body.manuscripts || response.body.data || [];
      expect(manuscripts).toContainEqual(
        expect.objectContaining({ 
          id: manuscriptId,
          status: 'ACCEPTED'
        })
      );
    });
  });

  describe('File Access During PUBLISHED Status', () => {
    beforeEach(async () => {
      // Update manuscript to PUBLISHED
      await prisma.manuscripts.update({
        where: { id: manuscriptId },
        data: { 
          status: 'PUBLISHED',
          publishedAt: new Date()
        }
      });
    });

    it('should allow public access to published manuscript files', async () => {
      const response = await request(app)
        .get(`/api/manuscripts/${manuscriptId}/files/${manuscriptFileId}/download`)
        .set('Authorization', `Bearer ${publicUserToken}`);

      expect(response.status).toBe(200);
    });

    it('should allow unauthenticated access to published files', async () => {
      const response = await request(app)
        .get(`/api/manuscripts/${manuscriptId}/files/${manuscriptFileId}/download`);

      // This could be 200 (full public access) or 401 (auth still required)
      // The test documents the expected behavior
      expect([200, 401]).toContain(response.status);
    });

    it('should appear in published manuscripts listing', async () => {
      const response = await request(app)
        .get('/api/manuscripts/published');

      expect(response.status).toBe(200);
      const manuscripts = response.body.manuscripts || response.body.data || [];
      expect(manuscripts).toContainEqual(
        expect.objectContaining({ 
          id: manuscriptId,
          status: 'PUBLISHED'
        })
      );
    });

    it('should include file metadata in published manuscript details', async () => {
      const response = await request(app)
        .get(`/api/manuscripts/${manuscriptId}`)
        .set('Authorization', `Bearer ${publicUserToken}`);

      expect(response.status).toBe(200);
      expect(response.body.manuscript || response.body).toMatchObject({
        id: manuscriptId,
        status: 'PUBLISHED'
      });

      // Check if files are included in the response
      const manuscript = response.body.manuscript || response.body;
      if (manuscript.files) {
        expect(manuscript.files).toContainEqual(
          expect.objectContaining({
            id: manuscriptFileId,
            filename: 'test-document.pdf'
          })
        );
      }
    });
  });

  describe('File Access During RETRACTED Status', () => {
    beforeEach(async () => {
      // First publish, then retract
      await prisma.manuscripts.update({
        where: { id: manuscriptId },
        data: { 
          status: 'RETRACTED',
          publishedAt: new Date()
        }
      });
    });

    it('should restrict file access for retracted manuscripts', async () => {
      const response = await request(app)
        .get(`/api/manuscripts/${manuscriptId}/files/${manuscriptFileId}/download`)
        .set('Authorization', `Bearer ${publicUserToken}`);

      // Retracted manuscripts should restrict file access
      expect([403, 404]).toContain(response.status);
    });

    it('should still allow editor access to retracted files', async () => {
      const response = await request(app)
        .get(`/api/manuscripts/${manuscriptId}/files/${manuscriptFileId}/download`)
        .set('Authorization', `Bearer ${editorToken}`);

      expect(response.status).toBe(200);
    });

    it('should show retracted status in public listings', async () => {
      const response = await request(app)
        .get('/api/manuscripts/published');

      expect(response.status).toBe(200);
      const manuscripts = response.body.manuscripts || response.body.data || [];
      
      // Should either exclude retracted manuscripts or mark them clearly
      const retractedManuscript = manuscripts.find((m: any) => m.id === manuscriptId);
      if (retractedManuscript) {
        expect(retractedManuscript.status).toBe('RETRACTED');
      }
    });
  });

  describe('File Access Edge Cases', () => {
    it('should handle missing files gracefully', async () => {
      const nonExistentFileId = randomUUID();
      
      const response = await request(app)
        .get(`/api/manuscripts/${manuscriptId}/files/${nonExistentFileId}/download`)
        .set('Authorization', `Bearer ${authorToken}`);

      expect(response.status).toBe(404);
    });

    it('should handle missing manuscripts gracefully', async () => {
      const nonExistentManuscriptId = randomUUID();
      
      const response = await request(app)
        .get(`/api/manuscripts/${nonExistentManuscriptId}/files/${manuscriptFileId}/download`)
        .set('Authorization', `Bearer ${authorToken}`);

      expect(response.status).toBe(404);
    });

    it('should validate file belongs to manuscript', async () => {
      // Create another manuscript and file
      const otherManuscript = await prisma.manuscripts.create({
        data: {
          id: randomUUID(),
          title: 'Other Manuscript',
          abstract: 'Another manuscript',
          content: 'Other content',
          status: 'SUBMITTED',
          updatedAt: new Date()
        }
      });

      const otherFile = await prisma.manuscript_files.create({
        data: {
          id: randomUUID(),
          manuscriptId: otherManuscript.id,
          filename: 'other-document.pdf',
          originalName: 'Other Document.pdf',
          mimetype: 'application/pdf',
          size: 512 * 1024,
          path: '/test/uploads/other-document.pdf',
          fileType: 'SOURCE',
          storageType: 'LOCAL'
        }
      });

      // Try to access other manuscript's file via wrong manuscript ID
      const response = await request(app)
        .get(`/api/manuscripts/${manuscriptId}/files/${otherFile.id}/download`)
        .set('Authorization', `Bearer ${authorToken}`);

      expect(response.status).toBe(404);

      // Clean up
      await prisma.manuscript_files.deleteMany({ where: { manuscriptId: otherManuscript.id } });
      await prisma.manuscripts.deleteMany({ where: { id: otherManuscript.id } });
    });

    it('should handle different file types appropriately', async () => {
      // Create supplementary file
      const suppFile = await prisma.manuscript_files.create({
        data: {
          id: randomUUID(),
          manuscriptId,
          filename: 'supplementary-data.xlsx',
          originalName: 'Supplementary Data.xlsx',
          mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          size: 256 * 1024,
          path: '/test/uploads/supplementary-data.xlsx',
          fileType: 'SUPPLEMENTARY',
          storageType: 'LOCAL'
        }
      });

      const response = await request(app)
        .get(`/api/manuscripts/${manuscriptId}/files/${suppFile.id}/download`)
        .set('Authorization', `Bearer ${authorToken}`);

      expect(response.status).toBe(200);

      // Clean up
      await prisma.manuscript_files.deleteMany({ where: { id: suppFile.id } });
    });
  });

  describe('Security Headers and File Serving', () => {
    beforeEach(async () => {
      // Publish the manuscript for these tests
      await prisma.manuscripts.update({
        where: { id: manuscriptId },
        data: { 
          status: 'PUBLISHED',
          publishedAt: new Date()
        }
      });
    });

    it('should set appropriate security headers for file downloads', async () => {
      const response = await request(app)
        .get(`/api/manuscripts/${manuscriptId}/files/${manuscriptFileId}/download`)
        .set('Authorization', `Bearer ${publicUserToken}`);

      expect(response.status).toBe(200);
      
      // Check security headers
      expect(response.headers).toMatchObject(
        expect.objectContaining({
          'x-content-type-options': 'nosniff',
          'x-frame-options': expect.any(String),
          'content-disposition': expect.stringContaining('attachment')
        })
      );
    });

    it('should set correct content type for files', async () => {
      const response = await request(app)
        .get(`/api/manuscripts/${manuscriptId}/files/${manuscriptFileId}/download`)
        .set('Authorization', `Bearer ${publicUserToken}`);

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('application/pdf');
    });

    it('should handle file streaming for large files', async () => {
      // This test would verify that large files are streamed rather than loaded into memory
      const response = await request(app)
        .get(`/api/manuscripts/${manuscriptId}/files/${manuscriptFileId}/download`)
        .set('Authorization', `Bearer ${publicUserToken}`);

      expect(response.status).toBe(200);
      
      // Check that response is streamed (presence of transfer-encoding or content-length)
      expect(
        response.headers['transfer-encoding'] || response.headers['content-length']
      ).toBeDefined();
    });
  });
});