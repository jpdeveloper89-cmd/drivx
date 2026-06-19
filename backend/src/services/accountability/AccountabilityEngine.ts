import db from '../../database/connection';

/**
 * Accountability report severity classification.
 */
export type Severity = 'safe' | 'warning' | 'critical';

/**
 * Published accountability report structure.
 */
export interface AccountabilityReport {
  id: string;
  platformId: string;
  period: string;
  dataPoints: number;
  uniqueDrivers: number;
  avgRequiredSpeed: number;
  postedSpeedLimit: number;
  overLimitPercentage: number;
  severity: Severity;
  publishedAt: Date;
}

/**
 * AccountabilityEngine
 *
 * Aggregates anonymised trip data from opted-in delivery drivers per platform.
 * Detects unsafe speed targets and publishes accountability reports.
 *
 * Rules:
 * - k-anonymity: minimum 50 unique drivers before publishing
 * - Warning: avg required speed > 10% above posted limit across 100+ deliveries in 30 days
 * - Critical: > 20% over limit across 500+ deliveries
 * - Updated weekly using 30-day rolling window
 * - Drivers must have opted in to accountability (Consent Manager)
 *
 * Requirements: 7.1, 7.2, 7.5, 7.6, 7.7, 7.8
 */
export class AccountabilityEngine {
  private readonly K_ANONYMITY_THRESHOLD = 50;
  private readonly WARNING_OVER_LIMIT_PCT = 10;
  private readonly CRITICAL_OVER_LIMIT_PCT = 20;
  private readonly WARNING_MIN_DELIVERIES = 100;
  private readonly CRITICAL_MIN_DELIVERIES = 500;
  private readonly ROLLING_WINDOW_DAYS = 30;

  /**
   * Classify severity based on overspeed percentage and delivery count.
   */
  classifySeverity(overLimitPct: number, deliveryCount: number): Severity {
    if (overLimitPct > this.CRITICAL_OVER_LIMIT_PCT && deliveryCount >= this.CRITICAL_MIN_DELIVERIES) {
      return 'critical';
    }
    if (overLimitPct > this.WARNING_OVER_LIMIT_PCT && deliveryCount >= this.WARNING_MIN_DELIVERIES) {
      return 'warning';
    }
    return 'safe';
  }

  /**
   * Check if k-anonymity threshold is met.
   * No report is published unless at least 50 unique drivers contributed.
   */
  meetsKAnonymity(uniqueDrivers: number): boolean {
    return uniqueDrivers >= this.K_ANONYMITY_THRESHOLD;
  }

  /**
   * Compute the over-limit percentage.
   * Returns how much the avg speed exceeds the posted limit as a percentage.
   */
  computeOverLimitPercentage(avgSpeed: number, postedLimit: number): number {
    if (postedLimit <= 0) return 0;
    const diff = avgSpeed - postedLimit;
    if (diff <= 0) return 0;
    return Math.round((diff / postedLimit) * 100 * 10) / 10; // 1 decimal place
  }

  /**
   * Generate accountability report for a given platform.
   * Aggregates data from opted-in drivers over the 30-day rolling window.
   *
   * @returns The report, or null if k-anonymity not met.
   */
  async generateReport(platformId: string): Promise<AccountabilityReport | null> {
    const windowStart = new Date();
    windowStart.setDate(windowStart.getDate() - this.ROLLING_WINDOW_DAYS);

    // Query aggregated delivery data for this platform from opted-in drivers
    const stats = await db('delivery_trips')
      .where('platform_id', platformId)
      .where('completed_at', '>=', windowStart)
      .join('consent_grants', function () {
        this.on('delivery_trips.driver_address', '=', 'consent_grants.driver_address')
          .andOn(db.raw('consent_grants.revoked = false'))
          .andOn(db.raw('consent_grants.expires_at > NOW()'))
          .andOn(db.raw('(consent_grants.data_categories & 4) = 4')); // 0x04 = Delivery category
      })
      .select(
        db.raw('COUNT(*) as total_deliveries'),
        db.raw('COUNT(DISTINCT delivery_trips.driver_address) as unique_drivers'),
        db.raw('AVG(delivery_trips.avg_speed) as avg_required_speed'),
        db.raw('AVG(delivery_trips.posted_speed_limit) as avg_posted_limit')
      )
      .first();

    if (!stats) return null;

    const uniqueDrivers = Number(stats.unique_drivers) || 0;
    const deliveryCount = Number(stats.total_deliveries) || 0;
    const avgSpeed = Number(stats.avg_required_speed) || 0;
    const postedLimit = Number(stats.avg_posted_limit) || 60; // default 60 km/h

    // Check k-anonymity
    if (!this.meetsKAnonymity(uniqueDrivers)) {
      return null;
    }

    const overLimitPct = this.computeOverLimitPercentage(avgSpeed, postedLimit);
    const severity = this.classifySeverity(overLimitPct, deliveryCount);

    const now = new Date();
    const periodEnd = now.toISOString().substring(0, 7); // YYYY-MM
    const periodStart = windowStart.toISOString().substring(0, 7);
    const period = periodStart === periodEnd ? periodEnd : `${periodStart} – ${periodEnd}`;

    return {
      id: `${platformId}-${Date.now()}`,
      platformId,
      period,
      dataPoints: deliveryCount,
      uniqueDrivers,
      avgRequiredSpeed: Math.round(avgSpeed * 10) / 10,
      postedSpeedLimit: Math.round(postedLimit),
      overLimitPercentage: overLimitPct,
      severity,
      publishedAt: now,
    };
  }

  /**
   * Get all published accountability reports.
   * Sorted by severity (critical first) then recency.
   */
  async getPublishedReports(): Promise<AccountabilityReport[]> {
    const reports = await db('accountability_reports')
      .orderByRaw("CASE severity WHEN 'critical' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END")
      .orderBy('published_at', 'desc')
      .select('*');

    return reports.map((r: any) => ({
      id: r.id,
      platformId: r.platform_id,
      period: r.period,
      dataPoints: r.data_points,
      uniqueDrivers: r.unique_drivers,
      avgRequiredSpeed: Number(r.avg_required_speed),
      postedSpeedLimit: Number(r.posted_speed_limit),
      overLimitPercentage: Number(r.over_limit_percentage),
      severity: r.severity as Severity,
      publishedAt: r.published_at,
    }));
  }
}
