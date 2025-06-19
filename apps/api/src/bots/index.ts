import * as BotsPackage from '@colloquium/bots';
import { prisma } from '@colloquium/database';
import { DatabaseBotManager } from '@colloquium/bots';

// Export the bot executor for use in other parts of the application
export const botExecutor = new BotsPackage.BotExecutor();

// Export the bot manager for plugin system
export const botManager = new DatabaseBotManager(undefined, botExecutor);

// Create or get bot user in database
async function ensureBotUser(botId: string, botName: string): Promise<string> {
  const email = `${botId}@colloquium.bot`;
  
  let botUser = await prisma.user.findUnique({
    where: { email }
  });

  if (!botUser) {
    botUser = await prisma.user.create({
      data: {
        email,
        name: botName,
        role: 'BOT'
      }
    });
    // console.log(`✅ Created bot user: ${botName} (${email})`);
  }

  return botUser.id;
}

// Initialize and register all bots
export async function initializeBots() {
  // console.log('Initializing command-based bot system...');
  
  const { editorialBot, plagiarismBot, referenceBot } = BotsPackage;

  // Create bot users in database
  const editorialBotUserId = await ensureBotUser(editorialBot.id, editorialBot.name);
  const plagiarismBotUserId = await ensureBotUser(plagiarismBot.id, plagiarismBot.name);
  const referenceBotUserId = await ensureBotUser(referenceBot.id, referenceBot.name);

  // Store bot user IDs for later use
  botExecutor.setBotUserId(editorialBot.id, editorialBotUserId);
  botExecutor.setBotUserId(plagiarismBot.id, plagiarismBotUserId);
  botExecutor.setBotUserId(referenceBot.id, referenceBotUserId);

  // Register command-based bots
  botExecutor.registerCommandBot(editorialBot);
  botExecutor.registerCommandBot(plagiarismBot);
  botExecutor.registerCommandBot(referenceBot);

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

    botExecutor.installBot(referenceBot.id, {
      defaultTimeout: 30,
      includeMissingDoiReferences: true
    });

    // console.log('✅ Command-based bots installed successfully');
  } catch (error) {
    console.error('❌ Failed to install command-based bots:', error);
  }

  // Install default bots via plugin system if this is a fresh installation
  const installedBots = await botManager.list();
  if (installedBots.length === 0) {
    // console.log('🔧 Installing default bots...');
    try {
      await botManager.installDefaults();
      // console.log('✅ Default bots installed successfully');
    } catch (error) {
      console.error('❌ Failed to install default bots:', error);
    }
  }

  // console.log('Bot system initialized');
}