import { prisma } from '@colloquium/database';

export interface ResolvedMention {
  originalText: string;
  userId?: string;
  botId?: string;
  displayName: string;
  type: 'user' | 'bot';
}

/**
 * Parse @mentions from message content and resolve them to user/bot IDs
 */
export async function resolveMentions(content: string, conversationId: string): Promise<ResolvedMention[]> {
  const mentions: ResolvedMention[] = [];
  
  // Bot regex - matches kebab-case bot IDs
  const botRegex = /@(editorial-bot|plagiarism-checker|reference-bot|reviewer-checklist|[\w-]*bot(?:\b|$)|[\w-]*checker(?:\b|$)|[\w-]*reviewer(?:\b|$))/gi;
  
  let match: RegExpExecArray | null;
  while ((match = botRegex.exec(content)) !== null) {
    const botId = match[1];
    mentions.push({
      originalText: match[0],
      botId,
      displayName: botId,
      type: 'bot'
    });
  }
  
  // Reset regex
  botRegex.lastIndex = 0;
  
  // User regex - matches display names with optional email disambiguation
  const userRegex = /@([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2}(?:\s+\([^)]+\))?)(?=\s|$|[.,!?;:])/g;
  
  // Get conversation participants for user resolution
  const participants = await prisma.conversationParticipant.findMany({
    where: { conversationId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true
        }
      }
    }
  });
  
  while ((match = userRegex.exec(content)) !== null) {
    const fullMatch = match[0];
    const mentionText = match[1].trim();
    
    // Skip if this position was already captured by bot regex
    const overlaps = mentions.some(existing => 
      match.index >= content.indexOf(existing.originalText) && 
      match.index < content.indexOf(existing.originalText) + existing.originalText.length
    );
    
    if (!overlaps) {
      const resolvedUser = await resolveUserMention(mentionText, participants);
      mentions.push({
        originalText: fullMatch,
        userId: resolvedUser?.id,
        displayName: extractDisplayName(mentionText),
        type: 'user'
      });
    }
  }
  
  return mentions;
}

/**
 * Resolve a user mention to an actual user ID
 */
async function resolveUserMention(
  mentionText: string, 
  participants: Array<{ user: { id: string; name: string | null; email: string } }>
): Promise<{ id: string } | null> {
  // Check if it's a disambiguated mention like "John Smith (email@domain.com)"
  const emailMatch = mentionText.match(/^(.+?)\s+\(([^)]+)\)$/);
  
  if (emailMatch) {
    // Disambiguated mention - match by display name AND email
    const displayName = emailMatch[1].trim();
    const email = emailMatch[2].trim();
    
    const user = participants.find(p => {
      const userDisplayName = p.user.name || p.user.email;
      return userDisplayName === displayName && p.user.email === email;
    });
    
    return user ? { id: user.user.id } : null;
  } else {
    // Simple mention - match by display name only
    const user = participants.find(p => {
      const userDisplayName = p.user.name || p.user.email;
      return userDisplayName === mentionText;
    });
    
    return user ? { id: user.user.id } : null;
  }
}

/**
 * Extract display name from mention text (remove email disambiguation if present)
 */
function extractDisplayName(mentionText: string): string {
  return mentionText.replace(/\s+\([^)]+\)$/, '');
}