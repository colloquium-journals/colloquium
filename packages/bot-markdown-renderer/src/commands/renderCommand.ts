import { BotCommand } from '@colloquium/types';
import { getManuscriptFiles, findMarkdownFile, downloadFile, findBibliographyFile, getManuscriptMetadata, uploadRenderedFile } from '../files/fileClient';
import { getTemplate } from '../templates/templateManager';
import { processMarkdownContent, prepareAuthorData } from '../rendering/assetProcessor';
import { generatePandocPDF, generatePandocHTML } from '../rendering/pandocClient';

const DEFAULT_API_URL = process.env.API_URL || 'http://localhost:4000';

export const renderCommand: BotCommand = {
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
    const apiUrl = config?.apiUrl || DEFAULT_API_URL;

    const pdfEngine = params.engine || config.pdfEngine || 'typst';
    const templateName = params.template || config.templateName || 'academic-standard';
    const outputFormats = params.output ? params.output.split(',') : (config.outputFormats || ['pdf']);

    if (!serviceToken) {
      return {
        messages: [{
          content: '❌ **Authentication Error**\n\nBot service token not available. Please contact system administrator.'
        }],
        errors: ['Bot service token not available']
      };
    }

    try {
      const manuscriptFiles = await getManuscriptFiles(manuscriptId, serviceToken, apiUrl);

      const markdownFile = findMarkdownFile(manuscriptFiles);

      if (!markdownFile) {
        return {
          messages: [{
            content: '❌ **No Markdown File Found**\n\nI couldn\'t find any Markdown files (.md, .markdown) in this manuscript. Please upload a Markdown file to render.'
          }]
        };
      }

      const templateData = await getTemplate(templateName, pdfEngine, config, apiUrl);

      const markdownContent = await downloadFile(markdownFile.downloadUrl, serviceToken, apiUrl);
      const processedContent = await processMarkdownContent(
        markdownContent,
        manuscriptFiles,
        true
      );

      const bibliographyFile = findBibliographyFile(manuscriptFiles);
      let bibliographyContent = '';
      if (bibliographyFile) {
        bibliographyContent = await downloadFile(bibliographyFile.downloadUrl, serviceToken, apiUrl);
      }

      const metadata = await getManuscriptMetadata(manuscriptId, serviceToken, apiUrl);

      const authorData = await prepareAuthorData(metadata);

      const baseFilename = markdownFile.originalName.replace(/\.(md|markdown)$/i, '');
      const uploadResults = [];

      const journalSettings = context.journal?.settings || {};

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
        journalName: journalSettings.name || 'Colloquium Journal',
        doi: metadata.doi || '',
        publishedDate: metadata.publishedAt ? new Date(metadata.publishedAt).toISOString().split('T')[0] : '',
        volume: metadata.volume || '',
        issue: metadata.issue || '',
        elocationId: metadata.elocationId || '',
        issn: journalSettings.issn || journalSettings.eissn || '',
        pdfUrl: ''
      };

      for (const format of outputFormats) {
        if (format === 'html') {
          const htmlTemplateData = await getTemplate(templateName, 'html', config, apiUrl);
          const htmlBuffer = await generatePandocHTML(markdownContent, htmlTemplateData, templateVariables, bibliographyContent, manuscriptFiles, serviceToken, apiUrl);
          const htmlFilename = `${baseFilename}.html`;
          const htmlResult = await uploadRenderedFile(manuscriptId, htmlFilename, htmlBuffer, 'text/html', serviceToken, apiUrl);
          uploadResults.push({ type: 'HTML', ...htmlResult });
        } else if (format === 'pdf') {
          const pdfTemplateData = await getTemplate(templateName, pdfEngine, config, apiUrl);
          const pdfBuffer = await generatePandocPDF(markdownContent, pdfTemplateData, pdfEngine, templateVariables, bibliographyContent, manuscriptFiles, serviceToken, apiUrl);
          const pdfFilename = `${baseFilename}.pdf`;
          const pdfResult = await uploadRenderedFile(manuscriptId, pdfFilename, pdfBuffer, 'application/pdf', serviceToken, apiUrl);
          uploadResults.push({ type: 'PDF', ...pdfResult });
        }
      }

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
