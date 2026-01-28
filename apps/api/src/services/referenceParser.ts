import { ParsedReference } from '@colloquium/types';

// Dynamic import for ESM module
let Cite: any = null;

async function getCite() {
  if (!Cite) {
    // citation-js is an ESM module, so we need to dynamically import it
    const { Cite: CiteClass } = await import('@citation-js/core');
    await import('@citation-js/plugin-bibtex');
    Cite = CiteClass;
  }
  return Cite;
}

/**
 * Parse BibTeX content into structured reference data
 */
export async function parseBibTeX(content: string): Promise<ParsedReference[]> {
  if (!content || !content.trim()) {
    return [];
  }

  try {
    const CiteClass = await getCite();
    const cite = new CiteClass(content);
    const data = cite.data;

    return data.map((entry: any) => ({
      id: entry.id || entry['citation-key'] || '',
      type: mapCslType(entry.type),
      title: entry.title,
      authors: entry.author?.map((a: any) => ({
        given: a.given || '',
        family: a.family || ''
      })) || [],
      year: extractYear(entry.issued),
      doi: entry.DOI,
      journal: entry['container-title'],
      volume: entry.volume?.toString(),
      issue: entry.issue?.toString(),
      pages: entry.page,
      publisher: entry.publisher,
      url: entry.URL
    }));
  } catch (error) {
    console.error('Error parsing BibTeX:', error);
    return [];
  }
}

/**
 * Map CSL types to common reference types
 */
function mapCslType(cslType: string): string {
  const typeMap: Record<string, string> = {
    'article-journal': 'article',
    'article': 'article',
    'book': 'book',
    'chapter': 'inbook',
    'paper-conference': 'inproceedings',
    'thesis': 'thesis',
    'report': 'techreport',
    'webpage': 'misc',
    'dataset': 'misc'
  };
  return typeMap[cslType] || cslType || 'misc';
}

/**
 * Extract year from CSL date-parts structure
 */
function extractYear(issued: any): number | undefined {
  if (!issued) return undefined;

  // CSL date structure: { 'date-parts': [[year, month, day]] }
  if (issued['date-parts'] && issued['date-parts'][0]) {
    return issued['date-parts'][0][0];
  }

  // Fallback: try to extract year from raw string
  if (issued.raw) {
    const match = issued.raw.match(/\d{4}/);
    if (match) return parseInt(match[0], 10);
  }

  return undefined;
}

/**
 * Validate that a string appears to be valid BibTeX
 */
export function isValidBibTeX(content: string): boolean {
  if (!content || !content.trim()) {
    return false;
  }

  // Check for at least one BibTeX entry pattern
  const entryPattern = /@\w+\s*\{/;
  return entryPattern.test(content);
}

/**
 * Count the number of entries in a BibTeX string
 */
export function countBibTeXEntries(content: string): number {
  if (!content) return 0;
  const matches = content.match(/@\w+\s*\{/g);
  return matches ? matches.length : 0;
}
