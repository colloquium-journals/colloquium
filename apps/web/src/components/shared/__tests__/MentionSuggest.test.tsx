import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { MentionSuggest, MentionSuggestion } from '../MentionSuggest';

const mockSuggestions: MentionSuggestion[] = [
  {
    id: 'user1',
    name: 'user1',
    displayName: 'John Doe',
    type: 'user',
    description: 'AUTHOR • john@example.com'
  },
  {
    id: 'bot-editorial',
    name: 'bot-editorial',
    displayName: 'Editorial Bot',
    type: 'bot',
    description: 'Assists with editorial workflows',
    color: 'blue'
  },
  {
    id: 'user2',
    name: 'user2',
    displayName: 'Jane Smith',
    type: 'user',
    description: 'REVIEWER • jane@example.com'
  }
];

const defaultProps = {
  suggestions: mockSuggestions,
  isVisible: true,
  position: { top: 100, left: 50 },
  selectedIndex: 0,
  onSelect: jest.fn(),
  onClose: jest.fn()
};

const renderWithMantine = (props = defaultProps) => {
  return render(
    <MantineProvider>
      <MentionSuggest {...props} />
    </MantineProvider>
  );
};

describe('MentionSuggest', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should not render when not visible', () => {
    renderWithMantine({ ...defaultProps, isVisible: false });
    
    expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
  });

  it('should not render when no suggestions', () => {
    renderWithMantine({ ...defaultProps, suggestions: [] });
    
    expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
  });

  it('should render all suggestions when visible', () => {
    renderWithMantine();
    
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Editorial Bot')).toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
  });

  it('should show user and bot icons correctly', () => {
    renderWithMantine();
    
    // Check that we have 3 suggestions
    const suggestions = screen.getAllByRole('button');
    expect(suggestions).toHaveLength(3);
  });

  it('should display descriptions for suggestions', () => {
    renderWithMantine();
    
    expect(screen.getByText('AUTHOR • john@example.com')).toBeInTheDocument();
    expect(screen.getByText('Assists with editorial workflows')).toBeInTheDocument();
    expect(screen.getByText('REVIEWER • jane@example.com')).toBeInTheDocument();
  });

  it('should display suggestion IDs', () => {
    renderWithMantine();
    
    expect(screen.getByText('@user1')).toBeInTheDocument();
    expect(screen.getByText('@bot-editorial')).toBeInTheDocument();
    expect(screen.getByText('@user2')).toBeInTheDocument();
  });

  it('should highlight selected suggestion', () => {
    renderWithMantine({ ...defaultProps, selectedIndex: 1 });
    
    const suggestions = screen.getAllByRole('button');
    
    // The second suggestion (index 1) should have the selected style
    expect(suggestions[1]).toHaveStyle({
      backgroundColor: 'var(--mantine-color-blue-light)'
    });
  });

  it('should call onSelect when suggestion is clicked', () => {
    const mockOnSelect = jest.fn();
    renderWithMantine({ ...defaultProps, onSelect: mockOnSelect });
    
    const johnDoeButton = screen.getByText('John Doe').closest('button');
    fireEvent.click(johnDoeButton!);
    
    expect(mockOnSelect).toHaveBeenCalledWith(mockSuggestions[0]);
  });

  it('should call onSelect when different suggestion is clicked', () => {
    const mockOnSelect = jest.fn();
    renderWithMantine({ ...defaultProps, onSelect: mockOnSelect });
    
    const editorialBotButton = screen.getByText('Editorial Bot').closest('button');
    fireEvent.click(editorialBotButton!);
    
    expect(mockOnSelect).toHaveBeenCalledWith(mockSuggestions[1]);
  });

  it('should position popup correctly', () => {
    const { container } = renderWithMantine({
      ...defaultProps,
      position: { top: 200, left: 100 }
    });
    
    const popup = container.querySelector('[style*="position: absolute"]');
    expect(popup).toHaveStyle({
      top: '200px',
      left: '100px'
    });
  });

  it('should handle suggestions without descriptions', () => {
    const suggestionsWithoutDesc: MentionSuggestion[] = [
      {
        id: 'user1',
        name: 'user1',
        displayName: 'John Doe',
        type: 'user'
      }
    ];

    renderWithMantine({
      ...defaultProps,
      suggestions: suggestionsWithoutDesc
    });
    
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('@user1')).toBeInTheDocument();
  });

  it('should handle single suggestion', () => {
    renderWithMantine({
      ...defaultProps,
      suggestions: [mockSuggestions[0]],
      selectedIndex: 0
    });
    
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.queryByText('Editorial Bot')).not.toBeInTheDocument();
    
    const suggestion = screen.getByRole('button');
    expect(suggestion).toHaveStyle({
      backgroundColor: 'var(--mantine-color-blue-light)'
    });
  });

  it('should handle edge case of selected index out of bounds', () => {
    renderWithMantine({
      ...defaultProps,
      selectedIndex: 10 // Out of bounds
    });
    
    // Should still render without errors
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Editorial Bot')).toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
  });

  it('should apply correct styling for popup', () => {
    const { container } = renderWithMantine();
    
    const popup = container.querySelector('[style*="position: absolute"]');
    expect(popup).toHaveStyle({
      zIndex: '1000',
      maxWidth: '320px',
      maxHeight: '200px'
    });
  });
});