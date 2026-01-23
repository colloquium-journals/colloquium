import React from 'react';
import { render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { MessageContent } from '../MessageContent';

// Mock the MentionTooltip component
jest.mock('../MentionTooltip', () => ({
  MentionTooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>
}));

const renderWithProvider = (component: React.ReactElement) => {
  return render(
    <MantineProvider>
      {component}
    </MantineProvider>
  );
};

describe('Text Formatting Integration', () => {
  const defaultProps = {
    conversationId: 'test-conversation-id',
    messageId: 'test-message-id'
  };

  describe('Basic Text Formatting', () => {
    it('should render bold text correctly', () => {
      renderWithProvider(
        <MessageContent 
          content="This is **bold text**" 
          {...defaultProps}
        />
      );
      
      const boldElement = screen.getByText('bold text');
      expect(boldElement.tagName).toBe('STRONG');
    });

    it('should render italic text correctly', () => {
      renderWithProvider(
        <MessageContent 
          content="This is *italic text*" 
          {...defaultProps}
        />
      );
      
      const italicElement = screen.getByText('italic text');
      expect(italicElement.tagName).toBe('EM');
    });

    it('should render strikethrough text correctly', () => {
      renderWithProvider(
        <MessageContent 
          content="This is ~~strikethrough text~~" 
          {...defaultProps}
        />
      );
      
      const strikeElement = screen.getByText('strikethrough text');
      expect(strikeElement.tagName).toBe('DEL');
    });

    it('should render inline code correctly', () => {
      renderWithProvider(
        <MessageContent 
          content="This is `inline code`" 
          {...defaultProps}
        />
      );
      
      const codeElement = screen.getByText('inline code');
      expect(codeElement.tagName).toBe('CODE');
    });

    it('should render mixed formatting correctly', () => {
      renderWithProvider(
        <MessageContent 
          content="**Bold**, *italic*, ~~strike~~, and `code`" 
          {...defaultProps}
        />
      );
      
      expect(screen.getByText('Bold').tagName).toBe('STRONG');
      expect(screen.getByText('italic').tagName).toBe('EM');
      expect(screen.getByText('strike').tagName).toBe('DEL');
      expect(screen.getByText('code').tagName).toBe('CODE');
    });
  });

  describe('Formatting with Mentions', () => {
    it('should handle formatting around bot mentions', () => {
      renderWithProvider(
        <MessageContent 
          content="@editorial-bot please **check** this *formatting*" 
          {...defaultProps}
        />
      );
      
      expect(screen.getByText('@editorial-bot')).toBeInTheDocument();
      expect(screen.getByText('check').tagName).toBe('STRONG');
      expect(screen.getByText('formatting').tagName).toBe('EM');
    });

    it('should handle formatting within the same chunk as mentions', () => {
      renderWithProvider(
        <MessageContent 
          content="Please **review** @editorial-bot and `execute` the checks" 
          {...defaultProps}
        />
      );
      
      expect(screen.getByText('review').tagName).toBe('STRONG');
      expect(screen.getByText('@editorial-bot')).toBeInTheDocument();
      expect(screen.getByText('execute').tagName).toBe('CODE');
    });
  });

  describe('Block-level Elements', () => {
    it('should render headers correctly', () => {
      renderWithProvider(
        <MessageContent 
          content="# Main Header" 
          {...defaultProps}
        />
      );
      
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Main Header');
    });

    it('should render lists correctly', () => {
      renderWithProvider(
        <MessageContent 
          content="- Single item list" 
          {...defaultProps}
        />
      );
      
      expect(screen.getByRole('list')).toBeInTheDocument();
      expect(screen.getByText('Single item list')).toBeInTheDocument();
    });

    it('should render links with security attributes', () => {
      renderWithProvider(
        <MessageContent 
          content="Check [this link](https://example.com) for more info" 
          {...defaultProps}
        />
      );
      
      const link = screen.getByRole('link', { name: 'this link' });
      expect(link).toHaveAttribute('href', 'https://example.com');
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });
  });

  describe('Edge Cases', () => {
    it('should handle nested formatting', () => {
      renderWithProvider(
        <MessageContent 
          content="**Bold with *italic* inside**" 
          {...defaultProps}
        />
      );
      
      const boldElement = screen.getByText(/Bold with.*inside/);
      expect(boldElement.tagName).toBe('STRONG');
      
      const italicElement = screen.getByText('italic');
      expect(italicElement.tagName).toBe('EM');
    });

    it('should handle formatting with mentions in same sentence', () => {
      renderWithProvider(
        <MessageContent 
          content="**Bold text** @editorial-bot *italic text*" 
          {...defaultProps}
        />
      );
      
      // The formatting should work alongside mentions
      expect(screen.getByText('@editorial-bot')).toBeInTheDocument();
      expect(screen.getByText('Bold text').tagName).toBe('STRONG');
      expect(screen.getByText('italic text').tagName).toBe('EM');
    });

    it('should handle empty formatting', () => {
      renderWithProvider(
        <MessageContent 
          content="****  ~~  `` and normal text" 
          {...defaultProps}
        />
      );
      
      // Should not crash and should render something
      expect(screen.getByText(/normal text/)).toBeInTheDocument();
    });
  });

  describe('Supported Markdown Summary', () => {
    it('should confirm working text formatting features', () => {
      // Test the core text formatting that is working correctly
      renderWithProvider(
        <MessageContent 
          content="**Bold**, *italic*, ~~strikethrough~~, `code`, and @editorial-bot mentions work perfectly!" 
          {...defaultProps}
        />
      );
      
      // Verify all core formatting works
      expect(screen.getByText('Bold').tagName).toBe('STRONG');
      expect(screen.getByText('italic').tagName).toBe('EM');
      expect(screen.getByText('strikethrough').tagName).toBe('DEL');
      expect(screen.getByText('code').tagName).toBe('CODE');
      expect(screen.getByText('@editorial-bot')).toBeInTheDocument();
    });
  });
});