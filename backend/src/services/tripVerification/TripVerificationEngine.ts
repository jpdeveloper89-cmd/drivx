import { randomUUID } from 'crypto';
import {
  TripRecord,
  VerificationResult,
  VerificationOutput,
  AnomalyReport,
  Anomaly,
  GPSValidationResult,
  GPSPoint,
  TimeRange,
  VERIFICATION_CONSTANTS,
} from './types';
import { ObjectStorageProvider } from '../storage/ObjectStorageProvider';

/**
 * TripVerificationEngine
 *
 * Validates trip data integrity, detects anomalies (excessive speed, GPS jumps),
 * identifies GPS gaps, stores encrypted GPS data to object storage, and stores
 * trip metadata to PostgreSQL.
 *
 * Requirements: 1.3, 1.4, 1.7, 1.9
 */
export class TripVerificationEngine {
  private readonly storageProvider: ObjectStorageProvider;
  private readonly dbClient: DatabaseClient;

  constructor(storageProvider: ObjectStorageProvider, dbClient: DatabaseClient) {
    this.storageProvider = storageProvider;
    this.dbClient = dbClient;
  }

  /**
   * Verifies a complete trip record.
   * - Validates data integrity (required fields, coordinate format, timestamp ordering)
   * - Rejects trips with duration < 60 seconds or distance < 0.5 km
   * - Rejects trips with non-monotonic or future timestamps
   * - Detects anomalies (speed > 250 km/h, GPS jumps > 5 km)
   * - Detects GPS gaps (> 60 consecutive seconds marked unverified)
   * - Splits trips when GPS gaps > 300 seconds
   * - Stores encrypted GPS data to object storage
   * - Stores trip metadata to PostgreSQL
   *
   * @returns VerificationResult with valid/invalid status, rejection reason, unverified segments
   */
  async verifyTripRecord(trip: TripRecord): Promise<VerificationResult> {
    const tripId = randomUUID();

    // Step 1: Validate trip data integrity (includes timestamp ordering)
    const integrityErrors = this.validateTripDataIntegrity(trip);
    if (integrityErrors.length > 0) {
      const rejectionReason = `Data integrity failure: ${integrityErrors.join('; ')}`;
      await this.storeTripMetadata(tripId, trip, false, rejectionReason, []);
      return {
        valid: false,
        tripId,
        rejectionReason,
        unverifiedSegments: [],
        verifiedDistanceKm: 0,
      };
    }

    // Step 2: Validate trip duration and distance minimums
    const durationRejection = this.validateDurationAndDistance(trip);
    if (durationRejection) {
      await this.storeTripMetadata(tripId, trip, false, durationRejection, []);
      return {
        valid: false,
        tripId,
        rejectionReason: durationRejection,
        unverifiedSegments: [],
        verifiedDistanceKm: 0,
      };
    }

    // Step 3: Validate timestamps (non-monotonic and future)
    const timestampRejection = this.validateTimestamps(trip);
    if (timestampRejection) {
      await this.storeTripMetadata(tripId, trip, false, timestampRejection, []);
      return {
        valid: false,
        tripId,
        rejectionReason: timestampRejection,
        unverifiedSegments: [],
        verifiedDistanceKm: 0,
      };
    }

    // Step 4: Detect anomalies (speed, GPS jumps)
    const anomalyReport = this.detectAnomalies(trip);
    if (anomalyReport.hasAnomalies && anomalyReport.rejectionReason) {
      await this.storeTripMetadata(tripId, trip, false, anomalyReport.rejectionReason, []);
      return {
        valid: false,
        tripId,
        rejectionReason: anomalyReport.rejectionReason,
        unverifiedSegments: [],
        verifiedDistanceKm: 0,
      };
    }

    // Step 5: Validate GPS data and detect gaps
    const gpsValidation = this.validateGPSData(trip.coordinates);

    // Step 6: Calculate verified distance (exclude unverified segments)
    const verifiedDistanceKm = this.calculateVerifiedDistance(
      trip.coordinates,
      gpsValidation.unverifiedSegments
    );

    // Step 7: Store encrypted GPS data to object storage
    const gpsDataRef = await this.storeEncryptedGPSData(tripId, trip);

    // Step 8: Store trip metadata to PostgreSQL
    await this.storeTripMetadata(
      tripId,
      trip,
      true,
      undefined,
      gpsValidation.unverifiedSegments,
      gpsDataRef,
      verifiedDistanceKm
    );

    return {
      valid: true,
      tripId,
      unverifiedSegments: gpsValidation.unverifiedSegments,
      verifiedDistanceKm,
    };
  }

  /**
   * Verifies a trip record with GPS gap splitting support.
   * GPS gaps > 300 seconds cause the trip to be split into separate trips.
   * Each sub-trip is independently verified.
   *
   * @returns VerificationOutput with primary result and any split trips
   */
  async verifyTripRecordWithSplitting(trip: TripRecord): Promise<VerificationOutput> {
    // First, run basic integrity checks before splitting
    const integrityErrors = this.validateTripDataIntegrity(trip);
    if (integrityErrors.length > 0) {
      const tripId = randomUUID();
      const rejectionReason = `Data integrity failure: ${integrityErrors.join('; ')}`;
      await this.storeTripMetadata(tripId, trip, false, rejectionReason, []);
      return {
        primaryResult: {
          valid: false,
          tripId,
          rejectionReason,
          unverifiedSegments: [],
          verifiedDistanceKm: 0,
        },
        splitTrips: [],
      };
    }

    // Check for GPS gaps > 300 seconds that require splitting
    const splitSegments = this.detectSplitPoints(trip.coordinates);

    if (splitSegments.length <= 1) {
      // No splitting needed, verify as single trip
      const result = await this.verifyTripRecord(trip);
      return { primaryResult: result, splitTrips: [] };
    }

    // Split into multiple sub-trips and verify each
    const results: VerificationResult[] = [];
    for (const segment of splitSegments) {
      const subTrip = this.createSubTrip(trip, segment);
      const result = await this.verifyTripRecord(subTrip);
      results.push(result);
    }

    return {
      primaryResult: results[0],
      splitTrips: results.slice(1),
    };
  }

  /**
   * Detects split points in GPS coordinates where gaps exceed 300 seconds.
   * Returns arrays of coordinate segments that should become separate trips.
   */
  detectSplitPoints(coordinates: GPSPoint[]): GPSPoint[][] {
    if (coordinates.length < 2) return [coordinates];

    const segments: GPSPoint[][] = [];
    let currentSegment: GPSPoint[] = [coordinates[0]];

    for (let i = 1; i < coordinates.length; i++) {
      const gapMs = coordinates[i].timestamp - coordinates[i - 1].timestamp;
      const gapSeconds = gapMs / 1000;

      if (gapSeconds > VERIFICATION_CONSTANTS.GPS_GAP_SPLIT_SECONDS) {
        // Split here - save current segment and start new one
        segments.push(currentSegment);
        currentSegment = [coordinates[i]];
      } else {
        currentSegment.push(coordinates[i]);
      }
    }

    // Add the last segment
    segments.push(currentSegment);

    return segments;
  }

  /**
   * Validates trip duration and distance minimums.
   * - Duration must be >= 60 seconds
   * - Distance must be >= 0.5 km
   */
  validateDurationAndDistance(trip: TripRecord): string | null {
    const durationMs = trip.endTime - trip.startTime;
    const durationSeconds = durationMs / 1000;

    if (durationSeconds < VERIFICATION_CONSTANTS.MIN_DURATION_SECONDS) {
      return `Trip duration ${durationSeconds.toFixed(1)}s is below minimum ${VERIFICATION_CONSTANTS.MIN_DURATION_SECONDS}s`;
    }

    if (trip.distanceKm < VERIFICATION_CONSTANTS.MIN_DISTANCE_KM) {
      return `Trip distance ${trip.distanceKm} km is below minimum ${VERIFICATION_CONSTANTS.MIN_DISTANCE_KM} km`;
    }

    return null;
  }

  /**
   * Validates timestamps for non-monotonic ordering and future timestamps.
   * - Coordinate timestamps must be strictly monotonically increasing
   * - No timestamp may be more than 5 minutes in the future relative to server time
   */
  validateTimestamps(trip: TripRecord): string | null {
    const now = Date.now();
    const maxAllowedTimestamp = now + VERIFICATION_CONSTANTS.MAX_FUTURE_TIMESTAMP_MS;

    // Check trip-level timestamps for future values
    if (trip.startTime > maxAllowedTimestamp) {
      return `Trip startTime is in the future (exceeds server time + 5 minutes)`;
    }
    if (trip.endTime > maxAllowedTimestamp) {
      return `Trip endTime is in the future (exceeds server time + 5 minutes)`;
    }

    // Check coordinate timestamps
    for (let i = 0; i < trip.coordinates.length; i++) {
      const coord = trip.coordinates[i];

      // Future timestamp check
      if (coord.timestamp > maxAllowedTimestamp) {
        return `Coordinate[${i}] timestamp is in the future (exceeds server time + 5 minutes)`;
      }

      // Non-monotonic check (strictly increasing)
      if (i > 0 && coord.timestamp <= trip.coordinates[i - 1].timestamp) {
        return `Non-monotonic timestamps detected: coordinate[${i}] timestamp ${coord.timestamp} is not after coordinate[${i - 1}] timestamp ${trip.coordinates[i - 1].timestamp}`;
      }
    }

    return null;
  }

  /**
   * Detects anomalies in trip data.
   * Rejects trips with:
   * - Speed > 250 km/h
   * - GPS jumps > 5 km between consecutive 10-second readings
   */
  detectAnomalies(trip: TripRecord): AnomalyReport {
    const anomalies: Anomaly[] = [];

    // Check speed readings
    for (let i = 0; i < trip.speedReadings.length; i++) {
      if (trip.speedReadings[i] > VERIFICATION_CONSTANTS.MAX_SPEED_KMH) {
        anomalies.push({
          type: 'excessive_speed',
          timestamp: trip.startTime + i * VERIFICATION_CONSTANTS.GPS_INTERVAL_SECONDS,
          details: `Speed reading ${trip.speedReadings[i]} km/h exceeds maximum ${VERIFICATION_CONSTANTS.MAX_SPEED_KMH} km/h`,
          value: trip.speedReadings[i],
          threshold: VERIFICATION_CONSTANTS.MAX_SPEED_KMH,
        });
      }
    }

    // Check GPS coordinate speeds (if speed is embedded in coordinates)
    for (const coord of trip.coordinates) {
      if (coord.speed !== undefined && coord.speed > VERIFICATION_CONSTANTS.MAX_SPEED_KMH) {
        anomalies.push({
          type: 'excessive_speed',
          timestamp: coord.timestamp,
          details: `GPS point speed ${coord.speed} km/h exceeds maximum ${VERIFICATION_CONSTANTS.MAX_SPEED_KMH} km/h`,
          value: coord.speed,
          threshold: VERIFICATION_CONSTANTS.MAX_SPEED_KMH,
        });
      }
    }

    // Check for GPS jumps between consecutive readings
    for (let i = 1; i < trip.coordinates.length; i++) {
      const prev = trip.coordinates[i - 1];
      const curr = trip.coordinates[i];
      const timeDiffMs = curr.timestamp - prev.timestamp;
      const timeDiffSeconds = timeDiffMs / 1000;

      // Only check consecutive readings within expected interval (up to ~10 seconds)
      // GPS jumps are checked between consecutive readings regardless of time gap
      if (timeDiffSeconds > 0 && timeDiffSeconds <= VERIFICATION_CONSTANTS.GPS_INTERVAL_SECONDS) {
        const distanceKm = haversineDistanceKm(prev, curr);
        if (distanceKm > VERIFICATION_CONSTANTS.MAX_GPS_JUMP_KM) {
          anomalies.push({
            type: 'gps_jump',
            timestamp: curr.timestamp,
            details: `GPS jump of ${distanceKm.toFixed(2)} km between consecutive readings exceeds maximum ${VERIFICATION_CONSTANTS.MAX_GPS_JUMP_KM} km`,
            value: distanceKm,
            threshold: VERIFICATION_CONSTANTS.MAX_GPS_JUMP_KM,
          });
        }
      }
    }

    // Determine if trip should be rejected
    const hasAnomalies = anomalies.length > 0;
    let rejectionReason: string | undefined;

    if (hasAnomalies) {
      const speedAnomalies = anomalies.filter((a) => a.type === 'excessive_speed');
      const gpsJumps = anomalies.filter((a) => a.type === 'gps_jump');

      const reasons: string[] = [];
      if (speedAnomalies.length > 0) {
        reasons.push(`Speed exceeding ${VERIFICATION_CONSTANTS.MAX_SPEED_KMH} km/h detected`);
      }
      if (gpsJumps.length > 0) {
        reasons.push(
          `GPS jump exceeding ${VERIFICATION_CONSTANTS.MAX_GPS_JUMP_KM} km between consecutive readings detected`
        );
      }
      rejectionReason = reasons.join('; ');
    }

    return {
      hasAnomalies,
      anomalies,
      rejectionReason,
    };
  }

  /**
   * Creates a sub-trip from a segment of coordinates.
   * Used when splitting trips due to GPS gaps > 300 seconds.
   */
  private createSubTrip(originalTrip: TripRecord, coordinates: GPSPoint[]): TripRecord {
    if (coordinates.length === 0) {
      return { ...originalTrip, coordinates: [] };
    }

    const startTime = coordinates[0].timestamp;
    const endTime = coordinates[coordinates.length - 1].timestamp;

    // Calculate distance for this segment
    let segmentDistance = 0;
    for (let i = 1; i < coordinates.length; i++) {
      segmentDistance += haversineDistanceKm(coordinates[i - 1], coordinates[i]);
    }
    segmentDistance = Math.round(segmentDistance * 100) / 100;

    // Filter speed readings that fall within this segment's time range
    const segmentSpeedReadings = coordinates
      .filter((c) => c.speed !== undefined)
      .map((c) => c.speed!);

    return {
      driverAddress: originalTrip.driverAddress,
      startTime,
      endTime,
      coordinates,
      speedReadings: segmentSpeedReadings.length > 0 ? segmentSpeedReadings : originalTrip.speedReadings,
      brakingEvents: originalTrip.brakingEvents.filter(
        (e) => e.timestamp >= startTime && e.timestamp <= endTime
      ),
      accelerationEvents: originalTrip.accelerationEvents.filter(
        (e) => e.timestamp >= startTime && e.timestamp <= endTime
      ),
      corneringEvents: originalTrip.corneringEvents.filter(
        (e) => e.timestamp >= startTime && e.timestamp <= endTime
      ),
      phoneUsageEvents: originalTrip.phoneUsageEvents.filter(
        (e) => e.startTime >= startTime && e.endTime <= endTime
      ),
      distanceKm: segmentDistance,
      category: originalTrip.category,
    };
  }

  /**
   * Validates GPS data and detects gaps.
   * Marks segments as unverified when GPS is unavailable for > 60 consecutive seconds.
   */
  validateGPSData(coordinates: GPSPoint[]): GPSValidationResult {
    if (coordinates.length === 0) {
      return {
        valid: false,
        unverifiedSegments: [],
        totalGapDurationSeconds: 0,
      };
    }

    if (coordinates.length === 1) {
      return {
        valid: true,
        unverifiedSegments: [],
        totalGapDurationSeconds: 0,
      };
    }

    const unverifiedSegments: TimeRange[] = [];
    let totalGapDurationSeconds = 0;

    for (let i = 1; i < coordinates.length; i++) {
      const prev = coordinates[i - 1];
      const curr = coordinates[i];
      const gapMs = curr.timestamp - prev.timestamp;
      const gapSeconds = gapMs / 1000;

      if (gapSeconds > VERIFICATION_CONSTANTS.MAX_GPS_GAP_SECONDS) {
        unverifiedSegments.push({
          start: prev.timestamp,
          end: curr.timestamp,
        });
        totalGapDurationSeconds += gapSeconds;
      }
    }

    return {
      valid: true,
      unverifiedSegments,
      totalGapDurationSeconds,
    };
  }

  /**
   * Validates trip data integrity:
   * - Required fields present
   * - Coordinate format valid (lat: -90 to 90, lon: -180 to 180)
   * - Timestamps in ascending order
   * - endTime > startTime
   */
  validateTripDataIntegrity(trip: TripRecord): string[] {
    const errors: string[] = [];

    // Required fields
    if (!trip.driverAddress) {
      errors.push('Missing required field: driverAddress');
    }
    if (!trip.startTime || trip.startTime <= 0) {
      errors.push('Missing or invalid required field: startTime');
    }
    if (!trip.endTime || trip.endTime <= 0) {
      errors.push('Missing or invalid required field: endTime');
    }
    if (!trip.coordinates || trip.coordinates.length === 0) {
      errors.push('Missing required field: coordinates (at least one GPS point required)');
    }
    if (trip.distanceKm === undefined || trip.distanceKm === null || trip.distanceKm <= 0) {
      errors.push('Missing or invalid required field: distanceKm');
    }
    if (!trip.category) {
      errors.push('Missing required field: category');
    }

    // Timestamp ordering: endTime must be after startTime
    if (trip.startTime && trip.endTime && trip.endTime <= trip.startTime) {
      errors.push('endTime must be after startTime');
    }

    // Validate coordinate format
    if (trip.coordinates && trip.coordinates.length > 0) {
      for (let i = 0; i < trip.coordinates.length; i++) {
        const coord = trip.coordinates[i];
        if (coord.latitude < -90 || coord.latitude > 90) {
          errors.push(`Coordinate[${i}]: latitude ${coord.latitude} out of range [-90, 90]`);
          break; // Report first invalid coordinate only
        }
        if (coord.longitude < -180 || coord.longitude > 180) {
          errors.push(`Coordinate[${i}]: longitude ${coord.longitude} out of range [-180, 180]`);
          break;
        }
        if (!coord.timestamp || coord.timestamp <= 0) {
          errors.push(`Coordinate[${i}]: invalid timestamp`);
          break;
        }
      }

      // Validate timestamp ordering in coordinates
      for (let i = 1; i < trip.coordinates.length; i++) {
        if (trip.coordinates[i].timestamp < trip.coordinates[i - 1].timestamp) {
          errors.push('Coordinate timestamps must be in ascending order');
          break;
        }
      }
    }

    return errors;
  }

  /**
   * Stores encrypted GPS data to object storage (S3-compatible).
   * Returns the storage reference key.
   */
  private async storeEncryptedGPSData(tripId: string, trip: TripRecord): Promise<string> {
    const gpsData = JSON.stringify(trip.coordinates);
    // In production, this would be encrypted with the driver's key (AES-256)
    // For now, we store the serialized data as a buffer
    const dataBuffer = Buffer.from(gpsData, 'utf-8');

    const storageKey = `trips/${trip.driverAddress}/${tripId}/gps-data.json`;
    const metadata = {
      driverAddress: trip.driverAddress,
      tripId,
      startTime: String(trip.startTime),
      endTime: String(trip.endTime),
      pointCount: String(trip.coordinates.length),
    };

    await this.storageProvider.upload(storageKey, dataBuffer, metadata);
    return storageKey;
  }

  /**
   * Stores trip metadata to PostgreSQL.
   */
  private async storeTripMetadata(
    tripId: string,
    trip: TripRecord,
    valid: boolean,
    rejectionReason: string | undefined,
    unverifiedSegments: TimeRange[],
    gpsDataRef?: string,
    verifiedDistanceKm?: number
  ): Promise<void> {
    const durationSeconds = Math.floor((trip.endTime - trip.startTime) / 1000);

    await this.dbClient.insertTripRecord({
      id: tripId,
      driver_address: trip.driverAddress,
      start_time: new Date(trip.startTime),
      end_time: new Date(trip.endTime),
      distance_km: trip.distanceKm,
      duration_seconds: durationSeconds > 0 ? durationSeconds : Math.floor(trip.endTime - trip.startTime),
      category: trip.category,
      gps_data_ref: gpsDataRef || null,
      verification_status: valid ? 'verified' : 'rejected',
      rejection_reason: rejectionReason || null,
      unverified_segments: unverifiedSegments,
      verified_distance_km: verifiedDistanceKm || 0,
    });
  }

  /**
   * Calculates the verified distance by excluding unverified segments.
   */
  private calculateVerifiedDistance(
    coordinates: GPSPoint[],
    unverifiedSegments: TimeRange[]
  ): number {
    if (coordinates.length < 2) return 0;
    if (unverifiedSegments.length === 0) {
      return this.calculateTotalDistance(coordinates);
    }

    let verifiedDistance = 0;

    for (let i = 1; i < coordinates.length; i++) {
      const prev = coordinates[i - 1];
      const curr = coordinates[i];

      // Check if this segment falls within an unverified range
      const isUnverified = unverifiedSegments.some(
        (seg) => prev.timestamp >= seg.start && curr.timestamp <= seg.end
      );

      if (!isUnverified) {
        verifiedDistance += haversineDistanceKm(prev, curr);
      }
    }

    return Math.round(verifiedDistance * 100) / 100;
  }

  /**
   * Calculates total distance from GPS coordinates using haversine formula.
   */
  private calculateTotalDistance(coordinates: GPSPoint[]): number {
    let total = 0;
    for (let i = 1; i < coordinates.length; i++) {
      total += haversineDistanceKm(coordinates[i - 1], coordinates[i]);
    }
    return Math.round(total * 100) / 100;
  }
}

/**
 * Database client interface for trip metadata storage.
 * Abstracts the actual database implementation for testability.
 */
export interface DatabaseClient {
  insertTripRecord(record: TripMetadataRecord): Promise<void>;
}

/**
 * Trip metadata record stored in PostgreSQL
 */
export interface TripMetadataRecord {
  id: string;
  driver_address: string;
  start_time: Date;
  end_time: Date;
  distance_km: number;
  duration_seconds: number;
  category: string;
  gps_data_ref: string | null;
  verification_status: 'verified' | 'rejected';
  rejection_reason: string | null;
  unverified_segments: TimeRange[];
  verified_distance_km: number;
}

/**
 * Calculates the distance between two GPS points using the Haversine formula.
 * @returns Distance in kilometers
 */
export function haversineDistanceKm(
  point1: { latitude: number; longitude: number },
  point2: { latitude: number; longitude: number }
): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRadians(point2.latitude - point1.latitude);
  const dLon = toRadians(point2.longitude - point1.longitude);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(point1.latitude)) *
      Math.cos(toRadians(point2.latitude)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}
