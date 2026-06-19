// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IDVXToken
 * @notice Interface for the externally-deployed DVX Token contract.
 * @dev The DVX Token is deployed via Bankr Bot using the Doppler Protocol on Base.
 *      The protocol does NOT deploy or own the token contract — Bankr handles deployment
 *      with 100% of the fixed 100 billion supply placed into a Uniswap V4 liquidity pool.
 *
 *      Key properties enforced by Bankr Bot / Doppler Protocol:
 *      - Fixed supply: 100,000,000,000 DVX (100 billion, 18 decimals)
 *      - NO mint() function — supply can only decrease via burns
 *      - 100% of supply in Uniswap V4 pool at deployment (no pre-allocations)
 *      - Liquidity locked automatically — non-removable by any party
 *      - 1.2% swap fee: 57% to Protocol (Revenue Distributor), 36.1% to Bankr,
 *        1.9% to Bankr Ecosystem, 5% to Doppler Protocol
 *
 * Requirements: 4.1, 4.2, 4.3, 4.11, 12.1, 12.2, 12.3, 12.4
 */
interface IDVXToken {
    // -------------------------------------------------------------------------
    // Standard ERC-20 read functions
    // -------------------------------------------------------------------------

    /// @notice Returns the total fixed supply of DVX tokens.
    /// @dev Always returns 100,000,000,000 * 10^18 minus any burned tokens.
    ///      Supply can only decrease — there is no mint function.
    function totalSupply() external view returns (uint256);

    /// @notice Returns the DVX token balance of an account.
    function balanceOf(address account) external view returns (uint256);

    /// @notice Returns the remaining allowance a spender has from an owner.
    function allowance(address owner, address spender) external view returns (uint256);

    /// @notice Returns the token name ("DrivX").
    function name() external view returns (string memory);

    /// @notice Returns the token symbol ("DVX").
    function symbol() external view returns (string memory);

    /// @notice Returns the number of decimals (18).
    function decimals() external view returns (uint8);

    // -------------------------------------------------------------------------
    // Standard ERC-20 write functions (used by protocol contracts)
    // -------------------------------------------------------------------------

    /// @notice Transfers DVX tokens to a recipient.
    function transfer(address to, uint256 amount) external returns (bool);

    /// @notice Approves a spender to transfer tokens on behalf of the caller.
    function approve(address spender, uint256 amount) external returns (bool);

    /// @notice Transfers tokens from one address to another using an allowance.
    function transferFrom(address from, address to, uint256 amount) external returns (bool);

    // -------------------------------------------------------------------------
    // Burn function (deflationary mechanics)
    // -------------------------------------------------------------------------

    /// @notice Permanently destroys DVX tokens, reducing total supply.
    /// @dev Called by governance for deflationary buyback-and-burn mechanics.
    ///      Only the token holder can burn their own tokens.
    ///      There is NO mint function to counteract burns.
    function burn(uint256 amount) external;

    // -------------------------------------------------------------------------
    // Standard ERC-20 events
    // -------------------------------------------------------------------------

    /// @notice Emitted on every token transfer (including mints and burns).
    event Transfer(address indexed from, address indexed to, uint256 value);

    /// @notice Emitted when an allowance is set via approve().
    event Approval(address indexed owner, address indexed spender, uint256 value);
}
