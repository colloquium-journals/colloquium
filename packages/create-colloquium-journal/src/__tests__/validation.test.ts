import { validateJournalName, validateSlug, validateEmail, validateDomain } from '../validation';

describe('Validation Functions', () => {
  describe('validateJournalName', () => {
    test('should accept valid journal names', () => {
      expect(validateJournalName('Test Journal')).toBe(true);
      expect(validateJournalName('Nature Reviews AI')).toBe(true);
      expect(validateJournalName('Journal of Computer Science')).toBe(true);
    });

    test('should reject empty names', () => {
      expect(validateJournalName('')).toBe('Journal name is required');
      expect(validateJournalName('   ')).toBe('Journal name is required');
    });

    test('should reject names that are too short', () => {
      expect(validateJournalName('AI')).toBe('Journal name must be at least 3 characters long');
    });

    test('should reject names that are too long', () => {
      const longName = 'a'.repeat(101);
      expect(validateJournalName(longName)).toBe('Journal name must be less than 100 characters');
    });
  });

  describe('validateSlug', () => {
    test('should accept valid slugs', () => {
      expect(validateSlug('test-journal')).toBe(true);
      expect(validateSlug('nature-reviews-ai')).toBe(true);
      expect(validateSlug('journal123')).toBe(true);
    });

    test('should reject invalid characters', () => {
      expect(validateSlug('test_journal')).toBe('Journal slug must be lowercase alphanumeric with hyphens only');
      expect(validateSlug('Test-Journal')).toBe('Journal slug must be lowercase alphanumeric with hyphens only');
      expect(validateSlug('test journal')).toBe('Journal slug must be lowercase alphanumeric with hyphens only');
    });

    test('should reject slugs starting or ending with hyphens', () => {
      expect(validateSlug('-test-journal')).toBe('Journal slug cannot start or end with hyphens');
      expect(validateSlug('test-journal-')).toBe('Journal slug cannot start or end with hyphens');
    });

    test('should reject consecutive hyphens', () => {
      expect(validateSlug('test--journal')).toBe('Journal slug cannot contain consecutive hyphens');
    });

    test('should reject reserved slugs', () => {
      expect(validateSlug('api')).toBe('Journal slug "api" is reserved and cannot be used');
      expect(validateSlug('admin')).toBe('Journal slug "admin" is reserved and cannot be used');
      expect(validateSlug('www')).toBe('Journal slug "www" is reserved and cannot be used');
    });
  });

  describe('validateEmail', () => {
    test('should accept valid emails', () => {
      expect(validateEmail('test@example.com')).toBe(true);
      expect(validateEmail('admin@university.edu')).toBe(true);
      expect(validateEmail('user.name+tag@domain.co.uk')).toBe(true);
    });

    test('should reject invalid emails', () => {
      expect(validateEmail('invalid-email')).toBe('Invalid email format');
      expect(validateEmail('test@')).toBe('Invalid email format');
      expect(validateEmail('@domain.com')).toBe('Invalid email format');
      expect(validateEmail('test@domain')).toBe('Invalid email format');
    });

    test('should reject empty emails', () => {
      expect(validateEmail('')).toBe('Email is required');
      expect(validateEmail('   ')).toBe('Email is required');
    });
  });

  describe('validateDomain', () => {
    test('should accept valid domains', () => {
      expect(validateDomain('example.com')).toBe(true);
      expect(validateDomain('journal.university.edu')).toBe(true);
      expect(validateDomain('test.co.uk')).toBe(true);
    });

    test('should accept empty domains (optional)', () => {
      expect(validateDomain('')).toBe(true);
      expect(validateDomain('   ')).toBe(true);
    });

    test('should reject invalid domains', () => {
      expect(validateDomain('invalid-domain')).toBe('Invalid domain format');
      expect(validateDomain('domain.')).toBe('Invalid domain format');
      expect(validateDomain('.domain.com')).toBe('Invalid domain format');
    });

    test('should handle domains with protocol', () => {
      expect(validateDomain('https://example.com')).toBe(true);
      expect(validateDomain('http://journal.university.edu')).toBe(true);
    });

    test('should reject domains that are too long', () => {
      const longDomain = 'a'.repeat(250) + '.com';
      expect(validateDomain(longDomain)).toBe('Domain name too long');
    });
  });
});