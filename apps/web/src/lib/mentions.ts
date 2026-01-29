export interface Mention {
  id: string;
  name: string;
  startIndex: number;
  endIndex: number;
  isBot?: boolean;
}

const MENTION_REGEX = /(?<!\w)@([a-z][a-z0-9-]{2,29})(?=\s|$|[.,!?;:])/g;

/**
 * Common bot information for hover cards
 */
export const BOT_INFO: Record<string, { displayName: string; description: string; role: string }> = {
  'bot-editorial': {
    displayName: 'Editorial Bot',
    description: 'Assists with manuscript editorial workflows, status updates, and reviewer assignments',
    role: 'Editorial Assistant'
  },
  'bot-plagiarism-checker': {
    displayName: 'Plagiarism Checker',
    description: 'Advanced plagiarism detection using multiple academic databases and AI algorithms',
    role: 'Content Reviewer'
  },
  'bot-reference-check': {
    displayName: 'Reference Check',
    description: 'Validates DOIs resolve to real papers and flags references missing DOIs',
    role: 'Reference Validator'
  },
  'bot-reviewer-checklist': {
    displayName: 'Reviewer Checklist',
    description: 'Generates customizable checklists for manuscript reviewers',
    role: 'Review Assistant'
  }
};

function isBotId(id: string): boolean {
  return id in BOT_INFO || id.startsWith('bot-');
}

/**
 * Parse @mentions from message content.
 * All mentions use the same format: @lowercase-hyphenated-id
 */
export function parseMentions(content: string): Mention[] {
  const mentions: Mention[] = [];
  const regex = new RegExp(MENTION_REGEX.source, MENTION_REGEX.flags);

  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    const id = match[1];
    mentions.push({
      id,
      name: match[0],
      startIndex: match.index,
      endIndex: match.index + match[0].length,
      isBot: isBotId(id)
    });
  }

  return mentions;
}

/**
 * Split message content into text chunks and mention chunks for rendering
 */
export interface ContentChunk {
  type: 'text' | 'mention';
  content: string;
  mention?: Mention;
}

export function parseContentWithMentions(content: string): ContentChunk[] {
  const mentions = parseMentions(content);

  if (mentions.length === 0) {
    return [{ type: 'text', content }];
  }

  const chunks: ContentChunk[] = [];
  let lastIndex = 0;

  for (const mention of mentions) {
    if (mention.startIndex > lastIndex) {
      chunks.push({
        type: 'text',
        content: content.substring(lastIndex, mention.startIndex)
      });
    }

    chunks.push({
      type: 'mention',
      content: mention.name,
      mention
    });

    lastIndex = mention.endIndex;
  }

  if (lastIndex < content.length) {
    chunks.push({
      type: 'text',
      content: content.substring(lastIndex)
    });
  }

  return chunks;
}
