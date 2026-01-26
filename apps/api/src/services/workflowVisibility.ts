import { prisma } from '@colloquium/database';
import { WorkflowConfig, WorkflowPhase } from '@colloquium/types';

export type ViewerRole = 'author' | 'reviewer' | 'editor' | 'admin' | 'public';

export interface MessageAuthor {
  id: string;
  username: string;
  name?: string | null;
  email?: string;
}

export interface MaskedAuthor {
  id: string;
  username: string;
  name: string;
  email?: string;
  isMasked: boolean;
  originalId?: string;
}

interface ManuscriptContext {
  id: string;
  workflowPhase: string;
  workflowRound: number;
}

interface ReviewAssignment {
  reviewerId: string;
  status: string;
}

const reviewerIndexCache = new Map<string, Map<string, number>>();

export async function getViewerRole(
  userId: string | undefined,
  userGlobalRole: string | undefined,
  manuscriptId: string
): Promise<ViewerRole> {
  if (!userId) return 'public';

  if (userGlobalRole === 'ADMIN') return 'admin';
  if (userGlobalRole === 'EDITOR_IN_CHIEF' || userGlobalRole === 'ACTION_EDITOR') return 'editor';

  const isAuthor = await prisma.manuscript_authors.findFirst({
    where: { manuscriptId, userId },
    select: { id: true }
  });
  if (isAuthor) return 'author';

  const isReviewer = await prisma.review_assignments.findFirst({
    where: { manuscriptId, reviewerId: userId },
    select: { id: true }
  });
  if (isReviewer) return 'reviewer';

  return 'public';
}

export async function getMessageAuthorRole(
  authorId: string,
  manuscriptId: string
): Promise<ViewerRole> {
  const user = await prisma.users.findUnique({
    where: { id: authorId },
    select: { role: true }
  });

  if (user?.role === 'ADMIN') return 'admin';
  if (user?.role === 'EDITOR_IN_CHIEF' || user?.role === 'ACTION_EDITOR') return 'editor';
  if (user?.role === 'BOT') return 'editor';

  const isAuthor = await prisma.manuscript_authors.findFirst({
    where: { manuscriptId, userId: authorId },
    select: { id: true }
  });
  if (isAuthor) return 'author';

  const isReviewer = await prisma.review_assignments.findFirst({
    where: { manuscriptId, reviewerId: authorId },
    select: { id: true }
  });
  if (isReviewer) return 'reviewer';

  return 'public';
}

export async function canAuthorSeeReview(
  config: WorkflowConfig,
  phase: WorkflowPhase | string,
  messagePrivacy: string
): Promise<boolean> {
  if (messagePrivacy !== 'AUTHOR_VISIBLE' && messagePrivacy !== 'PUBLIC') {
    return false;
  }

  switch (config.author.seesReviews) {
    case 'realtime':
      return true;
    case 'on_release':
      return phase === WorkflowPhase.RELEASED || phase === WorkflowPhase.AUTHOR_RESPONDING;
    case 'never':
      return false;
    default:
      return false;
  }
}

export async function canReviewerSeeOtherReviews(
  config: WorkflowConfig,
  phase: WorkflowPhase | string,
  manuscriptId: string
): Promise<boolean> {
  switch (config.reviewers.seeEachOther) {
    case 'realtime':
      return true;
    case 'after_all_submit':
      return phase === WorkflowPhase.DELIBERATION ||
             phase === WorkflowPhase.RELEASED ||
             phase === WorkflowPhase.AUTHOR_RESPONDING ||
             await areAllReviewsComplete(manuscriptId);
    case 'never':
      return false;
    default:
      return false;
  }
}

async function areAllReviewsComplete(manuscriptId: string): Promise<boolean> {
  const assignments = await prisma.review_assignments.findMany({
    where: {
      manuscriptId,
      status: { in: ['ACCEPTED', 'IN_PROGRESS', 'COMPLETED'] }
    },
    select: { status: true }
  });

  if (assignments.length === 0) return false;
  return assignments.every(a => a.status === 'COMPLETED');
}

export async function canUserSeeMessageWithWorkflow(
  userId: string | undefined,
  userGlobalRole: string | undefined,
  messageAuthorId: string,
  messagePrivacy: string,
  manuscriptId: string,
  config: WorkflowConfig | null | undefined,
  manuscript: ManuscriptContext
): Promise<boolean> {
  if (!config) {
    return true;
  }

  const viewerRole = await getViewerRole(userId, userGlobalRole, manuscriptId);
  const authorRole = await getMessageAuthorRole(messageAuthorId, manuscriptId);

  if (viewerRole === 'admin' || viewerRole === 'editor') {
    return true;
  }

  const phase = manuscript.workflowPhase as WorkflowPhase;

  if (viewerRole === 'author') {
    if (authorRole === 'reviewer') {
      return await canAuthorSeeReview(config, phase, messagePrivacy);
    }
    return true;
  }

  if (viewerRole === 'reviewer') {
    if (authorRole === 'reviewer' && messageAuthorId !== userId) {
      return await canReviewerSeeOtherReviews(config, phase, manuscriptId);
    }

    if (authorRole === 'author') {
      if (config.reviewers.seeAuthorResponses === 'realtime') {
        return true;
      }
      return phase === WorkflowPhase.RELEASED || phase === WorkflowPhase.AUTHOR_RESPONDING;
    }
    return true;
  }

  return messagePrivacy === 'PUBLIC';
}

export async function getReviewerIndex(
  reviewerId: string,
  manuscriptId: string
): Promise<number> {
  if (!reviewerIndexCache.has(manuscriptId)) {
    reviewerIndexCache.set(manuscriptId, new Map());
  }
  const manuscriptCache = reviewerIndexCache.get(manuscriptId)!;

  if (manuscriptCache.has(reviewerId)) {
    return manuscriptCache.get(reviewerId)!;
  }

  const assignments = await prisma.review_assignments.findMany({
    where: { manuscriptId },
    orderBy: { assignedAt: 'asc' },
    select: { reviewerId: true }
  });

  assignments.forEach((a, idx) => {
    manuscriptCache.set(a.reviewerId, idx + 1);
  });

  return manuscriptCache.get(reviewerId) || manuscriptCache.size + 1;
}

export async function shouldMaskIdentity(
  viewerRole: ViewerRole,
  messageAuthorRole: ViewerRole,
  messageAuthorId: string,
  viewerId: string | undefined,
  config: WorkflowConfig,
  phase: WorkflowPhase | string,
  manuscriptId: string
): Promise<{ shouldMask: boolean; maskedName?: string }> {
  if (viewerRole === 'admin' || viewerRole === 'editor') {
    return { shouldMask: false };
  }

  if (viewerId && messageAuthorId === viewerId) {
    return { shouldMask: false };
  }

  if (viewerRole === 'author' && messageAuthorRole === 'reviewer') {
    const shouldReveal = config.author.seesReviewerIdentity === 'always' ||
      (config.author.seesReviewerIdentity === 'on_release' &&
       (phase === WorkflowPhase.RELEASED || phase === WorkflowPhase.AUTHOR_RESPONDING));

    if (!shouldReveal) {
      const index = await getReviewerIndex(messageAuthorId, manuscriptId);
      return { shouldMask: true, maskedName: `Reviewer ${String.fromCharCode(64 + index)}` };
    }
  }

  if (viewerRole === 'reviewer' && messageAuthorRole === 'author') {
    if (config.reviewers.seeAuthorIdentity === 'never') {
      return { shouldMask: true, maskedName: 'Author' };
    }
  }

  if (viewerRole === 'reviewer' && messageAuthorRole === 'reviewer') {
    const canSeeOthers = await canReviewerSeeOtherReviews(config, phase, manuscriptId);
    if (!canSeeOthers) {
      const index = await getReviewerIndex(messageAuthorId, manuscriptId);
      return { shouldMask: true, maskedName: `Reviewer ${String.fromCharCode(64 + index)}` };
    }
  }

  return { shouldMask: false };
}

export async function maskMessageAuthor(
  author: MessageAuthor,
  viewerId: string | undefined,
  viewerGlobalRole: string | undefined,
  manuscriptId: string,
  config: WorkflowConfig | null | undefined,
  phase: WorkflowPhase | string
): Promise<MaskedAuthor> {
  if (!config) {
    return {
      ...author,
      name: author.name || author.username,
      isMasked: false
    };
  }

  const viewerRole = await getViewerRole(viewerId, viewerGlobalRole, manuscriptId);
  const authorRole = await getMessageAuthorRole(author.id, manuscriptId);

  const { shouldMask, maskedName } = await shouldMaskIdentity(
    viewerRole,
    authorRole,
    author.id,
    viewerId,
    config,
    phase,
    manuscriptId
  );

  if (shouldMask && maskedName) {
    return {
      id: `masked-${author.id.substring(0, 8)}`,
      username: maskedName.toLowerCase().replace(/\s+/g, '-'),
      name: maskedName,
      isMasked: true,
      originalId: author.id
    };
  }

  return {
    ...author,
    name: author.name || author.username,
    isMasked: false
  };
}

export function clearReviewerIndexCache(manuscriptId?: string): void {
  if (manuscriptId) {
    reviewerIndexCache.delete(manuscriptId);
  } else {
    reviewerIndexCache.clear();
  }
}

export interface EffectiveVisibility {
  level: 'everyone' | 'participants' | 'reviewers_editors' | 'editors_only' | 'admins_only';
  label: string;
  description: string;
  phaseRestricted?: boolean;
  releasedToAuthors?: boolean;
  /** When phaseRestricted, describes what will change */
  pendingChange?: {
    willBeVisibleTo: string;
    when: string;
  };
}

/**
 * Compute who can currently see a message based on privacy level and workflow config.
 * This provides a unified view of visibility that accounts for both systems.
 */
export async function computeEffectiveVisibility(
  messagePrivacy: string,
  messageAuthorId: string,
  manuscriptId: string,
  config: WorkflowConfig | null | undefined,
  phase: WorkflowPhase | string
): Promise<EffectiveVisibility> {
  // No workflow config - use simple privacy-based visibility
  if (!config) {
    return getPrivacyBasedVisibility(messagePrivacy);
  }

  const authorRole = await getMessageAuthorRole(messageAuthorId, manuscriptId);
  const isReleased = phase === WorkflowPhase.RELEASED || phase === WorkflowPhase.AUTHOR_RESPONDING;

  // ADMIN_ONLY and EDITOR_ONLY are never affected by workflow
  if (messagePrivacy === 'ADMIN_ONLY') {
    return {
      level: 'admins_only',
      label: 'Admins Only',
      description: 'Only visible to administrators'
    };
  }

  if (messagePrivacy === 'EDITOR_ONLY') {
    return {
      level: 'editors_only',
      label: 'Editors Only',
      description: 'Only visible to editors and administrators'
    };
  }

  // REVIEWER_ONLY - check if reviewers can see each other
  if (messagePrivacy === 'REVIEWER_ONLY') {
    if (authorRole === 'reviewer') {
      const canReviewersSeeEachOther = await canReviewerSeeOtherReviews(config, phase, manuscriptId);
      if (!canReviewersSeeEachOther && config.reviewers.seeEachOther === 'after_all_submit') {
        return {
          level: 'editors_only',
          label: 'Editors Only',
          description: 'Currently visible only to editors',
          phaseRestricted: true,
          pendingChange: {
            willBeVisibleTo: 'other reviewers',
            when: 'all reviews are submitted'
          }
        };
      }
    }
    return {
      level: 'reviewers_editors',
      label: 'Reviewers & Editors',
      description: 'Hidden from authors and public'
    };
  }

  // AUTHOR_VISIBLE - most complex case with workflow interactions
  if (messagePrivacy === 'AUTHOR_VISIBLE') {
    // Message from a reviewer - apply workflow visibility rules
    if (authorRole === 'reviewer') {
      const canAuthorsSee = await canAuthorSeeReview(config, phase, messagePrivacy);

      if (!canAuthorsSee) {
        if (config.author.seesReviews === 'on_release') {
          return {
            level: 'reviewers_editors',
            label: 'Reviewers & Editors',
            description: 'Currently hidden from authors',
            phaseRestricted: true,
            pendingChange: {
              willBeVisibleTo: 'authors',
              when: 'reviews are released by an editor'
            }
          };
        } else if (config.author.seesReviews === 'never') {
          return {
            level: 'reviewers_editors',
            label: 'Reviewers & Editors',
            description: 'Authors cannot see reviewer messages in this workflow'
          };
        }
      }

      // Authors can see, but check reviewer-to-reviewer visibility
      const canReviewersSeeEachOther = await canReviewerSeeOtherReviews(config, phase, manuscriptId);
      if (!canReviewersSeeEachOther) {
        // Check if this is a permanent restriction or phase-based
        if (config.reviewers.seeEachOther === 'never') {
          return {
            level: 'participants',
            label: 'Authors & Editors',
            description: 'Reviewers cannot see each other\'s reviews in this workflow',
            releasedToAuthors: isReleased
          };
        }
        return {
          level: 'participants',
          label: 'Authors & Editors',
          description: 'Currently hidden from other reviewers',
          phaseRestricted: true,
          releasedToAuthors: isReleased,
          pendingChange: {
            willBeVisibleTo: 'other reviewers',
            when: 'all reviews are submitted'
          }
        };
      }
    }

    // Message from an author - check if reviewers can see author responses
    if (authorRole === 'author') {
      if (config.reviewers.seeAuthorResponses === 'on_release' && !isReleased) {
        return {
          level: 'editors_only',
          label: 'Editors Only',
          description: 'Currently hidden from reviewers',
          phaseRestricted: true,
          pendingChange: {
            willBeVisibleTo: 'reviewers',
            when: 'reviews are released'
          }
        };
      }
    }

    return {
      level: 'participants',
      label: 'All Participants',
      description: 'Visible to authors, reviewers, and editors',
      releasedToAuthors: isReleased || config.author.seesReviews === 'realtime'
    };
  }

  // PUBLIC
  if (messagePrivacy === 'PUBLIC') {
    return {
      level: 'everyone',
      label: 'Public',
      description: 'Visible to everyone'
    };
  }

  // Fallback
  return getPrivacyBasedVisibility(messagePrivacy);
}

function getPrivacyBasedVisibility(privacy: string): EffectiveVisibility {
  switch (privacy) {
    case 'PUBLIC':
      return {
        level: 'everyone',
        label: 'Public',
        description: 'Visible to everyone'
      };
    case 'AUTHOR_VISIBLE':
      return {
        level: 'participants',
        label: 'All Participants',
        description: 'Visible to authors, reviewers, and editors'
      };
    case 'REVIEWER_ONLY':
      return {
        level: 'reviewers_editors',
        label: 'Reviewers & Editors',
        description: 'Hidden from authors and public'
      };
    case 'EDITOR_ONLY':
      return {
        level: 'editors_only',
        label: 'Editors Only',
        description: 'Only visible to editors and administrators'
      };
    case 'ADMIN_ONLY':
      return {
        level: 'admins_only',
        label: 'Admins Only',
        description: 'Only visible to administrators'
      };
    default:
      return {
        level: 'everyone',
        label: 'Unknown',
        description: 'Visibility level unknown'
      };
  }
}
