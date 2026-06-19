import Redis, { RedisOptions } from 'ioredis';
import { config } from './env';

const redisOptions: RedisOptions = {
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password || undefined,
  maxRetriesPerRequest: 3,
  retryStrategy(times: number) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  lazyConnect: true,
};

// Main Redis client for caching
export const redisClient = new Redis(redisOptions);

// Separate client for session management
export const sessionClient = new Redis(redisOptions);

redisClient.on('error', (err) => {
  console.error('Redis client error:', err.message);
});

redisClient.on('connect', () => {
  console.log('Redis client connected');
});

sessionClient.on('error', (err) => {
  console.error('Redis session client error:', err.message);
});

export async function connectRedis(): Promise<void> {
  try {
    await redisClient.connect();
    await sessionClient.connect();
    console.log('Redis connections established');
  } catch (error) {
    console.warn('Redis connection failed, continuing without cache:', (error as Error).message);
  }
}

export async function disconnectRedis(): Promise<void> {
  await redisClient.quit();
  await sessionClient.quit();
}
