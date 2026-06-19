import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('consent_grants', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('driver_address').notNullable();
    table.string('authorized_party').notNullable();
    table.integer('data_categories').notNullable();
    table.timestamp('granted_at').defaultTo(knex.fn.now());
    table.timestamp('expires_at').notNullable();
    table.boolean('revoked').defaultTo(false);
    table.timestamp('revoked_at').nullable();

    table.unique(['driver_address', 'authorized_party']);
  });

  await knex.schema.raw(
    'CREATE INDEX idx_consent_grants_driver_address ON consent_grants(driver_address)'
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('consent_grants');
}
