// Quick test to debug the bot help issue
const { CommandParser } = require('./packages/bots/dist/framework/commands.js');
const { editorialBot } = require('./packages/editorial-bot/dist/index.js');
const { reviewerChecklistBot } = require('./packages/reviewer-checklist-bot/dist/index.js');

const parser = new CommandParser();

console.log('=== EDITORIAL BOT ===');
console.log('Original bot commands:', editorialBot.commands.map(c => c.name));

parser.registerBot(editorialBot);
const registeredEditorialBot = parser.getAllBots().find(b => b.id === 'editorial-bot');
console.log('After registration commands:', registeredEditorialBot?.commands.map(c => c.name));

console.log('\n=== REVIEWER CHECKLIST BOT ===');
console.log('Original bot commands:', reviewerChecklistBot.commands.map(c => c.name));

parser.registerBot(reviewerChecklistBot);
const registeredReviewerBot = parser.getAllBots().find(b => b.id === 'reviewer-checklist');
console.log('After registration commands:', registeredReviewerBot?.commands.map(c => c.name));

console.log('\n=== TESTING MESSAGE PARSING ===');
const editorialHelpCommands = parser.parseMessage('@editorial-bot help');
console.log('Editorial bot help commands:', editorialHelpCommands);

const reviewerHelpCommands = parser.parseMessage('@reviewer-checklist help');
console.log('Reviewer checklist help commands:', reviewerHelpCommands);

console.log('\n=== DEBUGGING BOT FINDING ===');
console.log('Debug editorial-bot:', parser.debugFindBot('editorial-bot'));
console.log('Debug reviewer-checklist:', parser.debugFindBot('reviewer-checklist'));