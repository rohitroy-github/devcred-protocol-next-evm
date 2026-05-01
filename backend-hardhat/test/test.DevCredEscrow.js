// const { expect } = require("chai");
// const { ethers } = require("hardhat");

// describe("DevCredEscrow", function () {
//   // ─────────────────────────────────────────────────────────────────────────
//   // Fixture: deploy both contracts; transfer profile ownership to escrow;
//   // mint profiles for developer so approveWork can update reputation.
//   // ─────────────────────────────────────────────────────────────────────────
//   async function deployEscrowFixture() {
//     const [owner, client, developer, other] = await ethers.getSigners();

//     const profile = await ethers.deployContract("DevCredProfile");
//     const escrow = await ethers.deployContract("DevCredEscrow", [
//       await profile.getAddress(),
//     ]);

//     // Transfer profile ownership to escrow so updateReputation works
//     await profile.connect(owner).transferOwnership(await escrow.getAddress());

//     // Developer mints a profile
//     await profile.connect(developer).mintProfile();

//     return { profile, escrow, owner, client, developer, other };
//   }

//   // Fixture variant where developer has NO profile (for edge-case tests)
//   async function deployEscrowNoProfileFixture() {
//     const [owner, client, developer, other] = await ethers.getSigners();

//     const profile = await ethers.deployContract("DevCredProfile");
//     const escrow = await ethers.deployContract("DevCredEscrow", [
//       await profile.getAddress(),
//     ]);

//     await profile.connect(owner).transferOwnership(await escrow.getAddress());

//     return { profile, escrow, owner, client, developer, other };
//   }

//   const ONE_ETH = ethers.parseEther("1");
//   const JOB_OPEN = 0n;
//   const JOB_IN_PROGRESS = 1n;
//   const JOB_SUBMITTED = 2n;
//   const JOB_COMPLETED = 3n;
//   const JOB_CANCELLED = 4n;
//   const JOB_AUTO_RELEASED = 5n;
//   const AUTO_RELEASE_TIMEOUT = 3 * 60; // seconds

//   async function advancePastAutoReleaseDeadline() {
//     await ethers.provider.send("evm_increaseTime", [AUTO_RELEASE_TIMEOUT + 1]);
//     await ethers.provider.send("evm_mine", []);
//   }

//   // ─────────────────────────────────────────────────────────────────────────
//   // Deployment
//   // ─────────────────────────────────────────────────────────────────────────
//   describe("Deployment", function () {
//     it("stores the profile contract address", async function () {
//       const { profile, escrow } = await deployEscrowFixture();
//       expect(await escrow.profileContract()).to.equal(await profile.getAddress());
//     });

//     it("initializes nextJobId to 0", async function () {
//       const { escrow } = await deployEscrowFixture();
//       expect(await escrow.nextJobId()).to.equal(0);
//     });
//   });

//   // ─────────────────────────────────────────────────────────────────────────
//   // createJob
//   // ─────────────────────────────────────────────────────────────────────────
//   describe("createJob", function () {
//     it("creates a job and increments nextJobId", async function () {
//       const { escrow, client } = await deployEscrowFixture();
//       await escrow.connect(client).createJob({ value: ONE_ETH });
//       expect(await escrow.nextJobId()).to.equal(1);
//     });

//     it("stores client address, amount and Open status", async function () {
//       const { escrow, client } = await deployEscrowFixture();
//       await escrow.connect(client).createJob({ value: ONE_ETH });

//       const job = await escrow.jobs(1);
//       expect(job.client).to.equal(client.address);
//       expect(job.amount).to.equal(ONE_ETH);
//       expect(job.status).to.equal(JOB_OPEN);
//       expect(job.developer).to.equal(ethers.ZeroAddress);
//     });

//     it("locks ETH in the contract", async function () {
//       const { escrow, client } = await deployEscrowFixture();
//       await escrow.connect(client).createJob({ value: ONE_ETH });

//       const balance = await ethers.provider.getBalance(await escrow.getAddress());
//       expect(balance).to.equal(ONE_ETH);
//     });

//     it("emits JobCreated with jobId, client, amount and milestone flag", async function () {
//       const { escrow, client } = await deployEscrowFixture();

//       await expect(
//         escrow.connect(client).createJob({ value: ONE_ETH })
//       )
//         .to.emit(escrow, "JobCreated")
//         .withArgs(1, client.address, ONE_ETH, false);
//     });

//     it("returns the new jobId", async function () {
//       const { escrow, client } = await deployEscrowFixture();
//       const jobId = await escrow.connect(client).createJob.staticCall({ value: ONE_ETH });
//       expect(jobId).to.equal(1);
//     });

//     it("reverts if no ETH is sent", async function () {
//       const { escrow, client } = await deployEscrowFixture();
//       await expect(
//         escrow.connect(client).createJob({ value: 0 })
//       ).to.be.revertedWith("No funds");
//     });

//     it("supports multiple concurrent jobs", async function () {
//       const { escrow, client } = await deployEscrowFixture();
//       await escrow.connect(client).createJob({ value: ONE_ETH });
//       await escrow.connect(client).createJob({ value: ONE_ETH });

//       expect(await escrow.nextJobId()).to.equal(2);
//     });
//   });

//   // ─────────────────────────────────────────────────────────────────────────
//   // assignDeveloper
//   // ─────────────────────────────────────────────────────────────────────────
//   describe("assignDeveloper", function () {
//     it("client can assign a developer and status becomes InProgress", async function () {
//       const { escrow, client, developer } = await deployEscrowFixture();
//       await escrow.connect(client).createJob({ value: ONE_ETH });
//       await escrow.connect(client).assignDeveloper(1, developer.address);

//       const job = await escrow.jobs(1);
//       expect(job.developer).to.equal(developer.address);
//       expect(job.status).to.equal(JOB_IN_PROGRESS);
//     });

//     it("emits JobAssigned with jobId and developer", async function () {
//       const { escrow, client, developer } = await deployEscrowFixture();
//       await escrow.connect(client).createJob({ value: ONE_ETH });

//       await expect(
//         escrow.connect(client).assignDeveloper(1, developer.address)
//       )
//         .to.emit(escrow, "JobAssigned")
//         .withArgs(1, developer.address);
//     });

//     it("reverts if caller is not the client", async function () {
//       const { escrow, client, developer, other } = await deployEscrowFixture();
//       await escrow.connect(client).createJob({ value: ONE_ETH });

//       await expect(
//         escrow.connect(other).assignDeveloper(1, developer.address)
//       ).to.be.revertedWith("Not client");
//     });

//     it("reverts if job is not Open", async function () {
//       const { escrow, client, developer } = await deployEscrowFixture();
//       await escrow.connect(client).createJob({ value: ONE_ETH });
//       await escrow.connect(client).assignDeveloper(1, developer.address);

//       // Try to re-assign after status is InProgress
//       await expect(
//         escrow.connect(client).assignDeveloper(1, developer.address)
//       ).to.be.revertedWith("Not open");
//     });
//   });

//   // ─────────────────────────────────────────────────────────────────────────
//   // submitWork
//   // ─────────────────────────────────────────────────────────────────────────
//   describe("submitWork", function () {
//     it("developer can submit work and status becomes Submitted", async function () {
//       const { escrow, client, developer } = await deployEscrowFixture();
//       await escrow.connect(client).createJob({ value: ONE_ETH });
//       await escrow.connect(client).assignDeveloper(1, developer.address);
//       await escrow.connect(developer).submitWork(1);

//       const job = await escrow.jobs(1);
//       expect(job.status).to.equal(JOB_SUBMITTED);
//     });

//     it("emits JobSubmitted with jobId and deadline", async function () {
//       const { escrow, client, developer } = await deployEscrowFixture();
//       await escrow.connect(client).createJob({ value: ONE_ETH });
//       await escrow.connect(client).assignDeveloper(1, developer.address);

//       const tx = await escrow.connect(developer).submitWork(1);
//       const receipt = await tx.wait();
//       const block = await ethers.provider.getBlock(receipt.blockNumber);
//       const expectedDeadline = block.timestamp + AUTO_RELEASE_TIMEOUT;

//       await expect(tx)
//         .to.emit(escrow, "JobSubmitted")
//         .withArgs(1, expectedDeadline);
//     });

//     it("reverts if caller is not the developer", async function () {
//       const { escrow, client, developer, other } = await deployEscrowFixture();
//       await escrow.connect(client).createJob({ value: ONE_ETH });
//       await escrow.connect(client).assignDeveloper(1, developer.address);

//       await expect(
//         escrow.connect(other).submitWork(1)
//       ).to.be.revertedWith("Not developer");
//     });

//     it("reverts if job is not InProgress", async function () {
//       const { escrow, client, developer } = await deployEscrowFixture();
//       await escrow.connect(client).createJob({ value: ONE_ETH });
//       // Not yet assigned → status is still Open

//       await expect(
//         escrow.connect(developer).submitWork(1)
//       ).to.be.revertedWith("Not developer");
//     });

//     it("reverts if developer tries to submit twice", async function () {
//       const { escrow, client, developer } = await deployEscrowFixture();
//       await escrow.connect(client).createJob({ value: ONE_ETH });
//       await escrow.connect(client).assignDeveloper(1, developer.address);
//       await escrow.connect(developer).submitWork(1);

//       await expect(
//         escrow.connect(developer).submitWork(1)
//       ).to.be.revertedWith("Invalid state");
//     });
//   });

//   // ─────────────────────────────────────────────────────────────────────────
//   // approveWork
//   // ─────────────────────────────────────────────────────────────────────────
//   describe("approveWork", function () {
//     async function setupSubmittedJob(fixture) {
//       const { escrow, client, developer } = fixture;
//       await escrow.connect(client).createJob({ value: ONE_ETH });
//       await escrow.connect(client).assignDeveloper(1, developer.address);
//       await escrow.connect(developer).submitWork(1);
//     }

//     it("status becomes Completed after approval", async function () {
//       const f = await deployEscrowFixture();
//       await setupSubmittedJob(f);
//       await f.escrow.connect(f.client).approveWork(1);

//       const job = await f.escrow.jobs(1);
//       expect(job.status).to.equal(JOB_COMPLETED);
//     });

//     it("transfers locked ETH to developer", async function () {
//       const f = await deployEscrowFixture();
//       await setupSubmittedJob(f);

//       const balanceBefore = await ethers.provider.getBalance(f.developer.address);
//       await f.escrow.connect(f.client).approveWork(1);
//       const balanceAfter = await ethers.provider.getBalance(f.developer.address);

//       // Developer received approximately ONE_ETH (minus gas if they paid any)
//       expect(balanceAfter - balanceBefore).to.be.closeTo(ONE_ETH, ethers.parseEther("0.01"));
//     });

//     it("escrow balance becomes 0 after payout", async function () {
//       const f = await deployEscrowFixture();
//       await setupSubmittedJob(f);
//       await f.escrow.connect(f.client).approveWork(1);

//       const balance = await ethers.provider.getBalance(await f.escrow.getAddress());
//       expect(balance).to.equal(0);
//     });

//     it("emits JobCompleted with jobId", async function () {
//       const f = await deployEscrowFixture();
//       await setupSubmittedJob(f);

//       await expect(f.escrow.connect(f.client).approveWork(1))
//         .to.emit(f.escrow, "JobCompleted")
//         .withArgs(1);
//     });

//     it("updates developer reputation in profile contract", async function () {
//       const f = await deployEscrowFixture();
//       await setupSubmittedJob(f);
//       await f.escrow.connect(f.client).approveWork(1);

//       const p = await f.profile.getProfile(f.developer.address);
//       expect(p.reputation).to.equal(ONE_ETH);
//       expect(p.completedJobs).to.equal(1);
//     });

//     it("reverts if caller is not the client", async function () {
//       const f = await deployEscrowFixture();
//       await setupSubmittedJob(f);

//       await expect(
//         f.escrow.connect(f.other).approveWork(1)
//       ).to.be.revertedWith("Not client");
//     });

//     it("reverts if job is not in Submitted state", async function () {
//       const f = await deployEscrowFixture();
//       await f.escrow.connect(f.client).createJob({ value: ONE_ETH });
//       await f.escrow.connect(f.client).assignDeveloper(1, f.developer.address);
//       // InProgress, not Submitted

//       await expect(
//         f.escrow.connect(f.client).approveWork(1)
//       ).to.be.revertedWith("Not submitted");
//     });

//     it("reverts if developer has no profile (reputation update guard)", async function () {
//       const f = await deployEscrowNoProfileFixture();
//       await f.escrow.connect(f.client).createJob({ value: ONE_ETH });
//       await f.escrow.connect(f.client).assignDeveloper(1, f.developer.address);
//       await f.escrow.connect(f.developer).submitWork(1);

//       // approveWork will call updateReputation which requires developer to have a profile
//       await expect(
//         f.escrow.connect(f.client).approveWork(1)
//       ).to.be.revertedWith("No profile");
//     });
//   });

//   // ─────────────────────────────────────────────────────────────────────────
//   // cancelJob
//   // ─────────────────────────────────────────────────────────────────────────
//   describe("cancelJob", function () {
//     it("client can cancel an Open job and status becomes Cancelled", async function () {
//       const { escrow, client } = await deployEscrowFixture();
//       await escrow.connect(client).createJob({ value: ONE_ETH });
//       await escrow.connect(client).cancelJob(1);

//       const job = await escrow.jobs(1);
//       expect(job.status).to.equal(JOB_CANCELLED);
//     });

//     it("refunds ETH to client on cancel", async function () {
//       const { escrow, client } = await deployEscrowFixture();

//       const balanceBefore = await ethers.provider.getBalance(client.address);
//       const tx1 = await escrow.connect(client).createJob({ value: ONE_ETH });
//       const r1 = await tx1.wait();
//       const gas1 = r1.gasUsed * r1.gasPrice;

//       const tx2 = await escrow.connect(client).cancelJob(1);
//       const r2 = await tx2.wait();
//       const gas2 = r2.gasUsed * r2.gasPrice;

//       const balanceAfter = await ethers.provider.getBalance(client.address);
//       const spent = balanceBefore - balanceAfter;
//       // Net spent should be approximately gas only (refund minus gas)
//       expect(spent).to.be.closeTo(gas1 + gas2, ethers.parseEther("0.001"));
//     });

//     it("escrow balance becomes 0 after refund", async function () {
//       const { escrow, client } = await deployEscrowFixture();
//       await escrow.connect(client).createJob({ value: ONE_ETH });
//       await escrow.connect(client).cancelJob(1);

//       const balance = await ethers.provider.getBalance(await escrow.getAddress());
//       expect(balance).to.equal(0);
//     });

//     it("reverts if caller is not the client", async function () {
//       const { escrow, client, other } = await deployEscrowFixture();
//       await escrow.connect(client).createJob({ value: ONE_ETH });

//       await expect(
//         escrow.connect(other).cancelJob(1)
//       ).to.be.revertedWith("Not client");
//     });

//     it("reverts if job is not Open (already InProgress)", async function () {
//       const { escrow, client, developer } = await deployEscrowFixture();
//       await escrow.connect(client).createJob({ value: ONE_ETH });
//       await escrow.connect(client).assignDeveloper(1, developer.address);

//       await expect(
//         escrow.connect(client).cancelJob(1)
//       ).to.be.revertedWith("Cannot cancel after assignment");
//     });

//     it("reverts if job does not exist (jobId 0)", async function () {
//       const { escrow, client } = await deployEscrowFixture();

//       await expect(
//         escrow.connect(client).cancelJob(0)
//       ).to.be.revertedWith("Not client");
//     });
//   });

//   // ─────────────────────────────────────────────────────────────────────────
//   // autoReleaseFunds
//   // ─────────────────────────────────────────────────────────────────────────
//   describe("autoReleaseFunds", function () {
//     async function setupSubmittedJob(fixture) {
//       const { escrow, client, developer } = fixture;
//       await escrow.connect(client).createJob({ value: ONE_ETH });
//       await escrow.connect(client).assignDeveloper(1, developer.address);
//       await escrow.connect(developer).submitWork(1);
//     }

//     it("developer can auto-release funds after deadline passes", async function () {
//       const f = await deployEscrowFixture();
//       await setupSubmittedJob(f);

//       await advancePastAutoReleaseDeadline();

//       // Developer calls autoReleaseFunds
//       await f.escrow.connect(f.developer).autoReleaseFunds(1);

//       const job = await f.escrow.jobs(1);
//       expect(job.status).to.equal(JOB_AUTO_RELEASED);
//     });

//     it("transfers locked ETH to developer on auto-release", async function () {
//       const f = await deployEscrowFixture();
//       await setupSubmittedJob(f);

//       await advancePastAutoReleaseDeadline();

//       const balanceBefore = await ethers.provider.getBalance(f.developer.address);
//       await f.escrow.connect(f.developer).autoReleaseFunds(1);
//       const balanceAfter = await ethers.provider.getBalance(f.developer.address);

//       // Developer received approximately ONE_ETH (minus gas)
//       expect(balanceAfter - balanceBefore).to.be.closeTo(ONE_ETH, ethers.parseEther("0.01"));
//     });

//     it("updates developer reputation after auto-release", async function () {
//       const f = await deployEscrowFixture();
//       await setupSubmittedJob(f);

//       await advancePastAutoReleaseDeadline();
//       await f.escrow.connect(f.developer).autoReleaseFunds(1);

//       const p = await f.profile.getProfile(f.developer.address);
//       expect(p.reputation).to.equal(ONE_ETH);
//       expect(p.completedJobs).to.equal(1);
//     });

//     it("escrow balance becomes 0 after auto-release", async function () {
//       const f = await deployEscrowFixture();
//       await setupSubmittedJob(f);

//       await advancePastAutoReleaseDeadline();
//       await f.escrow.connect(f.developer).autoReleaseFunds(1);

//       const balance = await ethers.provider.getBalance(await f.escrow.getAddress());
//       expect(balance).to.equal(0);
//     });

//     it("emits AutoReleased with jobId and amount", async function () {
//       const f = await deployEscrowFixture();
//       await setupSubmittedJob(f);

//       await advancePastAutoReleaseDeadline();

//       await expect(f.escrow.connect(f.developer).autoReleaseFunds(1))
//         .to.emit(f.escrow, "AutoReleased")
//         .withArgs(1, ONE_ETH);
//     });

//     it("reverts if caller is not the developer", async function () {
//       const f = await deployEscrowFixture();
//       await setupSubmittedJob(f);

//       await advancePastAutoReleaseDeadline();

//       await expect(
//         f.escrow.connect(f.other).autoReleaseFunds(1)
//       ).to.be.revertedWith("Only developer");
//     });

//     it("reverts if deadline has not been reached", async function () {
//       const f = await deployEscrowFixture();
//       await setupSubmittedJob(f);

//       // Do NOT fast-forward time; deadline should not have passed
//       await expect(
//         f.escrow.connect(f.developer).autoReleaseFunds(1)
//       ).to.be.revertedWith("Deadline not reached");
//     });

//     it("reverts if job is not in Submitted state", async function () {
//       const f = await deployEscrowFixture();
//       await f.escrow.connect(f.client).createJob({ value: ONE_ETH });
//       // Job is in Open state, not Submitted

//       await advancePastAutoReleaseDeadline();

//       await expect(
//         f.escrow.connect(f.developer).autoReleaseFunds(1)
//       ).to.be.revertedWith("Only developer");
//     });

//     it("reverts if submittedAt is 0 (work was never submitted)", async function () {
//       const f = await deployEscrowFixture();
//       await f.escrow.connect(f.client).createJob({ value: ONE_ETH });
//       await f.escrow.connect(f.client).assignDeveloper(1, f.developer.address);
//       // Do not submit work

//       await advancePastAutoReleaseDeadline();

//       await expect(
//         f.escrow.connect(f.developer).autoReleaseFunds(1)
//       ).to.be.revertedWith("Not submitted");
//     });

//     it("reverts if developer has no profile (reputation update guard)", async function () {
//       const f = await deployEscrowNoProfileFixture();
//       await f.escrow.connect(f.client).createJob({ value: ONE_ETH });
//       await f.escrow.connect(f.client).assignDeveloper(1, f.developer.address);
//       await f.escrow.connect(f.developer).submitWork(1);

//       await advancePastAutoReleaseDeadline();

//       // autoReleaseFunds will call updateReputation which requires developer to have a profile
//       await expect(
//         f.escrow.connect(f.developer).autoReleaseFunds(1)
//       ).to.be.revertedWith("No profile");
//     });
//   });
// });