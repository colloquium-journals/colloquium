import { referenceBot } from '../index';

describe('Help Command Integration', () => {
  it('should not have a help command initially', () => {
    expect(referenceBot.commands).toHaveLength(1);
    expect(referenceBot.commands.find(cmd => cmd.name === 'help')).toBeUndefined();
  });

  it('should have proper help metadata structure', () => {
    expect(referenceBot.help).toBeDefined();
    expect(referenceBot.help!.overview).toContain('references');
    expect(referenceBot.help!.quickStart).toContain('@reference-bot');
    expect(referenceBot.help!.examples).toContain('@reference-bot check-doi');
    expect(referenceBot.customHelpSections).toBeDefined();
    expect(referenceBot.customHelpSections!.length).toBe(3);
  });

  it('should have help sections with correct positions', () => {
    const beforeSections = referenceBot.customHelpSections!.filter(s => s.position === 'before');
    const afterSections = referenceBot.customHelpSections!.filter(s => s.position === 'after');
    
    expect(beforeSections).toHaveLength(2);
    expect(afterSections).toHaveLength(1);
    
    expect(beforeSections[0].title).toContain('What I Check');
    expect(beforeSections[1].title).toContain('Common Issues');
    expect(afterSections[0].title).toContain('Tips for Better References');
  });

  it('should have rich command documentation for help generation', () => {
    const checkDoiCommand = referenceBot.commands.find(cmd => cmd.name === 'check-doi');
    
    expect(checkDoiCommand!.help).toBeDefined();
    expect(checkDoiCommand!.help!.length).toBeGreaterThan(100); // Rich help content
    expect(checkDoiCommand!.usage).toContain('@reference-bot check-doi');
    expect(checkDoiCommand!.examples).toHaveLength(3);
    expect(checkDoiCommand!.parameters).toHaveLength(2);
  });
});