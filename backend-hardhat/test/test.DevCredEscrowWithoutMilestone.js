const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const { expect } = require("chai");
const { ethers } = require("hardhat");

/*
Developer Testing Workflow (Non-Milestone Escrow)

Test Type: Integration Test Suite

This suite intentionally validates only the single-payment flow:
  1. Deployment/Wiring
    - Escrow points to Profile correctly
    - Contract constants are exposed as expected

  2. Job Lifecycle (Create -> Assign -> Submit -> Approve)
    - State transitions are correct
    - Events are emitted with expected values
    - Funds and reputation updates are correct on completion

  3. Safety/Guard Rails
    - Access control checks (client vs developer vs other)
    - Invalid state transitions revert with expected reasons
    - Zero-fund and non-existent job edge cases

  4. Cancellation and Auto-Release
    - Cancel path refunds correctly
    - Timeout-based auto-release works only after deadline
    - Repeat/invalid auto-release calls are rejected

  5. Isolation Across Jobs
    - Multiple jobs do not interfere with each other
    - Reputation and completed job counts accumulate correctly

Milestone-specific behavior is intentionally excluded here and covered in
test.DevCredEscrowWithMilestone.js.
*/

describe("DevCredEscrowWithoutMilestone", function () {
  async function deployFixture() {
    const [owner, client, developer, other] = await ethers.getSigners();

    const profile = await ethers.deployContract("DevCredProfile");
    const escrow = await ethers.deployContract("DevCredEscrow", [
      await profile.getAddress(),
    ]);

    await profile.connect(owner).transferOwnership(await escrow.getAddress());
    await profile.connect(developer).mintProfile();

    return { profile, escrow, client, developer, other };
  }

  async function deployNoProfileFixture() {
    const [owner, client, developer, other] = await ethers.getSigners();

    const profile = await ethers.deployContract("DevCredProfile");
    const escrow = await ethers.deployContract("DevCredEscrow", [
      await profile.getAddress(),
    ]);

    await profile.connect(owner).transferOwnership(await escrow.getAddress());

    return { profile, escrow, client, developer, other };
  }

  const ONE_ETH = ethers.parseEther("1");
  const HALF_ETH = ethers.parseEther("0.5");
  const AUTO_RELEASE_TIMEOUT = 3 * 60;
  const JOB_OPEN = 0n;
  const JOB_IN_PROGRESS = 1n;
  const JOB_SUBMITTED = 2n;
  const JOB_COMPLETED = 3n;
  const JOB_CANCELLED = 4n;
  const JOB_AUTO_RELEASED = 5n;

  async function setupSubmittedJob(fixture) {
    await fixture.escrow.connect(fixture.client).createJob({ value: ONE_ETH });
    await fixture.escrow
      .connect(fixture.client)
      .assignDeveloper(1, fixture.developer.address);
    await fixture.escrow.connect(fixture.developer).submitWork(1);
  }

  async function advancePastDeadline() {
    await ethers.provider.send("evm_increaseTime", [AUTO_RELEASE_TIMEOUT + 1]);
    await ethers.provider.send("evm_mine", []);
  }

  describe("Deployment", function () {
    it("stores profile address and starts with nextJobId 0", async function () {
      const { profile, escrow } = await deployFixture();
      expect(await escrow.profileContract()).to.equal(await profile.getAddress());
      expect(await escrow.nextJobId()).to.equal(0);
    });

    it("exposes expected timeout and milestone constants", async function () {
      const { escrow } = await deployFixture();
      expect(await escrow.AUTO_RELEASE_TIMEOUT()).to.equal(AUTO_RELEASE_TIMEOUT);
      expect(await escrow.MAX_MILESTONES()).to.equal(3);
    });
  });

  describe("createJob", function () {
    it("creates a non-milestone job and emits JobCreated", async function () {
      const { escrow, client } = await deployFixture();

      await expect(escrow.connect(client).createJob({ value: ONE_ETH }))
        .to.emit(escrow, "JobCreated")
        .withArgs(1, client.address, ONE_ETH, false);

      const job = await escrow.jobs(1);
      expect(job.client).to.equal(client.address);
      expect(job.amount).to.equal(ONE_ETH);
      expect(job.status).to.equal(JOB_OPEN);
      expect(job.isMilestoneJob).to.equal(false);
      expect(job.developer).to.equal(ethers.ZeroAddress);
      expect(job.submittedAt).to.equal(0);
      expect(job.currentMilestoneIndex).to.equal(0);
      expect(await escrow.nextJobId()).to.equal(1);
    });

    it("reverts with zero ETH", async function () {
      const { escrow, client } = await deployFixture();
      await expect(escrow.connect(client).createJob({ value: 0 })).to.be.revertedWith(
        "No funds",
      );
    });

    it("returns the new jobId using staticCall", async function () {
      const { escrow, client } = await deployFixture();
      const jobId = await escrow.connect(client).createJob.staticCall({ value: ONE_ETH });
      expect(jobId).to.equal(1);
    });

    it("supports multiple jobs and correct escrow balance accumulation", async function () {
      const { escrow, client } = await deployFixture();
      await escrow.connect(client).createJob({ value: ONE_ETH });
      await escrow.connect(client).createJob({ value: HALF_ETH });

      expect(await escrow.nextJobId()).to.equal(2);
      expect(await ethers.provider.getBalance(await escrow.getAddress())).to.equal(
        ONE_ETH + HALF_ETH,
      );
    });
  });

  describe("assignDeveloper and submitWork", function () {
    it("allows client to assign and developer to submit", async function () {
      const { escrow, client, developer } = await deployFixture();
      await escrow.connect(client).createJob({ value: ONE_ETH });

      await expect(escrow.connect(client).assignDeveloper(1, developer.address))
        .to.emit(escrow, "JobAssigned")
        .withArgs(1, developer.address);

      await expect(escrow.connect(developer).submitWork(1))
        .to.emit(escrow, "JobSubmitted")
        .withArgs(1, anyValue);

      const job = await escrow.jobs(1);
      expect(job.status).to.equal(JOB_SUBMITTED);
      expect(job.developer).to.equal(developer.address);
      expect(job.submittedAt).to.be.greaterThan(0);
    });

    it("enforces access control on assign and submit", async function () {
      const { escrow, client, developer, other } = await deployFixture();
      await escrow.connect(client).createJob({ value: ONE_ETH });

      await expect(
        escrow.connect(other).assignDeveloper(1, developer.address),
      ).to.be.revertedWith("Not client");

      await escrow.connect(client).assignDeveloper(1, developer.address);

      await expect(escrow.connect(other).submitWork(1)).to.be.revertedWith(
        "Not developer",
      );
    });

    it("reverts when assigning by non-client for non-existent job", async function () {
      const { escrow, other, developer } = await deployFixture();
      await expect(
        escrow.connect(other).assignDeveloper(999, developer.address),
      ).to.be.revertedWith("Not client");
    });

    it("reverts when assigning after job is already in progress", async function () {
      const { escrow, client, developer } = await deployFixture();
      await escrow.connect(client).createJob({ value: ONE_ETH });
      await escrow.connect(client).assignDeveloper(1, developer.address);

      await expect(
        escrow.connect(client).assignDeveloper(1, developer.address),
      ).to.be.revertedWith("Not open");
    });

    it("reverts when submit is called before assignment", async function () {
      const { escrow, client, developer } = await deployFixture();
      await escrow.connect(client).createJob({ value: ONE_ETH });

      await expect(escrow.connect(developer).submitWork(1)).to.be.revertedWith(
        "Not developer",
      );
    });

    it("reverts when submit is called twice", async function () {
      const { escrow, client, developer } = await deployFixture();
      await escrow.connect(client).createJob({ value: ONE_ETH });
      await escrow.connect(client).assignDeveloper(1, developer.address);
      await escrow.connect(developer).submitWork(1);

      await expect(escrow.connect(developer).submitWork(1)).to.be.revertedWith(
        "Invalid state",
      );
    });

    it("emits JobSubmitted with exact deadline timestamp", async function () {
      const { escrow, client, developer } = await deployFixture();
      await escrow.connect(client).createJob({ value: ONE_ETH });
      await escrow.connect(client).assignDeveloper(1, developer.address);

      const tx = await escrow.connect(developer).submitWork(1);
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);
      const expectedDeadline = block.timestamp + AUTO_RELEASE_TIMEOUT;

      await expect(tx).to.emit(escrow, "JobSubmitted").withArgs(1, expectedDeadline);
    });
  });

  describe("approveWork", function () {
    it("completes job, transfers funds, and updates reputation", async function () {
      const f = await deployFixture();
      await setupSubmittedJob(f);

      const balanceBefore = await ethers.provider.getBalance(f.developer.address);

      await expect(f.escrow.connect(f.client).approveWork(1))
        .to.emit(f.escrow, "JobCompleted")
        .withArgs(1);

      const balanceAfter = await ethers.provider.getBalance(f.developer.address);
      expect(balanceAfter - balanceBefore).to.be.closeTo(
        ONE_ETH,
        ethers.parseEther("0.01"),
      );

      const job = await f.escrow.jobs(1);
      expect(job.status).to.equal(JOB_COMPLETED);

      expect(await ethers.provider.getBalance(await f.escrow.getAddress())).to.equal(0);

      const profile = await f.profile.getProfile(f.developer.address);
      expect(profile.reputation).to.equal(ONE_ETH);
      expect(profile.completedJobs).to.equal(1);
    });

    it("reverts when non-client approves", async function () {
      const f = await deployFixture();
      await setupSubmittedJob(f);

      await expect(f.escrow.connect(f.other).approveWork(1)).to.be.revertedWith(
        "Not client",
      );
    });

    it("reverts when developer has no profile", async function () {
      const f = await deployNoProfileFixture();
      await f.escrow.connect(f.client).createJob({ value: ONE_ETH });
      await f.escrow.connect(f.client).assignDeveloper(1, f.developer.address);
      await f.escrow.connect(f.developer).submitWork(1);

      await expect(f.escrow.connect(f.client).approveWork(1)).to.be.revertedWith(
        "No profile",
      );
    });

    it("reverts when approving before submit", async function () {
      const { escrow, client, developer } = await deployFixture();
      await escrow.connect(client).createJob({ value: ONE_ETH });
      await escrow.connect(client).assignDeveloper(1, developer.address);

      await expect(escrow.connect(client).approveWork(1)).to.be.revertedWith(
        "Not submitted",
      );
    });

    it("reverts when approving twice", async function () {
      const f = await deployFixture();
      await setupSubmittedJob(f);
      await f.escrow.connect(f.client).approveWork(1);

      await expect(f.escrow.connect(f.client).approveWork(1)).to.be.revertedWith(
        "Not submitted",
      );
    });

    it("emits profile ReputationUpdated with expected values", async function () {
      const f = await deployFixture();
      await setupSubmittedJob(f);
      const tokenId = await f.profile.addressToProfile(f.developer.address);

      await expect(f.escrow.connect(f.client).approveWork(1))
        .to.emit(f.profile, "ReputationUpdated")
        .withArgs(f.developer.address, tokenId, ONE_ETH, 1);
    });
  });

  describe("cancelJob", function () {
    it("cancels an open job and refunds client", async function () {
      const { escrow, client } = await deployFixture();
      await escrow.connect(client).createJob({ value: ONE_ETH });

      await escrow.connect(client).cancelJob(1);

      const job = await escrow.jobs(1);
      expect(job.status).to.equal(JOB_CANCELLED);
      expect(await ethers.provider.getBalance(await escrow.getAddress())).to.equal(0);
    });

    it("reverts if job already assigned", async function () {
      const { escrow, client, developer } = await deployFixture();
      await escrow.connect(client).createJob({ value: ONE_ETH });
      await escrow.connect(client).assignDeveloper(1, developer.address);

      await expect(escrow.connect(client).cancelJob(1)).to.be.revertedWith(
        "Cannot cancel after assignment",
      );
    });

    it("reverts if non-client attempts cancel", async function () {
      const { escrow, client, other } = await deployFixture();
      await escrow.connect(client).createJob({ value: ONE_ETH });

      await expect(escrow.connect(other).cancelJob(1)).to.be.revertedWith("Not client");
    });

    it("reverts if cancel is attempted for non-existent job", async function () {
      const { escrow, client } = await deployFixture();
      await expect(escrow.connect(client).cancelJob(999)).to.be.revertedWith("Not client");
    });

    it("refunds full value to client (minus transaction gas)", async function () {
      const { escrow, client } = await deployFixture();

      const before = await ethers.provider.getBalance(client.address);
      const createTx = await escrow.connect(client).createJob({ value: ONE_ETH });
      const createReceipt = await createTx.wait();
      const createGas = createReceipt.gasUsed * createReceipt.gasPrice;

      const cancelTx = await escrow.connect(client).cancelJob(1);
      const cancelReceipt = await cancelTx.wait();
      const cancelGas = cancelReceipt.gasUsed * cancelReceipt.gasPrice;

      const after = await ethers.provider.getBalance(client.address);
      const netSpent = before - after;
      expect(netSpent).to.be.closeTo(createGas + cancelGas, ethers.parseEther("0.001"));
    });
  });

  describe("autoReleaseFunds", function () {
    it("auto-releases after timeout and marks AutoReleased", async function () {
      const f = await deployFixture();
      await setupSubmittedJob(f);
      await advancePastDeadline();

      await expect(f.escrow.connect(f.developer).autoReleaseFunds(1))
        .to.emit(f.escrow, "AutoReleased")
        .withArgs(1, ONE_ETH);

      const job = await f.escrow.jobs(1);
      expect(job.status).to.equal(JOB_AUTO_RELEASED);

      const profile = await f.profile.getProfile(f.developer.address);
      expect(profile.reputation).to.equal(ONE_ETH);
      expect(profile.completedJobs).to.equal(1);
    });

    it("reverts before timeout", async function () {
      const f = await deployFixture();
      await setupSubmittedJob(f);

      await expect(
        f.escrow.connect(f.developer).autoReleaseFunds(1),
      ).to.be.revertedWith("Deadline not reached");
    });

    it("reverts one second before deadline", async function () {
      const f = await deployFixture();
      await setupSubmittedJob(f);

      await ethers.provider.send("evm_increaseTime", [AUTO_RELEASE_TIMEOUT - 1]);
      await ethers.provider.send("evm_mine", []);

      await expect(
        f.escrow.connect(f.developer).autoReleaseFunds(1),
      ).to.be.revertedWith("Deadline not reached");
    });

    it("reverts when caller is not developer", async function () {
      const f = await deployFixture();
      await setupSubmittedJob(f);
      await advancePastDeadline();

      await expect(f.escrow.connect(f.other).autoReleaseFunds(1)).to.be.revertedWith(
        "Only developer",
      );
    });

    it("reverts when job is not submitted", async function () {
      const { escrow, client, developer } = await deployFixture();
      await escrow.connect(client).createJob({ value: ONE_ETH });
      await escrow.connect(client).assignDeveloper(1, developer.address);
      await advancePastDeadline();

      await expect(escrow.connect(developer).autoReleaseFunds(1)).to.be.revertedWith(
        "Not submitted",
      );
    });

    it("reverts when called again after already auto-released", async function () {
      const f = await deployFixture();
      await setupSubmittedJob(f);
      await advancePastDeadline();
      await f.escrow.connect(f.developer).autoReleaseFunds(1);

      await expect(
        f.escrow.connect(f.developer).autoReleaseFunds(1),
      ).to.be.revertedWith("Not submitted");
    });

    it("reverts when developer has no profile", async function () {
      const f = await deployNoProfileFixture();
      await f.escrow.connect(f.client).createJob({ value: ONE_ETH });
      await f.escrow.connect(f.client).assignDeveloper(1, f.developer.address);
      await f.escrow.connect(f.developer).submitWork(1);
      await advancePastDeadline();

      await expect(f.escrow.connect(f.developer).autoReleaseFunds(1)).to.be.revertedWith(
        "No profile",
      );
    });
  });

  describe("multi-job isolation (non-milestone)", function () {
    it("handles independent outcomes across multiple jobs", async function () {
      const { escrow, profile, client, developer } = await deployFixture();

      // Job 1: approved
      await escrow.connect(client).createJob({ value: ONE_ETH });
      await escrow.connect(client).assignDeveloper(1, developer.address);
      await escrow.connect(developer).submitWork(1);
      await escrow.connect(client).approveWork(1);

      // Job 2: cancelled
      await escrow.connect(client).createJob({ value: HALF_ETH });
      await escrow.connect(client).cancelJob(2);

      const job1 = await escrow.jobs(1);
      const job2 = await escrow.jobs(2);
      expect(job1.status).to.equal(JOB_COMPLETED);
      expect(job2.status).to.equal(JOB_CANCELLED);

      const p = await profile.getProfile(developer.address);
      expect(p.reputation).to.equal(ONE_ETH);
      expect(p.completedJobs).to.equal(1);
    });

    it("accumulates reputation across approve and auto-release", async function () {
      const { escrow, profile, client, developer } = await deployFixture();

      // Job 1: approve
      await escrow.connect(client).createJob({ value: ONE_ETH });
      await escrow.connect(client).assignDeveloper(1, developer.address);
      await escrow.connect(developer).submitWork(1);
      await escrow.connect(client).approveWork(1);

      // Job 2: auto-release
      await escrow.connect(client).createJob({ value: HALF_ETH });
      await escrow.connect(client).assignDeveloper(2, developer.address);
      await escrow.connect(developer).submitWork(2);
      await advancePastDeadline();
      await escrow.connect(developer).autoReleaseFunds(2);

      const p = await profile.getProfile(developer.address);
      expect(p.reputation).to.equal(ONE_ETH + HALF_ETH);
      expect(p.completedJobs).to.equal(2);
    });
  });
});
