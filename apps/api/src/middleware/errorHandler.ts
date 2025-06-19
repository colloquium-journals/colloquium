import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';

export interface ApiError extends Error {
  statusCode?: number;
  isOperational?: boolean;
  details?: any[];
}

export const errorHandler = (
  err: ApiError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Default error status and message
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';
  let details = err.details;

  // Handle Zod validation errors
  if (err instanceof ZodError) {
    statusCode = 400;
    message = 'Validation Error';
    details = err.errors.map(error => ({
      field: error.path.join('.'),
      message: error.message,
      code: error.code,
      ...('received' in error && error.received !== undefined && { received: error.received })
    }));
    
    return res.status(statusCode).json({
      error: {
        message,
        details,
        type: 'ValidationError'
      }
    });
  }

  // Handle Prisma errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case 'P2002':
        statusCode = 409;
        message = 'Resource already exists';
        details = [{ field: err.meta?.target, message: 'Value must be unique' }];
        break;
      case 'P2025':
        statusCode = 404;
        message = 'Resource not found';
        break;
      case 'P2003':
        statusCode = 400;
        message = 'Invalid reference';
        details = [{ field: err.meta?.field_name, message: 'Referenced record does not exist' }];
        break;
      default:
        statusCode = 400;
        message = 'Database operation failed';
        break;
    }
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    statusCode = 400;
    message = 'Invalid data provided';
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
  }

  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
  }

  // Handle custom validation errors
  if (err.name === 'ValidationError') {
    statusCode = err.statusCode || 400;
    message = err.message;
    details = err.details;
    
    return res.status(statusCode).json({
      error: {
        message,
        type: 'ValidationError',
        details
      }
    });
  }

  // Handle file upload errors
  if (err.name === 'MulterError') {
    statusCode = 400;
    switch (err.message) {
      case 'File too large':
        message = 'File size exceeds the maximum allowed size';
        break;
      case 'Too many files':
        message = 'Too many files uploaded';
        break;
      default:
        message = 'File upload error';
        break;
    }
  }

  // Log error details for debugging
  if (process.env.NODE_ENV === 'development') {
    console.error('Error Details:', {
      name: err.name,
      message: err.message,
      statusCode,
      stack: err.stack,
      details
    });
  } else {
    // In production, log errors to a proper logging service
    console.error(`[${new Date().toISOString()}] ${err.name}: ${err.message}`, {
      statusCode,
      url: req.url,
      method: req.method,
      userId: (req as any).user?.id
    });
  }

  // Send error response
  res.status(statusCode).json({
    error: {
      message,
      type: err.name || 'Error',
      ...(details && { details }),
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    }
  });
};