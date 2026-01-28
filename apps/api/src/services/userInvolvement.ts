import { prisma } from '@colloquium/database';
import { GlobalRole } from '@colloquium/auth';

/**
 * Checks if a user has access to the submissions list based on their involvement
 * with manuscripts (as author, reviewer, or action editor).
 *
 * @param userId - The user's ID (undefined for non-authenticated users)
 * @param userRole - The user's global role
 * @returns true if user should see submissions, false otherwise
 */
export async function userHasSubmissionsAccess(
  userId: string | undefined,
  userRole: GlobalRole | undefined
): Promise<boolean> {
  // Non-authenticated users have no access when setting is false
  if (!userId) {
    return false;
  }

  // ADMIN and EDITOR_IN_CHIEF always have access
  if (userRole === 'ADMIN' || userRole === 'EDITOR_IN_CHIEF') {
    return true;
  }

  // Check involvement in parallel
  const [authorCount, reviewerCount, editorCount] = await Promise.all([
    // Check if user is an author of any manuscript
    prisma.manuscript_authors.count({
      where: { userId }
    }),
    // Check if user is an accepted/in-progress/completed reviewer
    prisma.review_assignments.count({
      where: {
        reviewerId: userId,
        status: { in: ['ACCEPTED', 'IN_PROGRESS', 'COMPLETED'] }
      }
    }),
    // Check if user is an action editor
    prisma.action_editors.count({
      where: { editorId: userId }
    })
  ]);

  return authorCount > 0 || reviewerCount > 0 || editorCount > 0;
}

/**
 * Gets the list of manuscript IDs where a user is involved
 * (as author, reviewer with ACCEPTED/IN_PROGRESS/COMPLETED status, or action editor).
 *
 * @param userId - The user's ID
 * @returns Array of manuscript IDs where user is involved
 */
export async function getUserInvolvedManuscriptIds(userId: string): Promise<string[]> {
  // Query all involvement types in parallel
  const [authorManuscripts, reviewerManuscripts, editorManuscripts] = await Promise.all([
    // Manuscripts where user is an author
    prisma.manuscript_authors.findMany({
      where: { userId },
      select: { manuscriptId: true }
    }),
    // Manuscripts where user is an accepted/in-progress/completed reviewer
    prisma.review_assignments.findMany({
      where: {
        reviewerId: userId,
        status: { in: ['ACCEPTED', 'IN_PROGRESS', 'COMPLETED'] }
      },
      select: { manuscriptId: true }
    }),
    // Manuscripts where user is an action editor
    prisma.action_editors.findMany({
      where: { editorId: userId },
      select: { manuscriptId: true }
    })
  ]);

  // Combine and deduplicate manuscript IDs
  const manuscriptIds = new Set<string>();

  for (const author of authorManuscripts) {
    manuscriptIds.add(author.manuscriptId);
  }
  for (const reviewer of reviewerManuscripts) {
    manuscriptIds.add(reviewer.manuscriptId);
  }
  for (const editor of editorManuscripts) {
    manuscriptIds.add(editor.manuscriptId);
  }

  return Array.from(manuscriptIds);
}
