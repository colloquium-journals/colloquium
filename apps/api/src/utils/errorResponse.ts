import { Response } from 'express';

export function errorResponse(res: Response, status: number, error: string, message: string) {
  return res.status(status).json({ error, message });
}

export const errors = {
  notFound: (res: Response, message: string) => errorResponse(res, 404, 'Not Found', message),
  forbidden: (res: Response, message: string) => errorResponse(res, 403, 'Forbidden', message),
  validation: (res: Response, message: string) => errorResponse(res, 400, 'Validation Error', message),
  conflict: (res: Response, message: string) => errorResponse(res, 409, 'Conflict', message),
  unauthorized: (res: Response, message: string) => errorResponse(res, 401, 'Unauthorized', message),
};
