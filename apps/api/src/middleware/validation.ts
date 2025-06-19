import { Request, Response, NextFunction } from 'express';
import { z, ZodError } from 'zod';

export interface ValidationError extends Error {
  statusCode: number;
  isOperational: boolean;
  details: any[];
}

export function validateRequest(schema: {
  body?: z.ZodType<any>;
  query?: z.ZodType<any>;
  params?: z.ZodType<any>;
}) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // Validate request body
      if (schema.body && req.body) {
        req.body = schema.body.parse(req.body);
      }

      // Validate query parameters
      if (schema.query && req.query) {
        req.query = schema.query.parse(req.query);
      }

      // Validate route parameters
      if (schema.params && req.params) {
        req.params = schema.params.parse(req.params);
      }

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError: ValidationError = {
          name: 'ValidationError',
          message: 'Validation Error',
          statusCode: 400,
          isOperational: true,
          details: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
            code: err.code,
            ...('received' in err && err.received !== undefined && { received: err.received })
          })),
          stack: error.stack
        };
        
        return next(validationError);
      }
      
      next(error);
    }
  };
}

// Utility function to create standardized error responses
export function createValidationErrorResponse(error: ZodError) {
  return {
    error: {
      message: 'Validation failed',
      type: 'ValidationError',
      details: error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message,
        code: err.code,
        ...('received' in err && err.received !== undefined && { received: err.received })
      }))
    }
  };
}

// Middleware to handle async route errors
export function asyncHandler(fn: Function) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// Middleware to validate file uploads
export function validateFileUpload(options: {
  maxSize?: number;
  allowedTypes?: string[];
  required?: boolean;
}) {
  return (req: Request, res: Response, next: NextFunction) => {
    const { maxSize = 50 * 1024 * 1024, allowedTypes = [], required = false } = options;
    
    if (!req.file && !req.files) {
      if (required) {
        return res.status(400).json({
          error: {
            message: 'File upload is required',
            type: 'ValidationError'
          }
        });
      }
      return next();
    }

    const files = req.files ? (Array.isArray(req.files) ? req.files : Object.values(req.files).flat()) : [req.file];
    
    for (const file of files) {
      if (!file) continue;
      
      // Check file size
      if (file.size > maxSize) {
        return res.status(400).json({
          error: {
            message: `File size exceeds maximum allowed size of ${maxSize / (1024 * 1024)}MB`,
            type: 'ValidationError',
            details: [{ field: 'file', message: 'File too large', received: file.size }]
          }
        });
      }

      // Check file type
      if (allowedTypes.length > 0) {
        const fileExtension = file.originalname.split('.').pop()?.toLowerCase();
        const mimeType = file.mimetype.toLowerCase();
        
        const isAllowedExtension = allowedTypes.includes(fileExtension || '');
        const isAllowedMimeType = allowedTypes.some(type => mimeType.includes(type));
        
        if (!isAllowedExtension && !isAllowedMimeType) {
          return res.status(400).json({
            error: {
              message: `File type not allowed. Allowed types: ${allowedTypes.join(', ')}`,
              type: 'ValidationError',
              details: [{ field: 'file', message: 'Invalid file type', received: fileExtension || mimeType }]
            }
          });
        }
      }
    }

    next();
  };
}