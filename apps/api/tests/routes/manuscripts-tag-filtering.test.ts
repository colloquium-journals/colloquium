import request from 'supertest';
import { jest } from '@jest/globals';
import { createMockUser, createMockArticle, createMockRequest, createMockResponse } from '../utils/testUtils';

// Mock prisma
const mockFindMany = jest.fn() as jest.MockedFunction<any>;
const mockCount = jest.fn() as jest.MockedFunction<any>;

const mockPrisma = {
  manuscripts: {
    findMany: mockFindMany,
    count: mockCount
  }
};

// Mock the database module
jest.mock('@colloquium/database', () => ({
  prisma: mockPrisma
}));

// Mock auth middleware to make tests simpler
jest.mock('../../src/middleware/auth', () => ({
  optionalAuth: (req: any, res: any, next: any) => next(),
  authenticate: (req: any, res: any, next: any) => {
    req.user = createMockUser();
    next();
  },
  authenticateWithBots: (req: any, res: any, next: any) => next(),
  requirePermission: () => (req: any, res: any, next: any) => next(),
  requireGlobalPermission: () => (req: any, res: any, next: any) => next(),
  generateBotServiceToken: jest.fn(() => 'mock-token'),
}));

// Import the route after mocking dependencies
import articlesRouter from '../../src/routes/articles';
import express from 'express';

const app = express();
app.use(express.json());
app.use('/api/articles', articlesRouter);

describe('Articles API - Tag Filtering', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/articles with tag filter', () => {
    // Sample data matching the Prisma response shape (with manuscript_authors and _count)
    const sampleArticles = [
      {
        id: '1',
        title: 'Machine Learning in Healthcare',
        abstract: 'A comprehensive study on ML applications in healthcare.',
        authors: ['Dr. Smith', 'Dr. Johnson'],
        keywords: ['machine learning', 'healthcare', 'AI'],
        status: 'PUBLISHED',
        publishedAt: '2024-01-15T00:00:00Z',
        updatedAt: '2024-01-15T00:00:00Z',
        fileUrl: null,
        doi: null,
        submittedAt: null,
        manuscript_authors: [
          { users: { id: '1', name: 'Dr. Smith', email: 'smith@example.com', orcidId: null, orcidVerified: false }, order: 1, isCorresponding: true },
          { users: { id: '2', name: 'Dr. Johnson', email: 'johnson@example.com', orcidId: null, orcidVerified: false }, order: 2, isCorresponding: false }
        ],
        _count: { conversations: 2 }
      },
      {
        id: '2',
        title: 'Deep Learning Applications',
        abstract: 'Exploring deep learning in various domains.',
        authors: ['Dr. Brown'],
        keywords: ['deep learning', 'neural networks', 'AI'],
        status: 'PUBLISHED',
        publishedAt: '2024-01-10T00:00:00Z',
        updatedAt: '2024-01-10T00:00:00Z',
        fileUrl: null,
        doi: null,
        submittedAt: null,
        manuscript_authors: [
          { users: { id: '3', name: 'Dr. Brown', email: 'brown@example.com', orcidId: null, orcidVerified: false }, order: 1, isCorresponding: true }
        ],
        _count: { conversations: 1 }
      },
      {
        id: '3',
        title: 'Quantum Computing Research',
        abstract: 'Recent advances in quantum computing.',
        authors: ['Dr. Wilson'],
        keywords: ['quantum computing', 'physics', 'algorithms'],
        status: 'PUBLISHED',
        publishedAt: '2024-01-05T00:00:00Z',
        updatedAt: '2024-01-05T00:00:00Z',
        fileUrl: null,
        doi: null,
        submittedAt: null,
        manuscript_authors: [
          { users: { id: '4', name: 'Dr. Wilson', email: 'wilson@example.com', orcidId: null, orcidVerified: false }, order: 1, isCorresponding: true }
        ],
        _count: { conversations: 0 }
      }
    ];

    it('should return all articles when no tag filter is provided', async () => {
      mockFindMany.mockResolvedValue(sampleArticles);
      mockCount.mockResolvedValue(3);

      const response = await request(app)
        .get('/api/articles')
        .expect(200);

      expect(response.body.manuscripts).toHaveLength(3);
      expect(response.body.pagination.total).toBe(3);
      
      // Verify that no tag filter was applied in the query
      const callArgs = mockFindMany.mock.calls[0][0] as any;
      expect(callArgs.where).not.toHaveProperty('keywords');
    });

    it('should filter articles by tag when tag parameter is provided', async () => {
      // Mock filtered results (only articles with 'healthcare' tag)
      const filteredArticles = [sampleArticles[0]]; // Only the first article has 'healthcare'
      mockFindMany.mockResolvedValue(filteredArticles);
      mockCount.mockResolvedValue(1);

      const response = await request(app)
        .get('/api/articles?tag=healthcare')
        .expect(200);

      expect(response.body.manuscripts).toHaveLength(1);
      expect(response.body.manuscripts[0].title).toBe('Machine Learning in Healthcare');
      expect(response.body.manuscripts[0].keywords).toContain('healthcare');
      expect(response.body.pagination.total).toBe(1);
      
      // Verify that tag filter was applied in the query
      const callArgs = mockFindMany.mock.calls[0][0] as any;
      expect(callArgs.where.keywords).toEqual({ has: 'healthcare' });
    });

    it('should filter articles by AI tag', async () => {
      // Mock filtered results (articles with 'AI' tag)
      const filteredArticles = [sampleArticles[0], sampleArticles[1]]; // First two have 'AI'
      mockFindMany.mockResolvedValue(filteredArticles);
      mockCount.mockResolvedValue(2);

      const response = await request(app)
        .get('/api/articles?tag=AI')
        .expect(200);

      expect(response.body.manuscripts).toHaveLength(2);
      expect(response.body.manuscripts[0].keywords).toContain('AI');
      expect(response.body.manuscripts[1].keywords).toContain('AI');
      expect(response.body.pagination.total).toBe(2);
      
      // Verify that tag filter was applied correctly
      const callArgs = mockFindMany.mock.calls[0][0] as any;
      expect(callArgs.where.keywords).toEqual({ has: 'AI' });
    });

    it('should return empty results when filtering by non-existent tag', async () => {
      mockFindMany.mockResolvedValue([]);
      mockCount.mockResolvedValue(0);

      const response = await request(app)
        .get('/api/articles?tag=nonexistent')
        .expect(200);

      expect(response.body.manuscripts).toHaveLength(0);
      expect(response.body.pagination.total).toBe(0);
      
      // Verify that tag filter was applied
      const callArgs = mockFindMany.mock.calls[0][0] as any;
      expect(callArgs.where.keywords).toEqual({ has: 'nonexistent' });
    });

    it('should combine tag filter with other filters', async () => {
      const filteredArticles = [sampleArticles[0]];
      mockFindMany.mockResolvedValue(filteredArticles);
      mockCount.mockResolvedValue(1);

      const response = await request(app)
        .get('/api/articles?tag=healthcare&search=machine&status=PUBLISHED')
        .expect(200);

      expect(response.body.manuscripts).toHaveLength(1);
      expect(response.body.pagination.total).toBe(1);
      
      // Verify that all filters were applied
      const callArgs = mockFindMany.mock.calls[0][0] as any;
      expect(callArgs.where.keywords).toEqual({ has: 'healthcare' });
      expect(callArgs.where.status).toEqual({ in: ['PUBLISHED', 'RETRACTED'] });
      expect(callArgs.where.OR).toBeDefined(); // Search filter
    });

    it('should handle tag filter with pagination', async () => {
      const filteredArticles = [sampleArticles[0]];
      mockFindMany.mockResolvedValue(filteredArticles);
      mockCount.mockResolvedValue(1);

      const response = await request(app)
        .get('/api/articles?tag=healthcare&page=1&limit=10')
        .expect(200);

      expect(response.body.manuscripts).toHaveLength(1);
      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(10);
      expect(response.body.pagination.total).toBe(1);
      
      // Verify pagination was applied
      const callArgs = mockFindMany.mock.calls[0][0] as any;
      expect(callArgs.skip).toBe(0);
      expect(callArgs.take).toBe(10);
      expect(callArgs.where.keywords).toEqual({ has: 'healthcare' });
    });

    it('should handle tag filter with sorting', async () => {
      const filteredArticles = [sampleArticles[0], sampleArticles[1]];
      mockFindMany.mockResolvedValue(filteredArticles);
      mockCount.mockResolvedValue(2);

      const response = await request(app)
        .get('/api/articles?tag=AI&orderBy=title&order=asc')
        .expect(200);

      expect(response.body.manuscripts).toHaveLength(2);
      
      // Verify sorting and filtering were applied
      const callArgs = mockFindMany.mock.calls[0][0] as any;
      expect(callArgs.where.keywords).toEqual({ has: 'AI' });
      expect(callArgs.orderBy).toEqual({ title: 'asc' });
    });

    it('should be case-sensitive for tag filtering', async () => {
      mockFindMany.mockResolvedValue([]);
      mockCount.mockResolvedValue(0);

      const response = await request(app)
        .get('/api/articles?tag=ai') // lowercase 'ai' instead of 'AI'
        .expect(200);

      expect(response.body.manuscripts).toHaveLength(0);
      expect(response.body.pagination.total).toBe(0);
      
      // Verify that exact case was used in filter
      const callArgs = mockFindMany.mock.calls[0][0] as any;
      expect(callArgs.where.keywords).toEqual({ has: 'ai' });
    });

    it('should handle URL-encoded tag names', async () => {
      const filteredArticles = [sampleArticles[0]];
      mockFindMany.mockResolvedValue(filteredArticles);
      mockCount.mockResolvedValue(1);

      const response = await request(app)
        .get('/api/articles?tag=machine%20learning') // URL-encoded space
        .expect(200);

      expect(response.body.manuscripts).toHaveLength(1);
      
      // Verify that decoded tag was used in filter
      const callArgs = mockFindMany.mock.calls[0][0] as any;
      expect(callArgs.where.keywords).toEqual({ has: 'machine learning' });
    });

    it('should handle empty tag parameter', async () => {
      mockFindMany.mockResolvedValue(sampleArticles);
      mockCount.mockResolvedValue(3);

      const response = await request(app)
        .get('/api/articles?tag=')
        .expect(200);

      expect(response.body.manuscripts).toHaveLength(3);
      
      // Verify that no tag filter was applied when tag is empty
      const callArgs = mockFindMany.mock.calls[0][0] as any;
      expect(callArgs.where).not.toHaveProperty('keywords');
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle database errors gracefully', async () => {
      mockFindMany.mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app)
        .get('/api/articles?tag=healthcare')
        .expect(500);

      // The error should be handled by the error middleware
      // Exact response format depends on error handler implementation
    });

    it('should handle very long tag names', async () => {
      const longTag = 'a'.repeat(1000);
      mockFindMany.mockResolvedValue([]);
      mockCount.mockResolvedValue(0);

      const response = await request(app)
        .get(`/api/articles?tag=${longTag}`)
        .expect(200);

      expect(response.body.manuscripts).toHaveLength(0);
      
      const callArgs = mockFindMany.mock.calls[0][0] as any;
      expect(callArgs.where.keywords).toEqual({ has: longTag });
    });

    it('should handle special characters in tag names', async () => {
      const specialTag = 'machine-learning@2024!';
      mockFindMany.mockResolvedValue([]);
      mockCount.mockResolvedValue(0);

      const response = await request(app)
        .get(`/api/articles?tag=${encodeURIComponent(specialTag)}`)
        .expect(200);

      expect(response.body.manuscripts).toHaveLength(0);
      
      const callArgs = mockFindMany.mock.calls[0][0] as any;
      expect(callArgs.where.keywords).toEqual({ has: specialTag });
    });
  });
});