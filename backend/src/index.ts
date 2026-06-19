import app from './app';
import { config } from './config/env';
import db from './database/connection';
import { connectRedis } from './config/redis';

async function startServer(): Promise<void> {
  try {
    // Test database connection
    await db.raw('SELECT 1');
    console.log('PostgreSQL connection established');

    // Connect to Redis (non-blocking - server starts even if Redis is unavailable)
    await connectRedis();

    // Start Express server
    app.listen(config.server.port, () => {
      console.log(
        `SafeDrive Backend running on port ${config.server.port} [${config.server.nodeEnv}]`
      );
    });
  } catch (error) {
    console.error('Failed to start server:', (error as Error).message);
    process.exit(1);
  }
}

startServer();
