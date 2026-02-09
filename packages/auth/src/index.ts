import jwt from 'jsonwebtoken';
import * as crypto from 'crypto';

// Re-export all client-safe permission utilities
export {
  GlobalPermission,
  ManuscriptPermission,
  GlobalRole,
  GLOBAL_ROLE_PERMISSIONS,
  hasGlobalPermission,
  hasManuscriptPermission
} from './permissions';

// JWT types
export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
  // Bot service token fields
  botId?: string;
  manuscriptId?: string;
  permissions?: string[];
  type?: 'BOT_SERVICE_TOKEN' | 'USER_TOKEN';
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

// Password utilities (for future use)
export async function hashPassword(password: string): Promise<string> {
  const bcrypt = await import('bcrypt');
  return bcrypt.hash(password, 12);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  const bcrypt = await import('bcrypt');
  return bcrypt.compare(password, hash);
}
