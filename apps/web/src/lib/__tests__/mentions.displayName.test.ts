import { parseMentions, parseContentWithMentions } from '../mentions';

describe('Display Name Mentions', () => {
  describe('parseMentions', () => {
    it('should parse simple display name mentions', () => {
      const content = 'Hey @John Smith, could you review this?';
      const mentions = parseMentions(content);
      
      expect(mentions).toHaveLength(1);
      expect(mentions[0]).toEqual({
        id: 'john-smith',
        name: '@John Smith',
        startIndex: 4,
        endIndex: 15,
        isBot: false
      });
    });

    it('should parse disambiguated display name mentions', () => {
      const content = 'Hey @John Smith (john@email.com), could you review this?';
      const mentions = parseMentions(content);
      
      expect(mentions).toHaveLength(1);
      expect(mentions[0]).toEqual({
        id: 'john-smith',
        name: '@John Smith (john@email.com)',
        startIndex: 4,
        endIndex: 32,
        isBot: false
      });
    });

    it('should handle multiple mentions with and without disambiguation', () => {
      const content = '@John Smith please check with @John Smith (john2@email.com) and @editorial-bot';
      const mentions = parseMentions(content);
      
      expect(mentions).toHaveLength(3);
      
      // First John Smith (no disambiguation)
      expect(mentions[0]).toEqual({
        id: 'john-smith',
        name: '@John Smith',
        startIndex: 0,
        endIndex: 11,
        isBot: false
      });
      
      // Second John Smith (with disambiguation)
      expect(mentions[1]).toEqual({
        id: 'john-smith',
        name: '@John Smith (john2@email.com)',
        startIndex: 30,
        endIndex: 59,
        isBot: false
      });
      
      // Editorial bot
      expect(mentions[2]).toEqual({
        id: 'editorial-bot',
        name: '@editorial-bot',
        startIndex: 64,
        endIndex: 78,
        isBot: true
      });
    });

    it('should preserve bot mentions unchanged', () => {
      const content = 'Please ask @editorial-bot and @plagiarism-checker to review';
      const mentions = parseMentions(content);
      
      expect(mentions).toHaveLength(2);
      expect(mentions[0]).toEqual({
        id: 'editorial-bot',
        name: '@editorial-bot',
        startIndex: 11,
        endIndex: 25,
        isBot: true
      });
      expect(mentions[1]).toEqual({
        id: 'plagiarism-checker',
        name: '@plagiarism-checker',
        startIndex: 30,
        endIndex: 49,
        isBot: true
      });
    });

    it('should handle edge cases with punctuation', () => {
      const content = 'Thanks @John Smith (john@email.com)! Also @Jane Doe.';
      const mentions = parseMentions(content);
      
      expect(mentions).toHaveLength(2);
      expect(mentions[0]).toEqual({
        id: 'john-smith',
        name: '@John Smith (john@email.com)',
        startIndex: 7,
        endIndex: 35,
        isBot: false
      });
      expect(mentions[1]).toEqual({
        id: 'jane-doe',
        name: '@Jane Doe',
        startIndex: 42,
        endIndex: 51,
        isBot: false
      });
    });
  });

  describe('parseContentWithMentions', () => {
    it('should correctly chunk content with disambiguated mentions', () => {
      const content = 'Hey @John Smith (john@email.com), please review this.';
      const chunks = parseContentWithMentions(content);
      
      expect(chunks).toHaveLength(3);
      expect(chunks[0]).toEqual({
        type: 'text',
        content: 'Hey '
      });
      expect(chunks[1]).toEqual({
        type: 'mention',
        content: '@John Smith (john@email.com)',
        mention: {
          id: 'john-smith',
          name: '@John Smith (john@email.com)',
          startIndex: 4,
          endIndex: 32,
          isBot: false
        }
      });
      expect(chunks[2]).toEqual({
        type: 'text',
        content: ', please review this.'
      });
    });
  });
});