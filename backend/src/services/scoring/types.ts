/**
 * Scoring Engine Types
 * Defines interfaces for trip scoring, safety score computation, and DVX rewards.
 *
 * Requirements: 1.2, 1.5, 1.8, 4.4
 */

import {
  BrakingEvent,
  AccelerationEvent,
  CorneringEvent,
  PhoneEvent,
  GPSPoint,
  TimeRange,
} from '../tripVerification/types';

/**
 * A verified trip that has passed the Trip Verification Engine.
 * Contains all data needed for scoring.
 */
export interface VerifiedTrip {
  tripId: string;
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
  verifiedDistanceKm: number;
  unverifiedSegments: TimeRange[];
  category: 'commute' | 'delivery' | 'rideshare' | 'long-distance';
}

/**
 * Individual factor scores (0-1000 each)
 */
export interface ScoringFactors {
  speedCompliance: number;
  brakingSmooth: number;
  accelerationPattern: number;
  corneringSafety: number;
  phoneAvoidance: number;
  timeOfDayRisk: number;
}

/**
 * Trip score result after computing all factors
 */
export interface TripScore {
  overall: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  factors: ScoringFactors;
  dvxReward: number;
}

/**
 * Complete score breakdown for a driver
 */
export interface ScoreBreakdown {
  overall: number;
  speedCompliance: number;
  brakingSmooth: number;
  accelerationPattern: number;
  corneringSafety: number;
  phoneAvoidance: number;
  timeOfDayRisk: number;
  status: 'Provisional' | 'Verified';
  tripCount: number;
  totalKm: number;
}

/**
 * Driver record from the database
 */
export interface DriverRecord {
  id: string;
  wallet_address: string;
  safety_score: number;
  score_status: 'Provisional' | 'Verified';
  total_trips: number;
  total_kilometers: number;
}

/**
 * Trip score record stored in the database
 */
export interface TripScoreRecord {
  trip_id: string;
  driver_address: string;
  trip_score: number;
  grade: string;
  speed_compliance_score: number;
  braking_score: number;
  acceleration_score: number;
  cornering_score: number;
  phone_avoidance_score: number;
  time_risk_score: number;
  dvx_reward: number;
}

/**
 * Scoring weight configuration
 * Weights must sum to 1.0
 */
export const SCORING_WEIGHTS = {
  speedCompliance: 0.25,
  brakingSmooth: 0.20,
  accelerationPattern: 0.15,
  corneringSafety: 0.15,
  phoneAvoidance: 0.15,
  timeOfDayRisk: 0.10,
} as const;

/**
 * Scoring constants
 */
export const SCORING_CONSTANTS = {
  /** Maximum Safety Score */
  MAX_SCORE: 1000,
  /** Minimum Safety Score */
  MIN_SCORE: 0,
  /** Number of recent trips used for rolling average */
  ROLLING_WINDOW_SIZE: 100,
  /** Exponential decay factor (lambda) for weighting recent trips */
  DECAY_FACTOR: 0.05,
  /** Maximum DVX reward per trip */
  MAX_DVX_REWARD: 50,
  /** Minimum DVX reward per trip */
  MIN_DVX_REWARD: 0,
  /** Minimum trips required for "Verified" status */
  MIN_TRIPS_FOR_VERIFIED: 10,
  /** Minimum kilometers required for "Verified" status */
  MIN_KM_FOR_VERIFIED: 100,
  /** Harsh braking threshold (m/s²) */
  HARSH_BRAKING_THRESHOLD: 4.0,
  /** Harsh acceleration threshold (m/s²) */
  HARSH_ACCELERATION_THRESHOLD: 3.5,
  /** Lateral g-force threshold for unsafe cornering */
  UNSAFE_CORNERING_G: 0.3,
  /** High-risk hours (midnight to 5 AM) */
  HIGH_RISK_HOUR_START: 0,
  HIGH_RISK_HOUR_END: 5,
} as const;
