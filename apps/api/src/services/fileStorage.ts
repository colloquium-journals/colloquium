import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { StorageType } from '@prisma/client';

export interface StorageConfig {
  type: StorageType;
  basePath: string;
  maxFileSize: number;
  
  // Storage-specific configuration
  local?: {
    uploadsDir: string;
  };
  s3?: {
    bucket: string;
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
  };
  // Additional storage types can be added here
}

export interface FileReference {
  id: string;
  originalName: string;
  filename: string;
  storagePath: string;
  storageType: StorageType;
  mimeType: string;
  size: number;
  checksum: string;
  encoding?: string;
}

export interface UploadResult {
  success: boolean;
  file?: FileReference;
  error?: string;
}

export class FileStorageService {
  private config: StorageConfig;

  constructor(config?: Partial<StorageConfig>) {
    this.config = {
      type: (process.env.STORAGE_TYPE as StorageType) || StorageType.LOCAL,
      basePath: process.env.STORAGE_BASE_PATH || 'uploads/',
      maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '50') * 1024 * 1024, // 50MB default
      local: {
        uploadsDir: 'uploads/',
      },
      ...config
    };
  }

  /**
   * Store an uploaded file and return a reference
   */
  async storeFile(
    file: Express.Multer.File, 
    category: 'manuscripts' | 'assets' | 'rendered' = 'manuscripts',
    manuscriptId?: string
  ): Promise<UploadResult> {
    try {
      // Validate file size
      if (file.size > this.config.maxFileSize) {
        return {
          success: false,
          error: `File size exceeds maximum allowed size of ${this.config.maxFileSize / (1024 * 1024)}MB`
        };
      }

      // Generate unique filename
      const fileExtension = path.extname(file.originalname);
      const uniqueFilename = this.generateUniqueFilename(file.originalname, fileExtension);
      
      // Calculate checksum
      const checksum = await this.calculateChecksum(file.buffer || fs.readFileSync(file.path));
      
      // Determine storage path
      const storagePath = this.getStoragePath(category, manuscriptId, uniqueFilename);
      
      // Store file based on storage type
      let success = false;
      switch (this.config.type) {
        case StorageType.LOCAL:
          success = await this.storeFileLocal(file, storagePath);
          break;
        case StorageType.S3:
          success = await this.storeFileS3(file, storagePath);
          break;
        default:
          return {
            success: false,
            error: `Unsupported storage type: ${this.config.type}`
          };
      }

      if (!success) {
        return {
          success: false,
          error: 'Failed to store file'
        };
      }

      return {
        success: true,
        file: {
          id: crypto.randomUUID(),
          originalName: file.originalname,
          filename: uniqueFilename,
          storagePath,
          storageType: this.config.type,
          mimeType: file.mimetype,
          size: file.size,
          checksum,
          encoding: this.detectEncoding(file.mimetype)
        }
      };
    } catch (error) {
      return {
        success: false,
        error: `Storage error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Retrieve a file stream for download
   */
  async getFileStream(storagePath: string): Promise<NodeJS.ReadableStream | null> {
    switch (this.config.type) {
      case StorageType.LOCAL:
        return this.getFileStreamLocal(storagePath);
      case StorageType.S3:
        return this.getFileStreamS3(storagePath);
      default:
        return null;
    }
  }

  /**
   * Delete a file from storage
   */
  async deleteFile(storagePath: string): Promise<boolean> {
    switch (this.config.type) {
      case StorageType.LOCAL:
        return this.deleteFileLocal(storagePath);
      case StorageType.S3:
        return this.deleteFileS3(storagePath);
      default:
        return false;
    }
  }

  /**
   * Check if a file exists
   */
  async fileExists(storagePath: string): Promise<boolean> {
    switch (this.config.type) {
      case StorageType.LOCAL:
        return this.fileExistsLocal(storagePath);
      case StorageType.S3:
        return this.fileExistsS3(storagePath);
      default:
        return false;
    }
  }

  // Private helper methods

  private generateUniqueFilename(originalName: string, extension: string): string {
    const timestamp = Date.now();
    const randomSuffix = Math.round(Math.random() * 1E9);
    const baseName = path.basename(originalName, extension).replace(/[^a-zA-Z0-9]/g, '-');
    return `${baseName}-${timestamp}-${randomSuffix}${extension}`;
  }

  private getStoragePath(category: string, manuscriptId?: string, filename?: string): string {
    const parts = [this.config.basePath, category];
    if (manuscriptId) parts.push(manuscriptId);
    if (filename) parts.push(filename);
    return path.join(...parts);
  }

  private async calculateChecksum(data: Buffer): Promise<string> {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  private detectEncoding(mimeType: string): string | undefined {
    if (mimeType.startsWith('text/')) {
      return 'utf-8';
    }
    return undefined;
  }

  // Local storage implementation
  private async storeFileLocal(file: Express.Multer.File, storagePath: string): Promise<boolean> {
    try {
      const fullPath = path.resolve(storagePath);
      const directory = path.dirname(fullPath);
      
      // Ensure directory exists
      if (!fs.existsSync(directory)) {
        fs.mkdirSync(directory, { recursive: true });
      }

      // Move file if it was uploaded via multer, otherwise write buffer
      if (file.path) {
        fs.renameSync(file.path, fullPath);
      } else if (file.buffer) {
        fs.writeFileSync(fullPath, file.buffer);
      } else {
        return false;
      }

      return true;
    } catch (error) {
      console.error('Local storage error:', error);
      return false;
    }
  }

  private async getFileStreamLocal(storagePath: string): Promise<NodeJS.ReadableStream | null> {
    try {
      const fullPath = path.resolve(storagePath);
      if (!fs.existsSync(fullPath)) {
        return null;
      }
      return fs.createReadStream(fullPath);
    } catch (error) {
      console.error('Local file read error:', error);
      return null;
    }
  }

  private async deleteFileLocal(storagePath: string): Promise<boolean> {
    try {
      const fullPath = path.resolve(storagePath);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
      return true;
    } catch (error) {
      console.error('Local file delete error:', error);
      return false;
    }
  }

  private async fileExistsLocal(storagePath: string): Promise<boolean> {
    try {
      const fullPath = path.resolve(storagePath);
      return fs.existsSync(fullPath);
    } catch (error) {
      return false;
    }
  }

  // S3 storage implementation (placeholder - requires AWS SDK)
  private async storeFileS3(file: Express.Multer.File, storagePath: string): Promise<boolean> {
    // TODO: Implement S3 storage using AWS SDK
    // This would require: npm install @aws-sdk/client-s3
    console.warn('S3 storage not yet implemented');
    return false;
  }

  private async getFileStreamS3(storagePath: string): Promise<NodeJS.ReadableStream | null> {
    // TODO: Implement S3 file retrieval
    console.warn('S3 file retrieval not yet implemented');
    return null;
  }

  private async deleteFileS3(storagePath: string): Promise<boolean> {
    // TODO: Implement S3 file deletion
    console.warn('S3 file deletion not yet implemented');
    return false;
  }

  private async fileExistsS3(storagePath: string): Promise<boolean> {
    // TODO: Implement S3 file existence check
    console.warn('S3 file existence check not yet implemented');
    return false;
  }
}

// Export a default instance
export const fileStorage = new FileStorageService();