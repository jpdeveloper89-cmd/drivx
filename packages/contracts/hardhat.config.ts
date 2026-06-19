import { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';
// Note: hardhat-foundry disabled — requires Foundry CLI (forge) to be installed
// import '@nomicfoundation/hardhat-foundry';
import 'dotenv/config';

const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY || '0x' + '0'.repeat(64);
const BASE_MAINNET_RPC_URL = process.env.BASE_MAINNET_RPC_URL || 'https://mainnet.base.org';
const BASE_TESTNET_RPC_URL =
  process.env.BASE_TESTNET_RPC_URL || 'https://sepolia.base.org';
const BASESCAN_API_KEY = process.env.BASESCAN_API_KEY || '';

const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.24',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true,
    },
  },
  networks: {
    hardhat: {
      chainId: 31337,
    },
    baseTestnet: {
      url: BASE_TESTNET_RPC_URL,
      chainId: 84532, // Base Sepolia
      accounts: [DEPLOYER_PRIVATE_KEY],
      gasPrice: 'auto',
    },
    baseMainnet: {
      url: BASE_MAINNET_RPC_URL,
      chainId: 8453, // Base Mainnet
      accounts: [DEPLOYER_PRIVATE_KEY],
      gasPrice: 'auto',
    },
  },
  etherscan: {
    apiKey: {
      baseTestnet: BASESCAN_API_KEY,
      baseMainnet: BASESCAN_API_KEY,
    },
    customChains: [
      {
        network: 'baseTestnet',
        chainId: 84532,
        urls: {
          apiURL: 'https://api-sepolia.basescan.org/api',
          browserURL: 'https://sepolia.basescan.org',
        },
      },
      {
        network: 'baseMainnet',
        chainId: 8453,
        urls: {
          apiURL: 'https://api.basescan.org/api',
          browserURL: 'https://basescan.org',
        },
      },
    ],
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS === 'true',
    currency: 'USD',
  },
  paths: {
    sources: './contracts',
    tests: './test',
    cache: './cache',
    artifacts: './artifacts',
  },
  typechain: {
    outDir: 'typechain-types',
    target: 'ethers-v6',
  },
};

export default config;
