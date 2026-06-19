import knex, { Knex } from 'knex';
import knexConfig from './knexfile';
import { config } from '../config/env';

const environment = config.server.nodeEnv || 'development';

const db: Knex = knex(knexConfig[environment] || knexConfig.development);

export default db;
