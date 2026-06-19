import db from '../../database/connection';
import { generateToken } from '../../middleware/auth';

/**
 * Login input — email + phone only (crypto-invisible onboarding).
 */
export interface LoginInput {
  email: string;
  phone: string;
}

/**
 * Login result returned to the client.
 */
export interface LoginResult {
  driverId: string;
  walletAddress: string;
  token: string;
}

/**
 * LoginService handles driver authentication:
 * - Looks up driver by email (case-insensitive)
 * - Verifies phone matches (normalized — whitespace stripped)
 * - Returns a session JWT on success
 * - Never reveals which field is wrong (prevents enumeration)
 *
 * Requirements: 10.1, 10.2
 */
export class LoginService {
  /**
   * Authenticates a driver with email + phone.
   *
   * @param email - Driver's registered email address
   * @param phone - Driver's registered phone number
   * @returns LoginResult with driver ID, wallet address, and JWT
   * @throws LoginError with code INVALID_CREDENTIALS if email not found or phone mismatch
   */
  async login(email: string, phone: string): Promise<LoginResult> {
    // Look up driver by email (case-insensitive)
    const driver = await db('drivers')
      .where({ email: email.toLowerCase().trim() })
      .first();

    // Normalize phone for comparison — strip all whitespace
    const normalizedInput = phone.replace(/\s/g, '');
    const normalizedStored = driver?.phone?.replace(/\s/g, '') ?? '';

    // Do not reveal which field is wrong — always return the same error
    if (!driver || normalizedInput !== normalizedStored) {
      throw new LoginError('Invalid email or phone number.', 'INVALID_CREDENTIALS');
    }

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
 * Custom error class for login failures.
 */
export class LoginError extends Error {
  code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = 'LoginError';
    this.code = code;
  }
}
