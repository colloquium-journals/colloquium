import {
  GlobalRole,
  GlobalPermission,
  ManuscriptPermission,
  GLOBAL_ROLE_PERMISSIONS,
  hasGlobalPermission,
  hasManuscriptPermission,
} from '../permissions';

describe('GlobalRole enum', () => {
  it('has all expected roles', () => {
    expect(GlobalRole.ADMIN).toBe('ADMIN');
    expect(GlobalRole.EDITOR_IN_CHIEF).toBe('EDITOR_IN_CHIEF');
    expect(GlobalRole.ACTION_EDITOR).toBe('ACTION_EDITOR');
    expect(GlobalRole.USER).toBe('USER');
    expect(GlobalRole.BOT).toBe('BOT');
  });
});

describe('GLOBAL_ROLE_PERMISSIONS', () => {
  it('gives ADMIN all permissions', () => {
    const adminPerms = GLOBAL_ROLE_PERMISSIONS[GlobalRole.ADMIN];
    for (const perm of Object.values(GlobalPermission)) {
      expect(adminPerms).toContain(perm);
    }
  });

  it('gives BOT no global permissions', () => {
    expect(GLOBAL_ROLE_PERMISSIONS[GlobalRole.BOT]).toEqual([]);
  });

  it('gives USER basic permissions only', () => {
    const userPerms = GLOBAL_ROLE_PERMISSIONS[GlobalRole.USER];
    expect(userPerms).toContain(GlobalPermission.SUBMIT_MANUSCRIPT);
    expect(userPerms).toContain(GlobalPermission.CREATE_CONVERSATION);
    expect(userPerms).not.toContain(GlobalPermission.MANAGE_USERS);
    expect(userPerms).not.toContain(GlobalPermission.MANAGE_BOTS);
  });

  it('gives EDITOR_IN_CHIEF editorial permissions but not admin-only ones', () => {
    const eicPerms = GLOBAL_ROLE_PERMISSIONS[GlobalRole.EDITOR_IN_CHIEF];
    expect(eicPerms).toContain(GlobalPermission.VIEW_ALL_MANUSCRIPTS);
    expect(eicPerms).toContain(GlobalPermission.ASSIGN_ACTION_EDITORS);
    expect(eicPerms).toContain(GlobalPermission.OVERRIDE_EDITORIAL_DECISIONS);
    expect(eicPerms).not.toContain(GlobalPermission.MANAGE_JOURNAL_SETTINGS);
    expect(eicPerms).not.toContain(GlobalPermission.MANAGE_BOTS);
  });
});

describe('hasGlobalPermission', () => {
  it('returns true for ADMIN with any permission', () => {
    expect(hasGlobalPermission(GlobalRole.ADMIN, GlobalPermission.MANAGE_JOURNAL_SETTINGS)).toBe(true);
    expect(hasGlobalPermission(GlobalRole.ADMIN, GlobalPermission.SUBMIT_MANUSCRIPT)).toBe(true);
  });

  it('returns false for BOT with any permission', () => {
    expect(hasGlobalPermission(GlobalRole.BOT, GlobalPermission.SUBMIT_MANUSCRIPT)).toBe(false);
  });

  it('returns false for USER with admin permissions', () => {
    expect(hasGlobalPermission(GlobalRole.USER, GlobalPermission.MANAGE_USERS)).toBe(false);
    expect(hasGlobalPermission(GlobalRole.USER, GlobalPermission.MANAGE_BOTS)).toBe(false);
  });

  it('returns true for USER with basic permissions', () => {
    expect(hasGlobalPermission(GlobalRole.USER, GlobalPermission.SUBMIT_MANUSCRIPT)).toBe(true);
  });
});

describe('hasManuscriptPermission', () => {
  describe('ADMIN / EDITOR_IN_CHIEF', () => {
    it('can view any manuscript', () => {
      expect(
        hasManuscriptPermission(GlobalRole.ADMIN, ManuscriptPermission.VIEW_MANUSCRIPT, {})
      ).toBe(true);
    });

    it('can make editorial decisions', () => {
      expect(
        hasManuscriptPermission(GlobalRole.ADMIN, ManuscriptPermission.MAKE_EDITORIAL_DECISION, {})
      ).toBe(true);
      expect(
        hasManuscriptPermission(GlobalRole.EDITOR_IN_CHIEF, ManuscriptPermission.MAKE_EDITORIAL_DECISION, {})
      ).toBe(true);
    });

    it('can assign reviewers', () => {
      expect(
        hasManuscriptPermission(GlobalRole.ADMIN, ManuscriptPermission.ASSIGN_REVIEWERS, {})
      ).toBe(true);
    });
  });

  describe('author context', () => {
    const ctx = { isAuthor: true };

    it('can view, edit, and withdraw their manuscript', () => {
      expect(hasManuscriptPermission(GlobalRole.USER, ManuscriptPermission.VIEW_MANUSCRIPT, ctx)).toBe(true);
      expect(hasManuscriptPermission(GlobalRole.USER, ManuscriptPermission.EDIT_MANUSCRIPT, ctx)).toBe(true);
      expect(hasManuscriptPermission(GlobalRole.USER, ManuscriptPermission.WITHDRAW_MANUSCRIPT, ctx)).toBe(true);
    });

    it('can respond to reviews', () => {
      expect(hasManuscriptPermission(GlobalRole.USER, ManuscriptPermission.RESPOND_TO_REVIEWS, ctx)).toBe(true);
    });

    it('cannot assign reviewers', () => {
      expect(hasManuscriptPermission(GlobalRole.USER, ManuscriptPermission.ASSIGN_REVIEWERS, ctx)).toBe(false);
    });
  });

  describe('action editor context', () => {
    const ctx = { isActionEditor: true };

    it('can assign reviewers and make decisions', () => {
      expect(hasManuscriptPermission(GlobalRole.ACTION_EDITOR, ManuscriptPermission.ASSIGN_REVIEWERS, ctx)).toBe(true);
      expect(hasManuscriptPermission(GlobalRole.ACTION_EDITOR, ManuscriptPermission.MAKE_EDITORIAL_DECISION, ctx)).toBe(true);
    });

    it('can moderate and access editor conversations', () => {
      expect(hasManuscriptPermission(GlobalRole.ACTION_EDITOR, ManuscriptPermission.MODERATE_CONVERSATIONS, ctx)).toBe(true);
      expect(hasManuscriptPermission(GlobalRole.ACTION_EDITOR, ManuscriptPermission.ACCESS_EDITOR_CONVERSATIONS, ctx)).toBe(true);
    });
  });

  describe('reviewer context', () => {
    const ctx = { isReviewer: true };

    it('can view manuscript, access materials, and submit review', () => {
      expect(hasManuscriptPermission(GlobalRole.USER, ManuscriptPermission.VIEW_MANUSCRIPT, ctx)).toBe(true);
      expect(hasManuscriptPermission(GlobalRole.USER, ManuscriptPermission.ACCESS_REVIEW_MATERIALS, ctx)).toBe(true);
      expect(hasManuscriptPermission(GlobalRole.USER, ManuscriptPermission.SUBMIT_REVIEW, ctx)).toBe(true);
    });

    it('cannot make editorial decisions', () => {
      expect(hasManuscriptPermission(GlobalRole.USER, ManuscriptPermission.MAKE_EDITORIAL_DECISION, ctx)).toBe(false);
    });
  });

  describe('public access', () => {
    it('allows viewing published manuscripts', () => {
      expect(
        hasManuscriptPermission(GlobalRole.USER, ManuscriptPermission.VIEW_MANUSCRIPT, { isPublished: true })
      ).toBe(true);
    });

    it('allows viewing submitted manuscripts', () => {
      expect(
        hasManuscriptPermission(GlobalRole.USER, ManuscriptPermission.VIEW_MANUSCRIPT, { isSubmitted: true })
      ).toBe(true);
    });

    it('denies editing published manuscripts without author role', () => {
      expect(
        hasManuscriptPermission(GlobalRole.USER, ManuscriptPermission.EDIT_MANUSCRIPT, { isPublished: true })
      ).toBe(false);
    });
  });

  describe('no context', () => {
    it('denies regular user all manuscript permissions', () => {
      expect(hasManuscriptPermission(GlobalRole.USER, ManuscriptPermission.VIEW_MANUSCRIPT, {})).toBe(false);
      expect(hasManuscriptPermission(GlobalRole.USER, ManuscriptPermission.EDIT_MANUSCRIPT, {})).toBe(false);
      expect(hasManuscriptPermission(GlobalRole.USER, ManuscriptPermission.SUBMIT_REVIEW, {})).toBe(false);
    });
  });
});
