import { z } from 'zod';
import { CommandBot, BotCommand } from '../framework/commands';

// Define commands for the editorial bot
const statusCommand: BotCommand = {
  name: 'status',
  description: 'Update the status of a manuscript',
  usage: '@editorial-bot status <new-status> [reason="reason for change"]',
  parameters: [
    {
      name: 'newStatus',
      description: 'The new status to set for the manuscript',
      type: 'enum',
      required: true,
      enumValues: ['SUBMITTED', 'UNDER_REVIEW', 'REVISION_REQUESTED', 'REVISED', 'ACCEPTED', 'REJECTED', 'PUBLISHED'],
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
    '@editorial-bot status ACCEPTED reason="High quality research with clear findings"'
  ],
  permissions: ['update_manuscript'],
  async execute(params, context) {
    const { newStatus, reason } = params;
    const { manuscriptId } = context;

    // TODO: Implement actual status update logic
    let message = `📋 **Manuscript Status Updated**\n\n`;
    message += `**New Status:** ${newStatus.replace('_', ' ')}\n`;
    
    if (reason) {
      message += `**Reason:** ${reason}\n`;
    }
    
    message += `**Manuscript ID:** ${manuscriptId}\n`;
    message += `**Updated:** ${new Date().toLocaleString()}\n\n`;

    // Add status-specific actions
    switch (newStatus) {
      case 'UNDER_REVIEW':
        message += `✅ Manuscript is now under review. Reviewers will be notified.`;
        break;
      case 'REVISION_REQUESTED':
        message += `📝 Revisions requested. Authors will be notified to submit revised version.`;
        break;
      case 'ACCEPTED':
        message += `🎉 Manuscript accepted! Moving to production workflow.`;
        break;
      case 'REJECTED':
        message += `❌ Manuscript rejected. Authors will be notified with feedback.`;
        break;
      case 'PUBLISHED':
        message += `📚 Manuscript published! Now available to the public.`;
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

const assignCommand: BotCommand = {
  name: 'assign',
  description: 'Assign reviewers to a manuscript',
  usage: '@editorial-bot assign <reviewer-emails> [deadline="YYYY-MM-DD"]',
  parameters: [
    {
      name: 'reviewers',
      description: 'Comma-separated list of reviewer email addresses',
      type: 'array',
      required: true,
      examples: ['reviewer1@university.edu,reviewer2@institution.org']
    },
    {
      name: 'deadline',
      description: 'Review deadline in YYYY-MM-DD format',
      type: 'string',
      required: false,
      defaultValue: '30 days from now',
      validation: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
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
    '@editorial-bot assign reviewer1@uni.edu,reviewer2@inst.org',
    '@editorial-bot assign reviewer@example.com deadline="2024-02-15"',
    '@editorial-bot assign expert@university.edu deadline="2024-03-01" message="This paper needs statistical review"'
  ],
  permissions: ['assign_reviewers'],
  async execute(params, context) {
    const { reviewers, deadline, message } = params;
    const { manuscriptId } = context;

    let response = `👥 **Reviewers Assigned**\n\n`;
    response += `**Manuscript ID:** ${manuscriptId}\n`;
    response += `**Reviewers:** ${reviewers.join(', ')}\n`;
    
    if (deadline) {
      response += `**Deadline:** ${deadline}\n`;
    }
    
    if (message) {
      response += `**Instructions:** ${message}\n`;
    }
    
    response += `\n✅ Review invitations have been sent to all assigned reviewers.`;

    return {
      messages: [{ content: response }],
      actions: [{
        type: 'ASSIGN_REVIEWER',
        data: { reviewers, deadline, customMessage: message }
      }]
    };
  }
};

const summaryCommand: BotCommand = {
  name: 'summary',
  description: 'Generate a summary of manuscript review progress',
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

    // TODO: Fetch actual manuscript data
    const mockData = {
      status: 'UNDER_REVIEW',
      submittedDate: '2024-01-15',
      reviewers: ['reviewer1@uni.edu', 'reviewer2@inst.org'],
      completedReviews: 1,
      totalReviews: 2,
      averageScore: 7.5,
      lastActivity: '2024-01-20'
    };

    let summary = `📊 **Manuscript Review Summary**\n\n`;
    summary += `**Status:** ${mockData.status.replace('_', ' ')}\n`;
    summary += `**Submitted:** ${mockData.submittedDate}\n`;
    summary += `**Progress:** ${mockData.completedReviews}/${mockData.totalReviews} reviews completed\n`;
    
    if (mockData.averageScore) {
      summary += `**Average Score:** ${mockData.averageScore}/10\n`;
    }
    
    summary += `**Last Activity:** ${mockData.lastActivity}\n`;

    if (format === 'detailed') {
      summary += `\n**Assigned Reviewers:**\n`;
      mockData.reviewers.forEach((reviewer, index) => {
        summary += `${index + 1}. ${reviewer} - ${index < mockData.completedReviews ? '✅ Complete' : '⏳ Pending'}\n`;
      });
      
      summary += `\n**Next Steps:**\n`;
      if (mockData.completedReviews < mockData.totalReviews) {
        summary += `- Wait for remaining ${mockData.totalReviews - mockData.completedReviews} review(s)\n`;
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

const helpCommand: BotCommand = {
  name: 'help',
  description: 'Show help information for editorial bot commands',
  usage: '@editorial-bot help [command="command-name"]',
  parameters: [
    {
      name: 'command',
      description: 'Specific command to get help for',
      type: 'string',
      required: false,
      examples: ['status', 'assign', 'summary']
    }
  ],
  examples: [
    '@editorial-bot help',
    '@editorial-bot help command="status"',
    '@editorial-bot help command="assign"'
  ],
  permissions: [],
  async execute(params, context) {
    const { command } = params;
    
    if (command) {
      // Return help for specific command
      const cmd = editorialBot.commands.find(c => c.name === command);
      if (!cmd) {
        return {
          messages: [{ content: `❌ Command '${command}' not found. Use @editorial-bot help to see all commands.` }]
        };
      }
      
      let help = `# Help: ${cmd.name}\n\n`;
      help += `${cmd.description}\n\n`;
      help += `**Usage:** \`${cmd.usage}\`\n\n`;
      
      if (cmd.parameters.length > 0) {
        help += `**Parameters:**\n`;
        cmd.parameters.forEach(param => {
          help += `- \`${param.name}\` (${param.type}${param.required ? ', required' : ', optional'})`;
          if (param.defaultValue) help += ` - Default: \`${param.defaultValue}\``;
          help += `\n  ${param.description}\n`;
        });
      }
      
      help += `\n**Examples:**\n`;
      cmd.examples.forEach(example => {
        help += `- \`${example}\`\n`;
      });
      
      return { messages: [{ content: help }] };
    }
    
    // Return general help
    let help = `# Editorial Bot Help\n\n`;
    help += `I help manage manuscript editorial workflows. Here are my available commands:\n\n`;
    
    editorialBot.commands.forEach(cmd => {
      help += `**${cmd.name}** - ${cmd.description}\n`;
      help += `Usage: \`${cmd.usage}\`\n\n`;
    });
    
    help += `**Keywords:** ${editorialBot.keywords.join(', ')}\n\n`;
    help += `Use \`@editorial-bot help command="command-name"\` for detailed help on specific commands.`;
    
    return { messages: [{ content: help }] };
  }
};

// Define the editorial bot
export const editorialBot: CommandBot = {
  id: 'editorial-bot',
  name: 'Editorial Bot',
  description: 'Assists with manuscript editorial workflows, status updates, and reviewer assignments',
  version: '2.0.0',
  commands: [statusCommand, assignCommand, summaryCommand, helpCommand],
  keywords: ['editorial decision', 'review status', 'assign reviewer', 'manuscript status'],
  triggers: ['MANUSCRIPT_SUBMITTED', 'REVIEW_COMPLETE'],
  permissions: ['read_manuscript', 'update_manuscript', 'assign_reviewers'],
  help: {
    overview: 'The Editorial Bot streamlines manuscript management by automating status updates, reviewer assignments, and progress tracking.',
    quickStart: 'Start by using @editorial-bot help to see all available commands. Most common: @editorial-bot status <status> and @editorial-bot assign <reviewers>',
    examples: [
      '@editorial-bot status UNDER_REVIEW reason="Initial review passed"',
      '@editorial-bot assign reviewer1@uni.edu,reviewer2@inst.org deadline="2024-02-15"',
      '@editorial-bot summary format="detailed"'
    ]
  }
};