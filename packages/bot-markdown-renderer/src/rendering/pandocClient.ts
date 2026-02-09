import { collectAssetFiles } from './assetProcessor';

const PANDOC_SERVICE_URL = process.env.PANDOC_SERVICE_URL || 'http://localhost:8080';
const DEFAULT_API_URL = process.env.API_URL || 'http://localhost:4000';

export async function generatePandocPDF(
  markdownContent: string,
  template: any,
  pdfEngine: string,
  templateVariables: any,
  bibliographyContent: string = '',
  manuscriptFiles: any[] = [],
  serviceToken: string = '',
  apiUrl: string = DEFAULT_API_URL
): Promise<Buffer> {
  try {
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

    let variables: any = {};

    if (pdfEngine === 'html') {
      variables = {
        title: templateVariables.title,
        author: templateVariables.authorList?.map((a: any) => a.name) || [templateVariables.authors],
        abstract: templateVariables.abstract,
        date: templateVariables.submittedDate,
        journal: templateVariables.journalName,
        customcss: templateVariables.customCss || ''
      };
    } else {
      variables = {
        title: templateVariables.title,
        authors: templateVariables.authors,
        abstract: templateVariables.abstract,
        submittedDate: templateVariables.submittedDate,
        renderDate: templateVariables.renderDate,
        journalName: templateVariables.journalName
      };
    }

    const assetFiles = await collectAssetFiles(markdownContent, manuscriptFiles, serviceToken, apiUrl);

    const requestBody = {
      markdown: markdownContent,
      engine: pdfEngine,
      template: templateContent,
      variables: variables,
      outputFormat: 'pdf',
      bibliography: bibliographyContent,
      assets: assetFiles
    };

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

    const pdfBuffer = await response.arrayBuffer();
    return Buffer.from(pdfBuffer);

  } catch (error) {
    console.error('Failed to generate PDF via microservice:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`PDF generation failed: ${errorMessage}`);
  }
}

export async function generatePandocHTML(
  markdownContent: string,
  template: any,
  templateVariables: any,
  bibliographyContent: string = '',
  manuscriptFiles: any[] = [],
  serviceToken: string = '',
  apiUrl: string = DEFAULT_API_URL
): Promise<Buffer> {
  try {
    const assetFiles = await collectAssetFiles(markdownContent, manuscriptFiles, serviceToken, apiUrl);

    const htmlTemplate = template.htmlTemplate || '';

    const citationHoverConfig = template.metadata?.features?.citationHover;
    const citationHover = citationHoverConfig
      ? (typeof citationHoverConfig === 'boolean'
          ? { enabled: true, links: ['doi', 'googleScholar'], customLinks: {} }
          : {
              enabled: citationHoverConfig.enabled ?? false,
              links: citationHoverConfig.links ?? ['doi', 'googleScholar'],
              customLinks: citationHoverConfig.customLinks ?? {}
            })
      : null;

    const metadata: Record<string, any> = {
      title: templateVariables.title || '',
      authors: templateVariables.authors || '',
      abstract: templateVariables.abstract || '',
      journalName: templateVariables.journalName || '',
      keywords: templateVariables.keywords || '',
      doi: templateVariables.doi || '',
      submittedDate: templateVariables.submittedDate || '',
      renderDate: templateVariables.renderDate || '',
      publishedDate: templateVariables.publishedDate || '',
      volume: templateVariables.volume || '',
      issue: templateVariables.issue || '',
      elocationId: templateVariables.elocationId || '',
      issn: templateVariables.issn || '',
      pdfUrl: templateVariables.pdfUrl || '',
      citationHover: citationHover?.enabled ?? false,
      citationHoverLinks: JSON.stringify(citationHover?.links ?? []).replace(/"/g, "'"),
      citationHoverCustomLinks: JSON.stringify(citationHover?.customLinks ?? {}).replace(/"/g, "'"),
    };

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
      variables: {},
      metadata: metadata,
      outputFormat: 'html',
      bibliography: bibliographyContent,
      assets: assetFiles,
      selfContained: true
    };

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

    const renderedHtml = await response.text();

    return Buffer.from(renderedHtml, 'utf-8');

  } catch (error) {
    console.error('Failed to generate HTML via microservice:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`HTML generation failed: ${errorMessage}`);
  }
}
