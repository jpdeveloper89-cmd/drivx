// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./IDVXToken.sol";

/**
 * @title IStakingContract
 * @notice Interface for the SafeDrive Protocol Staking Contract.
 * Requirements: 4.5, 4.6, 4.7, 4.8, 4.9, 12.12
 */
interface IStakingContract {
    struct StakeInfo {
        uint256 amount;           // DVX staked
        uint256 stakedAt;         // timestamp when staked
        uint256 unstakeRequestedAt; // 0 if not requested
        uint256 cooldownEndsAt;   // timestamp when unstake is claimable
    }

    function stake(uint256 amount) external;
    function requestUnstake(uint256 amount) external;
    function completeUnstake() external;
    function claimRevenue() external;
    function getStakeInfo(address staker) external view returns (StakeInfo memory);
    function totalStaked() external view returns (uint256);

    event Staked(address indexed staker, uint256 amount);
    event UnstakeRequested(address indexed staker, uint256 amount, uint256 cooldownEndsAt);
    event UnstakeCompleted(address indexed staker, uint256 amount);
    event RevenueClaimed(address indexed staker, uint256 usdcAmount, uint256 wethAmount, uint256 dvxAmount);
}

/**
 * @title StakingContract
 * @notice Allows DVX holders to stake tokens and earn revenue share.
 *
 * Rules:
 * - Minimum stake: 100 DVX
 * - Stakers begin accruing revenue from the next distribution period
 * - requestUnstake() stops accrual immediately, starts 7-day cooldown
 * - completeUnstake() releases tokens after cooldown
 * - claimRevenue() transfers accumulated rewards without affecting stake
 * - Accumulated revenue never forfeits regardless of time elapsed
 *
 * Requirements: 4.5, 4.6, 4.7, 4.8, 4.9, 12.12
 */
contract StakingContract is IStakingContract, ReentrancyGuard {
    /// @notice Minimum DVX required to stake
    uint256 public constant MIN_STAKE = 100 * 10 ** 18;

    /// @notice Cooldown period after requestUnstake before tokens can be withdrawn
    uint256 public constant UNSTAKE_COOLDOWN = 7 days;

    /// @notice The DVX token contract
    IDVXToken public immutable dvxToken;

    /// @notice The Revenue Distributor contract (only it can credit revenue)
    address public immutable revenueDistributor;

    /// @notice Total DVX currently staked across all stakers
    uint256 private _totalStaked;

    /// @notice Stake info per staker
    mapping(address => StakeInfo) private _stakes;

    /// @notice Pending unstake amounts per staker
    mapping(address => uint256) private _pendingUnstake;

    /// @notice Accumulated USDC revenue per staker (not yet claimed)
    mapping(address => uint256) private _pendingUSDC;

    /// @notice Accumulated WETH revenue per staker (not yet claimed)
    mapping(address => uint256) private _pendingWETH;

    /// @notice Accumulated DVX revenue per staker (not yet claimed)
    mapping(address => uint256) private _pendingDVX;

    /// @notice USDC token address
    address public immutable usdc;

    /// @notice WETH token address
    address public immutable weth;

    modifier onlyRevenueDistributor() {
        require(msg.sender == revenueDistributor, "StakingContract: caller is not revenue distributor");
        _;
    }

    /**
     * @param _dvxToken Address of the DVX token contract
     * @param _revenueDistributor Address of the Revenue Distributor contract
     * @param _usdc Address of the USDC token
     * @param _weth Address of the WETH token
     */
    constructor(
        address _dvxToken,
        address _revenueDistributor,
        address _usdc,
        address _weth
    ) {
        require(_dvxToken != address(0), "StakingContract: zero dvx address");
        require(_revenueDistributor != address(0), "StakingContract: zero distributor address");
        require(_usdc != address(0), "StakingContract: zero usdc address");
        require(_weth != address(0), "StakingContract: zero weth address");

        dvxToken = IDVXToken(_dvxToken);
        revenueDistributor = _revenueDistributor;
        usdc = _usdc;
        weth = _weth;
    }

    /**
     * @notice Stake DVX tokens to begin earning revenue.
     * @dev Minimum 100 DVX. Revenue accrual starts from next distribution period.
     * @param amount Amount of DVX to stake (must be >= MIN_STAKE for new stakers)
     */
    function stake(uint256 amount) external nonReentrant {
        require(amount > 0, "StakingContract: amount must be > 0");

        StakeInfo storage info = _stakes[msg.sender];
        uint256 newTotal = info.amount + amount;
        require(newTotal >= MIN_STAKE, "StakingContract: below minimum stake of 100 DVX");

        // Transfer DVX from staker to this contract
        require(
            dvxToken.transferFrom(msg.sender, address(this), amount),
            "StakingContract: DVX transfer failed"
        );

        info.amount = newTotal;
        if (info.stakedAt == 0) {
            info.stakedAt = block.timestamp;
        }

        _totalStaked += amount;

        emit Staked(msg.sender, amount);
    }

    /**
     * @notice Request to unstake DVX. Stops revenue accrual immediately.
     * @dev Starts a 7-day cooldown. Tokens are locked until completeUnstake().
     * @param amount Amount of DVX to unstake
     */
    function requestUnstake(uint256 amount) external nonReentrant {
        StakeInfo storage info = _stakes[msg.sender];
        require(amount > 0, "StakingContract: amount must be > 0");
        require(info.amount >= amount, "StakingContract: insufficient staked balance");
        require(info.unstakeRequestedAt == 0, "StakingContract: unstake already pending");

        // Remaining stake must be 0 or >= MIN_STAKE
        uint256 remaining = info.amount - amount;
        require(remaining == 0 || remaining >= MIN_STAKE, "StakingContract: remaining stake below minimum");

        info.amount -= amount;
        info.unstakeRequestedAt = block.timestamp;
        info.cooldownEndsAt = block.timestamp + UNSTAKE_COOLDOWN;
        _pendingUnstake[msg.sender] = amount;
        _totalStaked -= amount;

        emit UnstakeRequested(msg.sender, amount, info.cooldownEndsAt);
    }

    /**
     * @notice Complete an unstake after the 7-day cooldown has elapsed.
     * @dev Transfers the pending DVX back to the staker.
     */
    function completeUnstake() external nonReentrant {
        StakeInfo storage info = _stakes[msg.sender];
        require(info.unstakeRequestedAt != 0, "StakingContract: no pending unstake");
        require(block.timestamp >= info.cooldownEndsAt, "StakingContract: cooldown not elapsed");

        uint256 amount = _pendingUnstake[msg.sender];
        require(amount > 0, "StakingContract: nothing to unstake");

        // Clear pending unstake state
        _pendingUnstake[msg.sender] = 0;
        info.unstakeRequestedAt = 0;
        info.cooldownEndsAt = 0;

        // Transfer DVX back to staker
        require(dvxToken.transfer(msg.sender, amount), "StakingContract: DVX transfer failed");

        emit UnstakeCompleted(msg.sender, amount);
    }

    /**
     * @notice Claim accumulated revenue (USDC + WETH + DVX) without affecting stake.
     * @dev Revenue never forfeits — it accumulates until claimed.
     */
    function claimRevenue() external nonReentrant {
        uint256 usdcAmount = _pendingUSDC[msg.sender];
        uint256 wethAmount = _pendingWETH[msg.sender];
        uint256 dvxAmount = _pendingDVX[msg.sender];

        require(
            usdcAmount > 0 || wethAmount > 0 || dvxAmount > 0,
            "StakingContract: no revenue to claim"
        );

        // Clear pending balances before transfer (reentrancy protection)
        _pendingUSDC[msg.sender] = 0;
        _pendingWETH[msg.sender] = 0;
        _pendingDVX[msg.sender] = 0;

        // Transfer USDC
        if (usdcAmount > 0) {
            _safeTransferERC20(usdc, msg.sender, usdcAmount);
        }

        // Transfer WETH
        if (wethAmount > 0) {
            _safeTransferERC20(weth, msg.sender, wethAmount);
        }

        // Transfer DVX
        if (dvxAmount > 0) {
            require(dvxToken.transfer(msg.sender, dvxAmount), "StakingContract: DVX transfer failed");
        }

        emit RevenueClaimed(msg.sender, usdcAmount, wethAmount, dvxAmount);
    }

    /**
     * @notice Credit revenue to a staker. Only callable by the Revenue Distributor.
     * @dev Revenue accumulates and never forfeits.
     */
    function creditRevenue(
        address staker,
        uint256 usdcAmount,
        uint256 wethAmount,
        uint256 dvxAmount
    ) external onlyRevenueDistributor {
        if (usdcAmount > 0) _pendingUSDC[staker] += usdcAmount;
        if (wethAmount > 0) _pendingWETH[staker] += wethAmount;
        if (dvxAmount > 0) _pendingDVX[staker] += dvxAmount;
    }

    /**
     * @notice Returns stake info for a given staker.
     */
    function getStakeInfo(address staker) external view returns (StakeInfo memory) {
        return _stakes[staker];
    }

    /**
     * @notice Returns total DVX currently staked.
     */
    function totalStaked() external view returns (uint256) {
        return _totalStaked;
    }

    /**
     * @notice Returns pending revenue for a staker.
     */
    function getPendingRevenue(address staker)
        external
        view
        returns (uint256 usdcAmount, uint256 wethAmount, uint256 dvxAmount)
    {
        return (_pendingUSDC[staker], _pendingWETH[staker], _pendingDVX[staker]);
    }

    /**
     * @notice Returns pending unstake amount for a staker.
     */
    function getPendingUnstake(address staker) external view returns (uint256) {
        return _pendingUnstake[staker];
    }

    /**
     * @dev Safe ERC-20 transfer using low-level call to handle non-standard tokens.
     */
    function _safeTransferERC20(address token, address to, uint256 amount) internal {
        (bool success, bytes memory data) = token.call(
            abi.encodeWithSignature("transfer(address,uint256)", to, amount)
        );
        require(
            success && (data.length == 0 || abi.decode(data, (bool))),
            "StakingContract: ERC20 transfer failed"
        );
    }
}
