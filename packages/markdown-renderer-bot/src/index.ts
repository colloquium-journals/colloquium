import { z } from 'zod';
import { marked } from 'marked';
import { JSDOM } from 'jsdom';
import DOMPurify from 'dompurify';
import * as Handlebars from 'handlebars';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as mime from 'mime-types';
import puppeteer from 'puppeteer';
import { CommandBot, BotCommand } from '@colloquium/types';

// Create DOMPurify instance
const window = new JSDOM('').window;
const purify = DOMPurify(window);

// Journal template schema
const journalTemplateSchema = z.object({
  name: z.string(),
  title: z.string(),
  description: z.string(),
  htmlTemplate: z.string(),
  cssTemplate: z.string().optional(),
  metadata: z.record(z.any()).optional()
});

// Built-in templates
const DEFAULT_TEMPLATES = {
  'academic-standard': {
    name: 'academic-standard',
    title: 'Academic Standard',
    description: 'Clean, professional academic journal template',
    htmlTemplate: `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{title}}</title>
    <style>
        body {
            max-width: 800px;
            margin: 0 auto;
            padding: 40px 20px;
            font-family: 'Times New Roman', serif;
            line-height: 1.6;
            color: #333;
        }
        .header {
            text-align: center;
            margin-bottom: 40px;
            border-bottom: 2px solid #eee;
            padding-bottom: 30px;
        }
        .title {
            font-size: 24px;
            font-weight: bold;
            margin-bottom: 20px;
        }
        .authors {
            font-size: 14px;
            margin-bottom: 10px;
        }
        .metadata {
            font-size: 12px;
            color: #666;
            margin-bottom: 20px;
        }
        .abstract {
            background: #f9f9f9;
            padding: 20px;
            border-left: 4px solid #2c5aa0;
            margin: 30px 0;
        }
        .abstract h3 {
            margin-top: 0;
            color: #2c5aa0;
        }
        .content {
            text-align: justify;
        }
        .content h1, .content h2, .content h3 {
            color: #2c5aa0;
            margin-top: 30px;
        }
        .content h1 {
            font-size: 20px;
            border-bottom: 1px solid #eee;
            padding-bottom: 10px;
        }
        .content h2 {
            font-size: 18px;
        }
        .content h3 {
            font-size: 16px;
        }
        .content img {
            max-width: 100%;
            height: auto;
            display: block;
            margin: 20px auto;
        }
        .content figure {
            text-align: center;
            margin: 20px 0;
        }
        .content figcaption {
            font-style: italic;
            font-size: 14px;
            color: #666;
            margin-top: 10px;
        }
        .content blockquote {
            border-left: 4px solid #ddd;
            margin: 20px 0;
            padding-left: 20px;
            color: #666;
        }
        .content code {
            background: #f4f4f4;
            padding: 2px 4px;
            border-radius: 3px;
            font-family: 'Courier New', monospace;
        }
        .content pre {
            background: #f4f4f4;
            padding: 15px;
            border-radius: 5px;
            overflow-x: auto;
        }
        .footer {
            margin-top: 50px;
            padding-top: 20px;
            border-top: 1px solid #eee;
            font-size: 12px;
            color: #666;
            text-align: center;
        }
    </style>
    {{#if customCss}}<style>{{customCss}}</style>{{/if}}
</head>
<body>
    <div class="header">
        <div class="title">{{title}}</div>
        {{#if authors}}
        <div class="authors">{{authors}}</div>
        {{/if}}
        <div class="metadata">
            {{#if submittedDate}}Submitted: {{submittedDate}}{{/if}}
            {{#if journalName}} • {{journalName}}{{/if}}
        </div>
    </div>

    {{#if abstract}}
    <div class="abstract">
        <h3>Abstract</h3>
        <p>{{abstract}}</p>
    </div>
    {{/if}}

    <div class="content">
        {{{content}}}
    </div>

    <div class="footer">
        Rendered by Colloquium Markdown Renderer
        {{#if renderDate}} • {{renderDate}}{{/if}}
    </div>
</body>
</html>`,
    cssTemplate: '',
    metadata: {
      type: 'academic',
      responsive: true,
      printOptimized: true
    }
  },

  'minimal': {
    name: 'minimal',
    title: 'Minimal',
    description: 'Clean, minimal template with modern typography',
    htmlTemplate: `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{title}}</title>
    <style>
        body {
            max-width: 700px;
            margin: 0 auto;
            padding: 60px 20px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.7;
            color: #374151;
        }
        .title {
            font-size: 32px;
            font-weight: 700;
            margin-bottom: 16px;
            color: #111827;
        }
        .authors {
            color: #6b7280;
            margin-bottom: 32px;
        }
        .abstract {
            background: #f9fafb;
            padding: 24px;
            border-radius: 8px;
            margin: 32px 0;
        }
        .abstract h3 {
            margin-top: 0;
            color: #374151;
            font-size: 18px;
        }
        .content h1, .content h2, .content h3 {
            color: #111827;
            margin-top: 40px;
            margin-bottom: 16px;
        }
        .content h1 { font-size: 24px; }
        .content h2 { font-size: 20px; }
        .content h3 { font-size: 18px; }
        .content img {
            max-width: 100%;
            border-radius: 8px;
            margin: 24px 0;
        }
        .content code {
            background: #f3f4f6;
            padding: 2px 6px;
            border-radius: 4px;
            font-family: 'SF Mono', Monaco, monospace;
            font-size: 14px;
        }
        .content pre {
            background: #1f2937;
            color: #f9fafb;
            padding: 20px;
            border-radius: 8px;
            overflow-x: auto;
        }
    </style>
    {{#if customCss}}<style>{{customCss}}</style>{{/if}}
</head>
<body>
    <h1 class="title">{{title}}</h1>
    {{#if authors}}<div class="authors">{{authors}}</div>{{/if}}
    
    {{#if abstract}}
    <div class="abstract">
        <h3>Abstract</h3>
        <p>{{abstract}}</p>
    </div>
    {{/if}}

    <div class="content">
        {{{content}}}
    </div>
</body>
</html>`,
    cssTemplate: '',
    metadata: {
      type: 'modern',
      responsive: true
    }
  }
};

// Main render command
const renderCommand: BotCommand = {
  name: 'render',
  description: 'Render Markdown files to HTML using journal templates',
  usage: '@markdown-renderer render [template="academic-standard"] [output="html"] [includeAssets=true]',
  parameters: [
    {
      name: 'template',
      description: 'Journal template to use for rendering (use "file:filename" for uploaded templates)',
      type: 'string',
      required: false,
      defaultValue: 'academic-standard',
      examples: ['academic-standard', 'minimal', 'file:my-template']
    },
    {
      name: 'output',
      description: 'Output format',
      type: 'enum',
      required: false,
      defaultValue: 'html',
      enumValues: ['html', 'pdf', 'both'],
      examples: ['html', 'pdf', 'both']
    },
    {
      name: 'includeAssets',
      description: 'Whether to process and include linked assets',
      type: 'boolean',
      required: false,
      defaultValue: true,
      examples: ['true', 'false']
    },
    {
      name: 'customCss',
      description: 'Custom CSS to inject into the template',
      type: 'string',
      required: false,
      examples: ['body { font-size: 18px; }']
    }
  ],
  examples: [
    '@markdown-renderer render',
    '@markdown-renderer render template="minimal"',
    '@markdown-renderer render template="academic-standard" output="both"',
    '@markdown-renderer render output="pdf"',
    '@markdown-renderer render template="minimal" customCss="body { font-size: 16px; }"'
  ],
  permissions: ['read_manuscript_files', 'upload_files'],
  async execute(params, context) {
    const { template = 'academic-standard', output = 'html', includeAssets = true, customCss } = params;
    const { manuscriptId, config } = context;

    try {
      // Step 1: Access manuscript files
      const manuscriptFiles = await getManuscriptFiles(manuscriptId);
      const markdownFile = findMarkdownFile(manuscriptFiles);
      
      if (!markdownFile) {
        return {
          messages: [{
            content: '❌ **No Markdown File Found**\n\nI couldn\'t find any Markdown files (.md, .markdown) in this manuscript. Please upload a Markdown file to render.'
          }]
        };
      }

      // Step 2: Get template
      const templateData = await getTemplate(template, config);
      
      // Step 3: Process Markdown content
      const markdownContent = await downloadFile(markdownFile.downloadUrl);
      const processedContent = await processMarkdownContent(
        markdownContent, 
        manuscriptFiles, 
        includeAssets
      );

      // Step 4: Get manuscript metadata
      const metadata = await getManuscriptMetadata(manuscriptId);

      // Step 5: Render using template
      const renderedHtml = await renderWithTemplate(templateData, {
        title: metadata.title || 'Untitled Manuscript',
        authors: metadata.authors?.join(', ') || '',
        abstract: metadata.abstract || '',
        content: processedContent.html,
        customCss,
        submittedDate: metadata.submittedAt ? new Date(metadata.submittedAt).toLocaleDateString() : '',
        renderDate: new Date().toLocaleDateString(),
        journalName: context.journal?.settings?.name || 'Colloquium Journal'
      });

      // Step 6: Generate outputs based on requested format
      const baseFilename = markdownFile.originalName.replace(/\.(md|markdown)$/i, '');
      const uploadResults = [];
      
      // Always generate HTML first (needed for PDF)
      if (output === 'html' || output === 'both') {
        const htmlFilename = `${baseFilename}.html`;
        const htmlResult = await uploadRenderedFile(manuscriptId, htmlFilename, renderedHtml, 'text/html');
        uploadResults.push({ type: 'HTML', ...htmlResult });
      }
      
      // Generate PDF if requested
      if (output === 'pdf' || output === 'both') {
        const pdfBuffer = await generatePDF(renderedHtml, templateData);
        const pdfFilename = `${baseFilename}.pdf`;
        const pdfResult = await uploadRenderedFile(manuscriptId, pdfFilename, pdfBuffer, 'application/pdf');
        uploadResults.push({ type: 'PDF', ...pdfResult });
      }

      // Step 7: Return success message
      let message = `✅ **Markdown Rendered Successfully**\n\n`;
      message += `**Source:** ${markdownFile.originalName}\n`;
      message += `**Template:** ${templateData.title}\n`;
      
      if (uploadResults.length === 1) {
        message += `**Output:** ${uploadResults[0].filename}\n`;
        const size = uploadResults[0].type === 'PDF' ? 
          `${(uploadResults[0].size / 1024).toFixed(1)} KB` : 
          `${(renderedHtml.length / 1024).toFixed(1)} KB`;
        message += `**Size:** ${size}\n\n`;
      } else {
        message += `**Outputs Generated:**\n`;
        uploadResults.forEach(result => {
          const size = result.type === 'PDF' ? 
            `${(result.size / 1024).toFixed(1)} KB` : 
            `${(renderedHtml.length / 1024).toFixed(1)} KB`;
          message += `• ${result.type}: ${result.filename} (${size})\n`;
        });
        message += `\n`;
      }
      
      if (processedContent.processedAssets > 0) {
        message += `📎 **Assets Processed:** ${processedContent.processedAssets} files linked\n`;
      }
      
      if (processedContent.warnings.length > 0) {
        message += `\n⚠️ **Warnings:**\n`;
        processedContent.warnings.forEach(warning => {
          message += `• ${warning}\n`;
        });
      }

      if (uploadResults.length === 1) {
        message += `\n🔗 **[View Rendered File](${uploadResults[0].downloadUrl})**`;
      } else {
        message += `\n**Download Links:**\n`;
        uploadResults.forEach(result => {
          message += `🔗 [${result.type}](${result.downloadUrl})\n`;
        });
      }

      return {
        messages: [{ content: message }],
        actions: uploadResults.map(result => ({
          type: 'FILE_UPLOADED',
          data: { 
            fileId: result.id,
            filename: result.filename,
            type: 'RENDERED',
            format: result.type.toLowerCase()
          }
        }))
      };

    } catch (error) {
      console.error('Markdown rendering failed:', error);
      return {
        messages: [{
          content: `❌ **Rendering Failed**\n\nAn error occurred while rendering the Markdown file:\n\`\`\`\n${error instanceof Error ? error.message : 'Unknown error'}\n\`\`\``
        }],
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }
};

// File upload command
const uploadTemplateCommand: BotCommand = {
  name: 'upload-template',
  description: 'Instructions for uploading custom journal templates',
  usage: '@markdown-renderer upload-template',
  parameters: [],
  examples: ['@markdown-renderer upload-template'],
  permissions: [],
  async execute(params, context) {
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
    message += `• Use \`@markdown-renderer render template="file:my-template"\`\n`;
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

// Template management commands
const listTemplatesCommand: BotCommand = {
  name: 'templates',
  description: 'List available journal templates',
  usage: '@markdown-renderer templates',
  parameters: [],
  examples: ['@markdown-renderer templates'],
  permissions: [],
  async execute(params, context) {
    const { config } = context;
    
    let message = `📝 **Available Journal Templates**\n\n`;
    
    // List built-in templates
    Object.values(DEFAULT_TEMPLATES).forEach(template => {
      message += `**${template.title}** (\`${template.name}\`)\n`;
      message += `${template.description}\n\n`;
    });

    // List file-based templates
    try {
      const response = await fetch('http://localhost:4000/api/bot-config-files/markdown-renderer/files?category=template');
      if (response.ok) {
        const data = await response.json();
        if (data.files && data.files.length > 0) {
          message += `**File-based Templates:**\n`;
          data.files.forEach((file: any) => {
            const fileName = file.filename.replace(/\.html?$/i, '');
            message += `• **${file.description || fileName}** (\`file:${fileName}\`)\n`;
            message += `  Uploaded: ${new Date(file.uploadedAt).toLocaleDateString()}\n`;
          });
          message += `\n`;
        }
      }
    } catch (error) {
      // Silently continue if file templates can't be loaded
      console.warn('Failed to load file-based templates for listing:', error);
    }

    // List custom templates from config (legacy)
    if (config.customTemplates && Object.keys(config.customTemplates).length > 0) {
      message += `**Config Templates (Legacy):**\n`;
      Object.entries(config.customTemplates).forEach(([name, template]: [string, any]) => {
        message += `• **${template.title || name}** (\`${name}\`)\n`;
        if (template.description) {
          message += `  ${template.description}\n`;
        }
      });
      message += `\n`;
    }

    message += `💡 **Usage Examples:**\n`;
    message += `• \`@markdown-renderer render template="academic-standard"\` - Built-in template\n`;
    message += `• \`@markdown-renderer render template="file:my-template"\` - File-based template\n`;
    message += `• \`@markdown-renderer render template="minimal" output="pdf"\` - Generate PDF`;

    return {
      messages: [{ content: message }]
    };
  }
};

// Remove the manual help command - it will be auto-injected by the framework

// Helper functions
async function getManuscriptFiles(manuscriptId: string): Promise<any[]> {
  // TODO: Implement API call to get manuscript files
  // This would call the API endpoint we need to create
  const response = await fetch(`http://localhost:4000/api/manuscripts/${manuscriptId}/files`, {
    credentials: 'include'
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch manuscript files: ${response.statusText}`);
  }
  
  const data = await response.json();
  return data.files || [];
}

function findMarkdownFile(files: any[]): any | null {
  return files.find(file => 
    file.fileType === 'SOURCE' && 
    (file.mimetype?.includes('markdown') || 
     file.originalName.match(/\.(md|markdown)$/i) ||
     file.detectedFormat === 'markdown')
  );
}

async function downloadFile(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download file: ${response.statusText}`);
  }
  return await response.text();
}

async function processMarkdownContent(
  content: string, 
  manuscriptFiles: any[], 
  includeAssets: boolean
): Promise<{ html: string; processedAssets: number; warnings: string[] }> {
  const warnings: string[] = [];
  let processedAssets = 0;

  // Configure marked with security and academic features
  marked.setOptions({
    breaks: true,
    gfm: true
  });

  // Process asset links if requested
  if (includeAssets) {
    // Find image and link references in markdown
    const assetPattern = /!\[([^\]]*)\]\(([^)]+)\)|(?<!\!)\[([^\]]*)\]\(([^)]+)\)/g;
    
    content = content.replace(assetPattern, (match, imageAlt, imageUrl, linkText, linkUrl) => {
      if (imageAlt !== undefined) {
        // It's an image
        const asset = findAssetFile(manuscriptFiles, imageUrl);
        if (asset) {
          processedAssets++;
          return `![${imageAlt}](${asset.downloadUrl})`;
        } else {
          warnings.push(`Image not found: ${imageUrl}`);
        }
      } else if (linkText !== undefined) {
        // It's a regular link
        const asset = findAssetFile(manuscriptFiles, linkUrl);
        if (asset) {
          processedAssets++;
          return `[${linkText}](${asset.downloadUrl})`;
        }
      }
      return match;
    });
  }

  // Convert markdown to HTML
  const html = marked(content);
  
  // Sanitize HTML for security
  const cleanHtml = purify.sanitize(html);

  return { html: cleanHtml, processedAssets, warnings };
}

function findAssetFile(files: any[], filename: string): any | null {
  // Remove leading ./ or / from filename
  const cleanFilename = filename.replace(/^\.?\//, '');
  
  return files.find(file => 
    file.fileType === 'ASSET' && 
    (file.originalName === cleanFilename || 
     file.originalName.endsWith('/' + cleanFilename) ||
     file.path?.endsWith(cleanFilename))
  );
}

async function getTemplate(templateName: string, config: any): Promise<any> {
  // Check built-in templates first
  if (DEFAULT_TEMPLATES[templateName as keyof typeof DEFAULT_TEMPLATES]) {
    return DEFAULT_TEMPLATES[templateName as keyof typeof DEFAULT_TEMPLATES];
  }

  // Check for file-based custom templates
  if (templateName.startsWith('file:')) {
    const fileName = templateName.replace('file:', '');
    return await getFileBasedTemplate(fileName);
  }

  // Check custom templates from config (legacy support)
  if (config.customTemplates && config.customTemplates[templateName]) {
    return config.customTemplates[templateName];
  }

  // Fallback to academic-standard
  return DEFAULT_TEMPLATES['academic-standard'];
}

async function getFileBasedTemplate(fileName: string): Promise<any> {
  try {
    // Fetch template file from bot config files API
    const response = await fetch('http://localhost:4000/api/bot-config-files/markdown-renderer/files?category=template');
    
    if (!response.ok) {
      throw new Error(`Failed to fetch template files: ${response.statusText}`);
    }
    
    const data = await response.json();
    const templateFile = data.files.find((file: any) => 
      file.filename === fileName || file.filename === `${fileName}.html`
    );
    
    if (!templateFile) {
      throw new Error(`Template file '${fileName}' not found`);
    }
    
    // Get template content
    const contentResponse = await fetch(`http://localhost:4000/api/bot-config-files/${templateFile.id}/content`);
    
    if (!contentResponse.ok) {
      throw new Error(`Failed to fetch template content: ${contentResponse.statusText}`);
    }
    
    const contentData = await contentResponse.json();
    
    // Look for associated CSS file
    let cssContent = '';
    const cssFile = data.files.find((file: any) => 
      file.category === 'css' && 
      (file.filename === `${fileName}.css` || file.filename.startsWith(fileName))
    );
    
    if (cssFile) {
      const cssResponse = await fetch(`http://localhost:4000/api/bot-config-files/${cssFile.id}/content`);
      if (cssResponse.ok) {
        const cssData = await cssResponse.json();
        cssContent = cssData.file.content;
      }
    }
    
    return {
      name: fileName,
      title: templateFile.description || fileName,
      description: `Custom template: ${fileName}`,
      htmlTemplate: contentData.file.content,
      cssTemplate: cssContent,
      metadata: {
        type: 'custom',
        source: 'file',
        uploadedAt: templateFile.uploadedAt
      }
    };
    
  } catch (error) {
    console.error(`Failed to load file-based template '${fileName}':`, error);
    // Fallback to academic-standard if file template fails
    return DEFAULT_TEMPLATES['academic-standard'];
  }
}

async function renderWithTemplate(template: any, data: any): Promise<string> {
  const compiledTemplate = Handlebars.compile(template.htmlTemplate);
  return compiledTemplate(data);
}

async function getManuscriptMetadata(manuscriptId: string): Promise<any> {
  // TODO: Implement API call to get manuscript metadata
  const response = await fetch(`http://localhost:4000/api/manuscripts/${manuscriptId}`, {
    credentials: 'include'
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch manuscript metadata: ${response.statusText}`);
  }
  
  return await response.json();
}

async function generatePDF(htmlContent: string, template: any): Promise<Buffer> {
  let browser;
  
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    });

    const page = await browser.newPage();
    
    // Set content with base URL for relative assets
    await page.setContent(htmlContent, {
      waitUntil: 'networkidle0'
    });

    // Configure PDF generation based on template metadata
    const pdfOptions: any = {
      format: 'A4',
      margin: {
        top: '0.75in',
        right: '0.75in',
        bottom: '0.75in',
        left: '0.75in'
      },
      printBackground: true,
      preferCSSPageSize: true
    };

    // Apply template-specific PDF settings
    if (template.metadata?.printOptimized) {
      pdfOptions.format = 'A4';
      pdfOptions.margin = {
        top: '1in',
        right: '1in',
        bottom: '1in',
        left: '1in'
      };
    }

    const pdfBuffer = await page.pdf(pdfOptions);
    
    return pdfBuffer;
    
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

async function uploadRenderedFile(
  manuscriptId: string, 
  filename: string, 
  content: string | Buffer, 
  mimeType: string = 'text/html'
): Promise<any> {
  // TODO: Implement API call to upload rendered file
  const formData = new FormData();
  
  const blob = typeof content === 'string' 
    ? new Blob([content], { type: mimeType })
    : new Blob([content], { type: mimeType });
    
  formData.append('file', blob, filename);
  formData.append('fileType', 'RENDERED');
  formData.append('renderedBy', 'markdown-renderer');
  
  const response = await fetch(`http://localhost:4000/api/manuscripts/${manuscriptId}/files`, {
    method: 'POST',
    credentials: 'include',
    body: formData
  });
  
  if (!response.ok) {
    throw new Error(`Failed to upload rendered file: ${response.statusText}`);
  }
  
  const result = await response.json();
  
  // Add size information for tracking
  return {
    ...result.files[0], // Assuming single file upload returns files array
    size: typeof content === 'string' ? content.length : content.length
  };
}

// Export the bot
export const markdownRendererBot: CommandBot = {
  id: 'markdown-renderer',
  name: 'Markdown Renderer',
  description: 'Renders Markdown manuscripts into beautiful HTML using configurable journal templates',
  version: '1.0.0',
  commands: [renderCommand, listTemplatesCommand, uploadTemplateCommand],
  keywords: ['markdown', 'render', 'template', 'html', 'format'],
  triggers: ['MANUSCRIPT_SUBMITTED', 'FILE_UPLOADED'],
  permissions: ['read_manuscript_files', 'upload_files'],
  supportsFileUploads: true,
  help: {
    overview: 'The Markdown Renderer bot converts Markdown manuscripts into beautifully formatted HTML using configurable journal templates. It supports asset linking, custom CSS, and multiple output formats.',
    quickStart: 'Use `@markdown-renderer render` to convert your Markdown manuscript to HTML using the default academic template.',
    examples: [
      '@markdown-renderer render - Render with default academic template',
      '@markdown-renderer templates - List available templates',
      '@markdown-renderer render template="minimal" - Use minimal template',
      '@markdown-renderer render customCss="body { font-size: 18px; }" - Add custom CSS'
    ]
  },
  customHelpSections: [
    {
      title: '✨ What I Can Do',
      content: '✅ Convert Markdown to professional HTML\n✅ Generate print-ready PDFs\n✅ Apply journal-specific formatting\n✅ Handle images and assets\n✅ Support custom CSS styling\n✅ Use custom uploaded templates',
      position: 'before'
    },
    {
      title: '🚀 Quick Start',
      content: '1. Submit a Markdown manuscript\n2. Use `@markdown-renderer render` to convert to HTML\n3. Add `output="pdf"` to generate a PDF\n4. Use `template="minimal"` for different styling',
      position: 'before'
    },
    {
      title: '💡 Tips for Best Results',
      content: 'Use standard Markdown syntax for best results. Place images in the same directory as your Markdown file. Custom templates can be uploaded via bot configuration. PDF generation may take a few seconds for complex documents.',
      position: 'after'
    }
  ]
};

// Export the bot for npm package compatibility
export default markdownRendererBot;