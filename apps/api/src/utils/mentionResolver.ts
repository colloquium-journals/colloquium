import { prisma } from '@colloquium/database';

export interface ResolvedMention {
  originalText: string;
  userId?: string;
  botId?: string;
  displayName: string;
  type: 'user' | 'bot';
}

const MENTION_REGEX = /(?<!\w)@([a-z][a-z0-9-]{2,29})(?=\s|$|[.,!?;:])/g;

const KNOWN_BOT_IDS = [
  'editorial-bot',
  'plagiarism-checker',
  'reference-bot',
  'reviewer-checklist'
];

function isBotId(id: string): boolean {
  return KNOWN_BOT_IDS.includes(id) || id.endsWith('-bot') || id.endsWith('-checker');
}

/**
 * Parse @mentions from message content and resolve them to user/bot IDs
 */
export async function resolveMentions(content: string, conversationId: string): Promise<ResolvedMention[]> {
  const mentions: ResolvedMention[] = [];

  // Get conversation participants for user resolution
  const participants = await prisma.conversation_participants.findMany({
    where: { conversationId },
    include: {
      users: {
        select: {
          id: true,
          username: true,
          name: true
        }
      }
    }
  });

  let match: RegExpExecArray | null;
  const regex = new RegExp(MENTION_REGEX.source, MENTION_REGEX.flags);

  while ((match = regex.exec(content)) !== null) {
    const mentionId = match[1];

    if (isBotId(mentionId)) {
      mentions.push({
        originalText: match[0],
        botId: mentionId,
        displayName: mentionId,
        type: 'bot'
      });
    } else {
      const participant = participants.find(p => p.users.username === mentionId);
      mentions.push({
        originalText: match[0],
        userId: participant?.users.id,
        displayName: participant?.users.name || mentionId,
        type: 'user'
      });
    }
  }

  return mentions;
}
