# DrivX Protocol

> Driver-owned protocol. Fixed supply. Real revenue to stakers. No emissions, no inflation. 70% of all fees go to safe drivers.

## What is DrivX?

DrivX turns safe driving into a verifiable on-chain identity. Drivers build a Safety Score (0–1000) from verified trip data, own their Driving Identity on Base (Ethereum L2), and earn real revenue — in WETH and USDC — from insurers, businesses, and platforms that pay to access verified driver data.

## Key Properties

- **Fixed supply:** 100B DVX, no mint function, deflationary (burn only)
- **Real yield:** Revenue from trading fees (57% of 1.2% swap fee), insurance verification, marketplace fees
- **Immutable split:** 70% to drivers, 20% to protocol dev, 10% to incentive pool — hardcoded, no admin override
- **No team tokens:** 0% pre-allocation. Team funded from treasury. All wallets public.
- **Crypto-invisible UX:** Email signup, no seed phrases, gas sponsored

## Repository Structure

```
docs/
├── README.md                      ← You are here
├── phase-1-technical-spec.md      ← Phase 1: Scoring & data collection spec
├── DrivX_Whitepaper.html          ← Full whitepaper (open in browser)
└── CONTRIBUTING.md                ← How to contribute

website/
├── index.html                     ← Landing page
└── DrivX_Whitepaper.html          ← Whitepaper (deployed)
```

## Roadmap

| Phase | Timeline | Focus |
|-------|----------|-------|
| Phase 1 | Q3 2026 | Mobile app, scoring, trip verification |
| Phase 2 | Q4 2026 | DVX token launch via Bankr Bot on Base |
| Phase 3 | Q1 2027 | Insurance verification API, partnerships |
| Phase 4 | Q2 2027 | Delivery marketplace, accountability engine |
| Phase 5 | Q3 2027+ | ZK proofs, verifiable computation, trustless scoring |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Blockchain | Base (Ethereum L2) |
| Smart Contracts | Solidity, Foundry, Hardhat |
| Mobile | React Native + Expo |
| Backend | Node.js, Express, PostgreSQL, Redis |
| Web | Next.js, React, Tailwind CSS |
| Account Abstraction | ERC-4337 |

## Links

- [Whitepaper](docs/DrivX_Whitepaper.html)
- [Phase 1 Technical Spec](docs/phase-1-technical-spec.md)
- [Twitter](https://twitter.com/drivxprotocol)
- [Website](https://drivxprotocol.xyz) *(coming soon)*

## License

MIT — see [LICENSE](LICENSE) for details.
