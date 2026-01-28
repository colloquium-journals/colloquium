import { prisma } from '@colloquium/database';
import { getJournalSettings } from '../routes/settings';

export interface CrossrefConfig {
  username: string;
  password: string;
  doiPrefix: string;
  testMode: boolean;
}

export interface CrossrefDepositResult {
  success: boolean;
  doi?: string;
  depositId?: string;
  error?: string;
}

export interface AuthorInfo {
  givenNames?: string;
  surname?: string;
  name?: string;
  orcid?: string;
  affiliation?: string;
  isCorresponding?: boolean;
}

export class CrossrefService {
  /**
   * Generate a DOI suffix based on year and manuscript ID
   */
  generateDoiSuffix(manuscriptId: string): string {
    const year = new Date().getFullYear();
    const shortId = manuscriptId.substring(0, 8);
    return `${year}.${shortId}`;
  }

  /**
   * Build a full DOI from prefix and suffix
   */
  buildDoi(prefix: string, suffix: string): string {
    return `${prefix}/${suffix}`;
  }

  /**
   * Parse a name string into given names and surname
   * Handles formats like "John Smith", "Smith, John", "John A. Smith"
   */
  parseName(name: string): { givenNames: string; surname: string } {
    const trimmedName = name.trim();

    if (trimmedName.includes(',')) {
      const [surname, givenNames] = trimmedName.split(',').map(s => s.trim());
      return { givenNames: givenNames || '', surname: surname || '' };
    }

    const parts = trimmedName.split(/\s+/);
    if (parts.length === 1) {
      return { givenNames: '', surname: parts[0] };
    }

    const surname = parts.pop() || '';
    const givenNames = parts.join(' ');
    return { givenNames, surname };
  }

  /**
   * Generate Crossref XML for a manuscript following schema 5.4.0
   */
  async generateCrossrefXML(manuscriptId: string): Promise<string> {
    const settings = await getJournalSettings();

    const manuscript = await prisma.manuscripts.findUnique({
      where: { id: manuscriptId },
      include: {
        manuscript_authors: {
          orderBy: { order: 'asc' },
          include: {
            users: {
              select: {
                name: true,
                givenNames: true,
                surname: true,
                orcidId: true,
                affiliation: true
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

    const doiSuffix = this.generateDoiSuffix(manuscriptId);
    const doi = this.buildDoi(settings.doiPrefix || '10.0000', doiSuffix);
    const timestamp = Date.now();
    const batchId = `colloquium-${timestamp}`;

    const escapeXml = (str: string | null | undefined): string => {
      if (!str) return '';
      return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
    };

    const formatDate = (date: Date | null | undefined): string => {
      if (!date) return '';
      const d = new Date(date);
      return `<month>${String(d.getMonth() + 1).padStart(2, '0')}</month>
            <day>${String(d.getDate()).padStart(2, '0')}</day>
            <year>${d.getFullYear()}</year>`;
    };

    // Map CRediT role codes to Crossref contributor roles where possible
    const creditToContributorRole = (creditRoles: string[]): string => {
      // Crossref supports: author, editor, chair, translator, contributor
      // For now, we default to 'author' since most CRediT roles map to author
      return 'author';
    };

    const buildAuthorXml = (author: typeof manuscript.manuscript_authors[0], index: number): string => {
      const user = author.users;
      let givenNames = user.givenNames;
      let surname = user.surname;

      if (!givenNames || !surname) {
        const parsed = this.parseName(user.name || '');
        givenNames = givenNames || parsed.givenNames;
        surname = surname || parsed.surname;
      }

      const sequence = index === 0 ? 'first' : 'additional';
      const contributorRole = creditToContributorRole(author.creditRoles || []);

      let orcidXml = '';
      if (user.orcidId) {
        const orcidUrl = user.orcidId.startsWith('http')
          ? user.orcidId
          : `https://orcid.org/${user.orcidId}`;
        orcidXml = `<ORCID authenticated="false">${escapeXml(orcidUrl)}</ORCID>`;
      }

      let affiliationXml = '';
      if (user.affiliation) {
        affiliationXml = `<affiliations>
              <institution>
                <institution_name>${escapeXml(user.affiliation)}</institution_name>
              </institution>
            </affiliations>`;
      }

      return `<person_name sequence="${sequence}" contributor_role="${contributorRole}">
            <given_name>${escapeXml(givenNames)}</given_name>
            <surname>${escapeXml(surname)}</surname>
            ${orcidXml}
            ${affiliationXml}
          </person_name>`;
    };

    // Build funding XML (FundRef)
    const buildFundingXml = (): string => {
      if (!manuscript.manuscript_funding || manuscript.manuscript_funding.length === 0) {
        return '';
      }

      const fundingGroups = manuscript.manuscript_funding.map(funding => {
        let funderIdXml = '';
        if (funding.funderDoi) {
          const doiUrl = funding.funderDoi.startsWith('http')
            ? funding.funderDoi
            : `https://doi.org/${funding.funderDoi}`;
          funderIdXml = `
            <fr:assertion name="funder_identifier">${escapeXml(doiUrl)}</fr:assertion>`;
        }

        let awardXml = '';
        if (funding.awardId) {
          awardXml = `
          <fr:assertion name="award_number">${escapeXml(funding.awardId)}</fr:assertion>`;
        }

        return `<fr:assertion name="fundgroup">
          <fr:assertion name="funder_name">
            ${escapeXml(funding.funderName)}${funderIdXml}
          </fr:assertion>${awardXml}
        </fr:assertion>`;
      }).join('\n        ');

      return `<fr:program xmlns:fr="http://www.crossref.org/fundref.xsd" name="fundref">
        ${fundingGroups}
      </fr:program>`;
    };

    const authorsXml = manuscript.manuscript_authors.length > 0
      ? `<contributors>
          ${manuscript.manuscript_authors.map((a, i) => buildAuthorXml(a, i)).join('\n          ')}
        </contributors>`
      : '';

    const publicationDateXml = manuscript.publishedAt
      ? `<publication_date media_type="online">
          ${formatDate(manuscript.publishedAt)}
        </publication_date>`
      : '';

    const acceptedDateXml = manuscript.acceptedDate
      ? `<acceptance_date>
          ${formatDate(manuscript.acceptedDate)}
        </acceptance_date>`
      : '';

    const fundingXml = buildFundingXml();

    const articleUrl = `${process.env.FRONTEND_URL || 'https://journal.example.com'}/articles/${manuscriptId}`;

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<doi_batch xmlns="http://www.crossref.org/schema/5.4.0"
           xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
           xsi:schemaLocation="http://www.crossref.org/schema/5.4.0 https://www.crossref.org/schemas/crossref5.4.0.xsd"
           version="5.4.0">
  <head>
    <doi_batch_id>${batchId}</doi_batch_id>
    <timestamp>${timestamp}</timestamp>
    <depositor>
      <depositor_name>${escapeXml(settings.publisherName || 'Colloquium')}</depositor_name>
      <email_address>${escapeXml(settings.contactEmail || 'admin@journal.example.com')}</email_address>
    </depositor>
    <registrant>${escapeXml(settings.publisherName || 'Colloquium')}</registrant>
  </head>
  <body>
    <journal>
      <journal_metadata language="en">
        <full_title>${escapeXml(settings.name)}</full_title>
        ${settings.abbrevTitle ? `<abbrev_title>${escapeXml(settings.abbrevTitle)}</abbrev_title>` : ''}
        ${settings.issn ? `<issn media_type="print">${escapeXml(settings.issn)}</issn>` : ''}
        ${settings.eissn ? `<issn media_type="electronic">${escapeXml(settings.eissn)}</issn>` : ''}
      </journal_metadata>
      ${manuscript.volume || manuscript.issue ? `<journal_issue>
        ${manuscript.volume ? `<journal_volume><volume>${escapeXml(manuscript.volume)}</volume></journal_volume>` : ''}
        ${manuscript.issue ? `<issue>${escapeXml(manuscript.issue)}</issue>` : ''}
      </journal_issue>` : ''}
      <journal_article publication_type="${manuscript.articleType || 'full_text'}">
        <titles>
          <title>${escapeXml(manuscript.title)}</title>
        </titles>
        ${authorsXml}
        ${publicationDateXml}
        ${acceptedDateXml}
        ${manuscript.abstract ? `<jats:abstract xmlns:jats="http://www.ncbi.nlm.nih.gov/JATS1">
          <jats:p>${escapeXml(manuscript.abstract)}</jats:p>
        </jats:abstract>` : ''}
        ${fundingXml}
        <doi_data>
          <doi>${escapeXml(doi)}</doi>
          <resource>${escapeXml(articleUrl)}</resource>
        </doi_data>
      </journal_article>
    </journal>
  </body>
</doi_batch>`;

    return xml;
  }

  /**
   * Submit a Crossref deposit via their API
   */
  async submitDeposit(xml: string, config: CrossrefConfig): Promise<CrossrefDepositResult> {
    const baseUrl = config.testMode
      ? 'https://test.crossref.org/servlet/deposit'
      : 'https://doi.crossref.org/servlet/deposit';

    try {
      const formData = new FormData();
      formData.append('operation', 'doMDUpload');
      formData.append('login_id', config.username);
      formData.append('login_passwd', config.password);

      const blob = new Blob([xml], { type: 'application/xml' });
      formData.append('fname', blob, 'deposit.xml');

      const response = await fetch(baseUrl, {
        method: 'POST',
        body: formData
      });

      const responseText = await response.text();

      if (!response.ok) {
        return {
          success: false,
          error: `HTTP ${response.status}: ${responseText}`
        };
      }

      if (responseText.includes('SUCCESS') || responseText.includes('success')) {
        const doiMatch = xml.match(/<doi>([^<]+)<\/doi>/);
        const batchIdMatch = xml.match(/<doi_batch_id>([^<]+)<\/doi_batch_id>/);

        return {
          success: true,
          doi: doiMatch ? doiMatch[1] : undefined,
          depositId: batchIdMatch ? batchIdMatch[1] : undefined
        };
      }

      if (responseText.includes('FAILURE') || responseText.includes('failure') || responseText.includes('error')) {
        return {
          success: false,
          error: `Crossref rejected deposit: ${responseText.substring(0, 500)}`
        };
      }

      const doiMatch = xml.match(/<doi>([^<]+)<\/doi>/);
      const batchIdMatch = xml.match(/<doi_batch_id>([^<]+)<\/doi_batch_id>/);

      return {
        success: true,
        doi: doiMatch ? doiMatch[1] : undefined,
        depositId: batchIdMatch ? batchIdMatch[1] : undefined
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error during Crossref submission'
      };
    }
  }

  /**
   * Register a manuscript with Crossref
   */
  async registerManuscript(manuscriptId: string): Promise<CrossrefDepositResult> {
    const settings = await getJournalSettings();

    if (!settings.crossrefEnabled) {
      return {
        success: false,
        error: 'Crossref integration is not enabled'
      };
    }

    if (!settings.doiPrefix || !settings.crossrefUsername || !settings.crossrefPassword) {
      return {
        success: false,
        error: 'Crossref credentials or DOI prefix not configured'
      };
    }

    try {
      await prisma.manuscripts.update({
        where: { id: manuscriptId },
        data: {
          crossrefStatus: 'pending',
          crossrefError: null,
          updatedAt: new Date()
        }
      });

      const xml = await this.generateCrossrefXML(manuscriptId);

      const result = await this.submitDeposit(xml, {
        username: settings.crossrefUsername,
        password: settings.crossrefPassword,
        doiPrefix: settings.doiPrefix,
        testMode: settings.crossrefTestMode !== false
      });

      if (result.success) {
        await prisma.manuscripts.update({
          where: { id: manuscriptId },
          data: {
            doi: result.doi,
            crossrefDepositId: result.depositId,
            crossrefStatus: 'success',
            crossrefRegisteredAt: new Date(),
            crossrefError: null,
            updatedAt: new Date()
          }
        });
      } else {
        await prisma.manuscripts.update({
          where: { id: manuscriptId },
          data: {
            crossrefStatus: 'failed',
            crossrefError: result.error,
            updatedAt: new Date()
          }
        });
      }

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      await prisma.manuscripts.update({
        where: { id: manuscriptId },
        data: {
          crossrefStatus: 'failed',
          crossrefError: errorMessage,
          updatedAt: new Date()
        }
      });

      return {
        success: false,
        error: errorMessage
      };
    }
  }
}

export const crossrefService = new CrossrefService();
