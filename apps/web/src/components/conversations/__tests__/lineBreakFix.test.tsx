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

describe('Line Break Fix for Bot Mentions', () => {
  const defaultProps = {
    conversationId: 'test-conversation-id',
    messageId: 'test-message-id'
  };

  it('should render bot mention followed by command without line breaks', () => {
    const { container } = renderWithProvider(
      <MessageContent 
        content="@editorial-bot summary" 
        {...defaultProps}
      />
    );
    
    // Check that both the mention and text are present
    expect(screen.getByText('@editorial-bot')).toBeInTheDocument();
    expect(screen.getByText('summary')).toBeInTheDocument();
    
    // Check that the content flows inline by verifying markup structure
    const mentionElement = screen.getByText('@editorial-bot');
    const summaryElement = screen.getByText('summary');
    
    // The mention should be in a span (inline)
    expect(mentionElement.tagName).toBe('SPAN');
    
    // The text should also be in a span (inline), not a div
    expect(summaryElement.tagName).toBe('SPAN');
    
    // Both should be in the same container (skip style element)
    const containerDiv = container.querySelector('div[style*="font-size"]') as HTMLElement;
    expect(containerDiv).toContainElement(mentionElement);
    expect(containerDiv).toContainElement(summaryElement);
  });

  it('should handle bot mention with space and command', () => {
    const { container } = renderWithProvider(
      <MessageContent 
        content="@editorial-bot please provide a summary" 
        {...defaultProps}
      />
    );
    
    const mentionElement = screen.getByText('@editorial-bot');
    const commandElement = screen.getByText('please provide a summary');
    
    // Both should be inline elements
    expect(mentionElement.tagName).toBe('SPAN');
    expect(commandElement.tagName).toBe('SPAN');
    
    // Should be in same container (skip style element)
    const containerDiv = container.querySelector('div[style*="font-size"]') as HTMLElement;
    expect(containerDiv).toContainElement(mentionElement);
    expect(containerDiv).toContainElement(commandElement);
  });

  it('should handle mixed markdown and mentions inline', () => {
    const { container } = renderWithProvider(
      <MessageContent 
        content="Please **check** @editorial-bot summary *now*" 
        {...defaultProps}
      />
    );
    
    const mentionElement = screen.getByText('@editorial-bot');
    const boldElement = screen.getByText('check');
    const italicElement = screen.getByText('now');
    const summaryElement = screen.getByText('summary');
    
    // All inline content should be in span elements
    expect(mentionElement.tagName).toBe('SPAN');
    expect(boldElement.tagName).toBe('STRONG');
    expect(italicElement.tagName).toBe('EM');
    expect(summaryElement.tagName).toBe('SPAN');
    
    // All should be in the same container (skip style element)
    const containerDiv = container.querySelector('div[style*="font-size"]') as HTMLElement;
    expect(containerDiv).toContainElement(mentionElement);
    expect(containerDiv).toContainElement(boldElement);
    expect(containerDiv).toContainElement(italicElement);
    expect(containerDiv).toContainElement(summaryElement);
  });

  it('should still render block content properly', () => {
    const { container } = renderWithProvider(
      <MessageContent 
        content="# Header\n\n@editorial-bot please review:\n\n- Item 1\n- Item 2" 
        {...defaultProps}
      />
    );
    
    const headerElement = screen.getByRole('heading', { level: 1 });
    const mentionElement = screen.getByText('@editorial-bot');
    
    // Header should be in block content (div)
    expect(headerElement.closest('div')).toHaveClass('markdownContentBlock');
    
    // Mention should still be inline
    expect(mentionElement.tagName).toBe('SPAN');
  });

  it('should verify no line breaks in HTML output', () => {
    const { container } = renderWithProvider(
      <MessageContent 
        content="@editorial-bot summary" 
        {...defaultProps}
      />
    );
    
    const html = container.innerHTML;
    
    // Should not contain <br> tags or block-level div wrappers around inline content
    expect(html).not.toContain('<br>');
    
    // Should contain inline span elements
    expect(html).toContain('<span');
    
    // Should not have block-level divs around simple text
    expect(html).not.toMatch(/<div[^>]*markdownContentBlock[^>]*>.*summary.*<\/div>/);
  });
});