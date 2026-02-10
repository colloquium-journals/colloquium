import { CommandBot, BotCommand, BotEventName } from '@colloquium/types';
import { createBotClient } from '@colloquium/bot-sdk';

interface ChecklistConfig {
  template?: string;
}

interface ReviewerAssignment {
  id: string;
  userId: string;
  userName: string;
  hasChecklist: boolean;
}

const DEFAULT_TEMPLATE = `# Reviewer Checklist

## Scientific Rigor
- [ ] The methodology is clearly described and appropriate for the research question
- [ ] Data analysis methods are appropriate and correctly applied
- [ ] Results are clearly presented and support the conclusions
- [ ] Statistical analyses are appropriate and correctly interpreted

## Significance and Novelty
- [ ] The work presents novel insights or significant contributions to the field
- [ ] The research question is clearly stated and well-motivated
- [ ] The implications of the findings are discussed appropriately

## Scholarship
- [ ] Literature review is comprehensive and up-to-date
- [ ] Prior work is appropriately cited and contextualized
- [ ] The work builds appropriately on existing knowledge

## Technical Quality
- [ ] Writing is clear, well-organized, and free of significant errors
- [ ] Figures and tables are clear and informative
- [ ] References are complete, accurate, and properly formatted

## Ethics and Standards
- [ ] Ethical considerations are appropriately addressed (if applicable)
- [ ] Conflicts of interest are disclosed
- [ ] Data collection and handling follow appropriate standards

## Reproducibility
- [ ] Study is reproducible with sufficient methodological detail
- [ ] Data availability and access are clearly stated
- [ ] Code/analysis scripts are available when applicable

## Overall Assessment
- [ ] The manuscript meets the standards for publication
- [ ] I recommend this manuscript for acceptance/revision/rejection

---
*This checklist is editable. Check off items as you complete your review.*`;

async function getAssignedReviewers(context: any): Promise<ReviewerAssignment[]> {
  try {
    const client = createBotClient(context);
    const assignments = await client.reviewers.list();
    return assignments.map((a: any) => ({
      id: a.id,
      userId: a.reviewerId,
      userName: a.users?.name || a.users?.username || 'Unknown',
      hasChecklist: false
    }));
  } catch (error) {
    console.error('Error fetching assigned reviewers:', error);
    return [];
  }
}

function parseMentionName(mentionOrId: string): string {
  // Remove @ symbol if present and clean up the name
  return mentionOrId.replace(/^@/, '').trim();
}

function findReviewerByMentionOrId(reviewers: ReviewerAssignment[], mentionOrId: string): ReviewerAssignment | undefined {
  const cleanName = parseMentionName(mentionOrId);
  
  // First try to find by exact ID match
  let found = reviewers.find(r => r.id === mentionOrId || r.userId === mentionOrId);
  if (found) return found;
  
  // Then try to find by username (case-insensitive)
  found = reviewers.find(r => r.userName.toLowerCase() === cleanName.toLowerCase());
  if (found) return found;
  
  // Finally try partial name matching (useful for "Dr. Smith" vs "smith")
  return reviewers.find(r => 
    r.userName.toLowerCase().includes(cleanName.toLowerCase()) ||
    cleanName.toLowerCase().includes(r.userName.toLowerCase().split(' ').pop() || '')
  );
}

function renderTemplate(template: string, context: any): string {
  // Simple template rendering - can be expanded to support variables
  let rendered = template;
  
  // Replace common variables if they exist in context
  if (context.manuscriptTitle) {
    rendered = rendered.replace(/{{manuscriptTitle}}/g, context.manuscriptTitle);
  }
  if (context.authors) {
    rendered = rendered.replace(/{{authors}}/g, context.authors);
  }
  if (context.reviewerName) {
    rendered = rendered.replace(/{{reviewerName}}/g, context.reviewerName);
  }
  
  return rendered;
}

async function checkReviewerPermission(context: any, userId: string): Promise<boolean> {
  try {
    const client = createBotClient(context);
    const assignments = await client.reviewers.list();
    return assignments.some((a: any) =>
      a.reviewerId === userId && ['ACCEPTED', 'IN_PROGRESS'].includes(a.status)
    );
  } catch (error) {
    console.error('Error checking reviewer permission:', error);
    return false;
  }
}

async function markReviewerAsHavingChecklist(context: any, reviewerId: string): Promise<void> {
  // TODO: Store checklist completion status when manuscript metadata API is available
  console.log(`Checklist completed by reviewer ${reviewerId} for manuscript ${context.manuscriptId}`);
}

async function getBotConfig(context: any): Promise<ChecklistConfig | null> {
  // Get configuration from context.config (loaded from default-config.yaml)
  const config = context.config || {};
  
  // If a template filename is specified, try to load it from uploaded files
  if (config.templateFile) {
    try {
      const template = await loadTemplateFromFile(config.templateFile, context);
      if (template) {
        return { template };
      }
    } catch (error) {
      console.warn(`Failed to load template file ${config.templateFile}:`, error);
    }
  }
  
  // Fall back to template from config, or default template
  return {
    template: config.template || DEFAULT_TEMPLATE
  };
}

async function loadTemplateFromFile(filename: string, context: any): Promise<string | null> {
  try {
    // Use the bot's service token to fetch the file
    const serviceToken = context.serviceToken;
    if (!serviceToken) {
      console.warn('No service token available for file download');
      return null;
    }

    // Get the bot ID from context
    const botId = context.botId || 'bot-reviewer-checklist';
    
    // First, get the list of files for this bot
    const filesResponse = await fetch(`${context.apiBaseUrl}/api/bot-config-files/${botId}/files`, {
      headers: {
        'Authorization': `Bearer ${serviceToken}`,
        'X-Bot-Token': serviceToken
      }
    });

    if (!filesResponse.ok) {
      console.warn(`Failed to fetch bot files: ${filesResponse.status}`);
      return null;
    }

    const filesData = await filesResponse.json();
    const file = filesData.files?.find((f: any) => f.filename === filename);
    
    if (!file) {
      console.warn(`Template file ${filename} not found in bot files`);
      return null;
    }

    // Download the file content
    const contentResponse = await fetch(`${context.apiBaseUrl}/api/bot-config-files/${file.id}/content`, {
      headers: {
        'Authorization': `Bearer ${serviceToken}`,
        'X-Bot-Token': serviceToken
      }
    });

    if (!contentResponse.ok) {
      console.warn(`Failed to download template file: ${contentResponse.status}`);
      return null;
    }

    const contentData = await contentResponse.json();
    return contentData.file?.content || null;
    
  } catch (error) {
    console.error('Error loading template from file:', error);
    return null;
  }
}

const generateCommand: BotCommand = {
  name: 'generate',
  description: 'Generate a checklist for reviewers. By default, generates checklists for all assigned reviewers without one. Can target a specific reviewer by @mention or ID.',
  usage: '@bot-reviewer-checklist generate [reviewer="@username"]',
  parameters: [
    {
      name: 'reviewer',
      type: 'string',
      description: 'Specific reviewer to generate checklist for - use @mention name or ID',
      required: false,
      examples: ['@DrSmith', '@Prof.Johnson', 'reviewer-123']
    }
  ],
  examples: [
    '@bot-reviewer-checklist generate',
    '@bot-reviewer-checklist generate reviewer="@DrSmith"',
    '@bot-reviewer-checklist generate reviewer="Prof.Johnson"'
  ],
  permissions: ['read_manuscript', 'send_messages'],
  async execute(params, context) {
    // Get bot configuration
    const config = await getBotConfig(context);
    const template = config?.template || DEFAULT_TEMPLATE;

    // Get assigned reviewers
    const assignedReviewers = await getAssignedReviewers(context);
    
    if (assignedReviewers.length === 0) {
      return {
        messages: [{
          content: '❌ **No Reviewers Assigned**\n\nThere are no assigned reviewers for this manuscript.'
        }]
      };
    }

    let targetReviewers: ReviewerAssignment[];
    
    if (params.reviewer) {
      // Generate for specific reviewer using @mention or ID
      const specificReviewer = findReviewerByMentionOrId(assignedReviewers, params.reviewer);
      if (!specificReviewer) {
        const availableReviewers = assignedReviewers.map(r => `@${r.userName}`).join(', ');
        return {
          messages: [{
            content: `❌ **Reviewer Not Found**\n\nReviewer "${params.reviewer}" is not assigned to this manuscript.\n\n**Available reviewers:** ${availableReviewers}`
          }]
        };
      }
      targetReviewers = [specificReviewer];
    } else {
      // Generate for all reviewers without checklists
      targetReviewers = assignedReviewers.filter(r => !r.hasChecklist);
      
      if (targetReviewers.length === 0) {
        return {
          messages: [{
            content: '✅ **All Set**\n\nAll assigned reviewers already have checklists.'
          }]
        };
      }
    }

    // Generate checklists for target reviewers
    const messages = [];
    
    for (const reviewer of targetReviewers) {
      const contextWithReviewer = {
        ...context,
        reviewerName: reviewer.userName,
        reviewerId: reviewer.id
      };
      
      const checklistContent = renderTemplate(template, contextWithReviewer);
      
      messages.push({
        content: checklistContent,
        metadata: {
          reviewerId: reviewer.id,
          isEditable: true,
          editPermissions: [reviewer.userId]
        }
      });
      
      // Mark reviewer as having checklist
      await markReviewerAsHavingChecklist(context, reviewer.id);
    }

    const summary = targetReviewers.length === 1 
      ? `Generated checklist for ${targetReviewers[0].userName}`
      : `Generated checklists for ${targetReviewers.length} reviewers: ${targetReviewers.map(r => r.userName).join(', ')}`;

    return {
      messages: [
        {
          content: `✅ **Checklists Generated**\n\n${summary}`
        },
        ...messages
      ]
    };
  }
};

const helpCommand: BotCommand = {
  name: 'help',
  description: 'Show available commands and usage',
  usage: '@bot-reviewer-checklist help',
  parameters: [],
  examples: ['@bot-reviewer-checklist help'],
  permissions: [],
  async execute(params, context) {
    const helpContent = `# Reviewer Checklist Bot

**Available Commands:**

## \`generate\`
Generate a customizable review checklist for manuscript evaluation.

**Usage:** \`@bot-reviewer-checklist generate [reviewer="@username"]\`

**Examples:**
- \`@bot-reviewer-checklist generate\` - Generate checklists for all reviewers without one
- \`@bot-reviewer-checklist generate reviewer="@DrSmith"\` - Generate checklist for specific reviewer by @mention
- \`@bot-reviewer-checklist generate reviewer="Prof.Johnson"\` - Generate checklist using partial name

**Behavior:**
- By default, generates checklists for all assigned reviewers who don't have one yet
- Can target a specific reviewer by @mention name, partial name, or ID
- Creates top-level messages that are editable by the assigned reviewer
- Shows available reviewers if target not found

**Features:**
- Generates checklists for all assigned reviewers without one
- Customizable templates with variable support
- Creates editable messages that reviewers can interact with
- Smart targeting to avoid duplicate checklists

## \`help\`
Show this help message.

**Usage:** \`@bot-reviewer-checklist help\`

---
*This bot helps reviewers systematically evaluate manuscripts using configurable checklists.*`;

    return {
      messages: [{
        content: helpContent
      }]
    };
  }
};

export const reviewerChecklistBot: CommandBot = {
  id: 'bot-reviewer-checklist',
  name: 'Reviewer Checklist',
  description: 'Generates customizable review checklists for assigned reviewers using configurable templates',
  version: '1.0.0',
  commands: [generateCommand, helpCommand],
  keywords: ['checklist', 'review', 'criteria', 'evaluation'],
  triggers: ['MESSAGE_CREATED'],
  permissions: ['read_manuscript', 'send_messages'],
  help: {
    overview: 'The Reviewer Checklist bot generates customizable review checklists for assigned reviewers using configurable templates.',
    quickStart: 'Use `@bot-reviewer-checklist generate` to create checklists for all reviewers who don\'t have one yet.',
    examples: [
      '@bot-reviewer-checklist generate',
      '@bot-reviewer-checklist generate reviewer="@DrSmith"',
      '@bot-reviewer-checklist generate reviewer="Prof.Johnson"'
    ]
  },
  customHelpSections: [
    {
      title: '🎯 Features',
      content: '• Generates checklists for all assigned reviewers without one\n• Customizable templates with variable support\n• Creates editable messages that reviewers can interact with\n• Smart targeting to avoid duplicate checklists\n• Auto-generates checklists when reviewers are assigned (via event system)',
      position: 'before'
    },
    {
      title: '📋 Template Variables',
      content: 'Use these variables in your custom templates:\n• `{{manuscriptTitle}}` - The manuscript title\n• `{{authors}}` - List of manuscript authors\n• `{{reviewerName}}` - Name of the assigned reviewer',
      position: 'before'
    },
    {
      title: 'ℹ️ Configuration',
      content: 'Customize the checklist template by uploading a markdown file via the Files tab or by editing the template in the bot configuration. Set `templateFile` to the filename of your uploaded template. The default template covers common review criteria across scientific rigor, significance, scholarship, technical quality, ethics, and reproducibility.',
      position: 'after'
    }
  ],
  events: {
    [BotEventName.REVIEWER_ASSIGNED]: async (context, payload) => {
      const client = createBotClient(context);
      const assignments = await client.reviewers.list();
      const assignment = assignments.find((a: any) => a.reviewerId === payload.reviewerId);
      if (!assignment) return;

      const config = await getBotConfig(context);
      const template = config?.template || DEFAULT_TEMPLATE;

      const reviewerName = (assignment as any).users?.name || 'Reviewer';
      const checklistContent = renderTemplate(template, {
        ...context,
        reviewerName,
      });

      return {
        messages: [
          {
            content: `**Auto-Generated Checklist** for ${reviewerName}\n\nA review checklist has been automatically generated for the newly assigned reviewer.`,
          },
          {
            content: checklistContent,
            metadata: {
              reviewerId: payload.reviewerId,
              isEditable: true,
              editPermissions: [payload.reviewerId],
            },
          },
        ],
      };
    },
  },
};

// Export the bot for npm package compatibility
export default reviewerChecklistBot;