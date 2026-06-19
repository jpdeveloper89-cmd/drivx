import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ScoringEngine, ScoringDatabaseClient, SafetyRegistryClient } from './ScoringEngine';
import { VerifiedTrip, SCORING_CONSTANTS, SCORING_WEIGHTS, TripScoreRecord } from './types';

/**
 * Creates a mock ScoringDatabaseClient
 */
function createMockDb(overrides?: Partial<ScoringDatabaseClient>): ScoringDatabaseClient {
  return {
    getDriverByAddress: vi.fn().mockResolvedValue({
      id: 'driver-1',
      wallet_address: '0x1234567890abcdef1234567890abcdef12345678',
      safety_score: 750,
      score_status: 'Provisional',
      total_trips: 5,
      total_kilometers: 50,
    }),
    getRecentTripScores: vi.fn().mockResolvedValue([800, 750, 700]),
    getRecentTripFactors: vi.fn().mockResolvedValue([]),
    storeTripScore: vi.fn().mockResolvedValue(undefined),
    updateDriverScore: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

/**
 * Creates a mock SafetyRegistryClient
 */
function createMockRegistry(): SafetyRegistryClient {
  return {
    updateSafetyScore: vi.fn().mockResolvedValue(undefined),
  };
}

/**
 * Creates a valid verified trip for testing
 */
function createVerifiedTrip(overrides?: Partial<VerifiedTrip>): VerifiedTrip {
  const startTime = 1700000000000; // Daytime (not high-risk hours)

  return {
    tripId: 'trip-123',
    driverAddress: '0x1234567890abcdef1234567890abcdef12345678',
    startTime,
    endTime: startTime + 1800000, // 30 minutes
    coordinates: [
      { latitude: 40.7128, longitude: -74.006, timestamp: startTime },
      { latitude: 40.7228, longitude: -74.006, timestamp: startTime + 900000 },
      { latitude: 40.7328, longitude: -74.006, timestamp: startTime + 1800000 },
    ],
    speedReadings: [60, 65, 70, 55, 60, 50, 55, 65, 60, 55],
    brakingEvents: [],
    accelerationEvents: [],
    corneringEvents: [],
    phoneUsageEvents: [],
    distanceKm: 15,
    verifiedDistanceKm: 15,
    unverifiedSegments: [],
    category: 'commute',
    ...overrides,
  };
}

describe('ScoringEngine', () => {
  let engine: ScoringEngine;
  let mockDb: ScoringDatabaseClient;
  let mockRegistry: SafetyRegistryClient;

  beforeEach(() => {
    mockDb = createMockDb();
    mockRegistry = createMockRegistry();
    engine = new ScoringEngine(mockDb, mockRegistry);
  });

  describe('computeTripScore', () => {
    it('should compute a high score for a perfect trip', () => {
      const trip = createVerifiedTrip();
      const result = engine.computeTripScore(trip);

      expect(result.overall).toBeGreaterThanOrEqual(SCORING_CONSTANTS.MIN_SCORE);
      expect(result.overall).toBeLessThanOrEqual(SCORING_CONSTANTS.MAX_SCORE);
      expect(result.overall).toBeGreaterThan(800); // Good trip should score well
      expect(result.grade).toBe('A');
      expect(result.dvxReward).toBeGreaterThan(0);
      expect(result.dvxReward).toBeLessThanOrEqual(SCORING_CONSTANTS.MAX_DVX_REWARD);
    });

    it('should return all factor scores within [0, 1000]', () => {
      const trip = createVerifiedTrip();
      const result = engine.computeTripScore(trip);

      expect(result.factors.speedCompliance).toBeGreaterThanOrEqual(0);
      expect(result.factors.speedCompliance).toBeLessThanOrEqual(1000);
      expect(result.factors.brakingSmooth).toBeGreaterThanOrEqual(0);
      expect(result.factors.brakingSmooth).toBeLessThanOrEqual(1000);
      expect(result.factors.accelerationPattern).toBeGreaterThanOrEqual(0);
      expect(result.factors.accelerationPattern).toBeLessThanOrEqual(1000);
      expect(result.factors.corneringSafety).toBeGreaterThanOrEqual(0);
      expect(result.factors.corneringSafety).toBeLessThanOrEqual(1000);
      expect(result.factors.phoneAvoidance).toBeGreaterThanOrEqual(0);
      expect(result.factors.phoneAvoidance).toBeLessThanOrEqual(1000);
      expect(result.factors.timeOfDayRisk).toBeGreaterThanOrEqual(0);
      expect(result.factors.timeOfDayRisk).toBeLessThanOrEqual(1000);
    });

    it('should penalize harsh braking events', () => {
      const goodTrip = createVerifiedTrip();
      const badTrip = createVerifiedTrip({
        brakingEvents: [
          { timestamp: 1700000010000, deceleration: 6.0, duration: 2 },
          { timestamp: 1700000020000, deceleration: 5.5, duration: 3 },
          { timestamp: 1700000030000, deceleration: 7.0, duration: 1 },
        ],
      });

      const goodScore = engine.computeTripScore(goodTrip);
      const badScore = engine.computeTripScore(badTrip);

      expect(badScore.factors.brakingSmooth).toBeLessThan(goodScore.factors.brakingSmooth);
      expect(badScore.overall).toBeLessThan(goodScore.overall);
    });

    it('should penalize harsh acceleration events', () => {
      const goodTrip = createVerifiedTrip();
      const badTrip = createVerifiedTrip({
        accelerationEvents: [
          { timestamp: 1700000010000, acceleration: 5.0, duration: 2 },
          { timestamp: 1700000020000, acceleration: 4.5, duration: 3 },
        ],
      });

      const goodScore = engine.computeTripScore(goodTrip);
      const badScore = engine.computeTripScore(badTrip);

      expect(badScore.factors.accelerationPattern).toBeLessThan(
        goodScore.factors.accelerationPattern
      );
    });

    it('should penalize unsafe cornering events', () => {
      const goodTrip = createVerifiedTrip();
      const badTrip = createVerifiedTrip({
        corneringEvents: [
          { timestamp: 1700000010000, lateralG: 0.5, duration: 2 },
          { timestamp: 1700000020000, lateralG: 0.6, duration: 3 },
        ],
      });

      const goodScore = engine.computeTripScore(goodTrip);
      const badScore = engine.computeTripScore(badTrip);

      expect(badScore.factors.corneringSafety).toBeLessThan(goodScore.factors.corneringSafety);
    });

    it('should penalize phone usage during driving', () => {
      const goodTrip = createVerifiedTrip();
      const startTime = 1700000000000;
      const badTrip = createVerifiedTrip({
        phoneUsageEvents: [
          { startTime: startTime + 60000, endTime: startTime + 120000, type: 'screen_on' },
        ],
      });

      const goodScore = engine.computeTripScore(goodTrip);
      const badScore = engine.computeTripScore(badTrip);

      expect(badScore.factors.phoneAvoidance).toBeLessThan(goodScore.factors.phoneAvoidance);
    });

    it('should penalize speeding', () => {
      const goodTrip = createVerifiedTrip({ speedReadings: [60, 65, 70, 55, 60] });
      const badTrip = createVerifiedTrip({ speedReadings: [140, 150, 160, 145, 155] });

      const goodScore = engine.computeTripScore(goodTrip);
      const badScore = engine.computeTripScore(badTrip);

      expect(badScore.factors.speedCompliance).toBeLessThan(goodScore.factors.speedCompliance);
    });

    it('should give maximum phone avoidance score when no phone events', () => {
      const trip = createVerifiedTrip({ phoneUsageEvents: [] });
      const result = engine.computeTripScore(trip);

      expect(result.factors.phoneAvoidance).toBe(1000);
    });
  });

  describe('computeOverallScore', () => {
    it('should compute weighted sum of factors', () => {
      const factors = {
        speedCompliance: 1000,
        brakingSmooth: 1000,
        accelerationPattern: 1000,
        corneringSafety: 1000,
        phoneAvoidance: 1000,
        timeOfDayRisk: 1000,
      };

      const score = engine.computeOverallScore(factors);
      expect(score).toBe(1000);
    });

    it('should compute correct weighted sum for mixed factors', () => {
      const factors = {
        speedCompliance: 800,   // 800 * 0.25 = 200
        brakingSmooth: 600,     // 600 * 0.20 = 120
        accelerationPattern: 700, // 700 * 0.15 = 105
        corneringSafety: 900,   // 900 * 0.15 = 135
        phoneAvoidance: 1000,   // 1000 * 0.15 = 150
        timeOfDayRisk: 500,     // 500 * 0.10 = 50
      };
      // Expected: 200 + 120 + 105 + 135 + 150 + 50 = 760

      const score = engine.computeOverallScore(factors);
      expect(score).toBe(760);
    });

    it('should return 0 when all factors are 0', () => {
      const factors = {
        speedCompliance: 0,
        brakingSmooth: 0,
        accelerationPattern: 0,
        corneringSafety: 0,
        phoneAvoidance: 0,
        timeOfDayRisk: 0,
      };

      const score = engine.computeOverallScore(factors);
      expect(score).toBe(0);
    });

    it('should clamp score to [0, 1000]', () => {
      // Even with max values, should not exceed 1000
      const factors = {
        speedCompliance: 1000,
        brakingSmooth: 1000,
        accelerationPattern: 1000,
        corneringSafety: 1000,
        phoneAvoidance: 1000,
        timeOfDayRisk: 1000,
      };

      const score = engine.computeOverallScore(factors);
      expect(score).toBeLessThanOrEqual(1000);
      expect(score).toBeGreaterThanOrEqual(0);
    });
  });

  describe('computeGrade', () => {
    it('should return A for scores 900-1000', () => {
      expect(engine.computeGrade(900)).toBe('A');
      expect(engine.computeGrade(950)).toBe('A');
      expect(engine.computeGrade(1000)).toBe('A');
    });

    it('should return B for scores 800-899', () => {
      expect(engine.computeGrade(800)).toBe('B');
      expect(engine.computeGrade(850)).toBe('B');
      expect(engine.computeGrade(899)).toBe('B');
    });

    it('should return C for scores 700-799', () => {
      expect(engine.computeGrade(700)).toBe('C');
      expect(engine.computeGrade(750)).toBe('C');
      expect(engine.computeGrade(799)).toBe('C');
    });

    it('should return D for scores 600-699', () => {
      expect(engine.computeGrade(600)).toBe('D');
      expect(engine.computeGrade(650)).toBe('D');
      expect(engine.computeGrade(699)).toBe('D');
    });

    it('should return F for scores 0-599', () => {
      expect(engine.computeGrade(0)).toBe('F');
      expect(engine.computeGrade(300)).toBe('F');
      expect(engine.computeGrade(599)).toBe('F');
    });
  });

  describe('computeDvxReward', () => {
    it('should return max reward (50 DVX) for perfect score', () => {
      const reward = engine.computeDvxReward(1000);
      expect(reward).toBe(50);
    });

    it('should return 0 for score of 0', () => {
      const reward = engine.computeDvxReward(0);
      expect(reward).toBe(0);
    });

    it('should return proportional reward for mid-range score', () => {
      const reward = engine.computeDvxReward(500);
      expect(reward).toBe(25);
    });

    it('should never exceed MAX_DVX_REWARD', () => {
      const reward = engine.computeDvxReward(1000);
      expect(reward).toBeLessThanOrEqual(SCORING_CONSTANTS.MAX_DVX_REWARD);
    });

    it('should never be negative', () => {
      const reward = engine.computeDvxReward(0);
      expect(reward).toBeGreaterThanOrEqual(0);
    });
  });

  describe('computeRollingAverage', () => {
    it('should return 0 for empty scores', () => {
      const avg = engine.computeRollingAverage([]);
      expect(avg).toBe(0);
    });

    it('should return the single score for one trip', () => {
      const avg = engine.computeRollingAverage([800]);
      expect(avg).toBe(800);
    });

    it('should weight recent trips more heavily', () => {
      // All high scores followed by low scores
      const recentHigh = [900, 900, 900, 500, 500, 500];
      const recentLow = [500, 500, 500, 900, 900, 900];

      const avgRecentHigh = engine.computeRollingAverage(recentHigh);
      const avgRecentLow = engine.computeRollingAverage(recentLow);

      // Recent high scores should produce a higher average
      expect(avgRecentHigh).toBeGreaterThan(avgRecentLow);
    });

    it('should stay within [0, 1000]', () => {
      const scores = Array(100).fill(1000);
      const avg = engine.computeRollingAverage(scores);
      expect(avg).toBeLessThanOrEqual(1000);
      expect(avg).toBeGreaterThanOrEqual(0);
    });

    it('should handle 100 trips (full window)', () => {
      const scores = Array(100)
        .fill(0)
        .map((_, i) => 500 + (i < 50 ? 200 : -200));
      const avg = engine.computeRollingAverage(scores);
      expect(avg).toBeGreaterThanOrEqual(0);
      expect(avg).toBeLessThanOrEqual(1000);
    });

    it('should produce higher score when recent trips improve', () => {
      // Improving trend: recent trips are better
      const improving = [900, 850, 800, 750, 700, 650, 600, 550, 500, 450];
      const declining = [450, 500, 550, 600, 650, 700, 750, 800, 850, 900];

      const improvingAvg = engine.computeRollingAverage(improving);
      const decliningAvg = engine.computeRollingAverage(declining);

      expect(improvingAvg).toBeGreaterThan(decliningAvg);
    });
  });

  describe('determineStatus', () => {
    it('should remain Provisional when below trip threshold', () => {
      const status = engine.determineStatus('Provisional', 5, 200);
      expect(status).toBe('Provisional');
    });

    it('should remain Provisional when below km threshold', () => {
      const status = engine.determineStatus('Provisional', 15, 50);
      expect(status).toBe('Provisional');
    });

    it('should transition to Verified when both thresholds met', () => {
      const status = engine.determineStatus('Provisional', 10, 100);
      expect(status).toBe('Verified');
    });

    it('should transition to Verified when thresholds exceeded', () => {
      const status = engine.determineStatus('Provisional', 20, 500);
      expect(status).toBe('Verified');
    });

    it('should remain Verified once verified', () => {
      const status = engine.determineStatus('Verified', 5, 50);
      expect(status).toBe('Verified');
    });

    it('should require exactly 10 trips and 100 km for transition', () => {
      expect(engine.determineStatus('Provisional', 9, 100)).toBe('Provisional');
      expect(engine.determineStatus('Provisional', 10, 99)).toBe('Provisional');
      expect(engine.determineStatus('Provisional', 10, 100)).toBe('Verified');
    });
  });

  describe('updateSafetyScore', () => {
    it('should update driver score in database and on-chain', async () => {
      const trip = createVerifiedTrip();
      const tripScore = engine.computeTripScore(trip);

      const newScore = await engine.updateSafetyScore(trip.driverAddress, tripScore);

      expect(newScore).toBeGreaterThanOrEqual(0);
      expect(newScore).toBeLessThanOrEqual(1000);
      expect(mockDb.storeTripScore).toHaveBeenCalledTimes(1);
      expect(mockDb.updateDriverScore).toHaveBeenCalledTimes(1);
      expect(mockRegistry.updateSafetyScore).toHaveBeenCalledTimes(1);
    });

    it('should throw error for unknown driver', async () => {
      const db = createMockDb({
        getDriverByAddress: vi.fn().mockResolvedValue(null),
      });
      const localEngine = new ScoringEngine(db, mockRegistry);
      const tripScore = engine.computeTripScore(createVerifiedTrip());

      await expect(
        localEngine.updateSafetyScore('0xunknown', tripScore)
      ).rejects.toThrow('Driver not found');
    });

    it('should transition status to Verified when thresholds met', async () => {
      const db = createMockDb({
        getDriverByAddress: vi.fn().mockResolvedValue({
          id: 'driver-1',
          wallet_address: '0x1234567890abcdef1234567890abcdef12345678',
          safety_score: 750,
          score_status: 'Provisional',
          total_trips: 9, // One more trip will make 10
          total_kilometers: 150, // Already above 100 km
        }),
        getRecentTripScores: vi.fn().mockResolvedValue([800, 750, 700]),
        storeTripScore: vi.fn().mockResolvedValue(undefined),
        updateDriverScore: vi.fn().mockResolvedValue(undefined),
        getRecentTripFactors: vi.fn().mockResolvedValue([]),
      });
      const localEngine = new ScoringEngine(db, mockRegistry);
      const tripScore = localEngine.computeTripScore(createVerifiedTrip());

      await localEngine.updateSafetyScore(
        '0x1234567890abcdef1234567890abcdef12345678',
        tripScore
      );

      expect(db.updateDriverScore).toHaveBeenCalledWith(
        '0x1234567890abcdef1234567890abcdef12345678',
        expect.any(Number),
        'Verified',
        10
      );
    });
  });

  describe('getScoreBreakdown', () => {
    it('should return score breakdown for existing driver', async () => {
      const db = createMockDb({
        getRecentTripFactors: vi.fn().mockResolvedValue([
          {
            trip_id: 'trip-1',
            driver_address: '0x1234',
            trip_score: 800,
            grade: 'B',
            speed_compliance_score: 900,
            braking_score: 800,
            acceleration_score: 750,
            cornering_score: 850,
            phone_avoidance_score: 1000,
            time_risk_score: 700,
            dvx_reward: 40,
          },
        ] as TripScoreRecord[]),
      });
      const localEngine = new ScoringEngine(db, mockRegistry);

      const breakdown = await localEngine.getScoreBreakdown(
        '0x1234567890abcdef1234567890abcdef12345678'
      );

      expect(breakdown.overall).toBe(750);
      expect(breakdown.status).toBe('Provisional');
      expect(breakdown.tripCount).toBe(5);
      expect(breakdown.totalKm).toBe(50);
      expect(breakdown.speedCompliance).toBe(900);
      expect(breakdown.brakingSmooth).toBe(800);
    });

    it('should throw error for unknown driver', async () => {
      const db = createMockDb({
        getDriverByAddress: vi.fn().mockResolvedValue(null),
      });
      const localEngine = new ScoringEngine(db, mockRegistry);

      await expect(
        localEngine.getScoreBreakdown('0xunknown')
      ).rejects.toThrow('Driver not found');
    });
  });

  describe('computeFactors', () => {
    it('should give max speed compliance for low speeds', () => {
      const trip = createVerifiedTrip({ speedReadings: [30, 40, 50, 60, 70] });
      const factors = engine.computeFactors(trip);
      expect(factors.speedCompliance).toBe(1000);
    });

    it('should give max braking score with no braking events', () => {
      const trip = createVerifiedTrip({ brakingEvents: [] });
      const factors = engine.computeFactors(trip);
      expect(factors.brakingSmooth).toBe(1000);
    });

    it('should give max acceleration score with no harsh acceleration', () => {
      const trip = createVerifiedTrip({ accelerationEvents: [] });
      const factors = engine.computeFactors(trip);
      expect(factors.accelerationPattern).toBe(1000);
    });

    it('should give max cornering score with no unsafe cornering', () => {
      const trip = createVerifiedTrip({ corneringEvents: [] });
      const factors = engine.computeFactors(trip);
      expect(factors.corneringSafety).toBe(1000);
    });

    it('should handle empty speed readings gracefully', () => {
      const trip = createVerifiedTrip({ speedReadings: [] });
      const factors = engine.computeFactors(trip);
      expect(factors.speedCompliance).toBe(1000);
    });

    it('should handle zero verified distance gracefully', () => {
      const trip = createVerifiedTrip({ verifiedDistanceKm: 0 });
      const factors = engine.computeFactors(trip);
      expect(factors.brakingSmooth).toBe(1000);
      expect(factors.accelerationPattern).toBe(1000);
      expect(factors.corneringSafety).toBe(1000);
    });
  });

  describe('weight validation', () => {
    it('should have weights that sum to 1.0', () => {
      const totalWeight =
        SCORING_WEIGHTS.speedCompliance +
        SCORING_WEIGHTS.brakingSmooth +
        SCORING_WEIGHTS.accelerationPattern +
        SCORING_WEIGHTS.corneringSafety +
        SCORING_WEIGHTS.phoneAvoidance +
        SCORING_WEIGHTS.timeOfDayRisk;

      expect(totalWeight).toBeCloseTo(1.0, 10);
    });

    it('should have correct individual weights', () => {
      expect(SCORING_WEIGHTS.speedCompliance).toBe(0.25);
      expect(SCORING_WEIGHTS.brakingSmooth).toBe(0.20);
      expect(SCORING_WEIGHTS.accelerationPattern).toBe(0.15);
      expect(SCORING_WEIGHTS.corneringSafety).toBe(0.15);
      expect(SCORING_WEIGHTS.phoneAvoidance).toBe(0.15);
      expect(SCORING_WEIGHTS.timeOfDayRisk).toBe(0.10);
    });
  });
});
