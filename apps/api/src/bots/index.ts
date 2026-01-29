import * as BotsPackage from '@colloquium/bots';
import { prisma } from '@colloquium/database';
import { DatabaseBotManager } from '@colloquium/bots';

// Export the bot executor for use in other parts of the application
export const botExecutor = new BotsPackage.BotExecutor();

// Export the bot manager for plugin system
export const botManager = new DatabaseBotManager(undefined, botExecutor);

// Wait for database connection to be ready with retry logic
async function waitForDatabase(maxRetries = 10, delayMs = 1000): Promise<boolean> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Simple query to check database connectivity
      await prisma.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      if (attempt === maxRetries) {
        console.error(`❌ Database not ready after ${maxRetries} attempts`);
        return false;
      }
      console.log(`⏳ Waiting for database connection (attempt ${attempt}/${maxRetries})...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  return false;
}

// Create or get bot user in database
async function ensureBotUser(botId: string, botName: string): Promise<string> {
  const email = `${botId}@colloquium.bot`;
  
  let botUser = await prisma.users.findUnique({
    where: { email }
  });

  if (!botUser) {
    botUser = await prisma.users.create({
      data: {
        id: `bot-${botId}`,
        email,
        username: botId,
        name: botName,
        role: 'BOT',
        updatedAt: new Date()
      }
    });
    // console.log(`✅ Created bot user: ${botName} (${email})`);
  }

  return botUser.id;
}

// Initialize and register all bots
export async function initializeBots() {
  console.log('🤖 Initializing bots...');

  // Wait for database to be ready before proceeding
  const dbReady = await waitForDatabase();
  if (!dbReady) {
    throw new Error('Database connection not available - bot initialization aborted');
  }

  // Ensure required system bots are installed in the database
  const installedBots = await botManager.list();
  const requiredBots = ['bot-editorial', 'bot-reference-check', 'bot-reviewer-checklist'];
  
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

  // Load all installed bots into the BotExecutor
  console.log('🔄 Loading installed bots into executor...');
  try {
    await botManager.reloadAllBots();
    const loadedBots = botExecutor.getCommandBots();
    console.log(`✅ Loaded ${loadedBots.length} bot(s) into executor`);
  } catch (error) {
    console.error('❌ Failed to load installed bots:', error);
  }

  // Run onInstall hooks for existing bots that might not have had them called yet
  console.log('🔗 Checking for missing onInstall hook executions...');
  try {
    const allInstallations = await botManager.list();
    for (const installation of allInstallations) {
      const botId = installation.manifest.colloquium.botId;
      
      // Check if this bot has any template files (indicating onInstall was already called)
      const existingFiles = await prisma.bot_config_files.findMany({
        where: { 
          botId,
          category: 'template'
        }
      });
      
      // If no template files exist but the bot has an onInstall hook, call it
      if (existingFiles.length === 0) {
        const loadedBot = botExecutor.getCommandBots().find(bot => bot.id === botId);
        if (loadedBot && loadedBot.onInstall) {
          console.log(`🔗 Running missed onInstall hook for ${botId}...`);
          
          // Get bot user
          const botEmail = `${botId}@colloquium.bot`;
          const botUser = await prisma.users.findUnique({
            where: { email: botEmail }
          });
          
          if (botUser) {
            await botManager.callBotInstallationHook(loadedBot, botUser.id, installation.config);
          }
        }
      }
    }
  } catch (error) {
    console.warn('⚠️ Failed to check/run missing onInstall hooks:', error);
  }

  // console.log('Bot system initialized');
}