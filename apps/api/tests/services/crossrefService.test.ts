import { CrossrefService, crossrefService } from '../../src/services/crossrefService';

// Mock dependencies
jest.mock('@colloquium/database', () => ({
  prisma: {
    manuscripts: {
      findUnique: jest.fn(),
      update: jest.fn()
    }
  }
}));

jest.mock('../../src/routes/settings', () => ({
  getJournalSettings: jest.fn()
}));

// Mock global fetch
global.fetch = jest.fn();

// Mock FormData and Blob for Node.js environment
global.FormData = jest.fn().mockImplementation(() => ({
  append: jest.fn()
})) as any;

global.Blob = jest.fn().mockImplementation((content, options) => ({
  content,
  type: options?.type
})) as any;

describe('CrossrefService', () => {
  const { prisma } = require('@colloquium/database');
  const { getJournalSettings } = require('../../src/routes/settings');

  let service: CrossrefService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CrossrefService();
  });

  describe('generateDoiSuffix', () => {
    it('should generate suffix with current year and short manuscript ID', () => {
      const manuscriptId = 'abc12345-6789-0123-4567-890abcdef012';
      const suffix = service.generateDoiSuffix(manuscriptId);

      const currentYear = new Date().getFullYear();
      expect(suffix).toBe(`${currentYear}.abc12345`);
    });

    it('should handle short manuscript IDs', () => {
      const manuscriptId = 'short';
      const suffix = service.generateDoiSuffix(manuscriptId);

      const currentYear = new Date().getFullYear();
      expect(suffix).toBe(`${currentYear}.short`);
    });
  });

  describe('buildDoi', () => {
    it('should combine prefix and suffix with slash', () => {
      const doi = service.buildDoi('10.12345', '2024.abc12345');
      expect(doi).toBe('10.12345/2024.abc12345');
    });

    it('should handle prefixes without leading 10.', () => {
      const doi = service.buildDoi('10.54321', 'suffix');
      expect(doi).toBe('10.54321/suffix');
    });
  });

  describe('parseName', () => {
    it('should parse "Given Surname" format', () => {
      const result = service.parseName('John Smith');
      expect(result).toEqual({ givenNames: 'John', surname: 'Smith' });
    });

    it('should parse "Given Middle Surname" format', () => {
      const result = service.parseName('John Adam Smith');
      expect(result).toEqual({ givenNames: 'John Adam', surname: 'Smith' });
    });

    it('should parse "Given A. Surname" format', () => {
      const result = service.parseName('John A. Smith');
      expect(result).toEqual({ givenNames: 'John A.', surname: 'Smith' });
    });

    it('should parse "Surname, Given" format', () => {
      const result = service.parseName('Smith, John');
      expect(result).toEqual({ givenNames: 'John', surname: 'Smith' });
    });

    it('should parse "Surname, Given Middle" format', () => {
      const result = service.parseName('Smith, John Adam');
      expect(result).toEqual({ givenNames: 'John Adam', surname: 'Smith' });
    });

    it('should handle single name as surname', () => {
      const result = service.parseName('Madonna');
      expect(result).toEqual({ givenNames: '', surname: 'Madonna' });
    });

    it('should trim whitespace', () => {
      const result = service.parseName('  John  Smith  ');
      expect(result).toEqual({ givenNames: 'John', surname: 'Smith' });
    });

    it('should handle empty comma-separated name', () => {
      const result = service.parseName('Smith,');
      expect(result).toEqual({ givenNames: '', surname: 'Smith' });
    });
  });

  describe('generateCrossrefXML', () => {
    const mockSettings = {
      name: 'Test Journal',
      issn: '1234-5678',
      eissn: '8765-4321',
      abbrevTitle: 'Test J.',
      doiPrefix: '10.12345',
      publisherName: 'Test Publisher',
      contactEmail: 'test@example.com'
    };

    const mockManuscript = {
      id: 'manuscript-123',
      title: 'Test Article Title',
      abstract: 'This is a test abstract.',
      volume: '5',
      issue: '2',
      publishedAt: new Date('2024-06-15'),
      acceptedDate: new Date('2024-05-01'),
      articleType: 'research-article',
      manuscript_authors: [
        {
          isCorresponding: true,
          order: 1,
          users: {
            name: 'John Smith',
            givenNames: 'John',
            surname: 'Smith',
            orcidId: '0000-0001-2345-6789',
            affiliation: 'Test University'
          }
        },
        {
          isCorresponding: false,
          order: 2,
          users: {
            name: 'Jane Doe',
            givenNames: null,
            surname: null,
            orcidId: null,
            affiliation: 'Another University'
          }
        }
      ]
    };

    beforeEach(() => {
      getJournalSettings.mockResolvedValue(mockSettings);
      prisma.manuscripts.findUnique.mockResolvedValue(mockManuscript);
    });

    it('should generate valid XML with all fields', async () => {
      const xml = await service.generateCrossrefXML('manuscript-123');

      expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(xml).toContain('xmlns="http://www.crossref.org/schema/5.4.0"');
      expect(xml).toContain('<full_title>Test Journal</full_title>');
      expect(xml).toContain('<abbrev_title>Test J.</abbrev_title>');
      expect(xml).toContain('<issn media_type="print">1234-5678</issn>');
      expect(xml).toContain('<issn media_type="electronic">8765-4321</issn>');
      expect(xml).toContain('<title>Test Article Title</title>');
      expect(xml).toContain('<volume>5</volume>');
      expect(xml).toContain('<issue>2</issue>');
    });

    it('should include author information', async () => {
      const xml = await service.generateCrossrefXML('manuscript-123');

      expect(xml).toContain('<contributors>');
      expect(xml).toContain('<given_name>John</given_name>');
      expect(xml).toContain('<surname>Smith</surname>');
      expect(xml).toContain('sequence="first"');
      expect(xml).toContain('sequence="additional"');
    });

    it('should include ORCID when available', async () => {
      const xml = await service.generateCrossrefXML('manuscript-123');

      expect(xml).toContain('<ORCID authenticated="false">https://orcid.org/0000-0001-2345-6789</ORCID>');
    });

    it('should parse name when givenNames/surname not set', async () => {
      const xml = await service.generateCrossrefXML('manuscript-123');

      // Jane Doe should have her name parsed
      expect(xml).toContain('<given_name>Jane</given_name>');
      expect(xml).toContain('<surname>Doe</surname>');
    });

    it('should include publication dates', async () => {
      const xml = await service.generateCrossrefXML('manuscript-123');

      expect(xml).toContain('<publication_date media_type="online">');
      expect(xml).toContain('<year>2024</year>');
      // Month and day may vary by timezone, just verify the structure exists
      expect(xml).toMatch(/<month>\d{2}<\/month>/);
      expect(xml).toMatch(/<day>\d{2}<\/day>/);
    });

    it('should include DOI data', async () => {
      const xml = await service.generateCrossrefXML('manuscript-123');

      // DOI format: prefix/year.shortId (first 8 chars of manuscript ID)
      expect(xml).toMatch(/<doi>10\.12345\/\d{4}\.[a-z0-9]+<\/doi>/);
      expect(xml).toContain('<resource>');
      expect(xml).toContain('/articles/manuscript-123</resource>');
    });

    it('should escape XML special characters', async () => {
      const manuscriptWithSpecialChars = {
        ...mockManuscript,
        title: 'Effects of A & B on <C>',
        abstract: 'Testing "quotes" and \'apostrophes\''
      };
      prisma.manuscripts.findUnique.mockResolvedValue(manuscriptWithSpecialChars);

      const xml = await service.generateCrossrefXML('manuscript-123');

      expect(xml).toContain('Effects of A &amp; B on &lt;C&gt;');
      expect(xml).toContain('&quot;quotes&quot;');
      expect(xml).toContain('&apos;apostrophes&apos;');
    });

    it('should throw error for non-existent manuscript', async () => {
      prisma.manuscripts.findUnique.mockResolvedValue(null);

      await expect(service.generateCrossrefXML('nonexistent'))
        .rejects.toThrow('Manuscript nonexistent not found');
    });
  });

  describe('submitDeposit', () => {
    const config = {
      username: 'testuser',
      password: 'testpass',
      doiPrefix: '10.12345',
      testMode: true
    };

    const sampleXml = `<?xml version="1.0" encoding="UTF-8"?>
<doi_batch>
  <head><doi_batch_id>batch-123</doi_batch_id></head>
  <body><doi>10.12345/2024.test</doi></body>
</doi_batch>`;

    it('should submit to test endpoint when testMode is true', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('SUCCESS')
      });

      await service.submitDeposit(sampleXml, config);

      expect(global.fetch).toHaveBeenCalledWith(
        'https://test.crossref.org/servlet/deposit',
        expect.any(Object)
      );
    });

    it('should submit to production endpoint when testMode is false', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('SUCCESS')
      });

      await service.submitDeposit(sampleXml, { ...config, testMode: false });

      expect(global.fetch).toHaveBeenCalledWith(
        'https://doi.crossref.org/servlet/deposit',
        expect.any(Object)
      );
    });

    it('should return success with DOI on successful response', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('SUCCESS')
      });

      const result = await service.submitDeposit(sampleXml, config);

      expect(result.success).toBe(true);
      expect(result.doi).toBe('10.12345/2024.test');
      expect(result.depositId).toBe('batch-123');
    });

    it('should return failure on HTTP error', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 401,
        text: () => Promise.resolve('Unauthorized')
      });

      const result = await service.submitDeposit(sampleXml, config);

      expect(result.success).toBe(false);
      expect(result.error).toContain('HTTP 401');
    });

    it('should return failure when response contains FAILURE', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('FAILURE: Invalid XML')
      });

      const result = await service.submitDeposit(sampleXml, config);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Crossref rejected deposit');
    });

    it('should handle network errors gracefully', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const result = await service.submitDeposit(sampleXml, config);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });
  });

  describe('registerManuscript', () => {
    const enabledSettings = {
      crossrefEnabled: true,
      doiPrefix: '10.12345',
      crossrefUsername: 'testuser',
      crossrefPassword: 'testpass',
      crossrefTestMode: true,
      name: 'Test Journal'
    };

    const mockManuscript = {
      id: 'manuscript-123',
      title: 'Test Article',
      manuscript_authors: []
    };

    beforeEach(() => {
      prisma.manuscripts.findUnique.mockResolvedValue(mockManuscript);
      prisma.manuscripts.update.mockResolvedValue({});
    });

    it('should return error when Crossref is not enabled', async () => {
      getJournalSettings.mockResolvedValue({ crossrefEnabled: false });

      const result = await service.registerManuscript('manuscript-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Crossref integration is not enabled');
    });

    it('should return error when credentials are missing', async () => {
      getJournalSettings.mockResolvedValue({
        crossrefEnabled: true,
        doiPrefix: '10.12345'
        // Missing username and password
      });

      const result = await service.registerManuscript('manuscript-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Crossref credentials or DOI prefix not configured');
    });

    it('should update manuscript status to pending before submission', async () => {
      getJournalSettings.mockResolvedValue(enabledSettings);
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('SUCCESS')
      });

      await service.registerManuscript('manuscript-123');

      expect(prisma.manuscripts.update).toHaveBeenCalledWith({
        where: { id: 'manuscript-123' },
        data: expect.objectContaining({
          crossrefStatus: 'pending',
          crossrefError: null
        })
      });
    });

    it('should update manuscript with DOI on success', async () => {
      getJournalSettings.mockResolvedValue(enabledSettings);
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('SUCCESS')
      });

      await service.registerManuscript('manuscript-123');

      // Second update should have success status
      const successUpdate = prisma.manuscripts.update.mock.calls[1];
      expect(successUpdate[0].data).toEqual(expect.objectContaining({
        crossrefStatus: 'success',
        crossrefError: null
      }));
      expect(successUpdate[0].data.doi).toBeDefined();
    });

    it('should update manuscript with error on failure', async () => {
      getJournalSettings.mockResolvedValue(enabledSettings);
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Server Error')
      });

      await service.registerManuscript('manuscript-123');

      // Second update should have failed status
      const failureUpdate = prisma.manuscripts.update.mock.calls[1];
      expect(failureUpdate[0].data).toEqual(expect.objectContaining({
        crossrefStatus: 'failed'
      }));
      expect(failureUpdate[0].data.crossrefError).toBeDefined();
    });
  });

  describe('crossrefService singleton', () => {
    it('should export a singleton instance', () => {
      expect(crossrefService).toBeInstanceOf(CrossrefService);
    });
  });

  describe('generateCrossrefXML with funding', () => {
    const mockSettings = {
      name: 'Test Journal',
      issn: '1234-5678',
      eissn: '8765-4321',
      doiPrefix: '10.12345',
      publisherName: 'Test Publisher',
      contactEmail: 'test@example.com'
    };

    const mockManuscriptWithFunding = {
      id: 'manuscript-funding-test',
      title: 'Funded Research Article',
      abstract: 'Research supported by multiple funding sources.',
      volume: '5',
      issue: '2',
      publishedAt: new Date('2024-06-15'),
      articleType: 'research-article',
      manuscript_authors: [
        {
          isCorresponding: true,
          order: 1,
          creditRoles: ['conceptualization', 'writing-original-draft'],
          users: {
            name: 'John Smith',
            givenNames: 'John',
            surname: 'Smith',
            orcidId: null,
            affiliation: 'Test University'
          }
        }
      ],
      manuscript_funding: [
        {
          funderName: 'National Science Foundation',
          funderDoi: '10.13039/100000001',
          awardId: 'BCS-1234567',
          awardTitle: 'Understanding Human Cognition'
        },
        {
          funderName: 'National Institutes of Health',
          funderDoi: '10.13039/100000002',
          awardId: 'R01-MH123456',
          awardTitle: null
        },
        {
          funderName: 'Private Foundation',
          funderDoi: null,
          awardId: null,
          awardTitle: null
        }
      ]
    };

    beforeEach(() => {
      getJournalSettings.mockResolvedValue(mockSettings);
      prisma.manuscripts.findUnique.mockResolvedValue(mockManuscriptWithFunding);
    });

    it('should include FundRef program element when funding exists', async () => {
      const xml = await service.generateCrossrefXML('manuscript-funding-test');

      expect(xml).toContain('xmlns:fr="http://www.crossref.org/fundref.xsd"');
      expect(xml).toContain('<fr:program');
      expect(xml).toContain('name="fundref"');
    });

    it('should include funder names in funding XML', async () => {
      const xml = await service.generateCrossrefXML('manuscript-funding-test');

      expect(xml).toContain('National Science Foundation');
      expect(xml).toContain('National Institutes of Health');
      expect(xml).toContain('Private Foundation');
    });

    it('should include funder DOIs as funder_identifier', async () => {
      const xml = await service.generateCrossrefXML('manuscript-funding-test');

      expect(xml).toContain('<fr:assertion name="funder_identifier">https://doi.org/10.13039/100000001</fr:assertion>');
      expect(xml).toContain('<fr:assertion name="funder_identifier">https://doi.org/10.13039/100000002</fr:assertion>');
    });

    it('should include award numbers', async () => {
      const xml = await service.generateCrossrefXML('manuscript-funding-test');

      expect(xml).toContain('<fr:assertion name="award_number">BCS-1234567</fr:assertion>');
      expect(xml).toContain('<fr:assertion name="award_number">R01-MH123456</fr:assertion>');
    });

    it('should handle funders without DOI', async () => {
      const xml = await service.generateCrossrefXML('manuscript-funding-test');

      // Private Foundation should appear without funder_identifier
      expect(xml).toContain('Private Foundation');
      // But the XML should still be valid
      expect(xml).toContain('<fr:assertion name="fundgroup">');
    });

    it('should not include FundRef when no funding exists', async () => {
      prisma.manuscripts.findUnique.mockResolvedValue({
        ...mockManuscriptWithFunding,
        manuscript_funding: []
      });

      const xml = await service.generateCrossrefXML('manuscript-funding-test');

      expect(xml).not.toContain('<fr:program');
      expect(xml).not.toContain('fundref.xsd');
    });
  });

  describe('generateCrossrefXML with CRediT roles', () => {
    const mockSettings = {
      name: 'Test Journal',
      doiPrefix: '10.12345',
      publisherName: 'Test Publisher',
      contactEmail: 'test@example.com'
    };

    const mockManuscriptWithRoles = {
      id: 'manuscript-credit-test',
      title: 'Article with CRediT Roles',
      abstract: 'Testing CRediT roles integration.',
      publishedAt: new Date('2024-06-15'),
      manuscript_authors: [
        {
          isCorresponding: true,
          order: 1,
          creditRoles: ['conceptualization', 'writing-original-draft', 'supervision'],
          users: {
            name: 'Principal Investigator',
            givenNames: 'Principal',
            surname: 'Investigator',
            orcidId: null,
            affiliation: 'Lead University'
          }
        },
        {
          isCorresponding: false,
          order: 2,
          creditRoles: ['methodology', 'software', 'formal-analysis'],
          users: {
            name: 'Technical Lead',
            givenNames: 'Technical',
            surname: 'Lead',
            orcidId: null,
            affiliation: 'Research Lab'
          }
        }
      ],
      manuscript_funding: []
    };

    beforeEach(() => {
      getJournalSettings.mockResolvedValue(mockSettings);
      prisma.manuscripts.findUnique.mockResolvedValue(mockManuscriptWithRoles);
    });

    it('should still generate valid contributors even with CRediT roles', async () => {
      const xml = await service.generateCrossrefXML('manuscript-credit-test');

      expect(xml).toContain('<contributors>');
      expect(xml).toContain('<person_name');
      expect(xml).toContain('contributor_role="author"');
    });

    it('should include author names with CRediT roles', async () => {
      const xml = await service.generateCrossrefXML('manuscript-credit-test');

      expect(xml).toContain('<given_name>Principal</given_name>');
      expect(xml).toContain('<surname>Investigator</surname>');
      expect(xml).toContain('<given_name>Technical</given_name>');
      expect(xml).toContain('<surname>Lead</surname>');
    });
  });
});
