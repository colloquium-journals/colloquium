import request from 'supertest';
import { jest } from '@jest/globals';
import { createMockUser } from '../utils/testUtils';

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

describe('Articles Search API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Sample data matching the Prisma response shape (with manuscript_authors and _count)
  const sampleArticles = [
    {
      id: '1',
      title: 'Machine Learning Research',
      abstract: 'A comprehensive study on machine learning algorithms',
      authors: ['Dr. John Smith', 'Dr. Sarah Johnson'],
      keywords: ['machine learning', 'algorithms', 'AI'],
      status: 'PUBLISHED',
      publishedAt: '2024-01-15T00:00:00Z',
      updatedAt: '2024-01-15T00:00:00Z',
      fileUrl: null,
      doi: null,
      submittedAt: null,
      _count: { conversations: 0 },
      manuscript_authors: [
        { users: { id: '1', name: 'Dr. John Smith', email: 'john.smith@university.edu', orcidId: null, orcidVerified: false }, order: 1, isCorresponding: true },
        { users: { id: '2', name: 'Dr. Sarah Johnson', email: 'sarah.johnson@university.edu', orcidId: null, orcidVerified: false }, order: 2, isCorresponding: false }
      ]
    },
    {
      id: '2',
      title: 'Deep Learning Applications',
      abstract: 'Exploring neural networks in computer vision',
      authors: ['Dr. Michael Brown', 'Dr. Emily Wilson'],
      keywords: ['deep learning', 'neural networks', 'computer vision'],
      status: 'PUBLISHED',
      publishedAt: '2024-01-10T00:00:00Z',
      updatedAt: '2024-01-10T00:00:00Z',
      fileUrl: null,
      doi: null,
      submittedAt: null,
      _count: { conversations: 0 },
      manuscript_authors: [
        { users: { id: '3', name: 'Dr. Michael Brown', email: 'michael.brown@tech.edu', orcidId: null, orcidVerified: false }, order: 1, isCorresponding: true },
        { users: { id: '4', name: 'Dr. Emily Wilson', email: 'emily.wilson@tech.edu', orcidId: null, orcidVerified: false }, order: 2, isCorresponding: false }
      ]
    },
    {
      id: '3',
      title: 'Quantum Computing Advances',
      abstract: 'Recent breakthroughs in quantum algorithms',
      authors: ['Dr. David Smith'],
      keywords: ['quantum computing', 'algorithms', 'physics'],
      status: 'PUBLISHED',
      publishedAt: '2024-01-05T00:00:00Z',
      updatedAt: '2024-01-05T00:00:00Z',
      fileUrl: null,
      doi: null,
      submittedAt: null,
      _count: { conversations: 0 },
      manuscript_authors: [
        { users: { id: '5', name: 'Dr. David Smith', email: 'david.smith@quantum.edu', orcidId: null, orcidVerified: false }, order: 1, isCorresponding: true }
      ]
    }
  ];

  describe('Author Search Functionality', () => {
    it('should find articles by exact author name', async () => {
      // Mock database response
      mockFindMany.mockResolvedValue([sampleArticles[0]]);
      mockCount.mockResolvedValue(1);

      const response = await request(app)
        .get('/api/articles')
        .query({ search: 'Dr. John Smith' })
        .expect(200);

      expect(response.body.manuscripts).toHaveLength(1);
      expect(response.body.manuscripts[0].title).toBe('Machine Learning Research');
      expect(response.body.manuscripts[0].authors).toContain('Dr. John Smith');

      // Verify the correct query was made
      const calls = mockFindMany.mock.calls[0];
      const whereClause = calls[0].where;
      expect(whereClause.OR).toBeDefined();
      expect(whereClause.OR).toEqual([
        { title: { contains: 'Dr. John Smith', mode: 'insensitive' } },
        { abstract: { contains: 'Dr. John Smith', mode: 'insensitive' } },
        { 
          manuscript_authors: {
            some: {
                users: {
                name: { contains: 'Dr. John Smith', mode: 'insensitive' }
              }
            }
          }
        },
        { authors: { hasSome: ['Dr. John Smith'] } }
      ]);
    });

    it('should find articles by partial author name (first name)', async () => {
      // Mock database response - should return articles that match "John"
      mockFindMany.mockResolvedValue([sampleArticles[0]]);
      mockCount.mockResolvedValue(1);

      const response = await request(app)
        .get('/api/articles')
        .query({ search: 'John' })
        .expect(200);

      expect(response.body.manuscripts.length).toBeGreaterThan(0);
      const foundArticle = response.body.manuscripts.find(
        (m: any) => m.title === 'Machine Learning Research'
      );
      expect(foundArticle).toBeDefined();

      // This test now verifies that partial matching works with authorRelations
      const calls = mockFindMany.mock.calls[0];
      const whereClause = calls[0].where;
      expect(whereClause.OR).toBeDefined();
      expect(whereClause.OR).toEqual([
        { title: { contains: 'John', mode: 'insensitive' } },
        { abstract: { contains: 'John', mode: 'insensitive' } },
        { 
          manuscript_authors: {
            some: {
                users: {
                name: { contains: 'John', mode: 'insensitive' }
              }
            }
          }
        },
        { authors: { hasSome: ['John'] } }
      ]);
    });

    it('should find articles by partial author name (last name)', async () => {
      // Mock database response - should return both Smith articles
      mockFindMany.mockResolvedValue([sampleArticles[0], sampleArticles[2]]);
      mockCount.mockResolvedValue(2);

      const response = await request(app)
        .get('/api/articles')
        .query({ search: 'Smith' })
        .expect(200);

      expect(response.body.manuscripts.length).toBe(2);
      
      // Should find both John Smith and David Smith articles
      const titles = response.body.manuscripts.map((m: any) => m.title);
      expect(titles).toContain('Machine Learning Research'); // Dr. John Smith
      expect(titles).toContain('Quantum Computing Advances'); // Dr. David Smith

      // Check the query structure
      const calls = mockFindMany.mock.calls[0];
      const whereClause = calls[0].where;
      expect(whereClause.OR[2]).toEqual({
        manuscript_authors: {
          some: {
              users: {
              name: { contains: 'Smith', mode: 'insensitive' }
            }
          }
        }
      });
    });

    it('should find articles by author name case insensitive', async () => {
      mockFindMany.mockResolvedValue([sampleArticles[0]]);
      mockCount.mockResolvedValue(1);

      const response = await request(app)
        .get('/api/articles')
        .query({ search: 'john smith' })
        .expect(200);

      expect(response.body.manuscripts.length).toBeGreaterThan(0);
      const foundArticle = response.body.manuscripts.find(
        (m: any) => m.title === 'Machine Learning Research'
      );
      expect(foundArticle).toBeDefined();

      // Verify case insensitive search
      const calls = mockFindMany.mock.calls[0];
      const whereClause = calls[0].where;
      expect(whereClause.OR[0].title.mode).toBe('insensitive');
      expect(whereClause.OR[1].abstract.mode).toBe('insensitive');
    });

    it('should not find articles with non-existent author names', async () => {
      mockFindMany.mockResolvedValue([]);
      mockCount.mockResolvedValue(0);

      const response = await request(app)
        .get('/api/articles')
        .query({ search: 'Dr. Nonexistent Author' })
        .expect(200);

      expect(response.body.manuscripts).toHaveLength(0);
      expect(response.body.pagination.total).toBe(0);
    });
  });

  describe('Current Search Implementation Analysis', () => {
    it('should reveal the current search structure for title, abstract, and authors', async () => {
      mockFindMany.mockResolvedValue([]);
      mockCount.mockResolvedValue(0);

      await request(app)
        .get('/api/articles')
        .query({ search: 'test search term' })
        .expect(200);

      // Analyze the actual query structure
      const calls = mockFindMany.mock.calls[0];
      const whereClause = calls[0].where;
      
      console.log('Current search query structure:', JSON.stringify(whereClause, null, 2));
      
      expect(whereClause.OR).toBeDefined();
      expect(whereClause.OR).toHaveLength(4);
      
      // Title search
      expect(whereClause.OR[0]).toEqual({
        title: { contains: 'test search term', mode: 'insensitive' }
      });
      
      // Abstract search
      expect(whereClause.OR[1]).toEqual({
        abstract: { contains: 'test search term', mode: 'insensitive' }
      });
      
      // Authors search - using manuscript_authors for proper partial matching
      expect(whereClause.OR[2]).toEqual({
        manuscript_authors: {
          some: {
              users: {
              name: { contains: 'test search term', mode: 'insensitive' }
            }
          }
        }
      });
      
      // Legacy authors search for backward compatibility
      expect(whereClause.OR[3]).toEqual({
        authors: { hasSome: ['test search term'] }
      });
    });

    it('should now support partial author matching with manuscript_authors', async () => {
      mockFindMany.mockResolvedValue([]);
      mockCount.mockResolvedValue(0);

      await request(app)
        .get('/api/articles')
        .query({ search: 'Smith' })
        .expect(200);

      const calls = mockFindMany.mock.calls[0];
      const whereClause = calls[0].where;

      // The implementation uses manuscript_authors with contains for partial matching
      expect(whereClause.OR[2]).toEqual({
        manuscript_authors: {
          some: {
              users: {
              name: { contains: 'Smith', mode: 'insensitive' }
            }
          }
        }
      });
      
      // This means searching for "Smith" WILL find "Dr. John Smith" 
      // because contains looks for substring matches in author names
    });
  });

  describe('Combined Search Functionality', () => {
    it('should combine search with tag filtering', async () => {
      mockFindMany.mockResolvedValue([sampleArticles[0]]);
      mockCount.mockResolvedValue(1);

      const response = await request(app)
        .get('/api/articles')
        .query({ 
          search: 'Smith',
          tag: 'algorithms'
        })
        .expect(200);

      // Verify that both search and tag filters are applied
      const calls = mockFindMany.mock.calls[0];
      const whereClause = calls[0].where;
      
      expect(whereClause.OR).toBeDefined(); // Search functionality
      expect(whereClause.keywords).toEqual({ has: 'algorithms' }); // Tag filtering
    });
  });

  describe('Search Edge Cases', () => {
    it('should handle empty search queries', async () => {
      mockFindMany.mockResolvedValue(sampleArticles);
      mockCount.mockResolvedValue(3);

      const response = await request(app)
        .get('/api/articles')
        .query({ search: '' })
        .expect(200);

      // Should return all published articles when search is empty
      expect(response.body.manuscripts.length).toBe(3);
      
      // Verify no OR clause is added for empty search
      const calls = mockFindMany.mock.calls[0];
      const whereClause = calls[0].where;
      expect(whereClause.OR).toBeUndefined();
    });

    it('should handle search queries with special characters', async () => {
      mockFindMany.mockResolvedValue([]);
      mockCount.mockResolvedValue(0);

      const response = await request(app)
        .get('/api/articles')
        .query({ search: 'Dr. John Smith!' })
        .expect(200);

      // Should handle special characters gracefully
      expect(response.status).toBe(200);
      
      const calls = mockFindMany.mock.calls[0];
      const whereClause = calls[0].where;
      expect(whereClause.OR[0].title.contains).toBe('Dr. John Smith!');
    });
  });
});