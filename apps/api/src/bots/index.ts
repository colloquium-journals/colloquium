import * as BotsPackage from '@colloquium/bots';
import { prisma } from '@colloquium/database';

// Export the bot executor for use in other parts of the application
export const botExecutor = new BotsPackage.BotExecutor();

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
    console.log(`✅ Created bot user: ${botName} (${email})`);
  }

  return botUser.id;
}

// Initialize and register all bots
export async function initializeBots() {
  console.log('Initializing command-based bot system...');
  
  const { editorialBot, plagiarismBot } = BotsPackage;

  // Create bot users in database
  const editorialBotUserId = await ensureBotUser(editorialBot.id, editorialBot.name);
  const plagiarismBotUserId = await ensureBotUser(plagiarismBot.id, plagiarismBot.name);

  // Store bot user IDs for later use
  botExecutor.setBotUserId(editorialBot.id, editorialBotUserId);
  botExecutor.setBotUserId(plagiarismBot.id, plagiarismBotUserId);

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