# Local Setup Guide (Hardhat Backend)

This is a complete runbook to set up, test, and run this backend on a local machine.
Follow this file top-to-bottom and you can boot the project any time.

## 1) Prerequisites

Install the following:

- Node.js 18+ (LTS recommended)
- npm (comes with Node.js)
- Git (optional, if cloning the repo)

Check versions:

```powershell
node -v
npm -v
```

## 2) Clone the GitHub Repository

Clone the repo to your local machine:

```powershell
git clone <YOUR_GITHUB_REPO_URL>
```

Example:

```powershell
git clone https://github.com/rohitroy-github/backend-hardhat-setup.git
```

Move into the project folder:

```powershell
cd .\backend-hardhat-setup
```

## 3) Install Dependencies

```powershell
npm install
```

Current dev dependency versions in this repo:

- `@nomicfoundation/hardhat-toolbox` = `^6.1.2`
- `hardhat` = `^2.28.6`
- `hardhat-gas-reporter` = `^2.3.0`
- `dotenv` = `^17.4.1`

## 4) Compile Contracts

```powershell
npm run compile
```

This compiles Solidity contracts from `contracts/` and updates artifacts.

## 5) Run Tests

```powershell
npm test
```

This runs tests from `test/` on Hardhat's in-memory network.

## 6) Run Localhost Blockchain and Deploy

Use two terminals.

### Terminal 1: Start Hardhat Node

```powershell
cd .\backend-hardhat-setup
npm run node
```

Keep this terminal running.

### Terminal 2: Deploy to Localhost

```powershell
cd .\backend-hardhat-setup
npm run deploy:localhost
```

Equivalent command:

```powershell
npx hardhat run scripts/deploy.js --network localhost
```

Expected output includes:

- Contract deployed address
- Network and chain id
- Deployment transaction hash
- Gas/cost summary
- `Initial count: 0`

## 7) Optional: Deploy Without Localhost Node

This runs against Hardhat's default network (ephemeral process for that command):

```powershell
npm run deploy
```

## 8) Optional: Hard Reset Build Outputs

```powershell
npm run clean
npm run compile
```

## 9) Environment Variables (Optional for Sepolia / Reporting)

Create a `.env` in project root only when needed.

Example:

```env
SEPOLIA_ALCHEMY_RPC_URL=
METAMASK_PRIVATE_KEY=
ETHERSCAN_API_KEY=
COINMARKETCAP_API_KEY=
REPORT_GAS_USAGE=false
```

Notes:

- Do not commit real private keys.
- Localhost setup works even without these values.

## 10) Sepolia Deployment (Optional)

After filling `.env` values:

```powershell
npx hardhat run scripts/deploy.js --network sepolia
```

