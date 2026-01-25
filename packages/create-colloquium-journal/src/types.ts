export type DeploymentType = 'docker' | 'aws' | 'gcp';

export interface JournalConfig {
  name: string;
  slug: string;
  description?: string;
  domain?: string;

  adminEmail: string;
  adminName: string;

  selectedBots: string[];

  dbPassword: string;
  dbName: string;

  jwtSecret: string;
  magicLinkSecret: string;

  deploymentType: DeploymentType;

  instanceId: string;
  createdAt: string;

  aws?: AWSConfig;
  gcp?: GCPConfig;
}

export interface AWSConfig {
  region: string;
  dbInstanceClass: string;
  certificateArn?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpFrom?: string;
}

export interface GCPConfig {
  projectId: string;
  region: string;
  dbTier: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpFrom?: string;
}

export interface DeploymentConfig {
  type: DeploymentType;
  services: ContainerSpec[];
  volumes: VolumeSpec[];
  networks?: NetworkSpec[];
}

export interface ContainerSpec {
  name: string;
  image: string;
  ports: string[];
  environment: Record<string, string>;
  volumes?: string[];
  dependsOn?: string[];
}

export interface VolumeSpec {
  name: string;
  driver?: string;
}

export interface NetworkSpec {
  name: string;
  driver?: string;
}

export interface TemplateContext {
  JOURNAL_NAME: string;
  JOURNAL_SLUG: string;
  JOURNAL_DESCRIPTION: string;
  JOURNAL_DOMAIN: string;

  ADMIN_EMAIL: string;
  ADMIN_NAME: string;

  DB_PASSWORD: string;
  DB_NAME: string;

  JWT_SECRET: string;
  MAGIC_LINK_SECRET: string;

  SELECTED_BOTS: string;

  INSTANCE_ID: string;
  CREATED_AT: string;
}

export interface AvailableBot {
  id: string;
  name: string;
  description: string;
  category: string;
  isDefault: boolean;
}

export interface CloudTemplateContext extends TemplateContext {
  AWS_REGION?: string;
  AWS_DB_INSTANCE_CLASS?: string;
  AWS_CERTIFICATE_ARN?: string;

  GCP_PROJECT_ID?: string;
  GCP_REGION?: string;
  GCP_DB_TIER?: string;

  SMTP_HOST?: string;
  SMTP_PORT?: string;
  SMTP_USER?: string;
  SMTP_FROM?: string;
}
