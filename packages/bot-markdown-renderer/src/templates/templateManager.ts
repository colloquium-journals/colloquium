import * as fs from 'fs-extra';
import * as path from 'path';

const DEFAULT_API_URL = process.env.API_URL || 'http://localhost:4000';

// Cache for loaded templates
let BUILT_IN_TEMPLATES: Record<string, any> | null = null;

export async function loadBuiltInTemplates(): Promise<Record<string, any>> {
  const templatesDir = path.join(__dirname, '..', '..', 'templates');
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

export async function getBuiltInTemplates(): Promise<Record<string, any>> {
  if (!BUILT_IN_TEMPLATES) {
    BUILT_IN_TEMPLATES = await loadBuiltInTemplates();
  }
  return BUILT_IN_TEMPLATES;
}

// Fetch template content by file ID
export async function fetchTemplateContentById(fileId: string, apiUrl: string = DEFAULT_API_URL): Promise<string> {
  try {
    const response = await fetch(`${apiUrl}/api/bot-config-files/${fileId}/content`);

    if (!response.ok) {
      throw new Error(`Failed to fetch template content: ${response.statusText}`);
    }

    return await response.text();
  } catch (error) {
    console.error(`Failed to fetch template content for file ${fileId}:`, error);
    throw error;
  }
}

export async function getTemplate(templateName: string, pdfEngine: string, config: any, apiUrl: string = DEFAULT_API_URL): Promise<any> {
  // First check the new file ID-based templates in config
  if (config.templates && config.templates[templateName]) {
    const templateDef = config.templates[templateName];

    // Find the file for the requested engine
    const templateFile = templateDef.files.find((file: any) => file.engine === pdfEngine);

    if (templateFile) {
      try {
        // Fetch the template content using the file ID
        const templateContent = await fetchTemplateContentById(templateFile.fileId, apiUrl);

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
    return await getFileBasedTemplate(fileName, apiUrl);
  }

  // Check custom templates from config (legacy support)
  if (config.customTemplates && config.customTemplates[templateName]) {
    return config.customTemplates[templateName];
  }

  // Final fallback
  return getFallbackTemplate();
}

async function getFileBasedTemplate(fileName: string, apiUrl: string = DEFAULT_API_URL): Promise<any> {
  try {
    // Fetch template file from bot config files API
    const response = await fetch(`${apiUrl}/api/bot-config-files/markdown-renderer/files?category=template`);

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
    const contentResponse = await fetch(`${apiUrl}/api/bot-config-files/${templateFile.id}/content`);

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
      const cssResponse = await fetch(`${apiUrl}/api/bot-config-files/${cssFile.id}/content`);
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

export function getFallbackTemplate(): any {
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
