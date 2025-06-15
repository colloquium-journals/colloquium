import * as BotsPackage from '@colloquium/bots';

// Initialize and register all bots
export async function initializeBots() {
  console.log('Initializing command-based bot system...');
  
  const { editorialBot, plagiarismBot } = BotsPackage;

  // Register command-based bots
  botExecutor.registerCommandBot(editorialBot);
  botExecutor.registerCommandBot(plagiarismBot);

  // Install command-based bots to bot executor
  try {
    botExecutor.installBot(editorialBot.id, {
      autoStatusUpdates: true,
      notifyAuthors: true
    });

    botExecutor.installBot(plagiarismBot.id, {
      defaultThreshold: 0.15,
      enabledDatabases: ['crossref', 'pubmed', 'arxiv']
    });

    console.log('✅ Command-based bots installed successfully');
  } catch (error) {
    console.error('❌ Failed to install command-based bots:', error);
  }

  console.log('Bot system initialized');
}

// Export the bot executor for use in other parts of the application
export const botExecutor = new BotsPackage.BotExecutor();