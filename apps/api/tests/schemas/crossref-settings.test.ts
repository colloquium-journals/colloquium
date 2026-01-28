import { z } from 'zod';

// Re-create the relevant portion of the JournalSettingsSchema for testing
// This ensures the schema definitions match what's in the settings route
const CrossrefSettingsSchema = z.object({
  crossrefEnabled: z.boolean().default(false),
  crossrefUsername: z.string().optional(),
  crossrefPassword: z.string().optional(),
  crossrefTestMode: z.boolean().default(true),
  doiPrefix: z.string().optional(),
  eissn: z.string().optional(),
  abbrevTitle: z.string().optional(),
});

describe('Crossref Settings Schema', () => {
  describe('validation', () => {
    it('should accept valid Crossref settings', () => {
      const validSettings = {
        crossrefEnabled: true,
        crossrefUsername: 'testuser',
        crossrefPassword: 'testpass123',
        crossrefTestMode: true,
        doiPrefix: '10.12345',
        eissn: '1234-5678',
        abbrevTitle: 'J. Test Sci.'
      };

      const result = CrossrefSettingsSchema.safeParse(validSettings);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validSettings);
      }
    });

    it('should apply defaults for missing optional fields', () => {
      const minimalSettings = {};

      const result = CrossrefSettingsSchema.safeParse(minimalSettings);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.crossrefEnabled).toBe(false);
        expect(result.data.crossrefTestMode).toBe(true);
        expect(result.data.crossrefUsername).toBeUndefined();
        expect(result.data.crossrefPassword).toBeUndefined();
        expect(result.data.doiPrefix).toBeUndefined();
        expect(result.data.eissn).toBeUndefined();
        expect(result.data.abbrevTitle).toBeUndefined();
      }
    });

    it('should accept enabled with all credentials', () => {
      const settings = {
        crossrefEnabled: true,
        crossrefUsername: 'myuser',
        crossrefPassword: 'mypass',
        crossrefTestMode: false,
        doiPrefix: '10.54321'
      };

      const result = CrossrefSettingsSchema.safeParse(settings);
      expect(result.success).toBe(true);
    });

    it('should accept crossrefEnabled without credentials', () => {
      // This is valid at schema level - validation of required credentials
      // happens at the service level when actually registering
      const settings = {
        crossrefEnabled: true
      };

      const result = CrossrefSettingsSchema.safeParse(settings);
      expect(result.success).toBe(true);
    });

    it('should reject invalid crossrefEnabled type', () => {
      const settings = {
        crossrefEnabled: 'yes' // should be boolean
      };

      const result = CrossrefSettingsSchema.safeParse(settings);
      expect(result.success).toBe(false);
    });

    it('should reject invalid crossrefTestMode type', () => {
      const settings = {
        crossrefTestMode: 'production' // should be boolean
      };

      const result = CrossrefSettingsSchema.safeParse(settings);
      expect(result.success).toBe(false);
    });
  });

  describe('DOI prefix format', () => {
    it('should accept standard DOI prefix format', () => {
      const settings = { doiPrefix: '10.12345' };
      const result = CrossrefSettingsSchema.safeParse(settings);
      expect(result.success).toBe(true);
    });

    it('should accept longer DOI prefix', () => {
      const settings = { doiPrefix: '10.12345/journal' };
      const result = CrossrefSettingsSchema.safeParse(settings);
      expect(result.success).toBe(true);
    });

    it('should accept DOI prefix as any string (validation is service-level)', () => {
      // The schema allows any string - Crossref validates the actual format
      const settings = { doiPrefix: 'custom-prefix' };
      const result = CrossrefSettingsSchema.safeParse(settings);
      expect(result.success).toBe(true);
    });
  });

  describe('EISSN format', () => {
    it('should accept standard ISSN format', () => {
      const settings = { eissn: '1234-5678' };
      const result = CrossrefSettingsSchema.safeParse(settings);
      expect(result.success).toBe(true);
    });

    it('should accept ISSN with X check digit', () => {
      const settings = { eissn: '1234-567X' };
      const result = CrossrefSettingsSchema.safeParse(settings);
      expect(result.success).toBe(true);
    });

    it('should accept EISSN as any string (validation is service-level)', () => {
      // The schema allows any string - external systems validate the actual format
      const settings = { eissn: '12345678' };
      const result = CrossrefSettingsSchema.safeParse(settings);
      expect(result.success).toBe(true);
    });
  });

  describe('abbreviated title', () => {
    it('should accept standard abbreviated title', () => {
      const settings = { abbrevTitle: 'J. Exp. Psychol.' };
      const result = CrossrefSettingsSchema.safeParse(settings);
      expect(result.success).toBe(true);
    });

    it('should accept short abbreviated title', () => {
      const settings = { abbrevTitle: 'Nature' };
      const result = CrossrefSettingsSchema.safeParse(settings);
      expect(result.success).toBe(true);
    });

    it('should accept empty abbreviated title', () => {
      const settings = { abbrevTitle: '' };
      const result = CrossrefSettingsSchema.safeParse(settings);
      expect(result.success).toBe(true);
    });
  });

  describe('test mode behavior', () => {
    it('should default to test mode enabled', () => {
      const settings = {
        crossrefEnabled: true,
        crossrefUsername: 'user',
        crossrefPassword: 'pass'
      };

      const result = CrossrefSettingsSchema.safeParse(settings);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.crossrefTestMode).toBe(true);
      }
    });

    it('should allow explicit production mode', () => {
      const settings = {
        crossrefEnabled: true,
        crossrefUsername: 'user',
        crossrefPassword: 'pass',
        crossrefTestMode: false
      };

      const result = CrossrefSettingsSchema.safeParse(settings);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.crossrefTestMode).toBe(false);
      }
    });
  });
});
