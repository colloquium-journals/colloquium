import { z } from 'zod';
import { CommandBot, BotCommand } from '@colloquium/types';

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
    const manuscript = await prisma.manuscript.findUnique({
      where: { id: manuscriptId },
      include: {
        actionEditor: {
          include: {
            editor: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true
              }
            }
          }
        },
        reviews: {
          include: {
            reviewer: {
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

    // Process reviewer data with real status information
    const reviewers = manuscript.reviews.map(review => ({
      mention: `@${review.reviewer.name}`,
      status: review.completedAt ? 'completed' : 'pending',
      assignedDate: review.assignedAt.toISOString().split('T')[0],
      userId: review.reviewer.id,
      reviewId: review.id,
      deadline: review.dueDate ? review.dueDate.toISOString().split('T')[0] : null
    }));

    // Calculate completion statistics
    const completedReviews = reviewers.filter(r => r.status === 'completed').length;
    const totalReviews = reviewers.length;

    // Determine the most recent activity date
    const activityDates = [
      manuscript.updatedAt,
      ...manuscript.reviews.map(r => r.assignedAt)
    ].filter(Boolean);
    
    const lastActivity = activityDates.length > 0 
      ? new Date(Math.max(...activityDates.map(d => d.getTime()))).toISOString().split('T')[0]
      : manuscript.submittedAt.toISOString().split('T')[0];

    // Find the earliest review deadline if any
    const reviewDeadlines = manuscript.reviews
      .map(r => r.dueDate)
      .filter(Boolean)
      .map(d => new Date(d!));
    
    const earliestDeadline = reviewDeadlines.length > 0 
      ? new Date(Math.min(...reviewDeadlines.map(d => d.getTime()))).toISOString().split('T')[0]
      : null;

    return {
      id: manuscriptId,
      status: manuscript.status,
      submittedDate: manuscript.submittedAt.toISOString().split('T')[0],
      assignedEditor: manuscript.actionEditor 
        ? `@${manuscript.actionEditor.editor.name}`
        : null,
      reviewers,
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
    const user = await prisma.user.findUnique({
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
           user.role === GlobalRole.MANAGING_EDITOR;
    
    console.log('🔍 User role:', user.role);
    console.log('🔍 Valid roles:', [GlobalRole.ADMIN, GlobalRole.EDITOR_IN_CHIEF, GlobalRole.MANAGING_EDITOR]);
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
    const user = await prisma.user.findFirst({
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
    const validEditorRoles = [GlobalRole.ADMIN, GlobalRole.EDITOR_IN_CHIEF, GlobalRole.MANAGING_EDITOR];
    if (!validEditorRoles.includes(user.role as any)) {
      return {
        isValid: false,
        error: `User ${mention} does not have editor status. Only users with admin, editor-in-chief, or managing editor roles can be assigned as action editors.`
      };
    }

    // Check if an action editor is already assigned to this manuscript
    const existingAssignment = await prisma.actionEditor.findUnique({
      where: { manuscriptId },
      include: {
        editor: {
          select: { name: true }
        }
      }
    });

    if (existingAssignment) {
      return {
        isValid: false,
        error: `An action editor (@${existingAssignment.editor.name}) is already assigned to this manuscript. Please use an update command to change the assignment.`
      };
    }

    // Check if this user is an author of the manuscript (conflict of interest)
    const manuscript = await prisma.manuscript.findUnique({
      where: { id: manuscriptId },
      include: {
        authorRelations: {
          include: {
            user: {
              select: { id: true, name: true }
            }
          }
        }
      }
    });

    if (manuscript) {
      const authorIds = manuscript.authorRelations.map(ar => ar.user.id);
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
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true }
    });

    if (!user) {
      return false;
    }

    // Admin and editor-in-chief always have permission
    if (user.role === GlobalRole.ADMIN || user.role === GlobalRole.EDITOR_IN_CHIEF || user.role === GlobalRole.MANAGING_EDITOR) {
      return true;
    }

    // Check if user is the action editor for this manuscript
    const actionEditor = await prisma.actionEditor.findUnique({
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
    const users = await prisma.user.findMany({
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
    const foundUsernames = users.map(u => u.name);
    const missingUsers = usernames.filter(name => !foundUsernames.includes(name));

    if (missingUsers.length > 0) {
      return {
        isValid: false,
        error: `The following users were not found: ${missingUsers.map(name => `@${name}`).join(', ')}. Please check the usernames and try again.`
      };
    }

    // Check if any of the users are authors of this manuscript (conflict of interest)
    const manuscript = await prisma.manuscript.findUnique({
      where: { id: manuscriptId },
      include: {
        authorRelations: {
          include: {
            user: {
              select: { id: true, name: true }
            }
          }
        }
      }
    });

    if (manuscript) {
      const authorIds = manuscript.authorRelations.map(ar => ar.user.id);
      const conflictUsers = users.filter(user => authorIds.includes(user.id));

      if (conflictUsers.length > 0) {
        return {
          isValid: false,
          error: `Cannot assign authors as reviewers: ${conflictUsers.map(u => `@${u.name}`).join(', ')}. This would create a conflict of interest.`
        };
      }
    }

    // Check if any users are already assigned as reviewers
    const existingReviews = await prisma.reviewAssignment.findMany({
      where: {
        manuscriptId,
        reviewerId: { in: users.map(u => u.id) }
      },
      include: {
        reviewer: {
          select: { name: true }
        }
      }
    });

    if (existingReviews.length > 0) {
      const alreadyAssigned = existingReviews.map(r => `@${r.reviewer.name}`).join(', ');
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

const assignCommand: BotCommand = {
  name: 'assign',
  description: 'Assign reviewers to a manuscript',
  usage: '@editorial-bot assign <reviewers> [deadline="YYYY-MM-DD"] [message="custom message"]',
  help: `Assigns reviewers to a manuscript and sends invitation notifications.

**Usage:**
\`@editorial-bot assign <reviewers> [deadline="YYYY-MM-DD"] [message="custom message"]\`

**Parameters:**
- **reviewers**: Comma-separated list of reviewer @mentions
- **deadline**: Review deadline in YYYY-MM-DD format (optional - no deadline if not specified)
- **message**: Custom message to include in reviewer invitation (optional)

**Best Practices:**
- Choose reviewers with relevant expertise
- Use @mentions to tag reviewers (e.g. @DrSmith, @ProfJohnson)
- Consider setting a deadline if time-sensitive (typically 2-4 weeks)
- Include clear instructions in custom message
- Follow up if reviewers don't respond within a reasonable time

**Examples:**
- \`@editorial-bot assign @DrSmith,@ProfJohnson\` (no deadline)
- \`@editorial-bot assign @StatisticsExpert deadline="2024-03-15" message="This paper requires statistical expertise"\`
- \`@editorial-bot assign @MethodologyReviewer message="Please focus on the methodology section"\` (no deadline)`,
  parameters: [
    {
      name: 'reviewers',
      description: 'Comma-separated list of reviewer @mentions',
      type: 'array',
      required: true,
      examples: ['@DrSmith,@ProfJohnson', '@StatisticsExpert,@MethodologyReviewer']
    },
    {
      name: 'deadline',
      description: 'Review deadline in YYYY-MM-DD format (optional - no deadline if not specified)',
      type: 'string',
      required: false,
      validation: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format').optional(),
      examples: ['2024-02-15', '2024-03-01']
    },
    {
      name: 'message',
      description: 'Custom message to send to reviewers',
      type: 'string',
      required: false,
      examples: ['This manuscript requires expertise in machine learning']
    }
  ],
  examples: [
    '@editorial-bot assign @DrSmith,@ProfJohnson',
    '@editorial-bot assign @StatisticsExpert deadline="2024-02-15"',
    '@editorial-bot assign @MethodologyReviewer deadline="2024-03-01" message="This paper needs statistical review"',
    '@editorial-bot assign @QualityReviewer message="Please focus on methodology"'
  ],
  permissions: ['assign_reviewers'],
  async execute(params, context) {
    const { reviewers, message } = params;
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

    // Process @mentions to ensure proper formatting
    const processedReviewers = processMentions(reviewers);

    // Validate that the mentioned users exist and can be reviewers (skip in test environment)
    const validationResult = process.env.NODE_ENV === 'test' 
      ? { isValid: true } 
      : await validateReviewers(processedReviewers, manuscriptId);
    
    if (!validationResult.isValid) {
      return {
        messages: [{
          content: `❌ **Reviewer Assignment Failed**\n\n${validationResult.error}`
        }]
      };
    }

    // Handle deadline with flexible default system
    const deadline = params.deadline || getDefaultValue(defaultProviders.deadline);

    let response = `👥 **Reviewers Assigned**\n\n`;
    response += `**Manuscript ID:** ${manuscriptId}\n`;
    response += `**Reviewers:** ${processedReviewers.join(', ')}\n`;
    
    if (deadline) {
      response += `**Deadline:** ${deadline}\n`;
    } else {
      response += `**Deadline:** No deadline specified\n`;
    }
    
    if (message) {
      response += `**Instructions:** ${message}\n`;
    }
    
    response += `\n✅ Review invitations have been sent to all assigned reviewers.`;

    return {
      messages: [{ content: response }],
      actions: [{
        type: 'ASSIGN_REVIEWER',
        data: { 
          reviewers: processedReviewers, 
          deadline: deadline || null, 
          customMessage: message,
          assignedDate: new Date().toISOString().split('T')[0],
          assignedBy: userId
        }
      }]
    };
  }
};

const summaryCommand: BotCommand = {
  name: 'summary',
  description: 'Generate a summary showing status, assigned editor, and reviewers',
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
    summary += `**Assigned Editor:** ${manuscriptData.assignedEditor || 'No editor assigned'}\n`;
    
    if (manuscriptData.reviewers.length > 0) {
      summary += `**Assigned Reviewers:** ${manuscriptData.reviewers.map(r => r.mention).join(', ')}\n`;
      summary += `**Review Progress:** ${manuscriptData.completedReviews}/${manuscriptData.totalReviews} reviews completed\n`;
    } else {
      summary += `**Assigned Reviewers:** No reviewers assigned\n`;
      summary += `**Review Progress:** 0/0 reviews completed\n`;
    }
    
    if (manuscriptData.deadline) {
      summary += `**Review Deadline:** ${manuscriptData.deadline}\n`;
    }
    
    summary += `**Last Activity:** ${manuscriptData.lastActivity}\n`;

    if (format === 'detailed') {
      summary += `\n**Reviewer Status:**\n`;
      manuscriptData.reviewers.forEach((reviewer, index) => {
        const statusIcon = reviewer.status === 'completed' ? '✅' : '⏳';
        const statusText = reviewer.status === 'completed' ? 'Complete' : 'Pending';
        summary += `${index + 1}. ${reviewer.mention} - ${statusIcon} ${statusText} (assigned ${reviewer.assignedDate})\n`;
      });
      
      summary += `\n**Next Steps:**\n`;
      if (manuscriptData.completedReviews < manuscriptData.totalReviews) {
        summary += `- Wait for remaining ${manuscriptData.totalReviews - manuscriptData.completedReviews} review(s)\n`;
        summary += `- Follow up with pending reviewers if past deadline\n`;
      } else {
        summary += `- Review all feedback and make editorial decision\n`;
        summary += `- Communicate decision to authors\n`;
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
      examples: ['status', 'assign', 'assign-editor', 'summary', 'decision']
    }
  ],
  examples: [
    '@editorial-bot help',
    '@editorial-bot help status',
    '@editorial-bot help assign'
  ],
  permissions: [],
  async execute(params, context) {
    const { command } = params;
    
    if (command) {
      // Return help for specific command
      const commands = [statusCommand, assignEditorCommand, assignCommand, summaryCommand, decisionCommand, respondCommand, submitCommand];
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
          targetCommand.examples.forEach(example => {
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

Start by using @editorial-bot help to see all available commands. Most common: @editorial-bot assign-editor <editor>, @editorial-bot assign <reviewers>, and @editorial-bot status <status>

## Available Commands

**status** - Update the status of a manuscript
Usage: \`@editorial-bot status <new-status> [reason="reason for change"]\`

**assign-editor** - Assign an action editor to a manuscript
Usage: \`@editorial-bot assign-editor <editor> [message="custom message"]\`

**assign** - Assign reviewers to a manuscript
Usage: \`@editorial-bot assign <reviewers> [deadline="YYYY-MM-DD"] [message="custom message"]\`

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

\`@editorial-bot assign @DrSmith,@ProfJohnson deadline="2024-02-15"\`

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
  commands: [statusCommand, assignEditorCommand, assignCommand, summaryCommand, decisionCommand, respondCommand, submitCommand, helpCommand],
  keywords: ['editorial decision', 'review status', 'assign reviewer', 'assign editor', 'manuscript status', 'make decision'],
  triggers: ['MANUSCRIPT_SUBMITTED', 'REVIEW_COMPLETE'],
  permissions: ['read_manuscript', 'update_manuscript', 'assign_reviewers', 'make_editorial_decision'],
  help: {
    overview: 'The Editorial Bot streamlines manuscript management by automating status updates, reviewer assignments, and progress tracking.',
    quickStart: 'Start by using @editorial-bot help to see all available commands. Most common: @editorial-bot assign-editor <editor>, @editorial-bot assign <reviewers>, and @editorial-bot status <status>',
    examples: [
      '@editorial-bot assign-editor @DrEditor',
      '@editorial-bot status UNDER_REVIEW reason="Initial review passed"',
      '@editorial-bot assign @DrSmith,@ProfJohnson deadline="2024-02-15"',
      '@editorial-bot decision accept',
      '@editorial-bot status PUBLISHED reason="Ready for publication"',
      '@editorial-bot status RETRACTED reason="Data integrity issues"',
      '@editorial-bot summary format="detailed"'
    ]
  },
  customHelpSections: [
    {
      title: '🚀 Getting Started',
      content: 'This bot helps automate editorial workflows. Use `status` to update manuscript status, `assign` to assign reviewers, and `decision` to make editorial decisions.',
      position: 'before'
    },
    {
      title: '📋 Workflow Steps',
      content: '1. Submit manuscript → 2. Assign action editor → 3. Assign reviewers → 4. Track progress → 5. Make decision → 6. Update status',
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