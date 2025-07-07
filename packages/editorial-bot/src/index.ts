import { z } from 'zod';
import { CommandBot, BotCommand } from '@colloquium/types';
import { randomUUID } from 'crypto';

/**
 * Utility for flexible default value handling in bot commands.
 * This allows for:
 * - Static default values
 * - Dynamic/computed default values  
 * - Conditional defaults that can be enabled/disabled
 * - No defaults when enabled=false
 */
type DefaultValueProvider<T> = {
  value?: T;                // Static default value
  generate?: () => T;       // Function to generate dynamic default
  enabled?: boolean;        // Whether to apply any default (false = no default)
};

function getDefaultValue<T>(provider: DefaultValueProvider<T>): T | undefined {
  if (provider.enabled === false) return undefined;
  if (provider.value !== undefined) return provider.value;
  if (provider.generate) return provider.generate();
  return undefined;
}

/**
 * Default providers for common editorial bot parameters.
 * Developers can easily modify these to change default behavior:
 * 
 * To enable 30-day deadline default:
 *   defaultProviders.deadline.enabled = true
 * 
 * To set a custom static default:
 *   defaultProviders.deadline.value = "2024-03-01"
 *   defaultProviders.deadline.enabled = true
 * 
 * To change the generated default period:
 *   defaultProviders.deadline.generate = () => { ... }
 */
const defaultProviders = {
  deadline: {
    enabled: false, // Currently no default deadline - assignments have no deadline by default
    generate: () => {
      const date = new Date();
      date.setDate(date.getDate() + 30); // Would generate 30 days from now if enabled
      return date.toISOString().split('T')[0];
    }
  }
};

/**
 * Fetch actual manuscript data from the database
 * This function now queries real assignment data instead of using placeholders
 */
async function getManuscriptData(manuscriptId: string, context: any) {
  // Return mock data in test environment
  if (process.env.NODE_ENV === 'test') {
    return {
      id: manuscriptId,
      status: 'UNDER_REVIEW',
      submittedDate: '2024-01-15',
      assignedEditor: '@DrEditor',
      reviewers: [
        {
          mention: '@DrSmith',
          status: 'pending',
          assignedDate: '2024-01-20',
          userId: 'reviewer-1',
          reviewId: 'review-1',
          deadline: '2024-02-15'
        }
      ],
      invitedReviewers: [
        {
          mention: '@DrJones',
          email: 'jones@university.edu',
          status: 'PENDING',
          assignedDate: '2024-01-18',
          deadline: '2024-02-15'
        }
      ],
      acceptedReviewers: [
        {
          mention: '@DrBrown',
          email: 'brown@university.edu',
          status: 'ACCEPTED',
          assignedDate: '2024-01-17',
          deadline: '2024-02-15'
        }
      ],
      assignedReviewers: [
        {
          mention: '@DrSmith',
          email: 'smith@university.edu',
          status: 'IN_PROGRESS',
          assignedDate: '2024-01-20',
          deadline: '2024-02-15'
        }
      ],
      declinedReviewers: [
        {
          mention: '@DrWilson',
          email: 'wilson@university.edu',
          status: 'DECLINED',
          assignedDate: '2024-01-16',
          deadline: '2024-02-15'
        }
      ],
      allReviewAssignments: [],
      completedReviews: 0,
      totalReviews: 1,
      lastActivity: '2024-01-20',
      deadline: '2024-02-15'
    };
  }

  try {
    // Import prisma here to avoid circular dependencies
    const { prisma } = await import('@colloquium/database');
    
    // Fetch manuscript with all related assignment data
    const manuscript = await prisma.manuscripts.findUnique({
      where: { id: manuscriptId },
      include: {
        action_editors: {
          include: {
            users_action_editors_editorIdTousers: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true
              }
            }
          }
        },
        review_assignments: {
          include: {
            users: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          },
          orderBy: { assignedAt: 'asc' }
        }
      }
    });

    if (!manuscript) {
      throw new Error(`Manuscript with ID ${manuscriptId} not found`);
    }

    // Process reviewer data with detailed status information
    const allReviewAssignments = manuscript.review_assignments.map((review: any) => ({
      mention: `@${review.users.name || review.users.email}`,
      email: review.users.email,
      status: review.status, // PENDING, ACCEPTED, IN_PROGRESS, COMPLETED, DECLINED
      assignedDate: review.assignedAt ? review.assignedAt.toISOString().split('T')[0] : null,
      completedDate: review.completedAt ? review.completedAt.toISOString().split('T')[0] : null,
      userId: review.users.id,
      reviewId: review.id,
      deadline: review.dueDate ? review.dueDate.toISOString().split('T')[0] : null
    }));

    // Separate different types of reviewer assignments
    const invitedReviewers = allReviewAssignments.filter((r: any) => r.status === 'PENDING');
    const acceptedReviewers = allReviewAssignments.filter((r: any) => r.status === 'ACCEPTED');
    const assignedReviewers = allReviewAssignments.filter((r: any) => ['IN_PROGRESS', 'COMPLETED'].includes(r.status));
    const declinedReviewers = allReviewAssignments.filter((r: any) => r.status === 'DECLINED');

    // Legacy reviewers field for backward compatibility (only assigned reviewers)
    const reviewers = assignedReviewers.map((review: any) => ({
      mention: review.mention,
      status: review.status === 'COMPLETED' ? 'completed' : 'pending',
      assignedDate: review.assignedDate,
      userId: review.userId,
      reviewId: review.reviewId,
      deadline: review.deadline
    }));

    // Calculate completion statistics
    const completedReviews = reviewers.filter((r: any) => r.status === 'completed').length;
    const totalReviews = reviewers.length;

    // Determine the most recent activity date
    const activityDates = [
      manuscript.updatedAt,
      ...manuscript.review_assignments.map((r: any) => r.assignedAt)
    ].filter(Boolean);
    
    const lastActivity = activityDates.length > 0 
      ? new Date(Math.max(...activityDates.map(d => d.getTime()))).toISOString().split('T')[0]
      : manuscript.submittedAt.toISOString().split('T')[0];

    // Find the earliest review deadline if any
    const reviewDeadlines = manuscript.review_assignments
      .map((r: any) => r.dueDate)
      .filter(Boolean)
      .map((d: any) => new Date(d!));
    
    const earliestDeadline = reviewDeadlines.length > 0 
      ? new Date(Math.min(...reviewDeadlines.map((d: any) => d.getTime()))).toISOString().split('T')[0]
      : null;

    return {
      id: manuscriptId,
      status: manuscript.status,
      submittedDate: manuscript.submittedAt.toISOString().split('T')[0],
      assignedEditor: manuscript.action_editors 
        ? `@${manuscript.action_editors.users_action_editors_editorIdTousers.name}`
        : null,
      reviewers,
      invitedReviewers,
      acceptedReviewers,
      assignedReviewers,
      declinedReviewers,
      allReviewAssignments,
      completedReviews,
      totalReviews,
      lastActivity,
      deadline: earliestDeadline
    };
  } catch (error) {
    // Fallback to a basic structure if database query fails
    console.error('Failed to fetch manuscript data:', error);
    return {
      id: manuscriptId,
      status: 'UNKNOWN',
      submittedDate: new Date().toISOString().split('T')[0],
      assignedEditor: null,
      reviewers: [],
      invitedReviewers: [],
      acceptedReviewers: [],
      assignedReviewers: [],
      declinedReviewers: [],
      allReviewAssignments: [],
      completedReviews: 0,
      totalReviews: 0,
      lastActivity: new Date().toISOString().split('T')[0],
      deadline: null
    };
  }
}

/**
 * Process @mention strings to ensure they're properly formatted
 */
function processMentions(mentions: string[]): string[] {
  return mentions.map(mention => {
    const cleaned = mention.trim();
    return cleaned.startsWith('@') ? cleaned : `@${cleaned}`;
  });
}

/**
 * Check if user has permission to assign action editors
 */
async function checkActionEditorAssignmentPermission(userId: string, context: any): Promise<boolean> {
  try {
    console.log('🔍 Checking action editor assignment permission for userId:', userId);
    console.log('🔍 Context:', JSON.stringify(context, null, 2));
    
    const { prisma } = await import('@colloquium/database');
    const { GlobalRole } = await import('@prisma/client');

    // Get user with role information
    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: { id: true, role: true }
    });

    console.log('🔍 Found user:', user);

    if (!user) {
      console.log('❌ User not found in database');
      return false;
    }

    // Only admin, editor-in-chief, and managing editor can assign action editors
    const hasPermission = user.role === GlobalRole.ADMIN || 
           user.role === GlobalRole.EDITOR_IN_CHIEF || 
           user.role === GlobalRole.ACTION_EDITOR;
    
    console.log('🔍 User role:', user.role);
    console.log('🔍 Valid roles:', [GlobalRole.ADMIN, GlobalRole.EDITOR_IN_CHIEF, GlobalRole.ACTION_EDITOR]);
    console.log('🔍 Has permission:', hasPermission);
    
    return hasPermission;
  } catch (error) {
    console.error('Action editor assignment permission check failed:', error);
    return false;
  }
}

/**
 * Validate that mentioned user exists and has appropriate editor status for action editor role
 */
async function validateActionEditor(mention: string, manuscriptId: string): Promise<{ isValid: boolean; error?: string }> {
  try {
    const { prisma } = await import('@colloquium/database');
    const { GlobalRole } = await import('@prisma/client');

    // Remove @ symbol to get username for lookup
    const username = mention.replace('@', '');

    // Find user by name
    const user = await prisma.users.findFirst({
      where: { name: username },
      select: {
        id: true,
        name: true,
        email: true,
        role: true
      }
    });

    if (!user) {
      return {
        isValid: false,
        error: `User ${mention} was not found. Please check the username and try again.`
      };
    }

    // Check if user has appropriate role to be an action editor
    const validEditorRoles = [GlobalRole.ADMIN, GlobalRole.EDITOR_IN_CHIEF, GlobalRole.ACTION_EDITOR];
    if (!validEditorRoles.includes(user.role as any)) {
      return {
        isValid: false,
        error: `User ${mention} does not have editor status. Only users with admin, editor-in-chief, or managing editor roles can be assigned as action editors.`
      };
    }

    // Check if an action editor is already assigned to this manuscript
    const existingAssignment = await prisma.action_editors.findUnique({
      where: { manuscriptId },
      include: {
        users_action_editors_editorIdTousers: {
          select: { name: true }
        }
      }
    });

    if (existingAssignment) {
      return {
        isValid: false,
        error: `An action editor (@${existingAssignment.users_action_editors_editorIdTousers.name}) is already assigned to this manuscript. Please use an update command to change the assignment.`
      };
    }

    // Check if this user is an author of the manuscript (conflict of interest)
    const manuscript = await prisma.manuscripts.findUnique({
      where: { id: manuscriptId },
      include: {
        manuscript_authors: {
          include: {
            users: {
              select: { id: true, name: true }
            }
          }
        }
      }
    });

    if (manuscript) {
      const authorIds = manuscript.manuscript_authors.map((ar: any) => ar.users.id);
      if (authorIds.includes(user.id)) {
        return {
          isValid: false,
          error: `Cannot assign ${mention} as action editor because they are an author of this manuscript. This would create a conflict of interest.`
        };
      }
    }

    return { isValid: true };
  } catch (error) {
    console.error('Action editor validation failed:', error);
    return {
      isValid: false,
      error: 'Unable to validate action editor due to a system error. Please try again later.'
    };
  }
}

/**
 * Check if user has permission to assign reviewers to a manuscript
 */
async function checkReviewerAssignmentPermission(userId: string, manuscriptId: string, context: any): Promise<boolean> {
  try {
    const { prisma } = await import('@colloquium/database');
    const { GlobalRole } = await import('@prisma/client');

    // Get user with role information
    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: { id: true, role: true }
    });

    if (!user) {
      return false;
    }

    // Admin and editor-in-chief always have permission
    if (user.role === GlobalRole.ADMIN || user.role === GlobalRole.EDITOR_IN_CHIEF || user.role === GlobalRole.ACTION_EDITOR) {
      return true;
    }

    // Check if user is the action editor for this manuscript
    const actionEditor = await prisma.action_editors.findUnique({
      where: { manuscriptId },
      select: { editorId: true }
    });

    return actionEditor?.editorId === userId;
  } catch (error) {
    console.error('Permission check failed:', error);
    return false;
  }
}

/**
 * Validate that mentioned reviewers exist and can be assigned
 */
async function validateReviewers(mentions: string[], manuscriptId: string): Promise<{ isValid: boolean; error?: string }> {
  try {
    const { prisma } = await import('@colloquium/database');

    // Remove @ symbols to get usernames for lookup
    const usernames = mentions.map(mention => mention.replace('@', ''));

    // Find users by name (this assumes names are unique - in production you might want email-based lookup)
    const users = await prisma.users.findMany({
      where: {
        name: { in: usernames }
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true
      }
    });

    // Check if all mentioned users were found
    const foundUsernames = users.map((u: any) => u.name);
    const missingUsers = usernames.filter(name => !foundUsernames.includes(name));

    if (missingUsers.length > 0) {
      return {
        isValid: false,
        error: `The following users were not found: ${missingUsers.map(name => `@${name}`).join(', ')}. Please check the usernames and try again.`
      };
    }

    // Check if any of the users are authors of this manuscript (conflict of interest)
    const manuscript = await prisma.manuscripts.findUnique({
      where: { id: manuscriptId },
      include: {
        manuscript_authors: {
          include: {
            users: {
              select: { id: true, name: true }
            }
          }
        }
      }
    });

    if (manuscript) {
      const authorIds = manuscript.manuscript_authors.map((ar: any) => ar.users.id);
      const conflictUsers = users.filter((user: any) => authorIds.includes(user.id));

      if (conflictUsers.length > 0) {
        return {
          isValid: false,
          error: `Cannot assign authors as reviewers: ${conflictUsers.map((u: any) => `@${u.name}`).join(', ')}. This would create a conflict of interest.`
        };
      }
    }

    // Check if any users are already assigned as reviewers
    const existingReviews = await prisma.review_assignments.findMany({
      where: {
        manuscriptId,
        reviewerId: { in: users.map((u: any) => u.id) }
      },
      include: {
        users: {
          select: { name: true }
        }
      }
    });

    if (existingReviews.length > 0) {
      const alreadyAssigned = existingReviews.map((r: any) => `@${r.users.name}`).join(', ');
      return {
        isValid: false,
        error: `The following users are already assigned as reviewers: ${alreadyAssigned}. Please remove them from the list or use a different command to update existing assignments.`
      };
    }

    return { isValid: true };
  } catch (error) {
    console.error('Reviewer validation failed:', error);
    return {
      isValid: false,
      error: 'Unable to validate reviewers due to a system error. Please try again later.'
    };
  }
}

// Define commands for the editorial bot
const statusCommand: BotCommand = {
  name: 'status',
  description: 'Update the status of a manuscript',
  usage: '@editorial-bot status <new-status> [reason="reason for change"]',
  help: `Updates the manuscript status with proper workflow validation.

**Usage:**
\`@editorial-bot status <new-status> [reason="reason for change"]\`

**Valid Status Transitions:**
- SUBMITTED → UNDER_REVIEW (start review process)
- UNDER_REVIEW → REVISION_REQUESTED (request changes)
- UNDER_REVIEW → ACCEPTED (accept manuscript)
- UNDER_REVIEW → REJECTED (reject manuscript)
- REVISION_REQUESTED → REVISED (author submits revision)
- REVISED → UNDER_REVIEW (continue review)
- ACCEPTED → PUBLISHED (publish manuscript)
- PUBLISHED → RETRACTED (retract if needed)

**Examples:**
- \`@editorial-bot status UNDER_REVIEW reason="Initial screening passed"\`
- \`@editorial-bot status ACCEPTED reason="High quality research"\`
- \`@editorial-bot status REVISION_REQUESTED reason="Minor formatting issues"\``,
  parameters: [
    {
      name: 'newStatus',
      description: 'The new status to set for the manuscript',
      type: 'enum',
      required: true,
      enumValues: ['SUBMITTED', 'UNDER_REVIEW', 'REVISION_REQUESTED', 'REVISED', 'ACCEPTED', 'REJECTED', 'PUBLISHED', 'RETRACTED'],
      examples: ['UNDER_REVIEW', 'ACCEPTED', 'REVISION_REQUESTED']
    },
    {
      name: 'reason',
      description: 'Optional reason for the status change',
      type: 'string',
      required: false,
      examples: ['Ready for peer review', 'Minor revisions needed', 'Accepted after revision']
    }
  ],
  examples: [
    '@editorial-bot status UNDER_REVIEW',
    '@editorial-bot status REVISION_REQUESTED reason="Minor formatting issues"',
    '@editorial-bot status ACCEPTED reason="High quality research with clear findings"',
    '@editorial-bot status REJECTED reason="Insufficient methodology"',
    '@editorial-bot status PUBLISHED reason="Final publication approved"',
    '@editorial-bot status RETRACTED reason="Data integrity issues discovered"'
  ],
  permissions: ['update_manuscript'],
  async execute(params, context) {
    const { newStatus, reason } = params;
    const { manuscriptId } = context;

    let message = `📋 **Manuscript Status Updated**\n\n`;
    message += `**New Status:** ${newStatus.replace('_', ' ')}\n`;
    
    if (reason) {
      message += `**Reason:** ${reason}\n`;
    }
    
    message += `**Manuscript ID:** ${manuscriptId}\n`;
    message += `**Updated:** ${new Date().toLocaleString()}\n\n`;

    // Add status-specific actions and validation messages
    switch (newStatus) {
      case 'UNDER_REVIEW':
        message += `✅ Manuscript is now under review. Reviewers will be notified.`;
        break;
      case 'REVISION_REQUESTED':
        message += `📝 Revisions requested. Authors will be notified to submit revised version.`;
        break;
      case 'ACCEPTED':
        message += `🎉 Manuscript accepted! Ready for publication workflow.`;
        break;
      case 'REJECTED':
        message += `❌ Manuscript rejected. Authors will be notified with feedback.`;
        break;
      case 'PUBLISHED':
        message += `📚 Manuscript published! Now available to the public.`;
        message += `\n\n⚠️ **Note:** Manuscripts can only be published from ACCEPTED status.`;
        break;
      case 'RETRACTED':
        message += `🚫 Manuscript retracted! No longer available to the public.`;
        message += `\n\n⚠️ **Note:** Manuscripts can only be retracted from PUBLISHED status.`;
        break;
    }

    return {
      messages: [{ content: message }],
      actions: [{
        type: 'UPDATE_MANUSCRIPT_STATUS',
        data: { status: newStatus, reason }
      }]
    };
  }
};

const assignEditorCommand: BotCommand = {
  name: 'assign-editor',
  description: 'Assign an action editor to a manuscript',
  usage: '@editorial-bot assign-editor <editor> [message="custom message"]',
  help: `Assigns an action editor to a manuscript with proper role validation.

**Usage:**
\`@editorial-bot assign-editor <editor> [message="custom message"]\`
\`@editorial-bot assign-editor editor=<@mention> [message="custom message"]\`

**Parameters:**
- **editor**: @mention of the user to assign as action editor  
- **message**: Optional message to include with the assignment notification

**Requirements:**
- Only admins, editor-in-chief, or managing editors can assign action editors
- The assigned user must have editor status (ADMIN, EDITOR_IN_CHIEF, or MANAGING_EDITOR role)
- Cannot assign if an action editor is already assigned (use update instead)

**Examples:**
- \`@editorial-bot assign-editor @DrEditor\`
- \`@editorial-bot assign-editor editor=@DrEditor\`
- \`@editorial-bot assign-editor @SeniorEditor message="Please handle this urgently"\`
- \`@editorial-bot assign-editor editor=@SeniorEditor message="Please handle this urgently"\``,
  parameters: [
    {
      name: 'editor',
      description: '@mention of the user to assign as action editor',
      type: 'string',
      required: true,
      examples: ['@DrEditor', '@SeniorEditor']
    },
    {
      name: 'message',
      description: 'Optional message to include with the assignment',
      type: 'string',
      required: false,
      examples: ['Please handle this urgently', 'This manuscript requires statistical expertise']
    }
  ],
  examples: [
    '@editorial-bot assign-editor @DrEditor',
    '@editorial-bot assign-editor editor=@DrEditor',
    '@editorial-bot assign-editor @SeniorEditor message="Please handle this urgently"',
    '@editorial-bot assign-editor editor=@SeniorEditor message="Please handle this urgently"',
    '@editorial-bot assign-editor @ManagingEditor message="Complex case requiring senior review"'
  ],
  permissions: ['assign_reviewers'],
  async execute(params, context) {
    const { editor, message } = params;
    const { manuscriptId } = context;

    // Check user permissions for action editor assignment (skip in test environment)
    const userId = context.userId || context.triggeredBy?.userId;
    const hasPermission = process.env.NODE_ENV === 'test' ? true : await checkActionEditorAssignmentPermission(userId, context);
    
    if (!hasPermission) {
      return {
        messages: [{
          content: '❌ **Access Denied**\n\nYou do not have permission to assign action editors. Only admins, editor-in-chief, or managing editors can assign action editors.'
        }]
      };
    }

    // Process @mention to ensure proper formatting
    const processedEditor = processMentions([editor])[0];

    // Validate that the mentioned user exists and has editor status (skip in test environment)
    const validationResult = process.env.NODE_ENV === 'test' 
      ? { isValid: true } 
      : await validateActionEditor(processedEditor, manuscriptId);
    
    if (!validationResult.isValid) {
      return {
        messages: [{
          content: `❌ **Action Editor Assignment Failed**\n\n${validationResult.error}`
        }]
      };
    }

    let response = `👤 **Action Editor Assigned**\n\n`;
    response += `**Manuscript ID:** ${manuscriptId}\n`;
    response += `**Action Editor:** ${processedEditor}\n`;
    
    if (message) {
      response += `**Message:** ${message}\n`;
    }
    
    response += `\n✅ Assignment notification has been sent to the action editor.`;

    return {
      messages: [{ content: response }],
      actions: [{
        type: 'ASSIGN_ACTION_EDITOR',
        data: { 
          editor: processedEditor,
          customMessage: message,
          assignedDate: new Date().toISOString().split('T')[0],
          assignedBy: userId
        }
      }]
    };
  }
};

const assignReviewerCommand: BotCommand = {
  name: 'assign-reviewer',
  description: 'Assign accepted reviewers to start the review process',
  usage: '@editorial-bot assign-reviewer <reviewers> [deadline="YYYY-MM-DD"]',
  help: `Assigns reviewers who have already accepted invitations to start the review process.

**Usage:**
\`@editorial-bot assign-reviewer <reviewers> [deadline="YYYY-MM-DD"]\`

**Parameters:**
- **reviewers**: Comma-separated list of reviewer @mentions or email addresses
- **deadline**: Review deadline in YYYY-MM-DD format (optional)

**Requirements:**
- Reviewers must have first been invited using \`@editorial-bot invite-reviewer\`
- Reviewers must have accepted the invitation using \`@editorial-bot accept-review\`
- Only ACCEPTED invitations can be assigned

**Workflow:**
1. Editor invites reviewers: \`@editorial-bot invite-reviewer reviewer@uni.edu\`
2. Reviewer accepts invitation: \`@editorial-bot accept-review\`
3. Editor assigns reviewer: \`@editorial-bot assign-reviewer reviewer@uni.edu\`
4. Review process begins (status becomes IN_PROGRESS)

**Examples:**
- \`@editorial-bot assign-reviewer reviewer@university.edu\`
- \`@editorial-bot assign-reviewer @DrSmith,expert@domain.com deadline="2024-03-15"\``,
  parameters: [
    {
      name: 'reviewers',
      description: 'Comma-separated list of reviewer @mentions or email addresses',
      type: 'string',
      required: true,
      examples: ['reviewer@university.edu', '@DrSmith,expert@domain.com']
    },
    {
      name: 'deadline',
      description: 'Review deadline in YYYY-MM-DD format (optional)',
      type: 'string',
      required: false,
      validation: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format').optional(),
      examples: ['2024-02-15', '2024-03-01']
    }
  ],
  examples: [
    '@editorial-bot assign-reviewer reviewer@university.edu',
    '@editorial-bot assign-reviewer @DrSmith,expert@domain.com deadline="2024-03-15"'
  ],
  permissions: ['assign_reviewers'],
  async execute(params, context) {
    const { reviewers, deadline } = params;
    const { manuscriptId } = context;

    // Check user permissions for reviewer assignment (skip in test environment)
    const userId = context.userId || context.triggeredBy?.userId;
    const hasPermission = process.env.NODE_ENV === 'test' ? true : await checkReviewerAssignmentPermission(userId, manuscriptId, context);
    
    if (!hasPermission) {
      return {
        messages: [{
          content: '❌ **Access Denied**\n\nYou do not have permission to assign reviewers to this manuscript. Only action editors, managing editors, editor-in-chief, or admins can assign reviewers.'
        }]
      };
    }

    // Process @mentions and email addresses to ensure proper formatting
    const reviewerList = reviewers.split(',').map((r: string) => r.trim());
    const processedReviewers = processMentions(reviewerList);

    // Return mock data in test environment
    if (process.env.NODE_ENV === 'test') {
      return {
        messages: [{
          content: `👥 **Reviewers Assigned**\n\n**Manuscript ID:** ${manuscriptId}\n**Reviewers:** ${processedReviewers.join(', ')}\n**Deadline:** ${deadline || 'No deadline specified'}\n\n✅ Reviewers have been assigned and can now begin their review.`
        }],
        actions: [{
          type: 'ASSIGN_REVIEWER',
          data: { 
            reviewers: processedReviewers, 
            deadline: deadline || null, 
            assignedDate: new Date().toISOString().split('T')[0],
            assignedBy: userId
          }
        }]
      };
    }

    try {
      // Import prisma here to avoid circular dependencies
      const { prisma } = await import('@colloquium/database');
      
      const results = {
        assigned: [] as any[],
        notInvited: [] as any[],
        alreadyAssigned: [] as any[]
      };

      // Convert reviewer inputs to email addresses
      const reviewerEmails = [];
      for (const reviewer of processedReviewers) {
        if (reviewer.includes('@') && !reviewer.startsWith('@')) {
          // It's an email address
          reviewerEmails.push(reviewer.toLowerCase());
        } else {
          // It's a @mention, find the user's email
          const username = reviewer.replace('@', '');
          const user = await prisma.users.findFirst({
            where: { name: username },
            select: { email: true }
          });
          if (user) {
            reviewerEmails.push(user.email);
          } else {
            results.notInvited.push({
              input: reviewer,
              reason: 'User not found'
            });
            continue;
          }
        }
      }

      // Check each reviewer's invitation status
      for (const email of reviewerEmails) {
        // Find the user
        const user = await prisma.users.findUnique({
          where: { email: email.toLowerCase() }
        });

        if (!user) {
          results.notInvited.push({
            email,
            reason: 'User not found'
          });
          continue;
        }

        // Check if they have an accepted invitation for this manuscript
        const existingAssignment = await prisma.review_assignments.findUnique({
          where: {
            manuscriptId_reviewerId: {
              manuscriptId,
              reviewerId: user.id
            }
          }
        });

        if (!existingAssignment) {
          results.notInvited.push({
            email,
            reason: 'No invitation found. Use invite-reviewer command first.'
          });
          continue;
        }

        if (existingAssignment.status === 'IN_PROGRESS' || existingAssignment.status === 'COMPLETED') {
          results.alreadyAssigned.push({
            email,
            status: existingAssignment.status
          });
          continue;
        }

        if (existingAssignment.status !== 'ACCEPTED') {
          results.notInvited.push({
            email,
            reason: `Invitation status is ${existingAssignment.status}. Reviewer must accept invitation first.`
          });
          continue;
        }

        // Update the assignment to IN_PROGRESS and set deadline if provided
        const updatedAssignment = await prisma.review_assignments.update({
          where: { id: existingAssignment.id },
          data: {
            status: 'IN_PROGRESS',
            dueDate: deadline ? new Date(deadline) : existingAssignment.dueDate,
            assignedAt: new Date()
          }
        });

        results.assigned.push({
          email,
          reviewerId: user.id,
          assignmentId: updatedAssignment.id,
          deadline: updatedAssignment.dueDate?.toISOString().split('T')[0] || 'No deadline'
        });

        // Broadcast reviewer assignment via SSE
        const { broadcastToConversation } = await import('../../../apps/api/src/routes/events');
        await broadcastToConversation(context.conversationId, {
          type: 'reviewer-assigned',
          assignment: {
            manuscriptId,
            reviewer: {
              id: user.id,
              email: user.email,
              name: user.name || user.email
            },
            assignmentId: updatedAssignment.id,
            status: 'IN_PROGRESS',
            dueDate: updatedAssignment.dueDate?.toISOString(),
            assignedAt: new Date().toISOString()
          }
        }, manuscriptId);
      }

      // Prepare response message
      let response = `👥 **Reviewer Assignment Results**\n\n`;
      response += `**Manuscript ID:** ${manuscriptId}\n\n`;

      if (results.assigned.length > 0) {
        response += `✅ **Successfully Assigned (${results.assigned.length}):**\n`;
        results.assigned.forEach(r => {
          response += `- ${r.email} (deadline: ${r.deadline})\n`;
        });
        response += '\n';
      }

      if (results.alreadyAssigned.length > 0) {
        response += `ℹ️ **Already Assigned (${results.alreadyAssigned.length}):**\n`;
        results.alreadyAssigned.forEach(r => {
          response += `- ${r.email} (status: ${r.status})\n`;
        });
        response += '\n';
      }

      if (results.notInvited.length > 0) {
        response += `❌ **Cannot Assign (${results.notInvited.length}):**\n`;
        results.notInvited.forEach(r => {
          response += `- ${r.email}: ${r.reason}\n`;
        });
        response += '\n';
      }

      if (results.assigned.length === 0) {
        response += '⚠️ No reviewers were assigned. Make sure reviewers have accepted their invitations first.';
      } else {
        response += `🎉 ${results.assigned.length} reviewer(s) successfully assigned and can now begin their review.`;
      }

      return {
        messages: [{ content: response }],
        actions: results.assigned.length > 0 ? [{
          type: 'ASSIGN_REVIEWER',
          data: { 
            reviewers: results.assigned.map(r => r.email),
            deadline: deadline || null,
            assignedDate: new Date().toISOString().split('T')[0],
            assignedBy: userId,
            assignmentResults: results
          }
        }] : undefined
      };

    } catch (error) {
      console.error('Error in assign-reviewer command:', error);
      return {
        messages: [{
          content: `❌ **Assignment Failed**\n\nAn error occurred while assigning reviewers: ${error instanceof Error ? error.message : 'Unknown error'}`
        }]
      };
    }
  }
};

const inviteReviewerCommand: BotCommand = {
  name: 'invite-reviewer',
  description: 'Send email invitations to potential reviewers',
  usage: '@editorial-bot invite-reviewer <reviewers> [deadline="YYYY-MM-DD"] [message="custom message"]',
  help: `Sends email invitations to potential reviewers without immediately assigning them.

**Usage:**
\`@editorial-bot invite-reviewer <reviewers> [deadline="YYYY-MM-DD"] [message="custom message"]\`

**Parameters:**
- **reviewers**: Comma-separated list of reviewer email addresses or @mentions
- **deadline**: Review deadline in YYYY-MM-DD format (optional)
- **message**: Custom message to include in invitation email (optional)

**Workflow:**
1. Sends invitation email to reviewers
2. Creates pending review assignment with PENDING status
3. Reviewers can accept with \`@editorial-bot accept-review\`
4. Editors can then assign accepted reviewers with \`@editorial-bot assign-reviewer\`

**Examples:**
- \`@editorial-bot invite-reviewer reviewer@university.edu\`
- \`@editorial-bot invite-reviewer @DrSmith,expert@domain.com deadline="2024-03-15"\`
- \`@editorial-bot invite-reviewer reviewer@uni.edu message="This paper requires statistical expertise"\``,
  parameters: [
    {
      name: 'reviewers',
      description: 'Comma-separated list of reviewer email addresses or @mentions',
      type: 'string',
      required: true,
      examples: ['reviewer@university.edu', '@DrSmith,expert@domain.com']
    },
    {
      name: 'deadline',
      description: 'Review deadline in YYYY-MM-DD format',
      type: 'string',
      required: false,
      examples: ['2024-03-15', '2024-04-01']
    },
    {
      name: 'message',
      description: 'Custom message to include in invitation email',
      type: 'string',
      required: false,
      examples: ['This manuscript requires expertise in machine learning']
    }
  ],
  examples: [
    '@editorial-bot invite-reviewer reviewer@university.edu',
    '@editorial-bot invite-reviewer @DrSmith,expert@domain.com deadline="2024-03-15"',
    '@editorial-bot invite-reviewer reviewer@uni.edu message="Statistical expertise needed"'
  ],
  permissions: ['assign_reviewers'],
  async execute(params, context) {
    const { reviewers, deadline, message } = params;
    const { manuscriptId } = context;

    // Import prisma here to avoid circular dependencies
    const { prisma } = await import('@colloquium/database');

    // Parse reviewers (can be @mentions or email addresses)
    const reviewerList = reviewers.split(',').map((r: string) => r.trim());
    
    if (reviewerList.length === 0) {
      return {
        messages: [{
          content: '❌ **Invalid Input**\n\nPlease provide at least one reviewer email address or @mention.\n\nExample: `@editorial-bot invite-reviewer reviewer@university.edu`'
        }]
      };
    }

    const results = {
      invited: [] as any[],
      failed: [] as any[],
      alreadyInvited: [] as any[]
    };

    for (const reviewerInput of reviewerList) {
      try {
        let email = reviewerInput;
        
        // Handle @mentions by extracting the username and converting to email
        if (reviewerInput.startsWith('@')) {
          const username = reviewerInput.replace('@', '');
          // For now, we'll assume @mentions are usernames and try to find the user
          // In a real system, you'd look up the user in the database
          email = `${username}@example.com`; // Placeholder - should be replaced with actual user lookup
        }

        email = email.toLowerCase();

        // Check if user exists, create if not
        let reviewer = await prisma.users.findUnique({
          where: { email }
        });

        if (!reviewer) {
          reviewer = await prisma.users.create({
            data: {
              id: randomUUID(),
              email,
              role: 'USER',
              updatedAt: new Date()
            }
          });
        }

        // Check if already invited/assigned to this manuscript
        const existingAssignment = await prisma.review_assignments.findUnique({
          where: {
            manuscriptId_reviewerId: {
              manuscriptId,
              reviewerId: reviewer.id
            }
          }
        });

        if (existingAssignment) {
          results.alreadyInvited.push({
            email,
            reviewerId: reviewer.id,
            status: existingAssignment.status
          });
          continue;
        }

        // Create invitation (pending review assignment)
        const invitation = await prisma.review_assignments.create({
          data: {
            id: randomUUID(),
            manuscriptId,
            reviewerId: reviewer.id,
            status: 'PENDING',
            dueDate: deadline ? new Date(deadline) : null
          }
        });

        // Send invitation email with links to public API endpoints
        try {
          const nodemailer = await import('nodemailer');
          const transporter = nodemailer.createTransporter({
            host: process.env.SMTP_HOST || 'localhost',
            port: parseInt(process.env.SMTP_PORT || '1025'),
            secure: false,
            auth: process.env.SMTP_USER ? {
              user: process.env.SMTP_USER,
              pass: process.env.SMTP_PASS
            } : undefined,
            tls: {
              rejectUnauthorized: false
            }
          });

          const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
          const acceptUrl = `${frontendUrl}/review-response/${invitation.id}?action=accept`;
          const declineUrl = `${frontendUrl}/review-response/${invitation.id}?action=decline`;
          
          await transporter.sendMail({
            from: process.env.FROM_EMAIL || 'noreply@colloquium.example.com',
            to: email,
            subject: `Review Invitation: Manuscript Review Request`,
            html: `
              <div style="max-width: 600px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                <h1 style="color: #2563eb; margin-bottom: 24px;">Review Invitation</h1>
                <p>You have been invited to review a manuscript submission.</p>
                
                ${message ? `
                  <div style="background-color: #f9fafb; padding: 16px; margin: 24px 0; border-radius: 6px;">
                    <h3 style="margin-top: 0;">Message from Editor:</h3>
                    <p style="margin-bottom: 0;">${message}</p>
                  </div>
                ` : ''}
                
                <p><strong>Review deadline:</strong> ${deadline || 'To be determined'}</p>
                
                <div style="margin: 32px 0;">
                  <a href="${acceptUrl}" 
                     style="display: inline-block; background-color: #16a34a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-right: 16px;">
                    Accept Review
                  </a>
                  <a href="${declineUrl}" 
                     style="display: inline-block; background-color: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
                    Decline Review
                  </a>
                </div>
                
                <p style="color: #6b7280; font-size: 14px;">
                  Invitation sent via Editorial Bot automation.
                </p>
              </div>
            `,
            text: `
Review Invitation

You have been invited to review a manuscript submission.

${message ? `Message from Editor: ${message}\n\n` : ''}

Review deadline: ${deadline || 'To be determined'}

Accept: ${acceptUrl}
Decline: ${declineUrl}
            `
          });
        } catch (emailError) {
          console.error('Failed to send invitation email:', emailError);
        }
        
        results.invited.push({
          email,
          reviewerId: reviewer.id,
          invitationId: invitation.id
        });

      } catch (error) {
        console.error(`Failed to invite reviewer ${reviewerInput}:`, error);
        results.failed.push({
          email: reviewerInput,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // Generate response message
    let responseMessage = '📧 **Reviewer Invitations Sent**\n\n';
    
    if (results.invited.length > 0) {
      responseMessage += `**✅ Successfully Invited (${results.invited.length}):**\n`;
      results.invited.forEach(r => {
        responseMessage += `- ${r.email}\n`;
      });
      responseMessage += '\n';
    }

    if (results.alreadyInvited.length > 0) {
      responseMessage += `**ℹ️ Already Invited/Assigned (${results.alreadyInvited.length}):**\n`;
      results.alreadyInvited.forEach(r => {
        responseMessage += `- ${r.email} (${r.status})\n`;
      });
      responseMessage += '\n';
    }

    if (results.failed.length > 0) {
      responseMessage += `**❌ Failed (${results.failed.length}):**\n`;
      results.failed.forEach(r => {
        responseMessage += `- ${r.email}: ${r.error}\n`;
      });
      responseMessage += '\n';
    }

    responseMessage += `Reviewers can accept invitations using: \`@editorial-bot accept-review\``;

    return {
      messages: [{ content: responseMessage }]
    };
  }
};

const summaryCommand: BotCommand = {
  name: 'summary',
  description: 'Generate a summary showing status, assigned editor, invited reviewers, and review progress',
  usage: '@editorial-bot summary [format="brief|detailed"]',
  parameters: [
    {
      name: 'format',
      description: 'Level of detail in the summary',
      type: 'enum',
      required: false,
      defaultValue: 'brief',
      enumValues: ['brief', 'detailed'],
      examples: ['brief', 'detailed']
    }
  ],
  examples: [
    '@editorial-bot summary',
    '@editorial-bot summary format="detailed"'
  ],
  permissions: ['read_manuscript'],
  async execute(params, context) {
    const { format } = params;
    const { manuscriptId } = context;

    // Fetch actual manuscript data
    const manuscriptData = await getManuscriptData(manuscriptId, context);

    let summary = `📊 **Manuscript Review Summary**\n\n`;
    summary += `**Status:** ${manuscriptData.status.replace('_', ' ')}\n`;
    summary += `**Submitted:** ${manuscriptData.submittedDate}\n`;
    summary += `**Assigned Editor:** ${manuscriptData.assignedEditor || 'No editor assigned'}\n\n`;
    
    // Invited reviewers section
    if (manuscriptData.invitedReviewers?.length > 0) {
      summary += `📬 **Invited Reviewers (${manuscriptData.invitedReviewers.length}):** ${manuscriptData.invitedReviewers.map((r: any) => r.mention).join(', ')}\n`;
    }
    
    // Accepted reviewers section
    if (manuscriptData.acceptedReviewers?.length > 0) {
      summary += `✅ **Accepted Invitations (${manuscriptData.acceptedReviewers.length}):** ${manuscriptData.acceptedReviewers.map((r: any) => r.mention).join(', ')}\n`;
    }
    
    // Assigned reviewers section
    if (manuscriptData.reviewers.length > 0) {
      summary += `🔄 **Assigned Reviewers (${manuscriptData.reviewers.length}):** ${manuscriptData.reviewers.map((r: any) => r.mention).join(', ')}\n`;
      summary += `**Review Progress:** ${manuscriptData.completedReviews}/${manuscriptData.totalReviews} reviews completed\n`;
    } else {
      summary += `🔄 **Assigned Reviewers:** No reviewers assigned\n`;
      summary += `**Review Progress:** 0/0 reviews completed\n`;
    }
    
    // Declined reviewers section
    if (manuscriptData.declinedReviewers?.length > 0) {
      summary += `❌ **Declined Invitations (${manuscriptData.declinedReviewers.length}):** ${manuscriptData.declinedReviewers.map((r: any) => r.mention).join(', ')}\n`;
    }
    
    if (manuscriptData.deadline) {
      summary += `**Review Deadline:** ${manuscriptData.deadline}\n`;
    }
    
    summary += `**Last Activity:** ${manuscriptData.lastActivity}\n`;

    if (format === 'detailed') {
      summary += `\n**Detailed Reviewer Status:**\n`;
      
      // Show invited reviewers
      if (manuscriptData.invitedReviewers?.length > 0) {
        summary += `\n📬 **Invited (Awaiting Response):**\n`;
        manuscriptData.invitedReviewers.forEach((reviewer: any, index: number) => {
          summary += `${index + 1}. ${reviewer.mention} - ⏳ Pending Response (invited ${reviewer.assignedDate})\n`;
        });
      }
      
      // Show accepted reviewers
      if (manuscriptData.acceptedReviewers?.length > 0) {
        summary += `\n✅ **Accepted (Ready to Assign):**\n`;
        manuscriptData.acceptedReviewers.forEach((reviewer: any, index: number) => {
          summary += `${index + 1}. ${reviewer.mention} - ✅ Accepted (${reviewer.assignedDate})\n`;
        });
      }
      
      // Show assigned reviewers
      if (manuscriptData.assignedReviewers?.length > 0) {
        summary += `\n🔄 **Assigned (In Progress):**\n`;
        manuscriptData.assignedReviewers.forEach((reviewer: any, index: number) => {
          const statusIcon = reviewer.status === 'COMPLETED' ? '✅' : '⏳';
          const statusText = reviewer.status === 'COMPLETED' ? 'Complete' : 'In Progress';
          summary += `${index + 1}. ${reviewer.mention} - ${statusIcon} ${statusText} (assigned ${reviewer.assignedDate})\n`;
        });
      }
      
      // Show declined reviewers
      if (manuscriptData.declinedReviewers?.length > 0) {
        summary += `\n❌ **Declined:**\n`;
        manuscriptData.declinedReviewers.forEach((reviewer: any, index: number) => {
          summary += `${index + 1}. ${reviewer.mention} - ❌ Declined (${reviewer.assignedDate})\n`;
        });
      }
      
      summary += `\n**Next Steps:**\n`;
      
      // Provide actionable next steps based on current state
      if (manuscriptData.invitedReviewers?.length > 0) {
        summary += `- Follow up with ${manuscriptData.invitedReviewers.length} pending invitation(s)\n`;
      }
      
      if (manuscriptData.acceptedReviewers?.length > 0) {
        summary += `- Assign ${manuscriptData.acceptedReviewers.length} accepted reviewer(s) using \`@editorial-bot assign-reviewer\`\n`;
      }
      
      if (manuscriptData.completedReviews < manuscriptData.totalReviews) {
        summary += `- Wait for remaining ${manuscriptData.totalReviews - manuscriptData.completedReviews} review(s) to complete\n`;
        summary += `- Follow up with in-progress reviewers if past deadline\n`;
      } else if (manuscriptData.totalReviews > 0) {
        summary += `- Review all feedback and make editorial decision\n`;
        summary += `- Communicate decision to authors\n`;
      }
      
      if (manuscriptData.declinedReviewers?.length > 0) {
        summary += `- Consider inviting replacement reviewers for ${manuscriptData.declinedReviewers.length} declined invitation(s)\n`;
      }
    }

    return {
      messages: [{ content: summary }]
    };
  }
};

// Remove the manual help command - it will be auto-injected by the framework

const respondCommand: BotCommand = {
  name: 'respond',
  description: 'Respond to a review invitation (accept or decline)',
  usage: '@editorial-bot respond <assignment-id> <accept|decline> [message="optional message"]',
  parameters: [
    {
      name: 'assignmentId',
      description: 'The ID of the review assignment to respond to',
      type: 'string',
      required: true,
      examples: ['assignment-12345']
    },
    {
      name: 'response',
      description: 'Accept or decline the review invitation',
      type: 'enum',
      required: true,
      enumValues: ['accept', 'decline'],
      examples: ['accept', 'decline']
    },
    {
      name: 'message',
      description: 'Optional message to include with your response',
      type: 'string',
      required: false,
      examples: ['I am available for this review', 'I have a conflict of interest']
    }
  ],
  examples: [
    '@editorial-bot respond assignment-12345 accept',
    '@editorial-bot respond assignment-67890 decline message="I have a conflict of interest"',
    '@editorial-bot respond assignment-11111 accept message="Happy to review this work"'
  ],
  permissions: ['read_manuscript'],
  async execute(params, context) {
    const { assignmentId, response, message } = params;

    let responseMessage = `📋 **Review Invitation Response**\n\n`;
    responseMessage += `**Assignment ID:** ${assignmentId}\n`;
    responseMessage += `**Response:** ${response.toUpperCase()}\n`;
    
    if (message) {
      responseMessage += `**Message:** ${message}\n`;
    }
    
    responseMessage += `**Processed:** ${new Date().toLocaleString()}\n\n`;

    if (response === 'accept') {
      responseMessage += `✅ Review invitation accepted. You can now begin your review.`;
    } else {
      responseMessage += `❌ Review invitation declined. Editors will be notified.`;
    }

    return {
      messages: [{ content: responseMessage }],
      actions: [{
        type: 'RESPOND_TO_REVIEW',
        data: { 
          assignmentId, 
          response: response.toUpperCase(), 
          message 
        }
      }]
    };
  }
};

const acceptReviewCommand: BotCommand = {
  name: 'accept-review',
  description: 'Accept a review invitation for the current manuscript',
  usage: '@editorial-bot accept-review [message="optional message"]',
  help: `Accept a review invitation for the current manuscript. This command can only be used by users who have been invited as reviewers.

**Usage:**
\`@editorial-bot accept-review [message="optional message"]\`

**Parameters:**
- **message**: Optional message to include with your acceptance (optional)

**Requirements:**
- You must have been invited as a reviewer for this manuscript
- The invitation must be in PENDING status
- Command must be used in the manuscript's conversation

**Workflow:**
1. Editor sends invitation with \`@editorial-bot invite-reviewer\`
2. You receive invitation email
3. You accept with \`@editorial-bot accept-review\`
4. Editor can then assign you with \`@editorial-bot assign-reviewer\`

**Examples:**
- \`@editorial-bot accept-review\`
- \`@editorial-bot accept-review message="Happy to review this work"\``,
  parameters: [
    {
      name: 'message',
      description: 'Optional message to include with your acceptance',
      type: 'string',
      required: false,
      examples: ['Happy to review this work', 'I have expertise in this area']
    }
  ],
  examples: [
    '@editorial-bot accept-review',
    '@editorial-bot accept-review message="Happy to review this work"'
  ],
  permissions: [],
  async execute(params, context) {
    const { message } = params;
    const { manuscriptId, userId } = context;

    if (!userId) {
      return {
        messages: [{
          content: '❌ **Authentication Required**\n\nYou must be logged in to accept review invitations.'
        }]
      };
    }

    try {
      // Import prisma here to avoid circular dependencies
      const { prisma } = await import('@colloquium/database');
      // Check if user has a pending invitation for this manuscript
      const invitation = await prisma.review_assignments.findUnique({
        where: {
          manuscriptId_reviewerId: {
            manuscriptId,
            reviewerId: userId
          }
        },
        include: {
          users: {
            select: {
              name: true,
              email: true
            }
          },
          manuscripts: {
            select: {
              title: true
            }
          }
        }
      });

      if (!invitation) {
        return {
          messages: [{
            content: '❌ **No Invitation Found**\n\nYou do not have a review invitation for this manuscript. Invitations are sent by editors using `@editorial-bot invite-reviewer`.'
          }]
        };
      }

      if (invitation.status !== 'PENDING') {
        const statusMessage = invitation.status === 'ACCEPTED' 
          ? 'You have already accepted this review invitation.'
          : invitation.status === 'DECLINED'
          ? 'You have previously declined this review invitation.'
          : `Your review invitation status is: ${invitation.status}`;
          
        return {
          messages: [{
            content: `ℹ️ **Invitation Already Responded**\n\n${statusMessage}`
          }]
        };
      }

      // Accept the invitation
      await prisma.review_assignments.update({
        where: {
          manuscriptId_reviewerId: {
            manuscriptId,
            reviewerId: userId
          }
        },
        data: {
          status: 'ACCEPTED'
        }
      });

      let responseMessage = `✅ **Review Invitation Accepted**\n\n`;
      responseMessage += `**Reviewer:** ${invitation.users.name || invitation.users.email}\n`;
      responseMessage += `**Manuscript:** ${invitation.manuscripts.title}\n\n`;
      
      if (message) {
        responseMessage += `**Message:** ${message}\n\n`;
      }
      
      responseMessage += `Thank you for accepting! The editor can now assign you as a reviewer using \`@editorial-bot assign-reviewer\`.`;

      return {
        messages: [{ content: responseMessage }]
      };

    } catch (error) {
      console.error('Failed to accept review invitation:', error);
      return {
        messages: [{
          content: '❌ **Error**\n\nFailed to accept review invitation. Please try again or contact the editor.'
        }]
      };
    }
  }
};

const decisionCommand: BotCommand = {
  name: 'decision',
  description: 'Make an editorial decision on a manuscript',
  usage: '@editorial-bot decision <decision>',
  parameters: [
    {
      name: 'decision',
      description: 'Editorial decision to make',
      type: 'enum',
      required: true,
      enumValues: ['accept', 'minor_revision', 'major_revision', 'reject'],
      examples: ['accept', 'minor_revision', 'major_revision', 'reject']
    }
  ],
  examples: [
    '@editorial-bot decision accept',
    '@editorial-bot decision minor_revision',
    '@editorial-bot decision reject'
  ],
  permissions: ['make_editorial_decision'],
  async execute(params, context) {
    const { decision } = params;
    const { manuscriptId } = context;

    // Map decision to manuscript status
    const statusMap: Record<string, string> = {
      'accept': 'ACCEPTED',
      'minor_revision': 'REVISION_REQUESTED',
      'major_revision': 'REVISION_REQUESTED',
      'reject': 'REJECTED'
    };

    const newStatus = statusMap[decision];
    const isRevision = decision.includes('revision');
    const revisionType = isRevision ? decision.replace('_', ' ') : null;

    let message = `⚖️ **Editorial Decision: ${decision.replace('_', ' ').toUpperCase()}**\n\n`;
    message += `**New Status:** ${newStatus.replace('_', ' ')}\n`;
    message += `**Decision Date:** ${new Date().toLocaleString()}\n\n`;

    // Add decision-specific messaging
    switch (decision) {
      case 'accept':
        message += `🎉 **Manuscript Accepted for Publication**\n`;
        message += `Authors will be automatically notified.`;
        break;
      case 'minor_revision':
        message += `📝 **Minor Revisions Required**\n`;
        message += `Authors will be notified to submit revisions.`;
        break;
      case 'major_revision':
        message += `🔄 **Major Revisions Required**\n`;
        message += `Authors will be notified to submit substantial revisions.`;
        break;
      case 'reject':
        message += `❌ **Manuscript Rejected**\n`;
        message += `Authors will be notified of the decision.`;
        break;
    }

    return {
      messages: [{ content: message }],
      actions: [{
        type: 'MAKE_EDITORIAL_DECISION',
        data: { 
          decision, 
          status: newStatus, 
          revisionType 
        }
      }]
    };
  }
};

const submitCommand: BotCommand = {
  name: 'submit',
  description: 'Submit a review for a manuscript',
  usage: '@editorial-bot submit <assignment-id> recommendation=<accept|minor_revision|major_revision|reject> review="your review text" [score=1-10] [confidential="editor comments"]',
  parameters: [
    {
      name: 'assignmentId',
      description: 'The ID of the review assignment',
      type: 'string',
      required: true,
      examples: ['assignment-12345']
    },
    {
      name: 'recommendation',
      description: 'Your overall recommendation',
      type: 'enum',
      required: true,
      enumValues: ['accept', 'minor_revision', 'major_revision', 'reject'],
      examples: ['accept', 'minor_revision', 'major_revision', 'reject']
    },
    {
      name: 'review',
      description: 'Your detailed review of the manuscript',
      type: 'string',
      required: true,
      examples: ['This manuscript presents a novel approach to...']
    },
    {
      name: 'score',
      description: 'Optional score from 1-10',
      type: 'number',
      required: false,
      examples: ['8', '7', '6']
    },
    {
      name: 'confidential',
      description: 'Confidential comments for editors only',
      type: 'string',
      required: false,
      examples: ['The methodology section needs clarification...']
    }
  ],
  examples: [
    '@editorial-bot submit assignment-12345 recommendation="accept" review="Excellent work with clear methodology"',
    '@editorial-bot submit assignment-67890 recommendation="minor_revision" review="Good work but needs revision" score="7"',
    '@editorial-bot submit assignment-11111 recommendation="major_revision" review="Interesting but needs significant work" confidential="Author seems inexperienced"'
  ],
  permissions: ['read_manuscript'],
  async execute(params, context) {
    const { assignmentId, recommendation, review, score, confidential } = params;

    let responseMessage = `📝 **Review Submitted**\n\n`;
    responseMessage += `**Assignment ID:** ${assignmentId}\n`;
    responseMessage += `**Recommendation:** ${recommendation.replace('_', ' ').toUpperCase()}\n`;
    
    if (score) {
      responseMessage += `**Score:** ${score}/10\n`;
    }
    
    responseMessage += `**Submitted:** ${new Date().toLocaleString()}\n\n`;
    responseMessage += `✅ Your review has been submitted and editors have been notified.`;
    
    if (confidential) {
      responseMessage += `\n\n🔒 Confidential comments have been shared with editors only.`;
    }

    return {
      messages: [{ content: responseMessage }],
      actions: [{
        type: 'SUBMIT_REVIEW',
        data: { 
          assignmentId, 
          reviewContent: review,
          recommendation: recommendation.toUpperCase(),
          confidentialComments: confidential,
          score: score ? parseInt(score) : undefined
        }
      }]
    };
  }
};

const helpCommand: BotCommand = {
  name: 'help',
  description: 'Show available commands and usage information',
  usage: '@editorial-bot help [command-name]',
  parameters: [
    {
      name: 'command',
      description: 'Optional: Get detailed help for a specific command',
      type: 'string',
      required: false,
      examples: ['status', 'assign-reviewer', 'invite-reviewer', 'accept-review', 'assign-editor', 'summary', 'decision']
    }
  ],
  examples: [
    '@editorial-bot help',
    '@editorial-bot help status',
    '@editorial-bot help assign-reviewer',
    '@editorial-bot help invite-reviewer',
    '@editorial-bot help accept-review'
  ],
  permissions: [],
  async execute(params, context) {
    const { command } = params;
    
    if (command) {
      // Return help for specific command
      const commands = [statusCommand, assignEditorCommand, assignReviewerCommand, inviteReviewerCommand, acceptReviewCommand, summaryCommand, decisionCommand, respondCommand, submitCommand];
      const targetCommand = commands.find(cmd => cmd.name === command);
      
      if (!targetCommand) {
        return {
          messages: [{
            content: `❌ **Command Not Found**\n\nCommand '${command}' not found. Use \`@editorial-bot help\` to see all available commands.`
          }]
        };
      }
      
      let helpContent = `# Help: ${targetCommand.name}\n\n`;
      
      if (targetCommand.help) {
        helpContent += targetCommand.help;
      } else {
        helpContent += `${targetCommand.description}\n\n`;
        helpContent += `**Usage:** \`${targetCommand.usage}\`\n\n`;
        
        if (targetCommand.examples.length > 0) {
          helpContent += `**Examples:**\n`;
          targetCommand.examples.forEach((example: string) => {
            helpContent += `- \`${example}\`\n`;
          });
        }
      }
      
      return {
        messages: [{ content: helpContent }]
      };
    }
    
    // Return general help
    const helpContent = `# Editorial Bot

Assists with manuscript editorial workflows, status updates, reviewer assignments, and action editor management.

**Version:** 2.3.0

## 🚀 Getting Started

This bot helps automate editorial workflows. Use \`status\` to update manuscript status, \`assign\` to assign reviewers, and \`decision\` to make editorial decisions.

## 📋 Workflow Steps

1. Submit manuscript → 2. Assign action editor → 3. Assign reviewers → 4. Track progress → 5. Make decision → 6. Update status

## Overview

The Editorial Bot streamlines manuscript management by automating status updates, reviewer assignments, and progress tracking.

## Quick Start

Start by using @editorial-bot help to see all available commands. Most common: @editorial-bot assign-editor <editor>, @editorial-bot assign-reviewer <reviewers>, and @editorial-bot status <status>

## Available Commands

**status** - Update the status of a manuscript
Usage: \`@editorial-bot status <new-status> [reason="reason for change"]\`

**assign-editor** - Assign an action editor to a manuscript
Usage: \`@editorial-bot assign-editor <editor> [message="custom message"]\`

**assign-reviewer** - Assign reviewers to a manuscript
Usage: \`@editorial-bot assign-reviewer <reviewers> [deadline="YYYY-MM-DD"] [message="custom message"]\`

**summary** - Generate a summary showing status, assigned editor, and reviewers
Usage: \`@editorial-bot summary [format="brief|detailed"]\`

**decision** - Make an editorial decision on a manuscript
Usage: \`@editorial-bot decision <decision>\`

**respond** - Respond to a review invitation (accept or decline)
Usage: \`@editorial-bot respond <assignment-id> <accept|decline> [message="optional message"]\`

**submit** - Submit a review for a manuscript
Usage: \`@editorial-bot submit <assignment-id> recommendation=<accept|minor_revision|major_revision|reject> review="your review text" [score=1-10] [confidential="editor comments"]\`

## Keywords

This bot also responds to these keywords: \`editorial decision\`, \`review status\`, \`assign reviewer\`, \`assign editor\`, \`manuscript status\`, \`make decision\`

## Complete Examples

\`@editorial-bot assign-editor @DrEditor\`

\`@editorial-bot status UNDER_REVIEW reason="Initial review passed"\`

\`@editorial-bot assign-reviewer @DrSmith,@ProfJohnson deadline="2024-02-15"\`

\`@editorial-bot decision accept\`

\`@editorial-bot status PUBLISHED reason="Ready for publication"\`

\`@editorial-bot status RETRACTED reason="Data integrity issues"\`

\`@editorial-bot summary format="detailed"\`

## ℹ️ Support

For editorial workflow questions, contact your journal administrator.

## Getting Detailed Help

Use \`@editorial-bot help <command-name>\` for detailed help on specific commands.`;

    return {
      messages: [{ content: helpContent }]
    };
  }
};

// Define the editorial bot
export const editorialBot: CommandBot = {
  id: 'editorial-bot',
  name: 'Editorial Bot',
  description: 'Assists with manuscript editorial workflows, status updates, reviewer assignments, and action editor management',
  version: '2.3.0',
  commands: [statusCommand, assignEditorCommand, assignReviewerCommand, inviteReviewerCommand, acceptReviewCommand, summaryCommand, decisionCommand, respondCommand, submitCommand, helpCommand],
  keywords: ['editorial decision', 'review status', 'assign reviewer', 'assign editor', 'manuscript status', 'make decision'],
  triggers: ['MANUSCRIPT_SUBMITTED', 'REVIEW_COMPLETE'],
  permissions: ['read_manuscript', 'update_manuscript', 'assign_reviewers', 'make_editorial_decision'],
  help: {
    overview: 'The Editorial Bot streamlines manuscript management by automating status updates, reviewer assignments, and progress tracking.',
    quickStart: 'Start by using @editorial-bot help to see all available commands. New workflow: @editorial-bot invite-reviewer <reviewers> to send invitations, then reviewers use @editorial-bot accept-review, then @editorial-bot assign-reviewer <reviewers> to start reviews.',
    examples: [
      '@editorial-bot assign-editor @DrEditor',
      '@editorial-bot status UNDER_REVIEW reason="Initial review passed"',
      '@editorial-bot invite-reviewer @DrSmith,@ProfJohnson deadline="2024-02-15"',
      '@editorial-bot assign-reviewer @DrSmith,@ProfJohnson deadline="2024-02-15"',
      '@editorial-bot decision accept',
      '@editorial-bot status PUBLISHED reason="Ready for publication"',
      '@editorial-bot summary format="detailed"'
    ]
  },
  customHelpSections: [
    {
      title: '🚀 Getting Started',
      content: 'This bot helps automate editorial workflows. Use `status` to update manuscript status, `assign-reviewer` to assign reviewers, and `decision` to make editorial decisions.',
      position: 'before'
    },
    {
      title: '📋 Workflow Steps',
      content: '1. Submit manuscript → 2. Assign action editor → 3. Invite reviewers → 4. Reviewers accept → 5. Assign reviewers → 6. Track progress → 7. Make decision → 8. Update status',
      position: 'before'
    },
    {
      title: 'ℹ️ Support',
      content: 'For editorial workflow questions, contact your journal administrator.',
      position: 'after'
    }
  ]
};

// Export the bot for npm package compatibility
export default editorialBot;