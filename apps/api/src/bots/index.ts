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
  console.log('🤖 Initializing bots...');

  // Ensure required system bots are installed in the database
  const installedBots = await botManager.list();
  const requiredBots = ['editorial-bot', 'reference-bot', 'reviewer-checklist'];
  
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

  // console.log('Bot system initialized');
}