import * as fs from 'fs-extra';
import * as path from 'path';
import { PrismaClient } from '@colloquium/database';

const prisma = new PrismaClient();

export class PublishedAssetManager {
  private readonly staticDir: string;

  constructor() {
    // Static directory for published assets
    this.staticDir = path.join(process.cwd(), 'static', 'published');
  }

  /**
   * Publishes all assets for a manuscript to static hosting
   * Called when a manuscript status changes to PUBLISHED
   */
  async publishManuscriptAssets(manuscriptId: string): Promise<void> {
    console.log(`Publishing assets for manuscript: ${manuscriptId}`);
    
    try {
      // Create manuscript-specific static directory
      const manuscriptStaticDir = path.join(this.staticDir, manuscriptId);
      await fs.ensureDir(manuscriptStaticDir);

      // Get all ASSET files for this manuscript
      const assets = await prisma.manuscript_files.findMany({
        where: {
          manuscriptId,
          fileType: 'ASSET'
        }
      });

      console.log(`Found ${assets.length} assets to publish for manuscript ${manuscriptId}`);

      // Copy each asset to static directory with original filename
      for (const asset of assets) {
        const sourcePath = this.resolveAssetPath(asset.path);
        const targetPath = path.join(manuscriptStaticDir, asset.originalName);

        if (await fs.pathExists(sourcePath)) {
          await fs.copy(sourcePath, targetPath);
          console.log(`Published asset: ${asset.originalName}`);
        } else {
          console.warn(`Asset file not found: ${sourcePath}`);
        }
      }

      // Update all RENDERED HTML files to use static URLs
      await this.updateRenderedHTMLFiles(manuscriptId);

      console.log(`Successfully published assets for manuscript: ${manuscriptId}`);
    } catch (error) {
      console.error(`Failed to publish assets for manuscript ${manuscriptId}:`, error);
      throw error;
    }
  }

  /**
   * Removes published assets when a manuscript is retracted
   */
  async unpublishManuscriptAssets(manuscriptId: string): Promise<void> {
    console.log(`Unpublishing assets for manuscript: ${manuscriptId}`);
    
    try {
      const manuscriptStaticDir = path.join(this.staticDir, manuscriptId);
      
      if (await fs.pathExists(manuscriptStaticDir)) {
        await fs.remove(manuscriptStaticDir);
        console.log(`Removed static assets for manuscript: ${manuscriptId}`);
      }
    } catch (error) {
      console.error(`Failed to unpublish assets for manuscript ${manuscriptId}:`, error);
      throw error;
    }
  }

  /**
   * Updates RENDERED HTML files to use static asset URLs instead of API URLs
   */
  private async updateRenderedHTMLFiles(manuscriptId: string): Promise<void> {
    // Get all assets to build a mapping from file ID to filename
    const assets = await prisma.manuscript_files.findMany({
      where: {
        manuscriptId,
        fileType: 'ASSET'
      },
      select: {
        id: true,
        originalName: true
      }
    });

    const fileIdToNameMap = new Map(assets.map(asset => [asset.id, asset.originalName]));

    const renderedFiles = await prisma.manuscript_files.findMany({
      where: {
        manuscriptId,
        fileType: 'RENDERED',
        mimetype: 'text/html'
      }
    });

    for (const file of renderedFiles) {
      try {
        const filePath = this.resolveAssetPath(file.path);
        
        if (await fs.pathExists(filePath)) {
          const htmlContent = await fs.readFile(filePath, 'utf-8');
          const updatedHTML = this.rewriteAssetURLs(htmlContent, manuscriptId, fileIdToNameMap);
          
          // Only update if URLs were actually changed
          if (updatedHTML !== htmlContent) {
            await fs.writeFile(filePath, updatedHTML, 'utf-8');
            console.log(`Updated asset URLs in rendered file: ${file.originalName}`);
          }
        }
      } catch (error) {
        console.error(`Failed to update rendered file ${file.originalName}:`, error);
      }
    }
  }

  /**
   * Rewrites API asset URLs to static URLs in HTML content
   */
  private rewriteAssetURLs(htmlContent: string, manuscriptId: string, fileIdToNameMap: Map<string, string>): string {
    // Pattern to match API asset URLs: /api/articles/{manuscriptId}/files/{fileId}/download?...
    const apiUrlPattern = /\/api\/articles\/[^\/]+\/files\/([a-f0-9-]+)\/download\?[^"'\s]*/g;
    
    return htmlContent.replace(apiUrlPattern, (match, fileId) => {
      // Look up the original filename using the file ID
      const filename = fileIdToNameMap.get(fileId);
      
      if (filename) {
        return `/static/published/${manuscriptId}/${filename}`;
      } else {
        console.warn(`Could not find filename for file ID: ${fileId}`);
        return match; // Return original URL if we can't map it
      }
    });
  }

  /**
   * Resolves asset path handling both absolute and relative paths
   */
  private resolveAssetPath(assetPath: string): string {
    if (assetPath.startsWith('/uploads/')) {
      // Convert absolute path starting with /uploads/ to relative path
      return '.' + assetPath;
    }
    return assetPath;
  }

  /**
   * Creates asset manifest for tracking published assets
   */
  private async createAssetManifest(manuscriptId: string, assets: any[]): Promise<void> {
    const manifestPath = path.join(this.staticDir, manuscriptId, 'manifest.json');
    const manifest = {
      manuscriptId,
      publishedAt: new Date().toISOString(),
      assets: assets.map(asset => ({
        originalName: asset.originalName,
        mimetype: asset.mimetype,
        size: asset.size,
        checksum: asset.checksum
      }))
    };
    
    await fs.writeJSON(manifestPath, manifest, { spaces: 2 });
  }

  /**
   * Migrates existing published manuscripts to static hosting
   */
  async migrateExistingPublishedManuscripts(): Promise<void> {
    console.log('Starting migration of existing published manuscripts...');
    
    const publishedManuscripts = await prisma.manuscripts.findMany({
      where: {
        status: 'PUBLISHED'
      },
      select: {
        id: true,
        title: true
      }
    });

    console.log(`Found ${publishedManuscripts.length} published manuscripts to migrate`);

    for (const manuscript of publishedManuscripts) {
      try {
        await this.publishManuscriptAssets(manuscript.id);
        console.log(`Migrated: ${manuscript.title}`);
      } catch (error) {
        console.error(`Failed to migrate manuscript ${manuscript.id}:`, error);
      }
    }

    console.log('Migration completed');
  }
}

// Export singleton instance
export const publishedAssetManager = new PublishedAssetManager();