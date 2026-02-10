import { Request, Response, NextFunction } from 'express';

export function requireBotPermission(...permissions: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.botContext) {
      return next();
    }
    for (const perm of permissions) {
      if (!req.botContext.permissions.includes(perm)) {
        return res.status(403).json({ error: `Missing permission: ${perm}` });
      }
    }
    next();
  };
}

export function requireBotOnly(req: Request, res: Response): { botId: string; manuscriptId: string } | null {
  if (!req.botContext) {
    res.status(401).json({ error: 'Bot authentication required' });
    return null;
  }
  return { botId: req.botContext.botId, manuscriptId: req.botContext.manuscriptId };
}
