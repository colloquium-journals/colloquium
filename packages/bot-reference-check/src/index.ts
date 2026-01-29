import { z } from 'zod';
import { CommandBot, BotCommand } from '@colloquium/types';

// API base URL - configurable for different environments
const API_BASE_URL = process.env.API_URL || 'http://localhost:4000';

// DOI validation regex - matches standard DOI format
const DOI_REGEX = /10\.\d{4,}\/[^\s]+/g;
const DOI_REGEX_SINGLE = /10\.\d{4,}\/[^\s]+/;

// Interface for manuscript file from API
interface ManuscriptFile {
  id: string;
  filename: string;
  originalName: string;
  fileType: 'SOURCE' | 'ASSET' | 'RENDERED' | 'BIBLIOGRAPHY';
  mimetype: string;
  size: number;
  downloadUrl: string;
  detectedFormat?: string;
}

/**
 * Fetch list of files for a manuscript
 */
async function getManuscriptFiles(manuscriptId: string, serviceToken: string): Promise<ManuscriptFile[]> {
  const url = `${API_BASE_URL}/api/articles/${manuscriptId}/files`;

  const response = await fetch(url, {
    headers: {
      'x-bot-token': serviceToken,
      'content-type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch manuscript files: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.files || [];
}

/**
 * Download file content as text
 */
async function downloadFileContent(downloadUrl: string, serviceToken: string): Promise<string> {
  const fullUrl = downloadUrl.startsWith('http') ? downloadUrl : `${API_BASE_URL}${downloadUrl}`;

  const response = await fetch(fullUrl, {
    headers: {
      'x-bot-token': serviceToken
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to download file: ${response.status} ${response.statusText}`);
  }

  return await response.text();
}

/**
 * Find the best file for reference analysis (markdown or text source files)
 */
function findSourceFile(files: ManuscriptFile[]): ManuscriptFile | null {
  // Priority 1: SOURCE markdown files
  let sourceFile = files.find(file =>
    file.fileType === 'SOURCE' &&
    (file.mimetype?.includes('markdown') ||
     file.originalName.match(/\.(md|markdown)$/i) ||
     file.detectedFormat === 'markdown')
  );

  // Priority 2: Any SOURCE text file
  if (!sourceFile) {
    sourceFile = files.find(file =>
      file.fileType === 'SOURCE' &&
      (file.mimetype?.includes('text') ||
       file.originalName.match(/\.(txt|tex|rst)$/i))
    );
  }

  // Priority 3: Any markdown file
  if (!sourceFile) {
    sourceFile = files.find(file =>
      file.mimetype?.includes('markdown') ||
      file.originalName.match(/\.(md|markdown)$/i)
    );
  }

  return sourceFile || null;
}

/**
 * Find bibliography file if present
 */
function findBibliographyFile(files: ManuscriptFile[]): ManuscriptFile | null {
  return files.find(file =>
    file.fileType === 'BIBLIOGRAPHY' ||
    file.originalName.match(/\.(bib|bibtex)$/i)
  ) || null;
}

// Unified result for a single reference
interface ReferenceResult {
  label: string;        // citation key (bibtex) or "ref-N" (markdown)
  title?: string;
  doi?: string;
  status: 'ok' | 'no-doi' | 'not-found';
  error?: string;
  // metadata (populated when detailed=true)
  authors?: string[];
  publicationYear?: number;
  journal?: string;
}

// Interface for a parsed BibTeX entry
interface BibEntry {
  citationKey: string;
  entryType: string;
  author?: string;
  title?: string;
  year?: string;
  journal?: string;
  doi?: string;
  [key: string]: string | undefined;
}

// Interface for reference analysis
interface ReferenceAnalysis {
  references: ReferenceResult[];
  source: 'bibtex' | 'markdown';
}

/**
 * Extract DOIs from text content
 */
function extractDOIs(text: string): string[] {
  const dois = text.match(DOI_REGEX) || [];
  // Remove duplicates and clean up
  return [...new Set(dois.map(doi => doi.trim().toLowerCase()))];
}

/**
 * Validate DOI format
 */
function isValidDOI(doi: string): boolean {
  return DOI_REGEX_SINGLE.test(doi);
}

/**
 * Parse BibTeX content into structured entries
 */
function parseBibTeX(content: string): BibEntry[] {
  const entries: BibEntry[] = [];
  // Match @type{key, ... } blocks. Uses a simple brace-depth counter to find the closing brace.
  const entryStartRegex = /@(\w+)\s*\{\s*([^,\s]*)\s*,/g;
  let match: RegExpExecArray | null;

  while ((match = entryStartRegex.exec(content)) !== null) {
    const entryType = match[1].toLowerCase();
    const citationKey = match[2];

    // Skip non-reference entries like @string, @preamble, @comment
    if (['string', 'preamble', 'comment'].includes(entryType)) continue;

    // Find the body of this entry by counting braces
    let depth = 1;
    let pos = match.index + match[0].length;
    const start = pos;
    while (pos < content.length && depth > 0) {
      if (content[pos] === '{') depth++;
      else if (content[pos] === '}') depth--;
      pos++;
    }
    const body = content.slice(start, pos - 1);

    // Parse field = {value} or field = "value" pairs
    const fieldRegex = /(\w+)\s*=\s*(?:\{([^}]*(?:\{[^}]*\}[^}]*)*)\}|"([^"]*)")/g;
    const entry: BibEntry = { citationKey, entryType };
    let fieldMatch: RegExpExecArray | null;

    while ((fieldMatch = fieldRegex.exec(body)) !== null) {
      const fieldName = fieldMatch[1].toLowerCase();
      const fieldValue = (fieldMatch[2] ?? fieldMatch[3] ?? '').trim();
      entry[fieldName] = fieldValue;
    }

    entries.push(entry);
  }

  return entries;
}

/**
 * Analyze references from BibTeX content
 */
async function analyzeBibReferences(bibContent: string, detailed: boolean = false): Promise<ReferenceAnalysis> {
  const entries = parseBibTeX(bibContent);
  const references: ReferenceResult[] = [];

  for (const entry of entries) {
    if (entry.doi) {
      const check = await checkDOIResolves(entry.doi);
      const ref: ReferenceResult = {
        label: entry.citationKey,
        title: entry.title,
        doi: check.doi,
        status: check.status,
        error: check.error
      };
      if (detailed && check.status === 'ok') {
        await fetchDOIMetadata(ref);
      }
      references.push(ref);
    } else {
      references.push({
        label: entry.citationKey,
        title: entry.title,
        status: 'no-doi'
      });
    }
  }

  return { references, source: 'bibtex' };
}

/**
 * Check if a DOI resolves via doi.org (covers all registrars).
 * Returns 'ok' or 'not-found' status with the cleaned DOI.
 */
async function checkDOIResolves(doi: string): Promise<{ doi: string; status: 'ok' | 'not-found'; error?: string }> {
  try {
    const cleanDOI = doi.replace(/^https?:\/\/(dx\.)?doi\.org\//, '');

    if (!isValidDOI(`10.${cleanDOI.split('.').slice(1).join('.')}`)) {
      return { doi: cleanDOI, status: 'not-found', error: 'invalid DOI format' };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(`https://doi.org/${encodeURIComponent(cleanDOI)}`, {
      method: 'HEAD',
      redirect: 'follow',
      headers: {
        'User-Agent': 'Colloquium-Reference-Bot/1.0 (mailto:support@colloquium.org)'
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    return {
      doi: cleanDOI,
      status: response.ok ? 'ok' : 'not-found',
      error: response.ok ? undefined : 'does not resolve'
    };
  } catch (error) {
    let errorMessage = 'unknown error';
    if (error instanceof Error) {
      errorMessage = error.name === 'AbortError' ? 'request timeout' : error.message;
    }
    return { doi, status: 'not-found', error: errorMessage };
  }
}

/**
 * Fetch metadata for a DOI from CrossRef, falling back to DataCite.
 * Mutates the result object in place to add metadata fields.
 */
async function fetchDOIMetadata(result: ReferenceResult): Promise<void> {
  const doi = result.doi!;

  try {
    // Try CrossRef first
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(`https://api.crossref.org/works/${encodeURIComponent(doi)}`, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Colloquium-Reference-Bot/1.0 (mailto:support@colloquium.org)'
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      const work = data.message;
      result.title = work.title?.[0] || 'Unknown title';
      result.authors = work.author?.map((author: any) =>
        `${author.given || ''} ${author.family || ''}`.trim()
      ) || [];
      result.publicationYear = work.published?.['date-parts']?.[0]?.[0] ||
                              work.created?.['date-parts']?.[0]?.[0];
      result.journal = work['container-title']?.[0] || work.publisher || 'Unknown journal';
      return;
    }
  } catch {
    // CrossRef failed, try DataCite
  }

  try {
    // Fallback to DataCite
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(`https://api.datacite.org/dois/${encodeURIComponent(doi)}`, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Colloquium-Reference-Bot/1.0 (mailto:support@colloquium.org)'
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      const attrs = data.data?.attributes;
      if (attrs) {
        result.title = attrs.titles?.[0]?.title || 'Unknown title';
        result.authors = attrs.creators?.map((c: any) =>
          `${c.givenName || ''} ${c.familyName || c.name || ''}`.trim()
        ) || [];
        result.publicationYear = attrs.publicationYear ? Number(attrs.publicationYear) : undefined;
        result.journal = attrs.container?.title || attrs.publisher || 'Unknown publisher';
      }
    }
  } catch {
    // Metadata unavailable — not critical
  }
}

/**
 * Extract references from manuscript content
 */
function extractReferences(content: string): string[] {
  // This is a simplified extraction - in reality, you'd want more sophisticated parsing
  const lines = content.split('\n');
  const references: string[] = [];
  
  let inReferencesSection = false;
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    
    // Detect start of references section (supports markdown headings like ## References)
    if (/^#{0,6}\s*(references|bibliography|works?\s+cited|literature\s+cited)\s*$/i.test(trimmedLine)) {
      inReferencesSection = true;
      continue;
    }

    // Detect end of references (any new heading means references section is over)
    if (inReferencesSection && /^#{1,6}\s+\S/.test(trimmedLine)) {
      break;
    }
    
    // Extract reference lines
    if (inReferencesSection && trimmedLine.length > 20) {
      // Skip section headers
      if (!/^[A-Z\s]+$/.test(trimmedLine)) {
        references.push(trimmedLine);
      }
    }
  }
  
  return references;
}

/**
 * Analyze references for DOI presence and validity
 */
async function analyzeReferences(content: string, detailed: boolean = false): Promise<ReferenceAnalysis> {
  const rawReferences = extractReferences(content);
  const references: ReferenceResult[] = [];

  for (let i = 0; i < rawReferences.length; i++) {
    const refText = rawReferences[i];
    const dois = extractDOIs(refText);

    if (dois.length > 0) {
      const check = await checkDOIResolves(dois[0]);
      const ref: ReferenceResult = {
        label: `ref-${i + 1}`,
        title: refText.substring(0, 150),
        doi: check.doi,
        status: check.status,
        error: check.error
      };
      if (detailed && check.status === 'ok') {
        await fetchDOIMetadata(ref);
      }
      references.push(ref);
    } else {
      references.push({
        label: `ref-${i + 1}`,
        title: refText.substring(0, 150),
        status: 'no-doi'
      });
    }
  }

  return { references, source: 'markdown' as const };
}

const checkDoiCommand: BotCommand = {
  name: 'check-doi',
  description: 'Check all references in the manuscript for DOI presence and validity',
  usage: '@bot-reference-check check-doi [detailed=false] [timeout=30]',
  help: `Performs comprehensive analysis of all references in your manuscript to ensure proper DOI formatting and availability.

**What this command does:**
1. Extracts all references from the manuscript
2. Identifies DOIs in each reference
3. Validates DOI format (10.xxxx/xxxx)
4. Attempts to resolve each DOI via CrossRef API
5. Retrieves metadata for successfully resolved DOIs
6. Generates a detailed report with recommendations

**Parameters:**
- **detailed** (boolean, optional): Include full metadata for resolved DOIs
- **timeout** (number, optional): Maximum time in seconds to wait for DOI resolution (5-60)

**Output includes:**
- Summary statistics (total refs, DOI coverage, resolution rate)
- List of references missing DOIs
- Invalid or malformed DOIs
- DOIs that don't resolve
- JSON report attachment for detailed analysis

**Examples:**
- \`@bot-reference-check check-doi\` - Basic analysis
- \`@bot-reference-check check-doi detailed=true\` - Include paper titles and authors
- \`@bot-reference-check check-doi timeout=60 detailed=true\` - Extended timeout with full details`,
  parameters: [
    {
      name: 'detailed',
      description: 'Include detailed metadata for each resolved DOI',
      type: 'boolean',
      required: false,
      defaultValue: false,
      examples: ['true', 'false']
    },
    {
      name: 'timeout',
      description: 'Timeout in seconds for DOI resolution (max 60)',
      type: 'number',
      required: false,
      defaultValue: 30,
      validation: z.number().min(5).max(60),
      examples: ['30', '45', '60']
    }
  ],
  examples: [
    '@bot-reference-check check-doi',
    '@bot-reference-check check-doi detailed=true',
    '@bot-reference-check check-doi timeout=45 detailed=true'
  ],
  permissions: ['read_manuscript', 'read_manuscript_files'],
  async execute(params, context) {
    const { detailed, timeout } = params;
    const { manuscriptId, serviceToken } = context;

    try {
      // Validate we have a service token for API access
      if (!serviceToken) {
        return {
          messages: [{
            content: `❌ **Authentication Error**\n\nNo service token available. The bot cannot access manuscript files without proper authentication.`
          }]
        };
      }

      let message = `🔍 **DOI Reference Check**\n\n`;
      message += `**Manuscript ID:** ${manuscriptId}\n`;

      // Fetch manuscript files
      const files = await getManuscriptFiles(manuscriptId, serviceToken);

      if (files.length === 0) {
        return {
          messages: [{
            content: `${message}\n❌ **No files found**\n\nThis manuscript has no uploaded files to analyze.`
          }]
        };
      }

      // Check for bibliography file (preferred source)
      const bibFile = findBibliographyFile(files);
      // Find source file as fallback
      const sourceFile = findSourceFile(files);

      if (!bibFile && !sourceFile) {
        const fileList = files.map(f => `- ${f.originalName} (${f.fileType})`).join('\n');
        return {
          messages: [{
            content: `${message}\n❌ **No suitable file found**\n\nCould not find a .bib bibliography file or a markdown/text source file to analyze. Available files:\n${fileList}\n\nPlease ensure your manuscript includes a .bib file or a .md/.txt file with a References section.`
          }]
        };
      }

      if (bibFile) {
        message += `**Reference source:** ${bibFile.originalName} (BibTeX)\n`;
      } else {
        message += `**Reference source:** ${sourceFile!.originalName} (markdown fallback)\n`;
      }

      message += `**Analysis Settings:**\n`;
      message += `- Detailed metadata: ${detailed ? 'Yes' : 'No'}\n`;
      message += `- Timeout: ${timeout} seconds\n\n`;

      // Perform analysis: prioritize .bib file, fall back to markdown
      let analysisPromise: Promise<ReferenceAnalysis>;

      if (bibFile) {
        const bibContent = await downloadFileContent(bibFile.downloadUrl, serviceToken);
        analysisPromise = analyzeBibReferences(bibContent, detailed);
      } else {
        const manuscriptContent = await downloadFileContent(sourceFile!.downloadUrl, serviceToken);
        analysisPromise = analyzeReferences(manuscriptContent, detailed);
      }

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Analysis timeout')), timeout * 1000)
      );

      const analysis = await Promise.race([analysisPromise, timeoutPromise]);

      // Build unified reference list
      for (let i = 0; i < analysis.references.length; i++) {
        const ref = analysis.references[i];
        const icon = ref.status === 'ok' ? '✅' : '❌';
        const titlePart = ref.title ? `: ${ref.title.substring(0, 100)}${ref.title.length > 100 ? '...' : ''}` : '';
        let doiPart = '';
        if (ref.doi) {
          doiPart = ` — \`${ref.doi}\``;
          if (ref.status === 'not-found' && ref.error) {
            doiPart += ` (${ref.error})`;
          }
        } else {
          doiPart = ' — no DOI';
        }
        message += `${i + 1}. ${icon} **${ref.label}**${titlePart}${doiPart}\n`;

        // Detailed metadata sub-lines for resolving DOIs
        if (detailed && ref.status === 'ok') {
          if (ref.authors && ref.authors.length > 0) {
            message += `   Authors: ${ref.authors.slice(0, 3).join(', ')}${ref.authors.length > 3 ? ' et al.' : ''}\n`;
          }
          if (ref.journal) message += `   Journal: ${ref.journal}\n`;
          if (ref.publicationYear) message += `   Year: ${ref.publicationYear}\n`;
        }
      }

      const totalRefs = analysis.references.length;
      const okCount = analysis.references.filter(r => r.status === 'ok').length;
      const noDOICount = analysis.references.filter(r => r.status === 'no-doi').length;
      const notFoundCount = analysis.references.filter(r => r.status === 'not-found').length;

      const reportData = {
        manuscriptId,
        timestamp: new Date().toISOString(),
        summary: {
          totalReferences: totalRefs,
          referencesWithDOI: totalRefs - noDOICount,
          resolvingDOIs: okCount,
          nonResolvingDOIs: notFoundCount,
          missingDOIs: noDOICount
        },
        references: analysis.references
      };

      return {
        messages: [{
          content: message,
          attachments: [{
            type: 'report',
            filename: `doi-check-report-${manuscriptId}.json`,
            data: JSON.stringify(reportData, null, 2),
            mimetype: 'application/json'
          }]
        }]
      };

    } catch (error) {
      return {
        messages: [{
          content: `❌ **Error during DOI check:** ${error instanceof Error ? error.message : 'Unknown error'}\n\nPlease try again or contact support if the issue persists.`
        }]
      };
    }
  }
};

// Remove the manual help command - it will be auto-injected by the framework

export const referenceCheckBot: CommandBot = {
  id: 'bot-reference-check',
  name: 'Reference Check Bot',
  description: 'Validates DOIs resolve to real papers and flags references missing DOIs',
  version: '1.0.0',
  commands: [checkDoiCommand],
  keywords: ['references', 'doi', 'citation', 'bibliography', 'validation'],
  triggers: ['MANUSCRIPT_SUBMITTED'],
  permissions: ['read_manuscript', 'read_manuscript_files'],
  help: {
    overview: 'Analyzes manuscript references to ensure all citations have valid, resolving DOIs and flags any references without DOIs.',
    quickStart: 'Use @bot-reference-check check-doi to analyze all references in your manuscript.',
    examples: [
      '@bot-reference-check check-doi',
      '@bot-reference-check check-doi detailed=true timeout=60'
    ]
  },
  customHelpSections: [
    {
      title: '🔍 What I Check',
      content: '✅ DOI presence in each reference\n✅ DOI format validation\n✅ DOI resolution (can the DOI be accessed?)\n✅ Metadata retrieval from CrossRef',
      position: 'before'
    },
    {
      title: '🚨 Common Issues I Find',
      content: '❌ References missing DOIs\n❌ Malformed DOI formats\n❌ DOIs that don\'t resolve to actual papers\n❌ Broken or outdated DOI links',
      position: 'before'
    },
    {
      title: '💡 Tips for Better References',
      content: 'Always include DOIs when available. Use the format "DOI: 10.xxxx/xxxx" or "https://doi.org/10.xxxx/xxxx". Verify DOIs work before submission. For papers without DOIs, consider citing more recent versions if available.',
      position: 'after'
    }
  ]
};

// Export the bot for npm package compatibility
export default referenceCheckBot;