// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./DevCredProfile.sol";

/**
 * @title DevCredEscrow
 * @dev Escrow contract that manages the job lifecycle and fund distribution
 * Implements a 4-step workflow: Create → Assign → Submit → Approve
 * Uses escrow to secure funds during job execution and releases payment upon completion
 */
contract DevCredEscrow {
    // Reference to the DevCredProfile contract for updating developer reputation
    DevCredProfile public profileContract;
    
    // Auto-release timeout: if client doesn't approve within this period after submission, dev can auto-release
    // Set to 3 minutes for testing; use 30 days for production
    uint256 public constant AUTO_RELEASE_TIMEOUT = 3 minutes;

    /**
     * @dev Initializes the escrow contract and links it to the profile contract
     * @param _profileContract Address of the deployed DevCredProfile contract
     */
    constructor(address _profileContract) {
        profileContract = DevCredProfile(_profileContract);
    }

    /**
     * @dev Represents the different states a job can be in throughout its lifecycle
     * Open -> InProgress -> Submitted -> Completed (or Cancelled or AutoReleased)
     */
    enum JobStatus {
        Open,        // Job created, waiting for developer assignment
        InProgress,  // Developer assigned, work in progress
        Submitted,   // Developer submitted work for review
        Completed,   // Client approved work, payment released
        Cancelled,   // Job cancelled before assignment (refund issued)
        AutoReleased // Auto-released due to timeout (dev auto-approved after 3 minutes)
    }

    /**
     * @dev Represents a job posting with parties involved and escrow details
     * @param client Address of the client who created and funds the job
     * @param developer Address of the developer assigned to the job
     * @param amount ETH amount held in escrow for this job
     * @param status Current lifecycle state of the job
     * @param submittedAt Timestamp when work was submitted (used for auto-release timeout)
     */
    struct Job {
        address client;
        address developer;
        uint256 amount;
        JobStatus status;
        uint256 submittedAt;
    }

    // Counter for generating unique job IDs
    uint256 public nextJobId;
    
    // Maps job ID to its Job data (holds all job information)
    mapping(uint256 => Job) public jobs;

    // Emitted when a client creates a new job and deposits funds
    event JobCreated(uint256 jobId, address client, uint256 amount);
    
    // Emitted when a developer is assigned to a job
    event JobAssigned(uint256 jobId, address developer);
    
    // Emitted when a developer submits their work for client review
    event JobSubmitted(uint256 jobId, uint256 deadline);
    
    // Emitted when a client approves the work and payment is released
    event JobCompleted(uint256 jobId);
    
    // Emitted when funds are auto-released due to timeout
    event AutoReleased(uint256 jobId, uint256 amountReleased);

    /**
     * @dev Step 1️⃣ of job workflow: Client creates a job and deposits ETH as escrow
     * Job starts in Open state waiting for developer assignment
     * @return jobId The unique identifier for the created job
     */
    function createJob() external payable returns (uint256) {
        require(msg.value > 0, "No funds");

        // Increment counter and create new job entry
        nextJobId++;
        jobs[nextJobId] = Job({
            client: msg.sender,
            developer: address(0),  // No developer assigned yet
            amount: msg.value,      // ETH locked in escrow
            status: JobStatus.Open,
            submittedAt: 0          // No submission yet
        });

        emit JobCreated(nextJobId, msg.sender, msg.value);
        return nextJobId;
    }

    /**
     * @dev Step 2️⃣ of job workflow: Client assigns a developer to the job
     * Only the job creator (client) can assign developers
     * Transitions job from Open to InProgress state
     * @param jobId The ID of the job to assign a developer to
     * @param developer The wallet address of the developer being assigned
     */
    function assignDeveloper(uint256 jobId, address developer) external {
        Job storage job = jobs[jobId];

        require(msg.sender == job.client, "Not client");
        require(job.status == JobStatus.Open, "Not open");

        // Assign developer and transition to active work state
        job.developer = developer;
        job.status = JobStatus.InProgress;

        emit JobAssigned(jobId, developer);
    }

    /**
     * @dev Step 3️⃣ of job workflow: Developer submits completed work
     * Only the assigned developer can submit work
     * Transitions job from InProgress to Submitted state, awaiting client approval
     * Sets a 30-day deadline for client approval, after which auto-release is possible
     * @param jobId The ID of the job the developer is submitting work for
     */
    function submitWork(uint256 jobId) external {
        Job storage job = jobs[jobId];

        require(msg.sender == job.developer, "Not developer");
        require(job.status == JobStatus.InProgress, "Invalid state");

        // Mark work as submitted, waiting for client review and approval
        job.status = JobStatus.Submitted;
        
        // Record submission time for auto-release deadline (30 days from now)
        job.submittedAt = block.timestamp;
        uint256 deadline = block.timestamp + AUTO_RELEASE_TIMEOUT;

        emit JobSubmitted(jobId, deadline);
    }

    /**
     * @dev Step 4️⃣ of job workflow: Client approves work and releases payment
     * Only the job creator (client) can approve their work
     * Releases escrowed funds to developer and updates their profile reputation
     * @param jobId The ID of the job to approve
     */
    function approveWork(uint256 jobId) external {
        Job storage job = jobs[jobId];

        require(msg.sender == job.client, "Not client");
        require(job.status == JobStatus.Submitted, "Not submitted");

        // Mark job as completed
        job.status = JobStatus.Completed;

        // Release escrowed funds to the developer
        payable(job.developer).transfer(job.amount);

        // Update developer's reputation profile with job completion and earnings
        // Uses job amount as reputation score and increments job count by 1
        profileContract.updateReputation(job.developer, job.amount, 1);

        emit JobCompleted(jobId);
    }

    /**
     * @dev Auto-release funds if client doesn't approve within 30 days of submission
     * Can be called by developer after the 30-day deadline has passed
     * Automatically approves the work and releases payment, then updates reputation
     * Prevents developers from being stuck indefinitely waiting for client approval
     * @param jobId The ID of the job to auto-release
     */
    function autoReleaseFunds(uint256 jobId) external {
        Job storage job = jobs[jobId];

        // Only developer can trigger auto-release
        require(msg.sender == job.developer, "Only developer");
        
        // Job must be in Submitted state waiting for approval
        require(job.status == JobStatus.Submitted, "Not submitted");
        
        // Must have submission timestamp recorded
        require(job.submittedAt > 0, "Not submitted");
        
        // 30 days must have passed since submission
        uint256 deadline = job.submittedAt + AUTO_RELEASE_TIMEOUT;
        require(block.timestamp > deadline, "Deadline not reached");

        // Mark job as auto-released
        job.status = JobStatus.AutoReleased;
        
        uint256 releaseAmount = job.amount;

        // Release escrowed funds to the developer
        payable(job.developer).transfer(releaseAmount);

        // Update developer's reputation as if client had approved
        profileContract.updateReputation(job.developer, releaseAmount, 1);

        emit AutoReleased(jobId, releaseAmount);
    }

    /**
     * @dev Optional: Allows client to cancel a job and reclaim escrowed funds
     * Can only cancel jobs that are still in Open state (no developer assigned yet)
     * Refunds the full amount to the client
     * @param jobId The ID of the job to cancel
     */
    function cancelJob(uint256 jobId) external {
        Job storage job = jobs[jobId];

        require(msg.sender == job.client, "Not client");
        require(job.status == JobStatus.Open, "Cannot cancel after assignment");

        // Transition to cancelled state
        job.status = JobStatus.Cancelled;

        // Refund escrowed funds to the client
        payable(job.client).transfer(job.amount);
    }
}