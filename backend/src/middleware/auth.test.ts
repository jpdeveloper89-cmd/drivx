import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import {
  authenticate,
  authorize,
  optionalAuth,
  generateToken,
  AuthenticatedRequest,
  JWTPayload,
} from './auth';
import { config } from '../config/env';

function createMockRequest(overrides: Partial<Request> = {}): AuthenticatedRequest {
  return {
    headers: {},
    ...overrides,
  } as AuthenticatedRequest;
}

function createMockResponse(): Response {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
  return res;
}

describe('authenticate middleware', () => {
  const next: NextFunction = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should reject requests without Authorization header', () => {
    const req = createMockRequest();
    const res = createMockResponse();

    authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('Authentication required') })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('should reject requests with non-Bearer token', () => {
    const req = createMockRequest({
      headers: { authorization: 'Basic abc123' } as any,
    });
    const res = createMockResponse();

    authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('should reject requests with invalid token', () => {
    const req = createMockRequest({
      headers: { authorization: 'Bearer invalid-token' } as any,
    });
    const res = createMockResponse();

    authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Invalid token.' })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('should reject expired tokens', () => {
    const expiredToken = jwt.sign(
      { userId: 'user-1', role: 'Driver' },
      config.jwt.secret,
      { expiresIn: '0s' }
    );
    const req = createMockRequest({
      headers: { authorization: `Bearer ${expiredToken}` } as any,
    });
    const res = createMockResponse();

    // Small delay to ensure token is expired
    authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('expired') })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('should accept valid tokens and attach user to request', () => {
    const payload: Omit<JWTPayload, 'iat' | 'exp'> = {
      userId: 'user-123',
      walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
      role: 'Driver',
    };
    const token = generateToken(payload);
    const req = createMockRequest({
      headers: { authorization: `Bearer ${token}` } as any,
    });
    const res = createMockResponse();

    authenticate(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user).toBeDefined();
    expect(req.user!.userId).toBe('user-123');
    expect(req.user!.role).toBe('Driver');
    expect(req.userId).toBe('user-123');
  });
});

describe('authorize middleware', () => {
  const next: NextFunction = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should reject requests without user context', () => {
    const req = createMockRequest() as AuthenticatedRequest;
    const res = createMockResponse();

    const middleware = authorize('Driver');
    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('should reject users with insufficient role', () => {
    const req = createMockRequest() as AuthenticatedRequest;
    req.user = { userId: 'user-1', role: 'Driver' };
    const res = createMockResponse();

    const middleware = authorize('Admin', 'Insurer');
    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('Access denied') })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('should allow users with matching role', () => {
    const req = createMockRequest() as AuthenticatedRequest;
    req.user = { userId: 'user-1', role: 'Driver' };
    const res = createMockResponse();

    const middleware = authorize('Driver', 'Admin');
    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('should allow Admin role when Admin is in allowed roles', () => {
    const req = createMockRequest() as AuthenticatedRequest;
    req.user = { userId: 'admin-1', role: 'Admin' };
    const res = createMockResponse();

    const middleware = authorize('Business', 'Admin');
    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
  });
});

describe('optionalAuth middleware', () => {
  const next: NextFunction = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should proceed without user when no token provided', () => {
    const req = createMockRequest() as AuthenticatedRequest;
    const res = createMockResponse();

    optionalAuth(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user).toBeUndefined();
  });

  it('should attach user when valid token provided', () => {
    const token = generateToken({ userId: 'user-1', role: 'Driver' });
    const req = createMockRequest({
      headers: { authorization: `Bearer ${token}` } as any,
    }) as AuthenticatedRequest;
    const res = createMockResponse();

    optionalAuth(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user).toBeDefined();
    expect(req.user!.userId).toBe('user-1');
  });

  it('should proceed without user when invalid token provided', () => {
    const req = createMockRequest({
      headers: { authorization: 'Bearer invalid-token' } as any,
    }) as AuthenticatedRequest;
    const res = createMockResponse();

    optionalAuth(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user).toBeUndefined();
  });
});

describe('generateToken', () => {
  it('should generate a valid JWT token', () => {
    const token = generateToken({ userId: 'user-1', role: 'Driver' });

    expect(token).toBeDefined();
    expect(typeof token).toBe('string');

    const decoded = jwt.verify(token, config.jwt.secret) as JWTPayload;
    expect(decoded.userId).toBe('user-1');
    expect(decoded.role).toBe('Driver');
  });

  it('should include wallet address when provided', () => {
    const token = generateToken({
      userId: 'user-1',
      walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
      role: 'Driver',
    });

    const decoded = jwt.verify(token, config.jwt.secret) as JWTPayload;
    expect(decoded.walletAddress).toBe('0x1234567890abcdef1234567890abcdef12345678');
  });

  it('should set expiration based on config', () => {
    const token = generateToken({ userId: 'user-1', role: 'Driver' });
    const decoded = jwt.decode(token) as JWTPayload;

    expect(decoded.exp).toBeDefined();
    expect(decoded.iat).toBeDefined();
    // 30 minutes = 1800 seconds
    expect(decoded.exp! - decoded.iat!).toBe(1800);
  });
});
