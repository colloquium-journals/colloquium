import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Readable } from 'stream';
import { StorageType } from '@prisma/client';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { Storage as GCSStorage, Bucket } from '@google-cloud/storage';
import {
  StorageConfiguration,
  S3StorageConfig,
  GCSStorageConfig,
  createStorageConfig,
} from '../config/storage';

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
  private config: StorageConfiguration;
  private s3Client?: S3Client;
  private gcsStorage?: GCSStorage;
  private gcsBucket?: Bucket;

  constructor(config?: Partial<StorageConfiguration>) {
    this.config = config ? { ...createStorageConfig(), ...config } : createStorageConfig();
    this.initializeClients();
  }

  private initializeClients(): void {
    if (this.config.type === StorageType.S3 && this.config.s3) {
      this.s3Client = this.createS3Client(this.config.s3);
    } else if (this.config.type === StorageType.GCS && this.config.gcs) {
      const { storage, bucket } = this.createGCSClient(this.config.gcs);
      this.gcsStorage = storage;
      this.gcsBucket = bucket;
    }
  }

  private createS3Client(s3Config: S3StorageConfig): S3Client {
    const clientConfig: any = {
      region: s3Config.region,
    };

    if (s3Config.accessKeyId && s3Config.secretAccessKey) {
      clientConfig.credentials = {
        accessKeyId: s3Config.accessKeyId,
        secretAccessKey: s3Config.secretAccessKey,
      };
    }

    if (s3Config.endpoint) {
      clientConfig.endpoint = s3Config.endpoint;
    }

    if (s3Config.forcePathStyle) {
      clientConfig.forcePathStyle = true;
    }

    return new S3Client(clientConfig);
  }

  private createGCSClient(gcsConfig: GCSStorageConfig): { storage: GCSStorage; bucket: Bucket } {
    const storageOptions: any = {};

    if (gcsConfig.projectId) {
      storageOptions.projectId = gcsConfig.projectId;
    }

    if (gcsConfig.keyFilename) {
      storageOptions.keyFilename = gcsConfig.keyFilename;
    } else if (gcsConfig.credentials) {
      storageOptions.credentials = gcsConfig.credentials;
    }

    const storage = new GCSStorage(storageOptions);
    const bucket = storage.bucket(gcsConfig.bucket);

    return { storage, bucket };
  }

  async storeFile(
    file: Express.Multer.File,
    category: 'manuscripts' | 'assets' | 'rendered' = 'manuscripts',
    manuscriptId?: string
  ): Promise<UploadResult> {
    try {
      if (file.size > this.config.maxFileSize) {
        return {
          success: false,
          error: `File size exceeds maximum allowed size of ${this.config.maxFileSize / (1024 * 1024)}MB`,
        };
      }

      const fileExtension = path.extname(file.originalname);
      const uniqueFilename = this.generateUniqueFilename(file.originalname, fileExtension);
      const fileBuffer = file.buffer || fs.readFileSync(file.path);
      const checksum = await this.calculateChecksum(fileBuffer);
      const storagePath = this.getStoragePath(category, manuscriptId, uniqueFilename);

      let success = false;
      switch (this.config.type) {
        case StorageType.LOCAL:
          success = await this.storeFileLocal(file, storagePath);
          break;
        case StorageType.S3:
          success = await this.storeFileS3(fileBuffer, storagePath, file.mimetype);
          break;
        case StorageType.GCS:
          success = await this.storeFileGCS(fileBuffer, storagePath, file.mimetype);
          break;
        default:
          return {
            success: false,
            error: `Unsupported storage type: ${this.config.type}`,
          };
      }

      if (!success) {
        return {
          success: false,
          error: 'Failed to store file',
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
          encoding: this.detectEncoding(file.mimetype),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Storage error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  async getFileStream(storagePath: string): Promise<NodeJS.ReadableStream | null> {
    switch (this.config.type) {
      case StorageType.LOCAL:
        return this.getFileStreamLocal(storagePath);
      case StorageType.S3:
        return this.getFileStreamS3(storagePath);
      case StorageType.GCS:
        return this.getFileStreamGCS(storagePath);
      default:
        return null;
    }
  }

  async deleteFile(storagePath: string): Promise<boolean> {
    switch (this.config.type) {
      case StorageType.LOCAL:
        return this.deleteFileLocal(storagePath);
      case StorageType.S3:
        return this.deleteFileS3(storagePath);
      case StorageType.GCS:
        return this.deleteFileGCS(storagePath);
      default:
        return false;
    }
  }

  async fileExists(storagePath: string): Promise<boolean> {
    switch (this.config.type) {
      case StorageType.LOCAL:
        return this.fileExistsLocal(storagePath);
      case StorageType.S3:
        return this.fileExistsS3(storagePath);
      case StorageType.GCS:
        return this.fileExistsGCS(storagePath);
      default:
        return false;
    }
  }

  async copyFile(sourcePath: string, destPath: string): Promise<boolean> {
    switch (this.config.type) {
      case StorageType.LOCAL:
        return this.copyFileLocal(sourcePath, destPath);
      case StorageType.S3:
        return this.copyFileS3(sourcePath, destPath);
      case StorageType.GCS:
        return this.copyFileGCS(sourcePath, destPath);
      default:
        return false;
    }
  }

  getPublicUrl(storagePath: string): string {
    if (this.config.publicBaseUrl) {
      const cleanPath = storagePath.replace(/^\/+/, '');
      return `${this.config.publicBaseUrl}/${cleanPath}`;
    }

    switch (this.config.type) {
      case StorageType.S3:
        return `https://${this.config.s3!.bucket}.s3.${this.config.s3!.region}.amazonaws.com/${storagePath}`;
      case StorageType.GCS:
        return `https://storage.googleapis.com/${this.config.gcs!.bucket}/${storagePath}`;
      default:
        return `/static/${storagePath}`;
    }
  }

  getStorageType(): StorageType {
    return this.config.type;
  }

  private generateUniqueFilename(originalName: string, extension: string): string {
    const timestamp = Date.now();
    const randomSuffix = Math.round(Math.random() * 1e9);
    const baseName = path.basename(originalName, extension).replace(/[^a-zA-Z0-9]/g, '-');
    return `${baseName}-${timestamp}-${randomSuffix}${extension}`;
  }

  private getStoragePath(category: string, manuscriptId?: string, filename?: string): string {
    const parts = [this.config.basePath.replace(/^\/+|\/+$/g, ''), category];
    if (manuscriptId) parts.push(manuscriptId);
    if (filename) parts.push(filename);
    return parts.join('/');
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

      if (!fs.existsSync(directory)) {
        fs.mkdirSync(directory, { recursive: true });
      }

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
    } catch {
      return false;
    }
  }

  private async copyFileLocal(sourcePath: string, destPath: string): Promise<boolean> {
    try {
      const fullSourcePath = path.resolve(sourcePath);
      const fullDestPath = path.resolve(destPath);
      const destDir = path.dirname(fullDestPath);

      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }

      fs.copyFileSync(fullSourcePath, fullDestPath);
      return true;
    } catch (error) {
      console.error('Local file copy error:', error);
      return false;
    }
  }

  // S3 storage implementation
  private async storeFileS3(
    buffer: Buffer,
    storagePath: string,
    contentType: string
  ): Promise<boolean> {
    if (!this.s3Client || !this.config.s3) {
      console.error('S3 client not initialized');
      return false;
    }

    try {
      const upload = new Upload({
        client: this.s3Client,
        params: {
          Bucket: this.config.s3.bucket,
          Key: storagePath,
          Body: buffer,
          ContentType: contentType,
        },
      });

      await upload.done();
      return true;
    } catch (error) {
      console.error('S3 upload error:', error);
      return false;
    }
  }

  private async getFileStreamS3(storagePath: string): Promise<NodeJS.ReadableStream | null> {
    if (!this.s3Client || !this.config.s3) {
      console.error('S3 client not initialized');
      return null;
    }

    try {
      const command = new GetObjectCommand({
        Bucket: this.config.s3.bucket,
        Key: storagePath,
      });

      const response = await this.s3Client.send(command);
      return response.Body as Readable;
    } catch (error) {
      console.error('S3 file read error:', error);
      return null;
    }
  }

  private async deleteFileS3(storagePath: string): Promise<boolean> {
    if (!this.s3Client || !this.config.s3) {
      console.error('S3 client not initialized');
      return false;
    }

    try {
      const command = new DeleteObjectCommand({
        Bucket: this.config.s3.bucket,
        Key: storagePath,
      });

      await this.s3Client.send(command);
      return true;
    } catch (error) {
      console.error('S3 file delete error:', error);
      return false;
    }
  }

  private async fileExistsS3(storagePath: string): Promise<boolean> {
    if (!this.s3Client || !this.config.s3) {
      return false;
    }

    try {
      const command = new HeadObjectCommand({
        Bucket: this.config.s3.bucket,
        Key: storagePath,
      });

      await this.s3Client.send(command);
      return true;
    } catch {
      return false;
    }
  }

  private async copyFileS3(sourcePath: string, destPath: string): Promise<boolean> {
    if (!this.s3Client || !this.config.s3) {
      return false;
    }

    try {
      const stream = await this.getFileStreamS3(sourcePath);
      if (!stream) return false;

      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(Buffer.from(chunk));
      }
      const buffer = Buffer.concat(chunks);

      return this.storeFileS3(buffer, destPath, 'application/octet-stream');
    } catch (error) {
      console.error('S3 file copy error:', error);
      return false;
    }
  }

  // GCS storage implementation
  private async storeFileGCS(
    buffer: Buffer,
    storagePath: string,
    contentType: string
  ): Promise<boolean> {
    if (!this.gcsBucket) {
      console.error('GCS bucket not initialized');
      return false;
    }

    try {
      const file = this.gcsBucket.file(storagePath);
      await file.save(buffer, {
        contentType,
        resumable: buffer.length > 5 * 1024 * 1024,
      });
      return true;
    } catch (error) {
      console.error('GCS upload error:', error);
      return false;
    }
  }

  private async getFileStreamGCS(storagePath: string): Promise<NodeJS.ReadableStream | null> {
    if (!this.gcsBucket) {
      console.error('GCS bucket not initialized');
      return null;
    }

    try {
      const file = this.gcsBucket.file(storagePath);
      const [exists] = await file.exists();
      if (!exists) {
        return null;
      }
      return file.createReadStream();
    } catch (error) {
      console.error('GCS file read error:', error);
      return null;
    }
  }

  private async deleteFileGCS(storagePath: string): Promise<boolean> {
    if (!this.gcsBucket) {
      console.error('GCS bucket not initialized');
      return false;
    }

    try {
      const file = this.gcsBucket.file(storagePath);
      await file.delete({ ignoreNotFound: true });
      return true;
    } catch (error) {
      console.error('GCS file delete error:', error);
      return false;
    }
  }

  private async fileExistsGCS(storagePath: string): Promise<boolean> {
    if (!this.gcsBucket) {
      return false;
    }

    try {
      const file = this.gcsBucket.file(storagePath);
      const [exists] = await file.exists();
      return exists;
    } catch {
      return false;
    }
  }

  private async copyFileGCS(sourcePath: string, destPath: string): Promise<boolean> {
    if (!this.gcsBucket) {
      return false;
    }

    try {
      const sourceFile = this.gcsBucket.file(sourcePath);
      const destFile = this.gcsBucket.file(destPath);
      await sourceFile.copy(destFile);
      return true;
    } catch (error) {
      console.error('GCS file copy error:', error);
      return false;
    }
  }
}

export const fileStorage = new FileStorageService();
