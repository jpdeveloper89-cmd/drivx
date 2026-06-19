import { TripVerificationEngine } from '../tripVerification';
import { ScoringEngine, VerifiedTrip, TripScore } from '../scoring';
import { TripRecord, VerificationResult, VERIFICATION_CONSTANTS } from '../tripVerification';

/**
 * Trip submission result returned to the client
 */
export interface TripSubmissionResult {
  tripId: string;
  verified: boolean;
  rejectionReason?: string;
  grade?: 'A' | 'B' | 'C' | 'D' | 'F';
  factors?: TripScore['factors'];
  dvxReward?: number;
  overallScore?: number;
  verifiedDistanceKm?: number;
}

/**
 * Batch submission result for offline sync
 */
export interface BatchSubmissionResult {
  total: number;
  successful: number;
  failed: number;
  results: TripSubmissionResult[];
}

/**
 * GPS frequency validation error
 */
export class GPSFrequencyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GPSFrequencyError';
  }
}

/**
 * TripSubmissionService
 *
 * Orchestrates the trip submission flow:
 * 1. Validates GPS coordinate frequency (minimum 1 per 10 seconds)
 * 2. Passes trip to TripVerificationEngine for integrity/anomaly checks
 * 3. If verified, passes to ScoringEngine for grade and reward computation
 * 4. Returns trip summary (grade, factor scores, DVX reward)
 *
 * Also handles batch submissions for offline sync.
 *
 * Requirements: 1.3, 1.4, 8.6
 */
export class TripSubmissionService {
  private readonly verificationEngine: TripVerificationEngine;
  private readonly scoringEngine: ScoringEngine;

  constructor(
    verificationEngine: TripVerificationEngine,
    scoringEngine: ScoringEngine
  ) {
    this.verificationEngine = verificationEngine;
    this.scoringEngine = scoringEngine;
  }

  /**
   * Submit a single trip for verification and scoring.
   *
   * @param driverAddress - The driver's wallet address
   * @param tripData - The trip record payload from the mobile app
   * @returns Trip submission result with grade, scores, and reward
   * @throws GPSFrequencyError if GPS coordinate frequency is insufficient
   */
  async submitTrip(
    driverAddress: string,
    tripData: Omit<TripRecord, 'driverAddress'>
  ): Promise<TripSubmissionResult> {
    // Step 1: Validate GPS coordinate frequency (min 1 per 10 seconds)
    this.validateGPSFrequency(tripData.coordinates, tripData.startTime, tripData.endTime);

    // Step 2: Build full TripRecord with driver address
    const tripRecord: TripRecord = {
      ...tripData,
      driverAddress,
    };

    // Step 3: Pass to Trip Verification Engine
    const verificationResult = await this.verificationEngine.verifyTripRecord(tripRecord);

    if (!verificationResult.valid) {
      return {
        tripId: verificationResult.tripId,
        verified: false,
        rejectionReason: verificationResult.rejectionReason,
      };
    }

    // Step 4: Build VerifiedTrip and pass to Scoring Engine
    const verifiedTrip: VerifiedTrip = {
      tripId: verificationResult.tripId,
      driverAddress,
      startTime: tripData.startTime,
      endTime: tripData.endTime,
      coordinates: tripData.coordinates,
      speedReadings: tripData.speedReadings,
      brakingEvents: tripData.brakingEvents,
      accelerationEvents: tripData.accelerationEvents,
      corneringEvents: tripData.corneringEvents,
      phoneUsageEvents: tripData.phoneUsageEvents,
      distanceKm: tripData.distanceKm,
      verifiedDistanceKm: verificationResult.verifiedDistanceKm,
      unverifiedSegments: verificationResult.unverifiedSegments,
      category: tripData.category,
    };

    const tripScore = this.scoringEngine.computeTripScore(verifiedTrip);

    // Step 5: Update driver's rolling Safety Score
    await this.scoringEngine.updateSafetyScore(driverAddress, tripScore);

    return {
      tripId: verificationResult.tripId,
      verified: true,
      grade: tripScore.grade,
      factors: tripScore.factors,
      dvxReward: tripScore.dvxReward,
      overallScore: tripScore.overall,
      verifiedDistanceKm: verificationResult.verifiedDistanceKm,
    };
  }

  /**
   * Submit a batch of trips (offline sync).
   * Processes each trip independently — one failure does not block others.
   *
   * @param driverAddress - The driver's wallet address
   * @param trips - Array of trip records to submit
   * @returns Batch result with individual trip outcomes
   */
  async submitBatch(
    driverAddress: string,
    trips: Array<Omit<TripRecord, 'driverAddress'>>
  ): Promise<BatchSubmissionResult> {
    const results: TripSubmissionResult[] = [];
    let successful = 0;
    let failed = 0;

    for (const tripData of trips) {
      try {
        const result = await this.submitTrip(driverAddress, tripData);
        results.push(result);
        if (result.verified) {
          successful++;
        } else {
          failed++;
        }
      } catch (err) {
        failed++;
        results.push({
          tripId: '',
          verified: false,
          rejectionReason: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    return {
      total: trips.length,
      successful,
      failed,
      results,
    };
  }

  /**
   * Validates that GPS coordinates meet the minimum frequency requirement.
   * Requirement 1.3: minimum one GPS coordinate every 10 seconds.
   *
   * Checks that the average interval between coordinates does not exceed
   * the maximum allowed interval (10 seconds).
   *
   * @throws GPSFrequencyError if frequency is insufficient
   */
  private validateGPSFrequency(
    coordinates: TripRecord['coordinates'],
    startTime: number,
    endTime: number
  ): void {
    if (coordinates.length < 2) {
      // A single coordinate cannot establish frequency, but the trip schema
      // requires at least 1. For very short trips, we allow it.
      return;
    }

    const tripDurationSeconds = (endTime - startTime) / 1000;
    const expectedMinCoordinates = Math.floor(tripDurationSeconds / VERIFICATION_CONSTANTS.GPS_INTERVAL_SECONDS);

    // Allow some tolerance: require at least 80% of expected coordinates
    const minimumRequired = Math.max(2, Math.floor(expectedMinCoordinates * 0.8));

    if (coordinates.length < minimumRequired) {
      throw new GPSFrequencyError(
        `Insufficient GPS coordinate frequency. Expected at least ${minimumRequired} coordinates for a ${Math.round(tripDurationSeconds)}-second trip (1 per ${VERIFICATION_CONSTANTS.GPS_INTERVAL_SECONDS} seconds), but received ${coordinates.length}.`
      );
    }
  }
}
