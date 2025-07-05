import { Request, Response, NextFunction } from 'express';
import { verifyJWT, generateJWT, Permission, GlobalPermission, GlobalRole, hasPermission, hasGlobalPermission } from '@colloquium/auth';
import { prisma } from '@colloquium/database';

// Extend Express Request to include user and bot context
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        name: string | null;
        role: GlobalRole;
        orcidId: string | null;
        createdAt: Date;
      };
      botContext?: {
        botId: string;
        manuscriptId: string;
        permissions: string[];
        type: 'BOT_SERVICE_TOKEN';
      };
    }
  }
}

export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Get token from cookie or Authorization header
    const token = req.cookies['auth-token'] || 
                  (req.headers.authorization?.startsWith('Bearer ') ? 
                   req.headers.authorization.slice(7) : null);

    if (!token) {
      return res.status(401).json({
        error: 'Not Authenticated',
        message: 'No authentication token provided'
      });
    }

    try {
      const payload = verifyJWT(token);
      
      // Get fresh user data from database
      const user = await prisma.users.findUnique({
        where: { id: payload.userId },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          orcidId: true,
          createdAt: true
        }
      });

      if (!user) {
        return res.status(401).json({
          error: 'User Not Found',
          message: 'User account no longer exists'
        });
      }

      // Add user to request object (cast role to match auth package enum)
      req.user = {
        ...user,
        role: user.role as GlobalRole
      };
      console.log(`DEBUG: Authenticated user - email: ${user.email}, role: ${user.role}`);
      next();
    } catch (jwtError) {
      return res.status(401).json({
        error: 'Invalid Token',
        message: 'Authentication token is invalid or expired'
      });
    }
  } catch (error) {
    next(error);
  }
};

export const requirePermission = (permission: Permission) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Not Authenticated',
        message: 'Authentication required'
      });
    }

    if (!hasPermission(req.user.role, permission)) {
      return res.status(403).json({
        error: 'Insufficient Permissions',
        message: `This action requires ${permission} permission`
      });
    }

    next();
  };
};

export const requireGlobalPermission = (permission: GlobalPermission) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Not Authenticated',
        message: 'Authentication required'
      });
    }

    if (!hasGlobalPermission(req.user.role, permission)) {
      return res.status(403).json({
        error: 'Insufficient Permissions',
        message: `This action requires ${permission} permission`
      });
    }

    next();
  };
};

export const requireRole = (role: GlobalRole) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Not Authenticated',
        message: 'Authentication required'
      });
    }

    if (req.user.role !== role) {
      return res.status(403).json({
        error: 'Insufficient Permissions',
        message: `This action requires ${role} role`
      });
    }

    next();
  };
};

export const requireAnyRole = (roles: GlobalRole[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Not Authenticated',
        message: 'Authentication required'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Insufficient Permissions',
        message: `This action requires one of: ${roles.join(', ')}`
      });
    }

    next();
  };
};

// Optional authentication - doesn't fail if no token provided
export const optionalAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.cookies['auth-token'] || 
                  (req.headers.authorization?.startsWith('Bearer ') ? 
                   req.headers.authorization.slice(7) : null);

    if (token) {
      try {
        const payload = verifyJWT(token);
        
        const user = await prisma.users.findUnique({
          where: { id: payload.userId },
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            orcidId: true,
            createdAt: true
          }
        });

        if (user) {
          req.user = {
            ...user,
            role: user.role as GlobalRole
          };
        }
      } catch (jwtError) {
        // Ignore invalid tokens for optional auth
      }
    }

    next();
  } catch (error) {
    next(error);
  }
};

// Alias for authenticate for convenience
export const requireAuth = authenticate;

// Bot service token generation
export function generateBotServiceToken(botId: string, manuscriptId: string, permissions: string[] = []): string {
  return generateJWT({
    userId: `bot-${botId}`,
    email: `${botId}@colloquium.bot`,
    role: 'BOT',
    botId,
    manuscriptId,
    permissions,
    type: 'BOT_SERVICE_TOKEN'
  });
}

// Bot service token verification
function verifyBotServiceToken(token: string): any {
  try {
    const payload = verifyJWT(token);
    if (payload.type !== 'BOT_SERVICE_TOKEN') {
      throw new Error('Invalid token type');
    }
    return payload;
  } catch (error) {
    throw new Error('Invalid bot service token');
  }
}

// Authentication middleware that supports both user and bot tokens
export const authenticateWithBots = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Check for bot service token first
    const botToken = req.headers['x-bot-token'] as string;
    if (botToken) {
      try {
        const botPayload = verifyBotServiceToken(botToken);
        req.botContext = {
          botId: botPayload.botId,
          manuscriptId: botPayload.manuscriptId,
          permissions: botPayload.permissions || [],
          type: 'BOT_SERVICE_TOKEN'
        };
        console.log(`DEBUG: Authenticated bot - botId: ${botPayload.botId}, manuscriptId: ${botPayload.manuscriptId}`);
        return next();
      } catch (botError) {
        return res.status(401).json({
          error: 'Invalid Bot Token',
          message: 'Bot service token is invalid or expired'
        });
      }
    }

    // Fallback to regular user authentication
    return authenticate(req, res, next);
  } catch (error) {
    next(error);
  }
};