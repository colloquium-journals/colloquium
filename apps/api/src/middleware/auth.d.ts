import { Request, Response, NextFunction } from 'express';
import { Permission, GlobalPermission, GlobalRole } from '@colloquium/auth';
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
export declare const authenticate: (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const requirePermission: (permission: Permission) => (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
export declare const requireGlobalPermission: (permission: GlobalPermission) => (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
export declare const requireRole: (role: GlobalRole) => (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
export declare const requireAnyRole: (roles: GlobalRole[]) => (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
export declare const optionalAuth: (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const requireAuth: (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
export declare function generateBotServiceToken(botId: string, manuscriptId: string, permissions?: string[]): string;
export declare const authenticateWithBots: (req: Request, res: Response, next: NextFunction) => Promise<void | Response<any, Record<string, any>>>;
//# sourceMappingURL=auth.d.ts.map