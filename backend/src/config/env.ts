import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Try multiple paths to find .env — handles both ts-node and compiled dist layouts
const envPaths = [
  path.resolve(__dirname, '../../.env'),
  path.resolve(__dirname, '../.env'),
  path.resolve(process.cwd(), '.env'),
];
for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    break;
  }
}

export const config = {
  server: {
    port: parseInt(process.env.PORT || '3000', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
  },
  database: {
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT || '5432', 10),
    name: process.env.DATABASE_NAME || 'safedrive',
    user: process.env.DATABASE_USER || 'postgres',
    password: process.env.DATABASE_PASSWORD || 'postgres',
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '30m',
  },
  cors: {
    origins: (process.env.CORS_ORIGINS || 'http://localhost:3001').split(','),
  },
  rateLimits: {
    public: {
      windowMs: parseInt(process.env.RATE_LIMIT_PUBLIC_WINDOW_MS || '900000', 10),
      max: parseInt(process.env.RATE_LIMIT_PUBLIC_MAX || '100', 10),
    },
    authenticated: {
      windowMs: parseInt(process.env.RATE_LIMIT_AUTHENTICATED_WINDOW_MS || '900000', 10),
      max: parseInt(process.env.RATE_LIMIT_AUTHENTICATED_MAX || '1000', 10),
    },
    business: {
      windowMs: parseInt(process.env.RATE_LIMIT_BUSINESS_WINDOW_MS || '900000', 10),
      max: parseInt(process.env.RATE_LIMIT_BUSINESS_MAX || '5000', 10),
    },
  },
  blockchain: {
    rpcUrl: process.env.BASE_RPC_URL || '',
    backendSignerKey: process.env.BACKEND_SIGNER_PRIVATE_KEY || '',
    bundlerUrl: process.env.ERC4337_BUNDLER_URL || '',
    paymasterUrl: process.env.ERC4337_PAYMASTER_URL || '',
    accountFactoryAddress: process.env.ACCOUNT_FACTORY_ADDRESS || '',
    entryPointAddress: process.env.ENTRY_POINT_ADDRESS || '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789',
    chainId: parseInt(process.env.BASE_CHAIN_ID || '8453', 10),
  },
} as const;
