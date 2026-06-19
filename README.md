# DrivX Protocol

Decentralized driver-owned protocol that transforms safe driving behavior into a verifiable, portable asset with real economic value. Built on Base (Ethereum L2).

**Website:** https://jpdeveloper89-cmd.github.io/drivx/  
**Web App:** https://jpdeveloper89-cmd.github.io/drivx/app/

## Monorepo Structure

```
drivx-protocol/
├── packages/
│   ├── contracts/    # Solidity smart contracts (Hardhat + Foundry)
│   ├── backend/     # Node.js + Express API services
│   ├── mobile/      # React Native + Expo mobile app
│   └── web/         # Next.js web platform
├── website/         # Landing page (GitHub Pages)
├── docs/            # Technical specifications
└── Logo/            # Brand assets
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Smart Contracts | Solidity 0.8.24, Hardhat, OpenZeppelin |
| Backend | Node.js, Express, PostgreSQL, Redis |
| Mobile | React Native, Expo |
| Web | Next.js 14, Tailwind CSS |
| Blockchain | Base (Ethereum L2) |

## Getting Started

### Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0

### Installation

```bash
npm install
```

### Backend Tests (175 passing)

```bash
cd backend
npm test
```

### Smart Contract Tests (38 passing)

```bash
cd packages/contracts
npx hardhat test
```

### Web Platform (Dev Server)

```bash
cd packages/web
npm install
npm run dev
```

## Contracts

| Contract | Description |
|----------|-------------|
| SafetyRegistry | On-chain driving identity + Safety Score |
| ConsentManager | Bitmask consent grants with 12-month cap |
| StakingContract | DVX staking with 7-day cooldown |
| RevenueDistributor | Immutable 70/20/10 revenue split |
| DVXBuyback | Weekly buyback with TWAP pricing |
| GovernanceTimelock | 48-hour delay for parameter changes |
| MarketplaceContract | Delivery escrow + protocol fees |

## Networks

| Network | Chain ID | RPC URL |
|---------|----------|---------|
| Base Mainnet | 8453 | https://mainnet.base.org |
| Base Sepolia (Testnet) | 84532 | https://sepolia.base.org |

## License

MIT
