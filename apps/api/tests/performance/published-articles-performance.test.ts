import request from 'supertest';
import app from '../../src/app';

describe('Published Articles Performance Tests', () => {
  const PERFORMANCE_THRESHOLD_MS = 1000; // 1 second max response time
  const LOAD_TEST_CONCURRENT_REQUESTS = 10;
  const SEARCH_PERFORMANCE_THRESHOLD_MS = 2000; // 2 seconds for search

  // Helper to measure response time
  const measureResponseTime = async (requestPromise: Promise<any>) => {
    const startTime = Date.now();
    const response = await requestPromise;
    const responseTime = Date.now() - startTime;
    return { response, responseTime };
  };

  // Helper to run concurrent requests
  const runConcurrentRequests = async (requestFactory: () => Promise<any>, count: number) => {
    const promises = Array(count).fill(null).map(() => requestFactory());
    const startTime = Date.now();
    const results = await Promise.all(promises);
    const totalTime = Date.now() - startTime;
    return { results, totalTime, averageTime: totalTime / count };
  };

  describe('Basic Published Articles Listing Performance', () => {
    it('should respond to published articles request within performance threshold', async () => {
      const { response, responseTime } = await measureResponseTime(
        request(app).get('/api/manuscripts/published')
      );

      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLD_MS);
      
      console.log(`Published articles response time: ${responseTime}ms`);
    });

    it('should handle pagination efficiently', async () => {
      const { response, responseTime } = await measureResponseTime(
        request(app)
          .get('/api/manuscripts/published')
          .query({ page: 1, limit: 20 })
      );

      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLD_MS);
      
      console.log(`Paginated articles response time: ${responseTime}ms`);
    });

    it('should handle large page sizes reasonably', async () => {
      const { response, responseTime } = await measureResponseTime(
        request(app)
          .get('/api/manuscripts/published')
          .query({ page: 1, limit: 100 })
      );

      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLD_MS * 2); // Allow 2x threshold for large pages
      
      console.log(`Large page response time: ${responseTime}ms`);
    });
  });

  describe('Search Performance', () => {
    it('should perform title search within threshold', async () => {
      const { response, responseTime } = await measureResponseTime(
        request(app)
          .get('/api/manuscripts/published')
          .query({ search: 'research' })
      );

      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(SEARCH_PERFORMANCE_THRESHOLD_MS);
      
      console.log(`Title search response time: ${responseTime}ms`);
    });

    it('should perform abstract search within threshold', async () => {
      const { response, responseTime } = await measureResponseTime(
        request(app)
          .get('/api/manuscripts/published')
          .query({ search: 'methodology' })
      );

      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(SEARCH_PERFORMANCE_THRESHOLD_MS);
      
      console.log(`Abstract search response time: ${responseTime}ms`);
    });

    it('should perform author search within threshold', async () => {
      const { response, responseTime } = await measureResponseTime(
        request(app)
          .get('/api/manuscripts/published')
          .query({ search: 'smith' })
      );

      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(SEARCH_PERFORMANCE_THRESHOLD_MS);
      
      console.log(`Author search response time: ${responseTime}ms`);
    });

    it('should handle empty search efficiently', async () => {
      const { response, responseTime } = await measureResponseTime(
        request(app)
          .get('/api/manuscripts/published')
          .query({ search: '' })
      );

      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLD_MS);
      
      console.log(`Empty search response time: ${responseTime}ms`);
    });

    it('should handle special characters in search', async () => {
      const { response, responseTime } = await measureResponseTime(
        request(app)
          .get('/api/manuscripts/published')
          .query({ search: 'α-β γ-δ' })
      );

      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(SEARCH_PERFORMANCE_THRESHOLD_MS);
      
      console.log(`Special character search response time: ${responseTime}ms`);
    });
  });

  describe('Filtering Performance', () => {
    it('should perform tag filtering within threshold', async () => {
      const { response, responseTime } = await measureResponseTime(
        request(app)
          .get('/api/manuscripts/published')
          .query({ tags: 'biology,chemistry' })
      );

      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLD_MS);
      
      console.log(`Tag filtering response time: ${responseTime}ms`);
    });

    it('should perform date range filtering within threshold', async () => {
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      
      const { response, responseTime } = await measureResponseTime(
        request(app)
          .get('/api/manuscripts/published')
          .query({ 
            publishedAfter: oneYearAgo.toISOString(),
            publishedBefore: new Date().toISOString()
          })
      );

      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLD_MS);
      
      console.log(`Date filtering response time: ${responseTime}ms`);
    });

    it('should perform combined filtering within threshold', async () => {
      const { response, responseTime } = await measureResponseTime(
        request(app)
          .get('/api/manuscripts/published')
          .query({ 
            search: 'research',
            tags: 'biology',
            limit: 20
          })
      );

      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(SEARCH_PERFORMANCE_THRESHOLD_MS);
      
      console.log(`Combined filtering response time: ${responseTime}ms`);
    });
  });

  describe('Load Testing', () => {
    it('should handle concurrent published articles requests', async () => {
      const { results, totalTime, averageTime } = await runConcurrentRequests(
        () => request(app).get('/api/manuscripts/published'),
        LOAD_TEST_CONCURRENT_REQUESTS
      );

      // All requests should succeed
      results.forEach(response => {
        expect(response.status).toBe(200);
      });

      // Average response time should be reasonable
      expect(averageTime).toBeLessThan(PERFORMANCE_THRESHOLD_MS * 2);
      
      console.log(`${LOAD_TEST_CONCURRENT_REQUESTS} concurrent requests:`);
      console.log(`  Total time: ${totalTime}ms`);
      console.log(`  Average time: ${averageTime}ms`);
      console.log(`  Requests per second: ${(LOAD_TEST_CONCURRENT_REQUESTS * 1000 / totalTime).toFixed(2)}`);
    });

    it('should handle concurrent search requests', async () => {
      const searchTerms = ['research', 'biology', 'chemistry', 'physics', 'medicine'];
      
      const { results, totalTime, averageTime } = await runConcurrentRequests(
        () => {
          const randomTerm = searchTerms[Math.floor(Math.random() * searchTerms.length)];
          return request(app)
            .get('/api/manuscripts/published')
            .query({ search: randomTerm });
        },
        LOAD_TEST_CONCURRENT_REQUESTS
      );

      // All requests should succeed
      results.forEach(response => {
        expect(response.status).toBe(200);
      });

      // Average response time should be reasonable
      expect(averageTime).toBeLessThan(SEARCH_PERFORMANCE_THRESHOLD_MS * 2);
      
      console.log(`${LOAD_TEST_CONCURRENT_REQUESTS} concurrent search requests:`);
      console.log(`  Total time: ${totalTime}ms`);
      console.log(`  Average time: ${averageTime}ms`);
    });

    it('should handle mixed concurrent requests', async () => {
      const requestTypes = [
        () => request(app).get('/api/manuscripts/published'),
        () => request(app).get('/api/manuscripts/published').query({ search: 'research' }),
        () => request(app).get('/api/manuscripts/published').query({ tags: 'biology' }),
        () => request(app).get('/api/manuscripts/published').query({ page: 2, limit: 10 }),
      ];

      const { results, totalTime, averageTime } = await runConcurrentRequests(
        () => {
          const randomRequest = requestTypes[Math.floor(Math.random() * requestTypes.length)];
          return randomRequest();
        },
        LOAD_TEST_CONCURRENT_REQUESTS
      );

      // All requests should succeed
      results.forEach(response => {
        expect(response.status).toBe(200);
      });

      // Average response time should be reasonable
      expect(averageTime).toBeLessThan(SEARCH_PERFORMANCE_THRESHOLD_MS * 2);
      
      console.log(`${LOAD_TEST_CONCURRENT_REQUESTS} mixed concurrent requests:`);
      console.log(`  Total time: ${totalTime}ms`);
      console.log(`  Average time: ${averageTime}ms`);
    });
  });

  describe('Response Size and Efficiency', () => {
    it('should return appropriate response sizes', async () => {
      const response = await request(app)
        .get('/api/manuscripts/published')
        .query({ limit: 50 });

      expect(response.status).toBe(200);

      // Check response structure and size efficiency
      const responseBody = JSON.stringify(response.body);
      const responseSizeKB = Buffer.byteLength(responseBody, 'utf8') / 1024;
      
      console.log(`Response size for 50 articles: ${responseSizeKB.toFixed(2)} KB`);
      
      // Response should be reasonable size (less than 1MB for 50 articles)
      expect(responseSizeKB).toBeLessThan(1024);

      // Should include expected fields
      const manuscripts = response.body.manuscripts || response.body.data || [];
      if (manuscripts.length > 0) {
        const sampleManuscript = manuscripts[0];
        expect(sampleManuscript).toHaveProperty('id');
        expect(sampleManuscript).toHaveProperty('title');
        expect(sampleManuscript).toHaveProperty('status');
      }
    });

    it('should handle empty results efficiently', async () => {
      const { response, responseTime } = await measureResponseTime(
        request(app)
          .get('/api/manuscripts/published')
          .query({ search: 'xyzzzzveryrareterm' })
      );

      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLD_MS);
      
      // Response should still have proper structure
      expect(response.body).toBeInstanceOf(Object);
      const manuscripts = response.body.manuscripts || response.body.data || [];
      expect(Array.isArray(manuscripts)).toBe(true);
      
      console.log(`Empty results response time: ${responseTime}ms`);
    });
  });

  describe('Error Handling Performance', () => {
    it('should handle invalid query parameters efficiently', async () => {
      const { response, responseTime } = await measureResponseTime(
        request(app)
          .get('/api/manuscripts/published')
          .query({ 
            page: 'invalid',
            limit: 'notanumber',
            tags: null
          })
      );

      // Should either return 400 (bad request) or handle gracefully
      expect([200, 400]).toContain(response.status);
      expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLD_MS);
      
      console.log(`Invalid parameters response time: ${responseTime}ms`);
    });

    it('should handle very large page numbers efficiently', async () => {
      const { response, responseTime } = await measureResponseTime(
        request(app)
          .get('/api/manuscripts/published')
          .query({ page: 999999, limit: 20 })
      );

      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLD_MS);
      
      console.log(`Large page number response time: ${responseTime}ms`);
    });

    it('should handle very long search terms efficiently', async () => {
      const longSearchTerm = 'a'.repeat(1000);
      
      const { response, responseTime } = await measureResponseTime(
        request(app)
          .get('/api/manuscripts/published')
          .query({ search: longSearchTerm })
      );

      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(SEARCH_PERFORMANCE_THRESHOLD_MS);
      
      console.log(`Long search term response time: ${responseTime}ms`);
    });
  });

  describe('Caching and Optimization', () => {
    it('should benefit from repeat requests (caching)', async () => {
      // First request
      const { response: firstResponse, responseTime: firstTime } = await measureResponseTime(
        request(app).get('/api/manuscripts/published')
      );

      expect(firstResponse.status).toBe(200);

      // Wait a bit to ensure any async operations complete
      await new Promise(resolve => setTimeout(resolve, 100));

      // Second identical request
      const { response: secondResponse, responseTime: secondTime } = await measureResponseTime(
        request(app).get('/api/manuscripts/published')
      );

      expect(secondResponse.status).toBe(200);

      console.log(`First request: ${firstTime}ms`);
      console.log(`Second request: ${secondTime}ms`);
      
      // Both should be within threshold
      expect(firstTime).toBeLessThan(PERFORMANCE_THRESHOLD_MS);
      expect(secondTime).toBeLessThan(PERFORMANCE_THRESHOLD_MS);
      
      // Optionally check if second request is faster (caching effect)
      // Note: This might not always be true depending on implementation
      if (secondTime < firstTime * 0.8) {
        console.log('✓ Caching appears to be working');
      }
    });

    it('should handle query parameter variations efficiently', async () => {
      const variations = [
        {},
        { limit: 10 },
        { limit: 20 },
        { page: 2 },
        { search: 'test' },
        { tags: 'biology' }
      ];

      const results = [];
      
      for (const params of variations) {
        const { response, responseTime } = await measureResponseTime(
          request(app)
            .get('/api/manuscripts/published')
            .query(params)
        );

        expect(response.status).toBe(200);
        expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLD_MS);
        
        results.push({ params, responseTime });
      }

      const averageTime = results.reduce((sum, r) => sum + r.responseTime, 0) / results.length;
      console.log(`Average response time across variations: ${averageTime.toFixed(2)}ms`);
      
      // Log individual times for analysis
      results.forEach(({ params, responseTime }) => {
        console.log(`  ${JSON.stringify(params)}: ${responseTime}ms`);
      });
    });
  });
});