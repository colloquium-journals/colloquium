import { prisma } from '@colloquium/database';
import { getJournalSettings } from '../routes/settings';

export interface DoajSubmitResult {
  success: boolean;
  articleId?: string;
  error?: string;
}

export class DoajService {
  private escapeXml(str: string | null | undefined): string {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  private formatDate(date: Date | null | undefined): string {
    if (!date) return '';
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  async generateDoajXML(manuscriptId: string): Promise<string> {
    const settings = await getJournalSettings();

    const manuscript = await prisma.manuscripts.findUnique({
      where: { id: manuscriptId },
      include: {
        manuscript_authors: {
          orderBy: { order: 'asc' },
          include: {
            users: {
              select: {
                id: true,
                name: true,
                givenNames: true,
                surname: true,
                orcidId: true,
                affiliation: true,
                affiliations: {
                  where: { isPrimary: true },
                  take: 1
                }
              }
            }
          }
        },
        manuscript_funding: true
      }
    });

    if (!manuscript) {
      throw new Error(`Manuscript ${manuscriptId} not found`);
    }

    if (manuscript.status !== 'PUBLISHED') {
      throw new Error(`Manuscript ${manuscriptId} is not published`);
    }

    const escape = this.escapeXml.bind(this);

    // Build affiliations list for deduplication
    const affiliationMap = new Map<string, number>();
    let affiliationCounter = 1;

    manuscript.manuscript_authors.forEach(author => {
      const user = author.users;
      // Use structured affiliation if available, otherwise use legacy affiliation field
      const primaryAffiliation = user.affiliations?.[0];
      const affiliationName = primaryAffiliation
        ? `${primaryAffiliation.institution}${primaryAffiliation.department ? ', ' + primaryAffiliation.department : ''}`
        : user.affiliation;

      if (affiliationName && !affiliationMap.has(affiliationName)) {
        affiliationMap.set(affiliationName, affiliationCounter++);
      }
    });

    // Build authors XML
    const authorsXml = manuscript.manuscript_authors.map(author => {
      const user = author.users;
      const primaryAffiliation = user.affiliations?.[0];
      const affiliationName = primaryAffiliation
        ? `${primaryAffiliation.institution}${primaryAffiliation.department ? ', ' + primaryAffiliation.department : ''}`
        : user.affiliation;
      const affiliationId = affiliationName ? affiliationMap.get(affiliationName) : undefined;

      let orcidXml = '';
      if (user.orcidId) {
        const orcidId = user.orcidId.replace('https://orcid.org/', '').replace('http://orcid.org/', '');
        orcidXml = `<orcid_id>${escape(orcidId)}</orcid_id>`;
      }

      return `<author>
        <name>${escape(user.name || '')}</name>
        ${affiliationId ? `<affiliationId>${affiliationId}</affiliationId>` : ''}
        ${orcidXml}
      </author>`;
    }).join('\n      ');

    // Build affiliations XML
    const affiliationsXml = Array.from(affiliationMap.entries()).map(([name, id]) => {
      return `<affiliation>
        <affiliationId>${id}</affiliationId>
        <affiliationName>${escape(name)}</affiliationName>
      </affiliation>`;
    }).join('\n      ');

    // Build keywords
    const keywordsXml = manuscript.keywords && manuscript.keywords.length > 0
      ? `<keywords>${escape(manuscript.keywords.join(', '))}</keywords>`
      : '';

    // Get article URL
    const articleUrl = `${process.env.FRONTEND_URL || 'https://journal.example.com'}/articles/${manuscriptId}`;

    // License info
    const licenseUrl = settings.licenseUrl || 'https://creativecommons.org/licenses/by/4.0/';
    const licenseType = settings.licenseType || 'CC BY 4.0';

    // Build the DOAJ XML
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<record xmlns="http://doaj.org/features/oai_doaj/1.0/">
  <language>eng</language>
  <publisher>${escape(settings.publisherName || 'Colloquium')}</publisher>
  <journalTitle>${escape(settings.name)}</journalTitle>
  ${settings.issn ? `<issn>${escape(settings.issn)}</issn>` : ''}
  ${settings.eissn ? `<eissn>${escape(settings.eissn)}</eissn>` : ''}
  <publicationDate>${this.formatDate(manuscript.publishedAt)}</publicationDate>
  ${manuscript.volume ? `<volume>${escape(manuscript.volume)}</volume>` : ''}
  ${manuscript.issue ? `<issue>${escape(manuscript.issue)}</issue>` : ''}
  ${manuscript.elocationId ? `<startPage>${escape(manuscript.elocationId)}</startPage>` : ''}
  ${manuscript.doi ? `<doi>${escape(manuscript.doi)}</doi>` : ''}
  <documentType>${escape(manuscript.articleType || 'research-article')}</documentType>
  <title language="eng">${escape(manuscript.title)}</title>
  <authors>
      ${authorsXml}
  </authors>
  ${affiliationMap.size > 0 ? `<affiliations>
      ${affiliationsXml}
  </affiliations>` : ''}
  ${manuscript.abstract ? `<abstract language="eng">${escape(manuscript.abstract)}</abstract>` : ''}
  ${keywordsXml}
  <fullTextUrl format="html">${escape(articleUrl)}</fullTextUrl>
  <license>
    <license_ref>${escape(licenseUrl)}</license_ref>
    <license_type>${escape(licenseType)}</license_type>
  </license>
</record>`;

    return xml;
  }

  async submitToDoaj(manuscriptId: string): Promise<DoajSubmitResult> {
    const settings = await getJournalSettings();

    if (!settings.doajEnabled) {
      return {
        success: false,
        error: 'DOAJ integration is not enabled'
      };
    }

    if (!settings.doajApiKey) {
      return {
        success: false,
        error: 'DOAJ API key is not configured'
      };
    }

    try {
      const xml = await this.generateDoajXML(manuscriptId);

      // DOAJ uses a different API format - they accept JSON, not XML directly
      // This is a placeholder for the actual DOAJ API implementation
      // In practice, you would use their JSON-based API
      const response = await fetch('https://doaj.org/api/articles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/xml',
          'Authorization': `Api-Key ${settings.doajApiKey}`
        },
        body: xml
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          error: `DOAJ API error: ${response.status} - ${errorText.substring(0, 500)}`
        };
      }

      const result = await response.json();

      return {
        success: true,
        articleId: result.id
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error during DOAJ submission'
      };
    }
  }
}

export const doajService = new DoajService();
