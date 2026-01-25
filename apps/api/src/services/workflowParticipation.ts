import { prisma } from '@colloquium/database';
import { WorkflowConfig, WorkflowPhase } from '@colloquium/types';
import { getViewerRole, ViewerRole } from './workflowVisibility';

export interface ParticipationResult {
  allowed: boolean;
  reason?: string;
}

interface ManuscriptContext {
  id: string;
  workflowPhase: string;
  workflowRound: number;
  status: string;
}

export async function canUserParticipate(
  userId: string | undefined,
  userGlobalRole: string | undefined,
  manuscriptId: string,
  config: WorkflowConfig | null | undefined,
  manuscript: ManuscriptContext
): Promise<ParticipationResult> {
  if (!userId) {
    return { allowed: false, reason: 'Authentication required to participate in discussions' };
  }

  if (!config) {
    return { allowed: true };
  }

  const viewerRole = await getViewerRole(userId, userGlobalRole, manuscriptId);
  const phase = manuscript.workflowPhase as WorkflowPhase;

  if (viewerRole === 'admin' || viewerRole === 'editor') {
    return { allowed: true };
  }

  if (viewerRole === 'reviewer') {
    if (phase === WorkflowPhase.REVIEW || phase === WorkflowPhase.DELIBERATION) {
      return { allowed: true };
    }
    return { allowed: true };
  }

  if (viewerRole === 'author') {
    return canAuthorParticipate(config, phase, manuscriptId, userId);
  }

  return { allowed: false, reason: 'You do not have permission to participate in this discussion' };
}

async function canAuthorParticipate(
  config: WorkflowConfig,
  phase: WorkflowPhase,
  manuscriptId: string,
  userId: string
): Promise<ParticipationResult> {
  switch (config.author.canParticipate) {
    case 'anytime':
      return { allowed: true };

    case 'on_release':
      if (phase === WorkflowPhase.RELEASED || phase === WorkflowPhase.AUTHOR_RESPONDING) {
        return { allowed: true };
      }
      return {
        allowed: false,
        reason: 'Authors can only participate after reviews have been released. Please wait for the editorial decision.'
      };

    case 'invited':
      const hasInvitation = await checkAuthorInvitation(manuscriptId, userId);
      if (hasInvitation) {
        return { allowed: true };
      }
      return {
        allowed: false,
        reason: 'Authors can only participate when explicitly invited by the editor. Please wait for an invitation to respond.'
      };

    default:
      return { allowed: false, reason: 'Participation not allowed in current workflow state' };
  }
}

async function checkAuthorInvitation(manuscriptId: string, userId: string): Promise<boolean> {
  const invitation = await prisma.messages.findFirst({
    where: {
      conversations: {
        manuscriptId
      },
      metadata: {
        path: ['authorInvitation'],
        equals: true
      },
      createdAt: {
        gte: await getLastReleaseDate(manuscriptId)
      }
    },
    select: { id: true }
  });

  return !!invitation;
}

async function getLastReleaseDate(manuscriptId: string): Promise<Date> {
  const release = await prisma.workflow_releases.findFirst({
    where: { manuscriptId },
    orderBy: { releasedAt: 'desc' },
    select: { releasedAt: true }
  });

  return release?.releasedAt || new Date(0);
}

export async function getParticipationStatus(
  userId: string,
  userGlobalRole: string | undefined,
  manuscriptId: string,
  config: WorkflowConfig | null | undefined,
  manuscript: ManuscriptContext
): Promise<{
  canParticipate: boolean;
  reason?: string;
  viewerRole: ViewerRole;
  phase: string;
  round: number;
}> {
  const viewerRole = await getViewerRole(userId, userGlobalRole, manuscriptId);
  const { allowed, reason } = await canUserParticipate(
    userId,
    userGlobalRole,
    manuscriptId,
    config,
    manuscript
  );

  return {
    canParticipate: allowed,
    reason,
    viewerRole,
    phase: manuscript.workflowPhase,
    round: manuscript.workflowRound
  };
}

export async function handleAuthorResponse(
  manuscriptId: string,
  userId: string,
  config: WorkflowConfig | null | undefined
): Promise<{ phaseChanged: boolean; newPhase?: WorkflowPhase; newRound?: number }> {
  if (!config || !config.phases.enabled) {
    return { phaseChanged: false };
  }

  const manuscript = await prisma.manuscripts.findUnique({
    where: { id: manuscriptId },
    select: { workflowPhase: true, workflowRound: true }
  });

  if (!manuscript) {
    return { phaseChanged: false };
  }

  const viewerRole = await getViewerRole(userId, undefined, manuscriptId);
  if (viewerRole !== 'author') {
    return { phaseChanged: false };
  }

  if (manuscript.workflowPhase === WorkflowPhase.RELEASED && config.phases.authorResponseStartsNewCycle) {
    const newRound = manuscript.workflowRound + 1;

    await prisma.manuscripts.update({
      where: { id: manuscriptId },
      data: {
        workflowPhase: WorkflowPhase.AUTHOR_RESPONDING,
        updatedAt: new Date()
      }
    });

    return {
      phaseChanged: true,
      newPhase: WorkflowPhase.AUTHOR_RESPONDING,
      newRound
    };
  }

  return { phaseChanged: false };
}
