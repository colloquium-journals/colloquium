import { marked } from 'marked';
import { parseMentions, Mention } from './mentions';

export interface MarkdownChunk {
  type: 'markdown' | 'mention';
  content: string;
  mention?: Mention;
  html?: string;
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

// Interactive checkboxes are now handled by standard markdown rendering
// Checkboxes in markdown (- [ ] or - [x]) will be rendered as disabled HTML checkboxes

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
  // First, find code ranges to exclude from mention parsing
  const codeRanges = findCodeRanges(content);
  
  // Find mentions, but exclude those inside code blocks
  const mentions = parseMentions(content).filter(mention => {
    return !codeRanges.some(range => 
      mention.startIndex >= range.start && mention.endIndex <= range.end
    );
  });
  
  if (mentions.length === 0) {
    // No mentions, just parse as markdown (checkboxes will be rendered by marked)
    return [{
      type: 'markdown',
      content,
      html: marked.parse(content) as string
    }];
  }

  const chunks: MarkdownChunk[] = [];
  let lastIndex = 0;

  for (const mention of mentions) {
    // Add markdown content before the mention
    if (mention.startIndex > lastIndex) {
      const markdownContent = content.substring(lastIndex, mention.startIndex);
      if (markdownContent.trim()) {
        chunks.push({
          type: 'markdown',
          content: markdownContent,
          html: marked.parse(markdownContent) as string
        });
      }
    }

    // Add the mention chunk
    chunks.push({
      type: 'mention',
      content: mention.name,
      mention
    });

    lastIndex = mention.endIndex;
  }

  // Add remaining content after the last mention
  if (lastIndex < content.length) {
    const markdownContent = content.substring(lastIndex);
    if (markdownContent.trim()) {
      chunks.push({
        type: 'markdown',
        content: markdownContent,
        html: marked.parse(content.substring(lastIndex)) as string
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