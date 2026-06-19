import { Router, Request, Response } from 'express';
import {
  authenticatedRateLimiter,
  businessRateLimiter,
} from '../middleware/rateLimiter';
import {
  authenticate,
  authorize,
  optionalAuth,
  AuthenticatedRequest,
} from '../middleware/auth';
import { validate } from '../middleware/validation';
import { registerSchema, loginSchema } from '../schemas/auth';
import { tripSubmitSchema, tripBatchSubmitSchema } from '../schemas/trips';
import { driverAddressParamsSchema } from '../schemas/drivers';
import {
  DriverRegistrationService,
  RegistrationError,
} from '../services/auth/DriverRegistrationService';
import { LoginService, LoginError } from '../services/auth/LoginService';
import {
  TripSubmissionService,
  GPSFrequencyError,
} from '../services/tripSubmission';
import { TripVerificationEngine } from '../services/tripVerification';
import { ScoringEngine } from '../services/scoring';
import { LocalFileStorageProvider } from '../services/storage/LocalFileStorageProvider';
import { DriverScoreService, DriverNotFoundError } from '../services/drivers';
import { ConsentService, ConsentError } from '../services/consent';
import { grantConsentSchema } from '../schemas/consent';
import {
  InsuranceVerificationService,
  ConsentNotGrantedError,
} from '../services/insurance/InsuranceVerificationService';
import { z } from 'zod';

export const apiRouter = Router();

const registrationService = new DriverRegistrationService();
const loginService = new LoginService();
const driverScoreService = new DriverScoreService();
const consentService = new ConsentService();
const insuranceService = new InsuranceVerificationService();

// Initialize trip submission dependencies
const storageProvider = new LocalFileStorageProvider(
  process.env.STORAGE_PATH || './data/trip-storage'
);
const dbClient = {
  insertTripRecord: async () => {
    // Database integration handled by TripVerificationEngine
    // Full implementation wired when database connection is available
  },
};
const verificationEngine = new TripVerificationEngine(storageProvider, dbClient);
const scoringEngine = new ScoringEngine();
const tripSubmissionService = new TripSubmissionService(verificationEngine, scoringEngine);

// ─── Public endpoints ────────────────────────────────────────────────────────

/**
 * GET /api/v1/status
 * Public API status endpoint
 */
apiRouter.get('/status', (_req: Request, res: Response) => {
  res.json({ message: 'SafeDrive Protocol API v1', version: '1.0.0' });
});

// ─── Auth endpoints (public, rate-limited) ───────────────────────────────────

/**
 * POST /api/v1/auth/register
 * Register a new driver with email + phone (crypto-invisible onboarding)
 * Creates an ERC-4337 Account Abstraction wallet on Base.
 * No seed phrase or private key exposed to the user.
 */
apiRouter.post(
  '/auth/register',
  validate(registerSchema),
  async (req: Request, res: Response) => {
    try {
      const { email, phone } = req.body;

      const result = await registrationService.register({ email, phone });

      res.status(201).json({
        message: 'Registration successful',
        driverId: result.driverId,
        walletAddress: result.walletAddress,
        token: result.token,
      });
    } catch (err) {
      if (err instanceof RegistrationError) {
        if (err.code === 'EMAIL_EXISTS') {
          res.status(409).json({ error: err.message });
          return;
        }
      }
      console.error('Registration error:', err);
      res.status(500).json({ error: 'Registration failed. Please try again.' });
    }
  }
);

/**
 * POST /api/v1/auth/login
 * Authenticate a user and return a JWT token (30-minute session)
 */
apiRouter.post(
  '/auth/login',
  validate(loginSchema),
  async (req: Request, res: Response) => {
    try {
      const { email, phone } = req.body;

      const result = await loginService.login(email, phone);

      res.status(200).json({
        message: 'Login successful',
        driverId: result.driverId,
        walletAddress: result.walletAddress,
        token: result.token,
      });
    } catch (err) {
      if (err instanceof LoginError) {
        if (err.code === 'INVALID_CREDENTIALS') {
          res.status(401).json({ error: 'Invalid email or phone number.' });
          return;
        }
      }
      console.error('Login error:', err);
      res.status(500).json({ error: 'Login failed. Please try again.' });
    }
  }
);

// ─── Authenticated driver endpoints (1000 req/15min) ─────────────────────────

/**
 * POST /api/v1/trips/submit
 * Submit a trip record for verification and scoring.
 * Requires Driver or Admin role.
 *
 * Validates GPS coordinate frequency (1 per 10 seconds),
 * passes to Trip Verification Engine, then Scoring Engine.
 * Returns trip summary (grade, factor scores, DVX reward) within 30 seconds.
 *
 * Requirements: 1.3, 1.4, 8.6
 */
apiRouter.post(
  '/trips/submit',
  authenticate,
  authorize('Driver', 'Admin'),
  authenticatedRateLimiter,
  validate(tripSubmitSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const driverAddress = req.user?.walletAddress || req.user?.userId || '';
      const tripData = req.body;

      const result = await tripSubmissionService.submitTrip(driverAddress, tripData);

      if (!result.verified) {
        res.status(422).json({
          error: 'Trip verification failed',
          tripId: result.tripId,
          rejectionReason: result.rejectionReason,
        });
        return;
      }

      res.status(200).json({
        tripId: result.tripId,
        verified: true,
        grade: result.grade,
        overallScore: result.overallScore,
        factors: result.factors,
        dvxReward: result.dvxReward,
        verifiedDistanceKm: result.verifiedDistanceKm,
      });
    } catch (err) {
      if (err instanceof GPSFrequencyError) {
        res.status(400).json({
          error: 'GPS frequency validation failed',
          details: err.message,
        });
        return;
      }
      console.error('Trip submission error:', err);
      res.status(500).json({ error: 'Trip submission failed. Please try again.' });
    }
  }
);

/**
 * POST /api/v1/trips/submit/batch
 * Submit multiple trip records for offline sync.
 * Accepts up to 50 trips per batch (matching local storage limit).
 * Requires Driver or Admin role.
 *
 * Requirements: 1.4, 8.6
 */
apiRouter.post(
  '/trips/submit/batch',
  authenticate,
  authorize('Driver', 'Admin'),
  authenticatedRateLimiter,
  validate(tripBatchSubmitSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const driverAddress = req.user?.walletAddress || req.user?.userId || '';
      const { trips } = req.body;

      const batchResult = await tripSubmissionService.submitBatch(driverAddress, trips);

      res.status(200).json({
        total: batchResult.total,
        successful: batchResult.successful,
        failed: batchResult.failed,
        results: batchResult.results,
      });
    } catch (err) {
      console.error('Batch trip submission error:', err);
      res.status(500).json({ error: 'Batch submission failed. Please try again.' });
    }
  }
);

/**
 * GET /api/v1/drivers/:address/score
 * Get a driver's safety score by wallet address.
 * Accessible by any authenticated user (score is public on-chain).
 */
apiRouter.get(
  '/drivers/:address/score',
  optionalAuth,
  validate(driverAddressParamsSchema, 'params'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const score = await driverScoreService.getDriverScore(req.params.address);
      res.status(200).json(score);
    } catch (err) {
      if (err instanceof DriverNotFoundError) {
        res.status(404).json({ error: 'Driver not found.' });
        return;
      }
      console.error('Score retrieval error:', err);
      res.status(500).json({ error: 'Score retrieval failed. Please try again.' });
    }
  }
);

// ─── Consent endpoints (authenticated drivers) ───────────────────────────────

/**
 * GET /api/v1/consent/grants
 * List all active consent grants for the authenticated driver.
 * Requirements: 5.7, 14.4
 */
apiRouter.get(
  '/consent/grants',
  authenticate,
  authorize('Driver', 'Admin'),
  authenticatedRateLimiter,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const driverAddress = req.user?.walletAddress || req.user?.userId || '';
      const grants = await consentService.getActiveGrants(driverAddress);
      res.status(200).json({ grants });
    } catch (err) {
      console.error('Consent grants retrieval error:', err);
      res.status(500).json({ error: 'Failed to retrieve consent grants. Please try again.' });
    }
  }
);

/**
 * POST /api/v1/consent/grant
 * Grant consent to an authorized party for specified data categories.
 * Duration is capped at 12 months. Categories use bitmask encoding.
 * Requirements: 5.4, 5.8, 14.1, 14.2, 14.3
 */
apiRouter.post(
  '/consent/grant',
  authenticate,
  authorize('Driver', 'Admin'),
  authenticatedRateLimiter,
  validate(grantConsentSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const driverAddress = req.user?.walletAddress || req.user?.userId || '';
      const { party, categories, durationSeconds } = req.body;

      const grant = await consentService.grantConsent(
        driverAddress,
        party,
        categories,
        durationSeconds
      );

      res.status(201).json({ grant });
    } catch (err) {
      if (err instanceof ConsentError) {
        if (err.code === 'INVALID_CATEGORIES') {
          res.status(400).json({ error: err.message });
          return;
        }
        if (err.code === 'DURATION_EXCEEDED') {
          res.status(400).json({ error: err.message });
          return;
        }
      }
      console.error('Consent grant error:', err);
      res.status(500).json({ error: 'Failed to grant consent. Please try again.' });
    }
  }
);

/**
 * DELETE /api/v1/consent/:grantId
 * Revoke a consent grant immediately.
 * Requirements: 5.4, 14.2, 14.4
 */
apiRouter.delete(
  '/consent/:grantId',
  authenticate,
  authorize('Driver', 'Admin'),
  authenticatedRateLimiter,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const driverAddress = req.user?.walletAddress || req.user?.userId || '';
      await consentService.revokeConsent(driverAddress, req.params.grantId);
      res.status(204).send();
    } catch (err) {
      if (err instanceof ConsentError) {
        if (err.code === 'GRANT_NOT_FOUND') {
          res.status(404).json({ error: 'Consent grant not found.' });
          return;
        }
        if (err.code === 'ALREADY_REVOKED') {
          res.status(409).json({ error: 'Consent grant has already been revoked.' });
          return;
        }
      }
      console.error('Consent revocation error:', err);
      res.status(500).json({ error: 'Failed to revoke consent. Please try again.' });
    }
  }
);

// ─── Business/Insurer endpoints (5000 req/15min) ─────────────────────────────

/**
 * POST /api/v1/verify/single
 * Verify a single driver's Safety Score for insurance purposes.
 * Requires Insurer or Admin role. Enforces consent check.
 * Returns Safety Score, risk category, tenure, km.
 * Charges 5 USDC verification fee (routed to Revenue Distributor).
 *
 * Requirements: 5.1, 5.2, 5.3, 5.5, 5.6
 */
const verifySingleSchema = z.object({
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address'),
});

apiRouter.post(
  '/verify/single',
  authenticate,
  authorize('Insurer', 'Admin'),
  businessRateLimiter,
  validate(verifySingleSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { walletAddress } = req.body;
      const requestingParty = req.user?.userId || '';

      const result = await insuranceService.verifySingle(walletAddress, requestingParty);

      res.status(200).json({
        walletAddress: result.walletAddress,
        safetyScore: result.safetyScore,
        riskCategory: result.riskCategory,
        totalTrips: result.totalTrips,
        totalKilometers: result.totalKilometers,
        tenureStartDate: result.tenureStartDate,
        isVerified: result.isVerified,
        verificationFee: '5 USDC',
      });
    } catch (err) {
      if (err instanceof ConsentNotGrantedError) {
        res.status(403).json({ error: 'Consent not granted. Driver has not authorized data access for this party.' });
        return;
      }
      console.error('Verification error:', err);
      res.status(500).json({ error: 'Verification failed. Please try again.' });
    }
  }
);

/**
 * POST /api/v1/verify/batch
 * Batch verify up to 1000 wallet addresses.
 * Requires Insurer or Admin role.
 * Returns scores within 30 seconds.
 * Addresses without consent are silently skipped (count reported).
 *
 * Requirements: 5.2, 5.5
 */
const verifyBatchSchema = z.object({
  walletAddresses: z.array(
    z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address')
  ).min(1).max(1000),
});

apiRouter.post(
  '/verify/batch',
  authenticate,
  authorize('Insurer', 'Admin'),
  businessRateLimiter,
  validate(verifyBatchSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { walletAddresses } = req.body;
      const requestingParty = req.user?.userId || '';

      const result = await insuranceService.verifyBatch(walletAddresses, requestingParty);

      res.status(200).json({
        total: result.total,
        processed: result.processed,
        consentDenied: result.consentDenied,
        results: result.results,
        verificationFee: `${result.processed * 5} USDC`,
      });
    } catch (err) {
      console.error('Batch verification error:', err);
      res.status(500).json({ error: 'Batch verification failed. Please try again.' });
    }
  }
);

apiRouter.post(
  '/marketplace/jobs',
  authenticate,
  authorize('Business', 'Admin'),
  businessRateLimiter,
  (req: AuthenticatedRequest, res: Response) => {
    res.status(501).json({ error: 'Marketplace launching in Phase 4.' });
  }
);

apiRouter.get(
  '/marketplace/matches',
  authenticate,
  authorize('Business', 'Admin'),
  businessRateLimiter,
  (req: AuthenticatedRequest, res: Response) => {
    res.status(501).json({ error: 'Marketplace launching in Phase 4.' });
  }
);
