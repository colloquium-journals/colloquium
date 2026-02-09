import * as fs from 'fs-extra';
import * as path from 'path';
import { CommandBot, BotInstallationContext } from '@colloquium/types';
import { renderCommand } from './commands/renderCommand';
import { listTemplatesCommand, uploadTemplateCommand } from './commands/listCommand';

// Re-export the public API
export { renderMarkdown, RenderOptions, RenderResult } from './renderMarkdown';

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

  onInstall: async (context: BotInstallationContext) => {
    try {
      const templatesDir = path.join(__dirname, '..', 'templates');

      if (!await fs.pathExists(templatesDir)) {
        return;
      }

      const entries = await fs.readdir(templatesDir, { withFileTypes: true });
      const templateDirs = entries.filter(entry => entry.isDirectory());

      const templates: Record<string, any> = {};
      let uploadedCount = 0;

      for (const dir of templateDirs) {
        const templateName = dir.name;
        const templateDir = path.join(templatesDir, templateName);

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

        const templateFiles = await fs.readdir(templateDir);

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

        for (const filename of templateFiles) {
          try {
            const filePath = path.join(templateDir, filename);
            const content = await fs.readFile(filePath);
            const mimetype = getMimeType(filename);
            const uploadFilename = `${templateName}/${filename}`;
            const description = getFileDescription(uploadFilename);

            const uploadResult = await context.uploadFile(uploadFilename, content, mimetype, description);

            let engine: 'html' | 'latex' | 'typst';
            if (filename.endsWith('.html')) engine = 'html';
            else if (filename.endsWith('.tex')) engine = 'latex';
            else if (filename.endsWith('.typ')) engine = 'typst';
            else continue;

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
          } catch (error) {
            console.warn(`⚠️ Failed to upload template ${templateName}/${filename}:`, error);
          }
        }

        templates[templateName] = templateDef;
      }

      const newConfig = {
        templateName: 'academic-standard',
        outputFormats: ['pdf'],
        requireSeparateBibliography: false,
        templates: templates,
        _installedAt: new Date().toISOString(),
        _version: '1.0.0'
      };

      Object.assign(context.config, newConfig);

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

export default markdownRendererBot;
