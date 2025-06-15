import { Request, Response, NextFunction } from 'express';
import { verifyJWT, Permission, Role, hasPermission } from '@colloquium/auth';
import { prisma } from '@colloquium/database';

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        name: string | null;
        role: Role;
        orcidId: string | null;
        createdAt: Date;
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
      const user = await prisma.user.findUnique({
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

      // Add user to request object
      req.user = user;
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

    if (!hasPermission(req.user.role as Role, permission)) {
      return res.status(403).json({
        error: 'Insufficient Permissions',
        message: `This action requires ${permission} permission`
      });
    }

    next();
  };
};

export const requireRole = (role: Role) => {
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

export const requireAnyRole = (roles: Role[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Not Authenticated',
        message: 'Authentication required'
      });
    }

    if (!roles.includes(req.user.role as Role)) {
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
        
        const user = await prisma.user.findUnique({
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
          req.user = user;
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