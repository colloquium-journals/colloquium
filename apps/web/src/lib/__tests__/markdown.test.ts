import { 
  parseMarkdown, 
  parseMarkdownWithMentions, 
  stripHtml, 
  hasMarkdownFormatting 
} from '../markdown';

describe('Markdown Parsing', () => {
  describe('parseMarkdown', () => {
    it('should parse basic markdown formatting', () => {
      const input = '**bold** and *italic* text';
      const result = parseMarkdown(input);
      
      expect(result).toContain('<strong>bold</strong>');
      expect(result).toContain('<em>italic</em>');
    });

    it('should parse code blocks', () => {
      const input = '`inline code` and ```\ncode block\n```';
      const result = parseMarkdown(input);
      
      expect(result).toContain('<code>inline code</code>');
      expect(result).toContain('<code>code block</code>');
    });

    it('should parse headers', () => {
      const input = '# Header 1\n## Header 2\n### Header 3';
      const result = parseMarkdown(input);
      
      expect(result).toContain('<h1>Header 1</h1>');
      expect(result).toContain('<h2>Header 2</h2>');
      expect(result).toContain('<h3>Header 3</h3>');
    });

    it('should parse lists', () => {
      const input = '- Item 1\n- Item 2\n\n1. Numbered 1\n2. Numbered 2';
      const result = parseMarkdown(input);
      
      expect(result).toContain('<ul>');
      expect(result).toContain('<li>Item 1</li>');
      expect(result).toContain('<ol>');
      expect(result).toContain('<li>Numbered 1</li>');
    });

    it('should parse links with security attributes', () => {
      const input = '[Link text](https://example.com)';
      const result = parseMarkdown(input);
      
      expect(result).toContain('href="https://example.com"');
      expect(result).toContain('target="_blank"');
      expect(result).toContain('rel="noopener noreferrer"');
      expect(result).toContain('Link text');
    });

    it('should parse blockquotes', () => {
      const input = '> This is a quote\n> Multi-line quote';
      const result = parseMarkdown(input);
      
      expect(result).toContain('<blockquote>');
      expect(result).toContain('This is a quote');
    });

    it('should not convert line breaks to <br> when breaks=false', () => {
      const input = 'Line 1\nLine 2';
      const result = parseMarkdown(input);
      
      expect(result).not.toContain('<br>');
    });
  });

  describe('parseMarkdownWithMentions', () => {
    it('should handle content without mentions', () => {
      const input = '**Bold text** without mentions';
      const chunks = parseMarkdownWithMentions(input);
      
      expect(chunks).toHaveLength(1);
      expect(chunks[0].type).toBe('markdown');
      expect(chunks[0].html).toContain('<strong>Bold text</strong>');
    });

    it('should preserve bot mentions while parsing surrounding markdown', () => {
      const input = '**Bold** @editorial-bot please *help*';
      const chunks = parseMarkdownWithMentions(input);
      
      expect(chunks).toHaveLength(3);
      
      // First chunk: bold markdown
      expect(chunks[0].type).toBe('markdown');
      expect(chunks[0].html).toContain('<strong>Bold</strong>');
      
      // Second chunk: bot mention
      expect(chunks[1].type).toBe('mention');
      expect(chunks[1].content).toBe('@editorial-bot');
      
      // Third chunk: italic markdown
      expect(chunks[2].type).toBe('markdown');
      expect(chunks[2].html).toContain('<em>help</em>');
    });

    it('should handle multiple mentions with markdown', () => {
      const input = '@editorial-bot **summary** and @John Smith review';
      const chunks = parseMarkdownWithMentions(input);
      
      expect(chunks).toHaveLength(4);
      expect(chunks[0].type).toBe('mention');
      expect(chunks[1].type).toBe('markdown');
      expect(chunks[1].html).toContain('<strong>summary</strong>');
      expect(chunks[2].type).toBe('mention');
      expect(chunks[3].type).toBe('markdown');
    });

    it('should handle mentions at the beginning', () => {
      const input = '@editorial-bot please review';
      const chunks = parseMarkdownWithMentions(input);
      
      expect(chunks).toHaveLength(2);
      expect(chunks[0].type).toBe('mention');
      expect(chunks[0].content).toBe('@editorial-bot');
      expect(chunks[1].type).toBe('markdown');
      expect(chunks[1].content).toBe(' please review');
    });

    it('should handle mentions at the end', () => {
      const input = 'Please check with @editorial-bot';
      const chunks = parseMarkdownWithMentions(input);
      
      expect(chunks).toHaveLength(2);
      expect(chunks[0].type).toBe('markdown');
      expect(chunks[0].content).toBe('Please check with ');
      expect(chunks[1].type).toBe('mention');
      expect(chunks[1].content).toBe('@editorial-bot');
    });

    it('should handle adjacent mentions', () => {
      const input = '@editorial-bot @John Smith';
      const chunks = parseMarkdownWithMentions(input);
      
      // Since a single space gets trimmed out, we only get the 2 mentions
      expect(chunks).toHaveLength(2);
      expect(chunks[0].type).toBe('mention');
      expect(chunks[0].content).toBe('@editorial-bot');
      expect(chunks[1].type).toBe('mention');
      expect(chunks[1].content).toBe('@John Smith');
    });

    it('should not break with complex markdown and mentions', () => {
      const input = '# Review Request\n\n@editorial-bot please:\n\n- **Check** formatting\n- *Verify* citations\n- Review with @John Smith\n\n```\ncode example\n```';
      const chunks = parseMarkdownWithMentions(input);
      
      const mentionChunks = chunks.filter(c => c.type === 'mention');
      const markdownChunks = chunks.filter(c => c.type === 'markdown');
      
      expect(mentionChunks).toHaveLength(2);
      expect(markdownChunks.length).toBeGreaterThan(0);
      
      // Verify that markdown is still parsed correctly
      const combinedHtml = markdownChunks.map(c => c.html).join('');
      expect(combinedHtml).toContain('<h1>Review Request</h1>');
      expect(combinedHtml).toContain('<strong>Check</strong>');
      expect(combinedHtml).toContain('<em>Verify</em>');
      expect(combinedHtml).toContain('<pre><code>code example');
    });
  });

  describe('stripHtml', () => {
    it('should remove HTML tags', () => {
      const input = '<strong>Bold</strong> and <em>italic</em> text';
      const result = stripHtml(input);
      
      expect(result).toBe('Bold and italic text');
    });

    it('should handle nested tags', () => {
      const input = '<p><strong>Bold <em>and italic</em></strong></p>';
      const result = stripHtml(input);
      
      expect(result).toBe('Bold and italic');
    });

    it('should handle self-closing tags', () => {
      const input = 'Line 1<br/>Line 2';
      const result = stripHtml(input);
      
      expect(result).toBe('Line 1Line 2');
    });
  });

  describe('hasMarkdownFormatting', () => {
    it('should detect bold formatting', () => {
      expect(hasMarkdownFormatting('**bold text**')).toBe(true);
      expect(hasMarkdownFormatting('normal text')).toBe(false);
    });

    it('should detect italic formatting', () => {
      expect(hasMarkdownFormatting('*italic text*')).toBe(true);
      expect(hasMarkdownFormatting('normal text')).toBe(false);
    });

    it('should detect code formatting', () => {
      expect(hasMarkdownFormatting('`code`')).toBe(true);
      expect(hasMarkdownFormatting('```code block```')).toBe(true);
    });

    it('should detect headers', () => {
      expect(hasMarkdownFormatting('# Header')).toBe(true);
      expect(hasMarkdownFormatting('## Header')).toBe(true);
      expect(hasMarkdownFormatting('### Header')).toBe(true);
    });

    it('should detect lists', () => {
      expect(hasMarkdownFormatting('- List item')).toBe(true);
      expect(hasMarkdownFormatting('* List item')).toBe(true);
      expect(hasMarkdownFormatting('+ List item')).toBe(true);
      expect(hasMarkdownFormatting('1. Numbered item')).toBe(true);
    });

    it('should detect links', () => {
      expect(hasMarkdownFormatting('[Link](url)')).toBe(true);
    });

    it('should detect blockquotes', () => {
      expect(hasMarkdownFormatting('> Quote')).toBe(true);
    });

    it('should handle multiple formatting types', () => {
      expect(hasMarkdownFormatting('**Bold** and `code`')).toBe(true);
    });

    it('should return false for plain text', () => {
      expect(hasMarkdownFormatting('Just plain text')).toBe(false);
      expect(hasMarkdownFormatting('Text with @ mentions')).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty strings', () => {
      expect(parseMarkdown('')).toBe('');
      expect(parseMarkdownWithMentions('')).toEqual([{
        type: 'markdown',
        content: '',
        html: ''
      }]);
      expect(stripHtml('')).toBe('');
      expect(hasMarkdownFormatting('')).toBe(false);
    });

    it('should handle strings with only whitespace', () => {
      const chunks = parseMarkdownWithMentions('   \n   ');
      expect(chunks).toEqual([{
        type: 'markdown',
        content: '   \n   ',
        html: ''
      }]); // Empty content but structure preserved
    });

    it('should handle malformed markdown gracefully', () => {
      const input = '**unclosed bold and *unclosed italic';
      const result = parseMarkdown(input);
      
      // Should not throw and should return some result
      expect(typeof result).toBe('string');
    });

    it('should handle special characters in mentions and markdown', () => {
      const input = '**Special chars: & < > "** @editorial-bot';
      const chunks = parseMarkdownWithMentions(input);
      
      expect(chunks).toHaveLength(2);
      expect(chunks[0].type).toBe('markdown');
      expect(chunks[1].type).toBe('mention');
    });
  });
});