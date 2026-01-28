import { DoajService } from '../../src/services/doajService';
import { prisma } from '@colloquium/database';
import { getJournalSettings } from '../../src/routes/settings';

jest.mock('@colloquium/database', () => ({
  prisma: {
    manuscripts: {
      findUnique: jest.fn()
    }
  }
}));

jest.mock('../../src/routes/settings', () => ({
  getJournalSettings: jest.fn()
}));

const mockGetJournalSettings = getJournalSettings as jest.Mock;
const mockManuscriptsFind = prisma.manuscripts.findUnique as jest.Mock;

describe('DoajService', () => {
  let service: DoajService;

  beforeEach(() => {
    service = new DoajService();
    jest.clearAllMocks();
  });

  describe('generateDoajXML', () => {
    const mockSettings = {
      name: 'Test Journal',
      publisherName: 'Test Publisher',
      issn: '1234-5678',
      eissn: '8765-4321',
      licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
      licenseType: 'CC BY 4.0'
    };

    const mockManuscript = {
      id: 'test-manuscript-id',
      title: 'Test Article Title',
      abstract: 'This is a test abstract for the article.',
      status: 'PUBLISHED',
      publishedAt: new Date('2024-06-15'),
      volume: '5',
      issue: '2',
      elocationId: 'e123',
      doi: '10.12345/test.abc',
      articleType: 'research-article',
      keywords: ['keyword1', 'keyword2', 'keyword3'],
      manuscript_authors: [
        {
          order: 0,
          users: {
            id: 'author1',
            name: 'John Smith',
            givenNames: 'John',
            surname: 'Smith',
            orcidId: '0000-0001-2345-6789',
            affiliation: 'Stanford University',
            affiliations: [{
              isPrimary: true,
              institution: 'Stanford University',
              department: 'Department of Psychology'
            }]
          }
        },
        {
          order: 1,
          users: {
            id: 'author2',
            name: 'Jane Doe',
            givenNames: 'Jane',
            surname: 'Doe',
            orcidId: null,
            affiliation: 'MIT',
            affiliations: []
          }
        }
      ],
      manuscript_funding: [
        {
          funderName: 'National Science Foundation',
          funderDoi: '10.13039/100000001',
          awardId: 'BCS-1234567'
        }
      ]
    };

    it('should generate valid DOAJ XML for a published manuscript', async () => {
      mockGetJournalSettings.mockResolvedValue(mockSettings);
      mockManuscriptsFind.mockResolvedValue(mockManuscript);

      const xml = await service.generateDoajXML('test-manuscript-id');

      expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(xml).toContain('<record');
      expect(xml).toContain('<journalTitle>Test Journal</journalTitle>');
      expect(xml).toContain('<publisher>Test Publisher</publisher>');
      expect(xml).toContain('<title language="eng">Test Article Title</title>');
      expect(xml).toContain('<abstract language="eng">This is a test abstract');
      expect(xml).toContain('<volume>5</volume>');
      expect(xml).toContain('<issue>2</issue>');
      expect(xml).toContain('<doi>10.12345/test.abc</doi>');
      expect(xml).toContain('<documentType>research-article</documentType>');
    });

    it('should include authors with ORCID IDs', async () => {
      mockGetJournalSettings.mockResolvedValue(mockSettings);
      mockManuscriptsFind.mockResolvedValue(mockManuscript);

      const xml = await service.generateDoajXML('test-manuscript-id');

      expect(xml).toContain('<name>John Smith</name>');
      expect(xml).toContain('<orcid_id>0000-0001-2345-6789</orcid_id>');
      expect(xml).toContain('<name>Jane Doe</name>');
    });

    it('should include affiliations', async () => {
      mockGetJournalSettings.mockResolvedValue(mockSettings);
      mockManuscriptsFind.mockResolvedValue(mockManuscript);

      const xml = await service.generateDoajXML('test-manuscript-id');

      expect(xml).toContain('<affiliationName>Stanford University, Department of Psychology</affiliationName>');
      expect(xml).toContain('<affiliationName>MIT</affiliationName>');
    });

    it('should include license information', async () => {
      mockGetJournalSettings.mockResolvedValue(mockSettings);
      mockManuscriptsFind.mockResolvedValue(mockManuscript);

      const xml = await service.generateDoajXML('test-manuscript-id');

      expect(xml).toContain('<license_ref>https://creativecommons.org/licenses/by/4.0/</license_ref>');
      expect(xml).toContain('<license_type>CC BY 4.0</license_type>');
    });

    it('should throw error for non-published manuscript', async () => {
      mockGetJournalSettings.mockResolvedValue(mockSettings);
      mockManuscriptsFind.mockResolvedValue({
        ...mockManuscript,
        status: 'SUBMITTED'
      });

      await expect(service.generateDoajXML('test-manuscript-id'))
        .rejects.toThrow('is not published');
    });

    it('should throw error for non-existent manuscript', async () => {
      mockGetJournalSettings.mockResolvedValue(mockSettings);
      mockManuscriptsFind.mockResolvedValue(null);

      await expect(service.generateDoajXML('nonexistent'))
        .rejects.toThrow('not found');
    });

    it('should escape XML special characters', async () => {
      mockGetJournalSettings.mockResolvedValue(mockSettings);
      mockManuscriptsFind.mockResolvedValue({
        ...mockManuscript,
        title: 'Title with <special> & "characters"'
      });

      const xml = await service.generateDoajXML('test-manuscript-id');

      expect(xml).toContain('&lt;special&gt;');
      expect(xml).toContain('&amp;');
      expect(xml).toContain('&quot;characters&quot;');
    });
  });

  describe('submitToDoaj', () => {
    it('should return error when DOAJ is not enabled', async () => {
      mockGetJournalSettings.mockResolvedValue({
        doajEnabled: false
      });

      const result = await service.submitToDoaj('test-manuscript-id');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not enabled');
    });

    it('should return error when API key is not configured', async () => {
      mockGetJournalSettings.mockResolvedValue({
        doajEnabled: true,
        doajApiKey: undefined
      });

      const result = await service.submitToDoaj('test-manuscript-id');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not configured');
    });
  });
});
