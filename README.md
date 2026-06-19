# SafeDrive Protocol

Decentralized driver-owned protocol that transforms safe driving behavior into a verifiable, portable asset with real economic value. Built on Base (Ethereum L2).

## Monorepo Structure

```
safedrive-protocol/
├── packages/
│   ├── contracts/    # Solidity smart contracts (Hardhat + Foundry)
│   ├── backend/     # Node.js + Express API services
│   ├── mobile/      # React Native + Expo mobile app
│   └── web/         # Next.js web platform
├── tsconfig.base.json   # Shared TypeScript configuration
├── .eslintrc.json       # Shared ESLint configuration
├── .prettierrc          # Shared Prettier configuration
└── package.json         # Root workspace configuration
```

## Getting Started

### Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0
- Foundry (for fuzz testing): https://book.getfoundry.sh/getting-started/installation

### Installation

```bash
npm install
```

### Smart Contracts

```bash
cd packages/contracts

# Compile with Hardhat
npx hardhat compile

# Run Hardhat tests
npx hardhat test

# Run Foundry fuzz tests
forge test --fuzz-runs 1000

# Deploy to Base Sepolia testnet
npx hardhat run scripts/deploy.ts --network baseTestnet
```

### Foundry Setup

After `npm install`, install Foundry's forge-std:

```bash
cd packages/contracts
forge install foundry-rs/forge-std --no-commit
```

## Networks

| Network | Chain ID | RPC URL |
|---------|----------|---------|
| Base Mainnet | 8453 | https://mainnet.base.org |
| Base Sepolia (Testnet) | 84532 | https://sepolia.base.org |

## License

MIT
