const { expect } = require("chai");
const { ethers } = require("hardhat");

/*
Integration test — DevCredProfile + DevCredEscrow

Tests the entire platform workflow end-to-end:
  1. Deploy both contracts and wire them together
  2. Profiles minted by users
  3. Client creates a job and deposits ETH
  4. Client assigns a developer
  5. Developer submits work
  6. Client approves → ETH released, reputation updated
  7. Cancellation path
  8. Multi-job and multi-user scenarios
*/
describe("DevCred — Full Integration", function () {
  // ─────────────────────────────────────────────────────────────────────────
  // Fixture
  // ─────────────────────────────────────────────────────────────────────────
  async function deployFullFixture() {
    const [deployer, client, developer, developer2, other] =
      await ethers.getSigners();

    // 1. Deploy DevCredProfile
    const profile = await ethers.deployContract("DevCredProfile");
    const profileAddress = await profile.getAddress();

    // 2. Deploy DevCredEscrow with profile address
    const escrow = await ethers.deployContract("DevCredEscrow", [profileAddress]);
    const escrowAddress = await escrow.getAddress();

    // 3. Transfer profile ownership to escrow (required for onlyOwner updateReputation)
    await profile.connect(deployer).transferOwnership(escrowAddress);

    // 4. Mint profiles for users who will act as developers
    await profile.connect(developer).mintProfile();
    await profile.connect(developer2).mintProfile();

    return {
      profile,
      escrow,
      profileAddress,
      escrowAddress,
      deployer,
      client,
      developer,
      developer2,
      other,
    };
  }

  const ONE_ETH = ethers.parseEther("1");
  const HALF_ETH = ethers.parseEther("0.5");

  // ─────────────────────────────────────────────────────────────────────────
  // 1 — Setup verification
  // ─────────────────────────────────────────────────────────────────────────
  describe("Setup", function () {
    it("escrow holds reference to profile contract", async function () {
      const { escrow, profileAddress } = await deployFullFixture();
      expect(await escrow.profileContract()).to.equal(profileAddress);
    });

    it("profile is owned by escrow after transfer", async function () {
      const { profile, escrowAddress } = await deployFullFixture();
      expect(await profile.owner()).to.equal(escrowAddress);
    });

    it("developers have minted profiles", async function () {
      const { profile, developer, developer2 } = await deployFullFixture();
      expect(await profile.addressToProfile(developer.address)).to.not.equal(0);
      expect(await profile.addressToProfile(developer2.address)).to.not.equal(0);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 2 — Happy path: full job lifecycle
  // ─────────────────────────────────────────────────────────────────────────
  describe("Happy path — single job lifecycle", function () {
    it("completes the full Create → Assign → Submit → Approve workflow", async function () {
      const { escrow, profile, client, developer } = await deployFullFixture();

      // Step 1: client creates job
      await expect(
        escrow.connect(client).createJob({ value: ONE_ETH })
      )
        .to.emit(escrow, "JobCreated")
        .withArgs(1, client.address, ONE_ETH);

      let job = await escrow.jobs(1);
      expect(job.status).to.equal(0n); // Open

      // Step 2: client assigns developer
      await expect(
        escrow.connect(client).assignDeveloper(1, developer.address)
      )
        .to.emit(escrow, "JobAssigned")
        .withArgs(1, developer.address);

      job = await escrow.jobs(1);
      expect(job.status).to.equal(1n); // InProgress
      expect(job.developer).to.equal(developer.address);

      // Step 3: developer submits work
      await expect(escrow.connect(developer).submitWork(1))
        .to.emit(escrow, "JobSubmitted")
        .withArgs(1);

      job = await escrow.jobs(1);
      expect(job.status).to.equal(2n); // Submitted

      // Step 4: client approves — should release funds and update reputation
      const devBalanceBefore = await ethers.provider.getBalance(developer.address);
      await expect(escrow.connect(client).approveWork(1))
        .to.emit(escrow, "JobCompleted")
        .withArgs(1);

      job = await escrow.jobs(1);
      expect(job.status).to.equal(3n); // Completed

      // ETH released to developer
      const devBalanceAfter = await ethers.provider.getBalance(developer.address);
      expect(devBalanceAfter - devBalanceBefore).to.be.closeTo(
        ONE_ETH,
        ethers.parseEther("0.01")
      );

      // Escrow is empty
      expect(
        await ethers.provider.getBalance(await escrow.getAddress())
      ).to.equal(0);
    });

    it("updates developer reputation and completedJobs after approval", async function () {
      const { escrow, profile, client, developer } = await deployFullFixture();

      await escrow.connect(client).createJob({ value: ONE_ETH });
      await escrow.connect(client).assignDeveloper(1, developer.address);
      await escrow.connect(developer).submitWork(1);
      await escrow.connect(client).approveWork(1);

      const p = await profile.getProfile(developer.address);
      expect(p.reputation).to.equal(ONE_ETH);
      expect(p.completedJobs).to.equal(1);
    });

    it("emits ReputationUpdated on profile contract during approval", async function () {
      const { escrow, profile, client, developer } = await deployFullFixture();

      await escrow.connect(client).createJob({ value: ONE_ETH });
      await escrow.connect(client).assignDeveloper(1, developer.address);
      await escrow.connect(developer).submitWork(1);

      const tokenId = await profile.addressToProfile(developer.address);

      await expect(escrow.connect(client).approveWork(1))
        .to.emit(profile, "ReputationUpdated")
        .withArgs(developer.address, tokenId, ONE_ETH, 1);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 3 — Cancellation path
  // ─────────────────────────────────────────────────────────────────────────
  describe("Cancellation path", function () {
    it("client can cancel an open job and receives full refund", async function () {
      const { escrow, client } = await deployFullFixture();

      await escrow.connect(client).createJob({ value: ONE_ETH });

      const balanceBefore = await ethers.provider.getBalance(client.address);
      const cancelTx = await escrow.connect(client).cancelJob(1);
      const r = await cancelTx.wait();
      const gasCost = r.gasUsed * r.gasPrice;
      const balanceAfter = await ethers.provider.getBalance(client.address);

      // Client got back ONE_ETH minus gas for the cancel call itself
      expect(balanceAfter - balanceBefore + gasCost).to.be.closeTo(
        ONE_ETH,
        ethers.parseEther("0.001")
      );

      const job = await escrow.jobs(1);
      expect(job.status).to.equal(4n); // Cancelled
    });

    it("client cannot cancel after a developer is assigned", async function () {
      const { escrow, client, developer } = await deployFullFixture();

      await escrow.connect(client).createJob({ value: ONE_ETH });
      await escrow.connect(client).assignDeveloper(1, developer.address);

      await expect(
        escrow.connect(client).cancelJob(1)
      ).to.be.revertedWith("Cannot cancel");
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 4 — Access control across the workflow
  // ─────────────────────────────────────────────────────────────────────────
  describe("Access control across workflow", function () {
    it("only client can assign a developer", async function () {
      const { escrow, client, developer, other } = await deployFullFixture();
      await escrow.connect(client).createJob({ value: ONE_ETH });

      await expect(
        escrow.connect(other).assignDeveloper(1, developer.address)
      ).to.be.revertedWith("Not client");
    });

    it("only assigned developer can submit work", async function () {
      const { escrow, client, developer, other } = await deployFullFixture();
      await escrow.connect(client).createJob({ value: ONE_ETH });
      await escrow.connect(client).assignDeveloper(1, developer.address);

      await expect(
        escrow.connect(other).submitWork(1)
      ).to.be.revertedWith("Not developer");
    });

    it("only client can approve work", async function () {
      const { escrow, client, developer, other } = await deployFullFixture();
      await escrow.connect(client).createJob({ value: ONE_ETH });
      await escrow.connect(client).assignDeveloper(1, developer.address);
      await escrow.connect(developer).submitWork(1);

      await expect(
        escrow.connect(other).approveWork(1)
      ).to.be.revertedWith("Not client");
    });

    it("escrow (not original deployer) can update reputation via approve", async function () {
      // Verifies the ownership transfer wiring is correct end-to-end
      const { escrow, profile, client, developer } = await deployFullFixture();

      await escrow.connect(client).createJob({ value: ONE_ETH });
      await escrow.connect(client).assignDeveloper(1, developer.address);
      await escrow.connect(developer).submitWork(1);

      // This would revert if ownership wasn't transferred to escrow
      await escrow.connect(client).approveWork(1);

      const p = await profile.getProfile(developer.address);
      expect(p.completedJobs).to.equal(1);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 5 — Multi-job scenario
  // ─────────────────────────────────────────────────────────────────────────
  describe("Multiple concurrent jobs", function () {
    it("handles two jobs for different developers independently", async function () {
      const { escrow, profile, client, developer, developer2 } =
        await deployFullFixture();

      // Job 1 → developer
      await escrow.connect(client).createJob({ value: ONE_ETH });
      await escrow.connect(client).assignDeveloper(1, developer.address);
      await escrow.connect(developer).submitWork(1);

      // Job 2 → developer2
      await escrow.connect(client).createJob({ value: HALF_ETH });
      await escrow.connect(client).assignDeveloper(2, developer2.address);
      await escrow.connect(developer2).submitWork(2);

      // Approve both
      await escrow.connect(client).approveWork(1);
      await escrow.connect(client).approveWork(2);

      const p1 = await profile.getProfile(developer.address);
      const p2 = await profile.getProfile(developer2.address);

      expect(p1.reputation).to.equal(ONE_ETH);
      expect(p1.completedJobs).to.equal(1);

      expect(p2.reputation).to.equal(HALF_ETH);
      expect(p2.completedJobs).to.equal(1);
    });

    it("correctly accumulates reputation across multiple jobs for same developer", async function () {
      const { escrow, profile, client, developer } = await deployFullFixture();

      for (let i = 0; i < 3; i++) {
        await escrow.connect(client).createJob({ value: ONE_ETH });
        const jobId = i + 1;
        await escrow.connect(client).assignDeveloper(jobId, developer.address);
        await escrow.connect(developer).submitWork(jobId);
        await escrow.connect(client).approveWork(jobId);
      }

      const p = await profile.getProfile(developer.address);
      expect(p.reputation).to.equal(ONE_ETH * 3n);
      expect(p.completedJobs).to.equal(3);
    });

    it("escrow holds correct combined balance for multiple open jobs", async function () {
      const { escrow, client } = await deployFullFixture();

      await escrow.connect(client).createJob({ value: ONE_ETH });
      await escrow.connect(client).createJob({ value: HALF_ETH });

      const balance = await ethers.provider.getBalance(await escrow.getAddress());
      expect(balance).to.equal(ONE_ETH + HALF_ETH);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 6 — Edge cases and invalid state transitions
  // ─────────────────────────────────────────────────────────────────────────
  describe("Invalid state transitions", function () {
    it("cannot approve before developer submits", async function () {
      const { escrow, client, developer } = await deployFullFixture();
      await escrow.connect(client).createJob({ value: ONE_ETH });
      await escrow.connect(client).assignDeveloper(1, developer.address);

      await expect(
        escrow.connect(client).approveWork(1)
      ).to.be.revertedWith("Not submitted");
    });

    it("cannot submit before developer is assigned", async function () {
      const { escrow, client, developer } = await deployFullFixture();
      await escrow.connect(client).createJob({ value: ONE_ETH });

      await expect(
        escrow.connect(developer).submitWork(1)
      ).to.be.revertedWith("Not developer");
    });

    it("cannot create job with zero ETH", async function () {
      const { escrow, client } = await deployFullFixture();
      await expect(
        escrow.connect(client).createJob({ value: 0 })
      ).to.be.revertedWith("No funds");
    });

    it("developer with no profile cannot receive reputation (approveWork reverts)", async function () {
      const { escrow, client, other } = await deployFullFixture();
      // 'other' has no profile

      await escrow.connect(client).createJob({ value: ONE_ETH });
      await escrow.connect(client).assignDeveloper(1, other.address);
      await escrow.connect(other).submitWork(1);

      await expect(
        escrow.connect(client).approveWork(1)
      ).to.be.revertedWith("No profile");
    });

    it("completed job cannot be approved twice", async function () {
      const { escrow, client, developer } = await deployFullFixture();
      await escrow.connect(client).createJob({ value: ONE_ETH });
      await escrow.connect(client).assignDeveloper(1, developer.address);
      await escrow.connect(developer).submitWork(1);
      await escrow.connect(client).approveWork(1);

      await expect(
        escrow.connect(client).approveWork(1)
      ).to.be.revertedWith("Not submitted");
    });
  });
});
