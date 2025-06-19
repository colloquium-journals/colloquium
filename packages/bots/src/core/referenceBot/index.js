const { referenceBot } = require('../referenceBot');

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

// Export the plugin structure
module.exports = {
  manifest,
  bot: referenceBot
};