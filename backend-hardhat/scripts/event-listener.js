require("dotenv").config();

const { ethers } = require("ethers");
const { MongoClient, ServerApiVersion } = require("mongodb");

const ESCROW_ABI = [
  // Single-payment events
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
];

const PROFILE_ABI = [
  "event ProfileMinted(address indexed user, uint256 indexed tokenId)",
  "function getProfile(address user) external view returns (tuple(uint256 reputation, uint256 completedJobs))",
];

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

async function main() {
  const rpcWssUrl = requiredEnv("SEPOLIA_ALCHEMY_WS_URL");
  const mongoUri = requiredEnv("MONGODB_URI");
  const mongoDbName = requiredEnv("MONGODB_DB_NAME");
  const escrowAddress = requiredEnv("DEVCRED_ESCROW_ADDRESS");
  const profileAddress = requiredEnv("DEVCRED_PROFILE_ADDRESS");

  const provider = new ethers.WebSocketProvider(rpcWssUrl);
  const escrow = new ethers.Contract(escrowAddress, ESCROW_ABI, provider);
  const profile = new ethers.Contract(profileAddress, PROFILE_ABI, provider);

  const mongoClient = new MongoClient(mongoUri, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    },
  });

  await mongoClient.connect();
  const db = mongoClient.db(mongoDbName);

  const jobs = db.collection("jobs");
  const profiles = db.collection("profiles");
  const jobEvents = db.collection("jobEvents");

  await Promise.all([
    jobs.createIndex({ jobId: 1 }, { unique: true }),
    profiles.createIndex({ walletAddress: 1 }, { unique: true }),
    profiles.createIndex({ tokenId: 1 }, { unique: true }),
    jobEvents.createIndex({ txHash: 1, eventType: 1 }, { unique: true }),
  ]);

  console.log("Event listener started");

  profile.on("ProfileMinted", async (user, tokenId, event) => {
    try {
      await profiles.updateOne(
        { walletAddress: user.toLowerCase() },
        {
          $setOnInsert: {
            walletAddress: user.toLowerCase(),
            reputation: 0,
            completedJobs: 0,
          },
          $set: {
            tokenId: Number(tokenId),
            lastUpdatedBlock: event.log.blockNumber,
            updatedAt: new Date(),
          },
        },
        { upsert: true }
      );

      console.log(`ProfileMinted synced for ${user}`);
    } catch (error) {
      console.error("ProfileMinted sync failed", error);
    }
  });

  escrow.on("JobCreated", async (jobId, client, amount, isMilestoneJob, event) => {
    try {
      await jobs.updateOne(
        { jobId: Number(jobId) },
        {
          $setOnInsert: {
            jobId: Number(jobId),
            client: client.toLowerCase(),
            title: "On-chain job",
            description: "Created from smart contract event",
            token: "ETH",
            metadataURI: "",
            tags: [],
            createdAt: new Date(),
          },
          $set: {
            amount: ethers.formatEther(amount),
            status: "OPEN",
            isMilestoneJob: isMilestoneJob ?? false,
            txHash: event.log.transactionHash,
            updatedAt: new Date(),
          },
        },
        { upsert: true }
      );

      await jobEvents.updateOne(
        { txHash: event.log.transactionHash, eventType: "JobCreated" },
        {
          $setOnInsert: {
            jobId: Number(jobId),
            eventType: "JobCreated",
            triggeredBy: client.toLowerCase(),
            txHash: event.log.transactionHash,
            blockNumber: event.log.blockNumber,
            timestamp: new Date(),
          },
          $set: {
            isMilestoneJob: isMilestoneJob ?? false,
          },
        },
        { upsert: true }
      );

      console.log(`JobCreated synced for #${Number(jobId)} (Milestone: ${isMilestoneJob ? "Yes" : "No"})`);
    } catch (error) {
      console.error("JobCreated sync failed", error);
    }
  });

  escrow.on("JobAssigned", async (jobId, developer, event) => {
    try {
      await jobs.updateOne(
        { jobId: Number(jobId) },
        {
          $set: {
            developer: developer.toLowerCase(),
            status: "IN_PROGRESS",
            txHash: event.log.transactionHash,
            updatedAt: new Date(),
          },
        },
        { upsert: false }
      );

      await jobEvents.updateOne(
        { txHash: event.log.transactionHash, eventType: "JobAssigned" },
        {
          $setOnInsert: {
            jobId: Number(jobId),
            eventType: "JobAssigned",
            triggeredBy: developer.toLowerCase(),
            txHash: event.log.transactionHash,
            blockNumber: event.log.blockNumber,
            timestamp: new Date(),
          },
        },
        { upsert: true }
      );

      console.log(`JobAssigned synced for #${Number(jobId)}`);
    } catch (error) {
      console.error("JobAssigned sync failed", error);
    }
  });

  escrow.on("JobSubmitted", async (jobId, deadline, event) => {
    try {
      const job = await jobs.findOne({ jobId: Number(jobId) });
      await jobs.updateOne(
        { jobId: Number(jobId) },
        {
          $set: {
            status: "SUBMITTED",
            submittedAt: new Date(Number(deadline) * 1000),
            txHash: event.log.transactionHash,
            updatedAt: new Date(),
          },
        }
      );

      await jobEvents.updateOne(
        { txHash: event.log.transactionHash, eventType: "JobSubmitted" },
        {
          $setOnInsert: {
            jobId: Number(jobId),
            eventType: "JobSubmitted",
            triggeredBy: (job?.developer || job?.client || "").toLowerCase(),
            txHash: event.log.transactionHash,
            blockNumber: event.log.blockNumber,
            timestamp: new Date(),
          },
          $set: {
            deadline: new Date(Number(deadline) * 1000),
          },
        },
        { upsert: true }
      );

      console.log(`JobSubmitted synced for #${Number(jobId)}`);
    } catch (error) {
      console.error("JobSubmitted sync failed", error);
    }
  });

  escrow.on("JobCompleted", async (jobId, event) => {
    try {
      const job = await jobs.findOne({ jobId: Number(jobId) });

      await jobs.updateOne(
        { jobId: Number(jobId) },
        {
          $set: {
            status: "COMPLETED",
            txHash: event.log.transactionHash,
            updatedAt: new Date(),
          },
        }
      );

      await jobEvents.updateOne(
        { txHash: event.log.transactionHash, eventType: "JobCompleted" },
        {
          $setOnInsert: {
            jobId: Number(jobId),
            eventType: "JobCompleted",
            triggeredBy: (job?.client || "").toLowerCase(),
            txHash: event.log.transactionHash,
            blockNumber: event.log.blockNumber,
            timestamp: new Date(),
          },
        },
        { upsert: true }
      );

      if (job?.developer) {
        const onChainProfile = await profile.getProfile(job.developer);
        await profiles.updateOne(
          { walletAddress: job.developer.toLowerCase() },
          {
            $setOnInsert: {
              walletAddress: job.developer.toLowerCase(),
              tokenId: 0,
              createdAt: new Date(),
            },
            $set: {
              reputation: Number(onChainProfile.reputation),
              completedJobs: Number(onChainProfile.completedJobs),
              lastUpdatedBlock: event.log.blockNumber,
              updatedAt: new Date(),
            },
          },
          { upsert: true }
        );
      }

      console.log(`JobCompleted synced for #${Number(jobId)}`);
    } catch (error) {
      console.error("JobCompleted sync failed", error);
    }
  });

  // ===== MILESTONE EVENT HANDLERS =====

  escrow.on("MilestoneSubmitted", async (jobId, milestoneIndex, deadline, event) => {
    try {
      await jobEvents.updateOne(
        { txHash: event.log.transactionHash, eventType: "MilestoneSubmitted" },
        {
          $setOnInsert: {
            jobId: Number(jobId),
            milestoneIndex: Number(milestoneIndex),
            eventType: "MilestoneSubmitted",
            txHash: event.log.transactionHash,
            blockNumber: event.log.blockNumber,
            timestamp: new Date(),
          },
          $set: {
            deadline: new Date(Number(deadline) * 1000),
          },
        },
        { upsert: true }
      );

      console.log(`MilestoneSubmitted synced for job #${Number(jobId)}, milestone ${Number(milestoneIndex)}`);
    } catch (error) {
      console.error("MilestoneSubmitted sync failed", error);
    }
  });

  escrow.on("MilestoneApproved", async (jobId, milestoneIndex, amountReleased, event) => {
    try {
      await jobEvents.updateOne(
        { txHash: event.log.transactionHash, eventType: "MilestoneApproved" },
        {
          $setOnInsert: {
            jobId: Number(jobId),
            milestoneIndex: Number(milestoneIndex),
            eventType: "MilestoneApproved",
            txHash: event.log.transactionHash,
            blockNumber: event.log.blockNumber,
            timestamp: new Date(),
          },
          $set: {
            amountReleased: ethers.formatEther(amountReleased),
          },
        },
        { upsert: true }
      );

      console.log(`MilestoneApproved synced for job #${Number(jobId)}, milestone ${Number(milestoneIndex)}`);
    } catch (error) {
      console.error("MilestoneApproved sync failed", error);
    }
  });

  escrow.on("MilestoneRejected", async (jobId, milestoneIndex, event) => {
    try {
      await jobEvents.updateOne(
        { txHash: event.log.transactionHash, eventType: "MilestoneRejected" },
        {
          $setOnInsert: {
            jobId: Number(jobId),
            milestoneIndex: Number(milestoneIndex),
            eventType: "MilestoneRejected",
            txHash: event.log.transactionHash,
            blockNumber: event.log.blockNumber,
            timestamp: new Date(),
          },
        },
        { upsert: true }
      );

      console.log(`MilestoneRejected synced for job #${Number(jobId)}, milestone ${Number(milestoneIndex)}`);
    } catch (error) {
      console.error("MilestoneRejected sync failed", error);
    }
  });

  escrow.on("MilestoneAutoReleased", async (jobId, milestoneIndex, amountReleased, event) => {
    try {
      await jobEvents.updateOne(
        { txHash: event.log.transactionHash, eventType: "MilestoneAutoReleased" },
        {
          $setOnInsert: {
            jobId: Number(jobId),
            milestoneIndex: Number(milestoneIndex),
            eventType: "MilestoneAutoReleased",
            txHash: event.log.transactionHash,
            blockNumber: event.log.blockNumber,
            timestamp: new Date(),
          },
          $set: {
            amountReleased: ethers.formatEther(amountReleased),
          },
        },
        { upsert: true }
      );

      console.log(`MilestoneAutoReleased synced for job #${Number(jobId)}, milestone ${Number(milestoneIndex)}`);
    } catch (error) {
      console.error("MilestoneAutoReleased sync failed", error);
    }
  });

  escrow.on("AllMilestonesCompleted", async (jobId, event) => {
    try {
      await jobs.updateOne(
        { jobId: Number(jobId) },
        {
          $set: {
            status: "COMPLETED",
            txHash: event.log.transactionHash,
            updatedAt: new Date(),
          },
        }
      );

      const job = await jobs.findOne({ jobId: Number(jobId) });

      await jobEvents.updateOne(
        { txHash: event.log.transactionHash, eventType: "AllMilestonesCompleted" },
        {
          $setOnInsert: {
            jobId: Number(jobId),
            eventType: "AllMilestonesCompleted",
            txHash: event.log.transactionHash,
            blockNumber: event.log.blockNumber,
            timestamp: new Date(),
          },
        },
        { upsert: true }
      );

      if (job?.developer) {
        const onChainProfile = await profile.getProfile(job.developer);
        await profiles.updateOne(
          { walletAddress: job.developer.toLowerCase() },
          {
            $setOnInsert: {
              walletAddress: job.developer.toLowerCase(),
              tokenId: 0,
              createdAt: new Date(),
            },
            $set: {
              reputation: Number(onChainProfile.reputation),
              completedJobs: Number(onChainProfile.completedJobs),
              lastUpdatedBlock: event.log.blockNumber,
              updatedAt: new Date(),
            },
          },
          { upsert: true }
        );
      }

      console.log(`AllMilestonesCompleted synced for job #${Number(jobId)}`);
    } catch (error) {
      console.error("AllMilestonesCompleted sync failed", error);
    }
  });
}

main().catch((error) => {
  console.error("Listener failed to start", error);
  process.exit(1);
});
