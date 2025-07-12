import { z } from 'zod';
import { marked } from 'marked';
import { JSDOM } from 'jsdom';
import DOMPurify from 'dompurify';
import * as Handlebars from 'handlebars';
import * as fs from 'fs-extra';
import * as path from 'path';
// Service URL for the Pandoc microservice
const PANDOC_SERVICE_URL = process.env.PANDOC_SERVICE_URL || 'http://localhost:8080';
import { CommandBot, BotCommand } from '@colloquium/types';

// Create DOMPurify instance
const window = new JSDOM('').window;
const purify = DOMPurify(window);

// Journal template schema (for future validation)
// const journalTemplateSchema = z.object({
//   name: z.string(),
//   title: z.string(),
//   description: z.string(),
//   htmlTemplate: z.string(),
//   cssTemplate: z.string().optional(),
//   metadata: z.record(z.any()).optional()
// });

// Template loading functions
async function loadBuiltInTemplates(): Promise<Record<string, any>> {
  const templatesDir = path.join(__dirname, '..', 'templates');
  const templates: Record<string, any> = {};
  
  try {
    const files = await fs.readdir(templatesDir);
    const templateNames = new Set<string>();
    
    // Find all template JSON files to identify templates
    files.forEach(file => {
      if (file.endsWith('.json')) {
        templateNames.add(file.replace('.json', ''));
      }
    });
    
    // Load each template with all its engine variants
    for (const templateName of templateNames) {
      try {
        const jsonPath = path.join(templatesDir, `${templateName}.json`);
        
        if (await fs.pathExists(jsonPath)) {
          const metadata = await fs.readJson(jsonPath);
          const template: any = { ...metadata };
          
          // Load HTML template if exists
          const htmlPath = path.join(templatesDir, `${templateName}.html`);
          if (await fs.pathExists(htmlPath)) {
            template.htmlTemplate = await fs.readFile(htmlPath, 'utf-8');
          }
          
          // Load LaTeX template if exists
          const texPath = path.join(templatesDir, `${templateName}.tex`);
          if (await fs.pathExists(texPath)) {
            template.latexTemplate = await fs.readFile(texPath, 'utf-8');
          }
          
          // Load Typst template if exists
          const typPath = path.join(templatesDir, `${templateName}.typ`);
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
  description: 'Render Markdown files to HTML using journal templates',
  usage: '@markdown-renderer render',
  parameters: [],
  examples: [
    '@markdown-renderer render'
  ],
  permissions: ['read_manuscript_files', 'upload_files'],
  async execute(params, context) {
    const { manuscriptId, config, serviceToken } = context;
    
    // Extract configuration from journal settings
    const pdfEngine = config.pdfEngine || 'typst';
    const templateName = config.templateName || 'academic-standard';
    const outputFormats = config.outputFormats || ['pdf'];
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
          // For HTML, use HTML template with Handlebars rendering
          const htmlTemplateData = await getTemplate(templateName, 'html', config);
          const renderedHtml = await renderWithTemplate(htmlTemplateData, templateVariables);
          const htmlFilename = `${baseFilename}.html`;
          const htmlResult = await uploadRenderedFile(manuscriptId, htmlFilename, renderedHtml, 'text/html', serviceToken);
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
  async execute(_params, context) {
    const { config } = context;
    
    let message = `📝 **Available Journal Templates**\n\n`;
    
    // List built-in templates
    const builtInTemplates = await getBuiltInTemplates();
    Object.values(builtInTemplates).forEach((template: any) => {
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
  const builtInTemplates = await getBuiltInTemplates();
  
  // Check built-in templates first
  if (builtInTemplates[templateName]) {
    const template = builtInTemplates[templateName];
    
    // Validate that the template supports the requested engine
    if (template.engines && !template.engines.includes(pdfEngine)) {
      console.warn(`Template ${templateName} does not support engine ${pdfEngine}, using fallback`);
      // Use the template's default engine or fallback to html
      const fallbackEngine = template.defaultEngine || 'html';
      if (template.engines.includes(fallbackEngine)) {
        console.log(`Using fallback engine: ${fallbackEngine}`);
      }
    }
    
    return template;
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
  return builtInTemplates['academic-standard'] || {
    name: 'fallback',
    title: 'Fallback Template',
    description: 'Basic fallback template',
    htmlTemplate: '<html><body><h1>{{title}}</h1><div>{{{content}}}</div></body></html>',
    cssTemplate: '',
    metadata: { type: 'basic' }
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
          orcidVerified: author.orcidVerified || false,
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
        orcidVerified: false,
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
    // Find all image references in the markdown
    const imagePattern = /!\[([^\]]*)\]\(([^)]+)\)/g;
    const imageMatches = [...markdownContent.matchAll(imagePattern)];
    
    console.log(`DEBUG: Found ${imageMatches.length} image references in markdown`);
    
    for (const match of imageMatches) {
      const imagePath = match[2];
      const cleanFilename = imagePath.replace(/^\.?\//, '');
      
      console.log(`DEBUG: Looking for image file: ${cleanFilename}`);
      
      // Find the corresponding asset file
      const assetFile = manuscriptFiles.find(file => 
        file.fileType === 'ASSET' && 
        (file.originalName === cleanFilename || 
         file.originalName.endsWith('/' + cleanFilename) ||
         file.path?.endsWith(cleanFilename))
      );
      
      if (assetFile) {
        console.log(`DEBUG: Found asset file: ${assetFile.originalName}, downloading...`);
        
        try {
          // Download the asset file
          const response = await fetch(assetFile.downloadUrl.startsWith('http') ? 
            assetFile.downloadUrl : 
            `http://localhost:4000${assetFile.downloadUrl}`, {
            headers: {
              'x-bot-token': serviceToken
            }
          });
          
          if (response.ok) {
            const buffer = await response.arrayBuffer();
            const base64Content = Buffer.from(buffer).toString('base64');
            
            assetFiles.push({
              filename: cleanFilename,
              content: base64Content,
              encoding: 'base64'
            });
            
            console.log(`DEBUG: Successfully collected asset: ${cleanFilename} (${buffer.byteLength} bytes)`);
          } else {
            console.warn(`Failed to download asset ${cleanFilename}: ${response.statusText}`);
          }
        } catch (downloadError) {
          console.warn(`Error downloading asset ${cleanFilename}:`, downloadError);
        }
      } else {
        console.warn(`DEBUG: Asset file not found: ${cleanFilename}`);
      }
    }
  } catch (error) {
    console.warn('Error collecting asset files:', error);
  }
  
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
    
  formData.append('file', blob, filename);
  formData.append('fileType', 'RENDERED');
  formData.append('renderedBy', 'markdown-renderer');
  
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

// Export the bot
export const markdownRendererBot: CommandBot = {
  id: 'markdown-renderer',
  name: 'Markdown Renderer',
  description: 'Renders Markdown manuscripts into professional PDFs using configurable journal templates and multiple rendering engines',
  version: '1.0.0',
  commands: [renderCommand, listTemplatesCommand, uploadTemplateCommand],
  keywords: ['markdown', 'render', 'template', 'pdf', 'latex', 'typst', 'academic'],
  triggers: ['MANUSCRIPT_SUBMITTED', 'FILE_UPLOADED'],
  permissions: ['read_manuscript_files', 'upload_files'],
  supportsFileUploads: true,
  help: {
    overview: 'The Markdown Renderer bot converts Markdown manuscripts into professional PDFs using configurable journal templates and multiple rendering engines (HTML, LaTeX, Typst). Configuration is managed at the journal level.',
    quickStart: 'Use `@markdown-renderer render` to convert your Markdown manuscript to PDF using your journal\'s configured template and rendering engine.',
    examples: [
      '@markdown-renderer render - Render using journal configuration',
      '@markdown-renderer templates - List available templates'
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
      content: '1. Submit a Markdown manuscript\n2. Use `@markdown-renderer render` to convert to PDF\n3. Output format and template determined by journal configuration\n4. Contact admin to configure rendering engine and templates',
      position: 'before'
    },
    {
      title: '💡 Tips for Best Results',
      content: 'Use standard Markdown syntax for best results. Place images in the same directory as your Markdown file. LaTeX and Typst engines provide the highest quality output for academic papers. PDF generation may take longer for complex documents.',
      position: 'after'
    }
  ]
};

// Export the bot for npm package compatibility
export default markdownRendererBot;