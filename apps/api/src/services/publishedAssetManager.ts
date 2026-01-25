import * as fs from 'fs-extra';
import * as path from 'path';
import { PrismaClient, StorageType } from '@colloquium/database';
import { fileStorage, FileStorageService } from './fileStorage';

const prisma = new PrismaClient();

export class PublishedAssetManager {
  private readonly staticDir: string;
  private readonly storage: FileStorageService;

  constructor(storageService?: FileStorageService) {
    this.staticDir = path.join(process.cwd(), 'static', 'published');
    this.storage = storageService || fileStorage;
  }

  async publishManuscriptAssets(manuscriptId: string): Promise<void> {
    console.log(`Publishing assets for manuscript: ${manuscriptId}`);

    try {
      const assets = await prisma.manuscript_files.findMany({
        where: {
          manuscriptId,
          fileType: 'ASSET',
        },
      });

      console.log(`Found ${assets.length} assets to publish for manuscript ${manuscriptId}`);

      const storageType = this.storage.getStorageType();

      if (storageType === StorageType.LOCAL) {
        await this.publishAssetsLocal(manuscriptId, assets);
      } else {
        await this.publishAssetsCloud(manuscriptId, assets);
      }

      await this.updateRenderedHTMLFiles(manuscriptId);

      console.log(`Successfully published assets for manuscript: ${manuscriptId}`);
    } catch (error) {
      console.error(`Failed to publish assets for manuscript ${manuscriptId}:`, error);
      throw error;
    }
  }

  private async publishAssetsLocal(manuscriptId: string, assets: any[]): Promise<void> {
    const manuscriptStaticDir = path.join(this.staticDir, manuscriptId);
    await fs.ensureDir(manuscriptStaticDir);

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
  }

  private async publishAssetsCloud(manuscriptId: string, assets: any[]): Promise<void> {
    const publishedPrefix = `published/${manuscriptId}`;

    for (const asset of assets) {
      const sourcePath = asset.path;
      const destPath = `${publishedPrefix}/${asset.originalName}`;

      const success = await this.storage.copyFile(sourcePath, destPath);
      if (success) {
        console.log(`Published asset to cloud: ${asset.originalName}`);
      } else {
        console.warn(`Failed to publish asset: ${asset.originalName}`);
      }
    }
  }

  async unpublishManuscriptAssets(manuscriptId: string): Promise<void> {
    console.log(`Unpublishing assets for manuscript: ${manuscriptId}`);

    try {
      const storageType = this.storage.getStorageType();

      if (storageType === StorageType.LOCAL) {
        const manuscriptStaticDir = path.join(this.staticDir, manuscriptId);
        if (await fs.pathExists(manuscriptStaticDir)) {
          await fs.remove(manuscriptStaticDir);
          console.log(`Removed static assets for manuscript: ${manuscriptId}`);
        }
      } else {
        const assets = await prisma.manuscript_files.findMany({
          where: {
            manuscriptId,
            fileType: 'ASSET',
          },
        });

        for (const asset of assets) {
          const publishedPath = `published/${manuscriptId}/${asset.originalName}`;
          await this.storage.deleteFile(publishedPath);
        }
        console.log(`Removed cloud assets for manuscript: ${manuscriptId}`);
      }
    } catch (error) {
      console.error(`Failed to unpublish assets for manuscript ${manuscriptId}:`, error);
      throw error;
    }
  }

  private async updateRenderedHTMLFiles(manuscriptId: string): Promise<void> {
    const assets = await prisma.manuscript_files.findMany({
      where: {
        manuscriptId,
        fileType: 'ASSET',
      },
      select: {
        id: true,
        originalName: true,
      },
    });

    const fileIdToNameMap = new Map(assets.map((asset) => [asset.id, asset.originalName]));

    const renderedFiles = await prisma.manuscript_files.findMany({
      where: {
        manuscriptId,
        fileType: 'RENDERED',
        mimetype: 'text/html',
      },
    });

    const storageType = this.storage.getStorageType();

    for (const file of renderedFiles) {
      try {
        if (storageType === StorageType.LOCAL) {
          await this.updateLocalRenderedFile(file, manuscriptId, fileIdToNameMap);
        } else {
          await this.updateCloudRenderedFile(file, manuscriptId, fileIdToNameMap);
        }
      } catch (error) {
        console.error(`Failed to update rendered file ${file.originalName}:`, error);
      }
    }
  }

  private async updateLocalRenderedFile(
    file: any,
    manuscriptId: string,
    fileIdToNameMap: Map<string, string>
  ): Promise<void> {
    const filePath = this.resolveAssetPath(file.path);

    if (await fs.pathExists(filePath)) {
      const htmlContent = await fs.readFile(filePath, 'utf-8');
      const updatedHTML = this.rewriteAssetURLsLocal(htmlContent, manuscriptId, fileIdToNameMap);

      if (updatedHTML !== htmlContent) {
        await fs.writeFile(filePath, updatedHTML, 'utf-8');
        console.log(`Updated asset URLs in rendered file: ${file.originalName}`);
      }
    }
  }

  private async updateCloudRenderedFile(
    file: any,
    manuscriptId: string,
    fileIdToNameMap: Map<string, string>
  ): Promise<void> {
    const stream = await this.storage.getFileStream(file.path);
    if (!stream) {
      console.warn(`Could not read rendered file: ${file.path}`);
      return;
    }

    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk));
    }
    const htmlContent = Buffer.concat(chunks).toString('utf-8');

    const updatedHTML = this.rewriteAssetURLsCloud(htmlContent, manuscriptId, fileIdToNameMap);

    if (updatedHTML !== htmlContent) {
      const multerFile = {
        originalname: file.originalName,
        mimetype: 'text/html',
        size: Buffer.byteLength(updatedHTML, 'utf-8'),
        buffer: Buffer.from(updatedHTML, 'utf-8'),
      } as Express.Multer.File;

      await this.storage.deleteFile(file.path);

      const category = file.path.includes('/rendered/')
        ? 'rendered'
        : file.path.includes('/assets/')
          ? 'assets'
          : 'manuscripts';
      await this.storage.storeFile(multerFile, category as any, manuscriptId);

      console.log(`Updated asset URLs in cloud rendered file: ${file.originalName}`);
    }
  }

  private rewriteAssetURLsLocal(
    htmlContent: string,
    manuscriptId: string,
    fileIdToNameMap: Map<string, string>
  ): string {
    const apiUrlPattern = /\/api\/articles\/[^\/]+\/files\/([a-f0-9-]+)\/download\?[^"'\s]*/g;

    return htmlContent.replace(apiUrlPattern, (match, fileId) => {
      const filename = fileIdToNameMap.get(fileId);

      if (filename) {
        return `/static/published/${manuscriptId}/${filename}`;
      } else {
        console.warn(`Could not find filename for file ID: ${fileId}`);
        return match;
      }
    });
  }

  private rewriteAssetURLsCloud(
    htmlContent: string,
    manuscriptId: string,
    fileIdToNameMap: Map<string, string>
  ): string {
    const apiUrlPattern = /\/api\/articles\/[^\/]+\/files\/([a-f0-9-]+)\/download\?[^"'\s]*/g;

    return htmlContent.replace(apiUrlPattern, (match, fileId) => {
      const filename = fileIdToNameMap.get(fileId);

      if (filename) {
        const publishedPath = `published/${manuscriptId}/${filename}`;
        return this.storage.getPublicUrl(publishedPath);
      } else {
        console.warn(`Could not find filename for file ID: ${fileId}`);
        return match;
      }
    });
  }

  private resolveAssetPath(assetPath: string): string {
    if (assetPath.startsWith('/uploads/')) {
      return '.' + assetPath;
    }
    return assetPath;
  }

  async migrateExistingPublishedManuscripts(): Promise<void> {
    console.log('Starting migration of existing published manuscripts...');

    const publishedManuscripts = await prisma.manuscripts.findMany({
      where: {
        status: 'PUBLISHED',
      },
      select: {
        id: true,
        title: true,
      },
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

export const publishedAssetManager = new PublishedAssetManager();
