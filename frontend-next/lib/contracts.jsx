export const CONTRACTS = {
  devCredProfile: {
    address: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
    functions: ["mintProfile", "getProfile", "addressToProfile"],
  },
  devCredEscrow: {
    address: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
    functions: [
      // Single-payment jobs
      "createJob", "assignDeveloper", "submitWork", "approveWork", "cancelJob", "autoReleaseFunds",
      // Milestone-based jobs
      "createJobWithMilestones", "submitMilestone", "approveMilestone", "rejectMilestone", "autoReleaseMilestone"
    ],
  },
};

// Match contract constant: 3 minutes (180 seconds)
export const AUTO_RELEASE_TIMEOUT_SECONDS = 3 * 60;

export const DEV_CRED_PROFILE_ABI = [
  "event ProfileMinted(address indexed user, uint256 indexed tokenId)",
  "function mintProfile() external",
  "function getProfile(address user) external view returns (tuple(uint256 reputation, uint256 completedJobs))",
  "function addressToProfile(address user) external view returns (uint256)",
];

export const DEV_CRED_ESCROW_ABI = [
  // Single-payment job events
  "event JobCreated(uint256 jobId, address client, uint256 amount, bool isMilestoneJob)",
  "event JobAssigned(uint256 indexed jobId, address indexed developer)",
  "event JobSubmitted(uint256 jobId, uint256 deadline)",
  "event JobCompleted(uint256 indexed jobId)",
  "event AutoReleased(uint256 indexed jobId, uint256 amountReleased)",
  
  // Milestone events
  "event MilestoneSubmitted(uint256 jobId, uint256 milestoneIndex, uint256 deadline)",
  "event MilestoneApproved(uint256 jobId, uint256 milestoneIndex, uint256 amountReleased)",
  "event MilestoneRejected(uint256 jobId, uint256 milestoneIndex)",
  "event AllMilestonesCompleted(uint256 indexed jobId)",
  "event MilestoneAutoReleased(uint256 jobId, uint256 milestoneIndex, uint256 amountReleased)",
  
  // Single-payment functions
  "function createJob() external payable returns (uint256)",
  "function createJobWithMilestones(uint256[] calldata milestoneAmounts) external payable returns (uint256)",
  "function nextJobId() external view returns (uint256)",
  "function AUTO_RELEASE_TIMEOUT() external view returns (uint256)",
  "function assignDeveloper(uint256 jobId, address developer) external",
  "function submitWork(uint256 jobId) external",
  "function approveWork(uint256 jobId) external",
  "function cancelJob(uint256 jobId) external",
  "function autoReleaseFunds(uint256 jobId) external",
  
  // Milestone functions
  "function submitMilestone(uint256 jobId) external",
  "function approveMilestone(uint256 jobId) external",
  "function rejectMilestone(uint256 jobId) external",
  "function autoReleaseMilestone(uint256 jobId) external",
  "function getMilestone(uint256 jobId, uint256 milestoneIndex) external view returns (uint256 amount, uint8 status, uint256 submittedAt)",
  "function getJobMilestones(uint256 jobId) external view returns (tuple(uint256 amount, uint8 status, uint256 submittedAt)[])",
  "function getMilestoneCount(uint256 jobId) external view returns (uint256)",
  
  // Job query - updated to include isMilestoneJob
  "function jobs(uint256 jobId) external view returns (address client, address developer, uint256 amount, uint8 status, uint256 submittedAt, bool isMilestoneJob, uint256 currentMilestoneIndex)",
];

export const JOB_STATUS = ["Open", "InProgress", "Submitted", "Completed", "Cancelled", "AutoReleased"];

export const MILESTONE_STATUS = ["Pending", "Submitted", "Approved", "Rejected"];
