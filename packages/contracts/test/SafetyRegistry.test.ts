import { expect } from 'chai';
import { ethers } from 'hardhat';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';

describe('SafetyRegistry', function () {
  let registry: any;
  let owner: SignerWithAddress;
  let oracle: SignerWithAddress;
  let credentialSigner: SignerWithAddress;
  let driver1: SignerWithAddress;
  let driver2: SignerWithAddress;
  let unauthorized: SignerWithAddress;

  beforeEach(async function () {
    [owner, oracle, credentialSigner, driver1, driver2, unauthorized] = await ethers.getSigners();
    const SafetyRegistry = await ethers.getContractFactory('SafetyRegistry');
    registry = await SafetyRegistry.deploy(oracle.address, credentialSigner.address);
  });

  describe('Deployment', function () {
    it('should deploy with the deployer as owner', async function () {
      expect(await registry.owner()).to.equal(owner.address);
    });

    it('should set the oracle address correctly', async function () {
      expect(await registry.oracle()).to.equal(oracle.address);
    });

    it('should set the credential signer address correctly', async function () {
      expect(await registry.credentialSigner()).to.equal(credentialSigner.address);
    });

    it('should revert if oracle is zero address', async function () {
      const SafetyRegistry = await ethers.getContractFactory('SafetyRegistry');
      await expect(
        SafetyRegistry.deploy(ethers.ZeroAddress, credentialSigner.address)
      ).to.be.revertedWith('SafetyRegistry: oracle is zero address');
    });

    it('should revert if credential signer is zero address', async function () {
      const SafetyRegistry = await ethers.getContractFactory('SafetyRegistry');
      await expect(
        SafetyRegistry.deploy(oracle.address, ethers.ZeroAddress)
      ).to.be.revertedWith('SafetyRegistry: signer is zero address');
    });
  });

  describe('Access Control', function () {
    it('should allow owner to set a new oracle', async function () {
      await registry.setOracle(unauthorized.address);
      expect(await registry.oracle()).to.equal(unauthorized.address);
    });

    it('should revert if non-owner tries to set oracle', async function () {
      await expect(
        registry.connect(unauthorized).setOracle(unauthorized.address)
      ).to.be.revertedWithCustomError(registry, 'OwnableUnauthorizedAccount');
    });

    it('should allow owner to set a new credential signer', async function () {
      await registry.setCredentialSigner(unauthorized.address);
      expect(await registry.credentialSigner()).to.equal(unauthorized.address);
    });

    it('should revert if non-owner tries to set credential signer', async function () {
      await expect(
        registry.connect(unauthorized).setCredentialSigner(unauthorized.address)
      ).to.be.revertedWithCustomError(registry, 'OwnableUnauthorizedAccount');
    });
  });

  describe('updateSafetyScore', function () {
    it('should allow oracle to update a driver score', async function () {
      await registry.connect(oracle).updateSafetyScore(driver1.address, 750, 5, 50);
      const identity = await registry.getDrivingIdentity(driver1.address);
      expect(identity.safetyScore).to.equal(750);
      expect(identity.totalTrips).to.equal(5);
      expect(identity.totalKilometers).to.equal(50);
    });

    it('should revert if non-oracle tries to update score', async function () {
      await expect(
        registry.connect(unauthorized).updateSafetyScore(driver1.address, 750, 5, 50)
      ).to.be.revertedWith('SafetyRegistry: caller is not the oracle');
    });

    it('should revert if score exceeds 1000', async function () {
      await expect(
        registry.connect(oracle).updateSafetyScore(driver1.address, 1001, 5, 50)
      ).to.be.revertedWith('SafetyRegistry: score exceeds maximum');
    });

    it('should revert if driver is zero address', async function () {
      await expect(
        registry.connect(oracle).updateSafetyScore(ethers.ZeroAddress, 750, 5, 50)
      ).to.be.revertedWith('SafetyRegistry: driver is zero address');
    });

    it('should set tenure start date on first update', async function () {
      await registry.connect(oracle).updateSafetyScore(driver1.address, 500, 1, 10);
      const identity = await registry.getDrivingIdentity(driver1.address);
      expect(identity.tenureStartDate).to.be.greaterThan(0);
    });

    it('should not change tenure start date on subsequent updates', async function () {
      await registry.connect(oracle).updateSafetyScore(driver1.address, 500, 1, 10);
      const identity1 = await registry.getDrivingIdentity(driver1.address);

      await registry.connect(oracle).updateSafetyScore(driver1.address, 600, 2, 20);
      const identity2 = await registry.getDrivingIdentity(driver1.address);

      expect(identity2.tenureStartDate).to.equal(identity1.tenureStartDate);
    });

    it('should emit ScoreUpdated event', async function () {
      await expect(registry.connect(oracle).updateSafetyScore(driver1.address, 750, 5, 50))
        .to.emit(registry, 'ScoreUpdated')
        .withArgs(driver1.address, 750, 5);
    });
  });

  describe('Provisional Status and Verification', function () {
    it('should remain unverified below threshold', async function () {
      await registry.connect(oracle).updateSafetyScore(driver1.address, 500, 9, 99);
      const identity = await registry.getDrivingIdentity(driver1.address);
      expect(identity.isVerified).to.equal(false);
    });

    it('should become verified when both thresholds are met (10 trips AND 100 km)', async function () {
      await registry.connect(oracle).updateSafetyScore(driver1.address, 700, 10, 100);
      const identity = await registry.getDrivingIdentity(driver1.address);
      expect(identity.isVerified).to.equal(true);
    });

    it('should not verify with enough trips but insufficient km', async function () {
      await registry.connect(oracle).updateSafetyScore(driver1.address, 700, 10, 99);
      const identity = await registry.getDrivingIdentity(driver1.address);
      expect(identity.isVerified).to.equal(false);
    });

    it('should not verify with enough km but insufficient trips', async function () {
      await registry.connect(oracle).updateSafetyScore(driver1.address, 700, 9, 100);
      const identity = await registry.getDrivingIdentity(driver1.address);
      expect(identity.isVerified).to.equal(false);
    });

    it('should emit IdentityVerified event when threshold is met', async function () {
      await expect(registry.connect(oracle).updateSafetyScore(driver1.address, 700, 10, 100))
        .to.emit(registry, 'IdentityVerified')
        .withArgs(driver1.address);
    });

    it('should not emit IdentityVerified again on subsequent updates', async function () {
      await registry.connect(oracle).updateSafetyScore(driver1.address, 700, 10, 100);
      await expect(registry.connect(oracle).updateSafetyScore(driver1.address, 800, 20, 200))
        .to.not.emit(registry, 'IdentityVerified');
    });
  });

  describe('verifyIdentity', function () {
    it('should return score and verified status', async function () {
      await registry.connect(oracle).updateSafetyScore(driver1.address, 850, 15, 200);
      const [score, verified] = await registry.verifyIdentity(driver1.address);
      expect(score).to.equal(850);
      expect(verified).to.equal(true);
    });

    it('should return zero score and unverified for unknown driver', async function () {
      const [score, verified] = await registry.verifyIdentity(driver2.address);
      expect(score).to.equal(0);
      expect(verified).to.equal(false);
    });
  });

  describe('batchVerify', function () {
    it('should return scores for multiple drivers', async function () {
      await registry.connect(oracle).updateSafetyScore(driver1.address, 800, 15, 200);
      await registry.connect(oracle).updateSafetyScore(driver2.address, 600, 12, 150);

      const scores = await registry.batchVerify([driver1.address, driver2.address]);
      expect(scores[0]).to.equal(800);
      expect(scores[1]).to.equal(600);
    });

    it('should revert if batch size exceeds 1000', async function () {
      const addresses = Array(1001).fill(driver1.address);
      await expect(registry.batchVerify(addresses)).to.be.revertedWith(
        'SafetyRegistry: batch size exceeds maximum'
      );
    });

    it('should handle empty array', async function () {
      const scores = await registry.batchVerify([]);
      expect(scores.length).to.equal(0);
    });
  });

  describe('generateCredential', function () {
    it('should generate a credential for a registered driver', async function () {
      await registry.connect(oracle).updateSafetyScore(driver1.address, 800, 15, 200);
      const tx = await registry.generateCredential(driver1.address);
      const receipt = await tx.wait();

      // Check that CredentialGenerated event was emitted
      const event = receipt.logs.find(
        (log: any) => log.fragment && log.fragment.name === 'CredentialGenerated'
      );
      expect(event).to.not.be.undefined;
    });

    it('should revert for a driver with no identity', async function () {
      await expect(registry.generateCredential(driver2.address)).to.be.revertedWith(
        'SafetyRegistry: identity not found'
      );
    });

    it('should emit CredentialGenerated event', async function () {
      await registry.connect(oracle).updateSafetyScore(driver1.address, 800, 15, 200);
      await expect(registry.generateCredential(driver1.address)).to.emit(
        registry,
        'CredentialGenerated'
      );
    });
  });

  describe('updateDeliveryProfile', function () {
    it('should allow oracle to update delivery profile', async function () {
      const specializations = ethers.encodeBytes32String('food');
      await registry
        .connect(oracle)
        .updateDeliveryProfile(driver1.address, 100, 9500, 1800, 450, 420, specializations);

      const profile = await registry.getDeliveryProfile(driver1.address);
      expect(profile.totalDeliveries).to.equal(100);
      expect(profile.onTimeRate).to.equal(9500);
      expect(profile.avgCompletionTime).to.equal(1800);
      expect(profile.merchantRating).to.equal(450);
      expect(profile.recipientRating).to.equal(420);
    });

    it('should revert if non-oracle tries to update delivery profile', async function () {
      const specializations = ethers.encodeBytes32String('food');
      await expect(
        registry
          .connect(unauthorized)
          .updateDeliveryProfile(driver1.address, 100, 9500, 1800, 450, 420, specializations)
      ).to.be.revertedWith('SafetyRegistry: caller is not the oracle');
    });

    it('should revert if onTimeRate exceeds 10000', async function () {
      const specializations = ethers.encodeBytes32String('food');
      await expect(
        registry
          .connect(oracle)
          .updateDeliveryProfile(driver1.address, 100, 10001, 1800, 450, 420, specializations)
      ).to.be.revertedWith('SafetyRegistry: onTimeRate exceeds basis points max');
    });

    it('should revert if merchant rating is out of range', async function () {
      const specializations = ethers.encodeBytes32String('food');
      await expect(
        registry
          .connect(oracle)
          .updateDeliveryProfile(driver1.address, 100, 9500, 1800, 99, 420, specializations)
      ).to.be.revertedWith('SafetyRegistry: invalid merchant rating');
    });
  });

  describe('updateCategoryBreakdown', function () {
    it('should allow oracle to update category breakdown', async function () {
      const category = ethers.encodeBytes32String('commute');
      await registry.connect(oracle).updateCategoryBreakdown(driver1.address, category);
      const identity = await registry.getDrivingIdentity(driver1.address);
      expect(identity.categoryBreakdown).to.equal(category);
    });

    it('should revert if non-oracle tries to update category', async function () {
      const category = ethers.encodeBytes32String('commute');
      await expect(
        registry.connect(unauthorized).updateCategoryBreakdown(driver1.address, category)
      ).to.be.revertedWith('SafetyRegistry: caller is not the oracle');
    });
  });
});
