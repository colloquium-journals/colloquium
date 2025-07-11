import path from 'path';
import { prisma } from '@colloquium/database';

export interface FormatDetectionResult {
  detectedFormat: string | null;
  confidence: number; // 0-1 scale
  suggestedFormat?: string;
  errors: string[];
  warnings: string[];
}

export interface FormatDefinition {
  name: string;
  displayName: string;
  fileExtensions: string[];
  mimeTypes: string[];
  description?: string;
  isActive: boolean;
}

export class FormatDetectionService {
  private formatCache: Map<string, FormatDefinition> = new Map();
  private cacheExpiry: number = 0;
  private cacheDuration = 5 * 60 * 1000; // 5 minutes

  /**
   * Detect format based on file extension, MIME type, and content analysis
   */
  async detectFormat(
    originalName: string,
    mimeType: string,
    fileContent?: Buffer
  ): Promise<FormatDetectionResult> {
    const result: FormatDetectionResult = {
      detectedFormat: null,
      confidence: 0,
      errors: [],
      warnings: []
    };

    try {
      // Get supported formats
      const supportedFormats = await this.getSupportedFormats();
      
      // Extract file extension
      const fileExtension = path.extname(originalName).toLowerCase();
      
      // Format detection pipeline
      const candidates = this.findFormatCandidates(
        fileExtension,
        mimeType,
        supportedFormats
      );

      if (candidates.length === 0) {
        result.warnings.push(`No supported format found for extension '${fileExtension}' and MIME type '${mimeType}'`);
        result.suggestedFormat = this.suggestClosestFormat(fileExtension, supportedFormats);
        return result;
      }

      // If we have multiple candidates, try content analysis
      if (candidates.length > 1 && fileContent) {
        const contentAnalysis = this.analyzeContent(fileContent, candidates);
        if (contentAnalysis.format) {
          result.detectedFormat = contentAnalysis.format;
          result.confidence = contentAnalysis.confidence;
          return result;
        }
      }

      // Use the first (most confident) candidate
      const bestCandidate = candidates[0];
      result.detectedFormat = bestCandidate.format.name;
      result.confidence = bestCandidate.confidence;

      return result;
    } catch (error) {
      result.errors.push(`Format detection error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return result;
    }
  }

  /**
   * Get all supported formats from the database
   */
  async getSupportedFormats(): Promise<FormatDefinition[]> {
    // Check cache first
    if (this.formatCache.size > 0 && Date.now() < this.cacheExpiry) {
      return Array.from(this.formatCache.values());
    }

    try {
      const formats = await prisma.supported_formats.findMany({
        where: { isActive: true },
        orderBy: { name: 'asc' }
      });

      // Update cache
      this.formatCache.clear();
      formats.forEach(format => {
        this.formatCache.set(format.name, {
          name: format.name,
          displayName: format.displayName,
          fileExtensions: format.fileExtensions,
          mimeTypes: format.mimeTypes,
          description: format.description || undefined,
          isActive: format.isActive
        });
      });
      this.cacheExpiry = Date.now() + this.cacheDuration;

      return Array.from(this.formatCache.values());
    } catch (error) {
      console.error('Error fetching supported formats:', error);
      // Return default formats if database fails
      return this.getDefaultFormats();
    }
  }

  /**
   * Register a new format in the database
   */
  async registerFormat(formatDef: Omit<FormatDefinition, 'isActive'>): Promise<void> {
    await prisma.supportedFormat.create({
      data: {
        name: formatDef.name,
        displayName: formatDef.displayName,
        fileExtensions: formatDef.fileExtensions,
        mimeTypes: formatDef.mimeTypes,
        description: formatDef.description,
        isActive: true
      }
    });

    // Clear cache to force refresh
    this.formatCache.clear();
    this.cacheExpiry = 0;
  }

  /**
   * Validate file against a specific format
   */
  async validateFile(
    originalName: string,
    mimeType: string,
    formatName: string,
    fileContent?: Buffer
  ): Promise<FormatDetectionResult> {
    const format = this.formatCache.get(formatName);
    if (!format) {
      return {
        detectedFormat: null,
        confidence: 0,
        errors: [`Unknown format: ${formatName}`],
        warnings: []
      };
    }

    const fileExtension = path.extname(originalName).toLowerCase();
    
    const result: FormatDetectionResult = {
      detectedFormat: formatName,
      confidence: 0,
      errors: [],
      warnings: []
    };

    // Check extension match
    if (!format.fileExtensions.includes(fileExtension)) {
      result.errors.push(`File extension '${fileExtension}' not supported for format '${formatName}'`);
    }

    // Check MIME type match
    if (!format.mimeTypes.includes(mimeType)) {
      result.warnings.push(`MIME type '${mimeType}' unusual for format '${formatName}'`);
    }

    // Content validation if available
    if (fileContent) {
      const contentValidation = this.validateContent(fileContent, formatName);
      result.confidence = contentValidation.confidence;
      result.errors.push(...contentValidation.errors);
      result.warnings.push(...contentValidation.warnings);
    } else {
      result.confidence = result.errors.length === 0 ? 0.8 : 0.3;
    }

    return result;
  }

  // Private helper methods

  private findFormatCandidates(
    fileExtension: string,
    mimeType: string,
    supportedFormats: FormatDefinition[]
  ): Array<{ format: FormatDefinition; confidence: number }> {
    const candidates: Array<{ format: FormatDefinition; confidence: number }> = [];

    for (const format of supportedFormats) {
      let confidence = 0;

      // Extension match (primary indicator)
      if (format.fileExtensions.includes(fileExtension)) {
        confidence += 0.6;
      }

      // MIME type match (secondary indicator)
      if (format.mimeTypes.includes(mimeType)) {
        confidence += 0.4;
      }

      // Partial MIME type match (e.g., text/* matches text/markdown)
      const baseMimeType = mimeType.split('/')[0] + '/*';
      if (format.mimeTypes.some(mt => mt === baseMimeType)) {
        confidence += 0.2;
      }

      if (confidence > 0) {
        candidates.push({ format, confidence });
      }
    }

    // Sort by confidence (highest first)
    return candidates.sort((a, b) => b.confidence - a.confidence);
  }

  private analyzeContent(
    content: Buffer,
    candidates: Array<{ format: FormatDefinition; confidence: number }>
  ): { format: string | null; confidence: number } {
    const text = content.toString('utf-8', 0, Math.min(content.length, 1024)); // First 1KB
    
    // Simple content pattern matching
    for (const candidate of candidates) {
      const patterns = this.getContentPatterns(candidate.format.name);
      let patternMatches = 0;

      for (const pattern of patterns) {
        if (pattern.test(text)) {
          patternMatches++;
        }
      }

      if (patternMatches > 0) {
        const contentConfidence = Math.min(patternMatches / patterns.length, 1.0) * 0.8;
        return {
          format: candidate.format.name,
          confidence: Math.max(candidate.confidence, contentConfidence)
        };
      }
    }

    return { format: null, confidence: 0 };
  }

  private getContentPatterns(formatName: string): RegExp[] {
    switch (formatName.toLowerCase()) {
      case 'markdown':
        return [
          /^#\s+/m,           // Headers
          /\*\*.*\*\*/,       // Bold text
          /\[.*\]\(.*\)/,     // Links
          /```[\s\S]*?```/,   // Code blocks
        ];
      case 'latex':
        return [
          /\\documentclass/,
          /\\begin{document}/,
          /\\section/,
          /\\usepackage/,
        ];
      case 'quarto':
        return [
          /^---$/m,           // YAML frontmatter
          /^title:/m,
          /^format:/m,
          /```{.*}/,          // Code chunks
        ];
      default:
        return [];
    }
  }

  private validateContent(
    content: Buffer,
    formatName: string
  ): { confidence: number; errors: string[]; warnings: string[] } {
    const result = { confidence: 0.5, errors: [] as string[], warnings: [] as string[] };
    
    // Basic content validation
    if (content.length === 0) {
      result.errors.push('File is empty');
      result.confidence = 0;
      return result;
    }

    // Format-specific validation
    switch (formatName.toLowerCase()) {
      case 'markdown':
        result.confidence = this.validateMarkdown(content, result);
        break;
      case 'latex':
        result.confidence = this.validateLatex(content, result);
        break;
      default:
        result.confidence = 0.7; // Default confidence for unknown formats
    }

    return result;
  }

  private validateMarkdown(
    content: Buffer, 
    result: { errors: string[]; warnings: string[] }
  ): number {
    const text = content.toString('utf-8');
    
    // Check for binary content (likely not markdown)
    if (text.includes('\0')) {
      result.errors.push('File appears to contain binary data, not text');
      return 0;
    }

    // Check for common markdown patterns
    const hasHeaders = /^#+\s/.test(text);
    const hasLinks = /\[.*\]\(.*\)/.test(text);
    const hasFormatting = /\*.*\*|_.*_/.test(text);
    
    let confidence = 0.3; // Base confidence
    if (hasHeaders) confidence += 0.3;
    if (hasLinks) confidence += 0.2;
    if (hasFormatting) confidence += 0.2;

    return Math.min(confidence, 1.0);
  }

  private validateLatex(
    content: Buffer,
    result: { errors: string[]; warnings: string[] }
  ): number {
    const text = content.toString('utf-8');
    
    // Check for required LaTeX elements
    const hasDocumentClass = /\\documentclass/.test(text);
    const hasBeginDocument = /\\begin{document}/.test(text);
    const hasEndDocument = /\\end{document}/.test(text);
    
    let confidence = 0.2; // Base confidence
    
    if (hasDocumentClass) confidence += 0.3;
    if (hasBeginDocument) confidence += 0.3;
    if (hasEndDocument) confidence += 0.2;
    
    if (hasBeginDocument && !hasEndDocument) {
      result.warnings.push('Document has \\begin{document} but no \\end{document}');
    }

    return Math.min(confidence, 1.0);
  }

  private suggestClosestFormat(
    fileExtension: string,
    supportedFormats: FormatDefinition[]
  ): string | undefined {
    // Simple suggestion based on common extensions
    const extensionMap: Record<string, string> = {
      '.txt': 'text',
      '.doc': 'docx',
      '.docx': 'docx',
      '.pdf': 'pdf',
      '.html': 'html',
      '.htm': 'html',
      '.xml': 'xml',
    };

    const suggested = extensionMap[fileExtension];
    if (suggested && supportedFormats.some(f => f.name === suggested)) {
      return suggested;
    }

    return undefined;
  }

  private getDefaultFormats(): FormatDefinition[] {
    return [
      {
        name: 'markdown',
        displayName: 'Markdown',
        fileExtensions: ['.md', '.markdown'],
        mimeTypes: ['text/markdown', 'text/x-markdown'],
        description: 'Markdown text format',
        isActive: true
      },
      {
        name: 'latex',
        displayName: 'LaTeX',
        fileExtensions: ['.tex', '.latex'],
        mimeTypes: ['application/x-latex', 'text/x-tex'],
        description: 'LaTeX document format',
        isActive: true
      },
      {
        name: 'pdf',
        displayName: 'PDF',
        fileExtensions: ['.pdf'],
        mimeTypes: ['application/pdf'],
        description: 'Portable Document Format',
        isActive: true
      }
    ];
  }
}

// Export a default instance
export const formatDetection = new FormatDetectionService();