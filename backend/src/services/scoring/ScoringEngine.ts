import {
  VerifiedTrip,
  TripScore,
  ScoreBreakdown,
  ScoringFactors,
  DriverRecord,
  TripScoreRecord,
  SCORING_WEIGHTS,
  SCORING_CONSTANTS,
} from './types';

/**
 * ScoringEngine
 *
 * Computes trip scores from verified trip data using weighted factors,
 * maintains a rolling Safety Score (last 100 trips with exponential decay),
 * assigns trip grades (A-F), calculates DVX rewards (0-50 per trip),
 * and updates the driver's Safety Score in PostgreSQL and on-chain Safety Registry.
 *
 * Requirements: 1.2, 1.5, 1.8, 4.4
 */
export class ScoringEngine {
  private readonly dbClient: ScoringDatabaseClient;
  private readonly registryClient: SafetyRegistryClient;

  constructor(dbClient?: ScoringDatabaseClient, registryClient?: SafetyRegistryClient) {
    this.dbClient = dbClient || noOpDatabaseClient;
    this.registryClient = registryClient || noOpRegistryClient;
  }

  /**
   * Compute trip score from verified trip data.
   * Calculates weighted factor scores, overall score, grade, and DVX reward.
   */
  computeTripScore(trip: VerifiedTrip): TripScore {
    const factors = this.computeFactors(trip);
    const overall = this.computeOverallScore(factors);
    const grade = this.computeGrade(overall);
    const dvxReward = this.computeDvxReward(overall);

    return {
      overall,
      grade,
      factors,
      dvxReward,
    };
  }

  /**
   * Update rolling Safety Score for a driver.
   * Uses exponential decay over the most recent 100 trips.
   * Also handles "Provisional" → "Verified" transition.
   *
   * @returns The new Safety Score (0-1000)
   */
  async updateSafetyScore(driverAddress: string, tripScore: TripScore): Promise<number> {
    // Get driver record
    const driver = await this.dbClient.getDriverByAddress(driverAddress);
    if (!driver) {
      throw new Error(`Driver not found: ${driverAddress}`);
    }

    // Store the trip score
    await this.dbClient.storeTripScore({
      trip_id: '', // Will be set by caller
      driver_address: driverAddress,
      trip_score: tripScore.overall,
      grade: tripScore.grade,
      speed_compliance_score: tripScore.factors.speedCompliance,
      braking_score: tripScore.factors.brakingSmooth,
      acceleration_score: tripScore.factors.accelerationPattern,
      cornering_score: tripScore.factors.corneringSafety,
      phone_avoidance_score: tripScore.factors.phoneAvoidance,
      time_risk_score: tripScore.factors.timeOfDayRisk,
      dvx_reward: tripScore.dvxReward,
    });

    // Get recent trip scores for rolling average
    const recentScores = await this.dbClient.getRecentTripScores(
      driverAddress,
      SCORING_CONSTANTS.ROLLING_WINDOW_SIZE
    );

    // Compute rolling weighted average with exponential decay
    const newSafetyScore = this.computeRollingAverage(recentScores);

    // Determine new status
    const newTripCount = driver.total_trips + 1;
    const newStatus = this.determineStatus(
      driver.score_status,
      newTripCount,
      driver.total_kilometers
    );

    // Update driver record in PostgreSQL
    await this.dbClient.updateDriverScore(driverAddress, newSafetyScore, newStatus, newTripCount);

    // Submit to Safety Registry on-chain
    await this.registryClient.updateSafetyScore(
      driverAddress,
      newSafetyScore,
      newTripCount,
      driver.total_kilometers
    );

    return newSafetyScore;
  }

  /**
   * Get current score breakdown for a driver.
   */
  async getScoreBreakdown(driverAddress: string): Promise<ScoreBreakdown> {
    const driver = await this.dbClient.getDriverByAddress(driverAddress);
    if (!driver) {
      throw new Error(`Driver not found: ${driverAddress}`);
    }

    const recentScores = await this.dbClient.getRecentTripScores(
      driverAddress,
      SCORING_CONSTANTS.ROLLING_WINDOW_SIZE
    );

    const recentFactors = await this.dbClient.getRecentTripFactors(
      driverAddress,
      SCORING_CONSTANTS.ROLLING_WINDOW_SIZE
    );

    // Compute weighted averages for each factor
    const factorAverages = this.computeFactorAverages(recentFactors);

    return {
      overall: driver.safety_score,
      speedCompliance: factorAverages.speedCompliance,
      brakingSmooth: factorAverages.brakingSmooth,
      accelerationPattern: factorAverages.accelerationPattern,
      corneringSafety: factorAverages.corneringSafety,
      phoneAvoidance: factorAverages.phoneAvoidance,
      timeOfDayRisk: factorAverages.timeOfDayRisk,
      status: driver.score_status,
      tripCount: driver.total_trips,
      totalKm: driver.total_kilometers,
    };
  }

  /**
   * Compute individual factor scores from trip data.
   * Each factor is scored 0-1000.
   */
  computeFactors(trip: VerifiedTrip): ScoringFactors {
    return {
      speedCompliance: this.computeSpeedCompliance(trip),
      brakingSmooth: this.computeBrakingSmooth(trip),
      accelerationPattern: this.computeAccelerationPattern(trip),
      corneringSafety: this.computeCorneringSafety(trip),
      phoneAvoidance: this.computePhoneAvoidance(trip),
      timeOfDayRisk: this.computeTimeOfDayRisk(trip),
    };
  }

  /**
   * Compute overall score from weighted factors.
   * Score = sum(factor_i * weight_i) for all factors.
   */
  computeOverallScore(factors: ScoringFactors): number {
    const weighted =
      factors.speedCompliance * SCORING_WEIGHTS.speedCompliance +
      factors.brakingSmooth * SCORING_WEIGHTS.brakingSmooth +
      factors.accelerationPattern * SCORING_WEIGHTS.accelerationPattern +
      factors.corneringSafety * SCORING_WEIGHTS.corneringSafety +
      factors.phoneAvoidance * SCORING_WEIGHTS.phoneAvoidance +
      factors.timeOfDayRisk * SCORING_WEIGHTS.timeOfDayRisk;

    return clamp(Math.round(weighted), SCORING_CONSTANTS.MIN_SCORE, SCORING_CONSTANTS.MAX_SCORE);
  }

  /**
   * Compute trip grade from overall score.
   * A: 900-1000, B: 800-899, C: 700-799, D: 600-699, F: 0-599
   */
  computeGrade(overall: number): 'A' | 'B' | 'C' | 'D' | 'F' {
    if (overall >= 900) return 'A';
    if (overall >= 800) return 'B';
    if (overall >= 700) return 'C';
    if (overall >= 600) return 'D';
    return 'F';
  }

  /**
   * Compute DVX reward for a trip (0-50 DVX).
   * Reward is proportional to the trip score.
   */
  computeDvxReward(overall: number): number {
    const normalized = overall / SCORING_CONSTANTS.MAX_SCORE;
    const reward = normalized * SCORING_CONSTANTS.MAX_DVX_REWARD;
    return clamp(
      Math.round(reward * 100) / 100,
      SCORING_CONSTANTS.MIN_DVX_REWARD,
      SCORING_CONSTANTS.MAX_DVX_REWARD
    );
  }

  /**
   * Compute rolling weighted average with exponential decay.
   * More recent trips are weighted more heavily.
   *
   * Weight for trip at position i (0 = most recent): e^(-lambda * i)
   */
  computeRollingAverage(scores: number[]): number {
    if (scores.length === 0) return 0;

    let weightedSum = 0;
    let totalWeight = 0;

    for (let i = 0; i < scores.length; i++) {
      const weight = Math.exp(-SCORING_CONSTANTS.DECAY_FACTOR * i);
      weightedSum += scores[i] * weight;
      totalWeight += weight;
    }

    const average = weightedSum / totalWeight;
    return clamp(Math.round(average), SCORING_CONSTANTS.MIN_SCORE, SCORING_CONSTANTS.MAX_SCORE);
  }

  /**
   * Determine driver status based on trip count and total kilometers.
   * Transitions from "Provisional" to "Verified" at 10 trips AND 100 km.
   */
  determineStatus(
    currentStatus: 'Provisional' | 'Verified',
    tripCount: number,
    totalKm: number
  ): 'Provisional' | 'Verified' {
    if (currentStatus === 'Verified') return 'Verified';

    if (
      tripCount >= SCORING_CONSTANTS.MIN_TRIPS_FOR_VERIFIED &&
      totalKm >= SCORING_CONSTANTS.MIN_KM_FOR_VERIFIED
    ) {
      return 'Verified';
    }

    return 'Provisional';
  }

  /**
   * Speed compliance factor (25% weight).
   * Measures how well the driver stays within speed limits.
   * Penalizes for high speed readings relative to typical limits.
   */
  private computeSpeedCompliance(trip: VerifiedTrip): number {
    if (trip.speedReadings.length === 0) return SCORING_CONSTANTS.MAX_SCORE;

    // Count readings that are within reasonable speed limits
    // We use a reference speed of 120 km/h as a general highway limit
    const referenceSpeed = 120;
    let complianceCount = 0;

    for (const speed of trip.speedReadings) {
      if (speed <= referenceSpeed) {
        complianceCount++;
      } else {
        // Partial penalty based on how much over the limit
        const overRatio = (speed - referenceSpeed) / referenceSpeed;
        complianceCount += Math.max(0, 1 - overRatio);
      }
    }

    const complianceRatio = complianceCount / trip.speedReadings.length;
    return clamp(
      Math.round(complianceRatio * SCORING_CONSTANTS.MAX_SCORE),
      SCORING_CONSTANTS.MIN_SCORE,
      SCORING_CONSTANTS.MAX_SCORE
    );
  }

  /**
   * Braking smoothness factor (20% weight).
   * Penalizes harsh braking events (deceleration > threshold).
   */
  private computeBrakingSmooth(trip: VerifiedTrip): number {
    if (trip.verifiedDistanceKm === 0) return SCORING_CONSTANTS.MAX_SCORE;

    const harshEvents = trip.brakingEvents.filter(
      (e) => e.deceleration > SCORING_CONSTANTS.HARSH_BRAKING_THRESHOLD
    );

    // Harsh braking events per km
    const eventsPerKm = harshEvents.length / trip.verifiedDistanceKm;

    // Score decreases with more harsh braking events per km
    // 0 events/km = 1000, 1 event/km = ~700, 3+ events/km = ~0
    const penalty = Math.min(eventsPerKm / 3, 1);
    const score = SCORING_CONSTANTS.MAX_SCORE * (1 - penalty);

    return clamp(Math.round(score), SCORING_CONSTANTS.MIN_SCORE, SCORING_CONSTANTS.MAX_SCORE);
  }

  /**
   * Acceleration pattern factor (15% weight).
   * Penalizes harsh acceleration events.
   */
  private computeAccelerationPattern(trip: VerifiedTrip): number {
    if (trip.verifiedDistanceKm === 0) return SCORING_CONSTANTS.MAX_SCORE;

    const harshEvents = trip.accelerationEvents.filter(
      (e) => e.acceleration > SCORING_CONSTANTS.HARSH_ACCELERATION_THRESHOLD
    );

    const eventsPerKm = harshEvents.length / trip.verifiedDistanceKm;

    // Score decreases with more harsh acceleration events per km
    const penalty = Math.min(eventsPerKm / 3, 1);
    const score = SCORING_CONSTANTS.MAX_SCORE * (1 - penalty);

    return clamp(Math.round(score), SCORING_CONSTANTS.MIN_SCORE, SCORING_CONSTANTS.MAX_SCORE);
  }

  /**
   * Cornering safety factor (15% weight).
   * Penalizes lateral g-force events exceeding 0.3g.
   */
  private computeCorneringSafety(trip: VerifiedTrip): number {
    if (trip.verifiedDistanceKm === 0) return SCORING_CONSTANTS.MAX_SCORE;

    const unsafeEvents = trip.corneringEvents.filter(
      (e) => e.lateralG > SCORING_CONSTANTS.UNSAFE_CORNERING_G
    );

    const eventsPerKm = unsafeEvents.length / trip.verifiedDistanceKm;

    // Score decreases with more unsafe cornering events per km
    const penalty = Math.min(eventsPerKm / 2, 1);
    const score = SCORING_CONSTANTS.MAX_SCORE * (1 - penalty);

    return clamp(Math.round(score), SCORING_CONSTANTS.MIN_SCORE, SCORING_CONSTANTS.MAX_SCORE);
  }

  /**
   * Phone avoidance factor (15% weight).
   * Penalizes phone usage during driving.
   */
  private computePhoneAvoidance(trip: VerifiedTrip): number {
    const tripDurationMs = trip.endTime - trip.startTime;
    if (tripDurationMs <= 0) return SCORING_CONSTANTS.MAX_SCORE;

    // Calculate total phone usage duration
    let totalPhoneUsageMs = 0;
    for (const event of trip.phoneUsageEvents) {
      totalPhoneUsageMs += event.endTime - event.startTime;
    }

    // Ratio of phone usage to trip duration
    const usageRatio = totalPhoneUsageMs / tripDurationMs;

    // Any phone usage is penalized heavily
    // 0% usage = 1000, 5% usage = ~500, 10%+ usage = ~0
    const penalty = Math.min(usageRatio / 0.1, 1);
    const score = SCORING_CONSTANTS.MAX_SCORE * (1 - penalty);

    return clamp(Math.round(score), SCORING_CONSTANTS.MIN_SCORE, SCORING_CONSTANTS.MAX_SCORE);
  }

  /**
   * Time-of-day risk factor (10% weight).
   * Adjusts score based on driving during high-risk hours (midnight to 5 AM).
   */
  private computeTimeOfDayRisk(trip: VerifiedTrip): number {
    const startDate = new Date(trip.startTime);
    const endDate = new Date(trip.endTime);

    const startHour = startDate.getUTCHours();
    const endHour = endDate.getUTCHours();

    // Check if any part of the trip falls in high-risk hours
    const tripDurationMs = trip.endTime - trip.startTime;
    if (tripDurationMs <= 0) return SCORING_CONSTANTS.MAX_SCORE;

    // Calculate how much of the trip is in high-risk hours
    let highRiskMs = 0;
    const checkInterval = 60000; // Check every minute

    for (let t = trip.startTime; t <= trip.endTime; t += checkInterval) {
      const hour = new Date(t).getUTCHours();
      if (hour >= SCORING_CONSTANTS.HIGH_RISK_HOUR_START && hour < SCORING_CONSTANTS.HIGH_RISK_HOUR_END) {
        highRiskMs += Math.min(checkInterval, trip.endTime - t);
      }
    }

    const highRiskRatio = highRiskMs / tripDurationMs;

    // Driving during high-risk hours reduces score
    // 0% high-risk = 1000, 100% high-risk = 600 (not zero, since driving at night isn't inherently bad)
    const score = SCORING_CONSTANTS.MAX_SCORE - highRiskRatio * 400;

    return clamp(Math.round(score), SCORING_CONSTANTS.MIN_SCORE, SCORING_CONSTANTS.MAX_SCORE);
  }

  /**
   * Compute weighted averages for each factor from recent trip records.
   */
  private computeFactorAverages(factors: TripScoreRecord[]): ScoringFactors {
    if (factors.length === 0) {
      return {
        speedCompliance: 0,
        brakingSmooth: 0,
        accelerationPattern: 0,
        corneringSafety: 0,
        phoneAvoidance: 0,
        timeOfDayRisk: 0,
      };
    }

    let totalWeight = 0;
    const sums = {
      speedCompliance: 0,
      brakingSmooth: 0,
      accelerationPattern: 0,
      corneringSafety: 0,
      phoneAvoidance: 0,
      timeOfDayRisk: 0,
    };

    for (let i = 0; i < factors.length; i++) {
      const weight = Math.exp(-SCORING_CONSTANTS.DECAY_FACTOR * i);
      totalWeight += weight;
      sums.speedCompliance += factors[i].speed_compliance_score * weight;
      sums.brakingSmooth += factors[i].braking_score * weight;
      sums.accelerationPattern += factors[i].acceleration_score * weight;
      sums.corneringSafety += factors[i].cornering_score * weight;
      sums.phoneAvoidance += factors[i].phone_avoidance_score * weight;
      sums.timeOfDayRisk += factors[i].time_risk_score * weight;
    }

    return {
      speedCompliance: Math.round(sums.speedCompliance / totalWeight),
      brakingSmooth: Math.round(sums.brakingSmooth / totalWeight),
      accelerationPattern: Math.round(sums.accelerationPattern / totalWeight),
      corneringSafety: Math.round(sums.corneringSafety / totalWeight),
      phoneAvoidance: Math.round(sums.phoneAvoidance / totalWeight),
      timeOfDayRisk: Math.round(sums.timeOfDayRisk / totalWeight),
    };
  }
}

/**
 * Database client interface for scoring operations.
 */
export interface ScoringDatabaseClient {
  getDriverByAddress(address: string): Promise<DriverRecord | null>;
  getRecentTripScores(driverAddress: string, limit: number): Promise<number[]>;
  getRecentTripFactors(driverAddress: string, limit: number): Promise<TripScoreRecord[]>;
  storeTripScore(record: TripScoreRecord): Promise<void>;
  updateDriverScore(
    driverAddress: string,
    score: number,
    status: 'Provisional' | 'Verified',
    tripCount: number
  ): Promise<void>;
}

/**
 * Safety Registry on-chain client interface.
 */
export interface SafetyRegistryClient {
  updateSafetyScore(
    driverAddress: string,
    score: number,
    tripCount: number,
    totalKm: number
  ): Promise<void>;
}

/**
 * Clamp a value between min and max.
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * No-op database client for use when database is not available.
 * Allows ScoringEngine to compute trip scores without persistence.
 */
const noOpDatabaseClient: ScoringDatabaseClient = {
  async getDriverByAddress(): Promise<DriverRecord | null> {
    return {
      id: 'no-op',
      wallet_address: '',
      safety_score: 0,
      score_status: 'Provisional',
      total_trips: 0,
      total_kilometers: 0,
    };
  },
  async getRecentTripScores(): Promise<number[]> {
    return [];
  },
  async getRecentTripFactors(): Promise<TripScoreRecord[]> {
    return [];
  },
  async storeTripScore(): Promise<void> {},
  async updateDriverScore(): Promise<void> {},
};

/**
 * No-op Safety Registry client for use when blockchain is not available.
 */
const noOpRegistryClient: SafetyRegistryClient = {
  async updateSafetyScore(): Promise<void> {},
};
