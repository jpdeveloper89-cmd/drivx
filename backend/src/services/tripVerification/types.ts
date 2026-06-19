/**
 * Trip Verification Engine Types
 * Defines interfaces for trip verification, anomaly detection, and GPS validation.
 */

/**
 * GPS coordinate point with timestamp
 */
export interface GPSPoint {
  latitude: number;
  longitude: number;
  timestamp: number;
  speed?: number;
}

/**
 * Braking event during a trip
 */
export interface BrakingEvent {
  timestamp: number;
  deceleration: number;
  duration: number;
}

/**
 * Acceleration event during a trip
 */
export interface AccelerationEvent {
  timestamp: number;
  acceleration: number;
  duration: number;
}

/**
 * Cornering event during a trip
 */
export interface CorneringEvent {
  timestamp: number;
  lateralG: number;
  duration: number;
}

/**
 * Phone usage event during a trip
 */
export interface PhoneEvent {
  startTime: number;
  endTime: number;
  type: 'screen_on' | 'interaction' | 'call';
}

/**
 * A time range representing a segment of a trip
 */
export interface TimeRange {
  start: number;
  end: number;
}

/**
 * Complete trip record submitted from the mobile app
 */
export interface TripRecord {
  driverAddress: string;
  startTime: number;
  endTime: number;
  coordinates: GPSPoint[];
  speedReadings: number[];
  brakingEvents: BrakingEvent[];
  accelerationEvents: AccelerationEvent[];
  corneringEvents: CorneringEvent[];
  phoneUsageEvents: PhoneEvent[];
  distanceKm: number;
  category: 'commute' | 'delivery' | 'rideshare' | 'long-distance';
}

/**
 * Result of trip verification
 */
export interface VerificationResult {
  valid: boolean;
  tripId: string;
  rejectionReason?: string;
  unverifiedSegments: TimeRange[];
  verifiedDistanceKm: number;
}

/**
 * Anomaly detected in trip data
 */
export interface Anomaly {
  type: 'excessive_speed' | 'gps_jump';
  timestamp: number;
  details: string;
  value: number;
  threshold: number;
}

/**
 * Report of anomalies found in a trip
 */
export interface AnomalyReport {
  hasAnomalies: boolean;
  anomalies: Anomaly[];
  rejectionReason?: string;
}

/**
 * Result of GPS data validation
 */
export interface GPSValidationResult {
  valid: boolean;
  unverifiedSegments: TimeRange[];
  totalGapDurationSeconds: number;
}

/**
 * Result of trip verification that may produce multiple trips (due to GPS gap splitting)
 */
export interface VerificationOutput {
  /** Primary verification result */
  primaryResult: VerificationResult;
  /** Additional trips created from GPS gap splitting (gaps > 300 seconds) */
  splitTrips: VerificationResult[];
}

/**
 * Configuration constants for the verification engine
 */
export const VERIFICATION_CONSTANTS = {
  /** Maximum allowed speed in km/h before trip is rejected */
  MAX_SPEED_KMH: 250,
  /** Maximum allowed GPS jump distance in km between consecutive 10-second readings */
  MAX_GPS_JUMP_KM: 5,
  /** Maximum GPS gap in seconds before segment is marked unverified */
  MAX_GPS_GAP_SECONDS: 60,
  /** GPS gap in seconds that triggers trip splitting */
  GPS_GAP_SPLIT_SECONDS: 300,
  /** Expected GPS reading interval in seconds */
  GPS_INTERVAL_SECONDS: 10,
  /** Minimum trip duration in seconds */
  MIN_DURATION_SECONDS: 60,
  /** Minimum trip distance in km */
  MIN_DISTANCE_KM: 0.5,
  /** Maximum allowed future timestamp offset in milliseconds (5 minutes) */
  MAX_FUTURE_TIMESTAMP_MS: 5 * 60 * 1000,
} as const;
