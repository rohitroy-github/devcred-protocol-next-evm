# DevCred Protocol

DevCred Protocol is a decentralized reputation and escrow system for developers. It combines on-chain identity, trustless payments, and verifiable work history to reduce hiring risk in Web3-native freelance workflows.

## Why DevCred

Hiring in open ecosystems has two persistent challenges:

- identity is hard to verify without centralized platforms
- payment trust usually depends on intermediaries

DevCred addresses both with smart contracts and event-driven indexing:

- identity as a profile NFT
- jobs managed through escrow-backed lifecycle states
- reputation updated from economic activity and job outcomes
- off-chain indexing for fast queries and UI responsiveness

## Core Capabilities

### Decentralized Identity

- wallet-based onboarding
- one profile NFT per developer
- extendable metadata model (username, bio, avatar, GitHub)

### Trustless Escrow Workflow

- client creates a job and funds escrow
- developer gets assigned and submits work
- client approves completion to release funds

### Reputation and Work History

- on-chain history of completed work
- reputation linked to actual job execution
- traceable events for transparency and auditability

### Hybrid Data Layer

- blockchain is the source of truth
- MongoDB stores indexed/query-friendly views
- backend listener syncs contract events into the database

## System Architecture

1. Smart contracts define identity, jobs, escrow, and state transitions.
2. Event listeners consume blockchain events and project them into MongoDB.
3. Next.js API routes expose indexed data to the frontend.
4. Frontend pages combine wallet interactions and fast off-chain reads.

## Smart Contracts

- `DevCredProfile.sol`: profile NFT and developer reputation context
- `DevCredEscrow.sol`: escrow and job lifecycle (`Create -> Assign -> Submit -> Approve`)
- `Starter.sol`: local starter/reference contract

## Repository Structure

```text
backend-hardhat/
	contracts/          # Solidity contracts
	scripts/            # Deploy, listener, and maintenance scripts
	test/               # Hardhat tests
frontend-next/
	app/                # Next.js app router pages + API routes
	db/                 # MongoDB/Mongoose connection and models
	components/         # UI components
```

## Tech Stack

- Solidity + Hardhat
- Ethers.js
- Next.js (App Router)
- MongoDB + Mongoose
- Tailwind CSS

## Quick Start

### Prerequisites

- Node.js 18+
- npm
- MongoDB instance (local or Atlas)

### 1) Install Dependencies

From the repository root:

```powershell
cd backend-hardhat
npm install

cd ..\frontend-next
npm install
```

### 2) Configure Environment Variables

Create/update environment files in each project.

Backend (`backend-hardhat/.env`):

```env
SEPOLIA_ALCHEMY_RPC_URL=
METAMASK_PRIVATE_KEY=
ETHERSCAN_API_KEY=
COINMARKETCAP_API_KEY=
REPORT_GAS_USAGE=false
```

Frontend (`frontend-next/.env.local`):

```env
MONGODB_URI=
MONGODB_DB_NAME=
```

### 3) Run Local Blockchain + Deploy Contracts

In `backend-hardhat`, use two terminals:

Terminal 1:

```powershell
npm run node
```

Terminal 2:

```powershell
npm run deploy:localhost
```

### 4) Start Event Listener (Optional but Recommended)

In `backend-hardhat`:

```powershell
npm run listener
```

### 5) Start Frontend

In `frontend-next`:

```powershell
npm run dev
```

Open `http://localhost:3000`.

## Useful Commands

In `backend-hardhat`:

- `npm run compile`
- `npm test`
- `npm run deploy`
- `npm run deploy:localhost`
- `npm run listener`
- `npm run db:clear`

In `frontend-next`:

- `npm run dev`
- `npm run build`
- `npm run start`
- `npm run lint`

## API Surface (Frontend App Router)

- `/api/health`
- `/api/users`
- `/api/profiles`
- `/api/profiles/[walletAddress]`
- `/api/jobs`
- `/api/jobs/[id]`
- `/api/jobs/[id]/actions`

## Current Status

This repository already includes:

- contracts, tests, and deployment scripts
- Next.js UI routes for jobs and profiles
- API routes backed by MongoDB models
- event-listener hooks for synchronization workflows

## Vision

DevCred is a foundation for developer-centric trust systems:

- decentralized hiring rails
- portable on-chain professional reputation
- composable credibility graphs for future DAO and protocol ecosystems

Trust should be verifiable, not assumed.
