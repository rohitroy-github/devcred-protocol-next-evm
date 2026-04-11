# Backend Hardhat Setup

This repository is a personal backend starter for Solidity + Hardhat projects.
It is meant to help quickly boot a local blockchain backend, compile contracts, run tests, and deploy contracts during development.

## What This Repo Is For

- Booting a local Hardhat blockchain backend
- Deploying Solidity contracts locally (and optionally to Sepolia)
- Running contract tests
- Reusing a clean starter for future Solidity projects

## Tech Stack

- Node.js
- Hardhat (latest 2.x line)
- Ethers (via Hardhat toolbox)
- Mocha/Chai test tooling
- Optional gas reporting

## Dependency Versions

Current development dependency versions from package.json:

- @nomicfoundation/hardhat-toolbox: ^6.1.2
- hardhat: ^2.28.6
- hardhat-gas-reporter: ^2.3.0
- dotenv: ^17.4.1

## Prerequisites

- Node.js 18+ recommended
- npm

## One-Time Setup

1. Open terminal in project root.
2. Install dependencies.

For full end-to-end setup (clone, install, compile, test, localhost deploy, optional Sepolia), see [LocalSetupGuide.md](LocalSetupGuide.md).

```powershell
npm install
```

## Local Backend Quick Start

Run these in separate terminals from the project root.

1. Start local blockchain node:

```powershell
npx hardhat node
```

2. Deploy contract to localhost:

```powershell
npx hardhat run scripts/deploy.js --network localhost
```

You can also use npm script:

```powershell
npm run deploy:localhost
```

## Available npm Scripts

- npm run compile: runs `hardhat compile`
- npm test: runs `hardhat test`
- npm run node: runs `hardhat node`
- npm run clean: runs `hardhat clean`
- npm run deploy: runs `hardhat run scripts/deploy.js`
- npm run deploy:localhost: runs `hardhat run scripts/deploy.js --network localhost`

## Project Structure

```text
contracts/
	Starter.sol
scripts/
	deploy.js
test/
	Starter.js
hardhat.config.js
```

## Current Contract in Starter

The Starter contract includes:

- count state variable
- owner-based access control for increment and reset
- CountIncremented event
- increment(amount), getCount(), and reset()

## Environment Variables

Optional values can be set in .env for Sepolia deploys, verification, and gas reporting:

- SEPOLIA_ALCHEMY_RPC_URL
- METAMASK_PRIVATE_KEY
- ETHERSCAN_API_KEY
- COINMARKETCAP_API_KEY
- REPORT_GAS_USAGE=true (optional)

## Notes

- This repo is intentionally minimal and backend-focused.
- Clone/copy this starter when beginning a new Solidity Hardhat backend project.
