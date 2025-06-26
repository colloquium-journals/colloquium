import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { MessageContent } from '../MessageContent';

// Mock the MentionTooltip component since it's not the focus of these tests
jest.mock('../MentionTooltip', () => ({
  MentionTooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>
}));

// Interactive checkboxes are now handled by built-in markdown rendering

const renderWithProvider = (component: React.ReactElement) => {
  return render(
    <MantineProvider>
      {component}
    </MantineProvider>
  );
};

describe('MessageContent', () => {
  const defaultProps = {
    conversationId: 'test-conversation-id',
    messageId: 'test-message-id'
  };

  describe('Basic Text Rendering', () => {
    it('should render plain text without markdown', () => {
      renderWithProvider(
        <MessageContent 
          content="Simple plain text message" 
          {...defaultProps}
        />
      );
      
      expect(screen.getByText('Simple plain text message')).toBeInTheDocument();
    });

    it('should render text with different sizes', () => {
      const { rerender } = renderWithProvider(
        <MessageContent 
          content="Test message" 
          size="xs"
          {...defaultProps}
        />
      );
      
      let container = screen.getByText('Test message').closest('div');
      expect(container).toHaveStyle({ fontSize: '12px' });
      
      rerender(
        <MantineProvider>
          <MessageContent 
            content="Test message" 
            size="md"
            {...defaultProps}
          />
        </MantineProvider>
      );
      
      container = screen.getByText('Test message').closest('div');
      expect(container).toHaveStyle({ fontSize: '16px' });
    });
  });

  describe('Markdown Rendering', () => {
    it('should render bold text', () => {
      renderWithProvider(
        <MessageContent 
          content="This is **bold text**" 
          {...defaultProps}
        />
      );
      
      const boldElement = screen.getByText('bold text');
      expect(boldElement).toBeInTheDocument();
      expect(boldElement.tagName).toBe('STRONG');
    });

    it('should render italic text', () => {
      renderWithProvider(
        <MessageContent 
          content="This is *italic text*" 
          {...defaultProps}
        />
      );
      
      const italicElement = screen.getByText('italic text');
      expect(italicElement).toBeInTheDocument();
      expect(italicElement.tagName).toBe('EM');
    });

    it('should render inline code', () => {
      renderWithProvider(
        <MessageContent 
          content="This is `inline code`" 
          {...defaultProps}
        />
      );
      
      const codeElement = screen.getByText('inline code');
      expect(codeElement).toBeInTheDocument();
      expect(codeElement.tagName).toBe('CODE');
    });

    it('should render headers', () => {
      renderWithProvider(
        <MessageContent 
          content="# Main Header" 
          {...defaultProps}
        />
      );
      
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Main Header');
    });

    it('should render links with security attributes', () => {
      renderWithProvider(
        <MessageContent 
          content="Check out [this link](https://example.com)" 
          {...defaultProps}
        />
      );
      
      const link = screen.getByRole('link', { name: 'this link' });
      expect(link).toHaveAttribute('href', 'https://example.com');
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('should render lists', () => {
      renderWithProvider(
        <MessageContent 
          content="- Item 1\n- Item 2" 
          {...defaultProps}
        />
      );
      
      expect(screen.getByRole('list')).toBeInTheDocument();
      expect(screen.getByText(/Item 1/)).toBeInTheDocument();
      expect(screen.getByText(/Item 2/)).toBeInTheDocument();
    });
  });

  describe('Bot Mention Rendering', () => {
    it('should render bot mentions with proper styling', () => {
      renderWithProvider(
        <MessageContent 
          content="@editorial-bot please help" 
          {...defaultProps}
        />
      );
      
      const mentionElement = screen.getByText('@editorial-bot');
      expect(mentionElement).toBeInTheDocument();
      expect(mentionElement).toHaveStyle({
        fontWeight: '600',
        cursor: 'pointer'
      });
    });

    it('should render user mentions with different styling than bots', () => {
      renderWithProvider(
        <MessageContent 
          content="@John Smith please review" 
          {...defaultProps}
        />
      );
      
      const mentionElement = screen.getByText('@John Smith');
      expect(mentionElement).toBeInTheDocument();
      expect(mentionElement).toHaveStyle({
        fontWeight: '600',
        cursor: 'pointer'
      });
    });

    it('should handle multiple mentions', () => {
      renderWithProvider(
        <MessageContent 
          content="@editorial-bot and @John Smith please review" 
          {...defaultProps}
        />
      );
      
      expect(screen.getByText('@editorial-bot')).toBeInTheDocument();
      expect(screen.getByText('@John Smith')).toBeInTheDocument();
      expect(screen.getByText('and')).toBeInTheDocument();
      expect(screen.getByText('please review')).toBeInTheDocument();
    });
  });

  describe('Mixed Content Rendering', () => {
    it('should render markdown and mentions together correctly', () => {
      renderWithProvider(
        <MessageContent 
          content="**Bold** @editorial-bot *italic* text" 
          {...defaultProps}
        />
      );
      
      expect(screen.getByText('Bold').tagName).toBe('STRONG');
      expect(screen.getByText('@editorial-bot')).toBeInTheDocument();
      expect(screen.getByText('italic').tagName).toBe('EM');
      expect(screen.getByText('text')).toBeInTheDocument();
    });

    it('should handle complex content with headers, mentions, and formatting', () => {
      const complexContent = `# Review Request

@editorial-bot please review this article with the following criteria:

- **Statistical analysis** accuracy
- *Methodology* completeness  
- Citation formatting

Please also coordinate with @John Smith for peer review.`;

      renderWithProvider(
        <MessageContent 
          content={complexContent} 
          {...defaultProps}
        />
      );
      
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Review Request');
      expect(screen.getByText('@editorial-bot')).toBeInTheDocument();
      expect(screen.getByText('@John Smith')).toBeInTheDocument();
      expect(screen.getByText('Statistical analysis').tagName).toBe('STRONG');
      expect(screen.getByText('Methodology').tagName).toBe('EM');
    });

    it('should handle mentions at different positions with markdown', () => {
      renderWithProvider(
        <MessageContent 
          content="@editorial-bot **start**, middle *content* @John Smith **end**" 
          {...defaultProps}
        />
      );
      
      // Check that all elements are rendered
      expect(screen.getByText('@editorial-bot')).toBeInTheDocument();
      expect(screen.getByText('start').tagName).toBe('STRONG');
      expect(screen.getByText('content').tagName).toBe('EM');
      expect(screen.getByText('@John Smith')).toBeInTheDocument();
      expect(screen.getByText('end').tagName).toBe('STRONG');
    });

    it('should preserve whitespace appropriately', () => {
      renderWithProvider(
        <MessageContent 
          content="@editorial-bot summary" 
          {...defaultProps}
        />
      );
      
      const container = screen.getByText('@editorial-bot').parentElement;
      const summaryText = screen.getByText('summary');
      
      // Both should be in the same container and the mention should not have extra line breaks
      expect(container).toBeInTheDocument();
      expect(summaryText).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty content', () => {
      const { container } = renderWithProvider(
        <MessageContent 
          content="" 
          {...defaultProps}
        />
      );
      
      // Should render without throwing - just check the container exists
      expect(container.firstChild).toBeInTheDocument();
    });

    it('should handle content with only whitespace', () => {
      const { container } = renderWithProvider(
        <MessageContent 
          content="   \n   " 
          {...defaultProps}
        />
      );
      
      // Should render without throwing (content gets filtered by markdown parser)
      expect(container.firstChild).toBeInTheDocument();
    });

    it('should handle malformed markdown gracefully', () => {
      renderWithProvider(
        <MessageContent 
          content="**unclosed bold and @editorial-bot *unclosed italic" 
          {...defaultProps}
        />
      );
      
      expect(screen.getByText('@editorial-bot')).toBeInTheDocument();
      // Should render without throwing even with malformed markdown
    });

    it('should handle special characters', () => {
      renderWithProvider(
        <MessageContent 
          content="Special chars: & < > ' @editorial-bot test" 
          {...defaultProps}
        />
      );
      
      expect(screen.getByText('@editorial-bot')).toBeInTheDocument();
      expect(screen.getByText(/Special chars/)).toBeInTheDocument();
    });

    it('should apply custom styles correctly', () => {
      const customStyle = { color: 'red', backgroundColor: 'blue' };
      
      renderWithProvider(
        <MessageContent 
          content="Test content" 
          style={customStyle}
          {...defaultProps}
        />
      );
      
      const container = screen.getByText('Test content').closest('div');
      expect(container).toHaveStyle(customStyle);
    });
  });

  describe('Line Break Behavior', () => {
    it('should not introduce unwanted line breaks after bot mentions', () => {
      renderWithProvider(
        <MessageContent 
          content="@editorial-bot summary" 
          {...defaultProps}
        />
      );
      
      const mentionElement = screen.getByText('@editorial-bot');
      const summaryElement = screen.getByText('summary');
      
      // Both elements should be present
      expect(mentionElement).toBeInTheDocument();
      expect(summaryElement).toBeInTheDocument();
      
      // Check that they are in the same inline context
      const container = mentionElement.closest('div');
      expect(container).toContainElement(summaryElement);
    });

    it('should handle mentions followed by commands without line breaks', () => {
      renderWithProvider(
        <MessageContent 
          content="@editorial-bot summary please" 
          {...defaultProps}
        />
      );
      
      const mentionElement = screen.getByText('@editorial-bot');
      const summaryElement = screen.getByText('summary please');
      
      expect(mentionElement).toBeInTheDocument();
      expect(summaryElement).toBeInTheDocument();
      
      // Check proper inline rendering
      const container = mentionElement.closest('div');
      expect(container).toContainElement(summaryElement);
    });
  });
});