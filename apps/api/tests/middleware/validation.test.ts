import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validateRequest, createValidationErrorResponse, asyncHandler, validateFileUpload } from '../../src/middleware/validation';

// Mock Express types
const mockRequest = (overrides = {}) => ({
  body: {},
  query: {},
  params: {},
  ...overrides
} as Request);

const mockResponse = () => {
  const res = {} as Response;
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const mockNext = jest.fn() as NextFunction;

describe('Validation Middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validateRequest', () => {
    const testSchema = {
      body: z.object({
        name: z.string().min(1, 'Name is required'),
        email: z.string().email('Invalid email format')
      }),
      query: z.object({
        page: z.coerce.number().min(1).default(1)
      }),
      params: z.object({
        id: z.string().uuid('Invalid ID format')
      })
    };

    it('should validate and transform valid request data', () => {
      const req = mockRequest({
        body: { name: 'John Doe', email: 'john@example.com' },
        query: { page: '2' },
        params: { id: '123e4567-e89b-12d3-a456-426614174000' }
      });
      const res = mockResponse();
      const middleware = validateRequest(testSchema);

      middleware(req, res, mockNext);

      expect(req.body).toEqual({ name: 'John Doe', email: 'john@example.com' });
      expect(req.query).toEqual({ page: 2 });
      expect(req.params).toEqual({ id: '123e4567-e89b-12d3-a456-426614174000' });
      expect(mockNext).toHaveBeenCalledWith();
      expect(mockNext).toHaveBeenCalledTimes(1);
    });

    it('should handle missing optional schemas', () => {
      const req = mockRequest({
        body: { name: 'John Doe', email: 'john@example.com' }
      });
      const res = mockResponse();
      const middleware = validateRequest({
        body: testSchema.body
      });

      middleware(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should call next with validation error for invalid body', () => {
      const req = mockRequest({
        body: { name: '', email: 'invalid-email' }
      });
      const res = mockResponse();
      const middleware = validateRequest(testSchema);

      middleware(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'ValidationError',
          message: 'Request validation failed',
          statusCode: 400,
          isOperational: true,
          details: expect.arrayContaining([
            expect.objectContaining({
              field: 'name',
              message: 'Name is required'
            }),
            expect.objectContaining({
              field: 'email',
              message: 'Invalid email format'
            })
          ])
        })
      );
    });

    it('should call next with validation error for invalid query params', () => {
      const req = mockRequest({
        body: { name: 'John Doe', email: 'john@example.com' },
        query: { page: 'invalid' },
        params: { id: '123e4567-e89b-12d3-a456-426614174000' }
      });
      const res = mockResponse();
      const middleware = validateRequest(testSchema);

      middleware(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'ValidationError',
          details: expect.arrayContaining([
            expect.objectContaining({
              field: 'page',
              message: expect.stringContaining('Expected number')
            })
          ])
        })
      );
    });

    it('should call next with validation error for invalid params', () => {
      const req = mockRequest({
        body: { name: 'John Doe', email: 'john@example.com' },
        query: { page: '1' },
        params: { id: 'invalid-uuid' }
      });
      const res = mockResponse();
      const middleware = validateRequest(testSchema);

      middleware(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'ValidationError',
          details: expect.arrayContaining([
            expect.objectContaining({
              field: 'id',
              message: 'Invalid ID format'
            })
          ])
        })
      );
    });
  });

  describe('createValidationErrorResponse', () => {
    it('should create standardized error response', () => {
      const schema = z.object({
        name: z.string().min(1, 'Name is required'),
        email: z.string().email('Invalid email')
      });

      try {
        schema.parse({ name: '', email: 'invalid' });
      } catch (error) {
        if (error instanceof z.ZodError) {
          const response = createValidationErrorResponse(error);
          
          expect(response).toEqual({
            error: {
              message: 'Validation failed',
              type: 'ValidationError',
              details: expect.arrayContaining([
                expect.objectContaining({
                  field: 'name',
                  message: 'Name is required',
                  code: 'too_small'
                }),
                expect.objectContaining({
                  field: 'email',
                  message: 'Invalid email',
                  code: 'invalid_string'
                })
              ])
            }
          });
        }
      }
    });
  });

  describe('asyncHandler', () => {
    it('should handle successful async function', async () => {
      const asyncFn = jest.fn().mockResolvedValue('success');
      const handler = asyncHandler(asyncFn);
      const req = mockRequest();
      const res = mockResponse();

      await handler(req, res, mockNext);

      expect(asyncFn).toHaveBeenCalledWith(req, res, mockNext);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should catch and pass async errors to next', async () => {
      const error = new Error('Async error');
      const asyncFn = jest.fn().mockRejectedValue(error);
      const handler = asyncHandler(asyncFn);
      const req = mockRequest();
      const res = mockResponse();

      await handler(req, res, mockNext);

      expect(asyncFn).toHaveBeenCalledWith(req, res, mockNext);
      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('validateFileUpload', () => {
    const createMockFile = (overrides = {}) => ({
      originalname: 'test.pdf',
      mimetype: 'application/pdf',
      size: 1024 * 1024, // 1MB
      ...overrides
    });

    it('should pass validation for valid file', () => {
      const req = mockRequest({
        file: createMockFile()
      });
      const res = mockResponse();
      const middleware = validateFileUpload({
        maxSize: 5 * 1024 * 1024, // 5MB
        allowedTypes: ['pdf', 'application/pdf']
      });

      middleware(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should reject file that is too large', () => {
      const req = mockRequest({
        file: createMockFile({ size: 10 * 1024 * 1024 }) // 10MB
      });
      const res = mockResponse();
      const middleware = validateFileUpload({
        maxSize: 5 * 1024 * 1024 // 5MB
      });

      middleware(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          message: 'File size exceeds maximum allowed size of 5MB',
          type: 'ValidationError',
          details: [{ field: 'file', message: 'File too large', received: 10 * 1024 * 1024 }]
        }
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject file with invalid type', () => {
      const req = mockRequest({
        file: createMockFile({ 
          originalname: 'test.exe',
          mimetype: 'application/octet-stream'
        })
      });
      const res = mockResponse();
      const middleware = validateFileUpload({
        allowedTypes: ['pdf', 'docx']
      });

      middleware(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          message: 'File type not allowed. Allowed types: pdf, docx',
          type: 'ValidationError',
          details: [{ field: 'file', message: 'Invalid file type', received: 'exe' }]
        }
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should require file when required option is true', () => {
      const req = mockRequest(); // No file
      const res = mockResponse();
      const middleware = validateFileUpload({
        required: true
      });

      middleware(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          message: 'File upload is required',
          type: 'ValidationError'
        }
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should pass when no file is provided and not required', () => {
      const req = mockRequest(); // No file
      const res = mockResponse();
      const middleware = validateFileUpload({
        required: false
      });

      middleware(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should handle multiple files', () => {
      const req = mockRequest({
        files: [
          createMockFile({ originalname: 'test1.pdf' }),
          createMockFile({ originalname: 'test2.docx', mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
        ]
      });
      const res = mockResponse();
      const middleware = validateFileUpload({
        allowedTypes: ['pdf', 'docx']
      });

      middleware(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect(res.status).not.toHaveBeenCalled();
    });
  });
});