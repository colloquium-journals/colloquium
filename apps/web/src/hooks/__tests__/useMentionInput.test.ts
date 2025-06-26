import { renderHook } from '@testing-library/react';
import { act } from 'react';
import { useMentionInput } from '../useMentionInput';
import { MentionSuggestion } from '@/components/shared/MentionSuggest';

// Set up proper DOM environment for jsdom
beforeAll(() => {
  // Ensure document.body exists
  if (!document.body) {
    document.documentElement.appendChild(document.createElement('body'));
  }
  
  // Mock DOM methods
  Object.defineProperty(window, 'getComputedStyle', {
    value: jest.fn(() => ({
      font: '16px Arial',
      lineHeight: '20px'
    })),
    writable: true
  });

  // Mock document.createElement for span elements
  const originalCreateElement = document.createElement.bind(document);
  document.createElement = jest.fn((tagName: string) => {
    if (tagName === 'span') {
      return {
        style: {},
        get textContent() { return this._textContent || ''; },
        set textContent(value) { this._textContent = value; },
        offsetWidth: 50,
        _textContent: ''
      } as any;
    }
    return originalCreateElement(tagName);
  });

  document.body.appendChild = jest.fn();
  document.body.removeChild = jest.fn();
});

describe('useMentionInput', () => {
  const mockSuggestions: MentionSuggestion[] = [
    {
      id: 'user1',
      name: 'John Doe',
      displayName: 'John Doe',
      type: 'user',
      description: 'AUTHOR • john@example.com'
    },
    {
      id: 'editorial-bot',
      name: 'Editorial Bot',
      displayName: 'Editorial Bot',
      type: 'bot',
      description: 'Assists with editorial workflows',
      color: 'blue'
    }
  ];

  let mockTextareaRef: React.RefObject<HTMLTextAreaElement>;
  let mockOnChange: jest.Mock;

  beforeEach(() => {
    // Mock textarea element
    const mockTextarea = {
      selectionStart: 0,
      value: '',
      getBoundingClientRect: () => ({ top: 100, left: 100, width: 300, height: 100 }),
      focus: jest.fn(),
      setSelectionRange: jest.fn()
    } as unknown as HTMLTextAreaElement;

    mockTextareaRef = { current: mockTextarea };
    mockOnChange = jest.fn();
  });

  // Helper function to render hook with container
  const renderHookWithContainer = (hook: () => any) => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const result = renderHook(hook, { container });
    return { ...result, container };
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize with inactive mention state', () => {
    const { result, container } = renderHookWithContainer(() =>
      useMentionInput({
        textareaRef: mockTextareaRef,
        value: '',
        onChange: mockOnChange,
        suggestions: mockSuggestions
      })
    );

    expect(result.current.mentionState.isActive).toBe(false);
    expect(result.current.mentionState.query).toBe('');
    expect(result.current.mentionState.filteredSuggestions).toEqual([]);
    
    document.body.removeChild(container);
  });

  it('should activate mention suggestions when @ is typed', () => {
    const { result, container } = renderHookWithContainer(() =>
      useMentionInput({
        textareaRef: mockTextareaRef,
        value: '',
        onChange: mockOnChange,
        suggestions: mockSuggestions
      })
    );

    act(() => {
      if (mockTextareaRef.current) {
        mockTextareaRef.current.selectionStart = 1;
      }
      result.current.handleTextChange('@');
    });

    expect(result.current.mentionState.isActive).toBe(true);
    expect(result.current.mentionState.query).toBe('');
    expect(result.current.mentionState.filteredSuggestions).toEqual(mockSuggestions);
    
    document.body.removeChild(container);
  });

  it('should filter suggestions based on query', () => {
    const { result, container } = renderHookWithContainer(() =>
      useMentionInput({
        textareaRef: mockTextareaRef,
        value: '',
        onChange: mockOnChange,
        suggestions: mockSuggestions
      })
    );

    act(() => {
      if (mockTextareaRef.current) {
        mockTextareaRef.current.selectionStart = 5;
      }
      result.current.handleTextChange('@john');
    });

    expect(result.current.mentionState.isActive).toBe(true);
    expect(result.current.mentionState.query).toBe('john');
    expect(result.current.mentionState.filteredSuggestions).toHaveLength(1);
    expect(result.current.mentionState.filteredSuggestions[0].name).toBe('John Doe');
    
    document.body.removeChild(container);
  });

  it('should deactivate when @ is not at word boundary', () => {
    const { result, container } = renderHookWithContainer(() =>
      useMentionInput({
        textareaRef: mockTextareaRef,
        value: '',
        onChange: mockOnChange,
        suggestions: mockSuggestions
      })
    );

    act(() => {
      if (mockTextareaRef.current) {
        mockTextareaRef.current.selectionStart = 10;
      }
      result.current.handleTextChange('email@user');
    });

    expect(result.current.mentionState.isActive).toBe(false);
    
    document.body.removeChild(container);
  });

  it('should handle keyboard navigation - ArrowDown', () => {
    const { result, container } = renderHookWithContainer(() =>
      useMentionInput({
        textareaRef: mockTextareaRef,
        value: '',
        onChange: mockOnChange,
        suggestions: mockSuggestions
      })
    );

    // Activate mentions first
    act(() => {
      if (mockTextareaRef.current) {
        mockTextareaRef.current.selectionStart = 1;
      }
      result.current.handleTextChange('@');
    });

    const mockEvent = {
      key: 'ArrowDown',
      preventDefault: jest.fn()
    } as unknown as React.KeyboardEvent;

    act(() => {
      const handled = result.current.handleKeyDown(mockEvent);
      expect(handled).toBe(true);
    });

    expect(mockEvent.preventDefault).toHaveBeenCalled();
    expect(result.current.mentionState.selectedIndex).toBe(1);
    
    document.body.removeChild(container);
  });

  it('should handle keyboard navigation - ArrowUp', () => {
    const { result, container } = renderHookWithContainer(() =>
      useMentionInput({
        textareaRef: mockTextareaRef,
        value: '',
        onChange: mockOnChange,
        suggestions: mockSuggestions
      })
    );

    // Activate mentions and move to second item
    act(() => {
      if (mockTextareaRef.current) {
        mockTextareaRef.current.selectionStart = 1;
      }
      result.current.handleTextChange('@');
    });

    act(() => {
      result.current.handleKeyDown({
        key: 'ArrowDown',
        preventDefault: jest.fn()
      } as unknown as React.KeyboardEvent);
    });

    const mockEvent = {
      key: 'ArrowUp',
      preventDefault: jest.fn()
    } as unknown as React.KeyboardEvent;

    act(() => {
      const handled = result.current.handleKeyDown(mockEvent);
      expect(handled).toBe(true);
    });

    expect(result.current.mentionState.selectedIndex).toBe(0);
    
    document.body.removeChild(container);
  });

  it('should handle Enter key to select suggestion', () => {
    const { result, container } = renderHookWithContainer(() =>
      useMentionInput({
        textareaRef: mockTextareaRef,
        value: 'Hello @',
        onChange: mockOnChange,
        suggestions: mockSuggestions
      })
    );

    act(() => {
      if (mockTextareaRef.current) {
        mockTextareaRef.current.selectionStart = 7;
        mockTextareaRef.current.value = 'Hello @';
      }
      result.current.handleTextChange('Hello @');
    });

    const mockEvent = {
      key: 'Enter',
      preventDefault: jest.fn()
    } as unknown as React.KeyboardEvent;

    act(() => {
      const handled = result.current.handleKeyDown(mockEvent);
      expect(handled).toBe(true);
    });

    expect(mockOnChange).toHaveBeenCalledWith('Hello @John Doe ');
    expect(result.current.mentionState.isActive).toBe(false);
    
    document.body.removeChild(container);
  });

  it('should handle Escape key to close suggestions', () => {
    const { result, container } = renderHookWithContainer(() =>
      useMentionInput({
        textareaRef: mockTextareaRef,
        value: '',
        onChange: mockOnChange,
        suggestions: mockSuggestions
      })
    );

    // Activate mentions first
    act(() => {
      if (mockTextareaRef.current) {
        mockTextareaRef.current.selectionStart = 1;
      }
      result.current.handleTextChange('@');
    });

    expect(result.current.mentionState.isActive).toBe(true);

    const mockEvent = {
      key: 'Escape',
      preventDefault: jest.fn()
    } as unknown as React.KeyboardEvent;

    act(() => {
      const handled = result.current.handleKeyDown(mockEvent);
      expect(handled).toBe(true);
    });

    expect(result.current.mentionState.isActive).toBe(false);
    
    document.body.removeChild(container);
  });

  it('should handle direct suggestion selection', () => {
    const { result, container } = renderHookWithContainer(() =>
      useMentionInput({
        textareaRef: mockTextareaRef,
        value: 'Hello @john',
        onChange: mockOnChange,
        suggestions: mockSuggestions
      })
    );

    act(() => {
      if (mockTextareaRef.current) {
        mockTextareaRef.current.selectionStart = 11;
        mockTextareaRef.current.value = 'Hello @john';
      }
      result.current.handleTextChange('Hello @john');
    });

    act(() => {
      result.current.handleSelectSuggestion(mockSuggestions[0]);
    });

    expect(mockOnChange).toHaveBeenCalledWith('Hello @John Doe ');
    expect(result.current.mentionState.isActive).toBe(false);
    
    document.body.removeChild(container);
  });

  it('should deactivate when query contains spaces', () => {
    const { result, container } = renderHookWithContainer(() =>
      useMentionInput({
        textareaRef: mockTextareaRef,
        value: '',
        onChange: mockOnChange,
        suggestions: mockSuggestions
      })
    );

    act(() => {
      if (mockTextareaRef.current) {
        mockTextareaRef.current.selectionStart = 7;
      }
      result.current.handleTextChange('@john ');
    });

    expect(result.current.mentionState.isActive).toBe(false);
    
    document.body.removeChild(container);
  });

  it('should handle close suggestions', () => {
    const { result, container } = renderHookWithContainer(() =>
      useMentionInput({
        textareaRef: mockTextareaRef,
        value: '',
        onChange: mockOnChange,
        suggestions: mockSuggestions
      })
    );

    // Activate mentions first
    act(() => {
      if (mockTextareaRef.current) {
        mockTextareaRef.current.selectionStart = 1;
      }
      result.current.handleTextChange('@');
    });

    expect(result.current.mentionState.isActive).toBe(true);

    act(() => {
      result.current.handleCloseSuggestions();
    });

    expect(result.current.mentionState.isActive).toBe(false);
    
    document.body.removeChild(container);
  });
});