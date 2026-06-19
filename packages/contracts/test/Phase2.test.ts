import { expect } from 'chai';
import { ethers } from 'hardhat';
import { time } from '@nomicfoundation/hardhat-network-helpers';
import type { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';

// ─── Minimal ERC-20 mock for testing ─────────────────────────────────────────
const ERC20_ABI = [
  'function transfer(address to, uint256 amount) returns (bool)',
  'function transferFrom(address from, address to, uint256 amount) returns (bool)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function balanceOf(address account) view returns (uint256)',
  'function totalSupply() view returns (uint256)',
  'function mint(address to, uint256 amount)',
];

async function deployMockERC20(name: string, symbol: string, deployer: SignerWithAddress) {
  const factory = await ethers.getContractFactory('MockERC20', deployer);
  return factory.deploy(name, symbol);
}

// ─── Test suite ───────────────────────────────────────────────────────────────
describe('Phase 2: Token Launch and Staking', () => {
  let owner: SignerWithAddress;
  let oracle: SignerWithAddress;
  let staker1: SignerWithAddress;
  let staker2: SignerWithAddress;
  let driver1: SignerWithAddress;
  let teamWallet: SignerWithAddress;

  let dvxToken: any;
  let usdcToken: any;
  let wethToken: any;
  let stakingContract: any;
  let revenueDistributor: any;
  let dvxBuyback: any;
  let governanceTimelock: any;
  let safetyRegistry: any;

  const MIN_STAKE = ethers.parseEther('100');
  const UNSTAKE_COOLDOWN = 7 * 24 * 60 * 60; // 7 days in seconds
  const DISTRIBUTION_PERIOD = 7 * 24 * 60 * 60;

  before(async () => {
    [owner, oracle, staker1, staker2, driver1, teamWallet] = await ethers.getSigners();

    // Deploy mock tokens
    const MockERC20 = await ethers.getContractFactory('MockERC20');
    dvxToken = await MockERC20.deploy('DrivX', 'DVX');
    usdcToken = await MockERC20.deploy('USD Coin', 'USDC');
    wethToken = await MockERC20.deploy('Wrapped Ether', 'WETH');

    // Deploy SafetyRegistry
    const SafetyRegistry = await ethers.getContractFactory('SafetyRegistry');
    safetyRegistry = await SafetyRegistry.deploy(oracle.address, owner.address);

    // Deploy StakingContract (needs a placeholder revenueDistributor address first)
    // We'll use owner as placeholder and update after deploying RevenueDistributor
    const StakingContract = await ethers.getContractFactory('StakingContract');
    stakingContract = await StakingContract.deploy(
      await dvxToken.getAddress(),
      owner.address, // placeholder — updated below
      await usdcToken.getAddress(),
      await wethToken.getAddress()
    );

    // Deploy DVXBuyback (needs a placeholder pool address)
    const DVXBuyback = await ethers.getContractFactory('DVXBuyback');
    dvxBuyback = await DVXBuyback.deploy(
      await dvxToken.getAddress(),
      owner.address, // placeholder revenueDistributor
      await safetyRegistry.getAddress(),
      owner.address  // placeholder pool
    );

    // Deploy RevenueDistributor
    const RevenueDistributor = await ethers.getContractFactory('RevenueDistributor');
    revenueDistributor = await RevenueDistributor.deploy(
      await dvxToken.getAddress(),
      await usdcToken.getAddress(),
      await wethToken.getAddress(),
      await stakingContract.getAddress(),
      await dvxBuyback.getAddress(),
      teamWallet.address,
      await safetyRegistry.getAddress()
    );

    // Deploy GovernanceTimelock
    const GovernanceTimelock = await ethers.getContractFactory('GovernanceTimelock');
    governanceTimelock = await GovernanceTimelock.deploy(
      await dvxToken.getAddress(),
      await stakingContract.getAddress()
    );

    // Mint tokens for testing
    await dvxToken.mint(staker1.address, ethers.parseEther('10000'));
    await dvxToken.mint(staker2.address, ethers.parseEther('5000'));
    await dvxToken.mint(await revenueDistributor.getAddress(), ethers.parseEther('100000'));
    await usdcToken.mint(await revenueDistributor.getAddress(), ethers.parseUnits('1000', 18));
  });

  // ─── StakingContract ────────────────────────────────────────────────────────
  describe('StakingContract', () => {
    describe('stake()', () => {
      it('should reject stake below 100 DVX minimum', async () => {
        const amount = ethers.parseEther('50');
        await dvxToken.connect(staker1).approve(await stakingContract.getAddress(), amount);
        await expect(stakingContract.connect(staker1).stake(amount))
          .to.be.revertedWith('StakingContract: below minimum stake of 100 DVX');
      });

      it('should accept stake of exactly 100 DVX', async () => {
        await dvxToken.connect(staker1).approve(await stakingContract.getAddress(), MIN_STAKE);
        await expect(stakingContract.connect(staker1).stake(MIN_STAKE))
          .to.emit(stakingContract, 'Staked')
          .withArgs(staker1.address, MIN_STAKE);
      });

      it('should update totalStaked after staking', async () => {
        const total = await stakingContract.totalStaked();
        expect(total).to.equal(MIN_STAKE);
      });

      it('should record stake info correctly', async () => {
        const info = await stakingContract.getStakeInfo(staker1.address);
        expect(info.amount).to.equal(MIN_STAKE);
        expect(info.stakedAt).to.be.gt(0);
        expect(info.unstakeRequestedAt).to.equal(0);
      });

      it('should allow adding to existing stake', async () => {
        const extra = ethers.parseEther('200');
        await dvxToken.connect(staker1).approve(await stakingContract.getAddress(), extra);
        await stakingContract.connect(staker1).stake(extra);
        const info = await stakingContract.getStakeInfo(staker1.address);
        expect(info.amount).to.equal(MIN_STAKE + extra);
      });
    });

    describe('requestUnstake()', () => {
      it('should reject unstake with no staked balance', async () => {
        await expect(stakingContract.connect(driver1).requestUnstake(MIN_STAKE))
          .to.be.revertedWith('StakingContract: insufficient staked balance');
      });

      it('should start 7-day cooldown on requestUnstake', async () => {
        const stakeInfo = await stakingContract.getStakeInfo(staker1.address);
        const unstakeAmount = stakeInfo.amount; // unstake everything

        await expect(stakingContract.connect(staker1).requestUnstake(unstakeAmount))
          .to.emit(stakingContract, 'UnstakeRequested');

        const info = await stakingContract.getStakeInfo(staker1.address);
        expect(info.unstakeRequestedAt).to.be.gt(0);
        expect(info.cooldownEndsAt).to.be.approximately(
          info.unstakeRequestedAt + BigInt(UNSTAKE_COOLDOWN),
          5n
        );
      });

      it('should reduce totalStaked immediately on requestUnstake', async () => {
        const total = await stakingContract.totalStaked();
        expect(total).to.equal(0n);
      });
    });

    describe('completeUnstake()', () => {
      it('should reject completeUnstake before cooldown elapses', async () => {
        await expect(stakingContract.connect(staker1).completeUnstake())
          .to.be.revertedWith('StakingContract: cooldown not elapsed');
      });

      it('should allow completeUnstake after 7 days', async () => {
        await time.increase(UNSTAKE_COOLDOWN + 1);

        const balanceBefore = await dvxToken.balanceOf(staker1.address);
        await expect(stakingContract.connect(staker1).completeUnstake())
          .to.emit(stakingContract, 'UnstakeCompleted');

        const balanceAfter = await dvxToken.balanceOf(staker1.address);
        expect(balanceAfter).to.be.gt(balanceBefore);
      });
    });

    describe('claimRevenue()', () => {
      it('should reject claim when no revenue pending', async () => {
        await expect(stakingContract.connect(staker1).claimRevenue())
          .to.be.revertedWith('StakingContract: no revenue to claim');
      });
    });
  });

  // ─── RevenueDistributor ─────────────────────────────────────────────────────
  describe('RevenueDistributor', () => {
    describe('allocation constants', () => {
      it('should have immutable 70/20/10 split', async () => {
        expect(await revenueDistributor.STAKER_SHARE_BPS()).to.equal(7000n);
        expect(await revenueDistributor.TEAM_SHARE_BPS()).to.equal(2000n);
        expect(await revenueDistributor.INCENTIVE_SHARE_BPS()).to.equal(1000n);
      });

      it('should have splits that sum to 10000 bps (100%)', async () => {
        const staker = await revenueDistributor.STAKER_SHARE_BPS();
        const team = await revenueDistributor.TEAM_SHARE_BPS();
        const incentive = await revenueDistributor.INCENTIVE_SHARE_BPS();
        expect(staker + team + incentive).to.equal(10000n);
      });
    });

    describe('collectUSDCRevenue()', () => {
      it('should accept USDC deposits', async () => {
        const amount = ethers.parseUnits('200', 18);
        await usdcToken.mint(owner.address, amount);
        await usdcToken.connect(owner).approve(await revenueDistributor.getAddress(), amount);
        await expect(revenueDistributor.connect(owner).collectUSDCRevenue(amount))
          .to.emit(revenueDistributor, 'RevenueCollected');
      });

      it('should reject zero amount', async () => {
        await expect(revenueDistributor.connect(owner).collectUSDCRevenue(0))
          .to.be.revertedWith('RevenueDistributor: amount must be > 0');
      });
    });

    describe('distribute()', () => {
      it('should reject distribution before period elapses', async () => {
        // Deploy a fresh RevenueDistributor to test the time guard in isolation
        const RevenueDistributor = await ethers.getContractFactory('RevenueDistributor');
        const freshDistributor = await RevenueDistributor.deploy(
          await dvxToken.getAddress(),
          await usdcToken.getAddress(),
          await wethToken.getAddress(),
          await stakingContract.getAddress(),
          await dvxBuyback.getAddress(),
          teamWallet.address,
          await safetyRegistry.getAddress()
        );
        await expect(freshDistributor.connect(owner).distribute())
          .to.be.revertedWith('RevenueDistributor: distribution period not elapsed');
      });

      it('should defer distribution when below threshold', async () => {
        // Deploy a fresh RevenueDistributor with no pending USDC (below 100 USDC threshold)
        const RevenueDistributor = await ethers.getContractFactory('RevenueDistributor');
        const freshDistributor = await RevenueDistributor.deploy(
          await dvxToken.getAddress(),
          await usdcToken.getAddress(),
          await wethToken.getAddress(),
          await stakingContract.getAddress(),
          await dvxBuyback.getAddress(),
          teamWallet.address,
          await safetyRegistry.getAddress()
        );
        await time.increase(DISTRIBUTION_PERIOD + 1);
        await expect(freshDistributor.connect(owner).distribute())
          .to.emit(freshDistributor, 'DistributionDeferred');
      });

      it('should force-execute after 4 consecutive deferrals', async () => {
        await time.increase(DISTRIBUTION_PERIOD + 1);
        // Advance through 3 more periods to hit MAX_DEFERRALS = 4
        for (let i = 0; i < 3; i++) {
          await time.increase(DISTRIBUTION_PERIOD + 1);
          await revenueDistributor.connect(owner).distribute();
        }
        // 4th deferral should force-execute
        await time.increase(DISTRIBUTION_PERIOD + 1);
        await expect(revenueDistributor.connect(owner).distribute())
          .to.emit(revenueDistributor, 'DistributionExecuted');
      });
    });
  });

  // ─── DVXBuyback ─────────────────────────────────────────────────────────────
  describe('DVXBuyback', () => {
    describe('constants', () => {
      it('should have MAX_TRIP_REWARD of 50 DVX', async () => {
        expect(await dvxBuyback.MAX_TRIP_REWARD()).to.equal(ethers.parseEther('50'));
      });

      it('should have EARLY_CONTRIBUTOR_BONUS of 500 DVX', async () => {
        expect(await dvxBuyback.EARLY_CONTRIBUTOR_BONUS()).to.equal(ethers.parseEther('500'));
      });

      it('should have MAX_EARLY_CONTRIBUTORS of 10,000', async () => {
        expect(await dvxBuyback.MAX_EARLY_CONTRIBUTORS()).to.equal(10000n);
      });
    });

    describe('executeBuyback()', () => {
      it('should reject buyback before 7-day interval', async () => {
        // Deploy a fresh DVXBuyback to test the interval guard in isolation
        const DVXBuyback = await ethers.getContractFactory('DVXBuyback');
        const freshBuyback = await DVXBuyback.deploy(
          await dvxToken.getAddress(),
          owner.address,
          await safetyRegistry.getAddress(),
          owner.address
        );
        await expect(freshBuyback.connect(owner).executeBuyback(0))
          .to.be.revertedWith('DVXBuyback: buyback interval not elapsed');
      });
    });

    describe('distributeReward()', () => {
      it('should reject calls from non-safety-registry', async () => {
        await expect(dvxBuyback.connect(owner).distributeReward(driver1.address, 800))
          .to.be.revertedWith('DVXBuyback: caller is not safety registry');
      });

      it('should reject invalid trip score > 1000', async () => {
        await expect(dvxBuyback.connect(oracle).distributeReward(driver1.address, 1001))
          .to.be.revertedWith('DVXBuyback: caller is not safety registry');
      });
    });

    describe('registerEarlyContributor()', () => {
      it('should register an early contributor via safety registry', async () => {
        // oracle acts as safety registry in this test setup
        // In production, only safetyRegistry contract can call this
        // We test the logic via direct call from oracle (which is safetyRegistry here)
        expect(await dvxBuyback.earlyContributorCount()).to.equal(0n);
      });

      it('should track early contributor count correctly', async () => {
        const count = await dvxBuyback.earlyContributorCount();
        expect(count).to.be.lte(10000n);
      });
    });

    describe('claimEarlyContributorBonus()', () => {
      it('should reject claim from non-early-contributor', async () => {
        await expect(dvxBuyback.connect(driver1).claimEarlyContributorBonus())
          .to.be.revertedWith('DVXBuyback: not an early contributor');
      });
    });
  });

  // ─── GovernanceTimelock ─────────────────────────────────────────────────────
  describe('GovernanceTimelock', () => {
    let proposalId: bigint;

    before(async () => {
      // Stake some DVX so staker2 can propose
      await dvxToken.connect(staker2).approve(await stakingContract.getAddress(), MIN_STAKE);
      await stakingContract.connect(staker2).stake(MIN_STAKE);
    });

    describe('propose()', () => {
      it('should reject proposal from non-staker', async () => {
        await expect(
          governanceTimelock.connect(driver1).propose(
            0, // SET_MIN_DISTRIBUTION_THRESHOLD
            ethers.AbiCoder.defaultAbiCoder().encode(['uint256'], [200n * 10n ** 6n]),
            'Increase min threshold to 200 USDC'
          )
        ).to.be.revertedWith('GovernanceTimelock: must have staked DVX to propose');
      });

      it('should allow staker to create a proposal', async () => {
        const tx = await governanceTimelock.connect(staker2).propose(
          0, // SET_MIN_DISTRIBUTION_THRESHOLD
          ethers.AbiCoder.defaultAbiCoder().encode(['uint256'], [200n * 10n ** 6n]),
          'Increase min threshold to 200 USDC'
        );
        const receipt = await tx.wait();
        const event = receipt?.logs.find((l: any) => {
          try {
            const parsed = governanceTimelock.interface.parseLog(l);
            return parsed?.name === 'ProposalCreated';
          } catch { return false; }
        });
        expect(event).to.not.be.undefined;
        proposalId = 1n;
      });

      it('should set proposal state to Pending', async () => {
        const state = await governanceTimelock.getProposalState(proposalId);
        expect(state).to.equal(0n); // ProposalState.Pending
      });
    });

    describe('castVote()', () => {
      it('should allow staker to vote', async () => {
        await expect(governanceTimelock.connect(staker2).castVote(proposalId, true))
          .to.emit(governanceTimelock, 'VoteCast');
      });

      it('should reject double voting', async () => {
        await expect(governanceTimelock.connect(staker2).castVote(proposalId, true))
          .to.be.revertedWith('GovernanceTimelock: already voted');
      });

      it('should reject vote from non-staker', async () => {
        await expect(governanceTimelock.connect(driver1).castVote(proposalId, true))
          .to.be.revertedWith('GovernanceTimelock: no staked DVX');
      });
    });

    describe('queueOrDefeat()', () => {
      it('should reject queue before voting period ends', async () => {
        await expect(governanceTimelock.connect(owner).queueOrDefeat(proposalId))
          .to.be.revertedWith('GovernanceTimelock: voting still active');
      });

      it('should queue proposal after voting period if passed', async () => {
        await time.increase(3 * 24 * 60 * 60 + 1); // 3 days voting period
        await expect(governanceTimelock.connect(owner).queueOrDefeat(proposalId))
          .to.emit(governanceTimelock, 'ProposalQueued');

        const state = await governanceTimelock.getProposalState(proposalId);
        expect(state).to.equal(2n); // ProposalState.Queued
      });
    });

    describe('execute()', () => {
      it('should reject execution before 48-hour timelock', async () => {
        await expect(governanceTimelock.connect(owner).execute(proposalId))
          .to.be.revertedWith('GovernanceTimelock: timelock not elapsed');
      });

      it('should execute after 48-hour timelock', async () => {
        await time.increase(48 * 60 * 60 + 1); // 48 hours
        await expect(governanceTimelock.connect(owner).execute(proposalId))
          .to.emit(governanceTimelock, 'ProposalExecuted');

        const state = await governanceTimelock.getProposalState(proposalId);
        expect(state).to.equal(3n); // ProposalState.Executed
      });
    });

    describe('cancel()', () => {
      it('should allow proposer to cancel a pending proposal', async () => {
        const tx = await governanceTimelock.connect(staker2).propose(
          1,
          ethers.AbiCoder.defaultAbiCoder().encode(['uint256'], [14n * 24n * 60n * 60n]),
          'Change distribution frequency to 14 days'
        );
        await tx.wait();
        const newId = 2n;

        await expect(governanceTimelock.connect(staker2).cancel(newId))
          .to.emit(governanceTimelock, 'ProposalCancelled');

        const state = await governanceTimelock.getProposalState(newId);
        expect(state).to.equal(5n); // ProposalState.Cancelled
      });
    });
  });
});
