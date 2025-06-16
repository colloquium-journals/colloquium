import { parseMentions, parseContentWithMentions } from '../mentions';

describe('Mention Parsing', () => {
  it('should parse bot mentions correctly', () => {
    const content = '@editorial-bot please review this manuscript';
    const mentions = parseMentions(content);
    
    expect(mentions).toHaveLength(1);
    expect(mentions[0]).toEqual({
      id: 'editorial-bot',
      name: '@editorial-bot',
      startIndex: 0,
      endIndex: 14,
      isBot: true
    });
  });

  it('should parse display name mentions correctly', () => {
    const content = 'Thanks @Editorial Bot for the feedback';
    const mentions = parseMentions(content);
    
    expect(mentions).toHaveLength(1);
    expect(mentions[0]).toEqual({
      id: 'editorial-bot',
      name: '@Editorial Bot',
      startIndex: 7,
      endIndex: 21,
      isBot: true
    });
  });

  it('should parse user mentions correctly', () => {
    const content = 'Hey @John Smith, can you take a look?';
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

  it('should parse multiple mentions in one message', () => {
    const content = '@editorial-bot please review, and @John Smith please approve';
    const mentions = parseMentions(content);
    
    expect(mentions).toHaveLength(2);
    expect(mentions[0].name).toBe('@editorial-bot');
    expect(mentions[1].name).toBe('@John Smith');
  });

  it('should split content into chunks correctly', () => {
    const content = 'Hello @editorial-bot, please review this for @John Smith';
    const chunks = parseContentWithMentions(content);
    
    expect(chunks).toHaveLength(4); // No trailing empty text chunk
    expect(chunks[0]).toEqual({ type: 'text', content: 'Hello ' });
    expect(chunks[1]).toEqual({
      type: 'mention',
      content: '@editorial-bot',
      mention: expect.objectContaining({ name: '@editorial-bot' })
    });
    expect(chunks[2]).toEqual({ type: 'text', content: ', please review this for ' });
    expect(chunks[3]).toEqual({
      type: 'mention',
      content: '@John Smith',
      mention: expect.objectContaining({ name: '@John Smith' })
    });
  });

  it('should handle content with no mentions', () => {
    const content = 'This is a regular message with no mentions';
    const chunks = parseContentWithMentions(content);
    
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toEqual({ type: 'text', content });
  });

  it('should not parse partial matches as mentions', () => {
    const content = 'Contact support at editorial-bot-admin@example.com';
    const mentions = parseMentions(content);
    
    expect(mentions).toHaveLength(0);
  });
});