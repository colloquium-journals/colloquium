import jwt from 'jsonwebtoken';
import * as crypto from 'crypto';

// JWT types
export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

// JWT utilities
export function generateJWT(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required');
  }

  // Default to 7 days in seconds
  const expiresIn = process.env.JWT_EXPIRES_IN ? 
    (process.env.JWT_EXPIRES_IN.endsWith('d') ? 
      parseInt(process.env.JWT_EXPIRES_IN.slice(0, -1)) * 24 * 60 * 60 : 
      parseInt(process.env.JWT_EXPIRES_IN)
    ) : 7 * 24 * 60 * 60;

  return jwt.sign(payload, secret, { expiresIn });
}

export function verifyJWT(token: string): JWTPayload {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required');
  }

  return jwt.verify(token, secret) as JWTPayload;
}

// Magic link utilities
export function generateSecureToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function generateMagicLinkToken(): string {
  const secret = process.env.MAGIC_LINK_SECRET || 'default-secret';
  const timestamp = Date.now().toString();
  const randomBytes = crypto.randomBytes(16).toString('hex');
  
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(timestamp + randomBytes);
  
  return hmac.digest('hex') + '.' + timestamp + '.' + randomBytes;
}

export function verifyMagicLinkToken(token: string): boolean {
  try {
    const secret = process.env.MAGIC_LINK_SECRET || 'default-secret';
    const [hash, timestamp, randomBytes] = token.split('.');
    
    if (!hash || !timestamp || !randomBytes) {
      return false;
    }

    // Check if token is expired (15 minutes)
    const tokenTime = parseInt(timestamp);
    const now = Date.now();
    const fifteenMinutes = 15 * 60 * 1000;
    
    if (now - tokenTime > fifteenMinutes) {
      return false;
    }

    // Verify hash
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(timestamp + randomBytes);
    const expectedHash = hmac.digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(hash, 'hex'),
      Buffer.from(expectedHash, 'hex')
    );
  } catch (error) {
    return false;
  }
}

// Password utilities (for future use)
export async function hashPassword(password: string): Promise<string> {
  const bcrypt = await import('bcrypt');
  return bcrypt.hash(password, 12);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  const bcrypt = await import('bcrypt');
  return bcrypt.compare(password, hash);
}

// Role-based access control
export enum Permission {
  READ_MANUSCRIPT = 'read_manuscript',
  EDIT_MANUSCRIPT = 'edit_manuscript',
  SUBMIT_MANUSCRIPT = 'submit_manuscript',
  DELETE_MANUSCRIPT = 'delete_manuscript',
  CREATE_CONVERSATION = 'create_conversation',
  MODERATE_CONVERSATION = 'moderate_conversation',
  ASSIGN_REVIEWERS = 'assign_reviewers',
  MAKE_EDITORIAL_DECISIONS = 'make_editorial_decisions',
  INSTALL_BOTS = 'install_bots',
  MANAGE_BOTS = 'manage_bots',
  MANAGE_SETTINGS = 'manage_settings',
  MANAGE_USERS = 'manage_users'
}

export enum Role {
  AUTHOR = 'AUTHOR',
  REVIEWER = 'REVIEWER',
  EDITOR = 'EDITOR',
  ADMIN = 'ADMIN'
}

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  [Role.AUTHOR]: [
    Permission.READ_MANUSCRIPT,
    Permission.EDIT_MANUSCRIPT,
    Permission.SUBMIT_MANUSCRIPT,
    Permission.CREATE_CONVERSATION
  ],
  [Role.REVIEWER]: [
    Permission.READ_MANUSCRIPT,
    Permission.CREATE_CONVERSATION
  ],
  [Role.EDITOR]: [
    Permission.READ_MANUSCRIPT,
    Permission.EDIT_MANUSCRIPT,
    Permission.CREATE_CONVERSATION,
    Permission.MODERATE_CONVERSATION,
    Permission.ASSIGN_REVIEWERS,
    Permission.MAKE_EDITORIAL_DECISIONS
  ],
  [Role.ADMIN]: [
    Permission.READ_MANUSCRIPT,
    Permission.EDIT_MANUSCRIPT,
    Permission.SUBMIT_MANUSCRIPT,
    Permission.DELETE_MANUSCRIPT,
    Permission.CREATE_CONVERSATION,
    Permission.MODERATE_CONVERSATION,
    Permission.ASSIGN_REVIEWERS,
    Permission.MAKE_EDITORIAL_DECISIONS,
    Permission.INSTALL_BOTS,
    Permission.MANAGE_BOTS,
    Permission.MANAGE_SETTINGS,
    Permission.MANAGE_USERS
  ]
};

export function hasPermission(userRole: Role, permission: Permission): boolean {
  const rolePermissions = ROLE_PERMISSIONS[userRole];
  return rolePermissions.includes(permission);
}

export function hasAnyPermission(userRole: Role, permissions: Permission[]): boolean {
  return permissions.some(permission => hasPermission(userRole, permission));
}

export function hasAllPermissions(userRole: Role, permissions: Permission[]): boolean {
  return permissions.every(permission => hasPermission(userRole, permission));
}