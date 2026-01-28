// Test bot plugin loading to debug the help issue
const path = require('path');

console.log('=== TESTING PLUGIN LOADING ===');

// Test editorial bot plugin loading
try {
  console.log('\n1. Loading editorial bot plugin...');
  const editorialPlugin = require('./packages/bot-editorial/plugin.js');
  console.log('Editorial plugin loaded:', {
    manifestBotId: editorialPlugin.manifest.colloquium.botId,
    botId: editorialPlugin.bot.id,
    botCommands: editorialPlugin.bot.commands.map(c => c.name)
  });
} catch (error) {
  console.error('Failed to load editorial bot plugin:', error.message);
}

// Test reviewer checklist bot plugin loading
try {
  console.log('\n2. Loading reviewer checklist bot plugin...');
  const reviewerPlugin = require('./packages/bot-reviewer-checklist/plugin.js');
  console.log('Reviewer plugin loaded:', {
    manifestBotId: reviewerPlugin.manifest.colloquium.botId,
    botId: reviewerPlugin.bot.id,
    botCommands: reviewerPlugin.bot.commands.map(c => c.name)
  });
} catch (error) {
  console.error('Failed to load reviewer checklist bot plugin:', error.message);
}

// Test command parser with loaded plugins
try {
  console.log('\n3. Testing command parser with plugins...');
  const { CommandParser } = require('./packages/bots/dist/framework/commands.js');
  const parser = new CommandParser();
  
  const editorialPlugin = require('./packages/bot-editorial/plugin.js');
  const reviewerPlugin = require('./packages/bot-reviewer-checklist/plugin.js');
  
  console.log('Registering bots...');
  parser.registerBot(editorialPlugin.bot);
  parser.registerBot(reviewerPlugin.bot);
  
  console.log('Registered bots:', parser.getAllBots().map(b => b.id));
  
  // Test parsing help commands
  const editorialHelp = parser.parseMessage('@bot-editorial help');
  const reviewerHelp = parser.parseMessage('@bot-reviewer-checklist help');
  
  console.log('Editorial help parse result:', editorialHelp);
  console.log('Reviewer help parse result:', reviewerHelp);
  
} catch (error) {
  console.error('Failed to test command parser:', error.message);
  console.error(error.stack);
}