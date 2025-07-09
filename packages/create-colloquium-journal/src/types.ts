export interface JournalConfig {
  // Journal details
  name: string;
  slug: string;
  description?: string;
  domain?: string;
  
  // Admin setup
  adminEmail: string;
  adminName: string;
  
  // Bot selection
  selectedBots: string[];
  
  // Database configuration
  dbPassword: string;
  dbName: string;
  
  // Security
  jwtSecret: string;
  magicLinkSecret: string;
  
  // Deployment configuration
  deploymentType: 'docker';
  
  // Generated values
  instanceId: string;
  createdAt: string;
}

export interface DeploymentConfig {
  type: 'docker';
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
  // Journal configuration
  JOURNAL_NAME: string;
  JOURNAL_SLUG: string;
  JOURNAL_DESCRIPTION: string;
  JOURNAL_DOMAIN: string;
  
  // Admin configuration
  ADMIN_EMAIL: string;
  ADMIN_NAME: string;
  
  // Database configuration
  DB_PASSWORD: string;
  DB_NAME: string;
  
  // Security
  JWT_SECRET: string;
  MAGIC_LINK_SECRET: string;
  
  // Bot configuration
  SELECTED_BOTS: string;
  
  // Instance metadata
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