#!/usr/bin/env node

import { initializeBots } from '../bots';

/**
 * Standalone script to initialize bots
 * This script initializes all bots and exits, preventing double server startup
 */
async function main() {
  try {
    console.log('🤖 Initializing bots...');
    await initializeBots();
    console.log('✅ Bot initialization complete');
    process.exit(0);
  } catch (error) {
    console.error('❌ Bot initialization failed:', error);
    process.exit(1);
  }
}

main();