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
  // First try to match bot patterns like @editorial-bot and @Editorial Bot
  const botRegex = /@([\w-]*bot\b|editorial-bot|plagiarism-bot|statistics-bot|formatting-bot|Editorial\s+Bot|Plagiarism\s+Bot|Statistics\s+Bot|Formatting\s+Bot)/gi;
  
  let match;
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
  
  // Then try to match user names like @John Smith (2-3 words max)
  const userRegex = /@([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})(?=\s|$|[.,!?;:])/g;
  
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
  // Convert to lowercase and replace spaces with hyphens for consistent ID format
  return name.toLowerCase().replace(/\s+/g, '-');
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
    description: 'Assists with manuscript editorial workflows and review processes',
    role: 'Editorial Assistant'
  },
  'plagiarism-bot': {
    displayName: 'Plagiarism Bot', 
    description: 'Checks manuscripts for potential plagiarism and citation issues',
    role: 'Content Reviewer'
  },
  'statistics-bot': {
    displayName: 'Statistics Bot',
    description: 'Reviews statistical analysis and methodology in manuscripts',
    role: 'Statistical Reviewer'
  },
  'formatting-bot': {
    displayName: 'Formatting Bot',
    description: 'Checks manuscript formatting and style guidelines',
    role: 'Style Checker'
  }
};