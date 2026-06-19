import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';

/**
 * Roles supported by the SafeDrive Protocol
 */
export type UserRole = 'Driver' | 'Business' | 'Insurer' | 'Admin' | 'Public';

/**
 * JWT payload structure
 */
export interface JWTPayload {
  userId: string;
  walletAddress?: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

/**
 * Extended Request interface with authenticated user data
 */
export interface AuthenticatedRequest extends Request {
  user?: JWTPayload;
  userId?: string;
}

/**
 * JWT Authentication Middleware
 * Validates JWT token from Authorization header (Bearer scheme).
 * Enforces 30-minute session timeout via token expiration.
 */
export function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required. Provide a valid Bearer token.' });
    return;
  }

  const token = authHeader.slice(7);

  try {
    const decoded = jwt.verify(token, config.jwt.secret) as JWTPayload;
    req.user = decoded;
    req.userId = decoded.userId;
    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      res.status(401).json({ error: 'Session expired. Please log in again.' });
      return;
    }
    if (err instanceof jwt.JsonWebTokenError) {
      res.status(401).json({ error: 'Invalid token.' });
      return;
    }
    res.status(401).json({ error: 'Authentication failed.' });
  }
}

/**
 * Role-Based Access Control Middleware
 * Restricts access to routes based on user roles.
 * Must be used after the `authenticate` middleware.
 *
 * @param allowedRoles - Array of roles permitted to access the route
 */
export function authorize(...allowedRoles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        error: 'Access denied. Insufficient permissions.',
        requiredRoles: allowedRoles,
      });
      return;
    }

    next();
  };
}

/**
 * Generate a JWT token for a user.
 * Token expires in 30 minutes (configurable via JWT_EXPIRES_IN env var).
 */
export function generateToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
  });
}

/**
 * Optional authentication middleware.
 * Attaches user data if a valid token is present, but does not reject unauthenticated requests.
 * Useful for routes accessible by both authenticated and public users.
 */
export function optionalAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    next();
    return;
  }

  const token = authHeader.slice(7);

  try {
    const decoded = jwt.verify(token, config.jwt.secret) as JWTPayload;
    req.user = decoded;
    req.userId = decoded.userId;
  } catch {
    // Token invalid or expired — proceed without user context
  }

  next();
}
