// Mock @colloquium/types before importing the service
jest.mock('@colloquium/types', () => ({
  WorkflowPhase: {
    REVIEW: 'REVIEW',
    DELIBERATION: 'DELIBERATION',
    RELEASED: 'RELEASED',
    AUTHOR_RESPONDING: 'AUTHOR_RESPONDING'
  }
}));

import {
  computeEffectiveVisibility,
  canAuthorSeeReview,
  canReviewerSeeOtherReviews,
  getViewerRole,
  getMessageAuthorRole,
  shouldMaskIdentity,
  EffectiveVisibility
} from '../../src/services/workflowVisibility';

// Use string literals for WorkflowPhase in tests
const WorkflowPhase = {
  REVIEW: 'REVIEW',
  DELIBERATION: 'DELIBERATION',
  RELEASED: 'RELEASED',
  AUTHOR_RESPONDING: 'AUTHOR_RESPONDING'
} as const;

interface WorkflowConfig {
  author: {
    seesReviews: 'realtime' | 'on_release' | 'never';
    seesReviewerIdentity: 'always' | 'never' | 'on_release';
    canParticipate: 'anytime' | 'on_release' | 'invited';
  };
  reviewers: {
    seeEachOther: 'realtime' | 'after_all_submit' | 'never';
    seeAuthorIdentity: 'always' | 'never';
    seeAuthorResponses: 'realtime' | 'on_release';
  };
  phases: {
    enabled: boolean;
    authorResponseStartsNewCycle: boolean;
    requireAllReviewsBeforeRelease: boolean;
  };
}

// Mock the database module
jest.mock('@colloquium/database', () => ({
  prisma: {
    manuscript_authors: {
      findFirst: jest.fn()
    },
    review_assignments: {
      findFirst: jest.fn(),
      findMany: jest.fn()
    },
    users: {
      findUnique: jest.fn()
    }
  }
}));

const { prisma } = require('@colloquium/database');

describe('workflowVisibility', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Standard workflow configs for testing
  const traditionalBlindConfig: WorkflowConfig = {
    author: { seesReviews: 'on_release', seesReviewerIdentity: 'never', canParticipate: 'on_release' },
    reviewers: { seeEachOther: 'never', seeAuthorIdentity: 'never', seeAuthorResponses: 'on_release' },
    phases: { enabled: true, authorResponseStartsNewCycle: true, requireAllReviewsBeforeRelease: true }
  };

  const openContinuousConfig: WorkflowConfig = {
    author: { seesReviews: 'realtime', seesReviewerIdentity: 'always', canParticipate: 'anytime' },
    reviewers: { seeEachOther: 'realtime', seeAuthorIdentity: 'always', seeAuthorResponses: 'realtime' },
    phases: { enabled: false, authorResponseStartsNewCycle: false, requireAllReviewsBeforeRelease: false }
  };

  const progressiveDisclosureConfig: WorkflowConfig = {
    author: { seesReviews: 'on_release', seesReviewerIdentity: 'on_release', canParticipate: 'on_release' },
    reviewers: { seeEachOther: 'after_all_submit', seeAuthorIdentity: 'never', seeAuthorResponses: 'on_release' },
    phases: { enabled: true, authorResponseStartsNewCycle: true, requireAllReviewsBeforeRelease: true }
  };

  describe('canAuthorSeeReview', () => {
    it('should return true for realtime visibility', async () => {
      const result = await canAuthorSeeReview(openContinuousConfig, WorkflowPhase.REVIEW, 'AUTHOR_VISIBLE');
      expect(result).toBe(true);
    });

    it('should return false during REVIEW phase with on_release config', async () => {
      const result = await canAuthorSeeReview(traditionalBlindConfig, WorkflowPhase.REVIEW, 'AUTHOR_VISIBLE');
      expect(result).toBe(false);
    });

    it('should return true during RELEASED phase with on_release config', async () => {
      const result = await canAuthorSeeReview(traditionalBlindConfig, WorkflowPhase.RELEASED, 'AUTHOR_VISIBLE');
      expect(result).toBe(true);
    });

    it('should return true during AUTHOR_RESPONDING phase with on_release config', async () => {
      const result = await canAuthorSeeReview(traditionalBlindConfig, WorkflowPhase.AUTHOR_RESPONDING, 'AUTHOR_VISIBLE');
      expect(result).toBe(true);
    });

    it('should return false for REVIEWER_ONLY messages regardless of config', async () => {
      const result = await canAuthorSeeReview(openContinuousConfig, WorkflowPhase.REVIEW, 'REVIEWER_ONLY');
      expect(result).toBe(false);
    });

    it('should return false when seesReviews is never', async () => {
      const neverConfig: WorkflowConfig = {
        ...traditionalBlindConfig,
        author: { ...traditionalBlindConfig.author, seesReviews: 'never' }
      };
      const result = await canAuthorSeeReview(neverConfig, WorkflowPhase.RELEASED, 'AUTHOR_VISIBLE');
      expect(result).toBe(false);
    });
  });

  describe('canReviewerSeeOtherReviews', () => {
    const manuscriptId = 'manuscript-123';

    it('should return true for realtime visibility', async () => {
      const result = await canReviewerSeeOtherReviews(openContinuousConfig, WorkflowPhase.REVIEW, manuscriptId);
      expect(result).toBe(true);
    });

    it('should return false during REVIEW phase with after_all_submit config when not all complete', async () => {
      prisma.review_assignments.findMany.mockResolvedValue([
        { status: 'IN_PROGRESS' },
        { status: 'COMPLETED' }
      ]);

      const result = await canReviewerSeeOtherReviews(progressiveDisclosureConfig, WorkflowPhase.REVIEW, manuscriptId);
      expect(result).toBe(false);
    });

    it('should return true during REVIEW phase with after_all_submit config when all complete', async () => {
      prisma.review_assignments.findMany.mockResolvedValue([
        { status: 'COMPLETED' },
        { status: 'COMPLETED' }
      ]);

      const result = await canReviewerSeeOtherReviews(progressiveDisclosureConfig, WorkflowPhase.REVIEW, manuscriptId);
      expect(result).toBe(true);
    });

    it('should return true during DELIBERATION phase with after_all_submit config', async () => {
      const result = await canReviewerSeeOtherReviews(progressiveDisclosureConfig, WorkflowPhase.DELIBERATION, manuscriptId);
      expect(result).toBe(true);
    });

    it('should return false when seeEachOther is never', async () => {
      const result = await canReviewerSeeOtherReviews(traditionalBlindConfig, WorkflowPhase.RELEASED, manuscriptId);
      expect(result).toBe(false);
    });
  });

  describe('getViewerRole', () => {
    const manuscriptId = 'manuscript-123';

    it('should return public for undefined userId', async () => {
      const result = await getViewerRole(undefined, undefined, manuscriptId);
      expect(result).toBe('public');
    });

    it('should return admin for ADMIN role', async () => {
      const result = await getViewerRole('user-123', 'ADMIN', manuscriptId);
      expect(result).toBe('admin');
    });

    it('should return editor for EDITOR_IN_CHIEF role', async () => {
      const result = await getViewerRole('user-123', 'EDITOR_IN_CHIEF', manuscriptId);
      expect(result).toBe('editor');
    });

    it('should return author for manuscript author', async () => {
      prisma.manuscript_authors.findFirst.mockResolvedValue({ id: 'author-relation-123' });
      prisma.review_assignments.findFirst.mockResolvedValue(null);

      const result = await getViewerRole('user-123', 'USER', manuscriptId);
      expect(result).toBe('author');
    });

    it('should return reviewer for assigned reviewer', async () => {
      prisma.manuscript_authors.findFirst.mockResolvedValue(null);
      prisma.review_assignments.findFirst.mockResolvedValue({ id: 'assignment-123' });

      const result = await getViewerRole('user-123', 'USER', manuscriptId);
      expect(result).toBe('reviewer');
    });

    it('should return public for unrelated user', async () => {
      prisma.manuscript_authors.findFirst.mockResolvedValue(null);
      prisma.review_assignments.findFirst.mockResolvedValue(null);

      const result = await getViewerRole('user-123', 'USER', manuscriptId);
      expect(result).toBe('public');
    });
  });

  describe('computeEffectiveVisibility', () => {
    const manuscriptId = 'manuscript-123';
    const reviewerUserId = 'reviewer-123';
    const authorUserId = 'author-123';
    const editorUserId = 'editor-123';

    beforeEach(() => {
      // Default: message author is a reviewer
      prisma.users.findUnique.mockResolvedValue({ role: 'USER' });
      prisma.manuscript_authors.findFirst.mockResolvedValue(null);
      prisma.review_assignments.findFirst.mockResolvedValue({ id: 'assignment-123' });
      prisma.review_assignments.findMany.mockResolvedValue([
        { status: 'IN_PROGRESS' },
        { status: 'IN_PROGRESS' }
      ]);
    });

    describe('without workflow config', () => {
      it('should return privacy-based visibility for PUBLIC', async () => {
        const result = await computeEffectiveVisibility('PUBLIC', reviewerUserId, manuscriptId, null, WorkflowPhase.REVIEW);
        expect(result.level).toBe('everyone');
        expect(result.label).toBe('Public');
      });

      it('should return privacy-based visibility for AUTHOR_VISIBLE', async () => {
        const result = await computeEffectiveVisibility('AUTHOR_VISIBLE', reviewerUserId, manuscriptId, null, WorkflowPhase.REVIEW);
        expect(result.level).toBe('participants');
        expect(result.label).toBe('All Participants');
      });

      it('should return privacy-based visibility for REVIEWER_ONLY', async () => {
        const result = await computeEffectiveVisibility('REVIEWER_ONLY', reviewerUserId, manuscriptId, null, WorkflowPhase.REVIEW);
        expect(result.level).toBe('reviewers_editors');
        expect(result.label).toBe('Reviewers & Editors');
      });

      it('should return privacy-based visibility for EDITOR_ONLY', async () => {
        const result = await computeEffectiveVisibility('EDITOR_ONLY', reviewerUserId, manuscriptId, null, WorkflowPhase.REVIEW);
        expect(result.level).toBe('editors_only');
        expect(result.label).toBe('Editors Only');
      });

      it('should return privacy-based visibility for ADMIN_ONLY', async () => {
        const result = await computeEffectiveVisibility('ADMIN_ONLY', reviewerUserId, manuscriptId, null, WorkflowPhase.REVIEW);
        expect(result.level).toBe('admins_only');
        expect(result.label).toBe('Admins Only');
      });
    });

    describe('with traditional blind workflow', () => {
      it('should show phase-restricted for reviewer message during REVIEW phase', async () => {
        const result = await computeEffectiveVisibility(
          'AUTHOR_VISIBLE',
          reviewerUserId,
          manuscriptId,
          traditionalBlindConfig,
          WorkflowPhase.REVIEW
        );

        expect(result.level).toBe('reviewers_editors');
        expect(result.label).toBe('Reviewers & Editors');
        expect(result.phaseRestricted).toBe(true);
        expect(result.pendingChange).toBeDefined();
        expect(result.pendingChange?.willBeVisibleTo).toBe('authors');
        expect(result.pendingChange?.when).toContain('released');
      });

      it('should show authors & editors after RELEASED (reviewers never see each other in this workflow)', async () => {
        // In traditional blind, seeEachOther: 'never' means reviewers can NEVER see each other
        const result = await computeEffectiveVisibility(
          'AUTHOR_VISIBLE',
          reviewerUserId,
          manuscriptId,
          traditionalBlindConfig,
          WorkflowPhase.RELEASED
        );

        // Authors can now see, but reviewers permanently can't see each other
        expect(result.level).toBe('participants');
        expect(result.label).toBe('Authors & Editors');
        expect(result.phaseRestricted).toBeUndefined(); // No phase restriction - this is permanent
        expect(result.pendingChange).toBeUndefined(); // No pending change - this is permanent
        expect(result.description).toContain('cannot see');
      });

      it('should show reviewers_editors for REVIEWER_ONLY message', async () => {
        const result = await computeEffectiveVisibility(
          'REVIEWER_ONLY',
          reviewerUserId,
          manuscriptId,
          traditionalBlindConfig,
          WorkflowPhase.REVIEW
        );

        expect(result.level).toBe('reviewers_editors');
        expect(result.phaseRestricted).toBeUndefined();
      });
    });

    describe('with open continuous workflow', () => {
      it('should show full participant visibility for reviewer message', async () => {
        const result = await computeEffectiveVisibility(
          'AUTHOR_VISIBLE',
          reviewerUserId,
          manuscriptId,
          openContinuousConfig,
          WorkflowPhase.REVIEW
        );

        expect(result.level).toBe('participants');
        expect(result.label).toBe('All Participants');
        expect(result.phaseRestricted).toBeUndefined();
      });
    });

    describe('with progressive disclosure workflow', () => {
      it('should show phase-restricted for reviewer message when not all reviews complete', async () => {
        prisma.review_assignments.findMany.mockResolvedValue([
          { status: 'IN_PROGRESS' },
          { status: 'COMPLETED' }
        ]);

        const result = await computeEffectiveVisibility(
          'AUTHOR_VISIBLE',
          reviewerUserId,
          manuscriptId,
          progressiveDisclosureConfig,
          WorkflowPhase.REVIEW
        );

        expect(result.level).toBe('reviewers_editors');
        expect(result.phaseRestricted).toBe(true);
        expect(result.pendingChange?.willBeVisibleTo).toBe('authors');
      });

      it('should show all participants after RELEASED (phase grants visibility)', async () => {
        // Even with incomplete reviews, RELEASED phase grants reviewer-to-reviewer visibility
        prisma.review_assignments.findMany.mockResolvedValue([
          { status: 'IN_PROGRESS' },
          { status: 'COMPLETED' }
        ]);

        const result = await computeEffectiveVisibility(
          'AUTHOR_VISIBLE',
          reviewerUserId,
          manuscriptId,
          progressiveDisclosureConfig,
          WorkflowPhase.RELEASED
        );

        // RELEASED phase grants full visibility to reviewers
        expect(result.level).toBe('participants');
        expect(result.label).toBe('All Participants');
        expect(result.phaseRestricted).toBeUndefined();
      });

      it('should show authors & editors during REVIEW when not all reviews complete', async () => {
        // During REVIEW phase with incomplete reviews, reviewers can't see each other
        // but seesReviews is 'on_release' so authors can't see either
        prisma.review_assignments.findMany.mockResolvedValue([
          { status: 'IN_PROGRESS' },
          { status: 'COMPLETED' }
        ]);

        const result = await computeEffectiveVisibility(
          'AUTHOR_VISIBLE',
          reviewerUserId,
          manuscriptId,
          progressiveDisclosureConfig,
          WorkflowPhase.REVIEW
        );

        // Authors can't see (on_release), so it's reviewers & editors
        expect(result.level).toBe('reviewers_editors');
        expect(result.phaseRestricted).toBe(true);
        expect(result.pendingChange?.willBeVisibleTo).toBe('authors');
      });
    });

    describe('author messages', () => {
      beforeEach(() => {
        // Set up author as the message author
        prisma.manuscript_authors.findFirst.mockResolvedValue({ id: 'author-relation-123' });
        prisma.review_assignments.findFirst.mockResolvedValue(null);
      });

      it('should show editors only when reviewers cannot see author responses before release', async () => {
        const configWithGatedResponses: WorkflowConfig = {
          ...traditionalBlindConfig,
          reviewers: { ...traditionalBlindConfig.reviewers, seeAuthorResponses: 'on_release' }
        };

        const result = await computeEffectiveVisibility(
          'AUTHOR_VISIBLE',
          authorUserId,
          manuscriptId,
          configWithGatedResponses,
          WorkflowPhase.REVIEW
        );

        expect(result.level).toBe('editors_only');
        expect(result.phaseRestricted).toBe(true);
        expect(result.pendingChange?.willBeVisibleTo).toBe('reviewers');
      });

      it('should show full visibility when reviewers can see responses in realtime', async () => {
        const result = await computeEffectiveVisibility(
          'AUTHOR_VISIBLE',
          authorUserId,
          manuscriptId,
          openContinuousConfig,
          WorkflowPhase.REVIEW
        );

        expect(result.level).toBe('participants');
        expect(result.phaseRestricted).toBeUndefined();
      });
    });

    describe('editor and admin messages', () => {
      beforeEach(() => {
        prisma.users.findUnique.mockResolvedValue({ role: 'EDITOR_IN_CHIEF' });
        prisma.manuscript_authors.findFirst.mockResolvedValue(null);
        prisma.review_assignments.findFirst.mockResolvedValue(null);
      });

      it('should respect EDITOR_ONLY privacy regardless of workflow', async () => {
        const result = await computeEffectiveVisibility(
          'EDITOR_ONLY',
          editorUserId,
          manuscriptId,
          traditionalBlindConfig,
          WorkflowPhase.REVIEW
        );

        expect(result.level).toBe('editors_only');
        expect(result.phaseRestricted).toBeUndefined();
      });

      it('should respect ADMIN_ONLY privacy regardless of workflow', async () => {
        const result = await computeEffectiveVisibility(
          'ADMIN_ONLY',
          editorUserId,
          manuscriptId,
          traditionalBlindConfig,
          WorkflowPhase.REVIEW
        );

        expect(result.level).toBe('admins_only');
        expect(result.phaseRestricted).toBeUndefined();
      });
    });

    describe('seesReviews: never configuration', () => {
      it('should show permanent restriction without pending change', async () => {
        const neverConfig: WorkflowConfig = {
          ...traditionalBlindConfig,
          author: { ...traditionalBlindConfig.author, seesReviews: 'never' }
        };

        const result = await computeEffectiveVisibility(
          'AUTHOR_VISIBLE',
          reviewerUserId,
          manuscriptId,
          neverConfig,
          WorkflowPhase.REVIEW
        );

        expect(result.level).toBe('reviewers_editors');
        expect(result.phaseRestricted).toBeUndefined();
        expect(result.pendingChange).toBeUndefined();
        expect(result.description).toContain('cannot see');
      });
    });
  });

  describe('shouldMaskIdentity', () => {
    const manuscriptId = 'manuscript-123';
    const reviewerUserId = 'reviewer-123';
    const authorUserId = 'author-123';

    beforeEach(() => {
      prisma.review_assignments.findMany.mockResolvedValue([
        { reviewerId: reviewerUserId }
      ]);
    });

    it('should not mask for admin viewers', async () => {
      const result = await shouldMaskIdentity(
        'admin',
        'reviewer',
        reviewerUserId,
        'admin-123',
        traditionalBlindConfig,
        WorkflowPhase.REVIEW,
        manuscriptId
      );

      expect(result.shouldMask).toBe(false);
    });

    it('should not mask for editor viewers', async () => {
      const result = await shouldMaskIdentity(
        'editor',
        'reviewer',
        reviewerUserId,
        'editor-123',
        traditionalBlindConfig,
        WorkflowPhase.REVIEW,
        manuscriptId
      );

      expect(result.shouldMask).toBe(false);
    });

    it('should not mask own identity', async () => {
      const result = await shouldMaskIdentity(
        'reviewer',
        'reviewer',
        reviewerUserId,
        reviewerUserId,
        traditionalBlindConfig,
        WorkflowPhase.REVIEW,
        manuscriptId
      );

      expect(result.shouldMask).toBe(false);
    });

    it('should mask reviewer identity from author when seesReviewerIdentity is never', async () => {
      const result = await shouldMaskIdentity(
        'author',
        'reviewer',
        reviewerUserId,
        authorUserId,
        traditionalBlindConfig,
        WorkflowPhase.RELEASED,
        manuscriptId
      );

      expect(result.shouldMask).toBe(true);
      expect(result.maskedName).toMatch(/Reviewer [A-Z]/);
    });

    it('should not mask reviewer identity from author when seesReviewerIdentity is always', async () => {
      const result = await shouldMaskIdentity(
        'author',
        'reviewer',
        reviewerUserId,
        authorUserId,
        openContinuousConfig,
        WorkflowPhase.REVIEW,
        manuscriptId
      );

      expect(result.shouldMask).toBe(false);
    });

    it('should mask author identity from reviewer when seeAuthorIdentity is never', async () => {
      const result = await shouldMaskIdentity(
        'reviewer',
        'author',
        authorUserId,
        reviewerUserId,
        traditionalBlindConfig,
        WorkflowPhase.REVIEW,
        manuscriptId
      );

      expect(result.shouldMask).toBe(true);
      expect(result.maskedName).toBe('Author');
    });

    it('should reveal reviewer identity to author on release when seesReviewerIdentity is on_release', async () => {
      const onReleaseConfig: WorkflowConfig = {
        ...traditionalBlindConfig,
        author: { ...traditionalBlindConfig.author, seesReviewerIdentity: 'on_release' }
      };

      const resultBeforeRelease = await shouldMaskIdentity(
        'author',
        'reviewer',
        reviewerUserId,
        authorUserId,
        onReleaseConfig,
        WorkflowPhase.REVIEW,
        manuscriptId
      );
      expect(resultBeforeRelease.shouldMask).toBe(true);

      const resultAfterRelease = await shouldMaskIdentity(
        'author',
        'reviewer',
        reviewerUserId,
        authorUserId,
        onReleaseConfig,
        WorkflowPhase.RELEASED,
        manuscriptId
      );
      expect(resultAfterRelease.shouldMask).toBe(false);
    });
  });
});
