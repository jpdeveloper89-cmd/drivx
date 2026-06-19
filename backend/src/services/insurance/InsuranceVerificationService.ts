import db from '../../database/connection';

/**
 * Risk categories based on Safety Score.
 * Requirements: 5.1, 5.2, 5.5
 */
export type RiskCategory = 'Low' | 'Medium' | 'High';

export interface VerificationResult {
  walletAddress: string;
  safetyScore: number;
  riskCategory: RiskCategory;
  totalTrips: number;
  totalKilometers: number;
  tenureStartDate: Date | null;
  isVerified: boolean;
  consentGranted: boolean;
}

export interface BatchVerificationResult {
  results: VerificationResult[];
  total: number;
  processed: number;
  consentDenied: number;
}

export class ConsentNotGrantedError extends Error {
  constructor(address: string) {
    super(`Consent not granted for address ${address}`);
    this.name = 'ConsentNotGrantedError';
  }
}

/**
 * InsuranceVerificationService
 *
 * Provides Safety Score verification for insurers.
 * Enforces consent check before returning any data.
 * Classifies drivers into risk categories.
 *
 * Requirements: 5.1, 5.2, 5.3, 5.5, 5.6
 */
export class InsuranceVerificationService {

  /**
   * Classify a safety score into a risk category.
   * Low: 800–1000, Medium: 500–799, High: 0–499
   */
  classifyRisk(safetyScore: number): RiskCategory {
    if (safetyScore >= 800) return 'Low';
    if (safetyScore >= 500) return 'Medium';
    return 'High';
  }

  /**
   * Verify a single driver's safety data for an insurer.
   * Checks consent before returning any data.
   *
   * Requirements: 5.1, 5.3, 5.6
   */
  async verifySingle(
    walletAddress: string,
    requestingParty: string
  ): Promise<VerificationResult> {
    // Check consent first — never reveal data without consent
    const hasConsent = await this.checkConsent(walletAddress, requestingParty);

    if (!hasConsent) {
      throw new ConsentNotGrantedError(walletAddress);
    }

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
      return {
        walletAddress,
        safetyScore: 0,
        riskCategory: 'High',
        totalTrips: 0,
        totalKilometers: 0,
        tenureStartDate: null,
        isVerified: false,
        consentGranted: true,
      };
    }

    return {
      walletAddress: driver.wallet_address,
      safetyScore: driver.safety_score,
      riskCategory: this.classifyRisk(driver.safety_score),
      totalTrips: driver.total_trips,
      totalKilometers: Number(driver.total_kilometers),
      tenureStartDate: driver.tenure_start_date ?? null,
      isVerified: driver.score_status === 'Verified',
      consentGranted: true,
    };
  }

  /**
   * Batch verify up to 1000 wallet addresses.
   * Silently skips addresses without consent (returns consentDenied count).
   *
   * Requirements: 5.2, 5.5
   */
  async verifyBatch(
    walletAddresses: string[],
    requestingParty: string
  ): Promise<BatchVerificationResult> {
    if (walletAddresses.length > 1000) {
      throw new Error('Batch size cannot exceed 1000 addresses');
    }

    const results: VerificationResult[] = [];
    let consentDenied = 0;

    // Process in parallel for performance
    await Promise.all(
      walletAddresses.map(async (address) => {
        const hasConsent = await this.checkConsent(address, requestingParty);
        if (!hasConsent) {
          consentDenied++;
          return;
        }

        const driver = await db('drivers')
          .whereRaw('LOWER(wallet_address) = ?', [address.toLowerCase()])
          .select('wallet_address', 'safety_score', 'score_status', 'total_trips', 'total_kilometers', 'tenure_start_date')
          .first();

        results.push({
          walletAddress: address,
          safetyScore: driver?.safety_score ?? 0,
          riskCategory: this.classifyRisk(driver?.safety_score ?? 0),
          totalTrips: driver?.total_trips ?? 0,
          totalKilometers: driver ? Number(driver.total_kilometers) : 0,
          tenureStartDate: driver?.tenure_start_date ?? null,
          isVerified: driver?.score_status === 'Verified',
          consentGranted: true,
        });
      })
    );

    return {
      results,
      total: walletAddresses.length,
      processed: results.length,
      consentDenied,
    };
  }

  /**
   * Check if a driver has granted consent to the requesting party.
   * Checks for active, non-revoked, non-expired grants with score category (0x01).
   */
  private async checkConsent(
    driverAddress: string,
    requestingParty: string
  ): Promise<boolean> {
    const grant = await db('consent_grants')
      .whereRaw('LOWER(driver_address) = ?', [driverAddress.toLowerCase()])
      .where('authorized_party', requestingParty)
      .where('revoked', false)
      .where('expires_at', '>', db.fn.now())
      .whereRaw('(data_categories & 1) = 1') // 0x01 = Safety Score category
      .first();

    return !!grant;
  }
}
