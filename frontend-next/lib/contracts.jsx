export const CONTRACTS = {
  devCredProfile: {
    address: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
    functions: ["mintProfile", "getProfile", "addressToProfile"],
  },
  devCredEscrow: {
    address: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
    functions: ["createJob", "assignDeveloper", "submitWork", "approveWork", "cancelJob"],
  },
};

export const DEV_CRED_PROFILE_ABI = [
  "event ProfileMinted(address indexed user, uint256 indexed tokenId)",
  "function mintProfile() external",
  "function getProfile(address user) external view returns (tuple(uint256 reputation, uint256 completedJobs))",
  "function addressToProfile(address user) external view returns (uint256)",
];

export const DEV_CRED_ESCROW_ABI = [
  "event JobCreated(uint256 indexed jobId, address indexed client, uint256 amount)",
  "event JobAssigned(uint256 indexed jobId, address indexed developer)",
  "event JobSubmitted(uint256 indexed jobId)",
  "event JobCompleted(uint256 indexed jobId)",
  "function createJob() external payable returns (uint256)",
  "function assignDeveloper(uint256 jobId, address developer) external",
  "function submitWork(uint256 jobId) external",
  "function approveWork(uint256 jobId) external",
  "function cancelJob(uint256 jobId) external",
  "function jobs(uint256 jobId) external view returns (address client, address developer, uint256 amount, uint8 status)",
];

export const JOB_STATUS = ["Open", "InProgress", "Submitted", "Completed", "Cancelled"];
