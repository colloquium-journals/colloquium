import request from 'supertest';
import app from '../../src/app';
import { prisma, ConversationType, GlobalRole, ManuscriptFileType } from '@colloquium/database';
import { sign } from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';

describe('Markdown Renderer Bot Integration', () => {
  let authToken: string;
  let userId: string;
  let manuscriptId: string;
  let conversationId: string;
  let markdownFileId: string;
  let imageFileId: string;

  beforeAll(async () => {
    // Create test user
    const user = await prisma.users.create({
      data: {
        email: 'test-markdown@example.com',
        username: 'markdown-test-user',
        name: 'Markdown Test User',
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

    // Create test manuscript
    const manuscript = await prisma.manuscripts.create({
      data: {
        title: 'Test Markdown Manuscript',
        abstract: 'Test abstract for markdown rendering',
        content: 'Test content'
      }
    });
    manuscriptId = manuscript.id;

    // Create test conversation
    const conversation = await prisma.conversations.create({
      data: {
        title: 'Markdown Test Conversation',
        type: ConversationType.EDITORIAL,
        privacy: 'PRIVATE',
        manuscriptId: manuscript.id
      }
    });
    conversationId = conversation.id;

    // Create test markdown file
    const uploadDir = path.join(process.cwd(), 'uploads', 'manuscripts');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const markdownContent = `# Test Markdown Document

## Abstract

This is a test markdown document for PDF generation testing.

## Introduction

This document tests the markdown renderer bot's ability to:
- Convert markdown to HTML
- Generate PDF output
- Handle image references

![Test Image](test-image.png)

## Results

The markdown renderer should be able to generate both HTML and PDF versions of this document.

## Conclusion

Testing complete.
`;

    const markdownFilename = `test-markdown-${Date.now()}.md`;
    const markdownPath = path.join(uploadDir, markdownFilename);
    fs.writeFileSync(markdownPath, markdownContent);

    // Create markdown file record
    const markdownFile = await prisma.manuscript_files.create({
      data: {
        manuscriptId: manuscript.id,
        originalName: 'test-document.md',
        filename: markdownFilename,
        path: markdownPath,
        mimetype: 'text/markdown',
        size: Buffer.byteLength(markdownContent),
        fileType: ManuscriptFileType.SOURCE,
        checksum: 'test-checksum-md'
      }
    });
    markdownFileId = markdownFile.id;

    // Create test image file
    const imageData = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
    const imageFilename = `test-image-${Date.now()}.png`;
    const imagePath = path.join(uploadDir, imageFilename);
    fs.writeFileSync(imagePath, imageData);

    const imageFile = await prisma.manuscript_files.create({
      data: {
        manuscriptId: manuscript.id,
        originalName: 'test-image.png',
        filename: imageFilename,
        path: imagePath,
        mimetype: 'image/png',
        size: imageData.length,
        fileType: ManuscriptFileType.ASSET,
        checksum: 'test-checksum-img'
      }
    });
    imageFileId = imageFile.id;
  });

  afterAll(async () => {
    // Clean up test files
    try {
      const files = await prisma.manuscript_files.findMany({
        where: { manuscriptId }
      });
      
      for (const file of files) {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      }
    } catch (error) {
      console.warn('Error cleaning up test files:', error);
    }

    // Clean up database records
    await prisma.manuscript_files.deleteMany({ where: { manuscriptId } });
    await prisma.messages.deleteMany({ where: { conversationId } });
    await prisma.conversations.deleteMany({ where: { id: conversationId } });
    await prisma.manuscripts.deleteMany({ where: { id: manuscriptId } });
    await prisma.users.deleteMany({ where: { id: userId } });
  });

  describe('Basic Markdown Rendering', () => {
    it('should render markdown to HTML by default', async () => {
      const response = await request(app)
        .post(`/api/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          content: '@markdown-renderer render'
        });

      expect(response.status).toBe(201);

      // Wait for bot processing
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Check for bot response
      const messages = await prisma.messages.findMany({
        where: { 
          conversationId,
          isBot: true
        },
        orderBy: { id: 'desc' },
        take: 1
      });

      expect(messages).toHaveLength(1);
      expect(messages[0].content).toContain('Markdown Rendered Successfully');
      expect(messages[0].content).toContain('.html');
      expect(messages[0].content).not.toContain('.pdf');
    });

    it('should list available templates', async () => {
      const response = await request(app)
        .post(`/api/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          content: '@markdown-renderer templates'
        });

      expect(response.status).toBe(201);

      // Wait for bot processing
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Check for bot response
      const messages = await prisma.messages.findMany({
        where: { 
          conversationId,
          isBot: true
        },
        orderBy: { id: 'desc' },
        take: 1
      });

      expect(messages).toHaveLength(1);
      expect(messages[0].content).toContain('Available Journal Templates');
      expect(messages[0].content).toContain('academic-standard');
    });
  });

  describe('PDF Generation', () => {
    it('should generate PDF when output="pdf" is specified', async () => {
      const response = await request(app)
        .post(`/api/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          content: '@markdown-renderer render output="pdf"'
        });

      expect(response.status).toBe(201);

      // Wait for bot processing (PDF generation takes longer)
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Check for bot response
      const messages = await prisma.messages.findMany({
        where: { 
          conversationId,
          isBot: true
        },
        orderBy: { id: 'desc' },
        take: 1
      });

      expect(messages).toHaveLength(1);
      const botMessage = messages[0].content;
      
      expect(botMessage).toContain('Markdown Rendered Successfully');
      expect(botMessage).toContain('.pdf');
      expect(botMessage).not.toContain('.html');
      
      // Verify the download link is for a PDF
      const pdfLinkMatch = botMessage.match(/\[.*?\]\((.*?\.pdf.*?)\)/);
      expect(pdfLinkMatch).toBeTruthy();
      
      if (pdfLinkMatch) {
        const pdfUrl = pdfLinkMatch[1];
        expect(pdfUrl).toContain('.pdf');
      }
    });

    it('should generate both HTML and PDF when output="both" is specified', async () => {
      const response = await request(app)
        .post(`/api/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          content: '@markdown-renderer render output="both"'
        });

      expect(response.status).toBe(201);

      // Wait for bot processing
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Check for bot response
      const messages = await prisma.messages.findMany({
        where: { 
          conversationId,
          isBot: true
        },
        orderBy: { id: 'desc' },
        take: 1
      });

      expect(messages).toHaveLength(1);
      const botMessage = messages[0].content;
      
      expect(botMessage).toContain('Markdown Rendered Successfully');
      expect(botMessage).toContain('Outputs Generated');
      expect(botMessage).toContain('HTML:');
      expect(botMessage).toContain('PDF:');
      
      // Should have both file types mentioned
      expect(botMessage).toContain('.html');
      expect(botMessage).toContain('.pdf');
    });

    it('should handle PDF generation with custom template', async () => {
      const response = await request(app)
        .post(`/api/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          content: '@markdown-renderer render template="minimal" output="pdf"'
        });

      expect(response.status).toBe(201);

      // Wait for bot processing
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Check for bot response
      const messages = await prisma.messages.findMany({
        where: { 
          conversationId,
          isBot: true
        },
        orderBy: { id: 'desc' },
        take: 1
      });

      expect(messages).toHaveLength(1);
      const botMessage = messages[0].content;
      
      expect(botMessage).toContain('Markdown Rendered Successfully');
      expect(botMessage).toContain('minimal');
      expect(botMessage).toContain('.pdf');
    });
  });

  describe('Parameter Parsing', () => {
    it('should correctly parse quoted parameters', async () => {
      const response = await request(app)
        .post(`/api/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          content: '@markdown-renderer render template="academic-standard" output="pdf" includeAssets=true'
        });

      expect(response.status).toBe(201);

      // Wait for bot processing
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Check for bot response
      const messages = await prisma.messages.findMany({
        where: { 
          conversationId,
          isBot: true
        },
        orderBy: { id: 'desc' },
        take: 1
      });

      expect(messages).toHaveLength(1);
      const botMessage = messages[0].content;
      
      expect(botMessage).toContain('Markdown Rendered Successfully');
      expect(botMessage).toContain('academic-standard');
      expect(botMessage).toContain('.pdf');
    });

    it('should handle parameters without quotes', async () => {
      const response = await request(app)
        .post(`/api/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          content: '@markdown-renderer render output=pdf'
        });

      expect(response.status).toBe(201);

      // Wait for bot processing
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Check for bot response
      const messages = await prisma.messages.findMany({
        where: { 
          conversationId,
          isBot: true
        },
        orderBy: { id: 'desc' },
        take: 1
      });

      expect(messages).toHaveLength(1);
      const botMessage = messages[0].content;
      
      expect(botMessage).toContain('Markdown Rendered Successfully');
      expect(botMessage).toContain('.pdf');
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid output format gracefully', async () => {
      const response = await request(app)
        .post(`/api/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          content: '@markdown-renderer render output="invalid"'
        });

      expect(response.status).toBe(201);

      // Wait for bot processing
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Check for bot response
      const messages = await prisma.messages.findMany({
        where: { 
          conversationId,
          isBot: true
        },
        orderBy: { id: 'desc' },
        take: 1
      });

      expect(messages).toHaveLength(1);
      // Bot should either handle gracefully or show an error message
      const botMessage = messages[0].content;
      expect(botMessage).toBeDefined();
    });

    it('should handle missing manuscript files', async () => {
      // Create a conversation with a manuscript that has no files
      const emptyManuscript = await prisma.manuscripts.create({
        data: {
          title: 'Empty Test Manuscript',
          abstract: 'No files',
          content: 'No content'
        }
      });

      const emptyConversation = await prisma.conversations.create({
        data: {
          title: 'Empty Test Conversation',
          type: ConversationType.EDITORIAL,
          privacy: 'PRIVATE',
          manuscriptId: emptyManuscript.id
        }
      });

      try {
        const response = await request(app)
          .post(`/api/conversations/${emptyConversation.id}/messages`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            content: '@markdown-renderer render'
          });

        expect(response.status).toBe(201);

        // Wait for bot processing
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Check for bot response
        const messages = await prisma.messages.findMany({
          where: { 
            conversationId: emptyConversation.id,
            isBot: true
          },
          orderBy: { id: 'desc' },
          take: 1
        });

        expect(messages).toHaveLength(1);
        expect(messages[0].content).toContain('No Markdown File Found');

      } finally {
        // Clean up
        await prisma.messages.deleteMany({ where: { conversationId: emptyConversation.id } });
        await prisma.conversations.deleteMany({ where: { id: emptyConversation.id } });
        await prisma.manuscripts.deleteMany({ where: { id: emptyManuscript.id } });
      }
    });
  });

  describe('File Generation Verification', () => {
    it('should actually create PDF files that can be downloaded', async () => {
      const response = await request(app)
        .post(`/api/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          content: '@markdown-renderer render output="pdf"'
        });

      expect(response.status).toBe(201);

      // Wait for bot processing
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Check if a PDF file was actually created
      const pdfFiles = await prisma.manuscript_files.findMany({
        where: {
          manuscriptId,
          fileType: ManuscriptFileType.RENDERED,
          mimetype: 'application/pdf'
        },
        orderBy: { id: 'desc' },
        take: 1
      });

      expect(pdfFiles).toHaveLength(1);
      
      const pdfFile = pdfFiles[0];
      expect(pdfFile.originalName).toMatch(/\.pdf$/);
      expect(fs.existsSync(pdfFile.path)).toBe(true);
      
      // Verify the file is actually a PDF (check magic bytes)
      const fileBuffer = fs.readFileSync(pdfFile.path);
      expect(fileBuffer.slice(0, 4).toString()).toBe('%PDF');
    });

    it('should create HTML files with correct content structure', async () => {
      const response = await request(app)
        .post(`/api/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          content: '@markdown-renderer render output="html"'
        });

      expect(response.status).toBe(201);

      // Wait for bot processing
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Check if an HTML file was created
      const htmlFiles = await prisma.manuscript_files.findMany({
        where: {
          manuscriptId,
          fileType: ManuscriptFileType.RENDERED,
          mimetype: 'text/html'
        },
        orderBy: { id: 'desc' },
        take: 1
      });

      expect(htmlFiles).toHaveLength(1);
      
      const htmlFile = htmlFiles[0];
      expect(htmlFile.originalName).toMatch(/\.html$/);
      expect(fs.existsSync(htmlFile.path)).toBe(true);
      
      // Verify the HTML content
      const htmlContent = fs.readFileSync(htmlFile.path, 'utf-8');
      expect(htmlContent).toContain('<!DOCTYPE html>');
      expect(htmlContent).toContain('<h1>Test Markdown Document</h1>');
      expect(htmlContent).toContain('<h2>Abstract</h2>');
    });
  });
});