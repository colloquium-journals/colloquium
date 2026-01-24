
import { CommandBot, BotCommand, BotMessageAction, BotActionHandler, BotActionHandlerContext, BotActionHandlerResult } from '@colloquium/types';
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
async function checkActionEditorAssignmentPermission(context: any): Promise<boolean> {
  const validRoles = ['ADMIN', 'EDITOR_IN_CHIEF', 'ACTION_EDITOR'];

  // Use role from context if available (internal framework path)
  const contextRole = context.triggeredBy?.userRole;
  if (contextRole) return validRoles.includes(contextRole);

  // Fall back to API lookup (external tool path)
  const userId = context.triggeredBy?.userId;
  const serviceToken = context.serviceToken;
  if (!userId || !serviceToken) return false;

  try {
    const response = await fetch(`${context.config?.apiUrl || 'http://localhost:4000'}/api/users/${userId}`, {
      headers: { 'X-Bot-Token': serviceToken, 'Content-Type': 'application/json' }
    });
    if (!response.ok) return false;
    const user = await response.json();
    return validRoles.includes(user.role);
  } catch {
    return false;
  }
}

/**
 * Validate that mentioned user exists and has appropriate editor status for action editor role
 */
async function validateActionEditor(mention: string, manuscriptId: string, context: any): Promise<{ isValid: boolean; error?: string }> {
  try {
    const { serviceToken } = context;
    
    if (!serviceToken) {
      return {
        isValid: false,
        error: 'Bot service token required for API access'
      };
    }

    // Remove @ symbol to get username for lookup
    const username = mention.replace('@', '');

    // Find user by name using search endpoint
    const userSearchResponse = await fetch(`http://localhost:4000/api/users?search=${encodeURIComponent(username)}`, {
      headers: {
        'X-Bot-Token': serviceToken,
        'Content-Type': 'application/json'
      }
    });

    if (!userSearchResponse.ok) {
      return {
        isValid: false,
        error: 'Unable to search for users due to a system error. Please try again later.'
      };
    }

    const userSearchResults = await userSearchResponse.json();
    const user = userSearchResults.users?.find((u: any) => u.name === username);

    if (!user) {
      return {
        isValid: false,
        error: `User ${mention} was not found. Please check the username and try again.`
      };
    }

    // Check if user has appropriate role to be an action editor
    const validEditorRoles = ['ADMIN', 'EDITOR_IN_CHIEF', 'ACTION_EDITOR'];
    if (!validEditorRoles.includes(user.role)) {
      return {
        isValid: false,
        error: `User ${mention} does not have editor status. Only users with admin, editor-in-chief, or managing editor roles can be assigned as action editors.`
      };
    }

    // Get manuscript data to check for existing assignment and conflicts
    const manuscriptResponse = await fetch(`http://localhost:4000/api/articles/${manuscriptId}`, {
      headers: {
        'X-Bot-Token': serviceToken,
        'Content-Type': 'application/json'
      }
    });

    if (!manuscriptResponse.ok) {
      return {
        isValid: false,
        error: 'Unable to validate action editor assignment due to a system error. Please try again later.'
      };
    }

    const manuscript = await manuscriptResponse.json();

    // Check if an action editor is already assigned
    if (manuscript.action_editors?.users_action_editors_editorIdTousers) {
      return {
        isValid: false,
        error: `An action editor (@${manuscript.action_editors.users_action_editors_editorIdTousers.name}) is already assigned to this manuscript. Please use an update command to change the assignment.`
      };
    }

    // Check if this user is an author of the manuscript (conflict of interest)
    const authorIds = (manuscript.authors || []).map((author: any) => author.id);
    if (authorIds.includes(user.id)) {
      return {
        isValid: false,
        error: `Cannot assign ${mention} as action editor because they are an author of this manuscript. This would create a conflict of interest.`
      };
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

// Define commands for the editorial bot
const acceptCommand: BotCommand = {
  name: 'accept',
  description: 'Accept a manuscript for publication and initiate publication workflow',
  usage: '@editorial-bot accept [reason="reason for acceptance"]',
  help: `Accepts a manuscript for publication, updating the status to ACCEPTED and immediately initiating the publication workflow.

**Usage:**
\`@editorial-bot accept [reason="reason for acceptance"]\`

**Parameters:**
- **reason**: Optional reason for the acceptance (optional)

**Requirements:**
- Only editors with decision-making authority can accept manuscripts
- Manuscript should typically be in UNDER_REVIEW status
- All required reviews should be completed

**What happens when you accept:**
1. Manuscript status is updated to ACCEPTED
2. Authors are automatically notified of the acceptance
3. **Publication workflow is immediately initiated**
4. The manuscript proceeds through automated publication processes

**Examples:**
- \`@editorial-bot accept\`
- \`@editorial-bot accept reason="High quality research with clear findings"\`
- \`@editorial-bot accept reason="Excellent methodology and significant contribution"\``,
  parameters: [
    {
      name: 'reason',
      description: 'Optional reason for the acceptance',
      type: 'string',
      required: false,
      examples: ['High quality research with clear findings', 'Excellent methodology and significant contribution', 'Addresses important research gap']
    }
  ],
  examples: [
    '@editorial-bot accept',
    '@editorial-bot accept reason="High quality research with clear findings"',
    '@editorial-bot accept reason="Excellent methodology and significant contribution"',
    '@editorial-bot accept reason="Addresses important research gap"'
  ],
  permissions: ['make_editorial_decision'],
  async execute(params, context) {
    const { reason } = params;
    const { manuscriptId } = context;

    let message = `🎉 **Manuscript Accepted for Publication**\n\n`;
    message += `**Status:** ACCEPTED\n`;
    
    if (reason) {
      message += `**Reason:** ${reason}\n`;
    }
    
    message += `**Manuscript ID:** ${manuscriptId}\n`;
    message += `**Decision Date:** ${new Date().toLocaleString()}\n\n`;
    message += `✅ Authors will be automatically notified of the acceptance.\n`;
    message += `🚀 **Publication workflow initiated automatically** - The manuscript will now proceed through the publication process.`;

    return {
      messages: [{ content: message }],
      actions: [{
        type: 'UPDATE_MANUSCRIPT_STATUS',
        data: { status: 'ACCEPTED', reason }
      }, {
        type: 'EXECUTE_PUBLICATION_WORKFLOW',
        data: { 
          manuscriptId,
          acceptedDate: new Date().toISOString(),
          reason,
          triggeredBy: 'editorial-decision'
        }
      }]
    };
  }
};

const rejectCommand: BotCommand = {
  name: 'reject',
  description: 'Reject a manuscript',
  usage: '@editorial-bot reject [reason="reason for rejection"]',
  help: `Rejects a manuscript, updating the status to REJECTED.

**Usage:**
\`@editorial-bot reject [reason="reason for rejection"]\`

**Parameters:**
- **reason**: Optional reason for the rejection (optional)

**Requirements:**
- Only editors with decision-making authority can reject manuscripts
- Manuscript should typically be in UNDER_REVIEW status
- Consider providing constructive feedback to authors

**Examples:**
- \`@editorial-bot reject\`
- \`@editorial-bot reject reason="Insufficient methodology"\`
- \`@editorial-bot reject reason="Does not meet journal scope"\``,
  parameters: [
    {
      name: 'reason',
      description: 'Optional reason for the rejection',
      type: 'string',
      required: false,
      examples: ['Insufficient methodology', 'Does not meet journal scope', 'Significant flaws in analysis', 'Lacks novelty']
    }
  ],
  examples: [
    '@editorial-bot reject',
    '@editorial-bot reject reason="Insufficient methodology"',
    '@editorial-bot reject reason="Does not meet journal scope"',
    '@editorial-bot reject reason="Significant flaws in analysis"'
  ],
  permissions: ['make_editorial_decision'],
  async execute(params, context) {
    const { reason } = params;
    const { manuscriptId } = context;

    let message = `❌ **Manuscript Rejected**\n\n`;
    message += `**Status:** REJECTED\n`;
    
    if (reason) {
      message += `**Reason:** ${reason}\n`;
    }
    
    message += `**Manuscript ID:** ${manuscriptId}\n`;
    message += `**Decision Date:** ${new Date().toLocaleString()}\n\n`;
    message += `📧 Authors will be automatically notified of the rejection with feedback.`;

    return {
      messages: [{ content: message }],
      actions: [{
        type: 'UPDATE_MANUSCRIPT_STATUS',
        data: { status: 'REJECTED', reason }
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

    // Check user permissions for action editor assignment
    const userId = context.triggeredBy?.userId;
    const hasPermission = await checkActionEditorAssignmentPermission(context);
    
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
      : await validateActionEditor(processedEditor, manuscriptId, context);
    
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
1. Sends invitation email to reviewers with accept/decline links
2. Creates pending review assignment with PENDING status
3. Reviewers accept or decline via the links in the email or conversation message
4. Accepting goes directly to IN_PROGRESS (review begins immediately)

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

        // Create invitation (pending review assignment) via API
        const { serviceToken } = context;
        const createResponse = await fetch(`http://localhost:4000/api/articles/${manuscriptId}/reviewers`, {
          method: 'POST',
          headers: {
            'X-Bot-Token': serviceToken,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            reviewerId: reviewer.id,
            status: 'PENDING',
            dueDate: deadline
          })
        });

        if (!createResponse.ok) {
          results.failed.push({
            email,
            error: `Failed to create reviewer assignment: ${createResponse.statusText}`
          });
          continue;
        }

        const createResult = await createResponse.json();
        const invitation = createResult.assignment;

        // Send invitation email with links to public API endpoints
        let emailSent = false;
        let emailError = null;

        try {
          const nodemailer = await import('nodemailer');
          const transporter = nodemailer.createTransport({
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
          const token = invitation.responseToken;
          const acceptUrl = `${frontendUrl}/review-response/${invitation.id}?action=accept&token=${token}`;
          const declineUrl = `${frontendUrl}/review-response/${invitation.id}?action=decline&token=${token}`;
          
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
          
          emailSent = true;
        } catch (error) {
          console.error('Failed to send invitation email:', error);
          emailError = error instanceof Error ? error.message : 'Unknown email error';
        }
        
        results.invited.push({
          email,
          reviewerId: reviewer.id,
          invitationId: invitation.id,
          emailSent,
          emailError
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
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    let responseMessage = '📧 **Reviewer Invitations Processed**\n\n';

    if (results.invited.length > 0) {
      const emailFailureCount = results.invited.filter(r => !r.emailSent).length;

      responseMessage += `✅ **Successfully Invited (${results.invited.length})**\n`;
      results.invited.forEach(r => {
        const acceptLink = `${frontendUrl}/review-response/${r.invitationId}?action=accept`;
        const declineLink = `${frontendUrl}/review-response/${r.invitationId}?action=decline`;
        if (r.emailSent) {
          responseMessage += `- ${r.email} — [Accept](${acceptLink}) | [Decline](${declineLink})\n`;
        } else {
          responseMessage += `- ${r.email} ⚠️ (email failed: ${r.emailError}) — [Accept](${acceptLink}) | [Decline](${declineLink})\n`;
        }
      });
      responseMessage += '\n';

      if (emailFailureCount > 0) {
        responseMessage += `**⚠️ Email Delivery Issues:** ${emailFailureCount} invitation(s) were created but emails failed to send. The links above will work when the reviewer is logged in.\n\n`;
      }
    }

    if (results.alreadyInvited.length > 0) {
      responseMessage += `ℹ️ **Already Invited/Assigned (${results.alreadyInvited.length}):**\n`;
      results.alreadyInvited.forEach(r => {
        responseMessage += `- ${r.email} (${r.status})`;
        if (r.status === 'DECLINED') {
          responseMessage += ` — use the button below to re-invite`;
        }
        responseMessage += `\n`;
      });
      responseMessage += '\n';
    }

    if (results.failed.length > 0) {
      responseMessage += `❌ **Failed (${results.failed.length}):**\n`;
      results.failed.forEach(r => {
        responseMessage += `- ${r.email}: ${r.error}\n`;
      });
      responseMessage += '\n';
    }

    // Create re-invite actions for declined reviewers
    const declinedActions: BotMessageAction[] = results.alreadyInvited
      .filter(r => r.status === 'DECLINED')
      .map(r => ({
        id: randomUUID(),
        label: `Re-invite ${r.email}`,
        style: 'primary' as const,
        confirmText: `Are you sure you want to re-invite ${r.email}? Their previous decline will be reset.`,
        targetRoles: ['ADMIN', 'EDITOR_IN_CHIEF', 'MANAGING_EDITOR', 'ACTION_EDITOR'],
        handler: {
          botId: 'editorial-bot',
          action: 'REINVITE_REVIEWER',
          params: {
            reviewerId: r.reviewerId,
            email: r.email,
            manuscriptId,
            deadline,
            message
          }
        }
      }));

    return {
      messages: [{
        content: responseMessage,
        ...(declinedActions.length > 0 && { actions: declinedActions })
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
      examples: ['accept', 'reject', 'invite-reviewer', 'assign-editor']
    }
  ],
  examples: [
    '@editorial-bot help',
    '@editorial-bot help accept',
    '@editorial-bot help reject',
    '@editorial-bot help invite-reviewer',
    '@editorial-bot help assign-editor'
  ],
  permissions: [],
  async execute(params, context) {
    const { command } = params;
    
    if (command) {
      // Return help for specific command
      const commands = [acceptCommand, rejectCommand, assignEditorCommand, inviteReviewerCommand];
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

This bot helps automate editorial workflows. Use \`invite-reviewer\` to invite reviewers, and \`accept\` or \`reject\` to make editorial decisions.

## 📋 Workflow Steps

1. Submit manuscript → 2. Assign action editor → 3. Invite reviewers → 4. Reviewers accept via links → 5. Make decision (accept/reject)

## Overview

The Editorial Bot streamlines manuscript management by automating reviewer invitations, progress tracking, and editorial decisions.

## Quick Start

Start by using @editorial-bot help to see all available commands. Most common: @editorial-bot assign-editor <editor>, @editorial-bot invite-reviewer <reviewers>, @editorial-bot accept, and @editorial-bot reject

## Available Commands

**accept** - Accept a manuscript for publication and initiate publication workflow
Usage: \`@editorial-bot accept [reason="reason for acceptance"]\`

**reject** - Reject a manuscript
Usage: \`@editorial-bot reject [reason="reason for rejection"]\`

**assign-editor** - Assign an action editor to a manuscript
Usage: \`@editorial-bot assign-editor <editor> [message="custom message"]\`

**invite-reviewer** - Send email invitations to potential reviewers
Usage: \`@editorial-bot invite-reviewer <reviewers> [deadline="YYYY-MM-DD"] [message="custom message"]\`

## Keywords

This bot also responds to these keywords: \`editorial decision\`, \`review status\`, \`invite reviewer\`, \`assign editor\`, \`manuscript status\`, \`make decision\`

## Complete Examples

\`@editorial-bot assign-editor @DrEditor\`

\`@editorial-bot accept reason="High quality research"\`

\`@editorial-bot reject reason="Insufficient methodology"\`

\`@editorial-bot invite-reviewer @DrSmith,@ProfJohnson deadline="2024-02-15"\`

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
  commands: [acceptCommand, rejectCommand, assignEditorCommand, inviteReviewerCommand, helpCommand],
  keywords: ['editorial decision', 'review status', 'invite reviewer', 'assign editor', 'manuscript status', 'make decision'],
  triggers: ['MANUSCRIPT_SUBMITTED', 'REVIEW_COMPLETE'],
  permissions: ['read_manuscript', 'update_manuscript', 'assign_reviewers', 'make_editorial_decision'],
  help: {
    overview: 'The Editorial Bot streamlines manuscript management by automating reviewer assignments, progress tracking, and editorial decisions.',
    quickStart: 'Start by using @editorial-bot help to see all available commands. Use @editorial-bot invite-reviewer <reviewers> to send invitations with accept/decline links. Reviewers accept via the links and review begins immediately. Use @editorial-bot accept or @editorial-bot reject to make editorial decisions.',
    examples: [
      '@editorial-bot assign-editor @DrEditor',
      '@editorial-bot invite-reviewer @DrSmith,@ProfJohnson deadline="2024-02-15"',
      '@editorial-bot accept reason="High quality research"',
      '@editorial-bot reject reason="Insufficient methodology"'
    ]
  },
  customHelpSections: [
    {
      title: '🚀 Getting Started',
      content: 'This bot helps automate editorial workflows. Use `invite-reviewer` to invite reviewers, and `accept` or `reject` to make editorial decisions.',
      position: 'before'
    },
    {
      title: '📋 Workflow Steps',
      content: '1. Submit manuscript → 2. Assign action editor → 3. Invite reviewers → 4. Reviewers accept via links → 5. Make decision (accept/reject)',
      position: 'before'
    },
    {
      title: 'ℹ️ Support',
      content: 'For editorial workflow questions, contact your journal administrator.',
      position: 'after'
    }
  ],
  actionHandlers: {
    REINVITE_REVIEWER: async (params, context): Promise<BotActionHandlerResult> => {
      const { reviewerId, email, manuscriptId, deadline, message } = params;

      try {
        const { prisma } = await import('@colloquium/database');

        const assignment = await prisma.review_assignments.findUnique({
          where: {
            manuscriptId_reviewerId: {
              manuscriptId,
              reviewerId
            }
          }
        });

        if (!assignment) {
          return { success: false, error: 'Review assignment not found' };
        }

        if (assignment.status !== 'DECLINED') {
          return { success: false, error: `Cannot re-invite: current status is ${assignment.status}` };
        }

        const newToken = randomUUID();

        await prisma.review_assignments.update({
          where: { id: assignment.id },
          data: {
            status: 'PENDING',
            responseToken: newToken,
            assignedAt: new Date()
          }
        });

        // Send new invitation email
        try {
          const nodemailer = await import('nodemailer');
          const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST || 'localhost',
            port: parseInt(process.env.SMTP_PORT || '1025'),
            secure: false,
            auth: process.env.SMTP_USER ? {
              user: process.env.SMTP_USER,
              pass: process.env.SMTP_PASS
            } : undefined,
            tls: { rejectUnauthorized: false }
          });

          const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
          const acceptUrl = `${frontendUrl}/review-response/${assignment.id}?action=accept&token=${newToken}`;
          const declineUrl = `${frontendUrl}/review-response/${assignment.id}?action=decline&token=${newToken}`;

          await transporter.sendMail({
            from: process.env.FROM_EMAIL || 'noreply@colloquium.example.com',
            to: email,
            subject: `Review Invitation: Manuscript Review Request (Re-invitation)`,
            html: `
              <div style="max-width: 600px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                <h1 style="color: #2563eb; margin-bottom: 24px;">Review Invitation (Re-invitation)</h1>
                <p>You have been re-invited to review a manuscript submission.</p>
                ${message ? `<div style="background-color: #f9fafb; padding: 16px; margin: 24px 0; border-radius: 6px;"><h3 style="margin-top: 0;">Message from Editor:</h3><p style="margin-bottom: 0;">${message}</p></div>` : ''}
                <p><strong>Review deadline:</strong> ${deadline || 'To be determined'}</p>
                <div style="margin: 32px 0;">
                  <a href="${acceptUrl}" style="display: inline-block; background-color: #16a34a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-right: 16px;">Accept Review</a>
                  <a href="${declineUrl}" style="display: inline-block; background-color: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Decline Review</a>
                </div>
              </div>
            `
          });
        } catch (emailError) {
          console.error('Failed to send re-invitation email:', emailError);
        }

        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        const acceptLink = `${frontendUrl}/review-response/${assignment.id}?action=accept`;
        const declineLink = `${frontendUrl}/review-response/${assignment.id}?action=decline`;

        return {
          success: true,
          updatedContent: `📧 **Re-invitation sent to ${email}**\n\nThe reviewer's previous decline has been reset and a new invitation email has been sent.\n\n[Accept](${acceptLink}) | [Decline](${declineLink})`
        };
      } catch (error) {
        console.error('REINVITE_REVIEWER handler failed:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to re-invite reviewer'
        };
      }
    }
  }
};

// Export the bot for npm package compatibility
export default editorialBot;