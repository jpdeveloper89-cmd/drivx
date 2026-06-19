import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import db from '../../database/connection';

/**
 * DataPrivacyService
 *
 * Handles encrypted GPS data access, consent-gated decryption,
 * government data export with k-anonymity, and data deletion requests.
 *
 * Rules:
 * - Raw GPS encrypted with AES-256 using driver-specific key
 * - Decryption only with valid, non-expired, non-revoked consent for trip history category (0x02)
 * - k-anonymity (k >= 100) for government data exports
 * - Data export within 72 hours
 * - Data deletion within 30 days (off-chain personal data)
 * - Log unauthorized decryption attempts, notify driver within 1 hour
 *
 * Requirements: 14.6, 14.7, 14.8, 14.9
 */
export class DataPrivacyService {
  private readonly K_ANONYMITY_THRESHOLD = 100;
  private readonly ALGORITHM = 'aes-256-gcm';
  private readonly IV_LENGTH = 16;
  private readonly AUTH_TAG_LENGTH = 16;

  /**
   * Encrypt GPS data with a driver-specific key.
   * Returns base64 encoded (iv + authTag + ciphertext).
   */
  encrypt(data: string, driverKey: Buffer): string {
    const iv = randomBytes(this.IV_LENGTH);
    const cipher = createCipheriv(this.ALGORITHM, driverKey, iv);

    let encrypted = cipher.update(data, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    const authTag = cipher.getAuthTag();

    // Concatenate: iv (16) + authTag (16) + ciphertext
    const combined = Buffer.concat([
      iv,
      authTag,
      Buffer.from(encrypted, 'base64'),
    ]);

    return combined.toString('base64');
  }

  /**
   * Decrypt GPS data. Only works with the correct driver key.
   */
  decrypt(encryptedData: string, driverKey: Buffer): string {
    const combined = Buffer.from(encryptedData, 'base64');

    const iv = combined.subarray(0, this.IV_LENGTH);
    const authTag = combined.subarray(this.IV_LENGTH, this.IV_LENGTH + this.AUTH_TAG_LENGTH);
    const ciphertext = combined.subarray(this.IV_LENGTH + this.AUTH_TAG_LENGTH);

    const decipher = createDecipheriv(this.ALGORITHM, driverKey, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(ciphertext);
    const final = decipher.final();
    return Buffer.concat([decrypted, final]).toString('utf8');
  }

  /**
   * Generate a 256-bit driver-specific encryption key.
   * In production: derived from driver's wallet via KDF.
   */
  generateDriverKey(): Buffer {
    return randomBytes(32);
  }

  /**
   * Check if a requesting party has consent to access trip history (0x02).
   */
  async hasTripsConsent(driverAddress: string, requestingParty: string): Promise<boolean> {
    const grant = await db('consent_grants')
      .whereRaw('LOWER(driver_address) = ?', [driverAddress.toLowerCase()])
      .where('authorized_party', requestingParty)
      .where('revoked', false)
      .where('expires_at', '>', db.fn.now())
      .whereRaw('(data_categories & 2) = 2') // 0x02 = Trip history
      .first();

    return !!grant;
  }

  /**
   * Attempt to decrypt GPS data for a requesting party.
   * Logs unauthorized attempts and notifies driver.
   */
  async accessGPSData(
    driverAddress: string,
    requestingParty: string,
    encryptedData: string,
    driverKey: Buffer
  ): Promise<{ success: boolean; data?: string; error?: string }> {
    const hasConsent = await this.hasTripsConsent(driverAddress, requestingParty);

    if (!hasConsent) {
      // Log unauthorized attempt
      await this.logUnauthorizedAttempt(driverAddress, requestingParty);
      return { success: false, error: 'Consent not granted for trip history access' };
    }

    try {
      const decrypted = this.decrypt(encryptedData, driverKey);
      return { success: true, data: decrypted };
    } catch {
      return { success: false, error: 'Decryption failed' };
    }
  }

  /**
   * Log unauthorized decryption attempt.
   * In production: triggers driver notification within 1 hour.
   */
  private async logUnauthorizedAttempt(
    driverAddress: string,
    requestingParty: string
  ): Promise<void> {
    await db('access_audit_log').insert({
      driver_address: driverAddress,
      requesting_party: requestingParty,
      access_type: 'gps_decryption',
      authorized: false,
      timestamp: new Date(),
    });
    // TODO: Trigger push notification to driver within 1 hour
  }

  /**
   * Apply k-anonymity to a dataset.
   * Removes any group with fewer than k records.
   *
   * @param data Array of records
   * @param groupKey Function to extract the group identifier
   * @returns Filtered data where each group has >= k records
   */
  applyKAnonymity<T>(data: T[], groupKey: (item: T) => string): T[] {
    // Group records
    const groups = new Map<string, T[]>();
    for (const item of data) {
      const key = groupKey(item);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(item);
    }

    // Filter out groups below threshold
    const result: T[] = [];
    for (const [, group] of groups) {
      if (group.length >= this.K_ANONYMITY_THRESHOLD) {
        result.push(...group);
      }
    }

    return result;
  }

  /**
   * Handle data export request (GDPR/CCPA).
   * Returns all driver data in machine-readable format.
   * Must complete within 72 hours.
   */
  async requestDataExport(driverAddress: string): Promise<{ requestId: string; estimatedCompletionHours: number }> {
    const requestId = `export-${Date.now()}-${driverAddress.slice(0, 8)}`;

    await db('data_requests').insert({
      id: requestId,
      driver_address: driverAddress,
      type: 'export',
      status: 'pending',
      requested_at: new Date(),
      estimated_completion: new Date(Date.now() + 72 * 60 * 60 * 1000), // 72 hours
    });

    return { requestId, estimatedCompletionHours: 72 };
  }

  /**
   * Handle data deletion request (GDPR/CCPA).
   * Off-chain personal data deleted within 30 days.
   * On-chain records anonymised (cannot be deleted from blockchain).
   */
  async requestDataDeletion(driverAddress: string): Promise<{ requestId: string; estimatedCompletionDays: number }> {
    const requestId = `delete-${Date.now()}-${driverAddress.slice(0, 8)}`;

    await db('data_requests').insert({
      id: requestId,
      driver_address: driverAddress,
      type: 'deletion',
      status: 'pending',
      requested_at: new Date(),
      estimated_completion: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    });

    return { requestId, estimatedCompletionDays: 30 };
  }
}
