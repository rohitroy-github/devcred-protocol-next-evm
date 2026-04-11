// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./DevCredProfile.sol";

contract DevCredEscrow {
    DevCredProfile public profileContract;

    constructor(address _profileContract) {
        profileContract = DevCredProfile(_profileContract);
    }

    enum JobStatus {
        Open,
        InProgress,
        Submitted,
        Completed,
        Cancelled
    }

    struct Job {
        address client;
        address developer;
        uint256 amount;
        JobStatus status;
    }

    uint256 public nextJobId;
    mapping(uint256 => Job) public jobs;

    event JobCreated(uint256 jobId, address client, uint256 amount);
    event JobAssigned(uint256 jobId, address developer);
    event JobSubmitted(uint256 jobId);
    event JobCompleted(uint256 jobId);

    // 1️⃣ Client creates job + deposits ETH
    function createJob() external payable returns (uint256) {
        require(msg.value > 0, "No funds");

        nextJobId++;
        jobs[nextJobId] = Job({
            client: msg.sender,
            developer: address(0),
            amount: msg.value,
            status: JobStatus.Open
        });

        emit JobCreated(nextJobId, msg.sender, msg.value);
        return nextJobId;
    }

    // 2️⃣ Assign developer
    function assignDeveloper(uint256 jobId, address developer) external {
        Job storage job = jobs[jobId];

        require(msg.sender == job.client, "Not client");
        require(job.status == JobStatus.Open, "Not open");

        job.developer = developer;
        job.status = JobStatus.InProgress;

        emit JobAssigned(jobId, developer);
    }

    // 3️⃣ Developer submits work
    function submitWork(uint256 jobId) external {
        Job storage job = jobs[jobId];

        require(msg.sender == job.developer, "Not developer");
        require(job.status == JobStatus.InProgress, "Invalid state");

        job.status = JobStatus.Submitted;

        emit JobSubmitted(jobId);
    }

    // 4️⃣ Client approves → funds released
    function approveWork(uint256 jobId) external {
        Job storage job = jobs[jobId];

        require(msg.sender == job.client, "Not client");
        require(job.status == JobStatus.Submitted, "Not submitted");

        job.status = JobStatus.Completed;

        // Transfer funds
        payable(job.developer).transfer(job.amount);

        // Update reputation
        profileContract.updateReputation(job.developer, job.amount);

        emit JobCompleted(jobId);
    }

    // Optional: cancel if no dev assigned
    function cancelJob(uint256 jobId) external {
        Job storage job = jobs[jobId];

        require(msg.sender == job.client, "Not client");
        require(job.status == JobStatus.Open, "Cannot cancel");

        job.status = JobStatus.Cancelled;

        payable(job.client).transfer(job.amount);
    }
}