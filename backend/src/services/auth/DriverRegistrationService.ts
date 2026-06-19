import db from '../../database/connection';
import { AccountAbstractionService } from '../wallet/AccountAbstractionService';
import { generateToken } from '../../middleware/auth';

/**
 * Registration input — email + phone only (crypto-invisible onboarding).
 */
export interface RegistrationInput {
  email: string;
  phone: string;
}

/**
 * Registration result returned to the client.
 */
export interface RegistrationResult {
  driverId: string;
  walletAddress: string;
  token: string;
}

/**
 * DriverRegistrationService handles new driver registration:
 * - Validates uniqueness of email
 * - Creates an ERC-4337 Account Abstraction wallet on Base
 * - Stores the driver record with wallet address
 * - Returns a session JWT
 *
 * Requirements: 10.1, 10.2, 10.3
 */
export class DriverRegistrationService {
  private walletService: AccountAbstractionService;

  constructor(walletService?: AccountAbstractionService) {
    this.walletService = walletService || new AccountAbstractionService();
  }

  /**
   * Registers a new driver with email + phone only.
   * Creates an Account Abstraction wallet within 30 seconds.
   * No seed phrase or private key is exposed to the user.
   *
   * @param input - Email and phone number
   * @returns RegistrationResult with driver ID, wallet address, and JWT
   * @throws Error if email already registered or wallet creation fails
   */
  async register(input: RegistrationInput): Promise<RegistrationResult> {
    const { email, phone } = input;

    // Check if email is already registered
    const existingDriver = await db('drivers')
      .where({ email: email.toLowerCase().trim() })
      .first();

    if (existingDriver) {
      throw new RegistrationError(
        'A driver with this email is already registered.',
        'EMAIL_EXISTS'
      );
    }

    // Create Account Abstraction wallet on Base (must complete within 30 seconds)
    const walletResult = await this.walletService.createWallet(email, phone);

    // Store driver record with wallet address
    const [driver] = await db('drivers')
      .insert({
        wallet_address: walletResult.walletAddress,
        email: email.toLowerCase().trim(),
        phone: phone.replace(/\s/g, ''),
        safety_score: 0,
        score_status: 'Provisional',
        total_trips: 0,
        total_kilometers: 0,
        tenure_start_date: new Date(),
        identity_verified: false,
        identity_verification_attempts: 0,
        preferred_language: 'en',
      })
      .returning(['id', 'wallet_address']);

    // Generate session JWT (30-minute expiry)
    const token = generateToken({
      userId: driver.id,
      walletAddress: driver.wallet_address,
      role: 'Driver',
    });

    return {
      driverId: driver.id,
      walletAddress: driver.wallet_address,
      token,
    };
  }
}

/**
 * Custom error class for registration failures.
 */
export class RegistrationError extends Error {
  code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = 'RegistrationError';
    this.code = code;
  }
}
