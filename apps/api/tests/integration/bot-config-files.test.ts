import request from 'supertest';
import app from '../../src/app';
import { prisma } from '@colloquium/database';
import fs from 'fs-extra';
import path from 'path';
import { createTestUser, createTestBot, getAuthCookie, cleanupTestData } from '../utils/testUtils';

// Skip: requires test database connection setup (testUtils functions are not implemented)
describe.skip('Bot Config Files API', () => {
  let testUser: any;
  let testBot: any;
  let authCookie: string;
  let uploadDir: string;

  beforeAll(async () => {
    uploadDir = path.join(__dirname, '../../test-uploads');
    await fs.ensureDir(uploadDir);
    process.env.BOT_CONFIG_UPLOAD_DIR = uploadDir;
  });

  afterAll(async () => {
    // Clean up test uploads
    await fs.remove(uploadDir).catch(() => {});
  });

  beforeEach(async () => {
    await cleanupTestData();
    
    testUser = await createTestUser('admin@test.com', 'ADMIN');
    testBot = await createTestBot('test-bot', 'Test Bot', '1.0.0');
    authCookie = await getAuthCookie(testUser.id);
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  describe('POST /api/bot-config-files/:botId/files', () => {
    it('should upload a file successfully', async () => {
      const testFilePath = path.join(__dirname, '../fixtures/test-template.html');
      await fs.writeFile(testFilePath, '<html><body>Test template</body></html>');

      const response = await request(app)
        .post(`/api/bot-config-files/${testBot.id}/files`)
        .set('Cookie', authCookie)
        .attach('file', testFilePath)
        .field('category', 'template')
        .field('description', 'Test HTML template');

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.file).toMatchObject({
        filename: 'test-template.html',
        category: 'template',
        description: 'Test HTML template',
        mimetype: 'text/html'
      });

      // Verify file was stored in database
      const dbFile = await prisma.bot_config_files.findFirst({
        where: { botId: testBot.id }
      });
      expect(dbFile).toBeTruthy();
      expect(dbFile!.filename).toBe('test-template.html');

      // Clean up
      await fs.remove(testFilePath);
    });

    it('should reject upload from non-admin user', async () => {
      const regularUser = await createTestUser('user@test.com', 'USER');
      const userCookie = await getAuthCookie(regularUser.id);
      
      const testFilePath = path.join(__dirname, '../fixtures/test-file.txt');
      await fs.writeFile(testFilePath, 'test content');

      const response = await request(app)
        .post(`/api/bot-config-files/${testBot.id}/files`)
        .set('Cookie', userCookie)
        .attach('file', testFilePath)
        .field('category', 'general');

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Insufficient permissions');

      // Clean up
      await fs.remove(testFilePath);
    });

    it('should reject unsupported file types', async () => {
      const testFilePath = path.join(__dirname, '../fixtures/test-file.exe');
      await fs.writeFile(testFilePath, Buffer.from([0x4D, 0x5A])); // MZ header for .exe

      const response = await request(app)
        .post(`/api/bot-config-files/${testBot.id}/files`)
        .set('Cookie', authCookie)
        .attach('file', testFilePath)
        .field('category', 'general');

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('not allowed');

      // Clean up
      await fs.remove(testFilePath);
    });

    it('should prevent duplicate filenames in same category', async () => {
      const testFilePath = path.join(__dirname, '../fixtures/duplicate.html');
      await fs.writeFile(testFilePath, '<html>test</html>');

      // Upload first file
      await request(app)
        .post(`/api/bot-config-files/${testBot.id}/files`)
        .set('Cookie', authCookie)
        .attach('file', testFilePath)
        .field('category', 'template');

      // Try to upload same filename in same category
      const response = await request(app)
        .post(`/api/bot-config-files/${testBot.id}/files`)
        .set('Cookie', authCookie)
        .attach('file', testFilePath)
        .field('category', 'template');

      expect(response.status).toBe(409);
      expect(response.body.error).toContain('already exists');

      // Clean up
      await fs.remove(testFilePath);
    });

    it('should allow same filename in different categories', async () => {
      const testFilePath = path.join(__dirname, '../fixtures/same-name.html');
      await fs.writeFile(testFilePath, '<html>test</html>');

      // Upload file in template category
      const response1 = await request(app)
        .post(`/api/bot-config-files/${testBot.id}/files`)
        .set('Cookie', authCookie)
        .attach('file', testFilePath)
        .field('category', 'template');

      expect(response1.status).toBe(201);

      // Upload same filename in different category
      const response2 = await request(app)
        .post(`/api/bot-config-files/${testBot.id}/files`)
        .set('Cookie', authCookie)
        .attach('file', testFilePath)
        .field('category', 'css');

      expect(response2.status).toBe(201);
      expect(response2.body.file.category).toBe('css');

      // Clean up
      await fs.remove(testFilePath);
    });
  });

  describe('GET /api/bot-config-files/:botId/files', () => {
    it('should list all files for a bot', async () => {
      // Create test files
      const file1 = await prisma.bot_config_files.create({
        data: {
          botId: testBot.id,
          filename: 'template.html',
          storedName: 'template-123.html',
          path: '/fake/path/template.html',
          mimetype: 'text/html',
          size: 1024,
          checksum: 'abc123',
          category: 'template',
          description: 'HTML template',
          uploadedBy: testUser.id
        }
      });

      const file2 = await prisma.bot_config_files.create({
        data: {
          botId: testBot.id,
          filename: 'styles.css',
          storedName: 'styles-456.css',
          path: '/fake/path/styles.css',
          mimetype: 'text/css',
          size: 512,
          checksum: 'def456',
          category: 'css',
          uploadedBy: testUser.id
        }
      });

      const response = await request(app)
        .get(`/api/bot-config-files/${testBot.id}/files`)
        .set('Cookie', authCookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.files).toHaveLength(2);
      expect(response.body.total).toBe(2);

      const filenames = response.body.files.map((f: any) => f.filename);
      expect(filenames).toContain('template.html');
      expect(filenames).toContain('styles.css');
    });

    it('should filter files by category', async () => {
      // Create test files in different categories
      await prisma.bot_config_files.create({
        data: {
          botId: testBot.id,
          filename: 'template.html',
          storedName: 'template-123.html',
          path: '/fake/path/template.html',
          mimetype: 'text/html',
          size: 1024,
          checksum: 'abc123',
          category: 'template',
          uploadedBy: testUser.id
        }
      });

      await prisma.bot_config_files.create({
        data: {
          botId: testBot.id,
          filename: 'styles.css',
          storedName: 'styles-456.css',
          path: '/fake/path/styles.css',
          mimetype: 'text/css',
          size: 512,
          checksum: 'def456',
          category: 'css',
          uploadedBy: testUser.id
        }
      });

      const response = await request(app)
        .get(`/api/bot-config-files/${testBot.id}/files?category=template`)
        .set('Cookie', authCookie);

      expect(response.status).toBe(200);
      expect(response.body.files).toHaveLength(1);
      expect(response.body.files[0].filename).toBe('template.html');
      expect(response.body.files[0].category).toBe('template');
    });
  });

  describe('DELETE /api/bot-config-files/:fileId', () => {
    it('should delete a file successfully', async () => {
      // Create test file on disk
      const testFilePath = path.join(uploadDir, 'test-delete.html');
      await fs.writeFile(testFilePath, '<html>test</html>');

      // Create file record
      const configFile = await prisma.bot_config_files.create({
        data: {
          botId: testBot.id,
          filename: 'test-delete.html',
          storedName: 'test-delete.html',
          path: testFilePath,
          mimetype: 'text/html',
          size: 18,
          checksum: 'abc123',
          category: 'template',
          uploadedBy: testUser.id
        }
      });

      const response = await request(app)
        .delete(`/api/bot-config-files/${configFile.id}`)
        .set('Cookie', authCookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify file was deleted from database
      const deletedFile = await prisma.bot_config_files.findUnique({
        where: { id: configFile.id }
      });
      expect(deletedFile).toBeNull();

      // Verify file was deleted from disk
      const fileExists = await fs.pathExists(testFilePath);
      expect(fileExists).toBe(false);
    });

    it('should reject delete from non-admin user', async () => {
      const regularUser = await createTestUser('user@test.com', 'USER');
      const userCookie = await getAuthCookie(regularUser.id);

      const configFile = await prisma.bot_config_files.create({
        data: {
          botId: testBot.id,
          filename: 'test.html',
          storedName: 'test-123.html',
          path: '/fake/path',
          mimetype: 'text/html',
          size: 100,
          checksum: 'abc123',
          category: 'template',
          uploadedBy: testUser.id
        }
      });

      const response = await request(app)
        .delete(`/api/bot-config-files/${configFile.id}`)
        .set('Cookie', userCookie);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Insufficient permissions');
    });
  });

  describe('GET /api/bot-config-files/:fileId/download', () => {
    it('should download a file successfully', async () => {
      const testContent = '<html><body>Test template content</body></html>';
      const testFilePath = path.join(uploadDir, 'download-test.html');
      await fs.writeFile(testFilePath, testContent);

      const configFile = await prisma.bot_config_files.create({
        data: {
          botId: testBot.id,
          filename: 'download-test.html',
          storedName: 'download-test.html',
          path: testFilePath,
          mimetype: 'text/html',
          size: testContent.length,
          checksum: 'abc123',
          category: 'template',
          uploadedBy: testUser.id
        }
      });

      const response = await request(app)
        .get(`/api/bot-config-files/${configFile.id}/download`)
        .set('Cookie', authCookie);

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('text/html');
      expect(response.headers['content-disposition']).toContain('download-test.html');
      expect(response.text).toBe(testContent);
    });

    it('should return 404 for non-existent file', async () => {
      const response = await request(app)
        .get('/api/bot-config-files/non-existent-id/download')
        .set('Cookie', authCookie);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('File not found');
    });
  });

  describe('GET /api/bot-config-files/:fileId/content', () => {
    it('should return text file content', async () => {
      const testContent = '<html><body>{{content}}</body></html>';
      const testFilePath = path.join(uploadDir, 'content-test.html');
      await fs.writeFile(testFilePath, testContent);

      const configFile = await prisma.bot_config_files.create({
        data: {
          botId: testBot.id,
          filename: 'content-test.html',
          storedName: 'content-test.html',
          path: testFilePath,
          mimetype: 'text/html',
          size: testContent.length,
          checksum: 'abc123',
          category: 'template',
          uploadedBy: testUser.id
        }
      });

      const response = await request(app)
        .get(`/api/bot-config-files/${configFile.id}/content`)
        .set('Cookie', authCookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.file.content).toBe(testContent);
      expect(response.body.file.filename).toBe('content-test.html');
    });

    it('should reject content reading for binary files', async () => {
      const configFile = await prisma.bot_config_files.create({
        data: {
          botId: testBot.id,
          filename: 'image.png',
          storedName: 'image-123.png',
          path: '/fake/path',
          mimetype: 'image/png',
          size: 1024,
          checksum: 'abc123',
          category: 'asset',
          uploadedBy: testUser.id
        }
      });

      const response = await request(app)
        .get(`/api/bot-config-files/${configFile.id}/content`)
        .set('Cookie', authCookie);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('text-based files');
    });
  });

  describe('PATCH /api/bot-config-files/:fileId', () => {
    it('should update file metadata successfully', async () => {
      const configFile = await prisma.bot_config_files.create({
        data: {
          botId: testBot.id,
          filename: 'update-test.html',
          storedName: 'update-test-123.html',
          path: '/fake/path',
          mimetype: 'text/html',
          size: 100,
          checksum: 'abc123',
          category: 'template',
          description: 'Original description',
          uploadedBy: testUser.id
        }
      });

      const response = await request(app)
        .patch(`/api/bot-config-files/${configFile.id}`)
        .set('Cookie', authCookie)
        .send({
          description: 'Updated description',
          category: 'css'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.file.description).toBe('Updated description');
      expect(response.body.file.category).toBe('css');
    });

    it('should prevent category conflicts', async () => {
      // Create first file
      await prisma.bot_config_files.create({
        data: {
          botId: testBot.id,
          filename: 'conflict.html',
          storedName: 'conflict-1.html',
          path: '/fake/path1',
          mimetype: 'text/html',
          size: 100,
          checksum: 'abc123',
          category: 'template',
          uploadedBy: testUser.id
        }
      });

      // Create second file with different category
      const configFile2 = await prisma.bot_config_files.create({
        data: {
          botId: testBot.id,
          filename: 'conflict.html',
          storedName: 'conflict-2.html',
          path: '/fake/path2',
          mimetype: 'text/html',
          size: 100,
          checksum: 'def456',
          category: 'css',
          uploadedBy: testUser.id
        }
      });

      // Try to change second file's category to template (creating conflict)
      const response = await request(app)
        .patch(`/api/bot-config-files/${configFile2.id}`)
        .set('Cookie', authCookie)
        .send({
          category: 'template'
        });

      expect(response.status).toBe(409);
      expect(response.body.error).toContain('already exists');
    });
  });

  describe('GET /api/bot-config-files/:botId/categories', () => {
    it('should list file categories with counts', async () => {
      // Create files in different categories
      await prisma.bot_config_files.createMany({
        data: [
          {
            botId: testBot.id,
            filename: 'template1.html',
            storedName: 'template1-123.html',
            path: '/fake/path1',
            mimetype: 'text/html',
            size: 100,
            checksum: 'abc123',
            category: 'template',
            uploadedBy: testUser.id
          },
          {
            botId: testBot.id,
            filename: 'template2.html',
            storedName: 'template2-456.html',
            path: '/fake/path2',
            mimetype: 'text/html',
            size: 100,
            checksum: 'def456',
            category: 'template',
            uploadedBy: testUser.id
          },
          {
            botId: testBot.id,
            filename: 'styles.css',
            storedName: 'styles-789.css',
            path: '/fake/path3',
            mimetype: 'text/css',
            size: 50,
            checksum: 'ghi789',
            category: 'css',
            uploadedBy: testUser.id
          }
        ]
      });

      const response = await request(app)
        .get(`/api/bot-config-files/${testBot.id}/categories`)
        .set('Cookie', authCookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.categories).toHaveLength(2);

      const categories = response.body.categories.reduce((acc: any, cat: any) => {
        acc[cat.name] = cat.fileCount;
        return acc;
      }, {});

      expect(categories.template).toBe(2);
      expect(categories.css).toBe(1);
    });
  });
});