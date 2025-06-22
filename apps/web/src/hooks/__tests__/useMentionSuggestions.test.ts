import { renderHook, waitFor } from '@testing-library/react';
import { useMentionSuggestions } from '../useMentionSuggestions';

// Mock fetch
global.fetch = jest.fn();

const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

describe('useMentionSuggestions', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  const mockBots = [
    {
      id: 'editorial-bot',
      name: 'Editorial Bot',
      description: 'Assists with editorial workflows',
      color: 'blue'
    },
    {
      id: 'plagiarism-checker',
      name: 'Plagiarism Checker',
      description: 'Checks for plagiarism',
      color: 'red'
    }
  ];

  const mockParticipants = [
    {
      id: 'p1',
      user: {
        id: 'user1',
        name: 'John Doe',
        email: 'john@example.com',
        role: 'AUTHOR'
      }
    },
    {
      id: 'p2',
      user: {
        id: 'user2',
        name: 'Jane Smith',
        email: 'jane@example.com',
        role: 'REVIEWER'
      }
    }
  ];

  it('should return empty suggestions when no conversationId is provided', () => {
    const { result } = renderHook(() =>
      useMentionSuggestions({
        conversationId: '',
        availableBots: mockBots
      })
    );

    expect(result.current.allSuggestions).toEqual(mockBots.map(bot => ({
      id: bot.id,
      name: bot.name,
      displayName: bot.name,
      type: 'bot',
      description: bot.description,
      color: bot.color
    })));
  });

  it('should fetch participants and combine with bots', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ participants: mockParticipants })
    } as Response);

    const { result } = renderHook(() =>
      useMentionSuggestions({
        conversationId: 'conv-123',
        availableBots: mockBots
      })
    );

    await waitFor(() => {
      expect(result.current.allSuggestions).toHaveLength(4); // 2 users + 2 bots
    });

    const suggestions = result.current.allSuggestions;
    
    // Check user suggestions
    expect(suggestions.filter(s => s.type === 'user')).toEqual([
      {
        id: 'user1',
        name: 'John Doe',
        displayName: 'John Doe',
        type: 'user',
        description: 'AUTHOR • john@example.com'
      },
      {
        id: 'user2',
        name: 'Jane Smith',
        displayName: 'Jane Smith',
        type: 'user',
        description: 'REVIEWER • jane@example.com'
      }
    ]);

    // Check bot suggestions
    expect(suggestions.filter(s => s.type === 'bot')).toEqual([
      {
        id: 'editorial-bot',
        name: 'Editorial Bot',
        displayName: 'Editorial Bot',
        type: 'bot',
        description: 'Assists with editorial workflows',
        color: 'blue'
      },
      {
        id: 'plagiarism-checker',
        name: 'Plagiarism Checker',
        displayName: 'Plagiarism Checker',
        type: 'bot',
        description: 'Checks for plagiarism',
        color: 'red'
      }
    ]);
  });

  it('should handle API errors gracefully', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404
    } as Response);

    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    const { result } = renderHook(() =>
      useMentionSuggestions({
        conversationId: 'conv-123',
        availableBots: mockBots
      })
    );

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Failed to fetch conversation participants:', 404);
    });

    // Should still return bot suggestions
    expect(result.current.allSuggestions).toHaveLength(2);
    expect(result.current.allSuggestions.every(s => s.type === 'bot')).toBe(true);

    consoleSpy.mockRestore();
  });

  it('should filter suggestions correctly', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ participants: mockParticipants })
    } as Response);

    const { result } = renderHook(() =>
      useMentionSuggestions({
        conversationId: 'conv-123',
        availableBots: mockBots
      })
    );

    await waitFor(() => {
      expect(result.current.allSuggestions).toHaveLength(4);
    });

    // Test filtering by name
    const johnSuggestions = result.current.getFilteredSuggestions('john');
    expect(johnSuggestions).toHaveLength(1);
    expect(johnSuggestions[0].name).toBe('John Doe');

    // Test filtering by bot name
    const editorialSuggestions = result.current.getFilteredSuggestions('editorial');
    expect(editorialSuggestions).toHaveLength(1);
    expect(editorialSuggestions[0].name).toBe('Editorial Bot');

    // Test filtering by bot ID
    const plagiarismSuggestions = result.current.getFilteredSuggestions('plagiarism-checker');
    expect(plagiarismSuggestions).toHaveLength(1);
    expect(plagiarismSuggestions[0].id).toBe('plagiarism-checker');

    // Test case insensitive filtering
    const smitSuggestions = result.current.getFilteredSuggestions('SMITH');
    expect(smitSuggestions).toHaveLength(1);
    expect(smitSuggestions[0].name).toBe('Jane Smith');

    // Test no matches
    const noMatches = result.current.getFilteredSuggestions('xyz');
    expect(noMatches).toHaveLength(0);
  });

  it('should handle users without names (using email)', async () => {
    const participantsWithoutNames = [
      {
        id: 'p1',
        user: {
          id: 'user1',
          name: '',
          email: 'john@example.com',
          role: 'AUTHOR'
        }
      }
    ];

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ participants: participantsWithoutNames })
    } as Response);

    const { result } = renderHook(() =>
      useMentionSuggestions({
        conversationId: 'conv-123',
        availableBots: []
      })
    );

    await waitFor(() => {
      expect(result.current.allSuggestions).toHaveLength(1);
    });

    const userSuggestion = result.current.allSuggestions[0];
    expect(userSuggestion.name).toBe('john@example.com');
    expect(userSuggestion.displayName).toBe('john@example.com');
  });
});