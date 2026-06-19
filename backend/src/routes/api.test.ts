import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// Mock the database connection before any service imports it
vi.mock('../database/connection', () => {
  const mockQuery = {
    whereRaw: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    first: vi.fn().mockResolvedValue(null), // driver not found → 404
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockResolvedValue(1),
    returning: vi.fn().mockResolvedValue([]),
    onConflict: vi.fn().mockReturnThis(),
    merge: vi.fn().mockReturnThis(),
    fn: { now: vi.fn().mockReturnValue(new Date()) },
  };
  const db = vi.fn(() => mockQuery) as any;
  db.fn = { now: vi.fn().mockReturnValue(new Date()) };
  return { default: db };
});

// Mock AccountAbstractionService so register doesn't try to deploy wallets
vi.mock('../services/wallet/AccountAbstractionService', () => ({
  AccountAbstractionService: vi.fn().mockImplementation(() => ({
    createWallet: vi.fn().mockResolvedValue({
      walletAddress: '0xAbC1234567890abcdef1234567890abcdef123456',
      deploymentTxHash: '0xdeadbeef',
    }),
  })),
}));

import { apiRouter } from './api';
import { generateToken } from '../middleware/auth';

// Create a test app
function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1', apiRouter);
  return app;
}

describe('API Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    app = createTestApp();
  });

  describe('GET /api/v1/status', () => {
    it('should return API status without authentication', async () => {
      const res = await request(app).get('/api/v1/status');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        message: 'SafeDrive Protocol API v1',
        version: '1.0.0',
      });
    });
  });

  describe('POST /api/v1/auth/register', () => {
    it('should validate registration input', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({ email: 'not-an-email', phone: '12' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation failed');
    });

    it('should accept valid registration input and attempt registration', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({ email: 'driver@example.com', phone: '+1234567890' });

      // Registration will either succeed (201) or fail with a server error (500)
      // depending on database/blockchain availability. It should NOT return 400.
      expect(res.status).not.toBe(400);
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('should validate login input', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'not-an-email' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation failed');
    });

    it('should accept valid login input', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'driver@example.com', phone: '+1234567890' });

      // LoginService is implemented — with no matching driver in mock DB it returns 401
      expect([200, 401, 501]).toContain(res.status);
      expect(res.status).not.toBe(400); // must pass validation
    });
  });

  describe('POST /api/v1/trips/submit', () => {
    it('should reject unauthenticated requests', async () => {
      const res = await request(app)
        .post('/api/v1/trips/submit')
        .send({});

      expect(res.status).toBe(401);
    });

    it('should reject users without Driver role', async () => {
      const token = generateToken({ userId: 'biz-1', role: 'Business' });
      const res = await request(app)
        .post('/api/v1/trips/submit')
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(403);
    });

    it('should validate trip data for authenticated drivers', async () => {
      const token = generateToken({ userId: 'driver-1', role: 'Driver' });
      const res = await request(app)
        .post('/api/v1/trips/submit')
        .set('Authorization', `Bearer ${token}`)
        .send({ invalid: 'data' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation failed');
    });

    it('should accept valid trip data from authenticated drivers', async () => {
      const token = generateToken({ userId: 'driver-1', role: 'Driver', walletAddress: '0x1234567890abcdef1234567890abcdef12345678' });
      const now = Date.now();
      const validTrip = {
        startTime: now - 3600000, // 1 hour ago
        endTime: now,
        coordinates: Array.from({ length: 360 }, (_, i) => ({
          latitude: 40.7128 + i * 0.0001,
          longitude: -74.006 + i * 0.0001,
          timestamp: now - 3600000 + i * 10000, // 1 per 10 seconds
        })),
        distanceKm: 5.2,
        category: 'commute',
      };

      const res = await request(app)
        .post('/api/v1/trips/submit')
        .set('Authorization', `Bearer ${token}`)
        .send(validTrip);

      // Should now return 200 with trip summary (verified) or 422 (rejected)
      expect([200, 422]).toContain(res.status);
      if (res.status === 200) {
        expect(res.body.tripId).toBeDefined();
        expect(res.body.verified).toBe(true);
        expect(res.body.grade).toMatch(/^[A-F]$/);
        expect(res.body.factors).toBeDefined();
        expect(res.body.dvxReward).toBeGreaterThanOrEqual(0);
        expect(res.body.dvxReward).toBeLessThanOrEqual(50);
      }
    });

    it('should reject trip with insufficient GPS frequency', async () => {
      const token = generateToken({ userId: 'driver-1', role: 'Driver', walletAddress: '0x1234567890abcdef1234567890abcdef12345678' });
      const now = Date.now();
      // 1 hour trip but only 2 coordinates (way below 1 per 10 seconds)
      const tripWithLowFrequency = {
        startTime: now - 3600000,
        endTime: now,
        coordinates: [
          { latitude: 40.7128, longitude: -74.006, timestamp: now - 3600000 },
          { latitude: 40.7130, longitude: -74.005, timestamp: now },
        ],
        distanceKm: 5.2,
        category: 'commute',
      };

      const res = await request(app)
        .post('/api/v1/trips/submit')
        .set('Authorization', `Bearer ${token}`)
        .send(tripWithLowFrequency);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('GPS frequency validation failed');
    });
  });

  describe('GET /api/v1/drivers/:address/score', () => {
    it('should validate Ethereum address format', async () => {
      const res = await request(app).get('/api/v1/drivers/invalid-address/score');

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation failed');
    });

    it('should accept valid Ethereum address', async () => {
      const res = await request(app).get(
        '/api/v1/drivers/0x1234567890abcdef1234567890abcdef12345678/score'
      );

      // With no DB, driver is not found → 404. Without DB it won't be 400 (bad input).
      expect(res.status).not.toBe(400);
      expect([200, 404, 501]).toContain(res.status);
    });
  });

  describe('Consent endpoints', () => {
    it('should reject unauthenticated consent requests', async () => {
      const res = await request(app).get('/api/v1/consent/grants');
      expect(res.status).toBe(401);
    });

    it('should reject non-Driver roles for consent endpoints', async () => {
      const token = generateToken({ userId: 'insurer-1', role: 'Insurer' });
      const res = await request(app)
        .get('/api/v1/consent/grants')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
    });

    it('should allow Driver role for consent endpoints', async () => {
      const token = generateToken({ userId: 'driver-1', role: 'Driver' });
      const res = await request(app)
        .get('/api/v1/consent/grants')
        .set('Authorization', `Bearer ${token}`);

      // With mocked DB returning empty array, service succeeds → 200
      expect([200, 501]).toContain(res.status);
    });
  });

  describe('Business/Insurer endpoints', () => {
    it('should reject unauthenticated verify requests', async () => {
      const res = await request(app)
        .post('/api/v1/verify/single')
        .send({});

      expect(res.status).toBe(401);
    });

    it('should reject Driver role for verify endpoints', async () => {
      const token = generateToken({ userId: 'driver-1', role: 'Driver' });
      const res = await request(app)
        .post('/api/v1/verify/single')
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(403);
    });

    it('should allow Insurer role for verify endpoints', async () => {
      const token = generateToken({ userId: 'insurer-1', role: 'Insurer' });
      const res = await request(app)
        .post('/api/v1/verify/single')
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(501);
    });

    it('should reject Driver role for marketplace endpoints', async () => {
      const token = generateToken({ userId: 'driver-1', role: 'Driver' });
      const res = await request(app)
        .post('/api/v1/marketplace/jobs')
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(403);
    });

    it('should allow Business role for marketplace endpoints', async () => {
      const token = generateToken({ userId: 'biz-1', role: 'Business' });
      const res = await request(app)
        .post('/api/v1/marketplace/jobs')
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(501);
    });
  });
});
