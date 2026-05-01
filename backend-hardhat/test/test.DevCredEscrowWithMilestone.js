const { expect } = require("chai");
const { ethers } = require("hardhat");

/*
Developer Testing Workflow (Milestone Escrow)

Test Type: Integration Test Suite

This suite validates only milestone-based escrow behavior:
  1. Deployment/Wiring
	  - Escrow links to Profile contract
	  - Core constants (MAX_MILESTONES, counters) are correct

  2. Milestone Job Creation
	  - createJobWithMilestones stores expected metadata
	  - Milestones are initialized correctly
	  - Funding amount exactly matches milestone sum

  3. Milestone Lifecycle
	  - Assign -> Submit -> Approve/Reject per milestone
	  - Proper progression of currentMilestoneIndex
	  - Final milestone completes job and updates completedJobs

  4. Timeout and Recovery Paths
	  - autoReleaseMilestone after deadline
	  - Rejection/resubmission flow
	  - Access control and invalid state guards

  5. View/Read APIs and Integration Flows
	  - getMilestone/getJobMilestones/getMilestoneCount correctness
	  - End-to-end multi-milestone scenarios (approve, reject, mixed auto-release)

Single-payment (non-milestone) behavior is intentionally excluded here and
covered in test.DevCredEscrowWithoutMilestone.js.
*/

describe("DevCredEscrowWithMilestoneFeature", function () {
	async function deployMilestoneEscrowFixture() {
		const [owner, client, developer, other] = await ethers.getSigners();

		const profile = await ethers.deployContract("DevCredProfile");
		const EscrowFactory = await ethers.getContractFactory(
			"contracts/DevCredEscrow.sol:DevCredEscrow",
		);
		const escrow = await EscrowFactory.deploy(await profile.getAddress());
		await escrow.waitForDeployment();

		await profile.connect(owner).transferOwnership(await escrow.getAddress());
		await profile.connect(developer).mintProfile();

		return { profile, escrow, owner, client, developer, other };
	}

	async function deployMilestoneEscrowNoProfileFixture() {
		const [owner, client, developer, other] = await ethers.getSigners();

		const profile = await ethers.deployContract("DevCredProfile");
		const EscrowFactory = await ethers.getContractFactory(
			"contracts/DevCredEscrow.sol:DevCredEscrow",
		);
		const escrow = await EscrowFactory.deploy(await profile.getAddress());
		await escrow.waitForDeployment();

		await profile.connect(owner).transferOwnership(await escrow.getAddress());

		return { profile, escrow, owner, client, developer, other };
	}

	const ONE_ETH = ethers.parseEther("1");
	const HALF_ETH = ethers.parseEther("0.5");
	const QUARTER_ETH = ethers.parseEther("0.25");

	const JOB_OPEN = 0n;
	const JOB_IN_PROGRESS = 1n;
	const JOB_COMPLETED = 3n;

	const MILESTONE_PENDING = 0n;
	const MILESTONE_SUBMITTED = 1n;
	const MILESTONE_APPROVED = 2n;

	const AUTO_RELEASE_TIMEOUT = 3 * 60;

	async function advancePastAutoReleaseDeadline() {
		await ethers.provider.send("evm_increaseTime", [AUTO_RELEASE_TIMEOUT + 1]);
		await ethers.provider.send("evm_mine", []);
	}

	async function createMilestoneJob(fixture, milestoneAmounts) {
		const totalAmount = milestoneAmounts.reduce((sum, amount) => sum + amount, 0n);
		await fixture.escrow.connect(fixture.client).createJobWithMilestones(milestoneAmounts, {
			value: totalAmount,
		});
	}

	async function assignMilestoneJob(fixture, milestoneAmounts) {
		await createMilestoneJob(fixture, milestoneAmounts);
		await fixture.escrow.connect(fixture.client).assignDeveloper(1, fixture.developer.address);
	}

	async function submitFirstMilestone(fixture, milestoneAmounts) {
		await assignMilestoneJob(fixture, milestoneAmounts);
		await fixture.escrow.connect(fixture.developer).submitMilestone(1);
	}

	describe("Deployment", function () {
		it("stores the profile contract address", async function () {
			const { profile, escrow } = await deployMilestoneEscrowFixture();
			expect(await escrow.profileContract()).to.equal(await profile.getAddress());
		});

		it("initializes nextJobId to 0", async function () {
			const { escrow } = await deployMilestoneEscrowFixture();
			expect(await escrow.nextJobId()).to.equal(0);
		});

		it("sets MAX_MILESTONES to 3", async function () {
			const { escrow } = await deployMilestoneEscrowFixture();
			expect(await escrow.MAX_MILESTONES()).to.equal(3);
		});
	});

	describe("createJobWithMilestones", function () {
		it("creates a milestone job and increments nextJobId", async function () {
			const f = await deployMilestoneEscrowFixture();
			await createMilestoneJob(f, [ONE_ETH, HALF_ETH]);

			expect(await f.escrow.nextJobId()).to.equal(1);
		});

		it("stores milestone job metadata correctly", async function () {
			const f = await deployMilestoneEscrowFixture();
			await createMilestoneJob(f, [ONE_ETH, HALF_ETH]);

			const job = await f.escrow.jobs(1);
			expect(job.client).to.equal(f.client.address);
			expect(job.developer).to.equal(ethers.ZeroAddress);
			expect(job.amount).to.equal(ONE_ETH + HALF_ETH);
			expect(job.status).to.equal(JOB_OPEN);
			expect(job.currentMilestoneIndex).to.equal(0);
			expect(job.isMilestoneJob).to.equal(true);
		});

		it("creates milestones with pending status and zero submittedAt", async function () {
			const f = await deployMilestoneEscrowFixture();
			const milestoneAmounts = [ONE_ETH, HALF_ETH, QUARTER_ETH];
			await createMilestoneJob(f, milestoneAmounts);

			for (let milestoneIndex = 0; milestoneIndex < milestoneAmounts.length; milestoneIndex += 1) {
				const [amount, status, submittedAt] = await f.escrow.getMilestone(1, milestoneIndex);
				expect(amount).to.equal(milestoneAmounts[milestoneIndex]);
				expect(status).to.equal(MILESTONE_PENDING);
				expect(submittedAt).to.equal(0);
			}
		});

		it("locks the total milestone amount in escrow", async function () {
			const f = await deployMilestoneEscrowFixture();
			await createMilestoneJob(f, [ONE_ETH, HALF_ETH, QUARTER_ETH]);

			const balance = await ethers.provider.getBalance(await f.escrow.getAddress());
			expect(balance).to.equal(ONE_ETH + HALF_ETH + QUARTER_ETH);
		});

		it("emits JobCreated with milestone flag true", async function () {
			const f = await deployMilestoneEscrowFixture();

			await expect(
				f.escrow.connect(f.client).createJobWithMilestones([ONE_ETH, HALF_ETH], {
					value: ONE_ETH + HALF_ETH,
				}),
			)
				.to.emit(f.escrow, "JobCreated")
				.withArgs(1, f.client.address, ONE_ETH + HALF_ETH, true);
		});

		it("returns the new jobId", async function () {
			const f = await deployMilestoneEscrowFixture();
			const jobId = await f.escrow.connect(f.client).createJobWithMilestones.staticCall(
				[ONE_ETH],
				{ value: ONE_ETH },
			);

			expect(jobId).to.equal(1);
		});

		it("reverts when milestone array is empty", async function () {
			const f = await deployMilestoneEscrowFixture();

			await expect(
				f.escrow.connect(f.client).createJobWithMilestones([], { value: 0 }),
			).to.be.revertedWith("At least one milestone required");
		});

		it("reverts when milestone count exceeds limit", async function () {
			const f = await deployMilestoneEscrowFixture();

			await expect(
				f.escrow.connect(f.client).createJobWithMilestones(
					[ONE_ETH, HALF_ETH, QUARTER_ETH, QUARTER_ETH],
					{ value: ONE_ETH + HALF_ETH + QUARTER_ETH + QUARTER_ETH },
				),
			).to.be.revertedWith("Too many milestones");
		});

		it("reverts when any milestone amount is zero", async function () {
			const f = await deployMilestoneEscrowFixture();

			await expect(
				f.escrow.connect(f.client).createJobWithMilestones([ONE_ETH, 0], {
					value: ONE_ETH,
				}),
			).to.be.revertedWith("Milestone amount must be > 0");
		});

		it("reverts when total ETH does not match milestone sum", async function () {
			const f = await deployMilestoneEscrowFixture();

			await expect(
				f.escrow.connect(f.client).createJobWithMilestones([ONE_ETH, HALF_ETH], {
					value: ONE_ETH,
				}),
			).to.be.revertedWith("Total payment must match milestone amounts");
		});

		it("supports the maximum of three milestones", async function () {
			const f = await deployMilestoneEscrowFixture();
			await createMilestoneJob(f, [ONE_ETH, HALF_ETH, QUARTER_ETH]);

			expect(await f.escrow.getMilestoneCount(1)).to.equal(3);
		});
	});

	describe("assignDeveloper on milestone jobs", function () {
		it("assigns developer and moves job to InProgress", async function () {
			const f = await deployMilestoneEscrowFixture();
			await createMilestoneJob(f, [ONE_ETH, HALF_ETH]);

			await f.escrow.connect(f.client).assignDeveloper(1, f.developer.address);

			const job = await f.escrow.jobs(1);
			expect(job.developer).to.equal(f.developer.address);
			expect(job.status).to.equal(JOB_IN_PROGRESS);
		});

		it("emits JobAssigned", async function () {
			const f = await deployMilestoneEscrowFixture();
			await createMilestoneJob(f, [ONE_ETH]);

			await expect(f.escrow.connect(f.client).assignDeveloper(1, f.developer.address))
				.to.emit(f.escrow, "JobAssigned")
				.withArgs(1, f.developer.address);
		});
	});

	describe("submitMilestone", function () {
		it("developer can submit current milestone", async function () {
			const f = await deployMilestoneEscrowFixture();
			await assignMilestoneJob(f, [ONE_ETH, HALF_ETH]);

			await f.escrow.connect(f.developer).submitMilestone(1);

			const [, status] = await f.escrow.getMilestone(1, 0);
			expect(status).to.equal(MILESTONE_SUBMITTED);
		});

		it("stores submittedAt for the current milestone", async function () {
			const f = await deployMilestoneEscrowFixture();
			await assignMilestoneJob(f, [ONE_ETH]);

			await f.escrow.connect(f.developer).submitMilestone(1);
			const [, , submittedAt] = await f.escrow.getMilestone(1, 0);

			expect(submittedAt).to.be.greaterThan(0);
		});

		it("emits MilestoneSubmitted with deadline", async function () {
			const f = await deployMilestoneEscrowFixture();
			await assignMilestoneJob(f, [ONE_ETH]);

			const tx = await f.escrow.connect(f.developer).submitMilestone(1);
			const receipt = await tx.wait();
			const block = await ethers.provider.getBlock(receipt.blockNumber);
			const expectedDeadline = block.timestamp + AUTO_RELEASE_TIMEOUT;

			await expect(tx)
				.to.emit(f.escrow, "MilestoneSubmitted")
				.withArgs(1, 0, expectedDeadline);
		});

		it("reverts when caller is not developer", async function () {
			const f = await deployMilestoneEscrowFixture();
			await assignMilestoneJob(f, [ONE_ETH]);

			await expect(f.escrow.connect(f.other).submitMilestone(1)).to.be.revertedWith(
				"Not developer",
			);
		});

		it("reverts when job is not a milestone job", async function () {
			const f = await deployMilestoneEscrowFixture();
			await f.escrow.connect(f.client).createJob({ value: ONE_ETH });
			await f.escrow.connect(f.client).assignDeveloper(1, f.developer.address);

			await expect(f.escrow.connect(f.developer).submitMilestone(1)).to.be.revertedWith(
				"Not a milestone job",
			);
		});

		it("reverts when milestone job is not assigned yet", async function () {
			const f = await deployMilestoneEscrowFixture();
			await createMilestoneJob(f, [ONE_ETH]);

			await expect(f.escrow.connect(f.developer).submitMilestone(1)).to.be.revertedWith(
				"Not developer",
			);
		});

		it("reverts when current milestone is already submitted", async function () {
			const f = await deployMilestoneEscrowFixture();
			await submitFirstMilestone(f, [ONE_ETH, HALF_ETH]);

			await expect(f.escrow.connect(f.developer).submitMilestone(1)).to.be.revertedWith(
				"Milestone not pending",
			);
		});
	});

	describe("approveMilestone", function () {
		it("client can approve a submitted milestone", async function () {
			const f = await deployMilestoneEscrowFixture();
			await submitFirstMilestone(f, [ONE_ETH, HALF_ETH]);

			await f.escrow.connect(f.client).approveMilestone(1);

			const [, status] = await f.escrow.getMilestone(1, 0);
			expect(status).to.equal(MILESTONE_APPROVED);
		});

		it("transfers only current milestone amount to developer", async function () {
			const f = await deployMilestoneEscrowFixture();
			await submitFirstMilestone(f, [ONE_ETH, HALF_ETH]);

			const balanceBefore = await ethers.provider.getBalance(f.developer.address);
			await f.escrow.connect(f.client).approveMilestone(1);
			const balanceAfter = await ethers.provider.getBalance(f.developer.address);

			expect(balanceAfter - balanceBefore).to.be.closeTo(ONE_ETH, ethers.parseEther("0.01"));
		});

		it("updates reputation by milestone amount", async function () {
			const f = await deployMilestoneEscrowFixture();
			await submitFirstMilestone(f, [ONE_ETH, HALF_ETH]);

			await f.escrow.connect(f.client).approveMilestone(1);

			const profile = await f.profile.getProfile(f.developer.address);
			expect(profile.reputation).to.equal(ONE_ETH);
			expect(profile.completedJobs).to.equal(0);
		});

		it("advances to next milestone when more milestones remain", async function () {
			const f = await deployMilestoneEscrowFixture();
			await submitFirstMilestone(f, [ONE_ETH, HALF_ETH]);

			await f.escrow.connect(f.client).approveMilestone(1);

			const job = await f.escrow.jobs(1);
			expect(job.currentMilestoneIndex).to.equal(1);
			expect(job.status).to.equal(JOB_IN_PROGRESS);
		});

		it("completes the job after final milestone approval", async function () {
			const f = await deployMilestoneEscrowFixture();
			await submitFirstMilestone(f, [ONE_ETH]);

			await f.escrow.connect(f.client).approveMilestone(1);

			const job = await f.escrow.jobs(1);
			expect(job.status).to.equal(JOB_COMPLETED);
		});

		it("increments completedJobs only after final milestone approval", async function () {
			const f = await deployMilestoneEscrowFixture();
			await submitFirstMilestone(f, [ONE_ETH]);

			await f.escrow.connect(f.client).approveMilestone(1);

			const profile = await f.profile.getProfile(f.developer.address);
			expect(profile.completedJobs).to.equal(1);
			expect(profile.reputation).to.equal(ONE_ETH);
		});

		it("emits milestone and completion events on final approval", async function () {
			const f = await deployMilestoneEscrowFixture();
			await submitFirstMilestone(f, [ONE_ETH]);

			await expect(f.escrow.connect(f.client).approveMilestone(1))
				.to.emit(f.escrow, "MilestoneApproved")
				.withArgs(1, 0, ONE_ETH)
				.to.emit(f.escrow, "AllMilestonesCompleted")
				.withArgs(1)
				.to.emit(f.escrow, "JobCompleted")
				.withArgs(1);
		});

		it("reverts when caller is not client", async function () {
			const f = await deployMilestoneEscrowFixture();
			await submitFirstMilestone(f, [ONE_ETH]);

			await expect(f.escrow.connect(f.other).approveMilestone(1)).to.be.revertedWith(
				"Not client",
			);
		});

		it("reverts when milestone is not submitted", async function () {
			const f = await deployMilestoneEscrowFixture();
			await assignMilestoneJob(f, [ONE_ETH]);

			await expect(f.escrow.connect(f.client).approveMilestone(1)).to.be.revertedWith(
				"Milestone not submitted",
			);
		});

		it("reverts when developer has no profile", async function () {
			const f = await deployMilestoneEscrowNoProfileFixture();
			await createMilestoneJob(f, [ONE_ETH]);
			await f.escrow.connect(f.client).assignDeveloper(1, f.developer.address);
			await f.escrow.connect(f.developer).submitMilestone(1);

			await expect(f.escrow.connect(f.client).approveMilestone(1)).to.be.revertedWith(
				"No profile",
			);
		});

		it("accumulates reputation across multiple approved milestones", async function () {
			const f = await deployMilestoneEscrowFixture();
			await submitFirstMilestone(f, [ONE_ETH, HALF_ETH]);
			await f.escrow.connect(f.client).approveMilestone(1);

			await f.escrow.connect(f.developer).submitMilestone(1);
			await f.escrow.connect(f.client).approveMilestone(1);

			const profile = await f.profile.getProfile(f.developer.address);
			expect(profile.reputation).to.equal(ONE_ETH + HALF_ETH);
			expect(profile.completedJobs).to.equal(1);
		});
	});

	describe("rejectMilestone", function () {
		it("client can reject a submitted milestone", async function () {
			const f = await deployMilestoneEscrowFixture();
			await submitFirstMilestone(f, [ONE_ETH, HALF_ETH]);

			await f.escrow.connect(f.client).rejectMilestone(1);

			const [, status, submittedAt] = await f.escrow.getMilestone(1, 0);
			expect(status).to.equal(MILESTONE_PENDING);
			expect(submittedAt).to.equal(0);
		});

		it("emits MilestoneRejected", async function () {
			const f = await deployMilestoneEscrowFixture();
			await submitFirstMilestone(f, [ONE_ETH]);

			await expect(f.escrow.connect(f.client).rejectMilestone(1))
				.to.emit(f.escrow, "MilestoneRejected")
				.withArgs(1, 0);
		});

		it("allows developer to resubmit after rejection", async function () {
			const f = await deployMilestoneEscrowFixture();
			await submitFirstMilestone(f, [ONE_ETH]);
			await f.escrow.connect(f.client).rejectMilestone(1);

			await f.escrow.connect(f.developer).submitMilestone(1);

			const [, status] = await f.escrow.getMilestone(1, 0);
			expect(status).to.equal(MILESTONE_SUBMITTED);
		});

		it("does not pay developer on rejection", async function () {
			const f = await deployMilestoneEscrowFixture();
			await submitFirstMilestone(f, [ONE_ETH]);

			const balanceBefore = await ethers.provider.getBalance(f.developer.address);
			await f.escrow.connect(f.client).rejectMilestone(1);
			const balanceAfter = await ethers.provider.getBalance(f.developer.address);

			expect(balanceAfter).to.equal(balanceBefore);
		});

		it("reverts when caller is not client", async function () {
			const f = await deployMilestoneEscrowFixture();
			await submitFirstMilestone(f, [ONE_ETH]);

			await expect(f.escrow.connect(f.other).rejectMilestone(1)).to.be.revertedWith(
				"Not client",
			);
		});

		it("reverts when milestone is not submitted", async function () {
			const f = await deployMilestoneEscrowFixture();
			await assignMilestoneJob(f, [ONE_ETH]);

			await expect(f.escrow.connect(f.client).rejectMilestone(1)).to.be.revertedWith(
				"Milestone not submitted",
			);
		});
	});

	describe("autoReleaseMilestone", function () {
		it("developer can auto-release after deadline", async function () {
			const f = await deployMilestoneEscrowFixture();
			await submitFirstMilestone(f, [ONE_ETH, HALF_ETH]);
			await advancePastAutoReleaseDeadline();

			await f.escrow.connect(f.developer).autoReleaseMilestone(1);

			const [, status] = await f.escrow.getMilestone(1, 0);
			expect(status).to.equal(MILESTONE_APPROVED);
		});

		it("pays developer current milestone amount on auto-release", async function () {
			const f = await deployMilestoneEscrowFixture();
			await submitFirstMilestone(f, [ONE_ETH, HALF_ETH]);
			await advancePastAutoReleaseDeadline();

			const balanceBefore = await ethers.provider.getBalance(f.developer.address);
			await f.escrow.connect(f.developer).autoReleaseMilestone(1);
			const balanceAfter = await ethers.provider.getBalance(f.developer.address);

			expect(balanceAfter - balanceBefore).to.be.closeTo(ONE_ETH, ethers.parseEther("0.01"));
		});

		it("advances to next milestone on non-final auto-release", async function () {
			const f = await deployMilestoneEscrowFixture();
			await submitFirstMilestone(f, [ONE_ETH, HALF_ETH]);
			await advancePastAutoReleaseDeadline();

			await f.escrow.connect(f.developer).autoReleaseMilestone(1);

			const job = await f.escrow.jobs(1);
			expect(job.currentMilestoneIndex).to.equal(1);
			expect(job.status).to.equal(JOB_IN_PROGRESS);
		});

		it("completes job on final milestone auto-release", async function () {
			const f = await deployMilestoneEscrowFixture();
			await submitFirstMilestone(f, [ONE_ETH]);
			await advancePastAutoReleaseDeadline();

			await f.escrow.connect(f.developer).autoReleaseMilestone(1);

			const job = await f.escrow.jobs(1);
			expect(job.status).to.equal(JOB_COMPLETED);
		});

		it("increments completedJobs on final auto-release", async function () {
			const f = await deployMilestoneEscrowFixture();
			await submitFirstMilestone(f, [ONE_ETH]);
			await advancePastAutoReleaseDeadline();

			await f.escrow.connect(f.developer).autoReleaseMilestone(1);

			const profile = await f.profile.getProfile(f.developer.address);
			expect(profile.completedJobs).to.equal(1);
			expect(profile.reputation).to.equal(ONE_ETH);
		});

		it("emits MilestoneAutoReleased", async function () {
			const f = await deployMilestoneEscrowFixture();
			await submitFirstMilestone(f, [ONE_ETH]);
			await advancePastAutoReleaseDeadline();

			await expect(f.escrow.connect(f.developer).autoReleaseMilestone(1))
				.to.emit(f.escrow, "MilestoneAutoReleased")
				.withArgs(1, 0, ONE_ETH);
		});

		it("reverts when caller is not developer", async function () {
			const f = await deployMilestoneEscrowFixture();
			await submitFirstMilestone(f, [ONE_ETH]);
			await advancePastAutoReleaseDeadline();

			await expect(f.escrow.connect(f.other).autoReleaseMilestone(1)).to.be.revertedWith(
				"Only developer",
			);
		});

		it("reverts before deadline", async function () {
			const f = await deployMilestoneEscrowFixture();
			await submitFirstMilestone(f, [ONE_ETH]);

			await expect(f.escrow.connect(f.developer).autoReleaseMilestone(1)).to.be.revertedWith(
				"Deadline not reached",
			);
		});

		it("reverts when milestone is not submitted", async function () {
			const f = await deployMilestoneEscrowFixture();
			await assignMilestoneJob(f, [ONE_ETH]);
			await advancePastAutoReleaseDeadline();

			await expect(f.escrow.connect(f.developer).autoReleaseMilestone(1)).to.be.revertedWith(
				"Milestone not submitted",
			);
		});

		it("reverts when developer has no profile", async function () {
			const f = await deployMilestoneEscrowNoProfileFixture();
			await createMilestoneJob(f, [ONE_ETH]);
			await f.escrow.connect(f.client).assignDeveloper(1, f.developer.address);
			await f.escrow.connect(f.developer).submitMilestone(1);
			await advancePastAutoReleaseDeadline();

			await expect(f.escrow.connect(f.developer).autoReleaseMilestone(1)).to.be.revertedWith(
				"No profile",
			);
		});
	});

	describe("View functions", function () {
		it("getMilestone returns milestone details", async function () {
			const f = await deployMilestoneEscrowFixture();
			await createMilestoneJob(f, [ONE_ETH, HALF_ETH]);

			const [amount, status, submittedAt] = await f.escrow.getMilestone(1, 1);
			expect(amount).to.equal(HALF_ETH);
			expect(status).to.equal(MILESTONE_PENDING);
			expect(submittedAt).to.equal(0);
		});

		it("getJobMilestones returns all milestones", async function () {
			const f = await deployMilestoneEscrowFixture();
			await createMilestoneJob(f, [ONE_ETH, HALF_ETH, QUARTER_ETH]);

			const milestones = await f.escrow.getJobMilestones(1);
			expect(milestones.length).to.equal(3);
			expect(milestones[0].amount).to.equal(ONE_ETH);
			expect(milestones[1].amount).to.equal(HALF_ETH);
			expect(milestones[2].amount).to.equal(QUARTER_ETH);
		});

		it("getMilestoneCount returns milestone count", async function () {
			const f = await deployMilestoneEscrowFixture();
			await createMilestoneJob(f, [ONE_ETH, HALF_ETH]);

			expect(await f.escrow.getMilestoneCount(1)).to.equal(2);
		});

		it("reverts getMilestone with invalid index", async function () {
			const f = await deployMilestoneEscrowFixture();
			await createMilestoneJob(f, [ONE_ETH]);

			await expect(f.escrow.getMilestone(1, 4)).to.be.revertedWith("Invalid milestone index");
		});
	});

	describe("Integration flows", function () {
		it("supports complete three-milestone approval workflow", async function () {
			const f = await deployMilestoneEscrowFixture();
			await assignMilestoneJob(f, [ONE_ETH, HALF_ETH, QUARTER_ETH]);

			await f.escrow.connect(f.developer).submitMilestone(1);
			await f.escrow.connect(f.client).approveMilestone(1);

			await f.escrow.connect(f.developer).submitMilestone(1);
			await f.escrow.connect(f.client).approveMilestone(1);

			await f.escrow.connect(f.developer).submitMilestone(1);
			await f.escrow.connect(f.client).approveMilestone(1);

			const job = await f.escrow.jobs(1);
			const profile = await f.profile.getProfile(f.developer.address);

			expect(job.status).to.equal(JOB_COMPLETED);
			expect(profile.reputation).to.equal(ONE_ETH + HALF_ETH + QUARTER_ETH);
			expect(profile.completedJobs).to.equal(1);
		});

		it("supports rejection then resubmission workflow", async function () {
			const f = await deployMilestoneEscrowFixture();
			await assignMilestoneJob(f, [ONE_ETH, HALF_ETH]);

			await f.escrow.connect(f.developer).submitMilestone(1);
			await f.escrow.connect(f.client).rejectMilestone(1);
			await f.escrow.connect(f.developer).submitMilestone(1);
			await f.escrow.connect(f.client).approveMilestone(1);

			await f.escrow.connect(f.developer).submitMilestone(1);
			await f.escrow.connect(f.client).approveMilestone(1);

			expect((await f.escrow.jobs(1)).status).to.equal(JOB_COMPLETED);
		});

		it("supports mixed approval and auto-release workflow", async function () {
			const f = await deployMilestoneEscrowFixture();
			await assignMilestoneJob(f, [ONE_ETH, HALF_ETH, QUARTER_ETH]);

			await f.escrow.connect(f.developer).submitMilestone(1);
			await f.escrow.connect(f.client).approveMilestone(1);

			await f.escrow.connect(f.developer).submitMilestone(1);
			await advancePastAutoReleaseDeadline();
			await f.escrow.connect(f.developer).autoReleaseMilestone(1);

			await f.escrow.connect(f.developer).submitMilestone(1);
			await f.escrow.connect(f.client).approveMilestone(1);

			const profile = await f.profile.getProfile(f.developer.address);
			expect((await f.escrow.jobs(1)).status).to.equal(JOB_COMPLETED);
			expect(profile.reputation).to.equal(ONE_ETH + HALF_ETH + QUARTER_ETH);
			expect(profile.completedJobs).to.equal(1);
		});

		it("retains remaining escrow after partial milestone payout", async function () {
			const f = await deployMilestoneEscrowFixture();
			await submitFirstMilestone(f, [ONE_ETH, HALF_ETH]);

			await f.escrow.connect(f.client).approveMilestone(1);

			const balance = await ethers.provider.getBalance(await f.escrow.getAddress());
			expect(balance).to.equal(HALF_ETH);
		});
	});
});
