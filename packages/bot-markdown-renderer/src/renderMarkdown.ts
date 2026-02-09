import * as fs from 'fs-extra';
import { getBuiltInTemplates } from './templates/templateManager';

const PANDOC_SERVICE_URL = process.env.PANDOC_SERVICE_URL || 'http://localhost:8080';

export interface RenderOptions {
  title: string;
  abstract?: string;
  authors?: string;
  authorList?: Array<{
    name: string;
    givenNames?: string;
    surname?: string;
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
  imagePathMap?: Record<string, string>;
  imageSourcePaths?: Record<string, string>;
  bibliography?: string;
  outputFormats?: ('html' | 'pdf')[];
  pdfEngine?: 'typst' | 'latex' | 'html';

  doi?: string;
  volume?: string;
  issue?: string;
  elocationId?: string;
  issn?: string;
  pdfUrl?: string;

  keywords?: string;
  keywordList?: string[];
  articleType?: string;
  license?: string;
  version?: string;
  versionNote?: string;
  isPreprint?: boolean;
  peerReviewedUrl?: string;

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

export interface RenderResult {
  html: string;
  pdf?: Buffer;
}

export async function renderMarkdown(
  markdownContent: string,
  options: RenderOptions
): Promise<RenderResult> {
  const outputFormats = options.outputFormats || ['html'];
  const pdfEngine = options.pdfEngine || 'typst';
  const templateName = options.template || 'academic-standard';

  const template = await getBuiltInTemplates().then(templates => {
    return templates[templateName] || {
      name: 'fallback',
      title: 'Fallback',
      htmlTemplate: getFallbackHtmlTemplate()
    };
  });

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
    volume: options.volume || '',
    issue: options.issue || '',
    elocationId: options.elocationId || '',
    issn: options.issn || '',
    pdfUrl: options.pdfUrl || '',
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
    citationHover: citationHover?.enabled ?? false,
    citationHoverLinks: JSON.stringify(citationHover?.links ?? []).replace(/"/g, "'"),
    citationHoverCustomLinks: JSON.stringify(citationHover?.customLinks ?? {}).replace(/"/g, "'"),
  };

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

  const requestBody = {
    markdown: markdownContent,
    engine: 'html',
    template: template.htmlTemplate || '',
    variables: {},
    metadata: metadata,
    outputFormat: 'html',
    bibliography: options.bibliography || '',
    assets: [],
    selfContained: false
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

  let html = await response.text();

  if (options.imagePathMap) {
    for (const [filename, newPath] of Object.entries(options.imagePathMap)) {
      const cleanFilename = filename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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

  if (outputFormats.includes('pdf')) {
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
        title: options.title,
        authors: options.authors || (options.authorList ? options.authorList.map(a => a.name).join(', ') : ''),
        authorList: options.authorList || [],
        correspondingAuthor: options.correspondingAuthor,
        abstract: options.abstract || '',

        submittedDate: options.submittedDate || options.renderDate || new Date().toLocaleDateString(),
        acceptedDate: options.acceptedDate || '',
        publishedDate: options.publishedDate || '',
        renderDate: options.renderDate || new Date().toLocaleDateString(),

        journalName: options.journalName || 'Colloquium Journal',

        doi: options.doi || '',
        keywords: options.keywords || '',
        articleType: options.articleType || '',
        license: options.license || '',
        version: options.version || '',
        versionNote: options.versionNote || '',
        isPreprint: options.isPreprint || false,

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

export function getFallbackHtmlTemplate(): string {
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
