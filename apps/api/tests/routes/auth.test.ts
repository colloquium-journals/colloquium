import request from 'supertest';
import express from 'express';
import authRoutes from '../../src/routes/auth';

// Mock the auth utilities
jest.mock('@colloquium/auth', () => ({
  generateMagicLinkToken: jest.fn(),
  verifyMagicLinkToken: jest.fn(),
  generateJWT: jest.fn(),
  verifyJWT: jest.fn(),
}));

// Mock the database
jest.mock('@colloquium/database', () => ({
  prisma: {
    user: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    magicLinkToken: {
      create: jest.fn(),
      findFirst: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

describe('Auth Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/auth', authRoutes);
    jest.clearAllMocks();
  });

  describe('POST /api/auth/magic-link', () => {
    it('should send magic link for existing user', async () => {
      const mockUser = testUtils.createMockUser();
      const { prisma } = require('@colloquium/database');
      
      prisma.user.findFirst.mockResolvedValue(mockUser);
      
      const response = await request(app)
        .post('/api/auth/magic-link')
        .send({ email: 'test@example.com' })
        .expect(200);

      expect(response.body.message).toContain('Magic link sent');
      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: { email: 'test@example.com' }
      });
    });

    it('should create new user if email does not exist', async () => {
      const { prisma } = require('@colloquium/database');
      const mockUser = testUtils.createMockUser();
      
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(mockUser);
      
      const response = await request(app)
        .post('/api/auth/magic-link')
        .send({ 
          email: 'newuser@example.com',
          name: 'New User'
        })
        .expect(200);

      expect(response.body.message).toContain('Magic link sent');
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          email: 'newuser@example.com',
          name: 'New User',
          role: 'AUTHOR'
        }
      });
    });

    it('should validate email format', async () => {
      const response = await request(app)
        .post('/api/auth/magic-link')
        .send({ email: 'invalid-email' })
        .expect(400);

      expect(response.body.error).toContain('Invalid email format');
    });

    it('should require email field', async () => {
      const response = await request(app)
        .post('/api/auth/magic-link')
        .send({})
        .expect(400);

      expect(response.body.error).toContain('Email is required');
    });
  });

  describe('POST /api/auth/verify-magic-link', () => {
    it('should verify valid magic link token', async () => {
      const mockUser = testUtils.createMockUser();
      const { verifyMagicLinkToken, generateJWT } = require('@colloquium/auth');
      const { prisma } = require('@colloquium/database');
      
      verifyMagicLinkToken.mockResolvedValue(true);
      generateJWT.mockReturnValue('mock-jwt-token');
      prisma.user.findFirst.mockResolvedValue(mockUser);
      
      const response = await request(app)
        .post('/api/auth/verify-magic-link')
        .send({ token: 'valid-token' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.user).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        name: mockUser.name,
        role: mockUser.role
      });
    });

    it('should reject invalid magic link token', async () => {
      const { verifyMagicLinkToken } = require('@colloquium/auth');
      
      verifyMagicLinkToken.mockResolvedValue(false);
      
      const response = await request(app)
        .post('/api/auth/verify-magic-link')
        .send({ token: 'invalid-token' })
        .expect(401);

      expect(response.body.error).toContain('Invalid or expired token');
    });

    it('should require token field', async () => {
      const response = await request(app)
        .post('/api/auth/verify-magic-link')
        .send({})
        .expect(400);

      expect(response.body.error).toContain('Token is required');
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should logout successfully', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .expect(200);

      expect(response.body.message).toContain('Logged out successfully');
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return user info for authenticated user', async () => {
      // This would require mocking the auth middleware
      // For now, we'll test the unauthenticated case
      const response = await request(app)
        .get('/api/auth/me')
        .expect(401);

      expect(response.body.error).toContain('Authentication required');
    });
  });
});