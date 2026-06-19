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

## Contracts (Deployed on Base Sepolia)

| Contract | Address | Basescan |
|----------|---------|----------|
| SafetyRegistry | `0x0A1E6C8B6EcF597a12031C55a626dfBcC5877Dce` | [View](https://sepolia.basescan.org/address/0x0A1E6C8B6EcF597a12031C55a626dfBcC5877Dce) |
| ConsentManager | `0x1951eeCAf6B1410EE5ee0b336460EfFd0e3D1B65` | [View](https://sepolia.basescan.org/address/0x1951eeCAf6B1410EE5ee0b336460EfFd0e3D1B65) |
| StakingContract | `0x3756B083a037458a93f1E2F9D9B5D794d2E8DFbE` | [View](https://sepolia.basescan.org/address/0x3756B083a037458a93f1E2F9D9B5D794d2E8DFbE) |
| DVXBuyback | `0x5Fc45Dfb22497A494344F3E252212a0b0AfD7e95` | [View](https://sepolia.basescan.org/address/0x5Fc45Dfb22497A494344F3E252212a0b0AfD7e95) |
| RevenueDistributor | `0x7B09A6211504AEE2304257be350E110eCE9F8B33` | [View](https://sepolia.basescan.org/address/0x7B09A6211504AEE2304257be350E110eCE9F8B33) |
| GovernanceTimelock | `0x77b19916730D89Af0B71337E086De729AFeB47D7` | [View](https://sepolia.basescan.org/address/0x77b19916730D89Af0B71337E086De729AFeB47D7) |
| MarketplaceContract | `0x1fda60DD1A3C41224d43DEC60b3b0B5BC2351b69` | [View](https://sepolia.basescan.org/address/0x1fda60DD1A3C41224d43DEC60b3b0B5BC2351b69) |
| DVX Token (mock) | `0xC7a48ce3C0CB1AdA1E215C025853E593db34f33c` | [View](https://sepolia.basescan.org/address/0xC7a48ce3C0CB1AdA1E215C025853E593db34f33c) |

> Network: Base Sepolia (Chain ID: 84532) · All contracts immutable (no proxy/upgradeability)

## Networks

| Network | Chain ID | RPC URL |
|---------|----------|---------|
| Base Mainnet | 8453 | https://mainnet.base.org |
| Base Sepolia (Testnet) | 84532 | https://sepolia.base.org |

## License

MIT
