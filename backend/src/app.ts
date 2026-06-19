import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config/env';
import { publicRateLimiter } from './middleware/rateLimiter';
import { healthRouter } from './routes/health';
import { apiRouter } from './routes/api';

const app = express();

// Security middleware
app.use(helmet());

// CORS configuration
app.use(
  cors({
    origin: config.cors.origins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
    maxAge: 86400, // 24 hours preflight cache
  })
);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Apply public rate limiter globally (overridden per-route for authenticated/business)
app.use(publicRateLimiter);

// Routes
app.use('/health', healthRouter);
app.use('/api/v1', apiRouter);

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' });
});

// Global error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({
    error: config.server.nodeEnv === 'production'
      ? 'Internal server error'
      : err.message,
  });
});

export default app;
