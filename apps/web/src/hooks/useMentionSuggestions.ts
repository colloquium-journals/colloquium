'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { MentionSuggestion } from '@/components/shared/MentionSuggest';

interface UseMentionSuggestionsProps {
  conversationId: string;
  availableBots: Array<{
    id: string;
    name: string;
    description: string;
    color: string;
  }>;
}

interface ConversationParticipant {
  id: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
}

export function useMentionSuggestions({ conversationId, availableBots }: UseMentionSuggestionsProps) {
  const [participants, setParticipants] = useState<ConversationParticipant[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch conversation participants
  useEffect(() => {
    if (!conversationId) {
      return;
    }

    const fetchParticipants = async () => {
      try {
        setLoading(true);
        const response = await fetch(`http://localhost:4000/api/conversations/${conversationId}`, {
          credentials: 'include'
        });

        if (response.ok) {
          const data = await response.json();
          setParticipants(data.participants || []);
        } else {
          console.error('Failed to fetch conversation participants:', response.status);
        }
      } catch (error) {
        console.error('Error fetching conversation participants:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchParticipants();
  }, [conversationId]);

  // Combine users and bots into suggestions
  const allSuggestions = useMemo((): MentionSuggestion[] => {
    // Create user suggestions with collision detection
    const usersByDisplayName = new Map<string, ConversationParticipant[]>();
    
    // Group users by display name to detect collisions
    participants.forEach(participant => {
      const displayName = participant.user.name || participant.user.email;
      if (!usersByDisplayName.has(displayName)) {
        usersByDisplayName.set(displayName, []);
      }
      usersByDisplayName.get(displayName)!.push(participant);
    });

    const userSuggestions: MentionSuggestion[] = [];
    usersByDisplayName.forEach((users, displayName) => {
      users.forEach(participant => {
        const needsDisambiguation = users.length > 1;
        const mentionName = needsDisambiguation 
          ? `${displayName} (${participant.user.email})`
          : displayName;

        userSuggestions.push({
          id: participant.user.id,
          name: mentionName,
          displayName: displayName,
          type: 'user' as const,
          description: `${participant.user.role} • ${participant.user.email}`,
        });
      });
    });

    const botSuggestions: MentionSuggestion[] = availableBots.map(bot => ({
      id: bot.id,
      name: bot.id, // Use bot ID for the mention (e.g., @editorial-bot)
      displayName: bot.name, // Use human-readable name for display (e.g., "Editorial Bot")
      type: 'bot' as const,
      description: bot.description,
      color: bot.color,
    }));

    return [...userSuggestions, ...botSuggestions];
  }, [participants, availableBots]);

  // Filter suggestions based on query
  const getFilteredSuggestions = useCallback((query: string): MentionSuggestion[] => {
    if (!query.trim()) return allSuggestions;

    const lowercaseQuery = query.toLowerCase();
    return allSuggestions.filter(suggestion => 
      suggestion.name.toLowerCase().includes(lowercaseQuery) ||
      suggestion.displayName.toLowerCase().includes(lowercaseQuery) ||
      suggestion.id.toLowerCase().includes(lowercaseQuery) ||
      (suggestion.description && suggestion.description.toLowerCase().includes(lowercaseQuery))
    );
  }, [allSuggestions]);

  return {
    participants,
    allSuggestions,
    getFilteredSuggestions,
    loading
  };
}