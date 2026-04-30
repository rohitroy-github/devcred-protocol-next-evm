const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("DevCredProfile", function () {
  // ─────────────────────────────────────────────────────────────────────────
  // Fixture
  // ─────────────────────────────────────────────────────────────────────────
  async function deployProfileFixture() {
    const [owner, alice, bob, carol] = await ethers.getSigners();
    const profile = await ethers.deployContract("DevCredProfile");
    return { profile, owner, alice, bob, carol };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Deployment
  // ─────────────────────────────────────────────────────────────────────────
  describe("Deployment", function () {
    it("sets deployer as owner", async function () {
      const { profile, owner } = await deployProfileFixture();
      expect(await profile.owner()).to.equal(owner.address);
    });

    it("sets ERC721 name and symbol correctly", async function () {
      const { profile } = await deployProfileFixture();
      expect(await profile.name()).to.equal("DevCred Profile");
      expect(await profile.symbol()).to.equal("DCP");
    });

    it("initializes nextTokenId to 0", async function () {
      const { profile } = await deployProfileFixture();
      expect(await profile.nextTokenId()).to.equal(0);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // mintProfile
  // ─────────────────────────────────────────────────────────────────────────
  describe("mintProfile", function () {
    it("mints token with id 1 to first caller", async function () {
      const { profile, alice } = await deployProfileFixture();
      await profile.connect(alice).mintProfile();

      expect(await profile.ownerOf(1)).to.equal(alice.address);
      expect(await profile.nextTokenId()).to.equal(1);
    });

    it("maps caller address to next tokenId", async function () {
      const { profile, alice } = await deployProfileFixture();
      await profile.connect(alice).mintProfile();

      expect(await profile.addressToProfile(alice.address)).to.equal(1);
    });

    it("initializes profile with zero reputation and completedJobs", async function () {
      const { profile, alice } = await deployProfileFixture();
      await profile.connect(alice).mintProfile();

      const p = await profile.getProfile(alice.address);
      expect(p.reputation).to.equal(0);
      expect(p.completedJobs).to.equal(0);
    });

    it("increments nextTokenId for each new mint", async function () {
      const { profile, alice, bob } = await deployProfileFixture();
      await profile.connect(alice).mintProfile();
      await profile.connect(bob).mintProfile();

      expect(await profile.nextTokenId()).to.equal(2);
      expect(await profile.addressToProfile(bob.address)).to.equal(2);
    });

    it("emits ProfileMinted event with correct user and tokenId", async function () {
      const { profile, alice } = await deployProfileFixture();

      await expect(profile.connect(alice).mintProfile())
        .to.emit(profile, "ProfileMinted")
        .withArgs(alice.address, 1);
    });

    it("reverts if caller already has a profile", async function () {
      const { profile, alice } = await deployProfileFixture();
      await profile.connect(alice).mintProfile();

      await expect(
        profile.connect(alice).mintProfile()
      ).to.be.revertedWith("Profile exists");
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // updateReputation
  // ─────────────────────────────────────────────────────────────────────────
  describe("updateReputation", function () {
    it("owner can update reputation and completedJobs", async function () {
      const { profile, owner, alice } = await deployProfileFixture();
      await profile.connect(alice).mintProfile();

      await profile.connect(owner).updateReputation(alice.address, 100, 1);

      const p = await profile.getProfile(alice.address);
      expect(p.reputation).to.equal(100);
      expect(p.completedJobs).to.equal(1);
    });

    it("accumulates reputation and completedJobs across multiple updates", async function () {
      const { profile, owner, alice } = await deployProfileFixture();
      await profile.connect(alice).mintProfile();

      await profile.connect(owner).updateReputation(alice.address, 50, 1);
      await profile.connect(owner).updateReputation(alice.address, 75, 2);

      const p = await profile.getProfile(alice.address);
      expect(p.reputation).to.equal(125);
      expect(p.completedJobs).to.equal(3);
    });

    it("emits ReputationUpdated event with correct arguments", async function () {
      const { profile, owner, alice } = await deployProfileFixture();
      await profile.connect(alice).mintProfile();

      await expect(
        profile.connect(owner).updateReputation(alice.address, 200, 3)
      )
        .to.emit(profile, "ReputationUpdated")
        .withArgs(alice.address, 1, 200, 3);
    });

    it("reverts if caller is not owner", async function () {
      const { profile, alice, bob } = await deployProfileFixture();
      await profile.connect(alice).mintProfile();

      await expect(
        profile.connect(bob).updateReputation(alice.address, 100, 1)
      ).to.be.revertedWithCustomError(profile, "OwnableUnauthorizedAccount");
    });

    it("reverts if user has no minted profile", async function () {
      const { profile, owner, alice } = await deployProfileFixture();

      await expect(
        profile.connect(owner).updateReputation(alice.address, 100, 1)
      ).to.be.revertedWith("No profile");
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // getProfile
  // ─────────────────────────────────────────────────────────────────────────
  describe("getProfile", function () {
    it("returns correct profile data after mint", async function () {
      const { profile, alice } = await deployProfileFixture();
      await profile.connect(alice).mintProfile();

      const p = await profile.getProfile(alice.address);
      expect(p.reputation).to.equal(0);
      expect(p.completedJobs).to.equal(0);
    });

    it("returns updated data after reputation update", async function () {
      const { profile, owner, alice } = await deployProfileFixture();
      await profile.connect(alice).mintProfile();
      await profile.connect(owner).updateReputation(alice.address, 500, 5);

      const p = await profile.getProfile(alice.address);
      expect(p.reputation).to.equal(500);
      expect(p.completedJobs).to.equal(5);
    });

    it("reverts if address has no profile", async function () {
      const { profile, alice } = await deployProfileFixture();

      await expect(
        profile.getProfile(alice.address)
      ).to.be.revertedWith("No profile");
    });

    it("returns independent data for each user", async function () {
      const { profile, owner, alice, bob } = await deployProfileFixture();
      await profile.connect(alice).mintProfile();
      await profile.connect(bob).mintProfile();

      await profile.connect(owner).updateReputation(alice.address, 300, 3);

      const pa = await profile.getProfile(alice.address);
      const pb = await profile.getProfile(bob.address);
      expect(pa.reputation).to.equal(300);
      expect(pb.reputation).to.equal(0);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Ownership
  // ─────────────────────────────────────────────────────────────────────────
  describe("Ownership", function () {
    it("owner can transfer ownership", async function () {
      const { profile, owner, alice } = await deployProfileFixture();
      await profile.connect(owner).transferOwnership(alice.address);
      expect(await profile.owner()).to.equal(alice.address);
    });

    it("new owner can call updateReputation after transfer", async function () {
      const { profile, owner, alice, bob } = await deployProfileFixture();
      await profile.connect(bob).mintProfile();
      await profile.connect(owner).transferOwnership(alice.address);

      await profile.connect(alice).updateReputation(bob.address, 100, 1);

      const p = await profile.getProfile(bob.address);
      expect(p.reputation).to.equal(100);
    });

    it("old owner cannot call updateReputation after transfer", async function () {
      const { profile, owner, alice, bob } = await deployProfileFixture();
      await profile.connect(bob).mintProfile();
      await profile.connect(owner).transferOwnership(alice.address);

      await expect(
        profile.connect(owner).updateReputation(bob.address, 100, 1)
      ).to.be.revertedWithCustomError(profile, "OwnableUnauthorizedAccount");
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // ERC721 behaviour
  // ─────────────────────────────────────────────────────────────────────────
  describe("ERC721 behaviour", function () {
    it("balanceOf returns 1 after mint", async function () {
      const { profile, alice } = await deployProfileFixture();
      await profile.connect(alice).mintProfile();
      expect(await profile.balanceOf(alice.address)).to.equal(1);
    });

    it("ownerOf returns correct owner", async function () {
      const { profile, alice } = await deployProfileFixture();
      await profile.connect(alice).mintProfile();
      expect(await profile.ownerOf(1)).to.equal(alice.address);
    });
  });
});