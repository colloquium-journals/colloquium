import { referenceCheckBot } from '../index';

describe('Help Command Integration', () => {
  it('should not have a help command initially', () => {
    expect(referenceCheckBot.commands).toHaveLength(1);
    expect(referenceCheckBot.commands.find(cmd => cmd.name === 'help')).toBeUndefined();
  });

  it('should have proper help metadata structure', () => {
    expect(referenceCheckBot.help).toBeDefined();
    expect(referenceCheckBot.help!.overview).toContain('references');
    expect(referenceCheckBot.help!.quickStart).toContain('@bot-reference-check');
    expect(referenceCheckBot.help!.examples).toContain('@bot-reference-check check-doi');
    expect(referenceCheckBot.customHelpSections).toBeDefined();
    expect(referenceCheckBot.customHelpSections!.length).toBe(3);
  });

  it('should have help sections with correct positions', () => {
    const beforeSections = referenceCheckBot.customHelpSections!.filter(s => s.position === 'before');
    const afterSections = referenceCheckBot.customHelpSections!.filter(s => s.position === 'after');
    
    expect(beforeSections).toHaveLength(2);
    expect(afterSections).toHaveLength(1);
    
    expect(beforeSections[0].title).toContain('What I Check');
    expect(beforeSections[1].title).toContain('Common Issues');
    expect(afterSections[0].title).toContain('Tips for Better References');
  });

  it('should have rich command documentation for help generation', () => {
    const checkDoiCommand = referenceCheckBot.commands.find(cmd => cmd.name === 'check-doi');
    
    expect(checkDoiCommand!.help).toBeDefined();
    expect(checkDoiCommand!.help!.length).toBeGreaterThan(100); // Rich help content
    expect(checkDoiCommand!.usage).toContain('@bot-reference-check check-doi');
    expect(checkDoiCommand!.examples).toHaveLength(3);
    expect(checkDoiCommand!.parameters).toHaveLength(2);
  });
});