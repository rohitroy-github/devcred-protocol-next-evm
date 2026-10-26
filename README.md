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

### Milestone-Based Payments

- clients can split one job into multiple milestones (up to 3)
- each milestone has an independent amount and review cycle
- developers can get paid incrementally as each milestone is approved
- final job completion is triggered when all milestones are approved

### Auto-Release Safety

- both single-payment and milestone flows support timeout-based auto-release
- after submission, if the client does not respond before the deadline, the developer can trigger auto-release
- this prevents funds from being stuck indefinitely in escrow
- keeps project momentum when review cycles are delayed

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
- `DevCredEscrow.sol`: escrow and job lifecycle (`Create -> Assign -> Submit -> Approve`), milestone workflow, and timeout-based auto-release
- `Starter.sol`: local starter/reference contract

## Why These Features Matter for Developers

- faster cash flow: milestone approvals unlock partial payouts instead of waiting for full-project completion
- lower payment risk: auto-release protects developers from stalled client approvals
- stronger trust signal: milestone completion and payout events are recorded for transparent work history
- better delivery rhythm: milestone checkpoints encourage structured execution and feedback
- reduced dispute friction: explicit states (Pending, Submitted, Approved, Rejected) make progress and responsibility clear

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

- Node.js 20.9+ (required by Next.js 16)
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

Development uses Webpack explicitly to avoid the Turbopack `Next.js package not found`
panic observed in this Windows/OneDrive workspace. After changing the dev command,
stop the existing frontend server with Ctrl+C and run `npm run dev` again.
The production build command is unchanged.

If startup fails with `EPERM` while removing a directory under `.next\dev`,
stop the frontend server and check the generated cache's Windows attributes.
Read-only cache directories were observed in this OneDrive workspace. From
`frontend-next`, clear only the generated cache's read-only attributes:

```powershell
$cache = Get-Item -LiteralPath .\.next -Force -ErrorAction Stop
$entries = @($cache) + @(Get-ChildItem -LiteralPath $cache.FullName -Recurse -Force -ErrorAction Stop)
foreach ($entry in $entries) {
    if (($entry.Attributes -band [System.IO.FileAttributes]::ReadOnly) -ne 0) {
        $entry.Attributes = $entry.Attributes -band (-bnot [System.IO.FileAttributes]::ReadOnly)
    }
}
npm run dev
```

This preserves source files and cache contents. If sync reapplies these attributes
or file-lock errors persist, run the project outside OneDrive rather than
repeatedly deleting its cache.

If React reports an extra `data-scribe-recorder-ready` attribute on `<html>`,
disable the Scribe recorder browser extension for localhost, or use a browser
profile with extensions disabled. This is browser-injected markup, not the
Turbopack crash; hydration warnings should not be suppressed to hide it.

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
- milestone job support across contracts, APIs, and UI timeline views
- auto-release flows for both full-job and per-milestone payouts

## Vision

DevCred is a foundation for developer-centric trust systems:

- decentralized hiring rails
- portable on-chain professional reputation
- composable credibility graphs for future DAO and protocol ecosystems

Trust should be verifiable, not assumed.
