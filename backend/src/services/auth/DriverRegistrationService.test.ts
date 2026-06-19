import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DriverRegistrationService, RegistrationError } from './DriverRegistrationService';

// Shared mock chain — same object returned every time db('table') is called
const mockChain = {
  where: vi.fn().mockReturnThis(),
  first: vi.fn().mockResolvedValue(null), // default: no existing driver
  insert: vi.fn().mockReturnThis(),
  returning: vi.fn().mockResolvedValue([
    { id: 'test-uuid-123', wallet_address: '0xAbC1234567890abcdef1234567890abcdef123456' },
  ]),
};

vi.mock('../../database/connection', () => {
  const mockDb = vi.fn(() => mockChain);
  return { default: mockDb };
});

// Mock the auth middleware
vi.mock('../../middleware/auth', () => ({
  generateToken: vi.fn().mockReturnValue('mock-jwt-token-xyz'),
}));

// Mock AccountAbstractionService
const mockCreateWallet = vi.fn().mockResolvedValue({
  walletAddress: '0xAbC1234567890abcdef1234567890abcdef123456',
  deploymentTxHash: '0xdeadbeef1234567890',
});

vi.mock('../wallet/AccountAbstractionService', () => ({
  AccountAbstractionService: vi.fn().mockImplementation(() => ({
    createWallet: mockCreateWallet,
  })),
}));

describe('DriverRegistrationService', () => {
  let service: DriverRegistrationService;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset chain to defaults after each test
    mockChain.first.mockResolvedValue(null);
    mockChain.returning.mockResolvedValue([
      { id: 'test-uuid-123', wallet_address: '0xAbC1234567890abcdef1234567890abcdef123456' },
    ]);
    service = new DriverRegistrationService();
  });

  describe('register', () => {
    it('should register a new driver with email and phone', async () => {
      const result = await service.register({
        email: 'driver@example.com',
        phone: '+1234567890',
      });

      expect(result).toEqual({
        driverId: 'test-uuid-123',
        walletAddress: '0xAbC1234567890abcdef1234567890abcdef123456',
        token: 'mock-jwt-token-xyz',
      });
    });

    it('should create an Account Abstraction wallet with email and phone', async () => {
      await service.register({
        email: 'driver@example.com',
        phone: '+1234567890',
      });

      expect(mockCreateWallet).toHaveBeenCalledWith(
        'driver@example.com',
        '+1234567890'
      );
    });

    it('should normalize email to lowercase', async () => {
      await service.register({
        email: 'Driver@Example.COM',
        phone: '+1234567890',
      });

      expect(mockCreateWallet).toHaveBeenCalledWith(
        'Driver@Example.COM',
        '+1234567890'
      );
    });

    it('should throw RegistrationError when email already exists', async () => {
      // Make first() return an existing driver so the duplicate check triggers
      mockChain.first.mockResolvedValue({ id: 'existing-id', email: 'driver@example.com' });

      await expect(
        service.register({ email: 'driver@example.com', phone: '+1234567890' })
      ).rejects.toThrow(RegistrationError);

      await expect(
        service.register({ email: 'driver@example.com', phone: '+1234567890' })
      ).rejects.toMatchObject({ code: 'EMAIL_EXISTS' });
    });

    it('should throw when wallet creation fails', async () => {
      mockCreateWallet.mockRejectedValueOnce(new Error('Bundler unavailable'));

      await expect(
        service.register({ email: 'new@example.com', phone: '+9876543210' })
      ).rejects.toThrow('Bundler unavailable');
    });

    it('should return a JWT token with Driver role', async () => {
      const { generateToken } = await import('../../middleware/auth');

      await service.register({
        email: 'driver@example.com',
        phone: '+1234567890',
      });

      expect(generateToken).toHaveBeenCalledWith({
        userId: 'test-uuid-123',
        walletAddress: '0xAbC1234567890abcdef1234567890abcdef123456',
        role: 'Driver',
      });
    });
  });
});
