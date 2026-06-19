import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Enable UUID generation
  await knex.raw('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');

  // Core driver data
  await knex.schema.createTable('drivers', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('wallet_address', 42).unique().notNullable();
    table.string('email', 255).unique().notNullable();
    table.string('phone', 20);
    table.integer('safety_score').defaultTo(0).checkBetween([0, 1000]);
    table
      .string('score_status', 20)
      .defaultTo('Provisional')
      .checkIn(['Provisional', 'Verified']);
    table.integer('total_trips').defaultTo(0);
    table.decimal('total_kilometers', 12, 2).defaultTo(0);
    table.timestamp('tenure_start_date');
    table.boolean('identity_verified').defaultTo(false);
    table.integer('identity_verification_attempts').defaultTo(0);
    table.string('preferred_language', 5).defaultTo('en');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });

  // Trip records (off-chain storage, GPS data in object storage)
  await knex.schema.createTable('trip_records', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('driver_id').references('id').inTable('drivers').onDelete('CASCADE');
    table.timestamp('start_time').notNullable();
    table.timestamp('end_time').notNullable();
    table.decimal('distance_km', 8, 2).notNullable();
    table.integer('duration_seconds').notNullable();
    table
      .string('category', 20)
      .checkIn(['commute', 'delivery', 'rideshare', 'long-distance']);
    table.integer('trip_score').checkBetween([0, 1000]);
    table.string('grade', 1).checkIn(['A', 'B', 'C', 'D', 'F']);
    table.integer('speed_compliance_score');
    table.integer('braking_score');
    table.integer('acceleration_score');
    table.integer('cornering_score');
    table.integer('phone_avoidance_score');
    table.integer('time_risk_score');
    table.decimal('dvx_reward', 10, 4).defaultTo(0);
    table.string('gps_data_ref', 255); // S3/object storage reference
    table.string('verification_status', 20).defaultTo('pending');
    table.text('rejection_reason');
    table.jsonb('unverified_segments').defaultTo('[]');
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });

  // Scoring history (for trend calculation)
  await knex.schema.createTable('score_history', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('driver_id').references('id').inTable('drivers').onDelete('CASCADE');
    table.integer('score').notNullable();
    table.timestamp('recorded_at').defaultTo(knex.fn.now());
  });

  // Indexes for performance
  await knex.schema.raw(
    'CREATE INDEX idx_trips_driver_id ON trip_records(driver_id)'
  );
  await knex.schema.raw(
    'CREATE INDEX idx_trips_created_at ON trip_records(created_at DESC)'
  );
  await knex.schema.raw(
    'CREATE INDEX idx_drivers_wallet ON drivers(wallet_address)'
  );
  await knex.schema.raw(
    'CREATE INDEX idx_drivers_score ON drivers(safety_score DESC)'
  );
  await knex.schema.raw(
    'CREATE INDEX idx_score_history_driver ON score_history(driver_id, recorded_at DESC)'
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('score_history');
  await knex.schema.dropTableIfExists('trip_records');
  await knex.schema.dropTableIfExists('drivers');
}
