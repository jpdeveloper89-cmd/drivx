import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { ScoringEngine, ScoringDatabaseClient, SafetyRegistryClient } from './ScoringEngine';
import {
  VerifiedTrip,
  ScoringFactors,
  SCORING_CONSTANTS,
  SCORING_WEIGHTS,
} from './types';

/**
 * Property-Based Tests for ScoringEngine
 *
 * Validates: Requirements 1.2, 1.5, 4.4
 */

// --- Arbitraries (Generators) ---

/**
 * Generate a valid ScoringFactors object with each factor in [0, 1000].
 */
const scoringFactorsArb: fc.Arbitrary<ScoringFactors> = fc.record({
  speedCompliance: fc.integer({ min: 0, max: 1000 }),
  brakingSmooth: fc.integer({ min: 0, max: 1000 }),
  accelerationPattern: fc.integer({ min: 0, max: 1000 }),
  corneringSafety: fc.integer({ min: 0, max: 1000 }),
  phoneAvoidance: fc.integer({ min: 0, max: 1000 }),
  timeOfDayRisk: fc.integer({ min: 0, max: 1000 }),
});

/**
 * Generate a valid array of trip scores (each in [0, 1000]) for rolling average tests.
 * Size constrained to 1-100 to match the rolling window.
 */
const tripScoresArb: fc.Arbitrary<number[]> = fc.array(
  fc.integer({ min: 0, max: 1000 }),
  { minLength: 1, maxLength: 100 }
);

/**
 * Generate an overall score in [0, 1000] for DVX reward computation.
 */
const overallScoreArb: fc.Arbitrary<number> = fc.integer({ min: 0, max: 1000 });

/**
 * Generate a valid VerifiedTrip with constrained random data.
 */
const verifiedTripArb: fc.Arbitrary<VerifiedTrip> = fc.record({
  tripId: fc.string({ minLength: 1, maxLength: 36 }),
  driverAddress: fc.hexaString({ minLength: 40, maxLength: 40 }).map((s) => `0x${s}`),
  startTime: fc.integer({ min: 1600000000000, max: 1700000000000 }),
  endTime: fc.integer({ min: 1700000000001, max: 1800000000000 }),
  coordinates: fc.array(
    fc.record({
      latitude: fc.double({ min: -90, max: 90, noNaN: true }),
      longitude: fc.double({ min: -180, max: 180, noNaN: true }),
      timestamp: fc.integer({ min: 1600000000000, max: 1800000000000 }),
    }),
    { minLength: 1, maxLength: 20 }
  ),
  speedReadings: fc.array(fc.double({ min: 0, max: 300, noNaN: true }), {
    minLength: 0,
    maxLength: 50,
  }),
  brakingEvents: fc.array(
    fc.record({
      timestamp: fc.integer({ min: 1600000000000, max: 1800000000000 }),
      deceleration: fc.double({ min: 0, max: 15, noNaN: true }),
      duration: fc.double({ min: 0.1, max: 10, noNaN: true }),
    }),
    { minLength: 0, maxLength: 20 }
  ),
  accelerationEvents: fc.array(
    fc.record({
      timestamp: fc.integer({ min: 1600000000000, max: 1800000000000 }),
      acceleration: fc.double({ min: 0, max: 15, noNaN: true }),
      duration: fc.double({ min: 0.1, max: 10, noNaN: true }),
    }),
    { minLength: 0, maxLength: 20 }
  ),
  corneringEvents: fc.array(
    fc.record({
      timestamp: fc.integer({ min: 1600000000000, max: 1800000000000 }),
      lateralG: fc.double({ min: 0, max: 2, noNaN: true }),
      duration: fc.double({ min: 0.1, max: 10, noNaN: true }),
    }),
    { minLength: 0, maxLength: 20 }
  ),
  phoneUsageEvents: fc.array(
    fc.record({
      startTime: fc.integer({ min: 1600000000000, max: 1700000000000 }),
      endTime: fc.integer({ min: 1700000000001, max: 1800000000000 }),
      type: fc.constantFrom('screen_on' as const, 'interaction' as const, 'call' as const),
    }),
    { minLength: 0, maxLength: 10 }
  ),
  distanceKm: fc.double({ min: 0, max: 500, noNaN: true }),
  verifiedDistanceKm: fc.double({ min: 0, max: 500, noNaN: true }),
  unverifiedSegments: fc.array(
    fc.record({
      start: fc.integer({ min: 1600000000000, max: 1700000000000 }),
      end: fc.integer({ min: 1700000000001, max: 1800000000000 }),
    }),
    { minLength: 0, maxLength: 5 }
  ),
  category: fc.constantFrom(
    'commute' as const,
    'delivery' as const,
    'rideshare' as const,
    'long-distance' as const
  ),
});

// --- Mock setup ---

function createMockDb(): ScoringDatabaseClient {
  return {
    getDriverByAddress: async () => ({
      id: 'driver-1',
      wallet_address: '0x0000000000000000000000000000000000000001',
      safety_score: 500,
      score_status: 'Provisional' as const,
      total_trips: 5,
      total_kilometers: 50,
    }),
    getRecentTripScores: async () => [700, 750, 800],
    getRecentTripFactors: async () => [],
    storeTripScore: async () => {},
    updateDriverScore: async () => {},
  };
}

function createMockRegistry(): SafetyRegistryClient {
  return {
    updateSafetyScore: async () => {},
  };
}

// --- Property Tests ---

describe('ScoringEngine Property Tests', () => {
  let engine: ScoringEngine;

  beforeEach(() => {
    engine = new ScoringEngine(createMockDb(), createMockRegistry());
  });

  describe('Property 1: Safety Score Computation Bounds and Weights', () => {
    /**
     * **Validates: Requirements 1.2**
     *
     * The overall score computed from any valid factor combination must always
     * be within [0, 1000], and the scoring weights must sum to 1.0.
     */

    it('overall score is always within [0, 1000] for any valid factors', () => {
      fc.assert(
        fc.property(scoringFactorsArb, (factors) => {
          const score = engine.computeOverallScore(factors);
          expect(score).toBeGreaterThanOrEqual(SCORING_CONSTANTS.MIN_SCORE);
          expect(score).toBeLessThanOrEqual(SCORING_CONSTANTS.MAX_SCORE);
        }),
        { numRuns: 1000 }
      );
    });

    it('scoring weights sum to exactly 1.0', () => {
      const totalWeight =
        SCORING_WEIGHTS.speedCompliance +
        SCORING_WEIGHTS.brakingSmooth +
        SCORING_WEIGHTS.accelerationPattern +
        SCORING_WEIGHTS.corneringSafety +
        SCORING_WEIGHTS.phoneAvoidance +
        SCORING_WEIGHTS.timeOfDayRisk;

      expect(totalWeight).toBeCloseTo(1.0, 10);
    });

    it('all individual factor scores from computeFactors are within [0, 1000]', () => {
      fc.assert(
        fc.property(verifiedTripArb, (trip) => {
          const factors = engine.computeFactors(trip);
          expect(factors.speedCompliance).toBeGreaterThanOrEqual(0);
          expect(factors.speedCompliance).toBeLessThanOrEqual(1000);
          expect(factors.brakingSmooth).toBeGreaterThanOrEqual(0);
          expect(factors.brakingSmooth).toBeLessThanOrEqual(1000);
          expect(factors.accelerationPattern).toBeGreaterThanOrEqual(0);
          expect(factors.accelerationPattern).toBeLessThanOrEqual(1000);
          expect(factors.corneringSafety).toBeGreaterThanOrEqual(0);
          expect(factors.corneringSafety).toBeLessThanOrEqual(1000);
          expect(factors.phoneAvoidance).toBeGreaterThanOrEqual(0);
          expect(factors.phoneAvoidance).toBeLessThanOrEqual(1000);
          expect(factors.timeOfDayRisk).toBeGreaterThanOrEqual(0);
          expect(factors.timeOfDayRisk).toBeLessThanOrEqual(1000);
        }),
        { numRuns: 500 }
      );
    });

    it('computeTripScore overall is always within [0, 1000]', () => {
      fc.assert(
        fc.property(verifiedTripArb, (trip) => {
          const result = engine.computeTripScore(trip);
          expect(result.overall).toBeGreaterThanOrEqual(SCORING_CONSTANTS.MIN_SCORE);
          expect(result.overall).toBeLessThanOrEqual(SCORING_CONSTANTS.MAX_SCORE);
        }),
        { numRuns: 500 }
      );
    });

    it('overall score is monotonically non-decreasing when all factors increase', () => {
      fc.assert(
        fc.property(
          scoringFactorsArb,
          fc.integer({ min: 0, max: 100 }),
          (factors, increment) => {
            const score1 = engine.computeOverallScore(factors);
            const boostedFactors: ScoringFactors = {
              speedCompliance: Math.min(1000, factors.speedCompliance + increment),
              brakingSmooth: Math.min(1000, factors.brakingSmooth + increment),
              accelerationPattern: Math.min(1000, factors.accelerationPattern + increment),
              corneringSafety: Math.min(1000, factors.corneringSafety + increment),
              phoneAvoidance: Math.min(1000, factors.phoneAvoidance + increment),
              timeOfDayRisk: Math.min(1000, factors.timeOfDayRisk + increment),
            };
            const score2 = engine.computeOverallScore(boostedFactors);
            expect(score2).toBeGreaterThanOrEqual(score1);
          }
        ),
        { numRuns: 500 }
      );
    });
  });

  describe('Property 2: Rolling Average with Exponential Decay', () => {
    /**
     * **Validates: Requirements 1.5**
     *
     * The rolling average with exponential decay must:
     * - Always produce a result within [0, 1000]
     * - Weight recent trips more heavily than older trips
     */

    it('rolling average is always within [0, 1000]', () => {
      fc.assert(
        fc.property(tripScoresArb, (scores) => {
          const avg = engine.computeRollingAverage(scores);
          expect(avg).toBeGreaterThanOrEqual(SCORING_CONSTANTS.MIN_SCORE);
          expect(avg).toBeLessThanOrEqual(SCORING_CONSTANTS.MAX_SCORE);
        }),
        { numRuns: 1000 }
      );
    });

    it('rolling average of identical scores equals that score', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 1000 }),
          fc.integer({ min: 1, max: 100 }),
          (score, count) => {
            const scores = Array(count).fill(score);
            const avg = engine.computeRollingAverage(scores);
            expect(avg).toBe(score);
          }
        ),
        { numRuns: 500 }
      );
    });

    it('recent trips are weighted more heavily than older trips', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 100, max: 400 }),
          fc.integer({ min: 600, max: 1000 }),
          fc.integer({ min: 3, max: 50 }),
          (lowScore, highScore, halfSize) => {
            // Array where recent trips (index 0) are high, older trips are low
            const recentHigh = [
              ...Array(halfSize).fill(highScore),
              ...Array(halfSize).fill(lowScore),
            ];
            // Array where recent trips (index 0) are low, older trips are high
            const recentLow = [
              ...Array(halfSize).fill(lowScore),
              ...Array(halfSize).fill(highScore),
            ];

            const avgRecentHigh = engine.computeRollingAverage(recentHigh);
            const avgRecentLow = engine.computeRollingAverage(recentLow);

            // With exponential decay, recent high scores should produce higher average
            expect(avgRecentHigh).toBeGreaterThan(avgRecentLow);
          }
        ),
        { numRuns: 500 }
      );
    });

    it('rolling average is bounded by min and max of input scores', () => {
      fc.assert(
        fc.property(tripScoresArb, (scores) => {
          const avg = engine.computeRollingAverage(scores);
          const minScore = Math.min(...scores);
          const maxScore = Math.max(...scores);
          // Due to rounding, allow ±1 tolerance
          expect(avg).toBeGreaterThanOrEqual(minScore - 1);
          expect(avg).toBeLessThanOrEqual(maxScore + 1);
        }),
        { numRuns: 500 }
      );
    });
  });

  describe('Property 11: DVX Trip Reward Bounds', () => {
    /**
     * **Validates: Requirements 4.4**
     *
     * The DVX reward for any trip must:
     * - Never exceed 50 DVX (MAX_DVX_REWARD)
     * - Always be non-negative (>= 0)
     */

    it('DVX reward is always within [0, 50] for any overall score', () => {
      fc.assert(
        fc.property(overallScoreArb, (overall) => {
          const reward = engine.computeDvxReward(overall);
          expect(reward).toBeGreaterThanOrEqual(SCORING_CONSTANTS.MIN_DVX_REWARD);
          expect(reward).toBeLessThanOrEqual(SCORING_CONSTANTS.MAX_DVX_REWARD);
        }),
        { numRuns: 1000 }
      );
    });

    it('DVX reward is monotonically non-decreasing with overall score', () => {
      fc.assert(
        fc.property(
          overallScoreArb,
          overallScoreArb,
          (score1, score2) => {
            const reward1 = engine.computeDvxReward(score1);
            const reward2 = engine.computeDvxReward(score2);
            if (score1 <= score2) {
              expect(reward1).toBeLessThanOrEqual(reward2);
            } else {
              expect(reward1).toBeGreaterThanOrEqual(reward2);
            }
          }
        ),
        { numRuns: 500 }
      );
    });

    it('DVX reward from computeTripScore is always within [0, 50]', () => {
      fc.assert(
        fc.property(verifiedTripArb, (trip) => {
          const result = engine.computeTripScore(trip);
          expect(result.dvxReward).toBeGreaterThanOrEqual(SCORING_CONSTANTS.MIN_DVX_REWARD);
          expect(result.dvxReward).toBeLessThanOrEqual(SCORING_CONSTANTS.MAX_DVX_REWARD);
        }),
        { numRuns: 500 }
      );
    });

    it('maximum score yields maximum reward', () => {
      const reward = engine.computeDvxReward(SCORING_CONSTANTS.MAX_SCORE);
      expect(reward).toBe(SCORING_CONSTANTS.MAX_DVX_REWARD);
    });

    it('minimum score yields minimum reward', () => {
      const reward = engine.computeDvxReward(SCORING_CONSTANTS.MIN_SCORE);
      expect(reward).toBe(SCORING_CONSTANTS.MIN_DVX_REWARD);
    });
  });
});
