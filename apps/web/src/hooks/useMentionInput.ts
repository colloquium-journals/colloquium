'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { MentionSuggestion } from '@/components/shared/MentionSuggest';

interface UseMentionInputProps {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  value: string;
  onChange: (value: string) => void;
  suggestions: MentionSuggestion[];
  onSelectSuggestion?: (suggestion: MentionSuggestion) => void;
}

interface MentionState {
  isActive: boolean;
  query: string;
  startPos: number;
  filteredSuggestions: MentionSuggestion[];
  selectedIndex: number;
  position: { top: number; left: number };
}

export function useMentionInput({ textareaRef, containerRef, value, onChange, suggestions, onSelectSuggestion }: UseMentionInputProps) {
  const [mentionState, setMentionState] = useState<MentionState>({
    isActive: false,
    query: '',
    startPos: 0,
    filteredSuggestions: [],
    selectedIndex: 0,
    position: { top: 0, left: 0 }
  });

  // Calculate cursor position for suggestion popup (relative to container)
  const calculatePosition = useCallback((textarea: HTMLTextAreaElement, cursorPos: number) => {
    const textBeforeCursor = textarea.value.substring(0, cursorPos);
    const lines = textBeforeCursor.split('\n');
    const currentLine = lines[lines.length - 1];

    // Create a temporary element to measure text width
    const temp = document.createElement('span');
    const computedStyle = window.getComputedStyle(textarea);
    temp.style.font = computedStyle.font;
    temp.style.fontSize = computedStyle.fontSize;
    temp.style.fontFamily = computedStyle.fontFamily;
    temp.style.position = 'absolute';
    temp.style.visibility = 'hidden';
    temp.style.whiteSpace = 'pre';
    temp.style.top = '-9999px';
    temp.style.left = '-9999px';
    temp.textContent = currentLine;
    document.body.appendChild(temp);

    const textWidth = temp.offsetWidth;
    document.body.removeChild(temp);

    const computedLineHeight = parseInt(computedStyle.lineHeight) || parseInt(computedStyle.fontSize) * 1.2 || 20;
    const paddingTop = parseInt(computedStyle.paddingTop) || 0;
    const paddingLeft = parseInt(computedStyle.paddingLeft) || 0;

    // Calculate position relative to the container
    const containerEl = containerRef.current;
    const textareaRect = textarea.getBoundingClientRect();
    const containerRect = containerEl ? containerEl.getBoundingClientRect() : textareaRect;

    const offsetTop = textareaRect.top - containerRect.top;
    const offsetLeft = textareaRect.left - containerRect.left;

    const top = offsetTop + paddingTop + (lines.length - 1) * computedLineHeight + computedLineHeight + 4 - textarea.scrollTop;
    const left = offsetLeft + paddingLeft + textWidth + 8;

    return { top, left };
  }, [containerRef]);

  // Detect @ mentions and update state
  const handleTextChange = useCallback((newValue: string) => {
    onChange(newValue);
    
    if (!textareaRef.current) return;
    
    const cursorPos = textareaRef.current.selectionStart || 0;
    const textBeforeCursor = newValue.substring(0, cursorPos);
    
    
    // Find the last @ symbol before cursor
    const lastAtPos = textBeforeCursor.lastIndexOf('@');
    
    if (lastAtPos === -1) {
      // No @ found, hide suggestions
      setMentionState(prev => ({ ...prev, isActive: false }));
      return;
    }
    
    // Check if @ is at the start or preceded by whitespace
    const charBeforeAt = lastAtPos > 0 ? textBeforeCursor[lastAtPos - 1] : ' ';
    if (charBeforeAt !== ' ' && charBeforeAt !== '\n' && lastAtPos !== 0) {
      setMentionState(prev => ({ ...prev, isActive: false }));
      return;
    }
    
    // Extract query after @
    const queryPart = textBeforeCursor.substring(lastAtPos + 1);
    
    // Check if query contains spaces or special characters (indicating end of mention)
    if (/[\s@]/.test(queryPart)) {
      setMentionState(prev => ({ ...prev, isActive: false }));
      return;
    }
    
    // Filter suggestions based on query
    const filtered = suggestions.filter(suggestion => 
      suggestion.name.toLowerCase().includes(queryPart.toLowerCase()) ||
      suggestion.displayName.toLowerCase().includes(queryPart.toLowerCase()) ||
      suggestion.id.toLowerCase().includes(queryPart.toLowerCase())
    );
    
    // Calculate position for suggestion popup
    const position = calculatePosition(textareaRef.current, cursorPos);
    
    setMentionState({
      isActive: true,
      query: queryPart,
      startPos: lastAtPos,
      filteredSuggestions: filtered,
      selectedIndex: 0,
      position
    });
  }, [onChange, suggestions, textareaRef, calculatePosition]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (!mentionState.isActive || mentionState.filteredSuggestions.length === 0) return false;
    
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setMentionState(prev => ({
          ...prev,
          selectedIndex: (prev.selectedIndex + 1) % prev.filteredSuggestions.length
        }));
        return true;
        
      case 'ArrowUp':
        event.preventDefault();
        setMentionState(prev => ({
          ...prev,
          selectedIndex: prev.selectedIndex === 0 
            ? prev.filteredSuggestions.length - 1 
            : prev.selectedIndex - 1
        }));
        return true;
        
      case 'Tab':
      case 'Enter':
        event.preventDefault();
        if (mentionState.filteredSuggestions[mentionState.selectedIndex]) {
          const suggestion = mentionState.filteredSuggestions[mentionState.selectedIndex];
          if (onSelectSuggestion) {
            onSelectSuggestion(suggestion);
          } else {
            handleSelectSuggestion(suggestion);
          }
        }
        return true;
        
      case 'Escape':
        event.preventDefault();
        setMentionState(prev => ({ ...prev, isActive: false }));
        return true;
        
      default:
        return false;
    }
  }, [mentionState]);

  // Handle suggestion selection
  const handleSelectSuggestion = useCallback((suggestion: MentionSuggestion) => {
    if (!textareaRef.current) return;
    
    const beforeMention = value.substring(0, mentionState.startPos);
    const afterCursor = value.substring(textareaRef.current.selectionStart || 0);
    const newValue = `${beforeMention}@${suggestion.name} ${afterCursor}`;
    
    onChange(newValue);
    
    // Set cursor position after the mention
    const newCursorPos = mentionState.startPos + suggestion.name.length + 2; // +2 for @ and space
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
    
    setMentionState(prev => ({ ...prev, isActive: false }));
  }, [value, mentionState.startPos, onChange, textareaRef]);

  // Close suggestions
  const handleCloseSuggestions = useCallback(() => {
    setMentionState(prev => ({ ...prev, isActive: false }));
  }, []);

  return {
    mentionState,
    handleTextChange,
    handleKeyDown,
    handleSelectSuggestion,
    handleCloseSuggestions
  };
}