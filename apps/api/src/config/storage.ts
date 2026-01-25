import { StorageType } from '@prisma/client';

export interface LocalStorageConfig {
  uploadsDir: string;
}

export interface S3StorageConfig {
  bucket: string;
  region: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  endpoint?: string;
  forcePathStyle?: boolean;
}

export interface GCSStorageConfig {
  bucket: string;
  projectId?: string;
  keyFilename?: string;
  credentials?: {
    client_email: string;
    private_key: string;
  };
}

export interface StorageConfiguration {
  type: StorageType;
  basePath: string;
  maxFileSize: number;
  publicBaseUrl?: string;
  local?: LocalStorageConfig;
  s3?: S3StorageConfig;
  gcs?: GCSStorageConfig;
}

export function createStorageConfig(): StorageConfiguration {
  const storageType = (process.env.STORAGE_TYPE as StorageType) || StorageType.LOCAL;
  const maxFileSize = parseInt(process.env.MAX_FILE_SIZE || '50') * 1024 * 1024;

  const baseConfig: StorageConfiguration = {
    type: storageType,
    basePath: process.env.STORAGE_BASE_PATH || 'uploads/',
    maxFileSize,
    publicBaseUrl: process.env.PUBLIC_ASSET_BASE_URL,
  };

  switch (storageType) {
    case StorageType.LOCAL:
      return {
        ...baseConfig,
        local: {
          uploadsDir: process.env.UPLOADS_DIR || 'uploads/',
        },
      };

    case StorageType.S3:
      if (!process.env.AWS_S3_BUCKET) {
        throw new Error('AWS_S3_BUCKET environment variable is required for S3 storage');
      }
      return {
        ...baseConfig,
        s3: {
          bucket: process.env.AWS_S3_BUCKET,
          region: process.env.AWS_REGION || 'us-east-1',
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
          endpoint: process.env.AWS_S3_ENDPOINT,
          forcePathStyle: process.env.AWS_S3_FORCE_PATH_STYLE === 'true',
        },
        publicBaseUrl: process.env.PUBLIC_ASSET_BASE_URL ||
          `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com`,
      };

    case StorageType.GCS:
      if (!process.env.GCS_BUCKET) {
        throw new Error('GCS_BUCKET environment variable is required for GCS storage');
      }
      const gcsConfig: GCSStorageConfig = {
        bucket: process.env.GCS_BUCKET,
        projectId: process.env.GCP_PROJECT_ID,
      };

      if (process.env.GCS_KEY_FILENAME) {
        gcsConfig.keyFilename = process.env.GCS_KEY_FILENAME;
      } else if (process.env.GCS_CLIENT_EMAIL && process.env.GCS_PRIVATE_KEY) {
        gcsConfig.credentials = {
          client_email: process.env.GCS_CLIENT_EMAIL,
          private_key: process.env.GCS_PRIVATE_KEY.replace(/\\n/g, '\n'),
        };
      }

      return {
        ...baseConfig,
        gcs: gcsConfig,
        publicBaseUrl: process.env.PUBLIC_ASSET_BASE_URL ||
          `https://storage.googleapis.com/${process.env.GCS_BUCKET}`,
      };

    default:
      throw new Error(`Unsupported storage type: ${storageType}`);
  }
}

export const storageConfig = createStorageConfig();
