import request from 'supertest';
import app from '../../src/app';
import { createMockUser, createMockManuscript, createMockJWT } from '../utils/testUtils';

// Mock the database module
jest.mock('@colloquium/database', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn()
    },
    manuscript: {
      findUnique: jest.fn()
    },
    reviewAssignment: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
    }
  }
}));

// Mock auth module
jest.mock('@colloquium/auth', () => ({
  verifyJWT: jest.fn(() => ({
    userId: 'editor-user-id',
    email: 'editor@example.com',
    role: 'EDITOR_IN_CHIEF'
  }))
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
  initializeBots: jest.fn().mockResolvedValue(undefined)
}));

describe('Reviewer Management API', () => {
  const { prisma } = require('@colloquium/database');
  const mockEditor = createMockUser({ role: 'EDITOR_IN_CHIEF' });
  const editorToken = createMockJWT({ role: 'EDITOR_IN_CHIEF' });
  const mockManuscript = createMockManuscript();

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.findUnique.mockResolvedValue(mockEditor);
  });

  describe('GET /api/reviewers/search', () => {
    it('should search for potential reviewers', async () => {
      const mockReviewers = [
        createMockUser({ id: 'reviewer-1', name: 'Smith', email: 'smith@university.edu' }),
        createMockUser({ id: 'reviewer-2', name: 'Jones', email: 'jones@institute.org' })
      ];

      prisma.user.findMany.mockResolvedValue(mockReviewers);
      prisma.reviewAssignment.findMany.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/reviewers/search')
        .set('Cookie', [`auth-token=${editorToken}`])
        .query({
          query: 'Smith',
          manuscriptId: mockManuscript.id,
          excludeConflicts: 'true',
          limit: '10'
        });

      expect(response.status).toBe(200);
      expect(response.body.reviewers).toHaveLength(2);
      expect(response.body.reviewers[0]).toEqual(
        expect.objectContaining({
          id: 'reviewer-1',
          name: 'Smith',
          email: 'smith@university.edu'
        })
      );
    });

    it('should require search query', async () => {
      const response = await request(app)
        .get('/api/reviewers/search')
        .set('Cookie', [`auth-token=${editorToken}`])
        .query({
          manuscriptId: mockManuscript.id
        });

      expect(response.status).toBe(400);
      expect(response.body.error.type).toBe('ValidationError');
      expect(response.body.error.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'query',
            message: 'Search query is required'
          })
        ])
      );
    });

    it('should require editor role', async () => {
      const mockAuthor = createMockUser({ role: 'USER' });
      const authorToken = createMockJWT({ role: 'USER' });
      
      prisma.user.findUnique.mockResolvedValue(mockAuthor);

      const response = await request(app)
        .get('/api/reviewers/search')
        .set('Cookie', [`auth-token=${authorToken}`])
        .query({
          query: 'Smith'
        });

      expect(response.status).toBe(403);
      expect(response.body.error).toEqual(
        expect.objectContaining({
          message: expect.stringContaining('requires one of')
        })
      );
    });
  });

  describe('POST /api/reviewers/invite', () => {
    it('should send reviewer invitations', async () => {
      const mockReviewer = createMockUser({ email: 'reviewer@example.com' });
      
      prisma.manuscript.findUnique.mockResolvedValue({
        ...mockManuscript,
        authorRelations: []
      });
      prisma.user.findUnique.mockResolvedValue(mockReviewer);
      prisma.reviewAssignment.findUnique.mockResolvedValue(null);
      prisma.reviewAssignment.create.mockResolvedValue({
        id: 'assignment-id',
        manuscriptId: mockManuscript.id,
        reviewerId: mockReviewer.id,
        status: 'PENDING'
      });

      const response = await request(app)
        .post('/api/reviewers/invite')
        .set('Cookie', [`auth-token=${editorToken}`])
        .send({
          manuscriptId: mockManuscript.id,
          reviewerEmails: ['reviewer@example.com'],
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
          message: 'Please review this manuscript',
          autoAssign: false
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('1 invitations successfully');
      expect(response.body.results.successful).toHaveLength(1);
      expect(response.body.results.successful[0]).toEqual(
        expect.objectContaining({
          email: 'reviewer@example.com',
          reviewerId: mockReviewer.id,
          status: 'PENDING'
        })
      );
    });

    it('should validate email format', async () => {
      const response = await request(app)
        .post('/api/reviewers/invite')
        .set('Cookie', [`auth-token=${editorToken}`])
        .send({
          manuscriptId: mockManuscript.id,
          reviewerEmails: ['invalid-email'],
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        });

      expect(response.status).toBe(400);
      expect(response.body.error.type).toBe('ValidationError');
    });

    it('should validate due date is in future', async () => {
      const response = await request(app)
        .post('/api/reviewers/invite')
        .set('Cookie', [`auth-token=${editorToken}`])
        .send({
          manuscriptId: mockManuscript.id,
          reviewerEmails: ['reviewer@example.com'],
          dueDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() // Yesterday
        });

      expect(response.status).toBe(400);
      expect(response.body.error.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'dueDate',
            message: 'Due date must be in the future'
          })
        ])
      );
    });

    it('should handle manuscript not found', async () => {
      prisma.manuscript.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/reviewers/invite')
        .set('Cookie', [`auth-token=${editorToken}`])
        .send({
          manuscriptId: 'non-existent-id',
          reviewerEmails: ['reviewer@example.com'],
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        });

      expect(response.status).toBe(404);
      expect(response.body.error.message).toBe('Manuscript not found');
    });
  });

  describe('POST /api/reviewers/assign', () => {
    it('should assign reviewer directly', async () => {
      const mockReviewer = createMockUser({ id: 'reviewer-id' });
      
      prisma.manuscript.findUnique.mockResolvedValue(mockManuscript);
      prisma.user.findUnique.mockResolvedValue(mockReviewer);
      prisma.reviewAssignment.findUnique.mockResolvedValue(null);
      prisma.reviewAssignment.create.mockResolvedValue({
        id: 'assignment-id',
        manuscriptId: mockManuscript.id,
        reviewerId: mockReviewer.id,
        status: 'ACCEPTED',
        reviewer: mockReviewer,
        manuscript: mockManuscript
      });

      const response = await request(app)
        .post('/api/reviewers/assign')
        .set('Cookie', [`auth-token=${editorToken}`])
        .send({
          manuscriptId: mockManuscript.id,
          reviewerId: mockReviewer.id,
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        });

      expect(response.status).toBe(201);
      expect(response.body.message).toBe('Reviewer assigned successfully');
      expect(response.body.assignment.status).toBe('ACCEPTED');
    });

    it('should handle duplicate assignment', async () => {
      const mockReviewer = createMockUser({ id: 'reviewer-id' });
      
      prisma.manuscript.findUnique.mockResolvedValue(mockManuscript);
      prisma.user.findUnique.mockResolvedValue(mockReviewer);
      prisma.reviewAssignment.findUnique.mockResolvedValue({
        id: 'existing-assignment',
        status: 'PENDING'
      });

      const response = await request(app)
        .post('/api/reviewers/assign')
        .set('Cookie', [`auth-token=${editorToken}`])
        .send({
          manuscriptId: mockManuscript.id,
          reviewerId: mockReviewer.id
        });

      expect(response.status).toBe(409);
      expect(response.body.error.message).toBe('Reviewer is already assigned to this manuscript');
    });

    it('should validate UUID format for IDs', async () => {
      const response = await request(app)
        .post('/api/reviewers/assign')
        .set('Cookie', [`auth-token=${editorToken}`])
        .send({
          manuscriptId: 'invalid-id',
          reviewerId: 'also-invalid'
        });

      expect(response.status).toBe(400);
      expect(response.body.error.type).toBe('ValidationError');
    });
  });

  describe('GET /api/reviewers/assignments/:manuscriptId', () => {
    it('should get review assignments for manuscript', async () => {
      const mockAssignments = [
        {
          id: 'assignment-1',
          status: 'ACCEPTED',
          assignedAt: new Date(),
          reviewer: createMockUser({ name: 'Smith' })
        },
        {
          id: 'assignment-2',
          status: 'PENDING',
          assignedAt: new Date(),
          reviewer: createMockUser({ name: 'Jones' })
        }
      ];

      prisma.reviewAssignment.findMany.mockResolvedValue(mockAssignments);

      const response = await request(app)
        .get(`/api/reviewers/assignments/${mockManuscript.id}`)
        .set('Cookie', [`auth-token=${editorToken}`]);

      expect(response.status).toBe(200);
      expect(response.body.assignments).toHaveLength(2);
      expect(response.body.summary).toEqual({
        total: 2,
        pending: 1,
        accepted: 1,
        declined: 0,
        inProgress: 0,
        completed: 0
      });
    });

    it('should validate manuscript ID format', async () => {
      const response = await request(app)
        .get('/api/reviewers/assignments/invalid-id')
        .set('Cookie', [`auth-token=${editorToken}`]);

      expect(response.status).toBe(400);
      expect(response.body.error.type).toBe('ValidationError');
    });
  });

  describe('PUT /api/reviewers/assignments/:id', () => {
    it('should allow reviewer to update their own assignment', async () => {
      const mockReviewer = createMockUser({ id: 'reviewer-id' });
      const reviewerToken = createMockJWT({ 
        userId: 'reviewer-id',
        role: 'USER' 
      });
      
      const mockAssignment = {
        id: 'assignment-id',
        reviewerId: 'reviewer-id',
        status: 'PENDING',
        reviewer: mockReviewer,
        manuscript: mockManuscript
      };

      prisma.user.findUnique.mockImplementation((query: any) => {
        if (query.where.id === 'reviewer-id') return mockReviewer;
        return mockEditor;
      });
      
      prisma.reviewAssignment.findUnique.mockResolvedValue(mockAssignment);
      prisma.reviewAssignment.update.mockResolvedValue({
        ...mockAssignment,
        status: 'ACCEPTED'
      });

      const response = await request(app)
        .put('/api/reviewers/assignments/assignment-id')
        .set('Cookie', [`auth-token=${reviewerToken}`])
        .send({
          status: 'ACCEPTED'
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Review assignment updated successfully');
    });

    it('should allow editor to update any assignment', async () => {
      const mockAssignment = {
        id: 'assignment-id',
        reviewerId: 'other-reviewer-id',
        status: 'PENDING',
        reviewer: createMockUser(),
        manuscript: mockManuscript
      };

      prisma.reviewAssignment.findUnique.mockResolvedValue(mockAssignment);
      prisma.reviewAssignment.update.mockResolvedValue({
        ...mockAssignment,
        status: 'ACCEPTED'
      });

      const response = await request(app)
        .put('/api/reviewers/assignments/assignment-id')
        .set('Cookie', [`auth-token=${editorToken}`])
        .send({
          status: 'ACCEPTED'
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Review assignment updated successfully');
    });

    it('should auto-set completion date when marking as completed', async () => {
      const mockAssignment = {
        id: 'assignment-id',
        reviewerId: 'reviewer-id',
        status: 'IN_PROGRESS',
        reviewer: createMockUser(),
        manuscript: mockManuscript
      };

      prisma.reviewAssignment.findUnique.mockResolvedValue(mockAssignment);
      
      const updatedAssignment = {
        ...mockAssignment,
        status: 'COMPLETED',
        completedAt: expect.any(Date)
      };
      
      prisma.reviewAssignment.update.mockResolvedValue(updatedAssignment);

      const response = await request(app)
        .put('/api/reviewers/assignments/assignment-id')
        .set('Cookie', [`auth-token=${editorToken}`])
        .send({
          status: 'COMPLETED'
        });

      expect(response.status).toBe(200);
      expect(prisma.reviewAssignment.update).toHaveBeenCalledWith({
        where: { id: 'assignment-id' },
        data: expect.objectContaining({
          status: 'COMPLETED',
          completedAt: expect.any(Date)
        }),
        include: expect.any(Object)
      });
    });
  });
});