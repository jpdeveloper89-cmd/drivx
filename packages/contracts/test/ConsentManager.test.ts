import { expect } from "chai";
import { ethers } from "hardhat";
import { ConsentManager } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("ConsentManager", function () {
  let consentManager: ConsentManager;
  let owner: HardhatEthersSigner;
  let driver1: HardhatEthersSigner;
  let driver2: HardhatEthersSigner;

  const PARTY_A = ethers.keccak256(ethers.toUtf8Bytes("InsurerA"));
  const PARTY_B = ethers.keccak256(ethers.toUtf8Bytes("BusinessB"));
  const ZERO_PARTY = ethers.ZeroHash;

  // Data category bitmasks
  const SCORE = 0x01;
  const TRIPS = 0x02;
  const DELIVERY = 0x04;
  const INSURANCE = 0x08;
  const ALL_CATEGORIES = 0x0f;

  // Durations
  const ONE_DAY = 86400;
  const THIRTY_DAYS = 30 * ONE_DAY;
  const TWELVE_MONTHS = 365 * ONE_DAY;

  beforeEach(async function () {
    [owner, driver1, driver2] = await ethers.getSigners();
    const ConsentManagerFactory = await ethers.getContractFactory("ConsentManager");
    consentManager = await ConsentManagerFactory.deploy();
    await consentManager.waitForDeployment();
  });

  describe("grantConsent", function () {
    it("should grant consent with valid parameters", async function () {
      await expect(
        consentManager.connect(driver1).grantConsent(PARTY_A, SCORE, THIRTY_DAYS)
      )
        .to.emit(consentManager, "ConsentGranted")
        .withArgs(driver1.address, PARTY_A, SCORE, (await time.latest()) + THIRTY_DAYS + 1);
    });

    it("should grant consent with multiple data categories", async function () {
      const categories = SCORE | TRIPS | INSURANCE; // 0x0B
      await consentManager.connect(driver1).grantConsent(PARTY_A, categories, THIRTY_DAYS);

      const grants = await consentManager.getActiveGrants(driver1.address);
      expect(grants.length).to.equal(1);
      expect(grants[0].dataCategories).to.equal(categories);
    });

    it("should enforce maximum 12-month duration cap", async function () {
      const overMax = TWELVE_MONTHS + 1;
      await expect(
        consentManager.connect(driver1).grantConsent(PARTY_A, SCORE, overMax)
      ).to.be.revertedWith("ConsentManager: duration exceeds 12-month cap");
    });

    it("should allow exactly 12-month duration", async function () {
      await expect(
        consentManager.connect(driver1).grantConsent(PARTY_A, SCORE, TWELVE_MONTHS)
      ).to.not.be.reverted;
    });

    it("should reject zero party", async function () {
      await expect(
        consentManager.connect(driver1).grantConsent(ZERO_PARTY, SCORE, THIRTY_DAYS)
      ).to.be.revertedWith("ConsentManager: party cannot be zero");
    });

    it("should reject zero categories", async function () {
      await expect(
        consentManager.connect(driver1).grantConsent(PARTY_A, 0, THIRTY_DAYS)
      ).to.be.revertedWith("ConsentManager: categories cannot be zero");
    });

    it("should reject invalid categories (bits outside valid mask)", async function () {
      await expect(
        consentManager.connect(driver1).grantConsent(PARTY_A, 0x10, THIRTY_DAYS)
      ).to.be.revertedWith("ConsentManager: invalid categories");
    });

    it("should reject zero duration", async function () {
      await expect(
        consentManager.connect(driver1).grantConsent(PARTY_A, SCORE, 0)
      ).to.be.revertedWith("ConsentManager: duration must be positive");
    });

    it("should allow updating an existing grant (overwrite)", async function () {
      await consentManager.connect(driver1).grantConsent(PARTY_A, SCORE, THIRTY_DAYS);
      await consentManager.connect(driver1).grantConsent(PARTY_A, ALL_CATEGORIES, TWELVE_MONTHS);

      const grants = await consentManager.getActiveGrants(driver1.address);
      expect(grants.length).to.equal(1);
      expect(grants[0].dataCategories).to.equal(ALL_CATEGORIES);
    });
  });

  describe("revokeConsent", function () {
    beforeEach(async function () {
      await consentManager.connect(driver1).grantConsent(PARTY_A, SCORE, THIRTY_DAYS);
    });

    it("should revoke consent immediately", async function () {
      await expect(consentManager.connect(driver1).revokeConsent(PARTY_A))
        .to.emit(consentManager, "ConsentRevoked")
        .withArgs(driver1.address, PARTY_A);

      // Consent should no longer be valid
      const isValid = await consentManager.checkConsent(driver1.address, PARTY_A, SCORE);
      expect(isValid).to.be.false;
    });

    it("should reject revoking non-existent grant", async function () {
      await expect(
        consentManager.connect(driver1).revokeConsent(PARTY_B)
      ).to.be.revertedWith("ConsentManager: no grant exists for party");
    });

    it("should reject revoking already revoked grant", async function () {
      await consentManager.connect(driver1).revokeConsent(PARTY_A);
      await expect(
        consentManager.connect(driver1).revokeConsent(PARTY_A)
      ).to.be.revertedWith("ConsentManager: already revoked");
    });

    it("should reject zero party", async function () {
      await expect(
        consentManager.connect(driver1).revokeConsent(ZERO_PARTY)
      ).to.be.revertedWith("ConsentManager: party cannot be zero");
    });

    it("should take effect within one block (immediate)", async function () {
      // Grant and check consent is valid
      expect(await consentManager.checkConsent(driver1.address, PARTY_A, SCORE)).to.be.true;

      // Revoke in the same block context
      await consentManager.connect(driver1).revokeConsent(PARTY_A);

      // Immediately after revocation, consent should be invalid
      expect(await consentManager.checkConsent(driver1.address, PARTY_A, SCORE)).to.be.false;
    });
  });

  describe("checkConsent", function () {
    beforeEach(async function () {
      const categories = SCORE | TRIPS; // 0x03
      await consentManager.connect(driver1).grantConsent(PARTY_A, categories, THIRTY_DAYS);
    });

    it("should return true for granted category", async function () {
      expect(await consentManager.checkConsent(driver1.address, PARTY_A, SCORE)).to.be.true;
      expect(await consentManager.checkConsent(driver1.address, PARTY_A, TRIPS)).to.be.true;
    });

    it("should return false for non-granted category", async function () {
      expect(await consentManager.checkConsent(driver1.address, PARTY_A, DELIVERY)).to.be.false;
      expect(await consentManager.checkConsent(driver1.address, PARTY_A, INSURANCE)).to.be.false;
    });

    it("should return false for expired consent", async function () {
      // Fast forward past expiration
      await time.increase(THIRTY_DAYS + 1);
      expect(await consentManager.checkConsent(driver1.address, PARTY_A, SCORE)).to.be.false;
    });

    it("should return false for revoked consent", async function () {
      await consentManager.connect(driver1).revokeConsent(PARTY_A);
      expect(await consentManager.checkConsent(driver1.address, PARTY_A, SCORE)).to.be.false;
    });

    it("should return false for non-existent grant", async function () {
      expect(await consentManager.checkConsent(driver1.address, PARTY_B, SCORE)).to.be.false;
    });

    it("should return false for zero category", async function () {
      expect(await consentManager.checkConsent(driver1.address, PARTY_A, 0)).to.be.false;
    });

    it("should return false for invalid category bits", async function () {
      expect(await consentManager.checkConsent(driver1.address, PARTY_A, 0x10)).to.be.false;
    });

    it("should support checking combined categories", async function () {
      // Check both SCORE and TRIPS together
      const combined = SCORE | TRIPS;
      expect(await consentManager.checkConsent(driver1.address, PARTY_A, combined)).to.be.true;

      // Check SCORE | DELIVERY - should fail since DELIVERY not granted
      const partial = SCORE | DELIVERY;
      expect(await consentManager.checkConsent(driver1.address, PARTY_A, partial)).to.be.false;
    });
  });

  describe("getActiveGrants", function () {
    it("should return empty array for driver with no grants", async function () {
      const grants = await consentManager.getActiveGrants(driver1.address);
      expect(grants.length).to.equal(0);
    });

    it("should return only active (non-revoked, non-expired) grants", async function () {
      await consentManager.connect(driver1).grantConsent(PARTY_A, SCORE, THIRTY_DAYS);
      await consentManager.connect(driver1).grantConsent(PARTY_B, TRIPS, THIRTY_DAYS);

      // Revoke one
      await consentManager.connect(driver1).revokeConsent(PARTY_A);

      const grants = await consentManager.getActiveGrants(driver1.address);
      expect(grants.length).to.equal(1);
      expect(grants[0].authorizedParty).to.equal(PARTY_B);
    });

    it("should exclude expired grants", async function () {
      await consentManager.connect(driver1).grantConsent(PARTY_A, SCORE, ONE_DAY);
      await consentManager.connect(driver1).grantConsent(PARTY_B, TRIPS, TWELVE_MONTHS);

      // Fast forward past first grant's expiration
      await time.increase(ONE_DAY + 1);

      const grants = await consentManager.getActiveGrants(driver1.address);
      expect(grants.length).to.equal(1);
      expect(grants[0].authorizedParty).to.equal(PARTY_B);
    });
  });

  describe("optInAccountability", function () {
    it("should opt in successfully", async function () {
      await expect(consentManager.connect(driver1).optInAccountability())
        .to.emit(consentManager, "AccountabilityOptIn")
        .withArgs(driver1.address);

      expect(await consentManager.isAccountabilityOptedIn(driver1.address)).to.be.true;
    });

    it("should reject if already opted in", async function () {
      await consentManager.connect(driver1).optInAccountability();
      await expect(
        consentManager.connect(driver1).optInAccountability()
      ).to.be.revertedWith("ConsentManager: already opted in");
    });
  });

  describe("optOutAccountability", function () {
    beforeEach(async function () {
      await consentManager.connect(driver1).optInAccountability();
    });

    it("should opt out successfully", async function () {
      await expect(consentManager.connect(driver1).optOutAccountability())
        .to.emit(consentManager, "AccountabilityOptOut")
        .withArgs(driver1.address);

      expect(await consentManager.isAccountabilityOptedIn(driver1.address)).to.be.false;
    });

    it("should reject if not opted in", async function () {
      await consentManager.connect(driver1).optOutAccountability();
      await expect(
        consentManager.connect(driver1).optOutAccountability()
      ).to.be.revertedWith("ConsentManager: not opted in");
    });
  });

  describe("isAccountabilityOptedIn", function () {
    it("should return false by default", async function () {
      expect(await consentManager.isAccountabilityOptedIn(driver1.address)).to.be.false;
    });

    it("should return true after opt-in", async function () {
      await consentManager.connect(driver1).optInAccountability();
      expect(await consentManager.isAccountabilityOptedIn(driver1.address)).to.be.true;
    });

    it("should return false after opt-out", async function () {
      await consentManager.connect(driver1).optInAccountability();
      await consentManager.connect(driver1).optOutAccountability();
      expect(await consentManager.isAccountabilityOptedIn(driver1.address)).to.be.false;
    });
  });
});
