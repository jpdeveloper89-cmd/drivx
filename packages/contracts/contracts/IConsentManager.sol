// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IConsentManager
 * @notice Interface for the SafeDrive Protocol Consent Manager.
 * @dev Manages driver data access permissions on-chain with bitmask-based
 *      data categories and time-bound consent grants.
 */
interface IConsentManager {
    /// @notice Represents a single consent grant from a driver to an authorized party.
    struct ConsentGrant {
        address driver;
        bytes32 authorizedParty; // Hashed identifier of the party
        uint8 dataCategories; // Bitmask: 0x01=Score, 0x02=Trips, 0x04=Delivery, 0x08=Insurance
        uint256 grantedAt;
        uint256 expiresAt;
        bool revoked;
    }

    /// @notice Grants consent to a party for specific data categories with a duration.
    /// @param party The hashed identifier of the authorized party.
    /// @param categories Bitmask of data categories to grant access to.
    /// @param duration Duration in seconds for the consent (max 12 months).
    function grantConsent(bytes32 party, uint8 categories, uint256 duration) external;

    /// @notice Revokes consent for a specific party immediately.
    /// @param party The hashed identifier of the party to revoke.
    function revokeConsent(bytes32 party) external;

    /// @notice Checks if a driver has active consent for a party and category.
    /// @param driver The driver's address.
    /// @param party The hashed identifier of the authorized party.
    /// @param category The specific data category bitmask to check.
    /// @return True if consent is active, non-expired, and non-revoked.
    function checkConsent(address driver, bytes32 party, uint8 category) external view returns (bool);

    /// @notice Returns all active consent grants for a driver.
    /// @param driver The driver's address.
    /// @return An array of active ConsentGrant structs.
    function getActiveGrants(address driver) external view returns (ConsentGrant[] memory);

    /// @notice Opts the caller into accountability data sharing.
    function optInAccountability() external;

    /// @notice Opts the caller out of accountability data sharing.
    function optOutAccountability() external;

    /// @notice Emitted when consent is granted.
    event ConsentGranted(address indexed driver, bytes32 indexed party, uint8 categories, uint256 expiresAt);

    /// @notice Emitted when consent is revoked.
    event ConsentRevoked(address indexed driver, bytes32 indexed party);

    /// @notice Emitted when a driver opts into accountability.
    event AccountabilityOptIn(address indexed driver);

    /// @notice Emitted when a driver opts out of accountability.
    event AccountabilityOptOut(address indexed driver);
}
