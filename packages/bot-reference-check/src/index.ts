import { z } from 'zod';
import { CommandBot, BotCommand } from '@colloquium/types';

// API base URL - configurable for different environments
const API_BASE_URL = process.env.API_URL || 'http://localhost:4000';

// DOI validation regex - matches standard DOI format
const DOI_REGEX = /10\.\d{4,}\/[^\s]+/g;

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

// Interface for DOI resolution result
interface DOIResult {
  doi: string;
  isValid: boolean;
  resolves: boolean;
  title?: string;
  authors?: string[];
  publicationYear?: number;
  journal?: string;
  error?: string;
  httpStatus?: number;
}

// Interface for reference analysis
interface ReferenceAnalysis {
  totalReferences: number;
  referencesWithDOI: number;
  validDOIs: number;
  resolvingDOIs: number;
  missingDOIs: string[];
  invalidDOIs: string[];
  nonResolvingDOIs: string[];
  detailedResults: DOIResult[];
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
  return DOI_REGEX.test(doi);
}

/**
 * Resolve DOI and get metadata
 */
async function resolveDOI(doi: string): Promise<DOIResult> {
  try {
    // Clean the DOI
    const cleanDOI = doi.replace(/^https?:\/\/(dx\.)?doi\.org\//, '');
    
    if (!isValidDOI(`10.${cleanDOI.split('.').slice(1).join('.')}`)) {
      return {
        doi: cleanDOI,
        isValid: false,
        resolves: false,
        error: 'Invalid DOI format'
      };
    }

    // Try to resolve the DOI using CrossRef API
    const crossRefUrl = `https://api.crossref.org/works/${encodeURIComponent(cleanDOI)}`;
    
    // Create a timeout controller
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    const response = await fetch(crossRefUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Colloquium-Reference-Bot/1.0 (mailto:support@colloquium.org)'
      },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);

    const result: DOIResult = {
      doi: cleanDOI,
      isValid: true,
      resolves: response.ok,
      httpStatus: response.status
    };

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
    } else if (response.status === 404) {
      result.error = 'DOI not found in CrossRef database';
    } else {
      result.error = `HTTP ${response.status}: ${response.statusText}`;
    }

    return result;
  } catch (error) {
    let errorMessage = 'Unknown error occurred';
    
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        errorMessage = 'Request timeout (10 seconds)';
      } else {
        errorMessage = error.message;
      }
    }
    
    return {
      doi,
      isValid: isValidDOI(doi),
      resolves: false,
      error: errorMessage
    };
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
    
    // Detect start of references section
    if (/^(references|bibliography|works?\s+cited|literature\s+cited)$/i.test(trimmedLine)) {
      inReferencesSection = true;
      continue;
    }
    
    // Detect end of references (start of appendix, etc.)
    if (inReferencesSection && /^(appendix|supplementary|figures?|tables?)$/i.test(trimmedLine)) {
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
async function analyzeReferences(content: string): Promise<ReferenceAnalysis> {
  const references = extractReferences(content);
  const allDOIs: string[] = [];
  const detailedResults: DOIResult[] = [];
  
  // Extract DOIs from each reference
  for (const reference of references) {
    const dois = extractDOIs(reference);
    allDOIs.push(...dois);
  }
  
  // Remove duplicates
  const uniqueDOIs = [...new Set(allDOIs)];
  
  // Resolve each DOI
  for (const doi of uniqueDOIs) {
    const result = await resolveDOI(doi);
    detailedResults.push(result);
  }
  
  // Analyze results
  const validDOIs = detailedResults.filter(r => r.isValid);
  const resolvingDOIs = detailedResults.filter(r => r.resolves);
  const invalidDOIs = detailedResults.filter(r => !r.isValid).map(r => r.doi);
  const nonResolvingDOIs = detailedResults.filter(r => r.isValid && !r.resolves).map(r => r.doi);
  
  // Find references without DOIs
  const referencesWithoutDOI = references.filter(ref => {
    const dois = extractDOIs(ref);
    return dois.length === 0;
  });
  
  return {
    totalReferences: references.length,
    referencesWithDOI: references.length - referencesWithoutDOI.length,
    validDOIs: validDOIs.length,
    resolvingDOIs: resolvingDOIs.length,
    missingDOIs: referencesWithoutDOI.slice(0, 10), // Limit to first 10 for readability
    invalidDOIs,
    nonResolvingDOIs,
    detailedResults
  };
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

      // Find source file for analysis
      const sourceFile = findSourceFile(files);

      if (!sourceFile) {
        const fileList = files.map(f => `- ${f.originalName} (${f.fileType})`).join('\n');
        return {
          messages: [{
            content: `${message}\n❌ **No suitable source file found**\n\nCould not find a markdown or text file to analyze. Available files:\n${fileList}\n\nPlease ensure your manuscript is uploaded as a .md, .markdown, or .txt file.`
          }]
        };
      }

      message += `**Source file:** ${sourceFile.originalName}\n`;

      // Check for bibliography file
      const bibFile = findBibliographyFile(files);
      if (bibFile) {
        message += `**Bibliography file:** ${bibFile.originalName}\n`;
      }

      message += `**Analysis Settings:**\n`;
      message += `- Detailed metadata: ${detailed ? 'Yes' : 'No'}\n`;
      message += `- Timeout: ${timeout} seconds\n\n`;
      message += `⏳ Analyzing references and resolving DOIs...\n\n`;

      // Download the source file content
      const manuscriptContent = await downloadFileContent(sourceFile.downloadUrl, serviceToken);

      // Also try to get bibliography content if available
      let bibliographyContent = '';
      if (bibFile) {
        try {
          bibliographyContent = await downloadFileContent(bibFile.downloadUrl, serviceToken);
        } catch (e) {
          // Bibliography file is optional, continue without it
        }
      }

      // Combine content for analysis (manuscript + bibliography)
      const fullContent = bibliographyContent
        ? `${manuscriptContent}\n\n## Bibliography Content\n${bibliographyContent}`
        : manuscriptContent;

      // Perform the analysis with timeout
      const analysisPromise = analyzeReferences(fullContent);
      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Analysis timeout')), timeout * 1000)
      );

      const analysis = await Promise.race([analysisPromise, timeoutPromise]);

      // Build summary
      message += `📊 **Summary:**\n`;
      message += `- Total references: ${analysis.totalReferences}\n`;
      message += `- References with DOI: ${analysis.referencesWithDOI}/${analysis.totalReferences} (${Math.round(analysis.referencesWithDOI / analysis.totalReferences * 100)}%)\n`;
      message += `- Valid DOI format: ${analysis.validDOIs}/${analysis.detailedResults.length}\n`;
      message += `- Successfully resolving: ${analysis.resolvingDOIs}/${analysis.validDOIs}\n\n`;

      // Issues section
      let hasIssues = false;
      
      if (analysis.missingDOIs.length > 0) {
        hasIssues = true;
        message += `❌ **Missing DOIs (${analysis.missingDOIs.length}):**\n`;
        analysis.missingDOIs.forEach((ref, i) => {
          message += `${i + 1}. ${ref.substring(0, 100)}${ref.length > 100 ? '...' : ''}\n`;
        });
        message += '\n';
      }

      if (analysis.invalidDOIs.length > 0) {
        hasIssues = true;
        message += `⚠️ **Invalid DOI Format (${analysis.invalidDOIs.length}):**\n`;
        analysis.invalidDOIs.forEach((doi, i) => {
          message += `${i + 1}. ${doi}\n`;
        });
        message += '\n';
      }

      if (analysis.nonResolvingDOIs.length > 0) {
        hasIssues = true;
        message += `🚨 **Non-resolving DOIs (${analysis.nonResolvingDOIs.length}):**\n`;
        analysis.nonResolvingDOIs.forEach((doi, i) => {
          const result = analysis.detailedResults.find(r => r.doi === doi);
          message += `${i + 1}. ${doi}`;
          if (result?.error) {
            message += ` - ${result.error}`;
          }
          message += '\n';
        });
        message += '\n';
      }

      if (!hasIssues) {
        message += `✅ **All Good!** All references have valid, resolving DOIs.\n\n`;
      }

      // Detailed results if requested
      if (detailed && analysis.resolvingDOIs > 0) {
        message += `📚 **Resolved DOI Details:**\n`;
        const resolving = analysis.detailedResults.filter(r => r.resolves);
        resolving.forEach((result, i) => {
          message += `${i + 1}. **${result.doi}**\n`;
          if (result.title) message += `   Title: ${result.title}\n`;
          if (result.authors && result.authors.length > 0) {
            message += `   Authors: ${result.authors.slice(0, 3).join(', ')}${result.authors.length > 3 ? ' et al.' : ''}\n`;
          }
          if (result.journal) message += `   Journal: ${result.journal}\n`;
          if (result.publicationYear) message += `   Year: ${result.publicationYear}\n`;
          message += '\n';
        });
      }

      // Recommendations
      message += `💡 **Recommendations:**\n`;
      if (analysis.missingDOIs.length > 0) {
        message += `- Add DOIs to ${analysis.missingDOIs.length} references without them\n`;
      }
      if (analysis.invalidDOIs.length > 0) {
        message += `- Fix ${analysis.invalidDOIs.length} invalid DOI formats\n`;
      }
      if (analysis.nonResolvingDOIs.length > 0) {
        message += `- Verify ${analysis.nonResolvingDOIs.length} non-resolving DOIs\n`;
      }
      if (!hasIssues) {
        message += `- Great work! Your references are well-formatted with valid DOIs\n`;
      }

      const reportData = {
        manuscriptId,
        timestamp: new Date().toISOString(),
        summary: {
          totalReferences: analysis.totalReferences,
          referencesWithDOI: analysis.referencesWithDOI,
          validDOIs: analysis.validDOIs,
          resolvingDOIs: analysis.resolvingDOIs,
          completenessScore: Math.round(analysis.resolvingDOIs / analysis.totalReferences * 100)
        },
        issues: {
          missingDOIs: analysis.missingDOIs.length,
          invalidDOIs: analysis.invalidDOIs.length,
          nonResolvingDOIs: analysis.nonResolvingDOIs.length
        },
        detailedResults: analysis.detailedResults
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