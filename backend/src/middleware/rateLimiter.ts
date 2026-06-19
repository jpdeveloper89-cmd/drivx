import rateLimit from 'express-rate-limit';
import { config } from '../config/env';
import { Request } from 'express';

/**
 * Public rate limiter: 100 requests per 15 minutes
 * Applied to unauthenticated endpoints
 */
export const publicRateLimiter = rateLimit({
  windowMs: config.rateLimits.public.windowMs,
  max: config.rateLimits.public.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: Math.ceil(config.rateLimits.public.windowMs / 1000),
  },
  keyGenerator: (req: Request) => req.ip || 'unknown',
});

/**
 * Authenticated rate limiter: 1000 requests per 15 minutes
 * Applied to authenticated driver endpoints
 */
export const authenticatedRateLimiter = rateLimit({
  windowMs: config.rateLimits.authenticated.windowMs,
  max: config.rateLimits.authenticated.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Rate limit exceeded for authenticated user.',
    retryAfter: Math.ceil(config.rateLimits.authenticated.windowMs / 1000),
  },
  keyGenerator: (req: Request) => {
    // Use user ID if available, otherwise fall back to IP
    return (req as any).userId || req.ip || 'unknown';
  },
});

/**
 * Business rate limiter: 5000 requests per 15 minutes
 * Applied to business/insurer API endpoints
 */
export const businessRateLimiter = rateLimit({
  windowMs: config.rateLimits.business.windowMs,
  max: config.rateLimits.business.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Rate limit exceeded for business tier.',
    retryAfter: Math.ceil(config.rateLimits.business.windowMs / 1000),
  },
  keyGenerator: (req: Request) => {
    // Use API key or business ID if available
    return (req as any).apiKey || (req as any).businessId || req.ip || 'unknown';
  },
});
