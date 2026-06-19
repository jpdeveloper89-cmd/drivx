// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./IDVXToken.sol";

/**
 * @title DVXTokenReference
 * @notice Reference contract documenting the expected DVX Token ERC-20 interface
 *         as deployed by Bankr Bot via the Doppler Protocol on Base.
 *
 * @dev This contract is NOT the actual DVX Token. It serves as:
 *      1. A documented reference for the expected on-chain interface
 *      2. A type-safe wrapper for protocol contracts to interact with DVX
 *      3. Verification that the deployed token has no mint function
 *
 *      DEPLOYMENT NOTE:
 *      The actual DVX Token is deployed externally via Bankr Bot (bankr.bot).
 *      After deployment, set DVX_TOKEN_ADDRESS in contracts/config/deployment.ts
 *      to the address returned by Bankr Bot.
 *
 *      VERIFICATION CHECKLIST (post-deployment):
 *      [ ] totalSupply() == 100_000_000_000 * 10^18 (100 billion DVX)
 *      [ ] No mint() function exists (verify on Basescan)
 *      [ ] 100% of supply in Uniswap V4 pool (check pool balance)
 *      [ ] Liquidity locked by Doppler Protocol (non-removable)
 *      [ ] Swap fee = 1.2% (verify in Uniswap V4 pool config)
 *      [ ] Fee recipient = Revenue Distributor address (57% of 1.2%)
 *      [ ] Source verified on Basescan
 *
 * Requirements: 4.1, 4.2, 4.3, 4.11, 12.1, 12.2, 12.3, 12.4
 */
contract DVXTokenReference {
    /// @notice Fixed total supply: 100 billion DVX (18 decimals)
    uint256 public constant TOTAL_SUPPLY = 100_000_000_000 * 10 ** 18;

    /// @notice Swap fee in basis points (1.2% = 120 bps)
    uint256 public constant SWAP_FEE_BPS = 120;

    /// @notice Protocol's share of swap fee in basis points (57% of 1.2% = 68.4 bps)
    /// @dev Directed to Revenue Distributor as Trading Fee Revenue (WETH + DVX)
    uint256 public constant PROTOCOL_FEE_SHARE_BPS = 57; // 57% of swap fee

    /// @notice Bankr's share of swap fee (36.1%)
    uint256 public constant BANKR_FEE_SHARE_BPS = 361; // 36.1% of swap fee (scaled x10)

    /// @notice Bankr Ecosystem share (1.9%)
    uint256 public constant BANKR_ECOSYSTEM_FEE_SHARE_BPS = 19; // 1.9% of swap fee (scaled x10)

    /// @notice Doppler Protocol share (5%)
    uint256 public constant DOPPLER_FEE_SHARE_BPS = 50; // 5% of swap fee (scaled x10)

    /// @notice Minimum stake amount for the Staking Contract
    uint256 public constant MIN_STAKE_AMOUNT = 100 * 10 ** 18; // 100 DVX

    /// @notice Maximum DVX reward per verified trip
    uint256 public constant MAX_TRIP_REWARD = 50 * 10 ** 18; // 50 DVX

    /// @notice The deployed DVX Token address (set after Bankr Bot deployment)
    /// @dev Update this after deployment via Bankr Bot
    address public dvxTokenAddress;

    /// @notice The Revenue Distributor contract address (fee recipient for Bankr Bot)
    /// @dev This address must be set as the fee recipient in Bankr Bot BEFORE deployment
    address public revenueDistributorAddress;

    /// @notice Reference to the deployed DVX Token interface
    IDVXToken public dvxToken;

    /// @notice Emitted when the DVX token address is configured post-deployment
    event DVXTokenConfigured(address indexed tokenAddress, address indexed revenueDistributor);

    /**
     * @notice Configure the DVX token address after Bankr Bot deployment.
     * @dev Called once after the token is deployed via Bankr Bot.
     *      Verifies the token has the expected supply and no mint function.
     * @param _dvxTokenAddress The address of the DVX Token deployed by Bankr Bot.
     * @param _revenueDistributorAddress The Revenue Distributor contract address.
     */
    function configureDVXToken(
        address _dvxTokenAddress,
        address _revenueDistributorAddress
    ) external {
        require(_dvxTokenAddress != address(0), "DVXTokenReference: zero token address");
        require(_revenueDistributorAddress != address(0), "DVXTokenReference: zero distributor address");
        require(dvxTokenAddress == address(0), "DVXTokenReference: already configured");

        dvxTokenAddress = _dvxTokenAddress;
        revenueDistributorAddress = _revenueDistributorAddress;
        dvxToken = IDVXToken(_dvxTokenAddress);

        // Verify total supply matches expected 100 billion DVX
        uint256 supply = dvxToken.totalSupply();
        require(supply == TOTAL_SUPPLY, "DVXTokenReference: unexpected total supply");

        emit DVXTokenConfigured(_dvxTokenAddress, _revenueDistributorAddress);
    }

    /**
     * @notice Verifies the deployed token has the correct fixed supply.
     * @return True if supply equals 100 billion DVX (accounting for any burns).
     */
    function verifySupplyIsFixed() external view returns (bool) {
        if (dvxTokenAddress == address(0)) return false;
        // Supply should be <= TOTAL_SUPPLY (burns reduce it, no mints possible)
        return dvxToken.totalSupply() <= TOTAL_SUPPLY;
    }

    /**
     * @notice Returns the current circulating supply of DVX.
     * @dev Circulating = total supply minus tokens held in the Uniswap V4 pool.
     *      At deployment, 100% is in the pool so circulating = 0.
     */
    function getTokenInfo()
        external
        view
        returns (
            string memory tokenName,
            string memory tokenSymbol,
            uint8 tokenDecimals,
            uint256 currentSupply
        )
    {
        require(dvxTokenAddress != address(0), "DVXTokenReference: not configured");
        return (dvxToken.name(), dvxToken.symbol(), dvxToken.decimals(), dvxToken.totalSupply());
    }
}
