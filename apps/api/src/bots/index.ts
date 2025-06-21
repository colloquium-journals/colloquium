import * as BotsPackage from '@colloquium/bots';
import { prisma } from '@colloquium/database';
import { DatabaseBotManager } from '@colloquium/bots';
import path from 'path';

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
  
  const { editorialBot, plagiarismBot, referenceBot, ReviewerChecklistBot } = BotsPackage;
  
  // Initialize reviewer checklist bot
  const reviewerChecklistBot = new ReviewerChecklistBot();

  // Create bot users in database
  const editorialBotUserId = await ensureBotUser(editorialBot.id, editorialBot.name);
  const plagiarismBotUserId = await ensureBotUser(plagiarismBot.id, plagiarismBot.name);
  const referenceBotUserId = await ensureBotUser(referenceBot.id, referenceBot.name);
  const reviewerChecklistBotUserId = await ensureBotUser(reviewerChecklistBot.id, reviewerChecklistBot.name);

  // Store bot user IDs for later use
  botExecutor.setBotUserId(editorialBot.id, editorialBotUserId);
  botExecutor.setBotUserId(plagiarismBot.id, plagiarismBotUserId);
  botExecutor.setBotUserId(referenceBot.id, referenceBotUserId);
  botExecutor.setBotUserId(reviewerChecklistBot.id, reviewerChecklistBotUserId);

  // Register command-based bots
  botExecutor.registerCommandBot(editorialBot);
  botExecutor.registerCommandBot(plagiarismBot);
  botExecutor.registerCommandBot(referenceBot);
  botExecutor.registerCommandBot(reviewerChecklistBot);

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

    botExecutor.installBot(reviewerChecklistBot.id, {
      title: 'Manuscript Review Checklist',
      criteria: [] // Will use default criteria if empty
    });

    // console.log('✅ Command-based bots installed successfully');
  } catch (error) {
    console.error('❌ Failed to install command-based bots:', error);
  }

  // Ensure required system bots are installed in the database
  const installedBots = await botManager.list();
  const requiredBots = ['editorial-bot', 'plagiarism-bot', 'reference-bot', 'reviewer-checklist'];
  
  // Check if any required bots are missing
  const missingRequiredBots = requiredBots.filter(
    requiredBotId => !installedBots.some(bot => bot.manifest.colloquium.botId === requiredBotId)
  );
  
  if (missingRequiredBots.length > 0) {
    console.log(`🔧 Installing missing required bots: ${missingRequiredBots.join(', ')}`);
    try {
      const installations = await botManager.installDefaults();
      if (installations.length > 0) {
        console.log(`✅ Successfully installed ${installations.length} new bot(s)`);
      } else {
        console.log('ℹ️ All required bots are already installed');
      }
    } catch (error) {
      // Only log as error if it's not an "already installed" error
      if (error instanceof Error && error.message.includes('already installed')) {
        console.log('ℹ️ Required bots are already installed');
      } else {
        console.error('❌ Failed to install required bots:', error);
      }
    }
  }
  
  // Install additional default bots if this is a fresh installation
  if (installedBots.length === 0) {
    console.log('🔧 Installing default bots for fresh installation...');
    try {
      const installations = await botManager.installDefaults();
      if (installations.length > 0) {
        console.log(`✅ Successfully installed ${installations.length} default bot(s)`);
      } else {
        console.log('ℹ️ All default bots are already available');
      }
    } catch (error) {
      // Only log as error if it's not an "already installed" error
      if (error instanceof Error && error.message.includes('already installed')) {
        console.log('ℹ️ Default bots are already installed');
      } else {
        console.error('❌ Failed to install default bots:', error);
      }
    }
  }

  // console.log('Bot system initialized');
}