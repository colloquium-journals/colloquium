const { editorialBot } = require('./dist/index');
const packageJson = require('./package.json');

// Create manifest from package.json
const manifest = {
  name: packageJson.name,
  version: packageJson.version,
  description: packageJson.description,
  author: {
    name: packageJson.author || 'Colloquium Team'
  },
  keywords: packageJson.keywords || [],
  colloquium: {
    botId: packageJson.colloquium.botId,
    apiVersion: packageJson.colloquium.apiVersion,
    permissions: packageJson.colloquium.permissions || [],
    isDefault: packageJson.colloquium.isDefault,
    defaultConfig: packageJson.colloquium.defaultConfig || {}
  }
};

// Export plugin format
module.exports = {
  manifest,
  bot: editorialBot
};