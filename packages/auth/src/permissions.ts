// Role-based access control with global and manuscript-specific permissions
// This module is safe to import in browser/client code — no Node.js dependencies.

export enum GlobalPermission {
  // System administration
  MANAGE_JOURNAL_SETTINGS = 'manage_journal_settings',
  MANAGE_USERS = 'manage_users',
  MANAGE_BOTS = 'manage_bots',
  INSTALL_BOTS = 'install_bots',

  // Editorial oversight
  VIEW_ALL_MANUSCRIPTS = 'view_all_manuscripts',
  ASSIGN_ACTION_EDITORS = 'assign_action_editors',
  OVERRIDE_EDITORIAL_DECISIONS = 'override_editorial_decisions',

  // User management
  ONBOARD_USERS = 'onboard_users',
  MANAGE_REVIEWER_POOL = 'manage_reviewer_pool',

  // Basic permissions
  SUBMIT_MANUSCRIPT = 'submit_manuscript',
  CREATE_CONVERSATION = 'create_conversation'
}

export enum ManuscriptPermission {
  // Author permissions
  EDIT_MANUSCRIPT = 'edit_manuscript',
  WITHDRAW_MANUSCRIPT = 'withdraw_manuscript',
  RESPOND_TO_REVIEWS = 'respond_to_reviews',

  // Editor permissions
  ASSIGN_REVIEWERS = 'assign_reviewers',
  MAKE_EDITORIAL_DECISION = 'make_editorial_decision',
  MODERATE_CONVERSATIONS = 'moderate_conversations',
  ACCESS_EDITOR_CONVERSATIONS = 'access_editor_conversations',

  // Reviewer permissions
  ACCESS_REVIEW_MATERIALS = 'access_review_materials',
  SUBMIT_REVIEW = 'submit_review',

  // General access
  VIEW_MANUSCRIPT = 'view_manuscript',
  PARTICIPATE_IN_CONVERSATIONS = 'participate_in_conversations'
}

export enum GlobalRole {
  ADMIN = 'ADMIN',
  EDITOR_IN_CHIEF = 'EDITOR_IN_CHIEF',
  ACTION_EDITOR = 'ACTION_EDITOR',
  USER = 'USER',
  BOT = 'BOT'
}

export const GLOBAL_ROLE_PERMISSIONS: Record<GlobalRole, GlobalPermission[]> = {
  [GlobalRole.ADMIN]: [
    GlobalPermission.MANAGE_JOURNAL_SETTINGS,
    GlobalPermission.MANAGE_USERS,
    GlobalPermission.MANAGE_BOTS,
    GlobalPermission.INSTALL_BOTS,
    GlobalPermission.VIEW_ALL_MANUSCRIPTS,
    GlobalPermission.ASSIGN_ACTION_EDITORS,
    GlobalPermission.OVERRIDE_EDITORIAL_DECISIONS,
    GlobalPermission.ONBOARD_USERS,
    GlobalPermission.MANAGE_REVIEWER_POOL,
    GlobalPermission.SUBMIT_MANUSCRIPT,
    GlobalPermission.CREATE_CONVERSATION
  ],
  [GlobalRole.EDITOR_IN_CHIEF]: [
    GlobalPermission.MANAGE_USERS,
    GlobalPermission.VIEW_ALL_MANUSCRIPTS,
    GlobalPermission.ASSIGN_ACTION_EDITORS,
    GlobalPermission.OVERRIDE_EDITORIAL_DECISIONS,
    GlobalPermission.MANAGE_REVIEWER_POOL,
    GlobalPermission.SUBMIT_MANUSCRIPT,
    GlobalPermission.CREATE_CONVERSATION
  ],
  [GlobalRole.ACTION_EDITOR]: [
    GlobalPermission.SUBMIT_MANUSCRIPT,
    GlobalPermission.CREATE_CONVERSATION
  ],
  [GlobalRole.USER]: [
    GlobalPermission.SUBMIT_MANUSCRIPT,
    GlobalPermission.CREATE_CONVERSATION
  ],
  [GlobalRole.BOT]: []
};

// Check if user has global permission
export function hasGlobalPermission(userRole: GlobalRole, permission: GlobalPermission): boolean {
  const rolePermissions = GLOBAL_ROLE_PERMISSIONS[userRole];
  return rolePermissions.includes(permission);
}

// Check manuscript-specific permissions based on relationship to manuscript
export function hasManuscriptPermission(
  userRole: GlobalRole,
  permission: ManuscriptPermission,
  context: {
    isAuthor?: boolean;
    isActionEditor?: boolean;
    isReviewer?: boolean;
    isPublished?: boolean;
    isSubmitted?: boolean;
  }
): boolean {
  const { isAuthor, isActionEditor, isReviewer, isPublished, isSubmitted } = context;

  // Admin and Editor-in-Chief have most manuscript permissions
  if (userRole === GlobalRole.ADMIN || userRole === GlobalRole.EDITOR_IN_CHIEF) {
    switch (permission) {
      case ManuscriptPermission.VIEW_MANUSCRIPT:
      case ManuscriptPermission.ACCESS_EDITOR_CONVERSATIONS:
      case ManuscriptPermission.MODERATE_CONVERSATIONS:
      case ManuscriptPermission.MAKE_EDITORIAL_DECISION:
      case ManuscriptPermission.ASSIGN_REVIEWERS:
        return true;
      default:
        break;
    }
  }

  // Author permissions
  if (isAuthor) {
    switch (permission) {
      case ManuscriptPermission.VIEW_MANUSCRIPT:
      case ManuscriptPermission.EDIT_MANUSCRIPT:
      case ManuscriptPermission.WITHDRAW_MANUSCRIPT:
      case ManuscriptPermission.RESPOND_TO_REVIEWS:
      case ManuscriptPermission.PARTICIPATE_IN_CONVERSATIONS:
        return true;
      default:
        break;
    }
  }

  // Action Editor permissions
  if (isActionEditor) {
    switch (permission) {
      case ManuscriptPermission.VIEW_MANUSCRIPT:
      case ManuscriptPermission.ASSIGN_REVIEWERS:
      case ManuscriptPermission.MAKE_EDITORIAL_DECISION:
      case ManuscriptPermission.MODERATE_CONVERSATIONS:
      case ManuscriptPermission.ACCESS_EDITOR_CONVERSATIONS:
      case ManuscriptPermission.PARTICIPATE_IN_CONVERSATIONS:
        return true;
      default:
        break;
    }
  }

  // Reviewer permissions
  if (isReviewer) {
    switch (permission) {
      case ManuscriptPermission.VIEW_MANUSCRIPT:
      case ManuscriptPermission.ACCESS_REVIEW_MATERIALS:
      case ManuscriptPermission.SUBMIT_REVIEW:
      case ManuscriptPermission.PARTICIPATE_IN_CONVERSATIONS:
        return true;
      default:
        break;
    }
  }

  // Public access for submitted and published manuscripts
  if ((isSubmitted || isPublished) && permission === ManuscriptPermission.VIEW_MANUSCRIPT) {
    return true;
  }

  return false;
}

// Legacy compatibility functions (to be phased out)
export enum Role {
  AUTHOR = 'USER', // Map to USER since authorship is now manuscript-specific
  REVIEWER = 'USER',
  EDITOR = 'MANAGING_EDITOR',
  ADMIN = 'ADMIN'
}

export enum Permission {
  READ_MANUSCRIPT = 'read_manuscript',
  EDIT_MANUSCRIPT = 'edit_manuscript',
  SUBMIT_MANUSCRIPT = 'submit_manuscript',
  DELETE_MANUSCRIPT = 'delete_manuscript',
  CREATE_CONVERSATION = 'create_conversation',
  MODERATE_CONVERSATION = 'moderate_conversation',
  ASSIGN_REVIEWERS = 'assign_reviewers',
  MAKE_EDITORIAL_DECISIONS = 'make_editorial_decisions',
  INSTALL_BOTS = 'install_bots',
  MANAGE_BOTS = 'manage_bots',
  MANAGE_SETTINGS = 'manage_settings',
  MANAGE_USERS = 'manage_users'
}

// Legacy permission checking (deprecated)
export function hasPermission(userRole: GlobalRole, permission: Permission): boolean {
  // Map old permissions to new system
  switch (permission) {
    case Permission.MANAGE_SETTINGS:
      return hasGlobalPermission(userRole, GlobalPermission.MANAGE_JOURNAL_SETTINGS);
    case Permission.MANAGE_USERS:
      return hasGlobalPermission(userRole, GlobalPermission.MANAGE_USERS);
    case Permission.SUBMIT_MANUSCRIPT:
      return hasGlobalPermission(userRole, GlobalPermission.SUBMIT_MANUSCRIPT);
    case Permission.CREATE_CONVERSATION:
      return hasGlobalPermission(userRole, GlobalPermission.CREATE_CONVERSATION);
    default:
      return false;
  }
}

export function hasAnyPermission(userRole: GlobalRole, permissions: Permission[]): boolean {
  return permissions.some(permission => hasPermission(userRole, permission));
}

export function hasAllPermissions(userRole: GlobalRole, permissions: Permission[]): boolean {
  return permissions.every(permission => hasPermission(userRole, permission));
}
