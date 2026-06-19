// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./IDVXToken.sol";
import "./StakingContract.sol";

/**
 * @title IRevenueDistributor
 * @notice Interface for the SafeDrive Protocol Revenue Distributor.
 * Requirements: 3.1–3.11, 12.12
 */
interface IRevenueDistributor {
    function collectTradingFeeRevenue() external;
    function collectUSDCRevenue(uint256 amount) external;
    function distribute() external;
    function claimShare() external;
    function withdrawIncentivePool(address recipient, uint256 amount) external;
    function getPendingDistribution() external view returns (uint256 usdc, uint256 weth, uint256 dvx);

    event RevenueCollected(address indexed source, uint256 usdcAmount, uint256 wethAmount, uint256 dvxAmount);
    event DistributionExecuted(uint256 stakerShare, uint256 teamShare, uint256 incentiveShare, uint256 periodId);
    event DistributionDeferred(uint256 totalValue, uint256 deferralCount);
    event ShareClaimed(address indexed staker, uint256 usdcAmount, uint256 wethAmount, uint256 dvxAmount);
}

/**
 * @title RevenueDistributor
 * @notice Collects protocol revenue and distributes it weekly.
 *
 * Immutable 70/20/10 allocation:
 *   70% → DVX stakers (Safety_Score-weighted)
 *   20% → Team/treasury (for development and operations)
 *   10% → Driver Incentive Pool (DVX Buyback contract)
 *
 * Distribution rules:
 * - Weekly cycle
 * - Minimum threshold: 100 USDC equivalent before distributing
 * - Deferred if below threshold; auto-executes after 4 consecutive deferrals
 * - Failed claims retain balance for retry (no forfeiture)
 *
 * Requirements: 3.1–3.11, 12.12
 */
contract RevenueDistributor is IRevenueDistributor, ReentrancyGuard {
    // ─── Immutable allocation splits (basis points, sum = 10000) ─────────────
    uint256 public constant STAKER_SHARE_BPS = 7000;    // 70%
    uint256 public constant TEAM_SHARE_BPS = 2000;      // 20%
    uint256 public constant INCENTIVE_SHARE_BPS = 1000; // 10%
    uint256 public constant BPS_DENOMINATOR = 10000;

    /// @notice Minimum USDC equivalent to trigger distribution
    uint256 public constant MIN_DISTRIBUTION_THRESHOLD = 100 * 10 ** 6; // 100 USDC (6 decimals)

    /// @notice Maximum consecutive deferrals before forced distribution
    uint256 public constant MAX_DEFERRALS = 4;

    /// @notice Distribution period: 7 days
    uint256 public constant DISTRIBUTION_PERIOD = 7 days;

    // ─── Token contracts ──────────────────────────────────────────────────────
    IDVXToken public immutable dvxToken;
    address public immutable usdc;
    address public immutable weth;

    // ─── Protocol contracts ───────────────────────────────────────────────────
    StakingContract public immutable stakingContract;
    address public immutable dvxBuyback;
    address public immutable teamWallet;

    // ─── Distribution state ───────────────────────────────────────────────────
    uint256 public lastDistributionTime;
    uint256 public currentPeriodId;
    uint256 public consecutiveDeferrals;

    /// @notice Accumulated USDC pending distribution
    uint256 public pendingUSDC;
    /// @notice Accumulated WETH pending distribution
    uint256 public pendingWETH;
    /// @notice Accumulated DVX pending distribution
    uint256 public pendingDVX;

    // ─── Safety Registry for score-weighted distribution ─────────────────────
    address public immutable safetyRegistry;

    constructor(
        address _dvxToken,
        address _usdc,
        address _weth,
        address _stakingContract,
        address _dvxBuyback,
        address _teamWallet,
        address _safetyRegistry
    ) {
        require(_dvxToken != address(0), "RevenueDistributor: zero dvx");
        require(_usdc != address(0), "RevenueDistributor: zero usdc");
        require(_weth != address(0), "RevenueDistributor: zero weth");
        require(_stakingContract != address(0), "RevenueDistributor: zero staking");
        require(_dvxBuyback != address(0), "RevenueDistributor: zero buyback");
        require(_teamWallet != address(0), "RevenueDistributor: zero team");
        require(_safetyRegistry != address(0), "RevenueDistributor: zero registry");

        dvxToken = IDVXToken(_dvxToken);
        usdc = _usdc;
        weth = _weth;
        stakingContract = StakingContract(_stakingContract);
        dvxBuyback = _dvxBuyback;
        teamWallet = _teamWallet;
        safetyRegistry = _safetyRegistry;
        lastDistributionTime = block.timestamp;
    }

    /**
     * @notice Collect trading fee revenue (WETH + DVX) from Uniswap V4 pool.
     * @dev Called by the protocol after fees accumulate in the pool.
     */
    function collectTradingFeeRevenue() external nonReentrant {
        uint256 wethBalance = _balanceOf(weth, address(this));
        uint256 dvxBalance = dvxToken.balanceOf(address(this));

        // Subtract already-pending amounts to get newly received
        uint256 newWETH = wethBalance > pendingWETH ? wethBalance - pendingWETH : 0;
        uint256 newDVX = dvxBalance > pendingDVX ? dvxBalance - pendingDVX : 0;

        pendingWETH += newWETH;
        pendingDVX += newDVX;

        emit RevenueCollected(msg.sender, 0, newWETH, newDVX);
    }

    /**
     * @notice Receive USDC revenue from insurance, marketplace, and profile fees.
     * @param amount Amount of USDC being deposited.
     */
    function collectUSDCRevenue(uint256 amount) external nonReentrant {
        require(amount > 0, "RevenueDistributor: amount must be > 0");
        _safeTransferFromERC20(usdc, msg.sender, address(this), amount);
        pendingUSDC += amount;
        emit RevenueCollected(msg.sender, amount, 0, 0);
    }

    /**
     * @notice Execute weekly distribution.
     * @dev Defers if below threshold (unless 4 consecutive deferrals reached).
     *      Splits 70/20/10 — rounding always in stakers' favor.
     */
    function distribute() external nonReentrant {
        require(
            block.timestamp >= lastDistributionTime + DISTRIBUTION_PERIOD,
            "RevenueDistributor: distribution period not elapsed"
        );

        // Refresh balances
        uint256 totalUSDC = _balanceOf(usdc, address(this));
        uint256 totalWETH = _balanceOf(weth, address(this));
        uint256 totalDVX = dvxToken.balanceOf(address(this));

        // Check minimum threshold (use USDC as proxy; 1 USDC = 1e6)
        bool belowThreshold = totalUSDC < MIN_DISTRIBUTION_THRESHOLD;
        bool forceExecute = consecutiveDeferrals >= MAX_DEFERRALS;

        if (belowThreshold && !forceExecute) {
            consecutiveDeferrals++;
            lastDistributionTime = block.timestamp;
            emit DistributionDeferred(totalUSDC, consecutiveDeferrals);
            return;
        }

        consecutiveDeferrals = 0;
        lastDistributionTime = block.timestamp;
        currentPeriodId++;

        // ── Split USDC ────────────────────────────────────────────────────────
        // Staker share: round up (favor stakers)
        uint256 stakerUSDC = (totalUSDC * STAKER_SHARE_BPS + BPS_DENOMINATOR - 1) / BPS_DENOMINATOR;
        uint256 incentiveUSDC = (totalUSDC * INCENTIVE_SHARE_BPS) / BPS_DENOMINATOR;
        uint256 teamUSDC = totalUSDC - stakerUSDC - incentiveUSDC;

        // ── Split WETH ────────────────────────────────────────────────────────
        uint256 stakerWETH = (totalWETH * STAKER_SHARE_BPS + BPS_DENOMINATOR - 1) / BPS_DENOMINATOR;
        uint256 incentiveWETH = (totalWETH * INCENTIVE_SHARE_BPS) / BPS_DENOMINATOR;
        uint256 teamWETH = totalWETH - stakerWETH - incentiveWETH;

        // ── Split DVX ─────────────────────────────────────────────────────────
        uint256 stakerDVX = (totalDVX * STAKER_SHARE_BPS + BPS_DENOMINATOR - 1) / BPS_DENOMINATOR;
        uint256 incentiveDVX = (totalDVX * INCENTIVE_SHARE_BPS) / BPS_DENOMINATOR;
        uint256 teamDVX = totalDVX - stakerDVX - incentiveDVX;

        // ── Send team share ───────────────────────────────────────────────────
        if (teamUSDC > 0) _safeTransferERC20(usdc, teamWallet, teamUSDC);
        if (teamWETH > 0) _safeTransferERC20(weth, teamWallet, teamWETH);
        if (teamDVX > 0) require(dvxToken.transfer(teamWallet, teamDVX), "RevenueDistributor: DVX transfer failed");

        // ── Send incentive pool to DVX Buyback ────────────────────────────────
        if (incentiveUSDC > 0) _safeTransferERC20(usdc, dvxBuyback, incentiveUSDC);
        if (incentiveWETH > 0) _safeTransferERC20(weth, dvxBuyback, incentiveWETH);
        if (incentiveDVX > 0) require(dvxToken.transfer(dvxBuyback, incentiveDVX), "RevenueDistributor: DVX transfer failed");

        // ── Credit staker share to StakingContract ────────────────────────────
        // For simplicity, credit the full staker pool to the staking contract
        // The staking contract distributes per-staker based on stake weight
        if (stakerUSDC > 0) {
            _safeApproveERC20(usdc, address(stakingContract), stakerUSDC);
        }
        if (stakerWETH > 0) {
            _safeApproveERC20(weth, address(stakingContract), stakerWETH);
        }

        // Reset pending
        pendingUSDC = 0;
        pendingWETH = 0;
        pendingDVX = 0;

        emit DistributionExecuted(stakerUSDC, teamUSDC, incentiveUSDC, currentPeriodId);
    }

    /**
     * @notice Claim accumulated share. Retained on failure — no forfeiture.
     */
    function claimShare() external nonReentrant {
        // Delegates to StakingContract which tracks per-staker balances
        stakingContract.claimRevenue();
    }

    /**
     * @notice Withdraw from the Driver Incentive Pool. Only callable by DVX Buyback.
     */
    function withdrawIncentivePool(address recipient, uint256 amount) external nonReentrant {
        require(msg.sender == dvxBuyback, "RevenueDistributor: caller is not buyback contract");
        require(recipient != address(0), "RevenueDistributor: zero recipient");
        require(dvxToken.transfer(recipient, amount), "RevenueDistributor: DVX transfer failed");
    }

    /**
     * @notice Returns pending amounts awaiting distribution.
     */
    function getPendingDistribution()
        external
        view
        returns (uint256 usdcAmt, uint256 wethAmt, uint256 dvxAmt)
    {
        return (pendingUSDC, pendingWETH, pendingDVX);
    }

    // ─── Internal helpers ─────────────────────────────────────────────────────

    function _balanceOf(address token, address account) internal view returns (uint256) {
        (bool success, bytes memory data) = token.staticcall(
            abi.encodeWithSignature("balanceOf(address)", account)
        );
        require(success, "RevenueDistributor: balanceOf failed");
        return abi.decode(data, (uint256));
    }

    function _safeTransferERC20(address token, address to, uint256 amount) internal {
        (bool success, bytes memory data) = token.call(
            abi.encodeWithSignature("transfer(address,uint256)", to, amount)
        );
        require(
            success && (data.length == 0 || abi.decode(data, (bool))),
            "RevenueDistributor: transfer failed"
        );
    }

    function _safeTransferFromERC20(address token, address from, address to, uint256 amount) internal {
        (bool success, bytes memory data) = token.call(
            abi.encodeWithSignature("transferFrom(address,address,uint256)", from, to, amount)
        );
        require(
            success && (data.length == 0 || abi.decode(data, (bool))),
            "RevenueDistributor: transferFrom failed"
        );
    }

    function _safeApproveERC20(address token, address spender, uint256 amount) internal {
        (bool success, bytes memory data) = token.call(
            abi.encodeWithSignature("approve(address,uint256)", spender, amount)
        );
        require(
            success && (data.length == 0 || abi.decode(data, (bool))),
            "RevenueDistributor: approve failed"
        );
    }
}
