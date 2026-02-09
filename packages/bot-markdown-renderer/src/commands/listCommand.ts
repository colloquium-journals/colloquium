import { BotCommand } from '@colloquium/types';
import { getBuiltInTemplates } from '../templates/templateManager';

export const uploadTemplateCommand: BotCommand = {
  name: 'upload-template',
  description: 'Instructions for uploading custom journal templates',
  usage: '@bot-markdown-renderer upload-template',
  parameters: [],
  examples: ['@bot-markdown-renderer upload-template'],
  permissions: [],
  async execute(_params, _context) {
    let message = `📤 **Upload Custom Journal Templates**\n\n`;

    message += `To upload a custom journal template, you need to upload the template files through the bot configuration system:\n\n`;

    message += `**Step 1: Prepare Your Template Files**\n`;
    message += `• Create an HTML template file (e.g., \`my-template.html\`)\n`;
    message += `• Optionally create a CSS file (e.g., \`my-template.css\`)\n`;
    message += `• Use Handlebars syntax for variables: \`{{title}}\`, \`{{content}}\`, etc.\n\n`;

    message += `**Step 2: Upload Files**\n`;
    message += `• Go to Bot Management → Markdown Renderer → Configuration\n`;
    message += `• Upload your HTML file with category "template"\n`;
    message += `• Upload your CSS file with category "css" (if applicable)\n`;
    message += `• Add descriptions to help identify your templates\n\n`;

    message += `**Step 3: Use Your Template**\n`;
    message += `• Use \`@bot-markdown-renderer render template="file:my-template"\`\n`;
    message += `• The filename should match your uploaded HTML file (without extension)\n\n`;

    message += `**Available Template Variables:**\n`;
    message += `• \`{{title}}\` - Manuscript title\n`;
    message += `• \`{{authors}}\` - Author list (comma-separated)\n`;
    message += `• \`{{abstract}}\` - Manuscript abstract\n`;
    message += `• \`{{content}}\` - Rendered markdown content (use triple braces: \`{{{content}}}\`)\n`;
    message += `• \`{{customCss}}\` - Any custom CSS provided\n`;
    message += `• \`{{submittedDate}}\` - Submission date\n`;
    message += `• \`{{renderDate}}\` - Current date\n`;
    message += `• \`{{journalName}}\` - Journal name\n\n`;

    message += `**Example Template Structure:**\n`;
    message += `\`\`\`html\n`;
    message += `<!DOCTYPE html>\n`;
    message += `<html>\n`;
    message += `<head>\n`;
    message += `  <title>{{title}}</title>\n`;
    message += `  <style>/* Your styles */</style>\n`;
    message += `  {{#if customCss}}<style>{{customCss}}</style>{{/if}}\n`;
    message += `</head>\n`;
    message += `<body>\n`;
    message += `  <h1>{{title}}</h1>\n`;
    message += `  <p>By: {{authors}}</p>\n`;
    message += `  <div class="content">{{{content}}}</div>\n`;
    message += `</body>\n`;
    message += `</html>\n`;
    message += `\`\`\`\n\n`;

    message += `💡 **Tip:** Start with one of the built-in templates and modify it for your needs!`;

    return {
      messages: [{ content: message }]
    };
  }
};

export const listTemplatesCommand: BotCommand = {
  name: 'templates',
  description: 'List available journal templates',
  usage: '@bot-markdown-renderer templates',
  parameters: [],
  examples: ['@bot-markdown-renderer templates'],
  permissions: [],
  async execute(_params, context) {
    const { config } = context;

    let message = `📝 **Available Journal Templates**\n\n`;

    if (config.templates && Object.keys(config.templates).length > 0) {
      message += `**Configured Templates:**\n`;
      Object.entries(config.templates).forEach(([name, template]: [string, any]) => {
        message += `• **${template.title}** (\`${name}\`)\n`;
        message += `  ${template.description}\n`;
        message += `  Default Engine: ${template.defaultEngine}\n`;

        if (template.files && template.files.length > 0) {
          message += `  Files:\n`;
          template.files.forEach((file: any) => {
            message += `    - ${file.filename} (${file.engine}) - File ID: \`${file.fileId}\`\n`;
          });
        }
        message += `\n`;
      });
    }

    const builtInTemplates = await getBuiltInTemplates();
    if (Object.keys(builtInTemplates).length > 0) {
      message += `**Built-in Templates (Legacy):**\n`;
      Object.values(builtInTemplates).forEach((template: any) => {
        message += `• **${template.title}** (\`${template.name}\`)\n`;
        message += `  ${template.description}\n\n`;
      });
    }

    if (config.customTemplates && Object.keys(config.customTemplates).length > 0) {
      message += `**Custom Templates (Legacy):**\n`;
      Object.entries(config.customTemplates).forEach(([name, template]: [string, any]) => {
        message += `• **${template.title || name}** (\`${name}\`)\n`;
        if (template.description) {
          message += `  ${template.description}\n`;
        }
      });
      message += `\n`;
    }

    message += `💡 **Usage Examples:**\n`;
    message += `• \`@bot-markdown-renderer render template="academic-standard"\` - Built-in template\n`;
    message += `• \`@bot-markdown-renderer render template="file:my-template"\` - File-based template\n`;
    message += `• \`@bot-markdown-renderer render template="minimal" output="pdf"\` - Generate PDF`;

    return {
      messages: [{ content: message }]
    };
  }
};
