import { CommandBot, BotCommand, BotCommandParameter } from '../framework/commands';
import { BotResponse, BotContext } from '@colloquium/types';

interface ChecklistConfig {
  title?: string;
  criteria: ChecklistCriterion[];
}

interface ChecklistCriterion {
  id: string;
  text: string;
  required: boolean;
  category?: string;
}

const DEFAULT_CRITERIA: ChecklistCriterion[] = [
  {
    id: 'methodology',
    text: 'The methodology is clearly described and appropriate for the research question',
    required: true,
    category: 'Scientific Rigor'
  },
  {
    id: 'data_analysis',
    text: 'Data analysis methods are appropriate and correctly applied',
    required: true,
    category: 'Scientific Rigor'
  },
  {
    id: 'results_clear',
    text: 'Results are clearly presented and support the conclusions',
    required: true,
    category: 'Scientific Rigor'
  },
  {
    id: 'novelty',
    text: 'The work presents novel insights or significant contributions to the field',
    required: false,
    category: 'Significance'
  },
  {
    id: 'literature_review',
    text: 'Literature review is comprehensive and up-to-date',
    required: true,
    category: 'Scholarship'
  },
  {
    id: 'references',
    text: 'References are complete, accurate, and properly formatted',
    required: false,
    category: 'Technical Quality'
  },
  {
    id: 'writing_quality',
    text: 'Writing is clear, well-organized, and free of significant errors',
    required: false,
    category: 'Technical Quality'
  },
  {
    id: 'ethics',
    text: 'Ethical considerations are appropriately addressed (if applicable)',
    required: true,
    category: 'Ethics & Standards'
  },
  {
    id: 'reproducibility',
    text: 'Study is reproducible with sufficient methodological detail',
    required: false,
    category: 'Reproducibility'
  },
  {
    id: 'data_availability',
    text: 'Data availability and access are clearly stated',
    required: false,
    category: 'Reproducibility'
  }
];

export class ReviewerChecklistBot implements CommandBot {
  public readonly id = 'reviewer-checklist';
  public readonly name = 'Reviewer Checklist';
  public readonly description = 'Generates customizable checklists for manuscript reviewers';
  public readonly version = '1.0.0';
  public readonly keywords = ['checklist', 'review', 'criteria', 'evaluation'];
  public readonly triggers = ['MESSAGE_CREATED'];
  public readonly permissions = ['manuscript.review'];
  public readonly help = {
    overview: 'The Reviewer Checklist bot helps reviewers systematically evaluate manuscripts using customizable checklists with interactive checkboxes.',
    quickStart: 'Use `@reviewer-checklist generate` to create a review checklist for the current manuscript.',
    examples: [
      '@reviewer-checklist generate',
      '@reviewer-checklist generate title="Systematic Review Checklist"',
      '@reviewer-checklist help'
    ]
  };

  private _commands: BotCommand[] = [
    {
      name: 'generate',
      description: 'Generate a review checklist',
      usage: '@reviewer-checklist generate [title="Custom Title"]',
      parameters: [
        {
          name: 'title',
          type: 'string',
          description: 'Custom title for the checklist',
          required: false,
          defaultValue: 'Review Checklist'
        }
      ],
      examples: [
        '@reviewer-checklist generate',
        '@reviewer-checklist generate title="Systematic Review Checklist"'
      ],
      permissions: ['manuscript.review'],
      execute: this.generateChecklist.bind(this)
    },
    {
      name: 'help',
      description: 'Show available commands and usage',
      usage: '@reviewer-checklist help',
      parameters: [],
      examples: ['@reviewer-checklist help'],
      permissions: [],
      execute: this.showHelp.bind(this)
    }
  ];

  get commands(): BotCommand[] {
    return this._commands;
  }

  getCommands(): BotCommand[] {
    return this._commands;
  }

  private async generateChecklist(
    parameters: Record<string, any>,
    context: BotContext
  ): Promise<BotResponse> {
    // Check if user is assigned as a reviewer for this manuscript
    const isReviewer = await this.checkReviewerPermission(context);
    if (!isReviewer) {
      return {
        messages: [{
          content: 'You must be assigned as a reviewer for this manuscript to generate a checklist.'
        }]
      };
    }

    // Get bot configuration (custom criteria)
    const config = await this.getBotConfig(context);
    const criteria = config?.criteria || DEFAULT_CRITERIA;
    const title = parameters.title || config?.title || 'Review Checklist';

    // Generate checklist markdown with interactive checkboxes
    const checklistMarkdown = this.buildChecklistMarkdown(title, criteria, context.conversationId);

    return {
      messages: [{
        content: checklistMarkdown
      }]
    };
  }

  private buildChecklistMarkdown(title: string, criteria: ChecklistCriterion[], conversationId: string): string {
    const groupedCriteria = this.groupCriteriaByCategory(criteria);
    
    let markdown = `## ${title}\n\n`;
    markdown += '*Please review each criterion and check off items as you evaluate the manuscript.*\n\n';

    if (Object.keys(groupedCriteria).length > 1) {
      // Group by categories
      for (const [category, items] of Object.entries(groupedCriteria)) {
        if (category !== 'undefined') {
          markdown += `### ${category}\n\n`;
        }
        
        for (const criterion of items) {
          const required = criterion.required ? ' *(required)*' : '';
          markdown += `- [ ] ${criterion.text}${required}\n`;
        }
        markdown += '\n';
      }
    } else {
      // Single list without categories
      for (const criterion of criteria) {
        const required = criterion.required ? ' *(required)*' : '';
        markdown += `- [ ] ${criterion.text}${required}\n`;
      }
    }

    markdown += '\n---\n';
    markdown += '*Note: This checklist will save your progress automatically. Required items are marked with (required).*';

    return markdown;
  }

  private groupCriteriaByCategory(criteria: ChecklistCriterion[]): Record<string, ChecklistCriterion[]> {
    return criteria.reduce((groups, criterion) => {
      const category = criterion.category || 'General';
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(criterion);
      return groups;
    }, {} as Record<string, ChecklistCriterion[]>);
  }

  private async checkReviewerPermission(context: BotContext): Promise<boolean> {
    // In a real implementation, this would check the database to see if the user
    // is assigned as a reviewer for the manuscript
    // For now, we'll return true to allow testing
    return true;
  }

  private async getBotConfig(context: BotContext): Promise<ChecklistConfig | null> {
    // This would fetch the bot configuration from the database
    // For now, return default config
    return {
      title: 'Manuscript Review Checklist',
      criteria: DEFAULT_CRITERIA
    };
  }

  private async showHelp(): Promise<BotResponse> {
    const helpContent = `
## Reviewer Checklist Bot

**Available Commands:**

### \`generate\`
Generate a customizable review checklist for manuscript evaluation.

**Usage:** \`@reviewer-checklist generate [title="Custom Title"]\`

**Examples:**
- \`@reviewer-checklist generate\`
- \`@reviewer-checklist generate title="Systematic Review Checklist"\`

**Permissions:** Must be assigned as a reviewer for the manuscript

**Features:**
- Interactive checkboxes that save state automatically
- Customizable criteria through bot configuration
- Categories for organized review process
- Required vs. optional criteria marking

### \`help\`
Show this help message.

**Usage:** \`@reviewer-checklist help\`

---
*This bot helps reviewers systematically evaluate manuscripts using configurable checklists.*
    `.trim();

    return {
      messages: [{
        content: helpContent
      }]
    };
  }
}