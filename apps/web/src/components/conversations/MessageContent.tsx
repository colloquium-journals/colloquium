import { Text } from '@mantine/core';
import { parseContentWithMentions, ContentChunk } from '../../lib/mentions';
import { MentionTooltip } from './MentionTooltip';

interface MessageContentProps {
  content: string;
  conversationId: string;
  size?: string;
  style?: React.CSSProperties;
}

export function MessageContent({ content, conversationId, size = 'sm', style }: MessageContentProps) {
  const chunks = parseContentWithMentions(content);

  return (
    <Text 
      size={size} 
      style={{
        whiteSpace: 'pre-wrap',
        lineHeight: 1.6,
        ...style
      }}
    >
      {chunks.map((chunk, index) => (
        <MessageChunk 
          key={index} 
          chunk={chunk} 
          conversationId={conversationId} 
        />
      ))}
    </Text>
  );
}

interface MessageChunkProps {
  chunk: ContentChunk;
  conversationId: string;
}

function MessageChunk({ chunk, conversationId }: MessageChunkProps) {
  if (chunk.type === 'text') {
    return <>{chunk.content}</>;
  }

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