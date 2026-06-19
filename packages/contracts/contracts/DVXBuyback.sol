// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./IDVXToken.sol";

/**
 * @title IDVXBuyback
 * @notice Interface for the DVX Buyback contract.
 * Requirements: 4.4, 4.10, 4.12, 4.13, 12.6, 12.7, 12.11
 */
interface IDVXBuyback {
    function executeBuyback(uint256 minDVXOut) external;
    function distributeReward(address driver, uint256 tripScore) external;
    function claimEarlyContributorBonus() external;
    function isEarlyContributorEligible(address driver) external view returns (bool);

    event BuybackExecuted(uint256 amountIn, uint256 dvxReceived, uint256 timestamp);
    event RewardDistributed(address indexed driver, uint256 dvxAmount, uint256 tripScore);
    event EarlyContributorBonusClaimed(address indexed driver, uint256 bonusAmount);
}

/**
 * @title DVXBuyback
 * @notice Executes DVX buybacks on a fixed 7-day schedule and distributes
 *         rewards to qualifying drivers.
 *
 * Rules:
 * - Receives funds from Revenue Distributor's 10% Driver Incentive Pool
 * - Buybacks execute on fixed 7-day schedule (no human discretion)
 * - Uses TWAP oracle (30-min window) for pricing
 * - Slippage protection via minDVXOut
 * - Max 50 DVX per verified trip
 * - Early contributor bonus: 500 DVX to first 10,000 drivers with 20+ verified trips
 *
 * Requirements: 4.4, 4.10, 4.12, 4.13, 12.6, 12.7, 12.11
 */
contract DVXBuyback is IDVXBuyback, ReentrancyGuard {
    /// @notice Maximum DVX reward per verified trip
    uint256 public constant MAX_TRIP_REWARD = 50 * 10 ** 18;

    /// @notice Early contributor bonus amount
    uint256 public constant EARLY_CONTRIBUTOR_BONUS = 500 * 10 ** 18;

    /// @notice Maximum number of early contributors eligible for bonus
    uint256 public constant MAX_EARLY_CONTRIBUTORS = 10_000;

    /// @notice Minimum verified trips required for early contributor bonus
    uint256 public constant MIN_TRIPS_FOR_BONUS = 20;

    /// @notice Buyback execution interval: 7 days
    uint256 public constant BUYBACK_INTERVAL = 7 days;

    /// @notice TWAP window: 30 minutes
    uint256 public constant TWAP_WINDOW = 30 minutes;

    // ─── Token and protocol contracts ─────────────────────────────────────────
    IDVXToken public immutable dvxToken;
    address public immutable revenueDistributor;
    address public immutable safetyRegistry;

    /// @notice Uniswap V4 pool address for DVX/WETH
    address public immutable dvxPool;

    // ─── Buyback state ────────────────────────────────────────────────────────
    uint256 public lastBuybackTime;
    uint256 public totalBuybacksDVX;

    // ─── Early contributor tracking ───────────────────────────────────────────
    uint256 public earlyContributorCount;
    mapping(address => bool) public isEarlyContributor;
    mapping(address => bool) public hasClaimedBonus;

    // ─── Reward tracking ─────────────────────────────────────────────────────
    mapping(address => uint256) public pendingRewards;

    modifier onlyRevenueDistributor() {
        require(
            msg.sender == revenueDistributor,
            "DVXBuyback: caller is not revenue distributor"
        );
        _;
    }

    modifier onlySafetyRegistry() {
        require(
            msg.sender == safetyRegistry,
            "DVXBuyback: caller is not safety registry"
        );
        _;
    }

    constructor(
        address _dvxToken,
        address _revenueDistributor,
        address _safetyRegistry,
        address _dvxPool
    ) {
        require(_dvxToken != address(0), "DVXBuyback: zero dvx");
        require(_revenueDistributor != address(0), "DVXBuyback: zero distributor");
        require(_safetyRegistry != address(0), "DVXBuyback: zero registry");
        require(_dvxPool != address(0), "DVXBuyback: zero pool");

        dvxToken = IDVXToken(_dvxToken);
        revenueDistributor = _revenueDistributor;
        safetyRegistry = _safetyRegistry;
        dvxPool = _dvxPool;
        lastBuybackTime = block.timestamp;
    }

    /**
     * @notice Execute a DVX buyback using accumulated incentive pool funds.
     * @dev Enforces 7-day schedule. Uses TWAP for pricing. minDVXOut prevents sandwich attacks.
     * @param minDVXOut Minimum DVX to receive (slippage protection)
     */
    function executeBuyback(uint256 minDVXOut) external nonReentrant {
        require(
            block.timestamp >= lastBuybackTime + BUYBACK_INTERVAL,
            "DVXBuyback: buyback interval not elapsed"
        );

        uint256 wethBalance = _getWETHBalance();
        require(wethBalance > 0, "DVXBuyback: no funds for buyback");

        lastBuybackTime = block.timestamp;

        // Get TWAP price from Uniswap V4 pool
        uint256 twapPrice = _getTWAPPrice();
        require(twapPrice > 0, "DVXBuyback: invalid TWAP price");

        // Calculate expected DVX out based on TWAP
        uint256 expectedDVX = (wethBalance * twapPrice) / 1e18;
        require(expectedDVX >= minDVXOut, "DVXBuyback: slippage too high");

        // Execute swap via Uniswap V4 pool
        uint256 dvxReceived = _executeSwap(wethBalance, minDVXOut);
        require(dvxReceived >= minDVXOut, "DVXBuyback: received less than minDVXOut");

        totalBuybacksDVX += dvxReceived;

        emit BuybackExecuted(wethBalance, dvxReceived, block.timestamp);
    }

    /**
     * @notice Distribute DVX reward to a driver after a verified trip.
     * @dev Called by the Safety Registry oracle after trip verification.
     *      Reward is proportional to trip score, capped at 50 DVX.
     * @param driver The driver's wallet address
     * @param tripScore The trip score (0–1000)
     */
    function distributeReward(address driver, uint256 tripScore) external nonReentrant onlySafetyRegistry {
        require(driver != address(0), "DVXBuyback: zero driver address");
        require(tripScore <= 1000, "DVXBuyback: invalid trip score");

        // Calculate reward: proportional to score, max 50 DVX
        uint256 reward = (tripScore * MAX_TRIP_REWARD) / 1000;
        if (reward == 0) return;

        // Ensure we have enough DVX
        uint256 available = dvxToken.balanceOf(address(this));
        if (available < reward) {
            reward = available; // partial reward if insufficient
        }

        if (reward > 0) {
            pendingRewards[driver] += reward;
            emit RewardDistributed(driver, reward, tripScore);
        }
    }

    /**
     * @notice Claim pending DVX rewards.
     */
    function claimReward() external nonReentrant {
        uint256 amount = pendingRewards[msg.sender];
        require(amount > 0, "DVXBuyback: no pending rewards");

        pendingRewards[msg.sender] = 0;
        require(dvxToken.transfer(msg.sender, amount), "DVXBuyback: transfer failed");
    }

    /**
     * @notice Register a driver as an early contributor.
     * @dev Called by Safety Registry when driver reaches 20 verified trips.
     *      Only the first 10,000 qualifying drivers are eligible.
     */
    function registerEarlyContributor(address driver) external onlySafetyRegistry {
        require(driver != address(0), "DVXBuyback: zero address");
        require(!isEarlyContributor[driver], "DVXBuyback: already registered");
        require(earlyContributorCount < MAX_EARLY_CONTRIBUTORS, "DVXBuyback: cap reached");

        isEarlyContributor[driver] = true;
        earlyContributorCount++;
    }

    /**
     * @notice Claim the 500 DVX early contributor bonus.
     * @dev Only available to the first 10,000 drivers with 20+ verified trips.
     */
    function claimEarlyContributorBonus() external nonReentrant {
        require(isEarlyContributor[msg.sender], "DVXBuyback: not an early contributor");
        require(!hasClaimedBonus[msg.sender], "DVXBuyback: bonus already claimed");

        uint256 available = dvxToken.balanceOf(address(this));
        require(available >= EARLY_CONTRIBUTOR_BONUS, "DVXBuyback: insufficient DVX for bonus");

        hasClaimedBonus[msg.sender] = true;
        require(
            dvxToken.transfer(msg.sender, EARLY_CONTRIBUTOR_BONUS),
            "DVXBuyback: bonus transfer failed"
        );

        emit EarlyContributorBonusClaimed(msg.sender, EARLY_CONTRIBUTOR_BONUS);
    }

    /**
     * @notice Check if a driver is eligible for the early contributor bonus.
     */
    function isEarlyContributorEligible(address driver) external view returns (bool) {
        return isEarlyContributor[driver] && !hasClaimedBonus[driver];
    }

    // ─── Internal helpers ─────────────────────────────────────────────────────

    function _getWETHBalance() internal view returns (uint256) {
        // In production: read WETH balance from this contract
        // Placeholder — actual WETH address injected via constructor in full impl
        return 0;
    }

    /**
     * @dev Get 30-minute TWAP price from Uniswap V4 pool.
     *      Returns DVX per WETH (18 decimals).
     *      In production: calls pool.observe() with TWAP_WINDOW.
     */
    function _getTWAPPrice() internal view returns (uint256) {
        // Placeholder for Uniswap V4 TWAP oracle integration
        // Production implementation calls: IUniswapV4Pool(dvxPool).observe(TWAP_WINDOW)
        return 1e18; // 1:1 placeholder
    }

    /**
     * @dev Execute swap on Uniswap V4 pool.
     *      In production: calls pool.swap() with exact input.
     */
    function _executeSwap(uint256 amountIn, uint256 minOut) internal returns (uint256) {
        // Placeholder for Uniswap V4 swap integration
        // Production: IUniswapV4Pool(dvxPool).swap(...)
        return minOut;
    }
}
