#!/usr/bin/env ts-node

/**
 * Migration script to publish assets for existing published manuscripts
 * Run this after deploying the static asset hosting feature
 */

import { publishedAssetManager } from '../services/publishedAssetManager';

async function main() {
  console.log('🚀 Starting migration of published assets to static hosting...\n');
  
  try {
    await publishedAssetManager.migrateExistingPublishedManuscripts();
    console.log('\n✅ Migration completed successfully!');
    console.log('\nPublished assets are now available at:');
    console.log('  /static/published/{manuscriptId}/{filename}');
    console.log('\nNext steps:');
    console.log('  1. Verify assets are accessible at the new URLs');
    console.log('  2. Consider setting up CDN for global distribution');
    console.log('  3. Monitor disk usage in static/published directory');
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Migration script error:', error);
      process.exit(1);
    });
}

export { main as migratePublishedAssets };