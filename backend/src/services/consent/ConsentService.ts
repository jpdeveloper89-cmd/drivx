import db from '../../database/connection';

/**
 * Valid data category bitmask (0x01 | 0x02 | 0x04 | 0x08 = 0x0F).
 * 0x01 = Safety Score, 0x02 = Trip history, 0x04 = Delivery metrics, 0x08 = Insurance data
 */
const VALID_CATEGORIES_MASK = 0x0f;

/**
 * Maximum consent duration: 12 months (365 days in seconds).
 * Requirements: 14.3
 */
const MAX_DURATION_SECONDS = 365 * 24 * 3600;

/**
 * Represents a consent grant record from the database.
 */
export interface ConsentGrant {
  id: string;
  driver_address: string;
  authorized_party: string;
  data_categories: number;
  granted_at: Date;
  expires_at: Date;
  revoked: boolean;
  revoked_at: Date | null;
}

/**
 * Custom error class for consent-related failures.
 * Requirements: 5.7, 5.8
 */
export class ConsentError extends Error {
  code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = 'ConsentError';
    this.code = code;
  }
}

/**
 * ConsentService manages driver data access consent grants.
 *
 * Drivers can grant time-bound, bitmask-scoped consent to authorized parties,
 * revoke existing grants, and list their active grants.
 *
 * Requirements: 5.4, 5.7, 5.8, 14.1, 14.2, 14.3, 14.4
 */
export class ConsentService {
  /**
   * Grants consent to an authorized party for specified data categories.
   *
   * Upserts the grant: if a grant already exists for the (driver, party) pair,
   * it is updated with the new categories and expiry. Otherwise a new record is inserted.
   *
   * @param driverAddress - The driver's wallet address
   * @param party - The authorized party identifier
   * @param categories - Bitmask of data categories (1–15)
   * @param durationSeconds - How long the grant is valid (max 365 days)
   * @returns The created or updated consent grant record
   * @throws ConsentError if categories or duration are invalid
   */
  async grantConsent(
    driverAddress: string,
    party: string,
    categories: number,
    durationSeconds: number
  ): Promise<ConsentGrant> {
    // Validate categories is non-zero and within valid bitmask
    if (categories === 0 || (categories & ~VALID_CATEGORIES_MASK) !== 0) {
      throw new ConsentError(
        'Invalid data categories. Must be a non-zero bitmask within 0x01–0x0F.',
        'INVALID_CATEGORIES'
      );
    }

    // Validate duration does not exceed 12-month cap
    if (durationSeconds > MAX_DURATION_SECONDS) {
      throw new ConsentError(
        'Consent duration exceeds the 12-month maximum.',
        'DURATION_EXCEEDED'
      );
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + durationSeconds * 1000);

    // Upsert: update if (driver_address, authorized_party) already exists
    const [grant] = await db('consent_grants')
      .insert({
        driver_address: driverAddress,
        authorized_party: party,
        data_categories: categories,
        granted_at: now,
        expires_at: expiresAt,
        revoked: false,
        revoked_at: null,
      })
      .onConflict(['driver_address', 'authorized_party'])
      .merge({
        data_categories: categories,
        granted_at: now,
        expires_at: expiresAt,
        revoked: false,
        revoked_at: null,
      })
      .returning('*');

    return grant as ConsentGrant;
  }

  /**
   * Revokes an existing consent grant.
   *
   * Verifies ownership by checking both the grant ID and the driver address.
   * Throws if the grant does not exist, belongs to a different driver, or is already revoked.
   *
   * @param driverAddress - The driver's wallet address (ownership check)
   * @param grantId - The UUID of the grant to revoke
   * @throws ConsentError if grant not found, not owned by driver, or already revoked
   */
  async revokeConsent(driverAddress: string, grantId: string): Promise<void> {
    const grant = await db('consent_grants')
      .where({ id: grantId, driver_address: driverAddress })
      .first();

    if (!grant) {
      throw new ConsentError(
        'Consent grant not found or does not belong to this driver.',
        'GRANT_NOT_FOUND'
      );
    }

    if (grant.revoked) {
      throw new ConsentError('Consent grant has already been revoked.', 'ALREADY_REVOKED');
    }

    await db('consent_grants').where({ id: grantId }).update({
      revoked: true,
      revoked_at: new Date(),
    });
  }

  /**
   * Returns all active (non-revoked, non-expired) consent grants for a driver.
   *
   * @param driverAddress - The driver's wallet address
   * @returns Array of active consent grant records
   */
  async getActiveGrants(driverAddress: string): Promise<ConsentGrant[]> {
    const grants = await db('consent_grants')
      .where({ driver_address: driverAddress, revoked: false })
      .where('expires_at', '>', db.fn.now())
      .select('*');

    return grants as ConsentGrant[];
  }
}
