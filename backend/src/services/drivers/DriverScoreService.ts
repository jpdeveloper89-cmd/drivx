import db from '../../database/connection';

/**
 * Score data returned to the client.
 */
export interface DriverScoreResult {
  walletAddress: string;
  safetyScore: number;
  scoreStatus: string;
  totalTrips: number;
  totalKilometers: number;
  tenureStartDate: Date | null;
  lastUpdated: Date | null;
  isVerified: boolean;
}

/**
 * DriverScoreService retrieves a driver's safety score by wallet address.
 *
 * Requirements: 1.2, 2.1
 */
export class DriverScoreService {
  /**
   * Retrieves the safety score for a driver identified by wallet address.
   * Lookup is case-insensitive.
   *
   * @param walletAddress - Ethereum wallet address (0x...)
   * @returns DriverScoreResult with score data
   * @throws DriverNotFoundError if no driver exists for the given address
   */
  async getDriverScore(walletAddress: string): Promise<DriverScoreResult> {
    const driver = await db('drivers')
      .whereRaw('LOWER(wallet_address) = ?', [walletAddress.toLowerCase()])
      .select(
        'wallet_address',
        'safety_score',
        'score_status',
        'total_trips',
        'total_kilometers',
        'tenure_start_date',
        'updated_at'
      )
      .first();

    if (!driver) {
      throw new DriverNotFoundError(
        `Driver with address ${walletAddress} not found.`
      );
    }

    return {
      walletAddress: driver.wallet_address,
      safetyScore: driver.safety_score,
      scoreStatus: driver.score_status,
      totalTrips: driver.total_trips,
      totalKilometers: Number(driver.total_kilometers),
      tenureStartDate: driver.tenure_start_date ?? null,
      lastUpdated: driver.updated_at ?? null,
      isVerified: driver.score_status === 'Verified',
    };
  }
}

/**
 * Custom error class for driver-not-found failures.
 */
export class DriverNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DriverNotFoundError';
  }
}
