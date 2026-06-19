import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TripSubmissionService, GPSFrequencyError } from './TripSubmissionService';
import { TripVerificationEngine } from '../tripVerification/TripVerificationEngine';
import { ScoringEngine } from '../scoring/ScoringEngine';
import { TripRecord, VERIFICATION_CONSTANTS } from '../tripVerification/types';

// Mock dependencies
const mockStorageProvider = {
  upload: vi.fn().mockResolvedValue('file://test/path'),
  download: vi.fn(),
  delete: vi.fn(),
  exists: vi.fn(),
};

const mockDbClient = {
  insertTripRecord: vi.fn().mockResolvedValue(undefined),
};

function createService() {
  const verificationEngine = new TripVerificationEngine(mockStorageProvider, mockDbClient);
  const scoringEngine = new ScoringEngine();
  return new TripSubmissionService(verificationEngine, scoringEngine);
}

/**
 * Generate a valid trip payload with proper GPS frequency.
 * Creates coordinates at 1 per 10 seconds for the given duration.
 */
function generateValidTrip(durationSeconds: number = 600): Omit<TripRecord, 'driverAddress'> {
  const now = Date.now();
  const startTime = now - durationSeconds * 1000;
  const endTime = now;
  const coordinateCount = Math.floor(durationSeconds / VERIFICATION_CONSTANTS.GPS_INTERVAL_SECONDS) + 1;

  const coordinates = Array.from({ length: coordinateCount }, (_, i) => ({
    latitude: 40.7128 + i * 0.0001,
    longitude: -74.006 + i * 0.0001,
    timestamp: startTime + i * VERIFICATION_CONSTANTS.GPS_INTERVAL_SECONDS * 1000,
    speed: 50 + Math.random() * 20, // 50-70 km/h
  }));

  return {
    startTime,
    endTime,
    coordinates,
    speedReadings: coordinates.map((c) => c.speed!),
    brakingEvents: [],
    accelerationEvents: [],
    corneringEvents: [],
    phoneUsageEvents: [],
    distanceKm: 5.0,
    category: 'commute',
  };
}

describe('TripSubmissionService', () => {
  let service: TripSubmissionService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = createService();
  });

  describe('submitTrip', () => {
    it('should verify and score a valid trip', async () => {
      const tripData = generateValidTrip(600); // 10-minute trip

      const result = await service.submitTrip('0xdriver123', tripData);

      expect(result.tripId).toBeDefined();
      expect(result.tripId.length).toBeGreaterThan(0);
      expect(result.verified).toBe(true);
      expect(result.grade).toMatch(/^[A-F]$/);
      expect(result.factors).toBeDefined();
      expect(result.factors!.speedCompliance).toBeGreaterThanOrEqual(0);
      expect(result.factors!.speedCompliance).toBeLessThanOrEqual(1000);
      expect(result.factors!.brakingSmooth).toBeGreaterThanOrEqual(0);
      expect(result.factors!.brakingSmooth).toBeLessThanOrEqual(1000);
      expect(result.dvxReward).toBeGreaterThanOrEqual(0);
      expect(result.dvxReward).toBeLessThanOrEqual(50);
      expect(result.overallScore).toBeGreaterThanOrEqual(0);
      expect(result.overallScore).toBeLessThanOrEqual(1000);
    });

    it('should reject trip with insufficient GPS frequency', async () => {
      const now = Date.now();
      const tripData: Omit<TripRecord, 'driverAddress'> = {
        startTime: now - 3600000, // 1 hour ago
        endTime: now,
        coordinates: [
          { latitude: 40.7128, longitude: -74.006, timestamp: now - 3600000 },
          { latitude: 40.7130, longitude: -74.005, timestamp: now },
        ],
        speedReadings: [50, 60],
        brakingEvents: [],
        accelerationEvents: [],
        corneringEvents: [],
        phoneUsageEvents: [],
        distanceKm: 5.0,
        category: 'commute',
      };

      await expect(service.submitTrip('0xdriver123', tripData)).rejects.toThrow(GPSFrequencyError);
    });

    it('should reject trip with anomalies (excessive speed)', async () => {
      const tripData = generateValidTrip(600);
      // Add excessive speed readings
      tripData.speedReadings = tripData.coordinates.map(() => 300); // 300 km/h
      tripData.coordinates = tripData.coordinates.map((c) => ({ ...c, speed: 300 }));

      const result = await service.submitTrip('0xdriver123', tripData);

      expect(result.verified).toBe(false);
      expect(result.rejectionReason).toBeDefined();
      expect(result.rejectionReason).toContain('Speed');
    });

    it('should return DVX reward between 0 and 50', async () => {
      const tripData = generateValidTrip(600);

      const result = await service.submitTrip('0xdriver123', tripData);

      expect(result.verified).toBe(true);
      expect(result.dvxReward).toBeGreaterThanOrEqual(0);
      expect(result.dvxReward).toBeLessThanOrEqual(50);
    });

    it('should return grade A-F based on overall score', async () => {
      const tripData = generateValidTrip(600);

      const result = await service.submitTrip('0xdriver123', tripData);

      expect(result.verified).toBe(true);
      expect(['A', 'B', 'C', 'D', 'F']).toContain(result.grade);
    });

    it('should include all factor scores in response', async () => {
      const tripData = generateValidTrip(600);

      const result = await service.submitTrip('0xdriver123', tripData);

      expect(result.verified).toBe(true);
      expect(result.factors).toHaveProperty('speedCompliance');
      expect(result.factors).toHaveProperty('brakingSmooth');
      expect(result.factors).toHaveProperty('accelerationPattern');
      expect(result.factors).toHaveProperty('corneringSafety');
      expect(result.factors).toHaveProperty('phoneAvoidance');
      expect(result.factors).toHaveProperty('timeOfDayRisk');
    });

    it('should use driver wallet address from parameter', async () => {
      const tripData = generateValidTrip(600);
      const driverAddress = '0xABCDEF1234567890';

      const result = await service.submitTrip(driverAddress, tripData);

      expect(result.verified).toBe(true);
      // Verify the storage was called (indicating the driver address was passed through)
      expect(mockStorageProvider.upload).toHaveBeenCalled();
      const uploadKey = mockStorageProvider.upload.mock.calls[0][0] as string;
      expect(uploadKey).toContain(driverAddress);
    });
  });

  describe('submitBatch', () => {
    it('should process multiple trips and return batch results', async () => {
      const trips = [
        generateValidTrip(600),
        generateValidTrip(300),
      ];

      const result = await service.submitBatch('0xdriver123', trips);

      expect(result.total).toBe(2);
      expect(result.successful + result.failed).toBe(2);
      expect(result.results).toHaveLength(2);
    });

    it('should continue processing after individual trip failure', async () => {
      const now = Date.now();
      const trips = [
        // Invalid trip (insufficient GPS frequency)
        {
          startTime: now - 3600000,
          endTime: now,
          coordinates: [
            { latitude: 40.7128, longitude: -74.006, timestamp: now - 3600000 },
            { latitude: 40.7130, longitude: -74.005, timestamp: now },
          ],
          speedReadings: [50, 60],
          brakingEvents: [],
          accelerationEvents: [],
          corneringEvents: [],
          phoneUsageEvents: [],
          distanceKm: 5.0,
          category: 'commute' as const,
        },
        // Valid trip
        generateValidTrip(600),
      ];

      const result = await service.submitBatch('0xdriver123', trips);

      expect(result.total).toBe(2);
      expect(result.failed).toBeGreaterThanOrEqual(1);
      expect(result.results).toHaveLength(2);
      // The second trip should still be processed
      expect(result.results[1].tripId).toBeDefined();
    });

    it('should handle empty batch gracefully', async () => {
      const result = await service.submitBatch('0xdriver123', []);

      expect(result.total).toBe(0);
      expect(result.successful).toBe(0);
      expect(result.failed).toBe(0);
      expect(result.results).toHaveLength(0);
    });
  });

  describe('GPS frequency validation', () => {
    it('should accept trip with exactly minimum required coordinates', async () => {
      const durationSeconds = 100; // 100 seconds
      const tripData = generateValidTrip(durationSeconds);

      // Should not throw
      const result = await service.submitTrip('0xdriver123', tripData);
      expect(result.tripId).toBeDefined();
    });

    it('should allow short trips with few coordinates', async () => {
      const now = Date.now();
      // 20-second trip with 3 coordinates (1 per 10 seconds) - meets frequency
      const tripData: Omit<TripRecord, 'driverAddress'> = {
        startTime: now - 20000,
        endTime: now,
        coordinates: [
          { latitude: 40.7128, longitude: -74.006, timestamp: now - 20000 },
          { latitude: 40.7129, longitude: -74.0059, timestamp: now - 10000 },
          { latitude: 40.7130, longitude: -74.005, timestamp: now },
        ],
        speedReadings: [50, 55, 60],
        brakingEvents: [],
        accelerationEvents: [],
        corneringEvents: [],
        phoneUsageEvents: [],
        distanceKm: 0.5,
        category: 'commute',
      };

      const result = await service.submitTrip('0xdriver123', tripData);
      expect(result.tripId).toBeDefined();
    });
  });
});
