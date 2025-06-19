import request from 'supertest';
import app from '../../src/app';
import { createMockUser, createMockJWT } from '../utils/testUtils';

// Mock the database module to avoid real database connections
jest.mock('@colloquium/database', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn()
    },
    message: {
      findUnique: jest.fn(),
      update: jest.fn(),
      create: jest.fn()
    },
    conversation: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn()
    },
    manuscript: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn()
    },
    magicLink: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn()
    }
  },
  GlobalRole: {
    ADMIN: 'ADMIN',
    EDITOR_IN_CHIEF: 'EDITOR_IN_CHIEF',
    MANAGING_EDITOR: 'MANAGING_EDITOR',
    USER: 'USER',
    BOT: 'BOT'
  }
}));

// Mock auth module
jest.mock('@colloquium/auth', () => ({
  generateJWT: jest.fn(() => 'mock-jwt-token'),
  generateSecureToken: jest.fn(() => 'mock-secure-token'),
  verifyJWT: jest.fn((token) => {
    // Handle mock tokens created by createMockJWT
    if (token && token.startsWith('mock.')) {
      const parts = token.split('.');
      if (parts.length >= 2) {
        try {
          const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
          return payload;
        } catch (e) {
          // Fall back to default
        }
      }
    }
    // Default payload
    return {
      userId: 'test-user-id',
      email: 'test@example.com',
      role: 'USER'
    };
  }),
  GlobalRole: {
    ADMIN: 'ADMIN',
    EDITOR_IN_CHIEF: 'EDITOR_IN_CHIEF',
    MANAGING_EDITOR: 'MANAGING_EDITOR',
    USER: 'USER',
    BOT: 'BOT'
  },
  hasPermission: jest.fn(() => true),
  hasGlobalPermission: jest.fn(() => true)
}));

// Mock email service
jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({
    sendMail: jest.fn().mockResolvedValue({
      messageId: 'test-message-id'
    })
  }))
}));

// Mock bot system
jest.mock('../../src/bots', () => ({
  initializeBots: jest.fn().mockResolvedValue(undefined),
  botExecutor: {
    executeBot: jest.fn()
  }
}));

describe('API Validation Integration Tests', () => {
  const { prisma } = require('@colloquium/database');
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Authentication Validation', () => {
    describe('POST /api/auth/login', () => {
      it('should validate email format', async () => {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: 'invalid-email-format'
          });

        expect(response.status).toBe(400);
        expect(response.body.error.type).toBe('ValidationError');
        expect(response.body.error.details).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              field: 'email',
              message: 'Please enter a valid email address'
            })
          ])
        );
      });

      it('should accept valid email', async () => {
        prisma.user.findUnique.mockResolvedValue(null);
        prisma.user.create.mockResolvedValue(createMockUser());
        prisma.magicLink.create.mockResolvedValue({});

        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: 'test@example.com'
          });

        expect(response.status).toBe(200);
        expect(response.body.message).toContain('Magic link sent');
      });

      it('should validate optional redirectUrl', async () => {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: 'test@example.com',
            redirectUrl: 'not-a-valid-url'
          });

        expect(response.status).toBe(400);
        expect(response.body.error.details).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              field: 'redirectUrl',
              message: expect.stringContaining('Invalid url')
            })
          ])
        );
      });
    });

    describe('GET /api/auth/verify', () => {
      it('should validate required token and email', async () => {
        const response = await request(app)
          .get('/api/auth/verify');

        expect(response.status).toBe(400);
        expect(response.body.error.type).toBe('ValidationError');
      });

      it('should validate email format in query', async () => {
        const response = await request(app)
          .get('/api/auth/verify')
          .query({
            token: 'some-token',
            email: 'invalid-email'
          });

        expect(response.status).toBe(400);
        expect(response.body.error.details).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              field: 'email',
              message: 'Please enter a valid email address'
            })
          ])
        );
      });
    });
  });

  describe('Message Validation', () => {
    const mockUser = createMockUser();
    const mockToken = createMockJWT();

    beforeEach(() => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
    });

    describe('PUT /api/messages/:id', () => {
      it('should validate UUID format for message ID', async () => {
        const response = await request(app)
          .put('/api/messages/invalid-id')
          .set('Cookie', [`auth-token=${mockToken}`])
          .send({
            content: 'Updated message content'
          });

        expect(response.status).toBe(400);
        expect(response.body.error.type).toBe('ValidationError');
        expect(response.body.error.details).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              field: 'id',
              message: 'Invalid ID format'
            })
          ])
        );
      });

      it('should validate message content', async () => {
        const response = await request(app)
          .put('/api/messages/123e4567-e89b-12d3-a456-426614174000')
          .set('Cookie', [`auth-token=${mockToken}`])
          .send({
            content: '' // Empty content
          });

        expect(response.status).toBe(400);
        expect(response.body.error.details).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              field: 'content',
              message: 'Message content is required'
            })
          ])
        );
      });

      it('should accept valid message update', async () => {
        const mockMessage = {
          id: '123e4567-e89b-12d3-a456-426614174000',
          authorId: mockUser.id,
          createdAt: new Date(),
          content: 'Original content'
        };

        prisma.message.findUnique.mockResolvedValue(mockMessage);
        prisma.message.update.mockResolvedValue({
          ...mockMessage,
          content: 'Updated content',
          editedAt: new Date(),
          author: mockUser
        });

        const response = await request(app)
          .put('/api/messages/123e4567-e89b-12d3-a456-426614174000')
          .set('Cookie', [`auth-token=${mockToken}`])
          .send({
            content: 'Updated message content'
          });

        expect(response.status).toBe(200);
        expect(response.body.message).toBe('Message updated successfully');
      });
    });

    describe('DELETE /api/messages/:id', () => {
      it('should validate UUID format for message ID', async () => {
        const response = await request(app)
          .delete('/api/messages/invalid-id')
          .set('Cookie', [`auth-token=${mockToken}`]);

        expect(response.status).toBe(400);
        expect(response.body.error.type).toBe('ValidationError');
      });

      it('should handle valid message deletion', async () => {
        const mockMessage = {
          id: '123e4567-e89b-12d3-a456-426614174000',
          authorId: mockUser.id,
          createdAt: new Date(),
          content: 'Message to delete'
        };

        prisma.message.findUnique.mockResolvedValue(mockMessage);
        prisma.message.update.mockResolvedValue({
          ...mockMessage,
          deleted: true,
          deletedAt: new Date()
        });

        const response = await request(app)
          .delete('/api/messages/123e4567-e89b-12d3-a456-426614174000')
          .set('Cookie', [`auth-token=${mockToken}`]);

        expect(response.status).toBe(200);
        expect(response.body.message).toBe('Message deleted successfully');
      });
    });
  });

  describe('Settings Validation', () => {
    const mockAdmin = createMockUser({ id: 'admin-user-id', role: 'ADMIN' });
    const adminToken = createMockJWT({ userId: 'admin-user-id', role: 'ADMIN' });

    beforeEach(() => {
      prisma.user.findUnique.mockResolvedValue(mockAdmin);
    });

    describe('PUT /api/settings', () => {
      it('should validate color format', async () => {
        const response = await request(app)
          .put('/api/settings')
          .set('Cookie', [`auth-token=${adminToken}`])
          .send({
            name: 'Test Journal',
            primaryColor: 'invalid-color',
            secondaryColor: '#123456'
          });

        expect(response.status).toBe(400);
        expect(response.body.error.details).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              field: 'primaryColor',
              message: 'Invalid color format'
            })
          ])
        );
      });

      it('should validate email formats', async () => {
        const response = await request(app)
          .put('/api/settings')
          .set('Cookie', [`auth-token=${adminToken}`])
          .send({
            name: 'Test Journal',
            contactEmail: 'invalid-email',
            editorEmail: 'also-invalid'
          });

        expect(response.status).toBe(400);
        expect(response.body.error.details).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              field: 'contactEmail'
            }),
            expect.objectContaining({
              field: 'editorEmail'
            })
          ])
        );
      });

      it('should validate numeric constraints', async () => {
        const response = await request(app)
          .put('/api/settings')
          .set('Cookie', [`auth-token=${adminToken}`])
          .send({
            name: 'Test Journal',
            maxFileSize: 1000, // Too large
            defaultReviewPeriod: 5 // Too short
          });

        expect(response.status).toBe(400);
        expect(response.body.error.details).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              field: 'maxFileSize'
            }),
            expect.objectContaining({
              field: 'defaultReviewPeriod'
            })
          ])
        );
      });

      it('should accept valid settings', async () => {
        const validSettings = {
          name: 'Test Journal',
          description: 'A test journal',
          primaryColor: '#1976d2',
          secondaryColor: '#424242',
          contactEmail: 'contact@test.com',
          maxFileSize: 50,
          defaultReviewPeriod: 30
        };

        const response = await request(app)
          .put('/api/settings')
          .set('Cookie', [`auth-token=${adminToken}`])
          .send(validSettings);

        expect(response.status).toBe(200);
        expect(response.body.message).toBe('Settings updated successfully');
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle multiple validation errors', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: '', // Empty email
          redirectUrl: 'invalid-url'
        });

      expect(response.status).toBe(400);
      expect(response.body.error.type).toBe('ValidationError');
      expect(response.body.error.details).toHaveLength(2);
    });

    it('should provide detailed error information', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'not-an-email'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toEqual({
        message: 'Validation Error',
        type: 'ValidationError',
        details: expect.arrayContaining([
          expect.objectContaining({
            field: 'email',
            message: 'Please enter a valid email address',
            code: expect.any(String)
          })
        ])
      });
    });

    it('should handle unauthorized access gracefully', async () => {
      const response = await request(app)
        .put('/api/messages/123e4567-e89b-12d3-a456-426614174000')
        .send({
          content: 'Unauthorized update attempt'
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Not Authenticated');
    });
  });
});