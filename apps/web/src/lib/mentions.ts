export interface Mention {
  id: string;
  name: string;
  startIndex: number;
  endIndex: number;
  isBot?: boolean;
}

/**
 * Parse @mentions from message content
 * Supports both bot IDs (@editorial-bot) and display names (@Editorial Bot)
 */
export function parseMentions(content: string): Mention[] {
  const mentions: Mention[] = [];
  
  // Pattern to match @mentions - more precise matching
  // Match actual bot IDs from the system: editorial-bot, plagiarism-checker, reference-bot, reviewer-checklist
  const botRegex = /@(editorial-bot|plagiarism-checker|reference-bot|reviewer-checklist|[\w-]*bot(?:\b|$)|[\w-]*checker(?:\b|$)|[\w-]*reviewer(?:\b|$)|Editorial\s+Bot|Plagiarism\s+Checker|Reference\s+Bot|Reviewer\s+Checklist)/gi;
  
  let match: RegExpExecArray | null;
  while ((match = botRegex.exec(content)) !== null) {
    const fullMatch = match[0]; // The full @mention
    const name = match[1].trim(); // The name part without @
    
    mentions.push({
      id: generateMentionId(name),
      name: fullMatch, // Keep the @ symbol
      startIndex: match.index,
      endIndex: match.index + fullMatch.length,
      isBot: true
    });
  }
  
  // Reset regex
  botRegex.lastIndex = 0;
  
  // Then try to match user names like @John Smith or @John Smith (email@domain.com)
  const userRegex = /@([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2}(?:\s+\([^)]+\))?)(?=\s|$|[.,!?;:])/g;
  
  while ((match = userRegex.exec(content)) !== null) {
    const fullMatch = match[0]; // The full @mention
    const name = match[1].trim(); // The name part without @
    
    // Skip if this position was already captured by bot regex
    const overlaps = mentions.some(existing => 
      match.index >= existing.startIndex && match.index < existing.endIndex
    );
    
    if (!overlaps) {
      mentions.push({
        id: generateMentionId(name),
        name: fullMatch, // Keep the @ symbol
        startIndex: match.index,
        endIndex: match.index + fullMatch.length,
        isBot: false
      });
    }
  }
  
  // Sort by position in text
  mentions.sort((a, b) => a.startIndex - b.startIndex);
  
  return mentions;
}

/**
 * Generate a consistent ID for a mention name
 */
function generateMentionId(name: string): string {
  // For disambiguated names like "John Smith (email@domain.com)", extract just the display name
  const displayName = name.replace(/\s+\([^)]+\)$/, '');
  // Convert to lowercase and replace spaces with hyphens for consistent ID format
  return displayName.toLowerCase().replace(/\s+/g, '-');
}

/**
 * Determine if a mention is likely a bot based on naming patterns
 */
function isLikelyBot(name: string): boolean {
  const botPatterns = [
    /\b(bot|assistant|ai)\b/i,
    /^(editorial|plagiarism|statistics|formatting)-?bot$/i,
    /-bot$/i,
    /\bbot$/i
  ];
  
  return botPatterns.some(pattern => pattern.test(name));
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
  
  // Sort mentions by start index to process them in order
  mentions.sort((a, b) => a.startIndex - b.startIndex);
  
  for (const mention of mentions) {
    // Add text before the mention
    if (mention.startIndex > lastIndex) {
      chunks.push({
        type: 'text',
        content: content.substring(lastIndex, mention.startIndex)
      });
    }
    
    // Add the mention chunk
    chunks.push({
      type: 'mention',
      content: mention.name,
      mention
    });
    
    lastIndex = mention.endIndex;
  }
  
  // Add remaining text after the last mention
  if (lastIndex < content.length) {
    chunks.push({
      type: 'text',
      content: content.substring(lastIndex)
    });
  }
  
  return chunks;
}

/**
 * Common bot information for hover cards
 */
export const BOT_INFO: Record<string, { displayName: string; description: string; role: string }> = {
  'editorial-bot': {
    displayName: 'Editorial Bot',
    description: 'Assists with manuscript editorial workflows, status updates, and reviewer assignments',
    role: 'Editorial Assistant'
  },
  'plagiarism-checker': {
    displayName: 'Plagiarism Checker',
    description: 'Advanced plagiarism detection using multiple academic databases and AI algorithms',
    role: 'Content Reviewer'
  },
  'reference-bot': {
    displayName: 'Reference Bot',
    description: 'Validates references and checks DOI availability and correctness',
    role: 'Reference Validator'
  },
  'reviewer-checklist': {
    displayName: 'Reviewer Checklist',
    description: 'Generates customizable checklists for manuscript reviewers',
    role: 'Review Assistant'
  }
};