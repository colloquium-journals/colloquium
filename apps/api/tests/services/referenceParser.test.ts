import { parseBibTeX, isValidBibTeX, countBibTeXEntries } from '../../src/services/referenceParser';

// Note: These tests use the actual citation-js library
// They may take longer to run due to the dynamic ESM import

describe('Reference Parser', () => {
  describe('parseBibTeX', () => {
    it('should parse @article entries', async () => {
      const bibtex = `@article{smith2020,
        author = {Smith, John A. and Doe, Jane B.},
        title = {A Study of Important Things},
        journal = {Journal of Important Studies},
        year = {2020},
        volume = {10},
        number = {2},
        pages = {100-115},
        doi = {10.1234/jis.2020.001}
      }`;

      const refs = await parseBibTeX(bibtex);

      expect(refs.length).toBe(1);
      expect(refs[0].id).toBe('smith2020');
      expect(refs[0].type).toBe('article');
      expect(refs[0].title).toBe('A Study of Important Things');
      expect(refs[0].journal).toBe('Journal of Important Studies');
      expect(refs[0].year).toBe(2020);
      expect(refs[0].volume).toBe('10');
      expect(refs[0].pages).toBe('100-115');
      expect(refs[0].doi).toBe('10.1234/jis.2020.001');
    });

    it('should parse @book entries', async () => {
      const bibtex = `@book{johnson2019,
        author = {Johnson, Robert},
        title = {The Complete Guide to Research},
        publisher = {Academic Press},
        year = {2019},
        address = {New York}
      }`;

      const refs = await parseBibTeX(bibtex);

      expect(refs.length).toBe(1);
      expect(refs[0].id).toBe('johnson2019');
      expect(refs[0].type).toBe('book');
      expect(refs[0].title).toBe('The Complete Guide to Research');
      expect(refs[0].publisher).toBe('Academic Press');
      expect(refs[0].year).toBe(2019);
    });

    it('should parse @inproceedings entries', async () => {
      const bibtex = `@inproceedings{chen2021,
        author = {Chen, Wei},
        title = {Novel Approaches to Machine Learning},
        booktitle = {Proceedings of ICML 2021},
        year = {2021},
        pages = {50-60},
        doi = {10.5555/icml.2021.005}
      }`;

      const refs = await parseBibTeX(bibtex);

      expect(refs.length).toBe(1);
      expect(refs[0].id).toBe('chen2021');
      expect(refs[0].type).toBe('inproceedings');
      expect(refs[0].title).toBe('Novel Approaches to Machine Learning');
      expect(refs[0].year).toBe(2021);
      expect(refs[0].doi).toBe('10.5555/icml.2021.005');
    });

    it('should handle entries with DOIs', async () => {
      const bibtex = `@article{test2020,
        author = {Test, Author},
        title = {Test Title},
        journal = {Test Journal},
        year = {2020},
        doi = {10.1000/test.doi}
      }`;

      const refs = await parseBibTeX(bibtex);

      expect(refs[0].doi).toBe('10.1000/test.doi');
    });

    it('should handle entries without DOIs', async () => {
      const bibtex = `@article{nodoi2020,
        author = {NoDoi, Author},
        title = {Article Without DOI},
        journal = {Some Journal},
        year = {2020}
      }`;

      const refs = await parseBibTeX(bibtex);

      expect(refs[0].doi).toBeUndefined();
    });

    it('should parse multiple authors', async () => {
      const bibtex = `@article{multiauthor2020,
        author = {First, Author and Second, Author and Third, Author},
        title = {Collaborative Work},
        journal = {Collaboration Journal},
        year = {2020}
      }`;

      const refs = await parseBibTeX(bibtex);

      expect(refs[0].authors).toBeDefined();
      expect(refs[0].authors!.length).toBe(3);
      expect(refs[0].authors![0].family).toBe('First');
      expect(refs[0].authors![1].family).toBe('Second');
      expect(refs[0].authors![2].family).toBe('Third');
    });

    it('should handle single author', async () => {
      const bibtex = `@article{single2020,
        author = {Solo, Author},
        title = {Solo Work},
        journal = {Independent Journal},
        year = {2020}
      }`;

      const refs = await parseBibTeX(bibtex);

      expect(refs[0].authors).toBeDefined();
      expect(refs[0].authors!.length).toBe(1);
      expect(refs[0].authors![0].family).toBe('Solo');
      expect(refs[0].authors![0].given).toBe('Author');
    });

    it('should parse multiple entries', async () => {
      const bibtex = `@article{first2020,
        author = {First, A.},
        title = {First Article},
        journal = {Journal A},
        year = {2020}
      }

      @article{second2021,
        author = {Second, B.},
        title = {Second Article},
        journal = {Journal B},
        year = {2021}
      }

      @book{third2019,
        author = {Third, C.},
        title = {A Book},
        publisher = {Publisher},
        year = {2019}
      }`;

      const refs = await parseBibTeX(bibtex);

      expect(refs.length).toBe(3);
      expect(refs[0].id).toBe('first2020');
      expect(refs[1].id).toBe('second2021');
      expect(refs[2].id).toBe('third2019');
    });

    it('should return empty array for empty content', async () => {
      const refs = await parseBibTeX('');
      expect(refs).toEqual([]);
    });

    it('should return empty array for whitespace-only content', async () => {
      const refs = await parseBibTeX('   \n\t\n   ');
      expect(refs).toEqual([]);
    });

    it('should handle URL field', async () => {
      const bibtex = `@misc{website2020,
        author = {Web, Author},
        title = {Online Resource},
        year = {2020},
        url = {https://example.com/resource},
        note = {Accessed: 2024-01-15}
      }`;

      const refs = await parseBibTeX(bibtex);

      expect(refs[0].url).toBe('https://example.com/resource');
    });

    it('should handle entries with issue/number field', async () => {
      const bibtex = `@article{issue2020,
        author = {Issue, Test},
        title = {Article with Issue},
        journal = {Test Journal},
        year = {2020},
        volume = {5},
        number = {3}
      }`;

      const refs = await parseBibTeX(bibtex);

      expect(refs[0].volume).toBe('5');
      expect(refs[0].issue).toBe('3');
    });
  });

  describe('isValidBibTeX', () => {
    it('should return true for valid BibTeX', () => {
      const valid = `@article{test, author = {Test}, title = {Test}, year = {2020}}`;
      expect(isValidBibTeX(valid)).toBe(true);
    });

    it('should return true for multiple entries', () => {
      const valid = `@article{a, title={A}} @book{b, title={B}}`;
      expect(isValidBibTeX(valid)).toBe(true);
    });

    it('should return false for empty string', () => {
      expect(isValidBibTeX('')).toBe(false);
    });

    it('should return false for whitespace only', () => {
      expect(isValidBibTeX('   \n\t   ')).toBe(false);
    });

    it('should return false for plain text', () => {
      expect(isValidBibTeX('This is just plain text without any BibTeX entries')).toBe(false);
    });
  });

  describe('countBibTeXEntries', () => {
    it('should count single entry', () => {
      const bibtex = `@article{test, author = {Test}, title = {Test}}`;
      expect(countBibTeXEntries(bibtex)).toBe(1);
    });

    it('should count multiple entries', () => {
      const bibtex = `@article{a, title={A}}
        @book{b, title={B}}
        @inproceedings{c, title={C}}
        @misc{d, title={D}}`;
      expect(countBibTeXEntries(bibtex)).toBe(4);
    });

    it('should return 0 for empty string', () => {
      expect(countBibTeXEntries('')).toBe(0);
    });

    it('should return 0 for text without entries', () => {
      expect(countBibTeXEntries('no entries here')).toBe(0);
    });

    it('should handle various entry types', () => {
      const bibtex = `
        @article{a, title={A}}
        @book{b, title={B}}
        @inbook{c, title={C}}
        @incollection{d, title={D}}
        @inproceedings{e, title={E}}
        @conference{f, title={F}}
        @phdthesis{g, title={G}}
        @mastersthesis{h, title={H}}
        @techreport{i, title={I}}
        @manual{j, title={J}}
        @misc{k, title={K}}
        @unpublished{l, title={L}}
      `;
      expect(countBibTeXEntries(bibtex)).toBe(12);
    });
  });
});
