const { ReviewerChecklistBot } = require('../reviewerChecklistBot');

// Create the manifest from package.json
const packageJson = require('./package.json');

const manifest = {
  name: packageJson.name,
  version: packageJson.version,
  description: packageJson.description,
  author: packageJson.author,
  license: packageJson.license,
  colloquium: packageJson.colloquium
};

// Create an instance of the bot
const reviewerChecklistBot = new ReviewerChecklistBot();

// Export the plugin structure
module.exports = {
  manifest,
  bot: reviewerChecklistBot
};