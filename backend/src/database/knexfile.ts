import type { Knex } from 'knex';
import { config } from '../config/env';

const knexConfig: Record<string, Knex.Config> = {
  development: {
    client: 'pg',
    connection: {
      host: config.database.host,
      port: config.database.port,
      database: config.database.name,
      user: config.database.user,
      password: config.database.password,
    },
    migrations: {
      directory: './migrations',
      extension: 'ts',
    },
    seeds: {
      directory: './seeds',
    },
  },
  production: {
    client: 'pg',
    connection: {
      host: config.database.host,
      port: config.database.port,
      database: config.database.name,
      user: config.database.user,
      password: config.database.password,
      ssl: { rejectUnauthorized: false },
    },
    migrations: {
      directory: './migrations',
      extension: 'ts',
    },
    pool: {
      min: 2,
      max: 10,
    },
  },
};

export default knexConfig;
