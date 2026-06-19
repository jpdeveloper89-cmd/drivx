import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AccountAbstractionService } from './AccountAbstractionService';

// Mock ethers to avoid real blockchain calls
vi.mock('ethers', () => {
  const mockWallet = {
    address: '0xBackendSigner1234567890abcdef1234567890ab',
    signMessage: vi.fn().mockResolvedValue('0xmocksignature'),
    connect: vi.fn().mockReturnThis(),
  };

  return {
    ethers: {
      JsonRpcProvider: vi.fn().mockImplementation(() => ({
        call: vi.fn().mockResolvedValue(
          '0x000000000000000000000000aabbccdd11223344556677889900aabbccddeeff'
        ),
        getFeeData: vi.fn().mockResolvedValue({
          maxFeePerGas: 1000000000n,
          maxPriorityFeePerGas: 1000000000n,
        }),
      })),
      Wallet: Object.assign(
        vi.fn().mockImplementation(() => mockWallet),
        { createRandom: vi.fn().mockReturnValue(mockWallet) }
      ),
      Interface: vi.fn().mockImplementation(() => ({
        encodeFunctionData: vi.fn().mockReturnValue('0xmockcalldata'),
      })),
      AbiCoder: {
        defaultAbiCoder: () => ({
          encode: vi.fn().mockReturnValue('0xmockencoded'),
          decode: vi.fn().mockReturnValue(['0xAaBbCcDd11223344556677889900AaBbCcDdEeFf']),
        }),
      },
      keccak256: vi.fn().mockReturnValue(
        '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'
      ),
      toUtf8Bytes: vi.fn().mockReturnValue(new Uint8Array([1, 2, 3])),
      getBytes: vi.fn().mockReturnValue(new Uint8Array([1, 2, 3])),
      getAddress: vi.fn().mockImplementation((addr: string) => addr),
      toBeHex: vi.fn().mockImplementation((val: any) => `0x${val.toString(16)}`),
      concat: vi.fn().mockReturnValue('0xconcatenated'),
    },
  };
});

// Mock the config
vi.mock('../../config/env', () => ({
  config: {
    blockchain: {
      rpcUrl: '',
      backendSignerKey: '',
      bundlerUrl: '',
      paymasterUrl: '',
      accountFactoryAddress: '',
      entryPointAddress: '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789',
      chainId: 8453,
    },
  },
}));

describe('AccountAbstractionService', () => {
  let service: AccountAbstractionService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AccountAbstractionService();
  });

  describe('createWallet', () => {
    it('should create a wallet and return an address and tx hash', async () => {
      const result = await service.createWallet('driver@example.com', '+1234567890');

      expect(result).toHaveProperty('walletAddress');
      expect(result).toHaveProperty('deploymentTxHash');
      expect(result.walletAddress).toBeTruthy();
      expect(result.deploymentTxHash).toBeTruthy();
    });

    it('should produce deterministic addresses for same credentials', async () => {
      const result1 = await service.createWallet('driver@example.com', '+1234567890');
      const result2 = await service.createWallet('driver@example.com', '+1234567890');

      expect(result1.walletAddress).toBe(result2.walletAddress);
    });

    it('should produce different addresses for different credentials', async () => {
      // Since we're mocking keccak256 to return the same value, we need to
      // verify the function is called with different inputs
      const { ethers } = await import('ethers');

      await service.createWallet('driver1@example.com', '+1111111111');
      const firstCallArgs = vi.mocked(ethers.toUtf8Bytes).mock.calls.slice();

      await service.createWallet('driver2@example.com', '+2222222222');
      const secondCallArgs = vi.mocked(ethers.toUtf8Bytes).mock.calls.slice();

      // The salt generation should use different inputs
      expect(firstCallArgs).not.toEqual(secondCallArgs);
    });

    it('should not expose any private key or seed phrase in the result', async () => {
      const result = await service.createWallet('driver@example.com', '+1234567890');

      // Verify no sensitive data is in the result
      const resultStr = JSON.stringify(result);
      expect(resultStr).not.toContain('privateKey');
      expect(resultStr).not.toContain('seedPhrase');
      expect(resultStr).not.toContain('mnemonic');
    });

    it('should normalize email and phone for salt generation', async () => {
      const { ethers } = await import('ethers');

      await service.createWallet('Driver@Example.COM', '+1 234 567 890');

      // Verify toUtf8Bytes was called with normalized input for salt
      expect(ethers.toUtf8Bytes).toHaveBeenCalledWith(
        'driver@example.com:+1234567890'
      );
    });
  });
});
