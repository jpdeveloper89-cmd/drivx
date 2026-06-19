import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  TripVerificationEngine,
  haversineDistanceKm,
  DatabaseClient,
} from './TripVerificationEngine';
import { TripRecord, GPSPoint, VERIFICATION_CONSTANTS } from './types';
import { ObjectStorageProvider } from '../storage/ObjectStorageProvider';

/**
 * Creates a mock ObjectStorageProvider
 */
function createMockStorage(): ObjectStorageProvider {
  return {
    upload: vi.fn().mockResolvedValue('file://mock/path'),
    download: vi.fn().mockResolvedValue(Buffer.from('')),
    delete: vi.fn().mockResolvedValue(undefined),
    exists: vi.fn().mockResolvedValue(false),
  };
}

/**
 * Creates a mock DatabaseClient
 */
function createMockDb(): DatabaseClient {
  return {
    insertTripRecord: vi.fn().mockResolvedValue(undefined),
  };
}

/**
 * Creates a valid trip record for testing
 */
function createValidTrip(overrides?: Partial<TripRecord>): TripRecord {
  const startTime = Date.now() - 120000; // 2 minutes ago
  const coordinates: GPSPoint[] = [];

  // Generate 10 GPS points, 10 seconds apart, simulating a short drive
  for (let i = 0; i < 10; i++) {
    coordinates.push({
      latitude: 40.7128 + i * 0.001, // ~111m per 0.001 degree
      longitude: -74.006 + i * 0.001,
      timestamp: startTime + i * 10000, // 10 seconds apart (in ms)
      speed: 50, // 50 km/h
    });
  }

  return {
    driverAddress: '0x1234567890abcdef1234567890abcdef12345678',
    startTime,
    endTime: startTime + 90000, // 90 seconds later
    coordinates,
    speedReadings: [50, 55, 60, 55, 50, 45, 50, 55, 60, 50],
    brakingEvents: [],
    accelerationEvents: [],
    corneringEvents: [],
    phoneUsageEvents: [],
    distanceKm: 1.2,
    category: 'commute',
    ...overrides,
  };
}

describe('TripVerificationEngine', () => {
  let engine: TripVerificationEngine;
  let mockStorage: ObjectStorageProvider;
  let mockDb: DatabaseClient;

  beforeEach(() => {
    mockStorage = createMockStorage();
    mockDb = createMockDb();
    engine = new TripVerificationEngine(mockStorage, mockDb);
  });

  describe('verifyTripRecord', () => {
    it('should verify a valid trip successfully', async () => {
      const trip = createValidTrip();
      const result = await engine.verifyTripRecord(trip);

      expect(result.valid).toBe(true);
      expect(result.tripId).toBeDefined();
      expect(result.rejectionReason).toBeUndefined();
      expect(result.verifiedDistanceKm).toBeGreaterThan(0);
    });

    it('should reject a trip with missing driverAddress', async () => {
      const trip = createValidTrip({ driverAddress: '' });
      const result = await engine.verifyTripRecord(trip);

      expect(result.valid).toBe(false);
      expect(result.rejectionReason).toContain('driverAddress');
    });

    it('should reject a trip with endTime before startTime', async () => {
      const startTime = Date.now() - 120000;
      const trip = createValidTrip({ endTime: startTime - 10000, startTime });
      const result = await engine.verifyTripRecord(trip);

      expect(result.valid).toBe(false);
      expect(result.rejectionReason).toContain('endTime must be after startTime');
    });

    it('should reject a trip with excessive speed', async () => {
      const trip = createValidTrip({ speedReadings: [50, 260, 50] });
      const result = await engine.verifyTripRecord(trip);

      expect(result.valid).toBe(false);
      expect(result.rejectionReason).toContain('250 km/h');
    });

    it('should store GPS data to object storage on valid trip', async () => {
      const trip = createValidTrip();
      await engine.verifyTripRecord(trip);

      expect(mockStorage.upload).toHaveBeenCalledTimes(1);
      const uploadCall = (mockStorage.upload as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(uploadCall[0]).toContain('trips/');
      expect(uploadCall[0]).toContain(trip.driverAddress);
    });

    it('should store trip metadata to database', async () => {
      const trip = createValidTrip();
      await engine.verifyTripRecord(trip);

      expect(mockDb.insertTripRecord).toHaveBeenCalledTimes(1);
      const record = (mockDb.insertTripRecord as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(record.verification_status).toBe('verified');
      expect(record.driver_address).toBe(trip.driverAddress);
    });

    it('should store rejected trip metadata to database', async () => {
      const trip = createValidTrip({ driverAddress: '' });
      await engine.verifyTripRecord(trip);

      expect(mockDb.insertTripRecord).toHaveBeenCalledTimes(1);
      const record = (mockDb.insertTripRecord as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(record.verification_status).toBe('rejected');
    });

    it('should identify unverified segments from GPS gaps', async () => {
      const startTime = Date.now() - 200000; // 200 seconds ago
      const coordinates: GPSPoint[] = [
        { latitude: 40.7128, longitude: -74.006, timestamp: startTime },
        { latitude: 40.7138, longitude: -74.005, timestamp: startTime + 10000 },
        // 90-second gap (> 60s threshold)
        { latitude: 40.7148, longitude: -74.004, timestamp: startTime + 100000 },
        { latitude: 40.7158, longitude: -74.003, timestamp: startTime + 110000 },
      ];

      const trip = createValidTrip({
        startTime,
        coordinates,
        endTime: startTime + 110000,
      });

      const result = await engine.verifyTripRecord(trip);

      expect(result.valid).toBe(true);
      expect(result.unverifiedSegments.length).toBe(1);
      expect(result.unverifiedSegments[0].start).toBe(startTime + 10000);
      expect(result.unverifiedSegments[0].end).toBe(startTime + 100000);
    });
  });

  describe('detectAnomalies', () => {
    it('should detect no anomalies in a valid trip', () => {
      const trip = createValidTrip();
      const report = engine.detectAnomalies(trip);

      expect(report.hasAnomalies).toBe(false);
      expect(report.anomalies).toHaveLength(0);
      expect(report.rejectionReason).toBeUndefined();
    });

    it('should detect excessive speed in speedReadings', () => {
      const trip = createValidTrip({ speedReadings: [50, 300, 50] });
      const report = engine.detectAnomalies(trip);

      expect(report.hasAnomalies).toBe(true);
      expect(report.anomalies.some((a) => a.type === 'excessive_speed')).toBe(true);
      expect(report.rejectionReason).toContain('250 km/h');
    });

    it('should detect excessive speed in GPS point speed field', () => {
      const startTime = Date.now() - 120000;
      const coordinates: GPSPoint[] = [
        { latitude: 40.7128, longitude: -74.006, timestamp: startTime, speed: 50 },
        { latitude: 40.7138, longitude: -74.005, timestamp: startTime + 10000, speed: 280 },
      ];

      const trip = createValidTrip({ coordinates, speedReadings: [] });
      const report = engine.detectAnomalies(trip);

      expect(report.hasAnomalies).toBe(true);
      expect(report.anomalies[0].type).toBe('excessive_speed');
      expect(report.anomalies[0].value).toBe(280);
    });

    it('should detect GPS jumps > 5 km between consecutive 10-second readings', () => {
      const startTime = Date.now() - 120000;
      // Two points ~600 km apart but only 10 seconds apart
      const coordinates: GPSPoint[] = [
        { latitude: 40.7128, longitude: -74.006, timestamp: startTime },
        { latitude: 45.0, longitude: -74.006, timestamp: startTime + 10000 },
      ];

      const trip = createValidTrip({ coordinates, speedReadings: [] });
      const report = engine.detectAnomalies(trip);

      expect(report.hasAnomalies).toBe(true);
      expect(report.anomalies.some((a) => a.type === 'gps_jump')).toBe(true);
      expect(report.rejectionReason).toContain('GPS jump');
    });

    it('should not flag GPS jumps when time gap is larger than 10 seconds', () => {
      const startTime = Date.now() - 120000;
      // Two points far apart but with a large time gap (not consecutive 10s readings)
      const coordinates: GPSPoint[] = [
        { latitude: 40.7128, longitude: -74.006, timestamp: startTime },
        { latitude: 45.0, longitude: -74.006, timestamp: startTime + 60000 }, // 60 seconds apart
      ];

      const trip = createValidTrip({ coordinates, speedReadings: [] });
      const report = engine.detectAnomalies(trip);

      // Should not flag as GPS jump since readings are not consecutive 10-second readings
      expect(report.anomalies.filter((a) => a.type === 'gps_jump')).toHaveLength(0);
    });

    it('should detect speed exactly at 250 km/h as valid (not anomalous)', () => {
      const trip = createValidTrip({ speedReadings: [250] });
      const report = engine.detectAnomalies(trip);

      expect(report.hasAnomalies).toBe(false);
    });

    it('should detect speed just above 250 km/h as anomalous', () => {
      const trip = createValidTrip({ speedReadings: [250.1] });
      const report = engine.detectAnomalies(trip);

      expect(report.hasAnomalies).toBe(true);
      expect(report.anomalies[0].type).toBe('excessive_speed');
    });
  });

  describe('validateGPSData', () => {
    it('should return valid with no gaps for well-spaced coordinates', () => {
      const startTime = Date.now() - 120000;
      const coordinates: GPSPoint[] = [
        { latitude: 40.7128, longitude: -74.006, timestamp: startTime },
        { latitude: 40.7138, longitude: -74.005, timestamp: startTime + 10000 },
        { latitude: 40.7148, longitude: -74.004, timestamp: startTime + 20000 },
      ];

      const result = engine.validateGPSData(coordinates);

      expect(result.valid).toBe(true);
      expect(result.unverifiedSegments).toHaveLength(0);
      expect(result.totalGapDurationSeconds).toBe(0);
    });

    it('should mark segments as unverified when gap > 60 seconds', () => {
      const startTime = Date.now() - 120000;
      const coordinates: GPSPoint[] = [
        { latitude: 40.7128, longitude: -74.006, timestamp: startTime },
        { latitude: 40.7138, longitude: -74.005, timestamp: startTime + 10000 },
        // 70-second gap
        { latitude: 40.7148, longitude: -74.004, timestamp: startTime + 80000 },
      ];

      const result = engine.validateGPSData(coordinates);

      expect(result.valid).toBe(true);
      expect(result.unverifiedSegments).toHaveLength(1);
      expect(result.unverifiedSegments[0].start).toBe(startTime + 10000);
      expect(result.unverifiedSegments[0].end).toBe(startTime + 80000);
      expect(result.totalGapDurationSeconds).toBe(70);
    });

    it('should not mark segments as unverified when gap is exactly 60 seconds', () => {
      const startTime = Date.now() - 120000;
      const coordinates: GPSPoint[] = [
        { latitude: 40.7128, longitude: -74.006, timestamp: startTime },
        { latitude: 40.7138, longitude: -74.005, timestamp: startTime + 60000 },
      ];

      const result = engine.validateGPSData(coordinates);

      expect(result.unverifiedSegments).toHaveLength(0);
    });

    it('should mark segments as unverified when gap is 61 seconds', () => {
      const startTime = Date.now() - 120000;
      const coordinates: GPSPoint[] = [
        { latitude: 40.7128, longitude: -74.006, timestamp: startTime },
        { latitude: 40.7138, longitude: -74.005, timestamp: startTime + 61000 },
      ];

      const result = engine.validateGPSData(coordinates);

      expect(result.unverifiedSegments).toHaveLength(1);
    });

    it('should detect multiple GPS gaps', () => {
      const startTime = Date.now() - 300000;
      const coordinates: GPSPoint[] = [
        { latitude: 40.7128, longitude: -74.006, timestamp: startTime },
        // 90-second gap
        { latitude: 40.7138, longitude: -74.005, timestamp: startTime + 90000 },
        { latitude: 40.7148, longitude: -74.004, timestamp: startTime + 100000 },
        // 120-second gap
        { latitude: 40.7158, longitude: -74.003, timestamp: startTime + 220000 },
      ];

      const result = engine.validateGPSData(coordinates);

      expect(result.unverifiedSegments).toHaveLength(2);
    });

    it('should handle empty coordinates', () => {
      const result = engine.validateGPSData([]);

      expect(result.valid).toBe(false);
      expect(result.unverifiedSegments).toHaveLength(0);
    });

    it('should handle single coordinate', () => {
      const result = engine.validateGPSData([
        { latitude: 40.7128, longitude: -74.006, timestamp: Date.now() - 60000 },
      ]);

      expect(result.valid).toBe(true);
      expect(result.unverifiedSegments).toHaveLength(0);
    });
  });

  describe('validateTripDataIntegrity', () => {
    it('should pass for a valid trip', () => {
      const trip = createValidTrip();
      const errors = engine.validateTripDataIntegrity(trip);

      expect(errors).toHaveLength(0);
    });

    it('should detect missing driverAddress', () => {
      const trip = createValidTrip({ driverAddress: '' });
      const errors = engine.validateTripDataIntegrity(trip);

      expect(errors.some((e) => e.includes('driverAddress'))).toBe(true);
    });

    it('should detect invalid startTime', () => {
      const trip = createValidTrip({ startTime: 0 });
      const errors = engine.validateTripDataIntegrity(trip);

      expect(errors.some((e) => e.includes('startTime'))).toBe(true);
    });

    it('should detect empty coordinates', () => {
      const trip = createValidTrip({ coordinates: [] });
      const errors = engine.validateTripDataIntegrity(trip);

      expect(errors.some((e) => e.includes('coordinates'))).toBe(true);
    });

    it('should detect invalid latitude', () => {
      const trip = createValidTrip({
        coordinates: [{ latitude: 91, longitude: 0, timestamp: Date.now() - 60000 }],
      });
      const errors = engine.validateTripDataIntegrity(trip);

      expect(errors.some((e) => e.includes('latitude'))).toBe(true);
    });

    it('should detect invalid longitude', () => {
      const trip = createValidTrip({
        coordinates: [{ latitude: 0, longitude: 181, timestamp: Date.now() - 60000 }],
      });
      const errors = engine.validateTripDataIntegrity(trip);

      expect(errors.some((e) => e.includes('longitude'))).toBe(true);
    });

    it('should detect out-of-order timestamps in coordinates', () => {
      const startTime = Date.now() - 120000;
      const trip = createValidTrip({
        startTime,
        endTime: startTime + 90000,
        coordinates: [
          { latitude: 40.7128, longitude: -74.006, timestamp: startTime + 20000 },
          { latitude: 40.7138, longitude: -74.005, timestamp: startTime + 10000 }, // out of order
        ],
      });
      const errors = engine.validateTripDataIntegrity(trip);

      expect(errors.some((e) => e.includes('ascending order'))).toBe(true);
    });

    it('should detect invalid distanceKm', () => {
      const trip = createValidTrip({ distanceKm: 0 });
      const errors = engine.validateTripDataIntegrity(trip);

      expect(errors.some((e) => e.includes('distanceKm'))).toBe(true);
    });

    it('should detect missing category', () => {
      const trip = createValidTrip({ category: '' as any });
      const errors = engine.validateTripDataIntegrity(trip);

      expect(errors.some((e) => e.includes('category'))).toBe(true);
    });
  });

  describe('haversineDistanceKm', () => {
    it('should return 0 for same point', () => {
      const point = { latitude: 40.7128, longitude: -74.006 };
      expect(haversineDistanceKm(point, point)).toBe(0);
    });

    it('should calculate distance between known points correctly', () => {
      // New York to Los Angeles is approximately 3944 km
      const nyc = { latitude: 40.7128, longitude: -74.006 };
      const la = { latitude: 34.0522, longitude: -118.2437 };
      const distance = haversineDistanceKm(nyc, la);

      expect(distance).toBeGreaterThan(3900);
      expect(distance).toBeLessThan(4000);
    });

    it('should calculate short distances accurately', () => {
      // ~111 meters (0.001 degree latitude at equator)
      const p1 = { latitude: 0, longitude: 0 };
      const p2 = { latitude: 0.001, longitude: 0 };
      const distance = haversineDistanceKm(p1, p2);

      expect(distance).toBeGreaterThan(0.1);
      expect(distance).toBeLessThan(0.12);
    });
  });

  describe('validateDurationAndDistance', () => {
    it('should pass for a trip with duration >= 60 seconds and distance >= 0.5 km', () => {
      const trip = createValidTrip(); // 90 seconds, 1.2 km
      const result = engine.validateDurationAndDistance(trip);
      expect(result).toBeNull();
    });

    it('should reject a trip with duration < 60 seconds', () => {
      const startTime = Date.now() - 60000;
      const trip = createValidTrip({
        startTime,
        endTime: startTime + 50000, // 50 seconds
      });
      const result = engine.validateDurationAndDistance(trip);
      expect(result).not.toBeNull();
      expect(result).toContain('duration');
      expect(result).toContain('60');
    });

    it('should pass for a trip with exactly 60 seconds duration', () => {
      const startTime = Date.now() - 120000;
      const trip = createValidTrip({
        startTime,
        endTime: startTime + 60000, // exactly 60 seconds
      });
      const result = engine.validateDurationAndDistance(trip);
      expect(result).toBeNull();
    });

    it('should reject a trip with distance < 0.5 km', () => {
      const trip = createValidTrip({ distanceKm: 0.3 });
      const result = engine.validateDurationAndDistance(trip);
      expect(result).not.toBeNull();
      expect(result).toContain('distance');
      expect(result).toContain('0.5');
    });

    it('should pass for a trip with exactly 0.5 km distance', () => {
      const trip = createValidTrip({ distanceKm: 0.5 });
      const result = engine.validateDurationAndDistance(trip);
      expect(result).toBeNull();
    });
  });

  describe('validateTimestamps', () => {
    it('should pass for valid timestamps in the past', () => {
      const trip = createValidTrip();
      const result = engine.validateTimestamps(trip);
      expect(result).toBeNull();
    });

    it('should reject a trip with startTime in the future (> server time + 5 min)', () => {
      const futureTime = Date.now() + 10 * 60 * 1000; // 10 minutes in the future
      const trip = createValidTrip({
        startTime: futureTime,
        endTime: futureTime + 90000,
        coordinates: [
          { latitude: 40.7128, longitude: -74.006, timestamp: futureTime },
          { latitude: 40.7138, longitude: -74.005, timestamp: futureTime + 10000 },
        ],
      });
      const result = engine.validateTimestamps(trip);
      expect(result).not.toBeNull();
      expect(result).toContain('future');
    });

    it('should reject a trip with endTime in the future (> server time + 5 min)', () => {
      const startTime = Date.now() - 60000;
      const futureEnd = Date.now() + 10 * 60 * 1000;
      const trip = createValidTrip({
        startTime,
        endTime: futureEnd,
        coordinates: [
          { latitude: 40.7128, longitude: -74.006, timestamp: startTime },
          { latitude: 40.7138, longitude: -74.005, timestamp: startTime + 10000 },
        ],
      });
      const result = engine.validateTimestamps(trip);
      expect(result).not.toBeNull();
      expect(result).toContain('future');
    });

    it('should reject a trip with a coordinate timestamp in the future', () => {
      const startTime = Date.now() - 60000;
      const futureCoordTime = Date.now() + 10 * 60 * 1000;
      const trip = createValidTrip({
        startTime,
        endTime: startTime + 90000,
        coordinates: [
          { latitude: 40.7128, longitude: -74.006, timestamp: startTime },
          { latitude: 40.7138, longitude: -74.005, timestamp: futureCoordTime },
        ],
      });
      const result = engine.validateTimestamps(trip);
      expect(result).not.toBeNull();
      expect(result).toContain('future');
    });

    it('should reject a trip with non-monotonic coordinate timestamps', () => {
      const startTime = Date.now() - 120000;
      const trip = createValidTrip({
        startTime,
        endTime: startTime + 90000,
        coordinates: [
          { latitude: 40.7128, longitude: -74.006, timestamp: startTime + 20000 },
          { latitude: 40.7138, longitude: -74.005, timestamp: startTime + 10000 }, // goes backwards
        ],
      });
      const result = engine.validateTimestamps(trip);
      expect(result).not.toBeNull();
      expect(result).toContain('Non-monotonic');
    });

    it('should reject a trip with equal consecutive timestamps (non-strictly-increasing)', () => {
      const startTime = Date.now() - 120000;
      const trip = createValidTrip({
        startTime,
        endTime: startTime + 90000,
        coordinates: [
          { latitude: 40.7128, longitude: -74.006, timestamp: startTime + 10000 },
          { latitude: 40.7138, longitude: -74.005, timestamp: startTime + 10000 }, // same timestamp
        ],
      });
      const result = engine.validateTimestamps(trip);
      expect(result).not.toBeNull();
      expect(result).toContain('Non-monotonic');
    });

    it('should allow timestamps within 5 minutes of server time', () => {
      const nearFuture = Date.now() + 2 * 60 * 1000; // 2 minutes in the future (within 5 min tolerance)
      const startTime = Date.now() - 60000;
      const trip = createValidTrip({
        startTime,
        endTime: nearFuture,
        coordinates: [
          { latitude: 40.7128, longitude: -74.006, timestamp: startTime },
          { latitude: 40.7138, longitude: -74.005, timestamp: startTime + 10000 },
        ],
      });
      const result = engine.validateTimestamps(trip);
      expect(result).toBeNull();
    });
  });

  describe('detectSplitPoints', () => {
    it('should return single segment when no gaps > 300 seconds', () => {
      const startTime = Date.now() - 120000;
      const coordinates: GPSPoint[] = [
        { latitude: 40.7128, longitude: -74.006, timestamp: startTime },
        { latitude: 40.7138, longitude: -74.005, timestamp: startTime + 10000 },
        { latitude: 40.7148, longitude: -74.004, timestamp: startTime + 20000 },
      ];

      const segments = engine.detectSplitPoints(coordinates);
      expect(segments).toHaveLength(1);
      expect(segments[0]).toHaveLength(3);
    });

    it('should split into two segments when gap > 300 seconds', () => {
      const startTime = Date.now() - 600000;
      const coordinates: GPSPoint[] = [
        { latitude: 40.7128, longitude: -74.006, timestamp: startTime },
        { latitude: 40.7138, longitude: -74.005, timestamp: startTime + 10000 },
        // 400-second gap (> 300s threshold)
        { latitude: 40.7148, longitude: -74.004, timestamp: startTime + 410000 },
        { latitude: 40.7158, longitude: -74.003, timestamp: startTime + 420000 },
      ];

      const segments = engine.detectSplitPoints(coordinates);
      expect(segments).toHaveLength(2);
      expect(segments[0]).toHaveLength(2);
      expect(segments[1]).toHaveLength(2);
    });

    it('should not split when gap is exactly 300 seconds', () => {
      const startTime = Date.now() - 600000;
      const coordinates: GPSPoint[] = [
        { latitude: 40.7128, longitude: -74.006, timestamp: startTime },
        { latitude: 40.7138, longitude: -74.005, timestamp: startTime + 300000 }, // exactly 300s
      ];

      const segments = engine.detectSplitPoints(coordinates);
      expect(segments).toHaveLength(1);
    });

    it('should split when gap is 301 seconds', () => {
      const startTime = Date.now() - 600000;
      const coordinates: GPSPoint[] = [
        { latitude: 40.7128, longitude: -74.006, timestamp: startTime },
        { latitude: 40.7138, longitude: -74.005, timestamp: startTime + 301000 }, // 301s
      ];

      const segments = engine.detectSplitPoints(coordinates);
      expect(segments).toHaveLength(2);
    });

    it('should handle multiple split points', () => {
      const startTime = Date.now() - 1200000;
      const coordinates: GPSPoint[] = [
        { latitude: 40.7128, longitude: -74.006, timestamp: startTime },
        { latitude: 40.7138, longitude: -74.005, timestamp: startTime + 10000 },
        // First split (400s gap)
        { latitude: 40.7148, longitude: -74.004, timestamp: startTime + 410000 },
        { latitude: 40.7158, longitude: -74.003, timestamp: startTime + 420000 },
        // Second split (500s gap)
        { latitude: 40.7168, longitude: -74.002, timestamp: startTime + 920000 },
      ];

      const segments = engine.detectSplitPoints(coordinates);
      expect(segments).toHaveLength(3);
      expect(segments[0]).toHaveLength(2);
      expect(segments[1]).toHaveLength(2);
      expect(segments[2]).toHaveLength(1);
    });
  });

  describe('verifyTripRecordWithSplitting', () => {
    it('should verify a normal trip without splitting', async () => {
      const trip = createValidTrip();
      const output = await engine.verifyTripRecordWithSplitting(trip);

      expect(output.primaryResult.valid).toBe(true);
      expect(output.splitTrips).toHaveLength(0);
    });

    it('should split a trip with GPS gap > 300 seconds into separate trips', async () => {
      const startTime = Date.now() - 1000000;
      const coordinates: GPSPoint[] = [
        { latitude: 40.7128, longitude: -74.006, timestamp: startTime, speed: 50 },
        { latitude: 40.7138, longitude: -74.005, timestamp: startTime + 10000, speed: 50 },
        { latitude: 40.7148, longitude: -74.004, timestamp: startTime + 20000, speed: 50 },
        { latitude: 40.7158, longitude: -74.003, timestamp: startTime + 30000, speed: 50 },
        { latitude: 40.7168, longitude: -74.002, timestamp: startTime + 40000, speed: 50 },
        { latitude: 40.7178, longitude: -74.001, timestamp: startTime + 50000, speed: 50 },
        { latitude: 40.7188, longitude: -74.000, timestamp: startTime + 60000, speed: 50 },
        // 400-second gap (> 300s threshold)
        { latitude: 40.7198, longitude: -73.999, timestamp: startTime + 460000, speed: 50 },
        { latitude: 40.7208, longitude: -73.998, timestamp: startTime + 470000, speed: 50 },
        { latitude: 40.7218, longitude: -73.997, timestamp: startTime + 480000, speed: 50 },
        { latitude: 40.7228, longitude: -73.996, timestamp: startTime + 490000, speed: 50 },
        { latitude: 40.7238, longitude: -73.995, timestamp: startTime + 500000, speed: 50 },
        { latitude: 40.7248, longitude: -73.994, timestamp: startTime + 510000, speed: 50 },
        { latitude: 40.7258, longitude: -73.993, timestamp: startTime + 520000, speed: 50 },
      ];

      const trip = createValidTrip({
        startTime,
        endTime: startTime + 520000,
        coordinates,
        distanceKm: 2.0,
        speedReadings: [],
      });

      const output = await engine.verifyTripRecordWithSplitting(trip);

      // Should have primary + 1 split trip
      expect(output.splitTrips.length).toBeGreaterThanOrEqual(1);
    });

    it('should reject all sub-trips if integrity check fails', async () => {
      const trip = createValidTrip({ driverAddress: '' });
      const output = await engine.verifyTripRecordWithSplitting(trip);

      expect(output.primaryResult.valid).toBe(false);
      expect(output.primaryResult.rejectionReason).toContain('driverAddress');
      expect(output.splitTrips).toHaveLength(0);
    });
  });
});
