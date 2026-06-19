import { describe, it, expect } from 'vitest';
import { config } from './env';

describe('Environment Configuration', () => {
  it('should have valid server config defaults', () => {
    expect(config.server.port).toBe(3000);
    // vitest sets NODE_ENV='test' at runtime; 'development' is the production default
    expect(['development', 'test']).toContain(config.server.nodeEnv);
  });

  it('should have valid database config defaults', () => {
    expect(config.database.host).toBe('localhost');
    expect(config.database.port).toBe(5432);
    expect(config.database.name).toBe('safedrive');
  });

  it('should have valid redis config defaults', () => {
    expect(config.redis.host).toBe('localhost');
    expect(config.redis.port).toBe(6379);
  });

  it('should have correct public rate limit (100 req/15min)', () => {
    expect(config.rateLimits.public.max).toBe(100);
    expect(config.rateLimits.public.windowMs).toBe(900000); // 15 minutes
  });

  it('should have correct authenticated rate limit (1000 req/15min)', () => {
    expect(config.rateLimits.authenticated.max).toBe(1000);
    expect(config.rateLimits.authenticated.windowMs).toBe(900000);
  });

  it('should have correct business rate limit (5000 req/15min)', () => {
    expect(config.rateLimits.business.max).toBe(5000);
    expect(config.rateLimits.business.windowMs).toBe(900000);
  });

  it('should have JWT config with 30 minute session timeout', () => {
    expect(config.jwt.expiresIn).toBe('30m');
  });

  it('should have CORS origins configured', () => {
    expect(config.cors.origins).toContain('http://localhost:3001');
  });

  it('should have blockchain config with Base defaults', () => {
    expect(config.blockchain).toBeDefined();
    expect(config.blockchain.entryPointAddress).toBe('0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789');
    expect(config.blockchain.chainId).toBe(8453);
  });
});
