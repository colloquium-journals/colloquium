import { Text } from '@mantine/core';
import { parseContentWithMentions, ContentChunk } from '../../lib/mentions';
import { parseMarkdownWithMentions, type MarkdownChunk } from '../../lib/markdown';
import { MentionTooltip } from './MentionTooltip';
import { sanitizeHTML } from '../../lib/sanitize';
import styles from './MarkdownContent.module.css';
import { useEffect, useRef } from 'react';

interface MessageContentProps {
  content: string;
  conversationId: string;
  messageId: string;
  size?: string;
  style?: React.CSSProperties;
}

export function MessageContent({ content, conversationId, messageId, size = 'sm', style }: MessageContentProps) {
  const chunks = parseMarkdownWithMentions(content);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Handle clicks on hash links to prevent opening new tabs
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'A') {
        const href = target.getAttribute('href');
        if (href && href.startsWith('#message-')) {
          e.preventDefault();
          // Scroll to the target message
          const targetElement = document.getElementById(href.substring(1));
          if (targetElement) {
            targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }
      }
    };
    
    container.addEventListener('click', handleClick);
    return () => container.removeEventListener('click', handleClick);
  }, []);
  
  return (
    <div 
      ref={containerRef}
      style={{
        fontSize: size === 'xs' ? '12px' : size === 'sm' ? '14px' : size === 'md' ? '16px' : '18px',
        lineHeight: 1.6,
        ...style
      }}
    >
      {chunks.map((chunk, index) => (
        <MarkdownChunk 
          key={index} 
          chunk={chunk} 
          conversationId={conversationId}
          messageId={messageId}
        />
      ))}
    </div>
  );
}

interface MarkdownChunkProps {
  chunk: MarkdownChunk;
  conversationId: string;
  messageId: string;
}

function MarkdownChunk({ chunk, conversationId, messageId }: MarkdownChunkProps) {
  if (chunk.type === 'markdown' && chunk.html) {
    // Check if this is truly block content (not just simple text wrapped in p tags)
    const hasRealBlockElements = /<(h[1-6]|div|ul|ol|li|blockquote|pre|table|tr|td|th)\b[^>]*>/i.test(chunk.html);
    const isSimpleParagraph = /^<p[^>]*>.*<\/p>\s*$/s.test(chunk.html.trim()) && !hasRealBlockElements;
    
    if (hasRealBlockElements || (!isSimpleParagraph && /<p\b[^>]*>/i.test(chunk.html))) {
      // Use div for true block-level content
      return (
        <div 
          className={styles.markdownContentBlock}
          dangerouslySetInnerHTML={{ __html: sanitizeHTML(chunk.html) }}
        />
      );
    } else {
      // For simple content (including single paragraphs that could be inline), strip p tags and use span
      let inlineHtml = chunk.html;
      if (isSimpleParagraph) {
        // Strip the paragraph tags and any trailing whitespace/newlines
        inlineHtml = chunk.html.replace(/^<p[^>]*>(.*)<\/p>\s*$/s, '$1');
      }

      return (
        <span
          className={styles.markdownContent}
          dangerouslySetInnerHTML={{ __html: sanitizeHTML(inlineHtml) }}
        />
      );
    }
  }

  // Interactive checkboxes are now handled by built-in markdown rendering
  // The checkbox state is stored in the message content itself when edited

  if (chunk.type === 'mention' && chunk.mention) {
    return (
      <MentionTooltip 
        mention={chunk.mention} 
        conversationId={conversationId}
      >
        <span
          style={{
            fontWeight: 600,
            color: chunk.mention.isBot ? 'var(--mantine-color-blue-6)' : 'var(--mantine-color-grape-6)',
            cursor: 'pointer',
            borderRadius: '3px',
            padding: '1px 3px',
            backgroundColor: chunk.mention.isBot ? 'var(--mantine-color-blue-0)' : 'var(--mantine-color-grape-0)',
            border: `1px solid ${chunk.mention.isBot ? 'var(--mantine-color-blue-2)' : 'var(--mantine-color-grape-2)'}`,
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            const target = e.target as HTMLElement;
            target.style.backgroundColor = chunk.mention!.isBot ? 'var(--mantine-color-blue-1)' : 'var(--mantine-color-grape-1)';
            target.style.borderColor = chunk.mention!.isBot ? 'var(--mantine-color-blue-4)' : 'var(--mantine-color-grape-4)';
          }}
          onMouseLeave={(e) => {
            const target = e.target as HTMLElement;
            target.style.backgroundColor = chunk.mention!.isBot ? 'var(--mantine-color-blue-0)' : 'var(--mantine-color-grape-0)';
            target.style.borderColor = chunk.mention!.isBot ? 'var(--mantine-color-blue-2)' : 'var(--mantine-color-grape-2)';
          }}
        >
          {chunk.content}
        </span>
      </MentionTooltip>
    );
  }

  return <>{chunk.content}</>;
}