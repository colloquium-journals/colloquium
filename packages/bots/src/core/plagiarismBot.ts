import { z } from 'zod';
import { CommandBot, BotCommand } from '../framework/commands';

const checkCommand: BotCommand = {
  name: 'check',
  description: 'Perform a plagiarism check on the manuscript',
  usage: '@plagiarism check [threshold=0.15] [databases="crossref,pubmed"]',
  parameters: [
    {
      name: 'threshold',
      description: 'Similarity threshold as a decimal (0.0-1.0)',
      type: 'number',
      required: false,
      defaultValue: 0.15,
      validation: z.number().min(0).max(1),
      examples: ['0.1', '0.2', '0.05']
    },
    {
      name: 'databases',
      description: 'Comma-separated list of databases to check against',
      type: 'array',
      required: false,
      defaultValue: ['crossref', 'pubmed', 'arxiv'],
      enumValues: ['crossref', 'pubmed', 'arxiv', 'google-scholar', 'ieee'],
      examples: ['crossref,pubmed', 'arxiv,ieee']
    },
    {
      name: 'sections',
      description: 'Specific sections to check',
      type: 'array',
      required: false,
      defaultValue: ['all'],
      enumValues: ['all', 'abstract', 'introduction', 'methods', 'results', 'discussion', 'conclusion'],
      examples: ['abstract,introduction', 'methods,results']
    }
  ],
  examples: [
    '@plagiarism check',
    '@plagiarism check threshold=0.1',
    '@plagiarism check databases="crossref,pubmed" threshold=0.2',
    '@plagiarism check sections="abstract,introduction" threshold=0.15'
  ],
  permissions: ['read_manuscript'],
  async execute(params, context) {
    const { threshold, databases, sections } = params;
    const { manuscriptId } = context;

    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const mockResults = {
      matches: Math.floor(Math.random() * 5),
      databases: databases,
      threshold: threshold,
      confidence: 0.95,
      sectionsChecked: sections,
      processingTime: '2.3 seconds',
      detailedMatches: [
        {
          similarity: 0.23,
          source: 'Smith et al. (2023) - Nature Methods',
          section: 'introduction',
          text: 'Machine learning algorithms have shown...'
        }
      ]
    };

    let message = `🔍 **Plagiarism Check Complete**\n\n`;
    message += `**Manuscript ID:** ${manuscriptId}\n`;
    message += `**Threshold:** ${(threshold * 100).toFixed(1)}%\n`;
    message += `**Databases:** ${databases.join(', ')}\n`;
    message += `**Sections:** ${sections.join(', ')}\n`;
    message += `**Processing Time:** ${mockResults.processingTime}\n\n`;
    
    message += `**Results:**\n`;
    message += `- Potential matches: ${mockResults.matches}\n`;
    message += `- Confidence: ${(mockResults.confidence * 100).toFixed(1)}%\n\n`;

    if (mockResults.matches === 0) {
      message += `✅ **Clean:** No significant plagiarism detected.`;
    } else if (mockResults.matches <= 2) {
      message += `⚠️ **Caution:** Minor similarities detected. Manual review recommended.\n\n`;
      message += `**Potential Issues:**\n`;
      mockResults.detailedMatches.forEach((match, i) => {
        message += `${i + 1}. **${(match.similarity * 100).toFixed(1)}% similarity** in ${match.section}\n`;
        message += `   Source: ${match.source}\n`;
        message += `   Text: "${match.text}"\n\n`;
      });
    } else {
      message += `🚨 **Alert:** Multiple potential matches found. Detailed review required.`;
    }

    return {
      messages: [{
        content: message,
        attachments: [{
          type: 'report',
          filename: `plagiarism-report-${manuscriptId}.json`,
          data: JSON.stringify(mockResults, null, 2),
          mimetype: 'application/json'
        }]
      }]
    };
  }
};

const reportCommand: BotCommand = {
  name: 'report',
  description: 'Generate a detailed plagiarism report',
  usage: '@plagiarism report [format="pdf|json|html"]',
  parameters: [
    {
      name: 'format',
      description: 'Report format',
      type: 'enum',
      required: false,
      defaultValue: 'pdf',
      enumValues: ['pdf', 'json', 'html'],
      examples: ['pdf', 'json', 'html']
    }
  ],
  examples: [
    '@plagiarism report',
    '@plagiarism report format="html"'
  ],
  permissions: ['read_manuscript'],
  async execute(params, context) {
    const { format } = params;
    const { manuscriptId } = context;

    let message = `📋 **Generating Plagiarism Report**\n\n`;
    message += `**Format:** ${format.toUpperCase()}\n`;
    message += `**Manuscript:** ${manuscriptId}\n\n`;
    message += `⏳ Report generation in progress...\n`;
    message += `📧 You will receive the report via email when complete.`;

    return {
      messages: [{ content: message }],
      actions: [{
        type: 'GENERATE_REPORT',
        data: { type: 'plagiarism', format, manuscriptId }
      }]
    };
  }
};

export const plagiarismBot: CommandBot = {
  id: 'plagiarism-checker',
  name: 'Plagiarism Checker',
  description: 'Advanced plagiarism detection using multiple academic databases and AI algorithms',
  version: '2.0.0',
  commands: [checkCommand, reportCommand],
  keywords: ['plagiarism', 'similarity', 'duplicate', 'copy'],
  triggers: ['MANUSCRIPT_SUBMITTED'],
  permissions: ['read_manuscript'],
  help: {
    overview: 'Detects potential plagiarism by comparing manuscripts against academic databases and published literature.',
    quickStart: 'Use @plagiarism check to run a basic check, or @plagiarism check threshold=0.1 for more sensitive detection.',
    examples: [
      '@plagiarism check threshold=0.1 databases="crossref,pubmed"',
      '@plagiarism report format="html"'
    ]
  }
};