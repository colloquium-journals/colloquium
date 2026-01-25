import { prisma } from '../src/index';

/**
 * Update existing bot installations to include the supportsFileUploads flag
 */
async function updateBotFlags() {
  console.log('🔄 Updating bot supportsFileUploads flags...');

  try {
    // Update markdown-renderer bot to support file uploads
    const markdownUpdated = await prisma.botDefinition.updateMany({
      where: {
        id: 'bot-markdown-renderer'
      },
      data: {
        supportsFileUploads: true
      }
    });

    console.log(`✅ Updated ${markdownUpdated.count} markdown-renderer bot(s)`);

    // Ensure other bots have supportsFileUploads set to false (should already be default)
    const otherBotsUpdated = await prisma.botDefinition.updateMany({
      where: {
        id: {
          not: 'bot-markdown-renderer'
        },
        supportsFileUploads: {
          not: false
        }
      },
      data: {
        supportsFileUploads: false
      }
    });

    console.log(`✅ Updated ${otherBotsUpdated.count} other bot(s) to disable file uploads`);

    // List all bots and their current flags
    const allBots = await prisma.botDefinition.findMany({
      select: {
        id: true,
        name: true,
        supportsFileUploads: true
      }
    });

    console.log('\n📋 Current bot file upload support:');
    allBots.forEach(bot => {
      console.log(`  ${bot.name} (${bot.id}): ${bot.supportsFileUploads ? '✅ Supports' : '❌ No'} file uploads`);
    });

    console.log('\n🎉 Bot flags updated successfully!');
  } catch (error) {
    console.error('❌ Error updating bot flags:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  updateBotFlags().catch(console.error);
}

export { updateBotFlags };