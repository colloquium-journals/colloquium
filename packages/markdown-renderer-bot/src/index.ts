import { z } from 'zod';
import { marked } from 'marked';
import { JSDOM } from 'jsdom';
import DOMPurify from 'dompurify';
import * as Handlebars from 'handlebars';
import * as fs from 'fs-extra';
import * as path from 'path';
// Service URL for the Pandoc microservice
const PANDOC_SERVICE_URL = process.env.PANDOC_SERVICE_URL || 'http://localhost:8080';
import { CommandBot, BotCommand, BotInstallationContext } from '@colloquium/types';

// Create DOMPurify instance
const window = new JSDOM('').window;
const purify = DOMPurify(window);

// Configuration schemas
const templateFileSchema = z.object({
  fileId: z.string().describe('ID of the uploaded file'),
  filename: z.string().describe('Original filename for reference'),
  engine: z.enum(['html', 'latex', 'typst']).describe('Rendering engine this file is for'),
  metadata: z.record(z.any()).optional().describe('Additional metadata about this file')
});

const templateDefinitionSchema = z.object({
  name: z.string().describe('Template identifier'),
  title: z.string().describe('Display name for the template'),
  description: z.string().describe('Template description'),
  defaultEngine: z.enum(['html', 'latex', 'typst']).describe('Default rendering engine'),
  files: z.array(templateFileSchema).describe('Files that make up this template'),
  metadata: z.object({
    type: z.string().optional(),
    responsive: z.boolean().optional(),
    printOptimized: z.boolean().optional(),
    features: z.record(z.boolean()).optional()
  }).optional().describe('Template metadata and features')
});

const botConfigSchema = z.object({
  templateName: z.string().default('academic-standard').describe('Default template to use'),
  outputFormats: z.array(z.string()).default(['pdf']).describe('Default output formats'),
  requireSeparateBibliography: z.boolean().default(false).describe('Whether bibliography must be separate file'),
  templates: z.record(templateDefinitionSchema).describe('Available templates mapped by name'),
  customTemplates: z.record(z.any()).optional().describe('Legacy custom template definitions')
});

// Template loading functions
async function loadBuiltInTemplates(): Promise<Record<string, any>> {
  const templatesDir = path.join(__dirname, '..', 'templates');
  const templates: Record<string, any> = {};

  try {
    const entries = await fs.readdir(templatesDir, { withFileTypes: true });

    // Find all template directories
    const templateDirs = entries.filter(entry => entry.isDirectory());

    // Load each template from its directory
    for (const dir of templateDirs) {
      const templateName = dir.name;
      const templateDir = path.join(templatesDir, templateName);

      try {
        const jsonPath = path.join(templateDir, 'template.json');

        if (await fs.pathExists(jsonPath)) {
          const metadata = await fs.readJson(jsonPath);
          const template: any = { ...metadata };

          // Load HTML template if exists
          const htmlPath = path.join(templateDir, 'template.html');
          if (await fs.pathExists(htmlPath)) {
            template.htmlTemplate = await fs.readFile(htmlPath, 'utf-8');
          }

          // Load LaTeX template if exists
          const texPath = path.join(templateDir, 'template.tex');
          if (await fs.pathExists(texPath)) {
            template.latexTemplate = await fs.readFile(texPath, 'utf-8');
          }

          // Load Typst template if exists
          const typPath = path.join(templateDir, 'template.typ');
          if (await fs.pathExists(typPath)) {
            template.typstTemplate = await fs.readFile(typPath, 'utf-8');
          }

          templates[templateName] = template;
        }
      } catch (error) {
        console.warn(`Failed to load template ${templateName}:`, error);
      }
    }
  } catch (error) {
    console.warn('Failed to load built-in templates:', error);
  }

  return templates;
}

// Fetch template content by file ID
async function fetchTemplateContentById(fileId: string): Promise<string> {
  try {
    const response = await fetch(`http://localhost:4000/api/bot-config-files/${fileId}/content`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch template content: ${response.statusText}`);
    }
    
    return await response.text();
  } catch (error) {
    console.error(`Failed to fetch template content for file ${fileId}:`, error);
    throw error;
  }
}

// Cache for loaded templates
let BUILT_IN_TEMPLATES: Record<string, any> | null = null;

async function getBuiltInTemplates(): Promise<Record<string, any>> {
  if (!BUILT_IN_TEMPLATES) {
    BUILT_IN_TEMPLATES = await loadBuiltInTemplates();
  }
  return BUILT_IN_TEMPLATES;
}

// Main render command
const renderCommand: BotCommand = {
  name: 'render',
  description: 'Render Markdown files to PDF or HTML using journal templates',
  usage: '@bot-markdown-renderer render [output=pdf|html] [template=name] [engine=typst|latex|html]',
  parameters: [
    {
      name: 'output',
      description: 'Output format(s)',
      type: 'string',
      required: false,
      enumValues: ['pdf', 'html', 'pdf,html']
    },
    {
      name: 'template',
      description: 'Template to use',
      type: 'string',
      required: false
    },
    {
      name: 'engine',
      description: 'Rendering engine for PDF generation',
      type: 'string',
      required: false,
      enumValues: ['typst', 'latex', 'html']
    }
  ],
  examples: [
    '@bot-markdown-renderer render',
    '@bot-markdown-renderer render output=html',
    '@bot-markdown-renderer render output=pdf engine=typst',
    '@bot-markdown-renderer render template=academic-standard output=html'
  ],
  permissions: ['read_manuscript_files', 'upload_files'],
  async execute(params, context) {
    const { manuscriptId, config, serviceToken } = context;
    
    // Extract configuration from parameters (override journal settings)
    const pdfEngine = params.engine || config.pdfEngine || 'typst';
    const templateName = params.template || config.templateName || 'academic-standard';
    const outputFormats = params.output ? params.output.split(',') : (config.outputFormats || ['pdf']);
    const requireSeparateBibliography = config.requireSeparateBibliography || false;

    if (!serviceToken) {
      return {
        messages: [{
          content: '❌ **Authentication Error**\n\nBot service token not available. Please contact system administrator.'
        }],
        errors: ['Bot service token not available']
      };
    }

    try {
      // Step 1: Access manuscript files
      console.log(`DEBUG: Fetching files for manuscript: ${manuscriptId}`);
      const manuscriptFiles = await getManuscriptFiles(manuscriptId, serviceToken);
      console.log(`DEBUG: Found ${manuscriptFiles.length} files`);
      console.log(`DEBUG: Files:`, manuscriptFiles.map(f => ({
        originalName: f.originalName,
        fileType: f.fileType,
        downloadUrl: f.downloadUrl
      })));
      
      const markdownFile = findMarkdownFile(manuscriptFiles);
      console.log(`DEBUG: Selected markdown file:`, markdownFile);
      
      if (!markdownFile) {
        return {
          messages: [{
            content: '❌ **No Markdown File Found**\n\nI couldn\'t find any Markdown files (.md, .markdown) in this manuscript. Please upload a Markdown file to render.'
          }]
        };
      }

      // Step 2: Get template
      const templateData = await getTemplate(templateName, pdfEngine, config);
      
      // Step 3: Process Markdown content
      const markdownContent = await downloadFile(markdownFile.downloadUrl, serviceToken);
      const processedContent = await processMarkdownContent(
        markdownContent, 
        manuscriptFiles, 
        true // Always include assets
      );
      
      // Debug: Check for citations in markdown
      const citationMatches = markdownContent.match(/\[@[^\]]+\]/g);
      if (citationMatches) {
        console.log(`DEBUG: Found ${citationMatches.length} citation(s):`, citationMatches);
      } else {
        console.log(`DEBUG: No Pandoc-style citations found in markdown`);
        console.log(`DEBUG: First 500 chars of markdown:`, markdownContent.substring(0, 500));
      }

      // Step 4: Find bibliography file
      const bibliographyFile = findBibliographyFile(manuscriptFiles);
      let bibliographyContent = '';
      if (bibliographyFile) {
        console.log(`DEBUG: Found bibliography file: ${bibliographyFile.originalName}`);
        bibliographyContent = await downloadFile(bibliographyFile.downloadUrl, serviceToken);
        console.log(`DEBUG: Bibliography content length: ${bibliographyContent.length} chars`);
        console.log(`DEBUG: First 200 chars of bibliography:`, bibliographyContent.substring(0, 200));
      }

      // Step 5: Get manuscript metadata
      const metadata = await getManuscriptMetadata(manuscriptId, serviceToken);

      // Step 6: Prepare author data for templates
      const authorData = await prepareAuthorData(metadata);
      
      // Step 6: Generate outputs based on journal configuration
      const baseFilename = markdownFile.originalName.replace(/\.(md|markdown)$/i, '');
      const uploadResults = [];
      
      // Prepare template variables
      const templateVariables = {
        title: metadata.title || 'Untitled Manuscript',
        authors: authorData.authorsString,
        authorList: authorData.authorList,
        authorCount: authorData.authorCount,
        correspondingAuthor: authorData.correspondingAuthor,
        abstract: metadata.abstract || '',
        content: processedContent.html,
        submittedDate: metadata.submittedAt ? new Date(metadata.submittedAt).toLocaleDateString() : '',
        renderDate: new Date().toLocaleDateString(),
        journalName: context.journal?.settings?.name || 'Colloquium Journal'
      };
      
      // Generate outputs based on configuration
      for (const format of outputFormats) {
        if (format === 'html') {
          // For HTML, use Pandoc to process citations and bibliography
          const htmlTemplateData = await getTemplate(templateName, 'html', config);
          const htmlBuffer = await generatePandocHTML(markdownContent, htmlTemplateData, templateVariables, bibliographyContent, manuscriptFiles, serviceToken);
          const htmlFilename = `${baseFilename}.html`;
          const htmlResult = await uploadRenderedFile(manuscriptId, htmlFilename, htmlBuffer, 'text/html', serviceToken);
          uploadResults.push({ type: 'HTML', ...htmlResult });
        } else if (format === 'pdf') {
          // For PDF generation, use Typst/LaTeX engine with appropriate template
          const pdfTemplateData = await getTemplate(templateName, pdfEngine, config);
          const pdfBuffer = await generatePandocPDF(markdownContent, pdfTemplateData, pdfEngine, templateVariables, bibliographyContent, manuscriptFiles, serviceToken);
          const pdfFilename = `${baseFilename}.pdf`;
          const pdfResult = await uploadRenderedFile(manuscriptId, pdfFilename, pdfBuffer, 'application/pdf', serviceToken);
          uploadResults.push({ type: 'PDF', ...pdfResult });
        }
      }
      
      console.log(`DEBUG: Upload results:`, uploadResults.map(r => ({ type: r.type, filename: r.filename })));

      // Step 7: Return success message
      let message = `✅ **Markdown Rendered Successfully**\n\n`;
      message += `**Source:** ${markdownFile.originalName}\n`;
      message += `**Template:** ${templateData.title}\n`;
      message += `**Engine:** ${pdfEngine.toUpperCase()}\n`;
      
      if (uploadResults.length === 1) {
        message += `**Output:** ${uploadResults[0].filename}\n`;
        const size = `${(uploadResults[0].size / 1024).toFixed(1)} KB`;
        message += `**Size:** ${size}\n\n`;
      } else {
        message += `**Outputs Generated:**\n`;
        uploadResults.forEach(result => {
          const size = `${(result.size / 1024).toFixed(1)} KB`;
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
        }]
      };
    }
  }
};

// File upload command
const uploadTemplateCommand: BotCommand = {
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

// Template management commands
const listTemplatesCommand: BotCommand = {
  name: 'templates',
  description: 'List available journal templates',
  usage: '@bot-markdown-renderer templates',
  parameters: [],
  examples: ['@bot-markdown-renderer templates'],
  permissions: [],
  async execute(_params, context) {
    const { config } = context;
    
    let message = `📝 **Available Journal Templates**\n\n`;
    
    // List configured templates with explicit file mappings
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

    // Fallback: List built-in templates (for backwards compatibility)
    const builtInTemplates = await getBuiltInTemplates();
    if (Object.keys(builtInTemplates).length > 0) {
      message += `**Built-in Templates (Legacy):**\n`;
      Object.values(builtInTemplates).forEach((template: any) => {
        message += `• **${template.title}** (\`${template.name}\`)\n`;
        message += `  ${template.description}\n\n`;
      });
    }

    // List custom templates from config (legacy)
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

// Remove the manual help command - it will be auto-injected by the framework

// Helper functions
async function getManuscriptFiles(manuscriptId: string, serviceToken: string): Promise<any[]> {
  const url = `http://localhost:4000/api/articles/${manuscriptId}/files`;
  console.log(`DEBUG: Fetching files from: ${url}`);
  console.log(`DEBUG: Service token present: ${!!serviceToken}`);
  
  const response = await fetch(url, {
    headers: {
      'x-bot-token': serviceToken,
      'content-type': 'application/json'
    }
  });
  
  console.log(`DEBUG: Files API response: ${response.status} ${response.statusText}`);
  
  if (!response.ok) {
    const errorText = await response.text();
    console.log(`DEBUG: Error response body:`, errorText);
    throw new Error(`Failed to fetch manuscript files: ${response.statusText}`);
  }
  
  const data = await response.json();
  console.log(`DEBUG: Files API response data:`, data);
  return data.files || [];
}

function findMarkdownFile(files: any[]): any | null {
  // Try to find markdown files with multiple criteria, prioritizing SOURCE files
  let markdownFile = files.find(file => 
    file.fileType === 'SOURCE' && 
    (file.mimetype?.includes('markdown') || 
     file.originalName.match(/\.(md|markdown)$/i) ||
     file.detectedFormat === 'markdown')
  );
  
  // If no SOURCE markdown file found, look for any markdown file
  if (!markdownFile) {
    markdownFile = files.find(file => 
      file.mimetype?.includes('markdown') || 
      file.originalName.match(/\.(md|markdown)$/i) ||
      file.detectedFormat === 'markdown'
    );
  }
  
  // Final fallback: look for files with .md/.markdown extension regardless of other fields
  if (!markdownFile) {
    markdownFile = files.find(file => 
      file.originalName.match(/\.(md|markdown)$/i)
    );
  }
  
  return markdownFile;
}

async function downloadFile(downloadUrl: string, serviceToken: string): Promise<string> {
  // Convert relative URL to absolute URL for internal API calls
  const baseUrl = 'http://localhost:4000';
  const fullUrl = downloadUrl.startsWith('http') ? downloadUrl : `${baseUrl}${downloadUrl}`;
  
  console.log(`DEBUG: Downloading file from: ${fullUrl}`);
  console.log(`DEBUG: Using service token: ${serviceToken ? 'present' : 'missing'}`);
  
  const response = await fetch(fullUrl, {
    headers: {
      'x-bot-token': serviceToken
    }
  });
  
  console.log(`DEBUG: Download response status: ${response.status} ${response.statusText}`);
  
  if (!response.ok) {
    throw new Error(`Failed to download file: ${response.statusText}`);
  }
  
  return await response.text();
}

async function processMarkdownContent(
  content: string, 
  manuscriptFiles: any[], 
  includeAssets: boolean
): Promise<{ html: string; markdown: string; processedAssets: number; warnings: string[] }> {
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
          // Add inline=true parameter for images to enable public viewing
          const imageUrl = asset.downloadUrl.includes('?') 
            ? `${asset.downloadUrl}&inline=true`
            : `${asset.downloadUrl}?inline=true`;
          return `![${imageAlt}](${imageUrl})`;
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

  return { html: cleanHtml, markdown: content, processedAssets, warnings };
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

function findBibliographyFile(files: any[]): any | null {
  return files.find(file => 
    file.originalName.match(/\.(bib|bibtex)$/i) ||
    file.detectedFormat === 'bibtex'
  );
}

async function getTemplate(templateName: string, pdfEngine: string, config: any): Promise<any> {
  // First check the new file ID-based templates in config
  if (config.templates && config.templates[templateName]) {
    const templateDef = config.templates[templateName];
    
    // Find the file for the requested engine
    const templateFile = templateDef.files.find((file: any) => file.engine === pdfEngine);
    
    if (templateFile) {
      try {
        // Fetch the template content using the file ID
        const templateContent = await fetchTemplateContentById(templateFile.fileId);
        
        return {
          name: templateDef.name,
          title: templateDef.title,
          description: templateDef.description,
          engines: templateDef.files.map((f: any) => f.engine),
          defaultEngine: templateDef.defaultEngine,
          [`${pdfEngine}Template`]: templateContent,
          metadata: templateDef.metadata || {}
        };
      } catch (error) {
        console.warn(`Failed to load template file ${templateFile.fileId} for ${templateName}:`, error);
      }
    }
  }

  // Fallback to legacy built-in templates
  const builtInTemplates = await getBuiltInTemplates();
  if (builtInTemplates[templateName]) {
    const template = builtInTemplates[templateName];
    
    // Validate that the template supports the requested engine
    if (template.engines && !template.engines.includes(pdfEngine)) {
      console.warn(`Template ${templateName} does not support engine ${pdfEngine}`);
    }
    
    return template;
  }

  // Check for file-based custom templates (legacy)
  if (templateName.startsWith('file:')) {
    const fileName = templateName.replace('file:', '');
    return await getFileBasedTemplate(fileName);
  }

  // Check custom templates from config (legacy support)
  if (config.customTemplates && config.customTemplates[templateName]) {
    return config.customTemplates[templateName];
  }

  // Final fallback
  return {
    name: 'fallback',
    title: 'Fallback Template',
    description: 'Basic fallback template',
    htmlTemplate: '<html><body><h1>{{title}}</h1><div>{{{content}}}</div></body></html>',
    latexTemplate: '\\documentclass{article}\\begin{document}\\title{{{title}}}\\maketitle{{{content}}}\\end{document}',
    typstTemplate: '#set page(paper: "a4")\\n#set text(size: 12pt)\\n= {{title}}\\n\\n{{content}}',
    engines: ['html', 'latex', 'typst'],
    defaultEngine: 'html',
    metadata: { type: 'fallback' }
  };
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
    const builtInTemplates = await getBuiltInTemplates();
    return builtInTemplates['academic-standard'] || {
      name: 'fallback',
      title: 'Fallback Template',
      description: 'Basic fallback template',
      htmlTemplate: '<html><body><h1>{{title}}</h1><div>{{{content}}}</div></body></html>',
      cssTemplate: '',
      metadata: { type: 'basic' }
    };
  }
}

async function renderWithTemplate(template: any, data: any): Promise<string> {
  const compiledTemplate = Handlebars.compile(template.htmlTemplate);
  return compiledTemplate(data);
}

async function getManuscriptMetadata(manuscriptId: string, serviceToken: string): Promise<any> {
  const response = await fetch(`http://localhost:4000/api/articles/${manuscriptId}`, {
    headers: {
      'x-bot-token': serviceToken,
      'content-type': 'application/json'
    }
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch manuscript metadata: ${response.statusText}`);
  }
  
  return await response.json();
}

async function prepareAuthorData(metadata: any): Promise<{
  authorsString: string;
  authorList: any[];
  authorCount: number;
  correspondingAuthor: any | null;
}> {
  // Initialize with empty/default values
  let authorList: any[] = [];
  let correspondingAuthor: any | null = null;
  
  try {
    // Check if we have detailed author relations
    if (metadata.authorRelations && Array.isArray(metadata.authorRelations)) {
      // Sort authors by order field
      const sortedAuthors = metadata.authorRelations.sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
      
      authorList = sortedAuthors.map((authorRel: any) => {
        const author = authorRel.user || {};
        return {
          id: author.id || null,
          name: author.name || 'Unknown Author',
          email: author.email || null,
          orcidId: author.orcidId || null,
          affiliation: author.affiliation || null,
          bio: author.bio || null,
          website: author.website || null,
          isCorresponding: authorRel.isCorresponding || false,
          order: authorRel.order || 0,
          isRegistered: !!author.id
        };
      });
      
      // Find corresponding author
      correspondingAuthor = authorList.find(author => author.isCorresponding) || null;
    }
    // Fallback to simple author array if no detailed relations
    else if (metadata.authors && Array.isArray(metadata.authors)) {
      authorList = metadata.authors.map((name: string, index: number) => ({
        id: null,
        name: name.trim(),
        email: null,
        orcidId: null,
        affiliation: null,
        bio: null,
        website: null,
        isCorresponding: index === 0, // Assume first author is corresponding
        order: index,
        isRegistered: false
      }));
      
      correspondingAuthor = authorList[0] || null;
    }
  } catch (error) {
    console.warn('Error processing author data:', error);
  }
  
  // Generate backward-compatible authors string
  const authorsString = authorList.length > 0 
    ? authorList.map(author => author.name).join(', ')
    : '';
  
  return {
    authorsString,
    authorList,
    authorCount: authorList.length,
    correspondingAuthor
  };
}

async function collectAssetFiles(
  markdownContent: string,
  manuscriptFiles: any[],
  serviceToken: string
): Promise<Array<{filename: string; content: string; encoding: string}>> {
  const assetFiles: Array<{filename: string; content: string; encoding: string}> = [];

  try {
    // Log input details for debugging
    console.log(`DEBUG collectAssetFiles: manuscriptFiles count: ${manuscriptFiles.length}`);
    console.log(`DEBUG collectAssetFiles: manuscriptFiles details:`, JSON.stringify(manuscriptFiles.map(f => ({
      originalName: f.originalName,
      fileType: f.fileType,
      downloadUrl: f.downloadUrl
    })), null, 2));
    console.log(`DEBUG collectAssetFiles: serviceToken present: ${!!serviceToken}, length: ${serviceToken?.length || 0}`);

    // Find all image references in the markdown
    const imagePattern = /!\[([^\]]*)\]\(([^)]+)\)/g;
    const imageMatches = [...markdownContent.matchAll(imagePattern)];

    console.log(`DEBUG collectAssetFiles: Found ${imageMatches.length} image references in markdown`);

    for (const match of imageMatches) {
      const imagePath = match[2];
      const cleanFilename = imagePath.replace(/^\.?\//, '');

      console.log(`DEBUG collectAssetFiles: Looking for image file: "${cleanFilename}"`);

      // Log all ASSET files for comparison
      const assetFilesInList = manuscriptFiles.filter(f => f.fileType === 'ASSET');
      console.log(`DEBUG collectAssetFiles: Available ASSET files: ${assetFilesInList.length}`,
        assetFilesInList.map(f => `"${f.originalName}"`).join(', '));

      // Find the corresponding asset file
      const assetFile = manuscriptFiles.find(file =>
        file.fileType === 'ASSET' &&
        (file.originalName === cleanFilename ||
         file.originalName.endsWith('/' + cleanFilename) ||
         file.path?.endsWith(cleanFilename))
      );

      if (assetFile) {
        console.log(`DEBUG collectAssetFiles: Found asset file: ${assetFile.originalName}, downloading from ${assetFile.downloadUrl}...`);

        try {
          // Download the asset file
          const downloadUrl = assetFile.downloadUrl.startsWith('http') ?
            assetFile.downloadUrl :
            `http://localhost:4000${assetFile.downloadUrl}`;
          console.log(`DEBUG collectAssetFiles: Full download URL: ${downloadUrl}`);

          const response = await fetch(downloadUrl, {
            headers: {
              'x-bot-token': serviceToken
            }
          });

          console.log(`DEBUG collectAssetFiles: Download response status: ${response.status} ${response.statusText}`);

          if (response.ok) {
            const buffer = await response.arrayBuffer();
            const base64Content = Buffer.from(buffer).toString('base64');

            assetFiles.push({
              filename: cleanFilename,
              content: base64Content,
              encoding: 'base64'
            });

            console.log(`DEBUG collectAssetFiles: Successfully collected asset: ${cleanFilename} (${buffer.byteLength} bytes)`);
          } else {
            const errorText = await response.text().catch(() => 'Could not read error body');
            console.warn(`DEBUG collectAssetFiles: Failed to download asset ${cleanFilename}: ${response.status} ${response.statusText} - ${errorText}`);
          }
        } catch (downloadError) {
          console.warn(`DEBUG collectAssetFiles: Error downloading asset ${cleanFilename}:`, downloadError);
        }
      } else {
        console.warn(`DEBUG collectAssetFiles: Asset file not found in list: "${cleanFilename}"`);
        // Log comparison details
        for (const file of manuscriptFiles) {
          if (file.fileType === 'ASSET') {
            console.log(`DEBUG collectAssetFiles: Comparing "${file.originalName}" === "${cleanFilename}": ${file.originalName === cleanFilename}`);
          }
        }
      }
    }
  } catch (error) {
    console.warn('DEBUG collectAssetFiles: Error collecting asset files:', error);
  }

  console.log(`DEBUG collectAssetFiles: Returning ${assetFiles.length} asset files`);
  return assetFiles;
}

async function generatePandocPDF(
  markdownContent: string, 
  template: any, 
  pdfEngine: string, 
  templateVariables: any,
  bibliographyContent: string = '',
  manuscriptFiles: any[] = [],
  serviceToken: string = ''
): Promise<Buffer> {
  try {
    console.log(`Converting markdown to PDF using ${pdfEngine} engine via microservice`);
    
    // Get template content based on engine
    let templateContent = '';
    switch (pdfEngine) {
      case 'latex':
        templateContent = template.latexTemplate || '';
        break;
      case 'typst':
        templateContent = template.typstTemplate || '';
        break;
      case 'html':
      default:
        templateContent = template.htmlTemplate || '';
        break;
    }
    
    // Prepare variables based on engine type
    let variables: any = {};
    
    if (pdfEngine === 'html') {
      // HTML engine uses Pandoc template variables
      variables = {
        title: templateVariables.title,
        author: templateVariables.authorList?.map((a: any) => a.name) || [templateVariables.authors],
        abstract: templateVariables.abstract,
        date: templateVariables.submittedDate,
        journal: templateVariables.journalName,
        customcss: templateVariables.customCss || ''
      };
    } else {
      // Typst and LaTeX use simple string substitution
      variables = {
        title: templateVariables.title,
        authors: templateVariables.authors,
        abstract: templateVariables.abstract,
        submittedDate: templateVariables.submittedDate,
        renderDate: templateVariables.renderDate,
        journalName: templateVariables.journalName
      };
    }
    
    // Collect asset files referenced in the markdown
    const assetFiles = await collectAssetFiles(markdownContent, manuscriptFiles, serviceToken);
    console.log(`DEBUG: Collected ${assetFiles.length} asset files for PDF generation`);
    
    const requestBody = {
      markdown: markdownContent,
      engine: pdfEngine,
      template: templateContent,
      variables: variables,
      outputFormat: 'pdf',
      bibliography: bibliographyContent,
      assets: assetFiles
    };
    
    console.log(`Sending request to Pandoc service: ${PANDOC_SERVICE_URL}/convert`);
    
    // Make HTTP request to the Pandoc microservice
    const response = await fetch(`${PANDOC_SERVICE_URL}/convert`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(`Pandoc service error: ${errorData.error || response.statusText}`);
    }
    
    // Get the PDF buffer from the response
    const pdfBuffer = await response.arrayBuffer();
    console.log(`PDF generated successfully, size: ${pdfBuffer.byteLength} bytes`);
    
    return Buffer.from(pdfBuffer);
    
  } catch (error) {
    console.error('Failed to generate PDF via microservice:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`PDF generation failed: ${errorMessage}`);
  }
}

async function generatePandocHTML(
  markdownContent: string,
  template: any,
  templateVariables: any,
  bibliographyContent: string = '',
  manuscriptFiles: any[] = [],
  serviceToken: string = ''
): Promise<Buffer> {
  try {
    console.log(`Converting markdown to HTML using Pandoc with native template support`);

    const assetFiles = await collectAssetFiles(markdownContent, manuscriptFiles, serviceToken);
    console.log(`DEBUG: Collected ${assetFiles.length} asset files for HTML generation`);

    // Use Pandoc's native template format - pass template directly
    // Template uses $variable$ syntax and $body$ for content
    const htmlTemplate = template.htmlTemplate || '';
    console.log(`DEBUG generatePandocHTML: template keys: ${Object.keys(template)}, htmlTemplate length: ${htmlTemplate.length}`);

    // Prepare metadata for Pandoc (complex objects like authorList)
    const metadata: Record<string, any> = {
      title: templateVariables.title || '',
      authors: templateVariables.authors || '',
      abstract: templateVariables.abstract || '',
      journalName: templateVariables.journalName || '',
      keywords: templateVariables.keywords || '',
      doi: templateVariables.doi || '',
      submittedDate: templateVariables.submittedDate || '',
      renderDate: templateVariables.renderDate || '',
    };

    // Add complex metadata (arrays/objects)
    if (templateVariables.authorList) {
      metadata.authorList = templateVariables.authorList;
    }
    if (templateVariables.correspondingAuthor) {
      metadata.correspondingAuthor = templateVariables.correspondingAuthor;
    }

    const requestBody = {
      markdown: markdownContent,
      engine: 'html',
      template: htmlTemplate,
      variables: {}, // Simple variables (empty - using metadata instead)
      metadata: metadata, // Complex metadata for Pandoc templates
      outputFormat: 'html',
      bibliography: bibliographyContent,
      assets: assetFiles,
      selfContained: true
    };

    console.log(`Sending request to Pandoc service with native template: ${PANDOC_SERVICE_URL}/convert`);
    console.log(`DEBUG: Template length: ${htmlTemplate.length}, Metadata keys: ${Object.keys(metadata)}`);

    const response = await fetch(`${PANDOC_SERVICE_URL}/convert`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(`Pandoc service error: ${errorData.error || response.statusText}`);
    }

    // Get the final HTML directly from Pandoc (already rendered with template)
    const renderedHtml = await response.text();
    console.log(`Pandoc HTML with template rendered, size: ${renderedHtml.length} characters`);

    return Buffer.from(renderedHtml, 'utf-8');

  } catch (error) {
    console.error('Failed to generate HTML via microservice:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`HTML generation failed: ${errorMessage}`);
  }
}

async function uploadRenderedFile(
  manuscriptId: string, 
  filename: string, 
  content: string | Buffer, 
  mimeType: string = 'text/html',
  serviceToken: string
): Promise<any> {
  const formData = new FormData();
  
  const blob = typeof content === 'string' 
    ? new Blob([content], { type: mimeType })
    : new Blob([content], { type: mimeType });
    
  formData.append('files', blob, filename);
  formData.append('fileType', 'RENDERED');
  formData.append('renderedBy', 'bot-markdown-renderer');
  
  const response = await fetch(`http://localhost:4000/api/articles/${manuscriptId}/files`, {
    method: 'POST',
    headers: {
      'x-bot-token': serviceToken
    },
    body: formData
  });
  
  if (!response.ok) {
    throw new Error(`Failed to upload rendered file: ${response.statusText}`);
  }
  
  const result = await response.json();
  
  // Add size information for tracking and fix download URL
  const fileResult = result.files[0];
  const baseUrl = process.env.API_BASE_URL || 'http://localhost:4000';
  return {
    ...fileResult,
    size: typeof content === 'string' ? content.length : content.length,
    downloadUrl: `${baseUrl}${fileResult.downloadUrl}` // Make URL absolute with environment-aware base
  };
}

// Helper functions for template installation
function getMimeType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  switch (ext) {
    case '.html': return 'text/html';
    case '.tex': return 'application/x-tex';
    case '.typ': return 'text/plain';
    case '.json': return 'application/json';
    case '.css': return 'text/css';
    default: return 'application/octet-stream';
  }
}

function getFileDescription(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  // Extract template name from folder-based path (e.g., "academic-standard/template.html")
  const parts = filename.split('/');
  const templateName = parts.length > 1 ? parts[0] : path.basename(filename, ext);

  switch (ext) {
    case '.html': return `HTML template for ${templateName}`;
    case '.tex': return `LaTeX template for ${templateName}`;
    case '.typ': return `Typst template for ${templateName}`;
    case '.json': return `Metadata configuration for ${templateName}`;
    case '.css': return `Styling for ${templateName}`;
    default: return `Template file: ${filename}`;
  }
}

// Export the bot
export const markdownRendererBot: CommandBot = {
  id: 'bot-markdown-renderer',
  name: 'Markdown Renderer',
  description: 'Renders Markdown manuscripts into professional PDFs using configurable journal templates and multiple rendering engines',
  version: '1.0.0',
  commands: [renderCommand, listTemplatesCommand, uploadTemplateCommand],
  keywords: ['markdown', 'render', 'template', 'pdf', 'latex', 'typst', 'academic'],
  triggers: ['MANUSCRIPT_SUBMITTED', 'FILE_UPLOADED'],
  permissions: ['read_manuscript_files', 'upload_files'],
  supportsFileUploads: true,
  
  // Upload built-in templates and create configuration when the bot is installed
  onInstall: async (context: BotInstallationContext) => {
    console.log(`📂 Installing built-in templates for ${context.botId}...`);

    try {
      // Find templates directory
      const templatesDir = path.join(__dirname, '..', 'templates');

      if (!await fs.pathExists(templatesDir)) {
        console.log(`⚠️ Templates directory not found: ${templatesDir}`);
        return;
      }

      // Get all template directories
      const entries = await fs.readdir(templatesDir, { withFileTypes: true });
      const templateDirs = entries.filter(entry => entry.isDirectory());

      console.log(`📁 Found ${templateDirs.length} template directories`);

      // Upload files and build configuration
      const templates: Record<string, any> = {};
      let uploadedCount = 0;

      for (const dir of templateDirs) {
        const templateName = dir.name;
        const templateDir = path.join(templatesDir, templateName);

        console.log(`📄 Processing template: ${templateName}`);

        const templateDef: any = {
          name: templateName,
          title: templateName.split('-').map(word =>
            word.charAt(0).toUpperCase() + word.slice(1)
          ).join(' '),
          description: `Template for ${templateName} format`,
          defaultEngine: 'typst',
          files: [],
          metadata: {}
        };

        // Read files from the template directory
        const templateFiles = await fs.readdir(templateDir);

        // First, load metadata from template.json if it exists
        const jsonPath = path.join(templateDir, 'template.json');
        if (await fs.pathExists(jsonPath)) {
          try {
            const metadataContent = await fs.readFile(jsonPath, 'utf-8');
            const metadata = JSON.parse(metadataContent);
            templateDef.title = metadata.title || templateDef.title;
            templateDef.description = metadata.description || templateDef.description;
            templateDef.defaultEngine = metadata.defaultEngine || templateDef.defaultEngine;
            templateDef.metadata = { ...templateDef.metadata, ...metadata.metadata };
          } catch (e) {
            console.warn(`⚠️ Failed to parse metadata for ${templateName}/template.json`);
          }
        }

        // Upload template files and collect their IDs
        for (const filename of templateFiles) {
          try {
            const filePath = path.join(templateDir, filename);
            const content = await fs.readFile(filePath);
            const mimetype = getMimeType(filename);
            // Use template-name/filename format for reference
            const uploadFilename = `${templateName}/${filename}`;
            const description = getFileDescription(uploadFilename);

            const uploadResult = await context.uploadFile(uploadFilename, content, mimetype, description);

            // Determine engine based on file extension
            let engine: 'html' | 'latex' | 'typst';
            if (filename.endsWith('.html')) engine = 'html';
            else if (filename.endsWith('.tex')) engine = 'latex';
            else if (filename.endsWith('.typ')) engine = 'typst';
            else continue; // Skip non-template files like .json and .css for now

            templateDef.files.push({
              fileId: uploadResult.id,
              filename: uploadFilename,
              engine: engine,
              metadata: {
                uploadedAt: new Date().toISOString(),
                source: 'built-in'
              }
            });

            uploadedCount++;
            console.log(`✅ Uploaded ${uploadFilename} -> ${uploadResult.id}`);
          } catch (error) {
            console.warn(`⚠️ Failed to upload template ${templateName}/${filename}:`, error);
          }
        }

        templates[templateName] = templateDef;
      }

      // Update bot configuration with the new template mappings
      const newConfig = {
        templateName: 'academic-standard',
        outputFormats: ['pdf'],
        requireSeparateBibliography: false,
        templates: templates,
        _installedAt: new Date().toISOString(),
        _version: '1.0.0'
      };

      // Store updated configuration in context (this will update the bot's config)
      Object.assign(context.config, newConfig);

      console.log(`🎉 Successfully uploaded ${uploadedCount} template files and configured ${Object.keys(templates).length} templates`);
      console.log(`📋 Available templates: ${Object.keys(templates).join(', ')}`);
    } catch (error) {
      console.error(`❌ Failed to install templates:`, error);
    }
  },
  help: {
    overview: 'The Markdown Renderer bot converts Markdown manuscripts into professional PDFs using configurable journal templates and multiple rendering engines (HTML, LaTeX, Typst). Configuration is managed at the journal level.',
    quickStart: 'Use `@bot-markdown-renderer render` to convert your Markdown manuscript to PDF using your journal\'s configured template and rendering engine.',
    examples: [
      '@bot-markdown-renderer render - Render using journal configuration',
      '@bot-markdown-renderer templates - List available templates'
    ]
  },
  customHelpSections: [
    {
      title: '✨ What I Can Do',
      content: '✅ Convert Markdown to professional PDFs\n✅ Support multiple rendering engines (HTML, LaTeX, Typst)\n✅ Apply journal-specific formatting\n✅ Handle images and citations\n✅ Generate publication-quality output\n✅ Use configurable templates',
      position: 'before'
    },
    {
      title: '🚀 Quick Start',
      content: '1. Submit a Markdown manuscript\n2. Use `@bot-markdown-renderer render` to convert to PDF\n3. Output format and template determined by journal configuration\n4. Contact admin to configure rendering engine and templates',
      position: 'before'
    },
    {
      title: '💡 Tips for Best Results',
      content: 'Use standard Markdown syntax for best results. Place images in the same directory as your Markdown file. LaTeX and Typst engines provide the highest quality output for academic papers. PDF generation may take longer for complex documents.',
      position: 'after'
    }
  ]
};

// ============================================================================
// Exported Rendering API (uses Pandoc)
// ============================================================================

/**
 * Options for rendering markdown.
 */
export interface RenderOptions {
  title: string;
  abstract?: string;
  authors?: string;
  authorList?: Array<{
    name: string;
    affiliation?: string;
    orcid?: string;
    email?: string;
    roles?: string;
    isCorresponding?: boolean;
  }>;
  correspondingAuthor?: { email?: string };
  renderDate?: string;
  submittedDate?: string;
  acceptedDate?: string;
  publishedDate?: string;
  journalName?: string;
  template?: string;
  /** Map of image filenames to their absolute paths for HTML output URL rewriting */
  imagePathMap?: Record<string, string>;
  /** Map of image filenames to their actual file paths on disk (for PDF embedding) */
  imageSourcePaths?: Record<string, string>;
  /** BibTeX bibliography content for citation processing */
  bibliography?: string;
  /** Output formats to generate (default: ['html']) */
  outputFormats?: ('html' | 'pdf')[];
  /** PDF engine to use (default: 'typst') */
  pdfEngine?: 'typst' | 'latex' | 'html';

  // Extended metadata for maximal template
  /** Digital Object Identifier */
  doi?: string;
  /** Keywords (comma-separated or as array via keywordList) */
  keywords?: string;
  keywordList?: string[];
  /** Article type (e.g., "Research Article", "Review", "Case Study") */
  articleType?: string;
  /** License (e.g., "CC BY 4.0") */
  license?: string;
  /** Version number */
  version?: string;
  versionNote?: string;
  /** Preprint status */
  isPreprint?: boolean;
  peerReviewedUrl?: string;

  // Back matter sections
  dataAvailability?: {
    statement: string;
    url?: string;
    repository?: string;
    doi?: string;
  };
  codeAvailability?: {
    statement: string;
    url?: string;
    repository?: string;
  };
  supplementaryMaterials?: Array<{
    label: string;
    description?: string;
    file?: string;
  }>;
  funding?: Array<{
    funder: string;
    grantNumber?: string;
    recipient?: string;
  }>;
  authorContributions?: string;
  acknowledgments?: string;
  competingInterests?: string;
  ethicsApproval?: string;
}

/**
 * Result of rendering markdown.
 */
export interface RenderResult {
  html: string;
  pdf?: Buffer;
}

/**
 * Render markdown to HTML and optionally PDF using Pandoc service.
 * Requires Pandoc microservice to be running.
 *
 * @param markdownContent - The markdown content to render
 * @param options - Rendering options including metadata and bibliography
 * @returns Promise<RenderResult> - The rendered content
 */
export async function renderMarkdown(
  markdownContent: string,
  options: RenderOptions
): Promise<RenderResult> {
  const outputFormats = options.outputFormats || ['html'];
  const pdfEngine = options.pdfEngine || 'typst';
  const templateName = options.template || 'academic-standard';

  // Load template
  const template = await getBuiltInTemplates().then(templates => {
    return templates[templateName] || {
      name: 'fallback',
      title: 'Fallback',
      htmlTemplate: getFallbackHtmlTemplate()
    };
  });

  // Prepare metadata for Pandoc (complex objects like authorList)
  const metadata: Record<string, any> = {
    title: options.title || '',
    authors: options.authors || (options.authorList ? options.authorList.map(a => a.name).join(', ') : ''),
    abstract: options.abstract || '',
    journalName: options.journalName || 'Colloquium Journal',
    keywords: options.keywords || '',
    doi: options.doi || '',
    submittedDate: options.submittedDate || '',
    acceptedDate: options.acceptedDate || '',
    publishedDate: options.publishedDate || '',
    renderDate: options.renderDate || new Date().toLocaleDateString(),
    articleType: options.articleType || '',
    license: options.license || '',
    version: options.version || '',
    versionNote: options.versionNote || '',
    isPreprint: options.isPreprint || false,
    peerReviewedUrl: options.peerReviewedUrl || '',
    authorContributions: options.authorContributions || '',
    acknowledgments: options.acknowledgments || '',
    competingInterests: options.competingInterests || '',
    ethicsApproval: options.ethicsApproval || '',
  };

  // Add complex metadata (arrays/objects)
  if (options.authorList) {
    metadata.authorList = options.authorList;
  }
  if (options.correspondingAuthor) {
    metadata.correspondingAuthor = options.correspondingAuthor;
  }
  if (options.keywordList || options.keywords) {
    metadata.keywordList = options.keywordList || (options.keywords ? options.keywords.split(',').map(k => k.trim()) : []);
  }
  if (options.dataAvailability) {
    metadata.dataAvailability = options.dataAvailability;
  }
  if (options.codeAvailability) {
    metadata.codeAvailability = options.codeAvailability;
  }
  if (options.supplementaryMaterials) {
    metadata.supplementaryMaterials = options.supplementaryMaterials;
  }
  if (options.funding) {
    metadata.funding = options.funding;
  }

  // Call Pandoc service with native template support
  const requestBody = {
    markdown: markdownContent,
    engine: 'html',
    template: template.htmlTemplate || '',
    variables: {}, // Simple variables (empty - using metadata instead)
    metadata: metadata, // Complex metadata for Pandoc templates
    outputFormat: 'html',
    bibliography: options.bibliography || '',
    assets: [],
    selfContained: false  // Don't embed images - we'll rewrite paths in output
  };

  const response = await fetch(`${PANDOC_SERVICE_URL}/convert`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(`Pandoc service error: ${errorData.error || response.statusText}. Is the Pandoc service running at ${PANDOC_SERVICE_URL}?`);
  }

  // Get the rendered HTML directly from Pandoc (already processed with template)
  let html = await response.text();

  // Replace image paths in the output HTML if mapping provided
  if (options.imagePathMap) {
    for (const [filename, newPath] of Object.entries(options.imagePathMap)) {
      const cleanFilename = filename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // Match src attributes with the filename
      const patterns = [
        new RegExp(`src="${cleanFilename}"`, 'g'),
        new RegExp(`src="\\./${cleanFilename}"`, 'g'),
        new RegExp(`src="/${cleanFilename}"`, 'g'),
      ];
      for (const pattern of patterns) {
        html = html.replace(pattern, `src="${newPath}"`);
      }
    }
  }

  const result: RenderResult = { html };

  // Generate PDF if requested
  if (outputFormats.includes('pdf')) {
    // Read image assets for PDF embedding
    const assets: Array<{ filename: string; content: string; encoding: string }> = [];
    if (options.imageSourcePaths) {
      for (const [filename, sourcePath] of Object.entries(options.imageSourcePaths)) {
        try {
          if (await fs.pathExists(sourcePath)) {
            const imageBuffer = await fs.readFile(sourcePath);
            assets.push({
              filename,
              content: imageBuffer.toString('base64'),
              encoding: 'base64'
            });
          }
        } catch (error) {
          console.warn(`Failed to read image ${filename} from ${sourcePath}:`, error);
        }
      }
    }

    const pdfRequestBody = {
      markdown: markdownContent,
      engine: pdfEngine,
      template: template.typstTemplate || template.latexTemplate || '',
      variables: {
        // Core metadata
        title: options.title,
        authors: options.authors || (options.authorList ? options.authorList.map(a => a.name).join(', ') : ''),
        authorList: options.authorList || [],
        correspondingAuthor: options.correspondingAuthor,
        abstract: options.abstract || '',

        // Dates
        submittedDate: options.submittedDate || options.renderDate || new Date().toLocaleDateString(),
        acceptedDate: options.acceptedDate || '',
        publishedDate: options.publishedDate || '',
        renderDate: options.renderDate || new Date().toLocaleDateString(),

        // Journal info
        journalName: options.journalName || 'Colloquium Journal',

        // Extended metadata
        doi: options.doi || '',
        keywords: options.keywords || '',
        articleType: options.articleType || '',
        license: options.license || '',
        version: options.version || '',
        versionNote: options.versionNote || '',
        isPreprint: options.isPreprint || false,

        // Back matter
        dataAvailability: options.dataAvailability,
        codeAvailability: options.codeAvailability,
        supplementaryMaterials: options.supplementaryMaterials || [],
        funding: options.funding || [],
        authorContributions: options.authorContributions || '',
        acknowledgments: options.acknowledgments || '',
        competingInterests: options.competingInterests || '',
        ethicsApproval: options.ethicsApproval || ''
      },
      outputFormat: 'pdf',
      bibliography: options.bibliography || '',
      assets
    };

    const pdfResponse = await fetch(`${PANDOC_SERVICE_URL}/convert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pdfRequestBody)
    });

    if (!pdfResponse.ok) {
      const errorData = await pdfResponse.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(`Pandoc PDF error: ${errorData.error || pdfResponse.statusText}`);
    }

    const pdfBuffer = await pdfResponse.arrayBuffer();
    result.pdf = Buffer.from(pdfBuffer);
  }

  return result;
}

/**
 * Fallback HTML template when file-based template isn't found.
 */
function getFallbackHtmlTemplate(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>$title$</title>
    <style>
        body {
            max-width: 800px;
            margin: 0 auto;
            padding: 2rem;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
        }
        .header { text-align: center; margin-bottom: 2rem; }
        .title { font-size: 1.75rem; font-weight: bold; margin-bottom: 0.5rem; }
        .authors { color: #666; margin-bottom: 0.5rem; }
        .abstract {
            background: #f9f9f9;
            border-left: 4px solid #2c5aa0;
            padding: 1rem;
            margin: 1.5rem 0;
        }
        .abstract h3 { margin-top: 0; color: #2c5aa0; }
        h1, h2, h3, h4 { margin-top: 1.5em; margin-bottom: 0.5em; }
        h1 { font-size: 1.5rem; border-bottom: 1px solid #eee; padding-bottom: 0.3em; }
        pre { background: #f6f8fa; padding: 1em; border-radius: 6px; overflow-x: auto; }
        code { background: #f6f8fa; padding: 0.2em 0.4em; border-radius: 3px; font-size: 0.9em; }
        pre code { background: none; padding: 0; }
        blockquote { border-left: 4px solid #ddd; margin: 1em 0; padding-left: 1em; color: #666; }
        table { border-collapse: collapse; width: 100%; margin: 1em 0; }
        th, td { border: 1px solid #ddd; padding: 0.5em; text-align: left; }
        th { background: #f6f8fa; }
        img { max-width: 100%; height: auto; }
        figure { margin: 1em 0; text-align: center; }
        figcaption { font-size: 0.9em; color: #666; margin-top: 0.5em; font-style: italic; }
    </style>
</head>
<body>
    <div class="header">
        <div class="title">$title$</div>
$if(authors)$        <div class="authors">$authors$</div>
$endif$    </div>
$if(abstract)$
    <div class="abstract">
        <h3>Abstract</h3>
        <p>$abstract$</p>
    </div>
$endif$
    <div class="content">
$body$
    </div>
</body>
</html>`;
}

// Export the bot for npm package compatibility
export default markdownRendererBot;