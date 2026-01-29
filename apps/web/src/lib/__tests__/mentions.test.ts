import { parseMentions, parseContentWithMentions } from '../mentions';

describe('Mention Parsing', () => {
  it('should parse bot mentions correctly', () => {
    const content = '@bot-editorial please review this article';
    const mentions = parseMentions(content);

    expect(mentions).toHaveLength(1);
    expect(mentions[0]).toEqual({
      id: 'bot-editorial',
      name: '@bot-editorial',
      startIndex: 0,
      endIndex: 14,
      isBot: true
    });
  });

  it('should parse user mentions correctly', () => {
    const content = 'Hey @john-smith, can you take a look?';
    const mentions = parseMentions(content);

    expect(mentions).toHaveLength(1);
    expect(mentions[0]).toEqual({
      id: 'john-smith',
      name: '@john-smith',
      startIndex: 4,
      endIndex: 15,
      isBot: false
    });
  });

  it('should parse multiple mentions in one message', () => {
    const content = '@bot-editorial please review, and @john-smith please approve';
    const mentions = parseMentions(content);

    expect(mentions).toHaveLength(2);
    expect(mentions[0].name).toBe('@bot-editorial');
    expect(mentions[0].isBot).toBe(true);
    expect(mentions[1].name).toBe('@john-smith');
    expect(mentions[1].isBot).toBe(false);
  });

  it('should identify known bots', () => {
    const content = '@bot-editorial @bot-plagiarism-checker @bot-reference-check @bot-reviewer-checklist';
    const mentions = parseMentions(content);

    expect(mentions).toHaveLength(4);
    expect(mentions.every(m => m.isBot)).toBe(true);
  });

  it('should identify bot-like IDs by suffix', () => {
    const content = '@custom-bot does something';
    const mentions = parseMentions(content);

    expect(mentions).toHaveLength(1);
    expect(mentions[0].isBot).toBe(true);
  });

  it('should not identify regular usernames as bots', () => {
    const content = '@alice-researcher hello';
    const mentions = parseMentions(content);

    expect(mentions).toHaveLength(1);
    expect(mentions[0].isBot).toBe(false);
  });

  it('should handle mentions followed by punctuation', () => {
    const content = 'Thanks @john-smith! Also @jane-doe.';
    const mentions = parseMentions(content);

    expect(mentions).toHaveLength(2);
    expect(mentions[0].id).toBe('john-smith');
    expect(mentions[1].id).toBe('jane-doe');
  });

  it('should handle mentions at end of message', () => {
    const content = 'Please check with @bob-scientist';
    const mentions = parseMentions(content);

    expect(mentions).toHaveLength(1);
    expect(mentions[0].id).toBe('bob-scientist');
  });

  it('should reject mentions that are too short', () => {
    const content = '@ab is too short';
    const mentions = parseMentions(content);

    expect(mentions).toHaveLength(0);
  });

  it('should reject mentions starting with a number', () => {
    const content = '@123user is invalid';
    const mentions = parseMentions(content);

    expect(mentions).toHaveLength(0);
  });

  it('should reject mentions with uppercase letters', () => {
    const content = '@John-Smith is not valid in new format';
    const mentions = parseMentions(content);

    expect(mentions).toHaveLength(0);
  });

  it('should split content into chunks correctly', () => {
    const content = 'Hello @bot-editorial, please review this for @john-smith';
    const chunks = parseContentWithMentions(content);

    expect(chunks).toHaveLength(4);
    expect(chunks[0]).toEqual({ type: 'text', content: 'Hello ' });
    expect(chunks[1]).toEqual({
      type: 'mention',
      content: '@bot-editorial',
      mention: expect.objectContaining({ name: '@bot-editorial', isBot: true })
    });
    expect(chunks[2]).toEqual({ type: 'text', content: ', please review this for ' });
    expect(chunks[3]).toEqual({
      type: 'mention',
      content: '@john-smith',
      mention: expect.objectContaining({ name: '@john-smith', isBot: false })
    });
  });

  it('should handle content with no mentions', () => {
    const content = 'This is a regular message with no mentions';
    const chunks = parseContentWithMentions(content);

    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toEqual({ type: 'text', content });
  });

  it('should not parse email addresses as mentions', () => {
    const content = 'Contact support at editorial-bot-admin@example.com';
    const mentions = parseMentions(content);

    expect(mentions).toHaveLength(0);
  });
});
