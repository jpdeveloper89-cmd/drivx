import { ethers } from 'ethers';
import { config } from '../../config/env';

/**
 * Wallet creation result returned after deploying an Account Abstraction wallet.
 */
export interface WalletCreationResult {
  walletAddress: string;
  deploymentTxHash: string;
}

/**
 * UserOperation structure for ERC-4337 bundler submission.
 */
interface UserOperation {
  sender: string;
  nonce: string;
  initCode: string;
  callData: string;
  callGasLimit: string;
  verificationGasLimit: string;
  preVerificationGas: string;
  maxFeePerGas: string;
  maxPriorityFeePerGas: string;
  paymasterAndData: string;
  signature: string;
}

/**
 * AccountAbstractionService handles ERC-4337 wallet deployment on Base.
 *
 * - Deploys smart contract wallets using a SimpleAccountFactory pattern
 * - Integrates with a bundler to submit UserOperations
 * - Uses a paymaster to sponsor all gas fees for driver transactions
 * - No seed phrase or private key is exposed to the user
 */
export class AccountAbstractionService {
  private provider: ethers.JsonRpcProvider;
  private backendSigner: ethers.Wallet;
  private bundlerUrl: string;
  private paymasterUrl: string;
  private accountFactoryAddress: string;
  private entryPointAddress: string;

  constructor() {
    const rpcUrl = config.blockchain?.rpcUrl;
    const signerKey = config.blockchain?.backendSignerKey;
    this.bundlerUrl = config.blockchain?.bundlerUrl || '';
    this.paymasterUrl = config.blockchain?.paymasterUrl || '';
    this.accountFactoryAddress = config.blockchain?.accountFactoryAddress || '';
    this.entryPointAddress = config.blockchain?.entryPointAddress || '';

    if (!rpcUrl || !signerKey) {
      // In development/test mode, allow service to be instantiated without real keys
      this.provider = new ethers.JsonRpcProvider(rpcUrl || 'http://localhost:8545');
      this.backendSigner = ethers.Wallet.createRandom().connect(this.provider);
    } else {
      this.provider = new ethers.JsonRpcProvider(rpcUrl);
      this.backendSigner = new ethers.Wallet(signerKey, this.provider);
    }
  }

  /**
   * Creates an Account Abstraction wallet for a driver.
   * Uses ERC-4337 to deploy a smart contract wallet on Base.
   *
   * The wallet is deterministically derived from the driver's email and phone,
   * ensuring the same credentials always produce the same wallet address.
   * No seed phrase or private key is exposed to the user.
   *
   * @param email - Driver's email address
   * @param phone - Driver's phone number
   * @returns WalletCreationResult with the deployed wallet address
   */
  async createWallet(email: string, phone: string): Promise<WalletCreationResult> {
    // Generate a deterministic salt from email + phone for counterfactual address
    const salt = this.generateSalt(email, phone);

    // Compute the counterfactual wallet address (address before deployment)
    const walletAddress = await this.computeCounterfactualAddress(salt);

    // Build the UserOperation for wallet deployment via bundler
    const userOp = await this.buildDeploymentUserOp(salt, walletAddress);

    // Submit UserOperation to bundler for on-chain execution
    const txHash = await this.submitUserOperation(userOp);

    return {
      walletAddress,
      deploymentTxHash: txHash,
    };
  }

  /**
   * Generates a deterministic salt from driver credentials.
   * This ensures the same email+phone always produces the same wallet address.
   */
  private generateSalt(email: string, phone: string): string {
    const normalized = `${email.toLowerCase().trim()}:${phone.replace(/\s/g, '')}`;
    return ethers.keccak256(ethers.toUtf8Bytes(normalized));
  }

  /**
   * Computes the counterfactual address for a wallet before deployment.
   * Uses CREATE2 to deterministically derive the address from the factory + salt.
   */
  private async computeCounterfactualAddress(salt: string): Promise<string> {
    if (!this.accountFactoryAddress) {
      // Development fallback: generate a deterministic address from salt
      return ethers.getAddress(
        '0x' + ethers.keccak256(ethers.toUtf8Bytes(`wallet:${salt}`)).slice(26)
      );
    }

    // Call the factory's getAddress(owner, salt) to get counterfactual address
    const factoryInterface = new ethers.Interface([
      'function getAddress(address owner, uint256 salt) view returns (address)',
    ]);

    const callData = factoryInterface.encodeFunctionData('getAddress', [
      this.backendSigner.address,
      salt,
    ]);

    const result = await this.provider.call({
      to: this.accountFactoryAddress,
      data: callData,
    });

    return ethers.AbiCoder.defaultAbiCoder().decode(['address'], result)[0];
  }

  /**
   * Builds a UserOperation for deploying the wallet via the bundler.
   * The paymaster sponsors gas so the driver pays nothing.
   */
  private async buildDeploymentUserOp(
    salt: string,
    walletAddress: string
  ): Promise<UserOperation> {
    // Encode the factory's createAccount call as initCode
    const factoryInterface = new ethers.Interface([
      'function createAccount(address owner, uint256 salt) returns (address)',
    ]);

    const initCallData = factoryInterface.encodeFunctionData('createAccount', [
      this.backendSigner.address,
      salt,
    ]);

    const initCode = this.accountFactoryAddress
      ? ethers.concat([this.accountFactoryAddress, initCallData])
      : '0x';

    // Get paymaster data to sponsor gas
    const paymasterAndData = await this.getPaymasterData(walletAddress);

    // Get current gas prices from the network
    const feeData = await this.provider.getFeeData();

    const userOp: UserOperation = {
      sender: walletAddress,
      nonce: '0x0',
      initCode: initCode,
      callData: '0x',
      callGasLimit: ethers.toBeHex(200000),
      verificationGasLimit: ethers.toBeHex(500000),
      preVerificationGas: ethers.toBeHex(50000),
      maxFeePerGas: ethers.toBeHex(feeData.maxFeePerGas || 1000000000n),
      maxPriorityFeePerGas: ethers.toBeHex(feeData.maxPriorityFeePerGas || 1000000000n),
      paymasterAndData,
      signature: '0x',
    };

    // Sign the UserOperation
    userOp.signature = await this.signUserOperation(userOp);

    return userOp;
  }

  /**
   * Gets paymaster sponsorship data for a UserOperation.
   * The paymaster covers all gas fees for driver transactions.
   */
  private async getPaymasterData(sender: string): Promise<string> {
    if (!this.paymasterUrl) {
      // Development fallback: return empty paymaster data
      return '0x';
    }

    try {
      const response = await fetch(this.paymasterUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'pm_sponsorUserOperation',
          params: [{ sender }, this.entryPointAddress],
        }),
      });

      const result = await response.json();
      return result.result?.paymasterAndData || '0x';
    } catch {
      // If paymaster is unavailable, proceed without sponsorship in dev
      return '0x';
    }
  }

  /**
   * Signs a UserOperation with the backend signer key.
   */
  private async signUserOperation(userOp: UserOperation): Promise<string> {
    const userOpHash = this.getUserOpHash(userOp);
    return this.backendSigner.signMessage(ethers.getBytes(userOpHash));
  }

  /**
   * Computes the hash of a UserOperation for signing.
   */
  private getUserOpHash(userOp: UserOperation): string {
    const packed = ethers.AbiCoder.defaultAbiCoder().encode(
      ['address', 'uint256', 'bytes32', 'bytes32', 'uint256', 'uint256', 'uint256', 'uint256', 'uint256', 'bytes32'],
      [
        userOp.sender,
        userOp.nonce,
        ethers.keccak256(userOp.initCode),
        ethers.keccak256(userOp.callData),
        userOp.callGasLimit,
        userOp.verificationGasLimit,
        userOp.preVerificationGas,
        userOp.maxFeePerGas,
        userOp.maxPriorityFeePerGas,
        ethers.keccak256(userOp.paymasterAndData),
      ]
    );

    return ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ['bytes32', 'address', 'uint256'],
        [ethers.keccak256(packed), this.entryPointAddress, 8453] // 8453 = Base mainnet chainId
      )
    );
  }

  /**
   * Submits a UserOperation to the ERC-4337 bundler for on-chain execution.
   */
  private async submitUserOperation(userOp: UserOperation): Promise<string> {
    if (!this.bundlerUrl) {
      // Development fallback: return a mock transaction hash
      return ethers.keccak256(ethers.toUtf8Bytes(`deploy:${userOp.sender}:${Date.now()}`));
    }

    const response = await fetch(this.bundlerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_sendUserOperation',
        params: [userOp, this.entryPointAddress],
      }),
    });

    const result = await response.json();

    if (result.error) {
      throw new Error(`Bundler error: ${result.error.message || JSON.stringify(result.error)}`);
    }

    // The bundler returns a userOpHash; we wait for the transaction to be mined
    const userOpHash = result.result;
    const txHash = await this.waitForUserOpReceipt(userOpHash);

    return txHash;
  }

  /**
   * Waits for a UserOperation to be included in a block.
   * Times out after 30 seconds per requirement.
   */
  private async waitForUserOpReceipt(userOpHash: string): Promise<string> {
    const timeout = 30000; // 30 seconds max
    const pollInterval = 2000; // Poll every 2 seconds
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      try {
        const response = await fetch(this.bundlerUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'eth_getUserOperationReceipt',
            params: [userOpHash],
          }),
        });

        const result = await response.json();

        if (result.result?.receipt?.transactionHash) {
          return result.result.receipt.transactionHash;
        }
      } catch {
        // Continue polling
      }

      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }

    // If we timeout, return the userOpHash as reference
    return userOpHash;
  }

  /**
   * Sponsors a transaction for a driver via the paymaster.
   * Used for all driver transactions (trip submissions, staking, claiming).
   */
  async sponsorTransaction(
    walletAddress: string,
    callData: string,
    target: string
  ): Promise<string> {
    const nonce = await this.getWalletNonce(walletAddress);

    // Encode the execute call on the smart wallet
    const executeInterface = new ethers.Interface([
      'function execute(address dest, uint256 value, bytes calldata func)',
    ]);

    const executeCallData = executeInterface.encodeFunctionData('execute', [
      target,
      0,
      callData,
    ]);

    const feeData = await this.provider.getFeeData();
    const paymasterAndData = await this.getPaymasterData(walletAddress);

    const userOp: UserOperation = {
      sender: walletAddress,
      nonce: ethers.toBeHex(nonce),
      initCode: '0x',
      callData: executeCallData,
      callGasLimit: ethers.toBeHex(200000),
      verificationGasLimit: ethers.toBeHex(200000),
      preVerificationGas: ethers.toBeHex(50000),
      maxFeePerGas: ethers.toBeHex(feeData.maxFeePerGas || 1000000000n),
      maxPriorityFeePerGas: ethers.toBeHex(feeData.maxPriorityFeePerGas || 1000000000n),
      paymasterAndData,
      signature: '0x',
    };

    userOp.signature = await this.signUserOperation(userOp);

    return this.submitUserOperation(userOp);
  }

  /**
   * Gets the current nonce for a smart wallet.
   */
  private async getWalletNonce(walletAddress: string): Promise<bigint> {
    if (!this.entryPointAddress) {
      return 0n;
    }

    const entryPointInterface = new ethers.Interface([
      'function getNonce(address sender, uint192 key) view returns (uint256)',
    ]);

    const callData = entryPointInterface.encodeFunctionData('getNonce', [
      walletAddress,
      0,
    ]);

    try {
      const result = await this.provider.call({
        to: this.entryPointAddress,
        data: callData,
      });

      return ethers.AbiCoder.defaultAbiCoder().decode(['uint256'], result)[0];
    } catch {
      return 0n;
    }
  }
}
