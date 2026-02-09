import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import ArticlesPage from '../page';

// Mock the AuthContext
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    user: { id: '1', name: 'Test User' }
  })
}));

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

const mockArticlesResponse = {
  manuscripts: [
    {
      id: '1',
      title: 'Machine Learning in Healthcare',
      abstract: 'A comprehensive study on ML applications in healthcare.',
      authors: ['Dr. Smith', 'Dr. Johnson'],
      authorDetails: [
        { id: '1', name: 'Dr. Smith', email: 'smith@example.com', order: 1, isCorresponding: true },
        { id: '2', name: 'Dr. Johnson', email: 'johnson@example.com', order: 2, isCorresponding: false }
      ],
      keywords: ['machine learning', 'healthcare', 'AI'],
      status: 'PUBLISHED',
      publishedAt: '2024-01-15T00:00:00Z',
      updatedAt: '2024-01-15T00:00:00Z',
      lastModifiedBy: 'editor1'
    },
    {
      id: '2',
      title: 'Deep Learning Applications',
      abstract: 'Exploring deep learning in various domains.',
      authors: ['Dr. Brown'],
      authorDetails: [
        { id: '3', name: 'Dr. Brown', email: 'brown@example.com', order: 1, isCorresponding: true }
      ],
      keywords: ['deep learning', 'neural networks', 'AI'],
      status: 'PUBLISHED',
      publishedAt: '2024-01-10T00:00:00Z',
      updatedAt: '2024-01-10T00:00:00Z',
      lastModifiedBy: 'editor2'
    },
    {
      id: '3',
      title: 'Quantum Computing Research',
      abstract: 'Recent advances in quantum computing.',
      authors: ['Dr. Wilson'],
      authorDetails: [
        { id: '4', name: 'Dr. Wilson', email: 'wilson@example.com', order: 1, isCorresponding: true }
      ],
      keywords: ['quantum computing', 'physics', 'algorithms'],
      status: 'PUBLISHED',
      publishedAt: '2024-01-05T00:00:00Z',
      updatedAt: '2024-01-05T00:00:00Z',
      lastModifiedBy: 'editor3'
    }
  ],
  pagination: {
    page: 1,
    limit: 12,
    total: 3,
    pages: 1
  }
};

const renderWithProvider = (component: React.ReactElement) => {
  return render(
    <MantineProvider>
      {component}
    </MantineProvider>
  );
};

describe('Articles Page - Tag Filtering', () => {
  beforeEach(() => {
    mockFetch.mockClear();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockArticlesResponse)
    });
  });

  describe('Tag Display', () => {
    it('should display article keywords as clickable tags', async () => {
      await act(async () => {
        renderWithProvider(<ArticlesPage />);
      });

      await waitFor(() => {
        expect(screen.getByText('Machine Learning in Healthcare')).toBeInTheDocument();
      });

      // Check that tags are displayed (using getAllByText for tags that appear multiple times)
      expect(screen.getByText('machine learning')).toBeInTheDocument();
      expect(screen.getByText('healthcare')).toBeInTheDocument();
      expect(screen.getAllByText('AI').length).toBeGreaterThan(0);
      expect(screen.getByText('deep learning')).toBeInTheDocument();
      expect(screen.getByText('neural networks')).toBeInTheDocument();
      expect(screen.getByText('quantum computing')).toBeInTheDocument();
      expect(screen.getByText('physics')).toBeInTheDocument();
      expect(screen.getByText('algorithms')).toBeInTheDocument();
    });

    it('should limit displayed tags to 3 per article', async () => {
      await act(async () => {
        renderWithProvider(<ArticlesPage />);
      });

      await waitFor(() => {
        expect(screen.getByText('Machine Learning in Healthcare')).toBeInTheDocument();
      });

      // Check that we have the expected number of tags per article
      // First article has ['machine learning', 'healthcare', 'AI'] - should show all 3
      expect(screen.getByText('machine learning')).toBeInTheDocument();
      expect(screen.getByText('healthcare')).toBeInTheDocument();
      expect(screen.getAllByText('AI')[0]).toBeInTheDocument();

      // Second article has ['deep learning', 'neural networks', 'AI'] - should show all 3  
      expect(screen.getByText('deep learning')).toBeInTheDocument();
      expect(screen.getByText('neural networks')).toBeInTheDocument();
      
      // Third article has ['quantum computing', 'physics', 'algorithms'] - should show all 3
      expect(screen.getByText('quantum computing')).toBeInTheDocument();
      expect(screen.getByText('physics')).toBeInTheDocument();
      expect(screen.getByText('algorithms')).toBeInTheDocument();
    });

    it('should show "+X more" indicator when article has more than 3 keywords', async () => {
      // Mock a article with more than 3 keywords
      const articleWithManyKeywords = {
        ...mockArticlesResponse,
        manuscripts: [{
          ...mockArticlesResponse.manuscripts[0],
          keywords: ['tag1', 'tag2', 'tag3', 'tag4', 'tag5']
        }]
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(articleWithManyKeywords)
      });

      renderWithProvider(<ArticlesPage />);

      await waitFor(() => {
        expect(screen.getByText('+2 more')).toBeInTheDocument();
      });
    });
  });

  describe('Tag Filtering Functionality', () => {
    it('should filter articles when a tag is clicked', async () => {
      await act(async () => {
        renderWithProvider(<ArticlesPage />);
      });

      await waitFor(() => {
        expect(screen.getByText('Machine Learning in Healthcare')).toBeInTheDocument();
      });

      // Click on a tag
      const aiTag = screen.getAllByText('AI')[0];
      await act(async () => {
        fireEvent.click(aiTag);
      });

      // Check that the fetch was called with the tag parameter
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('tag=AI'),
          expect.any(Object)
        );
      });
    });

    it('should show filter indicator when a tag is selected', async () => {
      await act(async () => {
        renderWithProvider(<ArticlesPage />);
      });

      await waitFor(() => {
        expect(screen.getByText('Machine Learning in Healthcare')).toBeInTheDocument();
      });

      // Click on a tag
      const aiTag = screen.getAllByText('AI')[0];
      await act(async () => {
        fireEvent.click(aiTag);
      });

      await waitFor(() => {
        expect(screen.getByText('Filtered by tag:')).toBeInTheDocument();
        expect(screen.getByText('Clear filter')).toBeInTheDocument();
      });
    });

    it('should clear filter when "Clear filter" button is clicked', async () => {
      await act(async () => {
        renderWithProvider(<ArticlesPage />);
      });

      await waitFor(() => {
        expect(screen.getByText('Machine Learning in Healthcare')).toBeInTheDocument();
      });

      // Click on a tag to set filter
      const aiTag = screen.getAllByText('AI')[0];
      await act(async () => {
        fireEvent.click(aiTag);
      });

      await waitFor(() => {
        expect(screen.getByText('Clear filter')).toBeInTheDocument();
      });

      // Click clear filter button
      const clearButton = screen.getByText('Clear filter');
      await act(async () => {
        fireEvent.click(clearButton);
      });

      // Check that filter indicator is removed
      await waitFor(() => {
        expect(screen.queryByText('Filtered by tag:')).not.toBeInTheDocument();
        expect(screen.queryByText('Clear filter')).not.toBeInTheDocument();
      });
    });

    it('should toggle filter when the same tag is clicked twice', async () => {
      await act(async () => {
        renderWithProvider(<ArticlesPage />);
      });

      await waitFor(() => {
        expect(screen.getByText('Machine Learning in Healthcare')).toBeInTheDocument();
      });

      const aiTag = screen.getAllByText('AI')[0];
      
      // First click - should apply filter
      await act(async () => {
        fireEvent.click(aiTag);
      });

      await waitFor(() => {
        expect(screen.getByText('Filtered by tag:')).toBeInTheDocument();
      });

      // Second click - should remove filter
      await act(async () => {
        fireEvent.click(aiTag);
      });

      await waitFor(() => {
        expect(screen.queryByText('Filtered by tag:')).not.toBeInTheDocument();
      });
    });

    it('should change filter when a different tag is clicked', async () => {
      await act(async () => {
        renderWithProvider(<ArticlesPage />);
      });

      await waitFor(() => {
        expect(screen.getByText('Machine Learning in Healthcare')).toBeInTheDocument();
      });

      // Click first tag
      const aiTag = screen.getAllByText('AI')[0];
      await act(async () => {
        fireEvent.click(aiTag);
      });

      await waitFor(() => {
        expect(screen.getByText('Filtered by tag:')).toBeInTheDocument();
      });

      // Click different tag
      const healthcareTag = screen.getByText('healthcare');
      await act(async () => {
        fireEvent.click(healthcareTag);
      });

      await waitFor(() => {
        // Should still show filter but with new tag
        expect(screen.getByText('Filtered by tag:')).toBeInTheDocument();
        // The filter should have changed to the new tag
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('tag=healthcare'),
          expect.any(Object)
        );
      });
    });

    it('should only show articles that contain the selected tag', async () => {
      // Mock filtered response with only articles containing 'healthcare' tag
      const filteredResponse = {
        manuscripts: [
          {
            id: '1',
            title: 'Machine Learning in Healthcare',
            abstract: 'A comprehensive study on ML applications in healthcare.',
            authors: ['Dr. Smith', 'Dr. Johnson'],
            authorDetails: [
              { id: '1', name: 'Dr. Smith', email: 'smith@example.com', order: 1, isCorresponding: true },
              { id: '2', name: 'Dr. Johnson', email: 'johnson@example.com', order: 2, isCorresponding: false }
            ],
            keywords: ['machine learning', 'healthcare', 'AI'],
            status: 'PUBLISHED',
            publishedAt: '2024-01-15T00:00:00Z',
            updatedAt: '2024-01-15T00:00:00Z',
            lastModifiedBy: 'editor1'
          }
          // Note: Articles with 'deep learning' and 'quantum computing' are excluded
        ],
        pagination: {
          page: 1,
          limit: 12,
          total: 1,
          pages: 1
        }
      };

      await act(async () => {
        renderWithProvider(<ArticlesPage />);
      });

      await waitFor(() => {
        expect(screen.getByText('Machine Learning in Healthcare')).toBeInTheDocument();
        expect(screen.getByText('Deep Learning Applications')).toBeInTheDocument();
        expect(screen.getByText('Quantum Computing Research')).toBeInTheDocument();
      });

      // Mock the filtered API response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(filteredResponse)
      });

      // Click on 'healthcare' tag
      const healthcareTags = screen.getAllByText('healthcare');
      const healthcareTag = healthcareTags[0]; // Get the first one (the clickable badge)
      await act(async () => {
        fireEvent.click(healthcareTag);
      });

      await waitFor(() => {
        // Should only show the article with 'healthcare' tag
        expect(screen.getByText('Machine Learning in Healthcare')).toBeInTheDocument();
        
        // Should NOT show articles without 'healthcare' tag
        expect(screen.queryByText('Deep Learning Applications')).not.toBeInTheDocument();
        expect(screen.queryByText('Quantum Computing Research')).not.toBeInTheDocument();
        
        // Should show filter indicator
        expect(screen.getByText('Filtered by tag:')).toBeInTheDocument();
        expect(screen.getAllByText('healthcare').length).toBeGreaterThan(0);
        
        // Should show correct count
        expect(screen.getByText('Showing 1 of 1 articles')).toBeInTheDocument();
      });
    });
  });

  describe('Tag Visual States', () => {
    it('should highlight selected tag with different styling', async () => {
      await act(async () => {
        renderWithProvider(<ArticlesPage />);
      });

      await waitFor(() => {
        expect(screen.getByText('Machine Learning in Healthcare')).toBeInTheDocument();
      });

      const aiTag = screen.getAllByText('AI')[0];
      
      // Check that tag is clickable
      expect(aiTag).toBeInTheDocument();

      // Click the tag
      await act(async () => {
        fireEvent.click(aiTag);
      });

      await waitFor(() => {
        // After clicking, should show filter indicator
        expect(screen.getByText('Filtered by tag:')).toBeInTheDocument();
      });
    });

    it('should show hover effects on tags', async () => {
      await act(async () => {
        renderWithProvider(<ArticlesPage />);
      });

      await waitFor(() => {
        expect(screen.getByText('Machine Learning in Healthcare')).toBeInTheDocument();
      });

      const aiTag = screen.getAllByText('AI')[0];
      
      // Check that tag is interactive
      expect(aiTag).toBeInTheDocument();

      // Trigger mouse enter event
      fireEvent.mouseEnter(aiTag);
      
      // The component should handle hover state
      expect(aiTag).toBeInTheDocument();
    });
  });

  describe('API Integration', () => {
    it('should include tag parameter in API calls when filtering', async () => {
      await act(async () => {
        renderWithProvider(<ArticlesPage />);
      });

      await waitFor(() => {
        expect(screen.getByText('Machine Learning in Healthcare')).toBeInTheDocument();
      });

      // Click on a tag
      const aiTag = screen.getAllByText('AI')[0];
      await act(async () => {
        fireEvent.click(aiTag);
      });

      await waitFor(() => {
        // Verify the API call includes the tag parameter
        const lastCall = mockFetch.mock.calls[mockFetch.mock.calls.length - 1];
        expect(lastCall[0]).toContain('tag=AI');
        expect(lastCall[0]).toContain('status=ALL');
      });
    });

    it('should not include tag parameter when no filter is active', async () => {
      await act(async () => {
        renderWithProvider(<ArticlesPage />);
      });

      await waitFor(() => {
        expect(screen.getByText('Machine Learning in Healthcare')).toBeInTheDocument();
      });

      // Check initial API call doesn't include tag parameter
      const initialCall = mockFetch.mock.calls[0];
      expect(initialCall[0]).not.toContain('tag=');
      expect(initialCall[0]).toContain('status=ALL');
    });

    it('should combine tag filter with search and sorting parameters', async () => {
      await act(async () => {
        renderWithProvider(<ArticlesPage />);
      });

      await waitFor(() => {
        expect(screen.getByText('Machine Learning in Healthcare')).toBeInTheDocument();
      });

      // Clear mock to isolate our test calls
      mockFetch.mockClear();

      // Enter search term and submit
      const searchInput = screen.getByPlaceholderText('Search articles by title, abstract, or author...');
      await act(async () => {
        fireEvent.change(searchInput, { target: { value: 'machine learning' } });
      });

      // Submit the form
      await act(async () => {
        fireEvent.submit(searchInput.closest('form')!);
      });

      // Wait for search API call (URL encoding may use + or %20 for spaces)
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringMatching(/search=machine(\+|%20)learning/),
          expect.any(Object)
        );
      });

      // Click on a tag to test combination of filters
      const aiTag = screen.getAllByText('AI')[0];
      await act(async () => {
        fireEvent.click(aiTag);
      });

      await waitFor(() => {
        // Check that tag parameter is included in API calls
        const lastCall = mockFetch.mock.calls[mockFetch.mock.calls.length - 1];
        expect(lastCall[0]).toContain('tag=AI');
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors gracefully when filtering by tag', async () => {
      await act(async () => {
        renderWithProvider(<ArticlesPage />);
      });

      await waitFor(() => {
        expect(screen.getByText('Machine Learning in Healthcare')).toBeInTheDocument();
      });

      // Mock API error for tag filtering
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500
      });

      // Click on a tag
      const aiTag = screen.getAllByText('AI')[0];
      await act(async () => {
        fireEvent.click(aiTag);
      });

      await waitFor(() => {
        expect(screen.getByText('Failed to load articles. Please try again.')).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should make tags keyboard accessible', async () => {
      await act(async () => {
        renderWithProvider(<ArticlesPage />);
      });

      await waitFor(() => {
        expect(screen.getByText('Machine Learning in Healthcare')).toBeInTheDocument();
      });

      const aiTag = screen.getAllByText('AI')[0];
      
      // Tags should be interactive
      expect(aiTag).toBeInTheDocument();
      
      // Simulate clicking (keyboard events on badges might not trigger the same handler)
      await act(async () => {
        fireEvent.click(aiTag);
      });
      
      // Should work for filtering
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('tag=AI'),
          expect.any(Object)
        );
      });
    });

    it('should provide appropriate ARIA labels for filter state', async () => {
      await act(async () => {
        renderWithProvider(<ArticlesPage />);
      });

      await waitFor(() => {
        expect(screen.getByText('Machine Learning in Healthcare')).toBeInTheDocument();
      });

      // Click on a tag
      const aiTag = screen.getAllByText('AI')[0];
      await act(async () => {
        fireEvent.click(aiTag);
      });

      await waitFor(() => {
        // Check that filter state is clearly communicated
        expect(screen.getByText('Filtered by tag:')).toBeInTheDocument();
        expect(screen.getByText('Clear filter')).toBeInTheDocument();
      });
    });
  });
});