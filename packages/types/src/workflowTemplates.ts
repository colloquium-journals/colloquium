import { WorkflowConfig } from './index';

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  config: WorkflowConfig;
}

export const workflowTemplates: WorkflowTemplate[] = [
  {
    id: 'traditional-blind',
    name: 'Traditional Double-Blind',
    description: 'Classic double-blind review where authors and reviewers cannot see each other\'s identities. Reviews are released to authors only after editorial decision.',
    config: {
      author: {
        seesReviews: 'on_release',
        seesReviewerIdentity: 'never',
        canParticipate: 'on_release',
      },
      reviewers: {
        seeEachOther: 'never',
        seeAuthorIdentity: 'never',
        seeAuthorResponses: 'on_release',
      },
      phases: {
        enabled: true,
        authorResponseStartsNewCycle: true,
        requireAllReviewsBeforeRelease: true,
      },
    },
  },
  {
    id: 'single-blind',
    name: 'Single-Blind Review',
    description: 'Reviewers know author identities, but authors do not know reviewer identities. Reviews are released after editorial decision.',
    config: {
      author: {
        seesReviews: 'on_release',
        seesReviewerIdentity: 'never',
        canParticipate: 'on_release',
      },
      reviewers: {
        seeEachOther: 'never',
        seeAuthorIdentity: 'always',
        seeAuthorResponses: 'on_release',
      },
      phases: {
        enabled: true,
        authorResponseStartsNewCycle: true,
        requireAllReviewsBeforeRelease: true,
      },
    },
  },
  {
    id: 'open-continuous',
    name: 'Open Continuous Review',
    description: 'Fully open review where all identities are visible and authors can see and respond to reviews in real-time.',
    config: {
      author: {
        seesReviews: 'realtime',
        seesReviewerIdentity: 'always',
        canParticipate: 'anytime',
      },
      reviewers: {
        seeEachOther: 'realtime',
        seeAuthorIdentity: 'always',
        seeAuthorResponses: 'realtime',
      },
      phases: {
        enabled: false,
        authorResponseStartsNewCycle: false,
        requireAllReviewsBeforeRelease: false,
      },
    },
  },
  {
    id: 'progressive-disclosure',
    name: 'Progressive Disclosure',
    description: 'Reviewers work independently during review phase. After all reviews submitted, identities and reviews become visible to all reviewers and editors for deliberation. Authors see everything upon release.',
    config: {
      author: {
        seesReviews: 'on_release',
        seesReviewerIdentity: 'on_release',
        canParticipate: 'on_release',
      },
      reviewers: {
        seeEachOther: 'after_all_submit',
        seeAuthorIdentity: 'never',
        seeAuthorResponses: 'on_release',
      },
      phases: {
        enabled: true,
        authorResponseStartsNewCycle: true,
        requireAllReviewsBeforeRelease: true,
      },
    },
  },
  {
    id: 'open-gated',
    name: 'Open with Gated Participation',
    description: 'Authors can see reviews in real-time but can only respond when explicitly invited by editors. Useful for structured feedback rounds.',
    config: {
      author: {
        seesReviews: 'realtime',
        seesReviewerIdentity: 'always',
        canParticipate: 'invited',
      },
      reviewers: {
        seeEachOther: 'realtime',
        seeAuthorIdentity: 'always',
        seeAuthorResponses: 'realtime',
      },
      phases: {
        enabled: true,
        authorResponseStartsNewCycle: false,
        requireAllReviewsBeforeRelease: false,
      },
    },
  },
];

export function getWorkflowTemplate(templateId: string): WorkflowTemplate | undefined {
  return workflowTemplates.find(t => t.id === templateId);
}

export function getWorkflowTemplateConfig(templateId: string): WorkflowConfig | undefined {
  return getWorkflowTemplate(templateId)?.config;
}
