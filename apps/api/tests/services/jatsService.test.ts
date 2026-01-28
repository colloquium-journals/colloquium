import { JatsService, jatsService } from '../../src/services/jatsService';
import { validateJatsForPmc } from '../../src/services/pmcValidator';

// Mock dependencies
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

jest.mock('axios');

jest.mock('fs', () => ({
  readFileSync: jest.fn(),
  existsSync: jest.fn()
}));

describe('JatsService', () => {
  const { prisma } = require('@colloquium/database');
  const { getJournalSettings } = require('../../src/routes/settings');
  const axios = require('axios');
  const fs = require('fs');

  let service: JatsService;

  const mockSettings = {
    name: 'Test Journal',
    abbrevTitle: 'Test J.',
    issn: '1234-5678',
    eissn: '8765-4321',
    publisherName: 'Test Publisher',
    publisherLocation: 'Test City',
    copyrightHolder: 'The Authors',
    licenseType: 'CC-BY-4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/'
  };

  const mockManuscript = {
    id: 'manuscript-123',
    title: 'Test Article Title',
    abstract: 'This is a test abstract for the article.',
    status: 'PUBLISHED',
    volume: '5',
    issue: '2',
    elocationId: 'e12345',
    doi: '10.12345/2024.test123',
    publishedAt: new Date('2024-06-15'),
    acceptedDate: new Date('2024-05-01'),
    receivedDate: new Date('2024-01-15'),
    keywords: ['science', 'research'],
    subjects: ['Psychology', 'Cognitive Science'],
    articleType: 'research-article',
    manuscript_authors: [
      {
        isCorresponding: true,
        order: 0,
        creditRoles: ['conceptualization', 'writing-original-draft'],
        users: {
          name: 'John Smith',
          givenNames: 'John',
          surname: 'Smith',
          email: 'john@example.com',
          orcidId: '0000-0001-2345-6789',
          affiliations: [
            {
              institution: 'Stanford University',
              department: 'Department of Psychology',
              city: 'Stanford',
              state: 'CA',
              country: 'USA'
            }
          ]
        }
      },
      {
        isCorresponding: false,
        order: 1,
        creditRoles: ['methodology', 'formal-analysis'],
        users: {
          name: 'Jane Doe',
          givenNames: 'Jane',
          surname: 'Doe',
          email: 'jane@example.com',
          orcidId: null,
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
    ],
    manuscript_files: [
      {
        id: 'file-1',
        fileType: 'SOURCE',
        path: '/uploads/manuscripts/manuscript-123/article.md',
        originalName: 'article.md'
      },
      {
        id: 'file-2',
        fileType: 'BIBLIOGRAPHY',
        path: '/uploads/manuscripts/manuscript-123/references.bib',
        originalName: 'references.bib'
      }
    ]
  };

  const mockMarkdownContent = `# Introduction

This is the introduction to the test article.

## Methods

We used various methods [@smith2020; @doe2021].

## Results

The results are significant.

## Discussion

We discuss the findings here.
`;

  const mockBibliography = `@article{smith2020,
  author = {Smith, John A.},
  title = {A Study of Things},
  journal = {Journal of Studies},
  year = {2020},
  volume = {10},
  pages = {1-15},
  doi = {10.1234/study.2020}
}

@article{doe2021,
  author = {Doe, Jane B.},
  title = {Another Study},
  journal = {Research Journal},
  year = {2021},
  volume = {5},
  pages = {20-30}
}`;

  const mockJatsXml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE article PUBLIC "-//NLM//DTD JATS (Z39.96) Journal Publishing DTD v1.3 20210610//EN" "https://jats.nlm.nih.gov/publishing/1.3/JATS-journalpublishing1-3.dtd">
<article article-type="research-article">
  <front>
    <journal-meta>
      <journal-title-group>
        <journal-title>Test Journal</journal-title>
      </journal-title-group>
    </journal-meta>
    <article-meta>
      <title-group>
        <article-title>Test Article Title</article-title>
      </title-group>
      <contrib-group>
        <contrib contrib-type="author">
          <name><surname>Smith</surname><given-names>John</given-names></name>
        </contrib>
      </contrib-group>
      <pub-date pub-type="epub">
        <year>2024</year>
      </pub-date>
      <permissions>
        <license>
          <license-p>CC-BY-4.0</license-p>
        </license>
      </permissions>
    </article-meta>
  </front>
  <body>
    <p>Article content here</p>
  </body>
</article>`;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new JatsService();
    getJournalSettings.mockResolvedValue(mockSettings);
    fs.readFileSync.mockImplementation((path: string) => {
      if (path.includes('references.bib')) {
        return mockBibliography;
      }
      if (path.includes('article.md') || path.includes('manuscript-123')) {
        return mockMarkdownContent;
      }
      throw new Error(`File not found: ${path}`);
    });
    fs.existsSync.mockReturnValue(true);
  });

  describe('generateJatsXml', () => {
    beforeEach(() => {
      prisma.manuscripts.findUnique.mockResolvedValue(mockManuscript);
      axios.post.mockResolvedValue({ data: mockJatsXml });
    });

    it('should generate valid JATS XML for published manuscript', async () => {
      const result = await service.generateJatsXml('manuscript-123');

      expect(result.success).toBe(true);
      expect(result.xml).toBeDefined();
      expect(result.xml).toContain('<?xml');
      expect(result.xml).toContain('<!DOCTYPE');
    });

    it('should call Pandoc service with correct parameters', async () => {
      await service.generateJatsXml('manuscript-123');

      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('/convert'),
        expect.objectContaining({
          markdown: mockMarkdownContent,
          outputFormat: 'jats',
          bibliography: mockBibliography
        }),
        expect.any(Object)
      );
    });

    it('should include metadata in Pandoc request', async () => {
      await service.generateJatsXml('manuscript-123');

      const callArgs = axios.post.mock.calls[0][1];
      expect(callArgs.metadata).toBeDefined();
      expect(callArgs.metadata.title).toBe('Test Article Title');
      expect(callArgs.metadata.abstract).toBe('This is a test abstract for the article.');
      expect(callArgs.metadata.doi).toBe('10.12345/2024.test123');
    });

    it('should include author information in metadata', async () => {
      await service.generateJatsXml('manuscript-123');

      const callArgs = axios.post.mock.calls[0][1];
      expect(callArgs.metadata.author).toBeDefined();
      expect(callArgs.metadata.author.length).toBe(2);
      expect(callArgs.metadata.author[0].name.surname).toBe('Smith');
      expect(callArgs.metadata.author[0].name['given-names']).toBe('John');
    });

    it('should include ORCID when available', async () => {
      await service.generateJatsXml('manuscript-123');

      const callArgs = axios.post.mock.calls[0][1];
      expect(callArgs.metadata.author[0].orcid).toBe('https://orcid.org/0000-0001-2345-6789');
      expect(callArgs.metadata.author[1].orcid).toBeUndefined();
    });

    it('should include funding information', async () => {
      await service.generateJatsXml('manuscript-123');

      const callArgs = axios.post.mock.calls[0][1];
      expect(callArgs.metadata.funding).toBeDefined();
      expect(callArgs.metadata.funding.length).toBe(1);
      expect(callArgs.metadata.funding[0].funder.name).toBe('National Science Foundation');
    });

    it('should throw error for non-published manuscripts', async () => {
      prisma.manuscripts.findUnique.mockResolvedValue({
        ...mockManuscript,
        status: 'SUBMITTED'
      });

      const result = await service.generateJatsXml('manuscript-123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Only published manuscripts');
    });

    it('should throw error for non-existent manuscript', async () => {
      prisma.manuscripts.findUnique.mockResolvedValue(null);

      const result = await service.generateJatsXml('nonexistent');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should throw error when no source file exists', async () => {
      prisma.manuscripts.findUnique.mockResolvedValue({
        ...mockManuscript,
        manuscript_files: []
      });

      const result = await service.generateJatsXml('manuscript-123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('No source file');
    });

    it('should handle Pandoc service errors', async () => {
      axios.post.mockRejectedValue({
        response: { data: { error: 'Pandoc conversion failed' } }
      });

      const result = await service.generateJatsXml('manuscript-123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Pandoc conversion failed');
    });
  });

  describe('validateForPmc', () => {
    it('should pass valid JATS XML', () => {
      const result = service.validateForPmc(mockJatsXml);

      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('should report missing required elements', () => {
      const incompleteXml = `<?xml version="1.0"?>
<article>
  <front>
    <article-meta>
      <title-group>
        <article-title>Test</article-title>
      </title-group>
    </article-meta>
  </front>
</article>`;

      const result = service.validateForPmc(incompleteXml);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'MISSING_JOURNAL_META')).toBe(true);
    });

    it('should warn about missing recommended elements', () => {
      const xmlWithoutAbstract = mockJatsXml.replace('<abstract>', '').replace('</abstract>', '');
      const result = service.validateForPmc(xmlWithoutAbstract);

      expect(result.warnings.some(w => w.code === 'MISSING_ABSTRACT')).toBe(true);
    });
  });

  describe('jatsService singleton', () => {
    it('should export a singleton instance', () => {
      expect(jatsService).toBeInstanceOf(JatsService);
    });
  });
});

describe('PMC Validator', () => {
  describe('validateJatsForPmc', () => {
    const validJatsXml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE article PUBLIC "-//NLM//DTD JATS (Z39.96) Journal Publishing DTD v1.3 20210610//EN" "https://jats.nlm.nih.gov/publishing/1.3/JATS-journalpublishing1-3.dtd">
<article article-type="research-article">
  <front>
    <journal-meta>
      <journal-title-group>
        <journal-title>Test Journal</journal-title>
      </journal-title-group>
      <issn pub-type="epub">1234-5678</issn>
      <publisher>
        <publisher-name>Test Publisher</publisher-name>
      </publisher>
    </journal-meta>
    <article-meta>
      <article-id pub-id-type="doi">10.12345/test</article-id>
      <title-group>
        <article-title>Test Article</article-title>
      </title-group>
      <contrib-group>
        <contrib contrib-type="author">
          <name><surname>Smith</surname><given-names>John</given-names></name>
          <contrib-id contrib-id-type="orcid">https://orcid.org/0000-0001-2345-6789</contrib-id>
          <aff>Test University</aff>
        </contrib>
      </contrib-group>
      <pub-date pub-type="epub">
        <year>2024</year>
      </pub-date>
      <abstract>
        <p>This is the abstract.</p>
      </abstract>
      <kwd-group>
        <kwd>science</kwd>
      </kwd-group>
      <permissions>
        <license license-type="open-access">
          <license-p>CC-BY</license-p>
        </license>
      </permissions>
      <funding-group>
        <funding-statement>Funded by NSF</funding-statement>
      </funding-group>
    </article-meta>
  </front>
  <body>
    <p>Content</p>
  </body>
</article>`;

    it('should validate complete JATS XML as valid', () => {
      const result = validateJatsForPmc(validJatsXml);

      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('should report errors for empty XML', () => {
      const result = validateJatsForPmc('');

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'EMPTY_DOCUMENT')).toBe(true);
    });

    it('should report missing article element', () => {
      const result = validateJatsForPmc('<doc>No article element</doc>');

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'MISSING_ARTICLE')).toBe(true);
    });

    it('should report missing journal-meta', () => {
      const xmlWithoutJournalMeta = `<article><front><article-meta></article-meta></front></article>`;
      const result = validateJatsForPmc(xmlWithoutJournalMeta);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'MISSING_JOURNAL_META')).toBe(true);
    });

    it('should report missing article-title', () => {
      const xmlWithoutTitle = `<article><front><journal-meta></journal-meta><article-meta></article-meta></front></article>`;
      const result = validateJatsForPmc(xmlWithoutTitle);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'MISSING_ARTICLE_TITLE')).toBe(true);
    });

    it('should warn about missing DOI', () => {
      const xmlWithoutDoi = validJatsXml.replace('<article-id pub-id-type="doi">10.12345/test</article-id>', '');
      const result = validateJatsForPmc(xmlWithoutDoi);

      expect(result.warnings.some(w => w.code === 'MISSING_DOI')).toBe(true);
    });

    it('should warn about missing abstract', () => {
      const xmlWithoutAbstract = validJatsXml.replace(/<abstract>[\s\S]*?<\/abstract>/, '');
      const result = validateJatsForPmc(xmlWithoutAbstract);

      expect(result.warnings.some(w => w.code === 'MISSING_ABSTRACT')).toBe(true);
    });

    it('should warn about missing ORCID', () => {
      const xmlWithoutOrcid = validJatsXml.replace(/<contrib-id[^>]*>[\s\S]*?<\/contrib-id>/, '');
      const result = validateJatsForPmc(xmlWithoutOrcid);

      expect(result.warnings.some(w => w.code === 'MISSING_ORCID')).toBe(true);
    });

    it('should warn about missing affiliations', () => {
      const xmlWithoutAff = validJatsXml.replace(/<aff>[^<]*<\/aff>/, '');
      const result = validateJatsForPmc(xmlWithoutAff);

      expect(result.warnings.some(w => w.code === 'MISSING_AFFILIATIONS')).toBe(true);
    });

    it('should warn about missing keywords', () => {
      const xmlWithoutKeywords = validJatsXml.replace(/<kwd-group>[\s\S]*?<\/kwd-group>/, '');
      const result = validateJatsForPmc(xmlWithoutKeywords);

      expect(result.warnings.some(w => w.code === 'MISSING_KEYWORDS')).toBe(true);
    });
  });
});
