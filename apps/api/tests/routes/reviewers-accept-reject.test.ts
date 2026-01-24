import request from 'supertest';
import app from '../../src/app';
import { prisma } from '@colloquium/database';
import jwt from 'jsonwebtoken';

// Test utilities
const generateTestToken = (user: any) => {
  return jwt.sign(
    { userId: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET || 'test-secret',
    { expiresIn: '1h' }
  );
};

const createTestUser = async (userData: any = {}) => {
  const { randomUUID } = require('crypto');
  return await prisma.users.create({
    data: {
      email: userData.email || 'test@example.com',
      username: userData.username || `test-user-${randomUUID().slice(0, 8)}`,
      name: userData.name || 'Test User',
      role: userData.role || 'USER',
      ...userData
    }
  });
};

const createTestManuscript = async (authorId: string) => {
  const manuscript = await prisma.manuscripts.create({
    data: {
      title: 'Test Manuscript',
      abstract: 'Test abstract for manuscript',
      content: 'Test content',
      status: 'SUBMITTED'
    }
  });

  await prisma.manuscriptAuthor.create({
    data: {
      manuscriptId: manuscript.id,
      userId: authorId,
      isCorresponding: true,
      name: 'Test Author',
      email: 'author@test.com'
    }
  });

  return manuscript;
};

jest.mock('nodemailer', () => ({
  createTransporter: jest.fn(() => ({
    sendMail: jest.fn().mockResolvedValue({ messageId: 'test-message-id' })
  }))
}));

describe('Reviewer Accept/Reject API Endpoints', () => {
  let reviewer: any;
  let editor: any;
  let manuscript: any;
  let reviewAssignment: any;
  let reviewerToken: string;
  let editorToken: string;

  beforeEach(async () => {
    // Create test users
    reviewer = await createTestUser({ role: 'USER', email: 'reviewer@test.com' });
    editor = await createTestUser({ role: 'EDITOR_IN_CHIEF', email: 'editor@test.com' });
    
    // Create test manuscript
    manuscript = await createTestManuscript(editor.id);
    
    // Create review assignment
    reviewAssignment = await prisma.review_assignments.create({
      data: {
        manuscriptId: manuscript.id,
        reviewerId: reviewer.id,
        status: 'PENDING',
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
      }
    });

    // Create editorial conversation
    await prisma.conversations.create({
      data: {
        title: 'Editorial Discussion',
        type: 'EDITORIAL',
        privacy: 'PRIVATE',
        manuscriptId: manuscript.id
      }
    });

    reviewerToken = generateTestToken(reviewer);
    editorToken = generateTestToken(editor);
  });

  afterEach(async () => {
    await prisma.messages.deleteMany();
    await prisma.conversation_participants.deleteMany();
    await prisma.conversations.deleteMany();
    await prisma.review_assignments.deleteMany();
    await prisma.manuscriptAuthor.deleteMany();
    await prisma.manuscripts.deleteMany();
    await prisma.users.deleteMany();
  });

  describe('POST /api/reviewers/invitations/:id/respond', () => {
    it('should accept a review invitation', async () => {
      const response = await request(app)
        .post(`/api/reviewers/invitations/${reviewAssignment.id}/respond`)
        .set('Authorization', `Bearer ${reviewerToken}`)
        .send({
          response: 'ACCEPT',
          message: 'Happy to review this work',
          availableUntil: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString()
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('accepted successfully');
      expect(response.body.assignment.status).toBe('ACCEPTED');
      expect(response.body.status).toBe('ACCEPTED');

      // Verify assignment was updated in database
      const updatedAssignment = await prisma.review_assignments.findUnique({
        where: { id: reviewAssignment.id }
      });
      expect(updatedAssignment?.status).toBe('ACCEPTED');

      // Verify notification message was created
      const notifications = await prisma.messages.findMany({
        where: {
          privacy: 'EDITOR_ONLY',
          metadata: {
            path: ['type'],
            equals: 'review_invitation_response'
          }
        }
      });
      expect(notifications).toHaveLength(1);
      expect(notifications[0].content).toContain('Review Invitation Accepted');
    });

    it('should decline a review invitation', async () => {
      const response = await request(app)
        .post(`/api/reviewers/invitations/${reviewAssignment.id}/respond`)
        .set('Authorization', `Bearer ${reviewerToken}`)
        .send({
          response: 'DECLINE',
          message: 'I have a conflict of interest'
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('declined successfully');
      expect(response.body.assignment.status).toBe('DECLINED');

      // Verify assignment was updated
      const updatedAssignment = await prisma.review_assignments.findUnique({
        where: { id: reviewAssignment.id }
      });
      expect(updatedAssignment?.status).toBe('DECLINED');

      // Verify notification message was created
      const notifications = await prisma.messages.findMany({
        where: {
          privacy: 'EDITOR_ONLY',
          metadata: {
            path: ['type'],
            equals: 'review_invitation_response'
          }
        }
      });
      expect(notifications).toHaveLength(1);
      expect(notifications[0].content).toContain('Review Invitation Declined');
    });

    it('should not allow non-assigned reviewer to respond', async () => {
      const otherReviewer = await createTestUser({ role: 'USER', email: 'other@test.com' });
      const otherToken = generateTestToken(otherReviewer);

      const response = await request(app)
        .post(`/api/reviewers/invitations/${reviewAssignment.id}/respond`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send({
          response: 'ACCEPT'
        });

      expect(response.status).toBe(403);
      expect(response.body.error.message).toContain('only respond to your own');
    });

    it('should not allow responding to already responded invitation', async () => {
      // First response
      await request(app)
        .post(`/api/reviewers/invitations/${reviewAssignment.id}/respond`)
        .set('Authorization', `Bearer ${reviewerToken}`)
        .send({ response: 'ACCEPT' });

      // Second response should fail
      const response = await request(app)
        .post(`/api/reviewers/invitations/${reviewAssignment.id}/respond`)
        .set('Authorization', `Bearer ${reviewerToken}`)
        .send({ response: 'DECLINE' });

      expect(response.status).toBe(400);
      expect(response.body.error.message).toContain('already accepted');
    });

    it('should return 404 for non-existent invitation', async () => {
      const response = await request(app)
        .post('/api/reviewers/invitations/non-existent-id/respond')
        .set('Authorization', `Bearer ${reviewerToken}`)
        .send({ response: 'ACCEPT' });

      expect(response.status).toBe(400); // Invalid UUID format
    });

    it('should validate request body', async () => {
      const response = await request(app)
        .post(`/api/reviewers/invitations/${reviewAssignment.id}/respond`)
        .set('Authorization', `Bearer ${reviewerToken}`)
        .send({
          response: 'INVALID_RESPONSE'
        });

      expect(response.status).toBe(400);
      expect(response.body.error.type).toBe('ValidationError');
    });
  });

  describe('POST /api/reviewers/assignments/:id/submit', () => {
    beforeEach(async () => {
      // Accept the review first
      await prisma.review_assignments.update({
        where: { id: reviewAssignment.id },
        data: { status: 'ACCEPTED' }
      });

      // Create review conversation
      await prisma.conversations.create({
        data: {
          title: 'Review Discussion',
          type: 'REVIEW',
          privacy: 'SEMI_PUBLIC',
          manuscriptId: manuscript.id
        }
      });
    });

    it('should submit a review successfully', async () => {
      const reviewData = {
        reviewContent: 'This manuscript presents interesting findings with solid methodology.',
        recommendation: 'MINOR_REVISION',
        score: 8,
        confidentialComments: 'The author could improve the conclusion section.'
      };

      const response = await request(app)
        .post(`/api/reviewers/assignments/${reviewAssignment.id}/submit`)
        .set('Authorization', `Bearer ${reviewerToken}`)
        .send(reviewData);

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('submitted successfully');
      expect(response.body.assignment.status).toBe('COMPLETED');
      expect(response.body.submission.reviewContent).toBe(reviewData.reviewContent);

      // Verify assignment was updated
      const updatedAssignment = await prisma.review_assignments.findUnique({
        where: { id: reviewAssignment.id }
      });
      expect(updatedAssignment?.status).toBe('COMPLETED');
      expect(updatedAssignment?.completedAt).toBeTruthy();

      // Verify review message was created
      const reviewMessages = await prisma.messages.findMany({
        where: {
          privacy: 'AUTHOR_VISIBLE',
          metadata: {
            path: ['type'],
            equals: 'review_submission'
          }
        }
      });
      expect(reviewMessages).toHaveLength(1);
      expect(reviewMessages[0].content).toContain('Review Submitted');
      expect(reviewMessages[0].content).toContain(reviewData.reviewContent);

      // Verify confidential comments were created separately
      const confidentialMessages = await prisma.messages.findMany({
        where: {
          privacy: 'EDITOR_ONLY',
          metadata: {
            path: ['type'],
            equals: 'confidential_review_comments'
          }
        }
      });
      expect(confidentialMessages).toHaveLength(1);
      expect(confidentialMessages[0].content).toContain(reviewData.confidentialComments);
    });

    it('should submit review without confidential comments', async () => {
      const reviewData = {
        reviewContent: 'Well-written manuscript with clear conclusions.',
        recommendation: 'ACCEPT',
        score: 9
      };

      const response = await request(app)
        .post(`/api/reviewers/assignments/${reviewAssignment.id}/submit`)
        .set('Authorization', `Bearer ${reviewerToken}`)
        .send(reviewData);

      expect(response.status).toBe(200);
      expect(response.body.submission.confidentialComments).toBeUndefined();

      // Verify no confidential message was created
      const confidentialMessages = await prisma.messages.findMany({
        where: {
          privacy: 'EDITOR_ONLY',
          metadata: {
            path: ['type'],
            equals: 'confidential_review_comments'
          }
        }
      });
      expect(confidentialMessages).toHaveLength(0);
    });

    it('should not allow submitting review with wrong status', async () => {
      // Set assignment to PENDING
      await prisma.review_assignments.update({
        where: { id: reviewAssignment.id },
        data: { status: 'PENDING' }
      });

      const response = await request(app)
        .post(`/api/reviewers/assignments/${reviewAssignment.id}/submit`)
        .set('Authorization', `Bearer ${reviewerToken}`)
        .send({
          reviewContent: 'Test review',
          recommendation: 'ACCEPT'
        });

      expect(response.status).toBe(400);
      expect(response.body.error.message).toContain('Cannot submit review for assignment with status');
    });

    it('should not allow non-assigned reviewer to submit', async () => {
      const otherReviewer = await createTestUser({ role: 'USER', email: 'other2@test.com' });
      const otherToken = generateTestToken(otherReviewer);

      const response = await request(app)
        .post(`/api/reviewers/assignments/${reviewAssignment.id}/submit`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send({
          reviewContent: 'Test review',
          recommendation: 'ACCEPT'
        });

      expect(response.status).toBe(403);
      expect(response.body.error.message).toContain('only submit reviews for your own');
    });

    it('should validate review content length', async () => {
      const response = await request(app)
        .post(`/api/reviewers/assignments/${reviewAssignment.id}/submit`)
        .set('Authorization', `Bearer ${reviewerToken}`)
        .send({
          reviewContent: 'Too short',
          recommendation: 'ACCEPT'
        });

      expect(response.status).toBe(400);
      expect(response.body.error.type).toBe('ValidationError');
      expect(response.body.error.details.reviewContent).toContain('at least 10 characters');
    });

    it('should validate recommendation enum', async () => {
      const response = await request(app)
        .post(`/api/reviewers/assignments/${reviewAssignment.id}/submit`)
        .set('Authorization', `Bearer ${reviewerToken}`)
        .send({
          reviewContent: 'This is a valid review with sufficient length.',
          recommendation: 'INVALID_RECOMMENDATION'
        });

      expect(response.status).toBe(400);
      expect(response.body.error.type).toBe('ValidationError');
    });

    it('should validate score range', async () => {
      const response = await request(app)
        .post(`/api/reviewers/assignments/${reviewAssignment.id}/submit`)
        .set('Authorization', `Bearer ${reviewerToken}`)
        .send({
          reviewContent: 'This is a valid review with sufficient length.',
          recommendation: 'ACCEPT',
          score: 15
        });

      expect(response.status).toBe(400);
      expect(response.body.error.type).toBe('ValidationError');
    });
  });

  describe('GET /api/reviewers/invitations/:id', () => {
    it('should get invitation details for assigned reviewer', async () => {
      const response = await request(app)
        .get(`/api/reviewers/invitations/${reviewAssignment.id}`)
        .set('Authorization', `Bearer ${reviewerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.invitation.id).toBe(reviewAssignment.id);
      expect(response.body.invitation.manuscript.title).toBe(manuscript.title);
      expect(response.body.invitation.reviewer.id).toBe(reviewer.id);
    });

    it('should not allow other users to view invitation details', async () => {
      const otherUser = await createTestUser({ role: 'USER', email: 'other3@test.com' });
      const otherToken = generateTestToken(otherUser);

      const response = await request(app)
        .get(`/api/reviewers/invitations/${reviewAssignment.id}`)
        .set('Authorization', `Bearer ${otherToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error.message).toContain('only view your own');
    });

    it('should return 404 for non-existent invitation', async () => {
      const fakeId = '123e4567-e89b-12d3-a456-426614174000';
      
      const response = await request(app)
        .get(`/api/reviewers/invitations/${fakeId}`)
        .set('Authorization', `Bearer ${reviewerToken}`);

      expect(response.status).toBe(404);
      expect(response.body.error.message).toContain('not found');
    });
  });
});