import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    env: {
      PORT: '3000',
      NODE_ENV: 'test',
      DATABASE_HOST: 'localhost',
      DATABASE_PORT: '5432',
      DATABASE_NAME: 'safedrive',
      DATABASE_USER: 'postgres',
      DATABASE_PASSWORD: 'postgres',
      REDIS_HOST: 'localhost',
      REDIS_PORT: '6379',
      JWT_SECRET: 'dev-secret-change-in-production',
      JWT_EXPIRES_IN: '30m',
      CORS_ORIGINS: 'http://localhost:3001',
      RATE_LIMIT_PUBLIC_MAX: '100',
      RATE_LIMIT_PUBLIC_WINDOW_MS: '900000',
      RATE_LIMIT_AUTHENTICATED_MAX: '1000',
      RATE_LIMIT_AUTHENTICATED_WINDOW_MS: '900000',
      RATE_LIMIT_BUSINESS_MAX: '5000',
      RATE_LIMIT_BUSINESS_WINDOW_MS: '900000',
      BASE_CHAIN_ID: '8453',
      ENTRY_POINT_ADDRESS: '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789',
    },
  },
});
