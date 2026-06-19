import { Router, Request, Response } from 'express';
import db from '../database/connection';
import { redisClient } from '../config/redis';

export const healthRouter = Router();

healthRouter.get('/', async (_req: Request, res: Response) => {
  const health: Record<string, string> = {
    status: 'ok',
    timestamp: new Date().toISOString(),
  };

  // Check PostgreSQL
  try {
    await db.raw('SELECT 1');
    health.database = 'connected';
  } catch {
    health.database = 'disconnected';
  }

  // Check Redis
  try {
    const pong = await redisClient.ping();
    health.redis = pong === 'PONG' ? 'connected' : 'disconnected';
  } catch {
    health.redis = 'disconnected';
  }

  const isHealthy = health.database === 'connected';
  res.status(isHealthy ? 200 : 503).json(health);
});
