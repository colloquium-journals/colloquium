import { marked } from 'marked';
import { parseMentions, Mention } from './mentions';

export interface MarkdownChunk {
  type: 'markdown' | 'mention' | 'interactive_checkbox';
  content: string;
  mention?: Mention;
  html?: string;
  checkboxId?: string;
  checkboxLabel?: string;
  isRequired?: boolean;
}

// Configure marked with academic-friendly options
marked.use({
  gfm: true, // GitHub Flavored Markdown
  breaks: false, // Don't convert line breaks to <br> - causes issues with bot mentions
  pedantic: false,
  renderer: {
    // Customize link rendering for security
    link(token) {
      const { href, title, text } = token;
      const titleAttr = title ? ` title="${title}"` : '';
      return `<a href="${href}" target="_blank" rel="noopener noreferrer"${titleAttr}>${text}</a>`;
    }
  }
});

/**
 * Parse interactive checkboxes from content
 * Looks for patterns like: - [ ] Some text *(required)*
 */
function parseInteractiveCheckboxes(content: string): Array<{
  startIndex: number;
  endIndex: number;
  checkboxId: string;
  label: string;
  isRequired: boolean;
}> {
  const checkboxes: Array<{
    startIndex: number;
    endIndex: number;
    checkboxId: string;
    label: string;
    isRequired: boolean;
  }> = [];

  // Regex to match checkbox patterns with optional (required) indicator
  const checkboxRegex = /^(\s*)-\s*\[\s*\]\s*(.+?)(\s*\*\(required\)\*)?$/gm;
  let match;
  let checkboxIndex = 0;

  while ((match = checkboxRegex.exec(content)) !== null) {
    const fullMatch = match[0];
    const label = match[2].trim();
    const isRequired = !!match[3];
    
    // Generate a unique checkbox ID based on content and position
    const checkboxId = `checkbox-${checkboxIndex}-${label.substring(0, 20).replace(/[^a-zA-Z0-9]/g, '-')}`;
    
    checkboxes.push({
      startIndex: match.index,
      endIndex: match.index + fullMatch.length,
      checkboxId,
      label,
      isRequired
    });
    
    checkboxIndex++;
  }

  return checkboxes;
}

/**
 * Find code blocks and inline code to exclude from mention parsing
 */
function findCodeRanges(content: string): Array<{start: number, end: number}> {
  const ranges: Array<{start: number, end: number}> = [];
  
  // Find inline code blocks first (``code``)
  const inlineCodeRegex = /`([^`]+)`/g;
  let match;
  while ((match = inlineCodeRegex.exec(content)) !== null) {
    ranges.push({
      start: match.index,
      end: match.index + match[0].length
    });
  }
  
  // Find code blocks (```code```)
  const blockCodeRegex = /```[\s\S]*?```/g;
  while ((match = blockCodeRegex.exec(content)) !== null) {
    ranges.push({
      start: match.index,
      end: match.index + match[0].length
    });
  }
  
  return ranges.sort((a, b) => a.start - b.start);
}

/**
 * Parse content that may contain both markdown, mentions, and interactive checkboxes
 * This preserves mentions and checkboxes while allowing markdown formatting around them
 */
export function parseMarkdownWithMentions(content: string): MarkdownChunk[] {
  // First, find code ranges to exclude from mention and checkbox parsing
  const codeRanges = findCodeRanges(content);
  
  // Find mentions, but exclude those inside code blocks
  const mentions = parseMentions(content).filter(mention => {
    return !codeRanges.some(range => 
      mention.startIndex >= range.start && mention.endIndex <= range.end
    );
  });

  // Find interactive checkboxes, but exclude those inside code blocks
  const checkboxes = parseInteractiveCheckboxes(content).filter(checkbox => {
    return !codeRanges.some(range => 
      checkbox.startIndex >= range.start && checkbox.endIndex <= range.end
    );
  });
  
  // Combine mentions and checkboxes into a single sorted array of interactive elements
  const interactiveElements = [
    ...mentions.map(m => ({ ...m, type: 'mention' as const })),
    ...checkboxes.map(c => ({ ...c, type: 'checkbox' as const }))
  ].sort((a, b) => a.startIndex - b.startIndex);
  
  if (interactiveElements.length === 0) {
    // No interactive elements, just parse as markdown
    return [{
      type: 'markdown',
      content,
      html: marked.parse(content) as string
    }];
  }

  const chunks: MarkdownChunk[] = [];
  let lastIndex = 0;

  for (const element of interactiveElements) {
    // Add markdown content before the interactive element
    if (element.startIndex > lastIndex) {
      const markdownContent = content.substring(lastIndex, element.startIndex);
      if (markdownContent.trim()) {
        chunks.push({
          type: 'markdown',
          content: markdownContent,
          html: marked.parse(markdownContent) as string
        });
      }
    }

    // Add the interactive element chunk
    if (element.type === 'mention') {
      const mention = mentions.find(m => m.startIndex === element.startIndex);
      if (mention) {
        chunks.push({
          type: 'mention',
          content: mention.name,
          mention
        });
      }
    } else if (element.type === 'checkbox') {
      const checkbox = checkboxes.find(c => c.startIndex === element.startIndex);
      if (checkbox) {
        chunks.push({
          type: 'interactive_checkbox',
          content: checkbox.label,
          checkboxId: checkbox.checkboxId,
          checkboxLabel: checkbox.label,
          isRequired: checkbox.isRequired
        });
      }
    }

    lastIndex = element.endIndex;
  }

  // Add remaining content after the last interactive element
  if (lastIndex < content.length) {
    const markdownContent = content.substring(lastIndex);
    if (markdownContent.trim()) {
      chunks.push({
        type: 'markdown',
        content: markdownContent,
        html: marked.parse(markdownContent) as string
      });
    }
  }

  return chunks;
}

/**
 * Simple markdown-to-HTML conversion for content without mentions
 */
export function parseMarkdown(content: string): string {
  return marked.parse(content) as string;
}

/**
 * Strip HTML tags from markdown output for plain text display
 */
export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '');
}

/**
 * Check if content contains markdown formatting
 */
export function hasMarkdownFormatting(content: string): boolean {
  const markdownPatterns = [
    /\*\*.*?\*\*/, // Bold
    /\*.*?\*/, // Italic
    /`.*?`/, // Inline code
    /^#{1,6}\s/, // Headers
    /^\s*[-*+]\s/, // Lists
    /^\s*\d+\.\s/, // Numbered lists
    /\[.*?\]\(.*?\)/, // Links
    /```[\s\S]*?```/, // Code blocks
    /^>\s/, // Blockquotes
  ];
  
  return markdownPatterns.some(pattern => pattern.test(content));
}