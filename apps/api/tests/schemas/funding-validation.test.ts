import { z } from 'zod';

// Replicate the funding schema from the articles route
const fundingSchema = z.object({
  funderName: z.string().min(1, 'Funder name is required'),
  funderDoi: z.string().optional(),
  awardId: z.string().optional(),
  awardTitle: z.string().optional()
});

const fundingArraySchema = z.array(fundingSchema).default([]);

describe('Funding Validation Schema', () => {
  describe('fundingSchema', () => {
    it('should accept valid funding with all fields', () => {
      const validFunding = {
        funderName: 'National Science Foundation',
        funderDoi: '10.13039/100000001',
        awardId: 'BCS-1234567',
        awardTitle: 'Understanding Human Cognition'
      };

      const result = fundingSchema.safeParse(validFunding);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.funderName).toBe('National Science Foundation');
        expect(result.data.funderDoi).toBe('10.13039/100000001');
        expect(result.data.awardId).toBe('BCS-1234567');
        expect(result.data.awardTitle).toBe('Understanding Human Cognition');
      }
    });

    it('should accept funding with only funder name', () => {
      const minimalFunding = {
        funderName: 'European Research Council'
      };

      const result = fundingSchema.safeParse(minimalFunding);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.funderName).toBe('European Research Council');
        expect(result.data.funderDoi).toBeUndefined();
        expect(result.data.awardId).toBeUndefined();
        expect(result.data.awardTitle).toBeUndefined();
      }
    });

    it('should reject funding without funder name', () => {
      const invalidFunding = {
        funderDoi: '10.13039/100000001',
        awardId: 'BCS-1234567'
      };

      const result = fundingSchema.safeParse(invalidFunding);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some(i => i.path.includes('funderName'))).toBe(true);
      }
    });

    it('should reject funding with empty funder name', () => {
      const invalidFunding = {
        funderName: ''
      };

      const result = fundingSchema.safeParse(invalidFunding);
      expect(result.success).toBe(false);
    });

    it('should accept Crossref Funder Registry DOI format', () => {
      const fundingWithDoi = {
        funderName: 'National Institutes of Health',
        funderDoi: '10.13039/100000002'
      };

      const result = fundingSchema.safeParse(fundingWithDoi);
      expect(result.success).toBe(true);
    });

    it('should accept DOI as full URL', () => {
      const fundingWithUrlDoi = {
        funderName: 'Wellcome Trust',
        funderDoi: 'https://doi.org/10.13039/100004440'
      };

      const result = fundingSchema.safeParse(fundingWithUrlDoi);
      expect(result.success).toBe(true);
    });
  });

  describe('fundingArraySchema', () => {
    it('should accept empty array', () => {
      const result = fundingArraySchema.safeParse([]);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual([]);
      }
    });

    it('should default to empty array when undefined', () => {
      const result = fundingArraySchema.safeParse(undefined);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual([]);
      }
    });

    it('should accept array with multiple funding sources', () => {
      const multipleFunding = [
        {
          funderName: 'National Science Foundation',
          funderDoi: '10.13039/100000001',
          awardId: 'BCS-1234567'
        },
        {
          funderName: 'National Institutes of Health',
          funderDoi: '10.13039/100000002',
          awardId: 'R01-MH123456'
        },
        {
          funderName: 'Private Foundation',
          awardTitle: 'Research Excellence Award'
        }
      ];

      const result = fundingArraySchema.safeParse(multipleFunding);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.length).toBe(3);
      }
    });

    it('should reject array with invalid funding entry', () => {
      const invalidFunding = [
        {
          funderName: 'Valid Funder'
        },
        {
          funderDoi: '10.13039/100000001'
          // Missing required funderName
        }
      ];

      const result = fundingArraySchema.safeParse(invalidFunding);
      expect(result.success).toBe(false);
    });
  });

  describe('Common Funder Registry DOIs', () => {
    const commonFunders = [
      { name: 'National Science Foundation', doi: '10.13039/100000001' },
      { name: 'National Institutes of Health', doi: '10.13039/100000002' },
      { name: 'European Research Council', doi: '10.13039/501100000781' },
      { name: 'Wellcome Trust', doi: '10.13039/100004440' },
      { name: 'Howard Hughes Medical Institute', doi: '10.13039/100000011' },
      { name: 'Bill & Melinda Gates Foundation', doi: '10.13039/100000865' }
    ];

    it.each(commonFunders)('should accept %s funding data', (funder) => {
      const funding = {
        funderName: funder.name,
        funderDoi: funder.doi
      };

      const result = fundingSchema.safeParse(funding);
      expect(result.success).toBe(true);
    });
  });

  describe('Award ID Formats', () => {
    const awardFormats = [
      'BCS-1234567',           // NSF format
      'R01-MH123456',          // NIH format
      'ERC-2020-CoG-123456',   // ERC format
      '203964/Z/16/Z',         // Wellcome format
      'Grant #12345',          // Generic
      '2024-XYZ-001'           // Custom format
    ];

    it.each(awardFormats)('should accept award ID format: %s', (awardId) => {
      const funding = {
        funderName: 'Test Funder',
        awardId
      };

      const result = fundingSchema.safeParse(funding);
      expect(result.success).toBe(true);
    });
  });
});
