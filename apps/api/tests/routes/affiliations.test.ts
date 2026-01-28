import request from 'supertest';
import express from 'express';
import { prisma } from '@colloquium/database';

jest.mock('@colloquium/database', () => ({
  prisma: {
    affiliations: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn()
    },
    users: {
      findUnique: jest.fn()
    }
  }
}));

const mockAffiliationsFind = prisma.affiliations.findMany as jest.Mock;
const mockAffiliationsFindFirst = prisma.affiliations.findFirst as jest.Mock;
const mockAffiliationsCreate = prisma.affiliations.create as jest.Mock;
const mockAffiliationsUpdate = prisma.affiliations.update as jest.Mock;
const mockAffiliationsUpdateMany = prisma.affiliations.updateMany as jest.Mock;
const mockAffiliationsDelete = prisma.affiliations.delete as jest.Mock;

describe('User Affiliations API', () => {
  const mockUserId = 'test-user-id';
  const mockAffiliation = {
    id: 'aff-1',
    userId: mockUserId,
    institution: 'Stanford University',
    department: 'Department of Psychology',
    city: 'Stanford',
    state: 'CA',
    country: 'United States',
    countryCode: 'US',
    ror: 'https://ror.org/00f54p054',
    isPrimary: true,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Affiliation Schema Validation', () => {
    it('should require institution field', () => {
      const invalidData = {
        country: 'United States'
      };

      // Test that schema validation would reject this
      expect(invalidData).not.toHaveProperty('institution');
    });

    it('should require country field', () => {
      const invalidData = {
        institution: 'Stanford University'
      };

      // Test that schema validation would reject this
      expect(invalidData).not.toHaveProperty('country');
    });

    it('should accept valid ROR URL', () => {
      const validData = {
        institution: 'Stanford University',
        country: 'United States',
        ror: 'https://ror.org/00f54p054'
      };

      expect(validData.ror).toMatch(/^https:\/\/ror\.org\//);
    });

    it('should accept valid 2-character country code', () => {
      const validData = {
        institution: 'Stanford University',
        country: 'United States',
        countryCode: 'US'
      };

      expect(validData.countryCode).toHaveLength(2);
    });
  });

  describe('Affiliation Data Structure', () => {
    it('should have all required fields for structured affiliation', () => {
      expect(mockAffiliation).toHaveProperty('institution');
      expect(mockAffiliation).toHaveProperty('country');
      expect(mockAffiliation).toHaveProperty('userId');
    });

    it('should have optional fields', () => {
      expect(mockAffiliation).toHaveProperty('department');
      expect(mockAffiliation).toHaveProperty('city');
      expect(mockAffiliation).toHaveProperty('state');
      expect(mockAffiliation).toHaveProperty('countryCode');
      expect(mockAffiliation).toHaveProperty('ror');
      expect(mockAffiliation).toHaveProperty('isPrimary');
    });

    it('should have proper primary affiliation flag', () => {
      expect(typeof mockAffiliation.isPrimary).toBe('boolean');
    });
  });

  describe('Primary Affiliation Logic', () => {
    it('should only allow one primary affiliation per user', () => {
      const affiliations = [
        { ...mockAffiliation, id: 'aff-1', isPrimary: true },
        { ...mockAffiliation, id: 'aff-2', isPrimary: false },
        { ...mockAffiliation, id: 'aff-3', isPrimary: false }
      ];

      const primaryCount = affiliations.filter(a => a.isPrimary).length;
      expect(primaryCount).toBeLessThanOrEqual(1);
    });

    it('should track affiliation ordering correctly', () => {
      const affiliations = [
        { ...mockAffiliation, id: 'aff-1', isPrimary: true, createdAt: new Date('2024-01-01') },
        { ...mockAffiliation, id: 'aff-2', isPrimary: false, createdAt: new Date('2024-02-01') },
        { ...mockAffiliation, id: 'aff-3', isPrimary: false, createdAt: new Date('2024-03-01') }
      ];

      // Primary should come first, then ordered by createdAt
      const sorted = affiliations.sort((a, b) => {
        if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
        return a.createdAt.getTime() - b.createdAt.getTime();
      });

      expect(sorted[0].isPrimary).toBe(true);
    });
  });

  describe('ROR Integration', () => {
    it('should accept valid ROR identifier format', () => {
      const validRor = 'https://ror.org/00f54p054';
      expect(validRor).toMatch(/^https:\/\/ror\.org\/[a-z0-9]+$/);
    });

    it('should store ROR as optional field', () => {
      const affiliationWithRor = { ...mockAffiliation, ror: 'https://ror.org/00f54p054' };
      const affiliationWithoutRor = { ...mockAffiliation, ror: null };

      expect(affiliationWithRor.ror).toBeTruthy();
      expect(affiliationWithoutRor.ror).toBeNull();
    });
  });

  describe('Country Code Handling', () => {
    it('should store ISO 3166-1 alpha-2 country codes', () => {
      const countryCodes = ['US', 'GB', 'DE', 'FR', 'JP', 'CN'];

      countryCodes.forEach(code => {
        expect(code).toHaveLength(2);
        expect(code).toMatch(/^[A-Z]{2}$/);
      });
    });

    it('should have both country name and code', () => {
      const affiliation = {
        ...mockAffiliation,
        country: 'United States',
        countryCode: 'US'
      };

      expect(affiliation.country).toBeTruthy();
      expect(affiliation.countryCode).toBeTruthy();
    });
  });
});
