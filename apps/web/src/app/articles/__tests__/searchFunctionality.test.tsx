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
      abstract: 'A comprehensive study on ML applications in healthcare settings.',
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
      abstract: 'Exploring deep learning techniques in various domains.',
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
      abstract: 'Recent advances in quantum computing algorithms and hardware.',
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

describe('Articles Page - Search Functionality', () => {
  beforeEach(() => {
    mockFetch.mockClear();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockArticlesResponse)
    });
  });

  describe('Search Input', () => {
    it('should render search input with correct placeholder', async () => {
      await act(async () => {
        renderWithProvider(<ArticlesPage />);
      });

      const searchInput = screen.getByPlaceholderText('Search articles by title, abstract, or author...');
      expect(searchInput).toBeInTheDocument();
      expect(searchInput.tagName).toBe('INPUT');
    });

    it('should update search input value when typing', async () => {
      await act(async () => {
        renderWithProvider(<ArticlesPage />);
      });

      const searchInput = screen.getByPlaceholderText('Search articles by title, abstract, or author...');
      
      await act(async () => {
        fireEvent.change(searchInput, { target: { value: 'machine learning' } });
      });

      expect(searchInput).toHaveValue('machine learning');
    });

    it('should have search icon in input field', async () => {
      await act(async () => {
        renderWithProvider(<ArticlesPage />);
      });

      // The search icon should be rendered as part of the TextInput
      const searchInput = screen.getByPlaceholderText('Search articles by title, abstract, or author...');
      const searchIcon = searchInput.parentElement?.querySelector('svg');
      expect(searchIcon).toBeInTheDocument();
    });
  });

  describe('Search Form Submission', () => {
    it('should trigger search on form submission', async () => {
      await act(async () => {
        renderWithProvider(<ArticlesPage />);
      });

      await waitFor(() => {
        expect(screen.getByText('Machine Learning in Healthcare')).toBeInTheDocument();
      });

      // Clear initial fetch calls
      mockFetch.mockClear();

      const searchInput = screen.getByPlaceholderText('Search articles by title, abstract, or author...');
      
      await act(async () => {
        fireEvent.change(searchInput, { target: { value: 'machine learning' } });
      });

      await act(async () => {
        fireEvent.submit(searchInput.closest('form')!);
      });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringMatching(/search=machine(\+|%20)learning/),
          expect.any(Object)
        );
      });
    });

    it('should trigger search on Enter key press', async () => {
      await act(async () => {
        renderWithProvider(<ArticlesPage />);
      });

      await waitFor(() => {
        expect(screen.getByText('Machine Learning in Healthcare')).toBeInTheDocument();
      });

      // Clear initial fetch calls
      mockFetch.mockClear();

      const searchInput = screen.getByPlaceholderText('Search articles by title, abstract, or author...');
      
      await act(async () => {
        fireEvent.change(searchInput, { target: { value: 'quantum' } });
      });

      await act(async () => {
        fireEvent.keyDown(searchInput, { key: 'Enter', code: 'Enter' });
      });

      // The form submission should trigger the search
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('search=quantum'),
          expect.any(Object)
        );
      });
    });

    it('should reset to page 1 when performing a new search', async () => {
      await act(async () => {
        renderWithProvider(<ArticlesPage />);
      });

      await waitFor(() => {
        expect(screen.getByText('Machine Learning in Healthcare')).toBeInTheDocument();
      });

      // Clear initial fetch calls
      mockFetch.mockClear();

      const searchInput = screen.getByPlaceholderText('Search articles by title, abstract, or author...');
      
      await act(async () => {
        fireEvent.change(searchInput, { target: { value: 'healthcare' } });
      });

      await act(async () => {
        fireEvent.submit(searchInput.closest('form')!);
      });

      await waitFor(() => {
        // Should reset to page 1 for new search
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('page=1'),
          expect.any(Object)
        );
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('search=healthcare'),
          expect.any(Object)
        );
      });
    });
  });

  describe('Search API Integration', () => {
    it('should include search parameter in API call', async () => {
      await act(async () => {
        renderWithProvider(<ArticlesPage />);
      });

      await waitFor(() => {
        expect(screen.getByText('Machine Learning in Healthcare')).toBeInTheDocument();
      });

      // Clear initial fetch calls
      mockFetch.mockClear();

      const searchInput = screen.getByPlaceholderText('Search articles by title, abstract, or author...');
      
      await act(async () => {
        fireEvent.change(searchInput, { target: { value: 'deep learning' } });
      });

      await act(async () => {
        fireEvent.submit(searchInput.closest('form')!);
      });

      await waitFor(() => {
        const lastCall = mockFetch.mock.calls[mockFetch.mock.calls.length - 1];
        expect(lastCall[0]).toMatch(/search=deep(\+|%20)learning/);
        expect(lastCall[0]).toContain('status=ALL');
      });
    });

    it('should not include search parameter when search is empty', async () => {
      await act(async () => {
        renderWithProvider(<ArticlesPage />);
      });

      await waitFor(() => {
        expect(screen.getByText('Machine Learning in Healthcare')).toBeInTheDocument();
      });

      // Initial API call should not include search parameter
      const initialCall = mockFetch.mock.calls[0];
      expect(initialCall[0]).not.toContain('search=');
      expect(initialCall[0]).toContain('status=ALL');
    });

    it('should combine search with other query parameters', async () => {
      await act(async () => {
        renderWithProvider(<ArticlesPage />);
      });

      await waitFor(() => {
        expect(screen.getByText('Machine Learning in Healthcare')).toBeInTheDocument();
      });

      // Clear initial fetch calls
      mockFetch.mockClear();

      // Change sorting by clicking the select and selecting an option
      const sortSelect = screen.getByDisplayValue('Publication Date');
      await act(async () => {
        fireEvent.mouseDown(sortSelect);
      });
      
      // Click on the title option
      const titleOption = screen.getByText('Title');
      await act(async () => {
        fireEvent.click(titleOption);
      });

      // Wait for sort change to trigger API call
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });

      // Clear sort-triggered fetch calls
      mockFetch.mockClear();

      // Now perform search
      const searchInput = screen.getByPlaceholderText('Search articles by title, abstract, or author...');
      
      await act(async () => {
        fireEvent.change(searchInput, { target: { value: 'algorithms' } });
      });

      await act(async () => {
        fireEvent.submit(searchInput.closest('form')!);
      });

      await waitFor(() => {
        const lastCall = mockFetch.mock.calls[mockFetch.mock.calls.length - 1];
        expect(lastCall[0]).toContain('search=algorithms');
        expect(lastCall[0]).toContain('orderBy=title');
        expect(lastCall[0]).toContain('status=ALL');
      });
    });

    it('should handle URL encoding for special characters in search', async () => {
      await act(async () => {
        renderWithProvider(<ArticlesPage />);
      });

      await waitFor(() => {
        expect(screen.getByText('Machine Learning in Healthcare')).toBeInTheDocument();
      });

      // Clear initial fetch calls
      mockFetch.mockClear();

      const searchInput = screen.getByPlaceholderText('Search articles by title, abstract, or author...');
      
      await act(async () => {
        fireEvent.change(searchInput, { target: { value: 'AI & ML' } });
      });

      await act(async () => {
        fireEvent.submit(searchInput.closest('form')!);
      });

      await waitFor(() => {
        const lastCall = mockFetch.mock.calls[mockFetch.mock.calls.length - 1];
        expect(lastCall[0]).toMatch(/search=AI(\+|%20)(%26|&)(\+|%20)ML/);
      });
    });
  });

  describe('Search Results Display', () => {
    it('should display filtered results when search is performed', async () => {
      // Mock search results
      const searchResults = {
        manuscripts: [
          {
            ...mockArticlesResponse.manuscripts[0] // Only healthcare article
          }
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

      // Mock search API response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(searchResults)
      });

      const searchInput = screen.getByPlaceholderText('Search articles by title, abstract, or author...');
      
      await act(async () => {
        fireEvent.change(searchInput, { target: { value: 'healthcare' } });
      });

      await act(async () => {
        fireEvent.submit(searchInput.closest('form')!);
      });

      await waitFor(() => {
        // Should only show the healthcare article
        expect(screen.getByText('Machine Learning in Healthcare')).toBeInTheDocument();
        expect(screen.queryByText('Deep Learning Applications')).not.toBeInTheDocument();
        expect(screen.queryByText('Quantum Computing Research')).not.toBeInTheDocument();
        
        // Should show correct count
        expect(screen.getByText('Showing 1 of 1 articles')).toBeInTheDocument();
      });
    });

    it('should show "no articles found" when search returns empty results', async () => {
      const emptyResults = {
        manuscripts: [],
        pagination: {
          page: 1,
          limit: 12,
          total: 0,
          pages: 0
        }
      };

      await act(async () => {
        renderWithProvider(<ArticlesPage />);
      });

      await waitFor(() => {
        expect(screen.getByText('Machine Learning in Healthcare')).toBeInTheDocument();
      });

      // Mock empty search results
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(emptyResults)
      });

      const searchInput = screen.getByPlaceholderText('Search articles by title, abstract, or author...');
      
      await act(async () => {
        fireEvent.change(searchInput, { target: { value: 'nonexistent term' } });
      });

      await act(async () => {
        fireEvent.submit(searchInput.closest('form')!);
      });

      await waitFor(() => {
        expect(screen.getByText('No articles found')).toBeInTheDocument();
        expect(screen.getByText('Try adjusting your search terms or filters')).toBeInTheDocument();
        expect(screen.getByText('Showing 0 of 0 articles')).toBeInTheDocument();
      });
    });

    it('should maintain search term in input after search', async () => {
      await act(async () => {
        renderWithProvider(<ArticlesPage />);
      });

      await waitFor(() => {
        expect(screen.getByText('Machine Learning in Healthcare')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search articles by title, abstract, or author...');
      const searchTerm = 'quantum computing';
      
      await act(async () => {
        fireEvent.change(searchInput, { target: { value: searchTerm } });
      });

      await act(async () => {
        fireEvent.submit(searchInput.closest('form')!);
      });

      await waitFor(() => {
        expect(searchInput).toHaveValue(searchTerm);
      });
    });
  });

  describe('Search Combined with Filters', () => {
    it('should combine search with tag filtering', async () => {
      await act(async () => {
        renderWithProvider(<ArticlesPage />);
      });

      await waitFor(() => {
        expect(screen.getByText('Machine Learning in Healthcare')).toBeInTheDocument();
      });

      // Clear initial fetch calls
      mockFetch.mockClear();

      // First, click a tag to set filter
      const aiTag = screen.getAllByText('AI')[0];
      await act(async () => {
        fireEvent.click(aiTag);
      });

      // Wait for tag filter to trigger API call
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('tag=AI'),
          expect.any(Object)
        );
      });

      // Clear tag-triggered fetch calls
      mockFetch.mockClear();

      // Now perform search
      const searchInput = screen.getByPlaceholderText('Search articles by title, abstract, or author...');
      
      await act(async () => {
        fireEvent.change(searchInput, { target: { value: 'machine' } });
      });

      await act(async () => {
        fireEvent.submit(searchInput.closest('form')!);
      });

      await waitFor(() => {
        const lastCall = mockFetch.mock.calls[mockFetch.mock.calls.length - 1];
        expect(lastCall[0]).toContain('search=machine');
        expect(lastCall[0]).toContain('tag=AI');
      });
    });

    it('should preserve search when changing sort order', async () => {
      await act(async () => {
        renderWithProvider(<ArticlesPage />);
      });

      await waitFor(() => {
        expect(screen.getByText('Machine Learning in Healthcare')).toBeInTheDocument();
      });

      // Clear initial fetch calls
      mockFetch.mockClear();

      // Perform search first
      const searchInput = screen.getByPlaceholderText('Search articles by title, abstract, or author...');
      
      await act(async () => {
        fireEvent.change(searchInput, { target: { value: 'learning' } });
      });

      await act(async () => {
        fireEvent.submit(searchInput.closest('form')!);
      });

      // Wait for search to complete
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('search=learning'),
          expect.any(Object)
        );
      });

      // Clear search-triggered fetch calls
      mockFetch.mockClear();

      // Now change sort order by clicking the select and selecting an option
      const sortSelect = screen.getByDisplayValue('Publication Date');
      await act(async () => {
        fireEvent.mouseDown(sortSelect);
      });
      
      // Click on the title option
      const titleOption = screen.getByText('Title');
      await act(async () => {
        fireEvent.click(titleOption);
      });

      await waitFor(() => {
        const lastCall = mockFetch.mock.calls[mockFetch.mock.calls.length - 1];
        expect(lastCall[0]).toContain('search=learning');
        expect(lastCall[0]).toContain('orderBy=title');
      });
    });
  });

  describe('Search Loading and Error States', () => {
    it('should show loading state during search', async () => {
      await act(async () => {
        renderWithProvider(<ArticlesPage />);
      });

      await waitFor(() => {
        expect(screen.getByText('Machine Learning in Healthcare')).toBeInTheDocument();
      });

      // Mock a delayed response
      mockFetch.mockImplementationOnce(
        () => new Promise(resolve => 
          setTimeout(() => resolve({
            ok: true,
            json: () => Promise.resolve(mockArticlesResponse)
          }), 100)
        )
      );

      const searchInput = screen.getByPlaceholderText('Search articles by title, abstract, or author...');
      
      await act(async () => {
        fireEvent.change(searchInput, { target: { value: 'test search' } });
      });

      await act(async () => {
        fireEvent.submit(searchInput.closest('form')!);
      });

      // Should show loading indicator (small loader in results info)
      expect(screen.getByRole('status')).toBeInTheDocument();

      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
      }, { timeout: 3000 });
    });

    it('should handle search API errors gracefully', async () => {
      await act(async () => {
        renderWithProvider(<ArticlesPage />);
      });

      await waitFor(() => {
        expect(screen.getByText('Machine Learning in Healthcare')).toBeInTheDocument();
      });

      // Mock API error
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const searchInput = screen.getByPlaceholderText('Search articles by title, abstract, or author...');
      
      await act(async () => {
        fireEvent.change(searchInput, { target: { value: 'test search' } });
      });

      await act(async () => {
        fireEvent.submit(searchInput.closest('form')!);
      });

      await waitFor(() => {
        expect(screen.getByText('Failed to load articles. Please try again.')).toBeInTheDocument();
      });
    });
  });

  describe('Search Input Validation and Edge Cases', () => {
    it('should handle empty search submission', async () => {
      await act(async () => {
        renderWithProvider(<ArticlesPage />);
      });

      await waitFor(() => {
        expect(screen.getByText('Machine Learning in Healthcare')).toBeInTheDocument();
      });

      // Clear initial fetch calls
      mockFetch.mockClear();

      const searchInput = screen.getByPlaceholderText('Search articles by title, abstract, or author...');
      
      // Submit form with empty search
      await act(async () => {
        fireEvent.submit(searchInput.closest('form')!);
      });

      await waitFor(() => {
        // Should still make API call but without search parameter
        expect(mockFetch).toHaveBeenCalled();
        const lastCall = mockFetch.mock.calls[mockFetch.mock.calls.length - 1];
        expect(lastCall[0]).not.toContain('search=');
      });
    });

    it('should handle very long search terms', async () => {
      await act(async () => {
        renderWithProvider(<ArticlesPage />);
      });

      await waitFor(() => {
        expect(screen.getByText('Machine Learning in Healthcare')).toBeInTheDocument();
      });

      // Clear initial fetch calls
      mockFetch.mockClear();

      const longSearchTerm = 'a'.repeat(1000);
      const searchInput = screen.getByPlaceholderText('Search articles by title, abstract, or author...');
      
      await act(async () => {
        fireEvent.change(searchInput, { target: { value: longSearchTerm } });
      });

      await act(async () => {
        fireEvent.submit(searchInput.closest('form')!);
      });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
        const lastCall = mockFetch.mock.calls[mockFetch.mock.calls.length - 1];
        expect(lastCall[0]).toContain('search=');
      });
    });

    it('should handle search terms with special characters', async () => {
      await act(async () => {
        renderWithProvider(<ArticlesPage />);
      });

      await waitFor(() => {
        expect(screen.getByText('Machine Learning in Healthcare')).toBeInTheDocument();
      });

      // Clear initial fetch calls
      mockFetch.mockClear();

      const specialCharsSearch = 'test@#$%^&*()';
      const searchInput = screen.getByPlaceholderText('Search articles by title, abstract, or author...');
      
      await act(async () => {
        fireEvent.change(searchInput, { target: { value: specialCharsSearch } });
      });

      await act(async () => {
        fireEvent.submit(searchInput.closest('form')!);
      });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
        const lastCall = mockFetch.mock.calls[mockFetch.mock.calls.length - 1];
        expect(lastCall[0]).toContain('search=');
      });
    });
  });

  describe('Search Term Display and Clear Functionality', () => {
    it('should NOT display search indicator while typing, only after search is performed', async () => {
      await act(async () => {
        renderWithProvider(<ArticlesPage />);
      });

      await waitFor(() => {
        expect(screen.getByText('Machine Learning in Healthcare')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search articles by title, abstract, or author...');
      
      // Type in the search field but don't submit
      await act(async () => {
        fireEvent.change(searchInput, { target: { value: 'test search' } });
      });

      // Should NOT show search results indicator while just typing
      expect(screen.queryByText(/Search results for/i)).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /clear search/i })).not.toBeInTheDocument();

      // Now submit the search
      await act(async () => {
        fireEvent.submit(searchInput.closest('form')!);
      });

      await waitFor(() => {
        // NOW it should show the search indicator
        expect(screen.getByText(/Search results for/i)).toBeInTheDocument();
        expect(screen.getByText('"test search"')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /clear search/i })).toBeInTheDocument();
      });
    });

    it('should display the search term when search is performed', async () => {
      await act(async () => {
        renderWithProvider(<ArticlesPage />);
      });

      await waitFor(() => {
        expect(screen.getByText('Machine Learning in Healthcare')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search articles by title, abstract, or author...');
      const searchTerm = 'machine learning';
      
      await act(async () => {
        fireEvent.change(searchInput, { target: { value: searchTerm } });
      });

      await act(async () => {
        fireEvent.submit(searchInput.closest('form')!);
      });

      await waitFor(() => {
        // Should show search results indicator with the search term
        expect(screen.getByText(/Search results for/i)).toBeInTheDocument();
        expect(screen.getByText(`"${searchTerm}"`)).toBeInTheDocument();
      });
    });

    it('should show clear search button when search is active', async () => {
      await act(async () => {
        renderWithProvider(<ArticlesPage />);
      });

      await waitFor(() => {
        expect(screen.getByText('Machine Learning in Healthcare')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search articles by title, abstract, or author...');
      
      await act(async () => {
        fireEvent.change(searchInput, { target: { value: 'test search' } });
      });

      await act(async () => {
        fireEvent.submit(searchInput.closest('form')!);
      });

      await waitFor(() => {
        // Should show clear search button (X)
        const clearButton = screen.getByRole('button', { name: /clear search/i });
        expect(clearButton).toBeInTheDocument();
      });
    });

    it('should not show clear search button when no search is active', async () => {
      await act(async () => {
        renderWithProvider(<ArticlesPage />);
      });

      await waitFor(() => {
        expect(screen.getByText('Machine Learning in Healthcare')).toBeInTheDocument();
      });

      // Should not show clear search button initially
      expect(screen.queryByRole('button', { name: /clear search/i })).not.toBeInTheDocument();
    });

    it('should clear search when X button is clicked', async () => {
      await act(async () => {
        renderWithProvider(<ArticlesPage />);
      });

      await waitFor(() => {
        expect(screen.getByText('Machine Learning in Healthcare')).toBeInTheDocument();
      });

      // Clear initial fetch calls
      mockFetch.mockClear();

      const searchInput = screen.getByPlaceholderText('Search articles by title, abstract, or author...');
      
      // Perform search
      await act(async () => {
        fireEvent.change(searchInput, { target: { value: 'test search' } });
      });

      await act(async () => {
        fireEvent.submit(searchInput.closest('form')!);
      });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /clear search/i })).toBeInTheDocument();
      });

      // Clear the search-triggered fetch calls
      mockFetch.mockClear();

      // Click clear button
      const clearButton = screen.getByRole('button', { name: /clear search/i });
      await act(async () => {
        fireEvent.click(clearButton);
      });

      await waitFor(() => {
        // Should clear the search input
        expect(searchInput).toHaveValue('');
        
        // Should hide the clear button
        expect(screen.queryByRole('button', { name: /clear search/i })).not.toBeInTheDocument();
        
        // Should hide the search results indicator
        expect(screen.queryByText(/Search results for/i)).not.toBeInTheDocument();
        
        // Should trigger API call to get all articles (without search parameter)
        expect(mockFetch).toHaveBeenCalledWith(
          expect.not.stringContaining('search='),
          expect.any(Object)
        );
      });
    });

    it('should clear search when X button is clicked and preserve other filters', async () => {
      await act(async () => {
        renderWithProvider(<ArticlesPage />);
      });

      await waitFor(() => {
        expect(screen.getByText('Machine Learning in Healthcare')).toBeInTheDocument();
      });

      // Clear initial fetch calls
      mockFetch.mockClear();

      // First, click a tag to set filter
      const aiTag = screen.getAllByText('AI')[0];
      await act(async () => {
        fireEvent.click(aiTag);
      });

      // Wait for tag filter to trigger API call
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('tag=AI'),
          expect.any(Object)
        );
      });

      // Clear tag-triggered fetch calls
      mockFetch.mockClear();

      // Perform search
      const searchInput = screen.getByPlaceholderText('Search articles by title, abstract, or author...');
      await act(async () => {
        fireEvent.change(searchInput, { target: { value: 'test search' } });
      });

      await act(async () => {
        fireEvent.submit(searchInput.closest('form')!);
      });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringMatching(/search=test(\+|%20)search.*tag=AI|tag=AI.*search=test(\+|%20)search/),
          expect.any(Object)
        );
      });

      // Clear search-triggered fetch calls
      mockFetch.mockClear();

      // Click clear search button
      const clearButton = screen.getByRole('button', { name: /clear search/i });
      await act(async () => {
        fireEvent.click(clearButton);
      });

      await waitFor(() => {
        // Should preserve tag filter but remove search
        const lastCall = mockFetch.mock.calls[mockFetch.mock.calls.length - 1];
        expect(lastCall[0]).toContain('tag=AI');
        expect(lastCall[0]).not.toContain('search=');
      });
    });

    it('should update search results indicator when search term changes', async () => {
      await act(async () => {
        renderWithProvider(<ArticlesPage />);
      });

      await waitFor(() => {
        expect(screen.getByText('Machine Learning in Healthcare')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search articles by title, abstract, or author...');
      
      // First search
      await act(async () => {
        fireEvent.change(searchInput, { target: { value: 'first search' } });
      });

      await act(async () => {
        fireEvent.submit(searchInput.closest('form')!);
      });

      await waitFor(() => {
        expect(screen.getByText(/Search results for/i)).toBeInTheDocument();
        expect(screen.getByText(/first search/i)).toBeInTheDocument();
      });

      // Second search with different term
      await act(async () => {
        fireEvent.change(searchInput, { target: { value: 'second search' } });
      });

      await act(async () => {
        fireEvent.submit(searchInput.closest('form')!);
      });

      await waitFor(() => {
        // Should update to show new search term
        expect(screen.getByText(/Search results for/i)).toBeInTheDocument();
        expect(screen.getByText(/second search/i)).toBeInTheDocument();
        
        // Should not show old search term
        expect(screen.queryByText(/first search/i)).not.toBeInTheDocument();
      });
    });

    it('should show proper styling for search results indicator', async () => {
      await act(async () => {
        renderWithProvider(<ArticlesPage />);
      });

      await waitFor(() => {
        expect(screen.getByText('Machine Learning in Healthcare')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search articles by title, abstract, or author...');
      
      await act(async () => {
        fireEvent.change(searchInput, { target: { value: 'test query' } });
      });

      await act(async () => {
        fireEvent.submit(searchInput.closest('form')!);
      });

      await waitFor(() => {
        // Should display search indicator with proper formatting
        const searchIndicator = screen.getByText(/Search results for/i);
        expect(searchIndicator).toBeInTheDocument();
        
        // Should show search term in quotes or with emphasis
        expect(screen.getByText('"test query"')).toBeInTheDocument();
      });
    });
  });
});