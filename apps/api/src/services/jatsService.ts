import { prisma } from '@colloquium/database';
import { JatsGenerationResult, ParsedReference } from '@colloquium/types';
import { getJournalSettings } from '../routes/settings';
import { parseBibTeX } from './referenceParser';
import { validateJatsForPmc } from './pmcValidator';
import axios from 'axios';
import fs from 'fs';
import path from 'path';

const PANDOC_SERVICE_URL = process.env.PANDOC_SERVICE_URL || 'http://localhost:8080';

export class JatsService {
  /**
   * Generate complete JATS XML for a published manuscript
   */
  async generateJatsXml(manuscriptId: string): Promise<JatsGenerationResult> {
    try {
      // Load manuscript with all related data
      const manuscript = await prisma.manuscripts.findUnique({
        where: { id: manuscriptId },
        include: {
          manuscript_authors: {
            orderBy: { order: 'asc' },
            include: {
              users: {
                include: {
                  affiliations: true
                }
              }
            }
          },
          manuscript_funding: true,
          manuscript_files: true
        }
      });

      if (!manuscript) {
        return { success: false, error: `Manuscript ${manuscriptId} not found` };
      }

      if (manuscript.status !== 'PUBLISHED') {
        return { success: false, error: 'Only published manuscripts can export JATS XML' };
      }

      // Get journal settings
      const settings = await getJournalSettings();

      // Find source file (markdown)
      const sourceFile = manuscript.manuscript_files.find(f => f.fileType === 'SOURCE');
      if (!sourceFile) {
        return { success: false, error: 'No source file found for manuscript' };
      }

      // Read source content
      let sourceContent: string;
      try {
        const filePath = this.resolveFilePath(sourceFile.path);
        sourceContent = fs.readFileSync(filePath, 'utf-8');
      } catch (err) {
        return { success: false, error: `Failed to read source file: ${err}` };
      }

      // Find bibliography file if present
      const bibFile = manuscript.manuscript_files.find(f => f.fileType === 'BIBLIOGRAPHY');
      let bibliography = '';
      let parsedReferences: ParsedReference[] = [];

      if (bibFile) {
        try {
          const bibPath = this.resolveFilePath(bibFile.path);
          bibliography = fs.readFileSync(bibPath, 'utf-8');
          parsedReferences = await parseBibTeX(bibliography);
        } catch (err) {
          console.warn('Failed to read bibliography file:', err);
        }
      }

      // Build JATS-compatible metadata
      const metadata = this.buildJatsMetadata(manuscript, settings);

      // Call Pandoc service to generate JATS XML
      try {
        const response = await axios.post(`${PANDOC_SERVICE_URL}/convert`, {
          markdown: sourceContent,
          outputFormat: 'jats',
          bibliography: bibliography,
          metadata: metadata
        }, {
          responseType: 'text',
          timeout: 60000
        });

        let jatsXml = response.data as string;

        // Post-process: ensure PMC-required elements are present
        jatsXml = this.postProcessJatsXml(jatsXml, manuscript, settings, parsedReferences);

        return { success: true, xml: jatsXml };

      } catch (pandocError: any) {
        const errorMsg = pandocError.response?.data?.error || pandocError.message;
        return { success: false, error: `Pandoc conversion failed: ${errorMsg}` };
      }

    } catch (error: any) {
      return { success: false, error: `JATS generation failed: ${error.message}` };
    }
  }

  /**
   * Build JATS-compatible metadata for Pandoc
   */
  private buildJatsMetadata(manuscript: any, settings: any): object {
    const authors = manuscript.manuscript_authors.map((ma: any, index: number) => {
      const user = ma.users;
      const affiliations = user.affiliations?.map((aff: any, affIndex: number) => ({
        id: `aff${index + 1}-${affIndex + 1}`,
        organization: aff.institution,
        department: aff.department,
        city: aff.city,
        region: aff.state,
        country: aff.country
      })) || [];

      // If no structured affiliations, use the legacy affiliation string
      if (affiliations.length === 0 && user.affiliation) {
        affiliations.push({
          id: `aff${index + 1}`,
          organization: user.affiliation
        });
      }

      return {
        name: {
          'given-names': user.givenNames || this.parseGivenName(user.name),
          surname: user.surname || this.parseSurname(user.name)
        },
        email: user.email,
        orcid: user.orcidId ? (user.orcidId.startsWith('http') ? user.orcidId : `https://orcid.org/${user.orcidId}`) : undefined,
        'cor-id': ma.isCorresponding,
        affiliation: affiliations,
        role: ma.creditRoles || []
      };
    });

    const funding = manuscript.manuscript_funding?.map((f: any) => ({
      funder: {
        name: f.funderName,
        doi: f.funderDoi
      },
      award: f.awardId ? { id: f.awardId } : undefined
    })) || [];

    return {
      title: manuscript.title,
      author: authors,
      abstract: manuscript.abstract,
      journal: {
        title: settings.name,
        'abbrev-title': settings.abbrevTitle,
        pissn: settings.issn,
        eissn: settings.eissn,
        publisher: {
          name: settings.publisherName || 'Colloquium'
        }
      },
      volume: manuscript.volume,
      issue: manuscript.issue,
      'elocation-id': manuscript.elocationId,
      date: {
        received: manuscript.receivedDate ? this.formatDateForYaml(manuscript.receivedDate) : undefined,
        accepted: manuscript.acceptedDate ? this.formatDateForYaml(manuscript.acceptedDate) : undefined,
        published: manuscript.publishedAt ? this.formatDateForYaml(manuscript.publishedAt) : undefined
      },
      doi: manuscript.doi,
      copyright: {
        holder: settings.copyrightHolder || 'The Authors',
        year: manuscript.publishedAt ? new Date(manuscript.publishedAt).getFullYear() : new Date().getFullYear()
      },
      license: {
        type: settings.licenseType || 'CC-BY-4.0',
        link: settings.licenseUrl || 'https://creativecommons.org/licenses/by/4.0/'
      },
      funding: funding.length > 0 ? funding : undefined,
      subject: manuscript.subjects || [],
      keywords: manuscript.keywords || []
    };
  }

  /**
   * Post-process JATS XML to ensure PMC requirements are met
   */
  private postProcessJatsXml(xml: string, manuscript: any, settings: any, references: ParsedReference[]): string {
    // Ensure DTD declaration is present
    if (!xml.includes('<!DOCTYPE')) {
      xml = `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE article PUBLIC "-//NLM//DTD JATS (Z39.96) Journal Publishing DTD v1.3 20210610//EN" "https://jats.nlm.nih.gov/publishing/1.3/JATS-journalpublishing1-3.dtd">\n${xml.replace(/^<\?xml[^>]*\?>\n?/, '')}`;
    }

    // Add article-id with DOI if not present
    if (manuscript.doi && !xml.includes('pub-id-type="doi"')) {
      const articleMetaMatch = xml.match(/<article-meta>/);
      if (articleMetaMatch) {
        xml = xml.replace(
          /<article-meta>/,
          `<article-meta>\n    <article-id pub-id-type="doi">${this.escapeXml(manuscript.doi)}</article-id>`
        );
      }
    }

    // Ensure journal-meta is present
    if (!xml.includes('<journal-meta>')) {
      const frontMatch = xml.match(/<front>/);
      if (frontMatch) {
        const journalMeta = this.buildJournalMetaXml(settings);
        xml = xml.replace(/<front>/, `<front>\n${journalMeta}`);
      }
    }

    return xml;
  }

  /**
   * Build journal-meta XML element
   */
  private buildJournalMetaXml(settings: any): string {
    const parts: string[] = [];
    parts.push('    <journal-meta>');

    if (settings.name) {
      parts.push(`      <journal-title-group>`);
      parts.push(`        <journal-title>${this.escapeXml(settings.name)}</journal-title>`);
      if (settings.abbrevTitle) {
        parts.push(`        <abbrev-journal-title>${this.escapeXml(settings.abbrevTitle)}</abbrev-journal-title>`);
      }
      parts.push(`      </journal-title-group>`);
    }

    if (settings.issn) {
      parts.push(`      <issn pub-type="ppub">${this.escapeXml(settings.issn)}</issn>`);
    }
    if (settings.eissn) {
      parts.push(`      <issn pub-type="epub">${this.escapeXml(settings.eissn)}</issn>`);
    }

    if (settings.publisherName) {
      parts.push(`      <publisher>`);
      parts.push(`        <publisher-name>${this.escapeXml(settings.publisherName)}</publisher-name>`);
      if (settings.publisherLocation) {
        parts.push(`        <publisher-loc>${this.escapeXml(settings.publisherLocation)}</publisher-loc>`);
      }
      parts.push(`      </publisher>`);
    }

    parts.push('    </journal-meta>');
    return parts.join('\n');
  }

  /**
   * Parse bibliography content and return structured references
   */
  async parseBibliography(content: string): Promise<ParsedReference[]> {
    return parseBibTeX(content);
  }

  /**
   * Validate JATS XML for PMC requirements
   */
  validateForPmc(xml: string) {
    return validateJatsForPmc(xml);
  }

  /**
   * Resolve file path (handle both absolute and relative paths)
   */
  private resolveFilePath(filePath: string): string {
    if (filePath.startsWith('/uploads/')) {
      return '.' + filePath;
    }
    return filePath;
  }

  /**
   * Parse given name from a full name string
   */
  private parseGivenName(name: string | null): string {
    if (!name) return '';
    const parts = name.trim().split(/\s+/);
    if (parts.length <= 1) return '';
    return parts.slice(0, -1).join(' ');
  }

  /**
   * Parse surname from a full name string
   */
  private parseSurname(name: string | null): string {
    if (!name) return '';
    const parts = name.trim().split(/\s+/);
    return parts[parts.length - 1] || '';
  }

  /**
   * Format date for YAML metadata
   */
  private formatDateForYaml(date: Date | string): string {
    const d = new Date(date);
    return d.toISOString().split('T')[0];
  }

  /**
   * Escape XML special characters
   */
  private escapeXml(str: string | null | undefined): string {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}

export const jatsService = new JatsService();
