import { prisma } from '../src/index';

/**
 * Verify that bot file upload flags are correctly set
 */
async function verifyBotFlags() {
  console.log('🔍 Verifying bot file upload flags...\n');

  try {
    const bots = await prisma.botDefinition.findMany({
      select: {
        id: true,
        name: true,
        supportsFileUploads: true
      },
      orderBy: {
        name: 'asc'
      }
    });

    console.log('📋 Bot File Upload Configuration:');
    console.log('================================');
    
    let markdownRendererFound = false;
    
    bots.forEach(bot => {
      const status = bot.supportsFileUploads ? '✅ SUPPORTS' : '❌ NO SUPPORT';
      const emoji = bot.supportsFileUploads ? '📁' : '🚫';
      
      console.log(`${emoji} ${bot.name} (${bot.id}): ${status}`);
      
      if (bot.id === 'bot-markdown-renderer' && bot.supportsFileUploads) {
        markdownRendererFound = true;
      }
    });

    console.log('\n🎯 Verification Results:');
    console.log('========================');
    
    if (markdownRendererFound) {
      console.log('✅ SUCCESS: Markdown Renderer bot correctly supports file uploads');
    } else {
      console.log('❌ ISSUE: Markdown Renderer bot should support file uploads');
    }

    const otherBots = bots.filter(bot => bot.id !== 'bot-markdown-renderer');
    const incorrectBots = otherBots.filter(bot => bot.supportsFileUploads);
    
    if (incorrectBots.length === 0) {
      console.log('✅ SUCCESS: Other bots correctly do not support file uploads');
    } else {
      console.log(`❌ ISSUE: ${incorrectBots.length} bot(s) incorrectly support file uploads:`);
      incorrectBots.forEach(bot => {
        console.log(`   - ${bot.name} (${bot.id})`);
      });
    }

    console.log('\n🏁 Verification complete!');
    
    // Return summary for programmatic use
    return {
      markdownRendererCorrect: markdownRendererFound,
      otherBotsCorrect: incorrectBots.length === 0,
      totalBots: bots.length
    };

  } catch (error) {
    console.error('❌ Error verifying bot flags:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  verifyBotFlags().catch(console.error);
}

export { verifyBotFlags };