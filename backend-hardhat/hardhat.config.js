// Load environment variables from .env file into process.env
// This keeps sensitive data like API keys and private keys out of source control
require("dotenv").config();

// Hardhat toolbox bundles essential plugins:
// - @nomicfoundation/hardhat-ethers: Ethers.js integration for contract interaction
// - @nomicfoundation/hardhat-verify: Contract verification on Etherscan
// - hardhat-waffle: Testing framework (Chai assertions)
require("@nomicfoundation/hardhat-toolbox");

// Gas reporter plugin tracks gas usage during test execution
// Helps identify optimization opportunities and estimate deployment costs
require("hardhat-gas-reporter");

// Optional plugin for Solidity coverage reports.
// Enable only when needed because it slows test execution significantly.
// Uncomment to measure code coverage for your test suite:
// require("solidity-coverage");

// ============================================================================
// ENVIRONMENT VARIABLES
// ============================================================================
// These are loaded from .env file. Keep secrets out of source control.
// See .env.example for required variables and setup instructions.

// Sepolia testnet RPC endpoint (via Alchemy)
// Required for deploying and testing on Sepolia
const SEPOLIA_ALCHEMY_RPC_URL = process.env.SEPOLIA_ALCHEMY_RPC_URL;

// Private key for contract deployment account
// WARNING: Never commit real private keys. Use environment variables only.
const METAMASK_PRIVATE_KEY = process.env.METAMASK_PRIVATE_KEY;

// Etherscan API key for contract source code verification
// Allows public viewing and verification of deployed contracts
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY;

// CoinMarketCap API key for gas reporter fiat conversion
// Converts gas costs (ETH) to fiat currency (INR by default)
const COINMARKETCAP_API_KEY = process.env.COINMARKETCAP_API_KEY;

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  // ============================================================================
  // SOLIDITY COMPILER CONFIGURATION
  // ============================================================================
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: {
        // Enable optimizer to reduce gas costs of deployed bytecode
        // Trade-off: optimizer increases compilation time
        enabled: true,
        // runs: Estimated number of times each opcode will be called
        // Higher runs (1000): Optimize for runtime gas (frequently called functions)
        // Lower runs (200): Optimize for deployment size and cost
        // 1000 is a good balance for most production contracts
        runs: 1000,
      },
    },
  },

  // ============================================================================
  // NETWORKS
  // ============================================================================
  // Default network for tasks like `npx hardhat test` with no --network flag
  defaultNetwork: "hardhat",

  networks: {
    // Built-in ephemeral blockchain for local testing
    // State resets for each run, keeping tests deterministic and isolated
    hardhat: {
      // Allow contracts larger than 24 KB for testing purposes
      // Production networks enforce the 24 KB limit; use this for development only
      allowUnlimitedContractSize: true,
    },

    // Ethereum Sepolia testnet
    // Use for staging deployments before mainnet
    // Faucets: https://sepoliafaucet.com (via Alchemy or others)
    sepolia: {
      // RPC endpoint - required to connect to Sepolia
      url: SEPOLIA_ALCHEMY_RPC_URL || "",
      // Account(s) for signing transactions; array of private keys
      // Empty array if METAMASK_PRIVATE_KEY is not set (read-only mode)
      accounts: METAMASK_PRIVATE_KEY ? [METAMASK_PRIVATE_KEY] : [],
      // Sepolia chain ID (for EIP-155 replay protection)
      chainId: 11155111,
    },

    // Local Hardhat node (persistent process)
    // Start with: npx hardhat node
    // Useful for manual testing with frontend/wallet integration
    // Persists state across transactions (unlike default hardhat network)
    localhost: {
      // RPC endpoint for local node
      url: "http://127.0.0.1:8545/",
      // Hardhat node chain ID (for testing full node behavior)
      chainId: 31337,
      // Gas limit per transaction (standard is 21,000 for ETH transfer)
      gas: 2100000,
      // Gas price in wei (1 Gwei = 1e9 wei)
      gasPrice: 8000000000,
    },
  },

  // ============================================================================
  // ETHERSCAN INTEGRATION
  // ============================================================================
  // Used by hardhat-verify task to provide contract source on block explorers
  // Example: npx hardhat verify --network sepolia <CONTRACT_ADDRESS> "constructor args"
  etherscan: {
    apiKey: ETHERSCAN_API_KEY,
  },

  // ============================================================================
  // GAS REPORTER CONFIGURATION
  // ============================================================================
  // Tracks and reports gas usage after running tests
  // Helps identify expensive operations and optimization opportunities
  gasReporter: {
    // Enable/disable via REPORT_GAS_USAGE=true in .env
    // Default: disabled (false) to keep test output clean
    enabled: process.env.REPORT_GAS_USAGE === "true",
    // Output format: noColors=true for CI logs, false for terminal colors
    noColors: true,
    // Currency for fiat conversion (requires COINMARKETCAP_API_KEY)
    currency: "INR",
    // Block reward token (ETH for networks, check docs for L2s)
    token: "ETH",
    // Uncomment to save report to file instead of printing to stdout:
    // outputFile: "gas-report.txt",
    // CoinMarketCap API key for live ETH-to-INR conversion
    // Without this key, conversion may be unavailable
    coinmarketcap: COINMARKETCAP_API_KEY,
  },

  // ============================================================================
  // MOCHA TEST RUNNER CONFIGURATION
  // ============================================================================
  // Mocha is the test framework used by Hardhat
  mocha: {
    // Timeout in milliseconds for each test
    // Default is 2000ms; increased here for slow RPC calls and integration tests
    // Useful for Sepolia testnet where blocks take ~12 seconds
    timeout: 60000,
  },
};
