const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Starter Counter", function () {
  // Fixture to deploy fresh Starter contract for each test
  async function deployStarterFixture() {
    const [owner, otherAccount] = await ethers.getSigners();
    const starter = await ethers.deployContract("Starter");

    return { starter, owner, otherAccount };
  }

  describe("Deployment", function () {
    it("initializes count to 0 and sets owner", async function () {
      const { starter, owner } = await deployStarterFixture();

      expect(await starter.count()).to.equal(0);
      expect(await starter.owner()).to.equal(owner.address);
    });
  });

  describe("Increment", function () {
    it("increments count by specified amount", async function () {
      const { starter } = await deployStarterFixture();

      await expect(starter.increment(5))
        .to.emit(starter, "CountIncremented")
        .withArgs(5, 5);

      expect(await starter.count()).to.equal(5);
    });

    it("emits CountIncremented event with correct arguments", async function () {
      const { starter } = await deployStarterFixture();

      // First increment
      await expect(starter.increment(10))
        .to.emit(starter, "CountIncremented")
        .withArgs(10, 10);

      // Second increment (total should be 15)
      await expect(starter.increment(5))
        .to.emit(starter, "CountIncremented")
        .withArgs(5, 15);

      expect(await starter.count()).to.equal(15);
    });

    it("reverts if non-owner tries to increment", async function () {
      const { starter, otherAccount } = await deployStarterFixture();

      await expect(
        starter.connect(otherAccount).increment(5)
      ).to.be.revertedWith("Only owner can increment");
    });

    it("reverts if amount is 0 or negative", async function () {
      const { starter } = await deployStarterFixture();

      await expect(starter.increment(0)).to.be.revertedWith(
        "Amount must be greater than 0"
      );
    });
  });

  describe("Reset", function () {
    it("resets count to 0", async function () {
      const { starter } = await deployStarterFixture();

      // Increment to 10
      await starter.increment(10);
      expect(await starter.count()).to.equal(10);

      // Reset to 0
      await starter.reset();
      expect(await starter.count()).to.equal(0);
    });

    it("reverts if non-owner tries to reset", async function () {
      const { starter, otherAccount } = await deployStarterFixture();

      await starter.increment(5);

      await expect(
        starter.connect(otherAccount).reset()
      ).to.be.revertedWith("Only owner can reset");
    });
  });

  describe("Count Variable", function () {
    it("returns current count via public variable", async function () {
      const { starter } = await deployStarterFixture();

      expect(await starter.count()).to.equal(0);

      await starter.increment(7);
      expect(await starter.count()).to.equal(7);

      await starter.increment(3);
      expect(await starter.count()).to.equal(10);
    });
  });
});
