import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validate } from './validation';

function createMockRequest(body: any = {}, query: any = {}, params: any = {}): Request {
  return { body, query, params } as Request;
}

function createMockResponse(): Response {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
  return res;
}

describe('validate middleware', () => {
  const next: NextFunction = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('body validation', () => {
    const schema = z.object({
      email: z.string().email(),
      name: z.string().min(1),
    });

    it('should pass valid body data', () => {
      const req = createMockRequest({ email: 'test@example.com', name: 'John' });
      const res = createMockResponse();

      validate(schema)(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should reject invalid body data with 400 status', () => {
      const req = createMockRequest({ email: 'not-an-email', name: '' });
      const res = createMockResponse();

      validate(schema)(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Validation failed',
          details: expect.arrayContaining([
            expect.objectContaining({ field: 'email' }),
          ]),
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject missing required fields', () => {
      const req = createMockRequest({});
      const res = createMockResponse();

      validate(schema)(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('params validation', () => {
    const paramsSchema = z.object({
      address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
    });

    it('should pass valid params', () => {
      const req = createMockRequest(
        {},
        {},
        { address: '0x1234567890abcdef1234567890abcdef12345678' }
      );
      const res = createMockResponse();

      validate(paramsSchema, 'params')(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should reject invalid params', () => {
      const req = createMockRequest({}, {}, { address: 'not-an-address' });
      const res = createMockResponse();

      validate(paramsSchema, 'params')(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('query validation', () => {
    const querySchema = z.object({
      page: z.string().regex(/^\d+$/),
    });

    it('should pass valid query params', () => {
      const req = createMockRequest({}, { page: '1' }, {});
      const res = createMockResponse();

      validate(querySchema, 'query')(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should reject invalid query params', () => {
      const req = createMockRequest({}, { page: 'abc' }, {});
      const res = createMockResponse();

      validate(querySchema, 'query')(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(next).not.toHaveBeenCalled();
    });
  });
});
