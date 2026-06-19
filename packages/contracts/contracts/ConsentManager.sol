// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./IConsentManager.sol";

/**
 * @title ConsentManager
 * @notice Manages driver data access permissions on-chain for the SafeDrive Protocol.
 * @dev Implements bitmask-based data categories and time-bound consent grants.
 *
 * Data Categories (bitmask):
 *   0x01 = Safety Score only
 *   0x02 = Trip history
 *   0x04 = Delivery metrics
 *   0x08 = Insurance data
 *
 * Requirements covered: 5.3, 5.4, 5.6, 5.8, 7.9, 14.1, 14.2, 14.3, 14.10
 */
contract ConsentManager is IConsentManager, Ownable {
    // ─── Constants ───────────────────────────────────────────────────────────────

    /// @notice Maximum consent duration: 12 months (365 days).
    uint256 public constant MAX_DURATION = 365 days;

    /// @notice Valid data category bitmask (all valid bits combined).
    uint8 public constant VALID_CATEGORIES_MASK = 0x0F; // 0x01 | 0x02 | 0x04 | 0x08

    // ─── Storage ─────────────────────────────────────────────────────────────────

    /// @dev Mapping: driver => party => ConsentGrant
    mapping(address => mapping(bytes32 => ConsentGrant)) private _grants;

    /// @dev Mapping: driver => list of parties they have granted consent to (for enumeration)
    mapping(address => bytes32[]) private _driverParties;

    /// @dev Mapping: driver => party => index in _driverParties array (for tracking)
    mapping(address => mapping(bytes32 => uint256)) private _partyIndex;

    /// @dev Mapping: driver => whether party exists in _driverParties
    mapping(address => mapping(bytes32 => bool)) private _partyExists;

    /// @dev Mapping: driver => accountability opt-in status
    mapping(address => bool) private _accountabilityOptIn;

    // ─── Constructor ─────────────────────────────────────────────────────────────

    constructor() Ownable(msg.sender) {}

    // ─── External Functions ──────────────────────────────────────────────────────

    /// @inheritdoc IConsentManager
    function grantConsent(bytes32 party, uint8 categories, uint256 duration) external override {
        require(party != bytes32(0), "ConsentManager: party cannot be zero");
        require(categories != 0, "ConsentManager: categories cannot be zero");
        require(categories & ~VALID_CATEGORIES_MASK == 0, "ConsentManager: invalid categories");
        require(duration > 0, "ConsentManager: duration must be positive");
        require(duration <= MAX_DURATION, "ConsentManager: duration exceeds 12-month cap");

        uint256 expiresAt = block.timestamp + duration;

        _grants[msg.sender][party] = ConsentGrant({
            driver: msg.sender,
            authorizedParty: party,
            dataCategories: categories,
            grantedAt: block.timestamp,
            expiresAt: expiresAt,
            revoked: false
        });

        // Track the party for enumeration if not already tracked
        if (!_partyExists[msg.sender][party]) {
            _partyIndex[msg.sender][party] = _driverParties[msg.sender].length;
            _driverParties[msg.sender].push(party);
            _partyExists[msg.sender][party] = true;
        }

        emit ConsentGranted(msg.sender, party, categories, expiresAt);
    }

    /// @inheritdoc IConsentManager
    function revokeConsent(bytes32 party) external override {
        require(party != bytes32(0), "ConsentManager: party cannot be zero");
        require(_partyExists[msg.sender][party], "ConsentManager: no grant exists for party");

        ConsentGrant storage grant = _grants[msg.sender][party];
        require(!grant.revoked, "ConsentManager: already revoked");

        grant.revoked = true;

        emit ConsentRevoked(msg.sender, party);
    }

    /// @inheritdoc IConsentManager
    function checkConsent(
        address driver,
        bytes32 party,
        uint8 category
    ) external view override returns (bool) {
        ConsentGrant storage grant = _grants[driver][party];

        // Must not be revoked
        if (grant.revoked) {
            return false;
        }

        // Must not be expired
        if (block.timestamp >= grant.expiresAt) {
            return false;
        }

        // Must have been granted (grantedAt > 0 means it exists)
        if (grant.grantedAt == 0) {
            return false;
        }

        // Check that the requested category is included in the granted categories
        if (grant.dataCategories & category != category) {
            return false;
        }

        // Category must be valid (non-zero and within valid mask)
        if (category == 0 || category & ~VALID_CATEGORIES_MASK != 0) {
            return false;
        }

        return true;
    }

    /// @inheritdoc IConsentManager
    function getActiveGrants(address driver) external view override returns (ConsentGrant[] memory) {
        bytes32[] storage parties = _driverParties[driver];
        uint256 totalParties = parties.length;

        // First pass: count active grants
        uint256 activeCount = 0;
        for (uint256 i = 0; i < totalParties; i++) {
            ConsentGrant storage grant = _grants[driver][parties[i]];
            if (!grant.revoked && block.timestamp < grant.expiresAt && grant.grantedAt > 0) {
                activeCount++;
            }
        }

        // Second pass: populate the result array
        ConsentGrant[] memory activeGrants = new ConsentGrant[](activeCount);
        uint256 index = 0;
        for (uint256 i = 0; i < totalParties; i++) {
            ConsentGrant storage grant = _grants[driver][parties[i]];
            if (!grant.revoked && block.timestamp < grant.expiresAt && grant.grantedAt > 0) {
                activeGrants[index] = grant;
                index++;
            }
        }

        return activeGrants;
    }

    /// @inheritdoc IConsentManager
    function optInAccountability() external override {
        require(!_accountabilityOptIn[msg.sender], "ConsentManager: already opted in");

        _accountabilityOptIn[msg.sender] = true;

        emit AccountabilityOptIn(msg.sender);
    }

    /// @inheritdoc IConsentManager
    function optOutAccountability() external override {
        require(_accountabilityOptIn[msg.sender], "ConsentManager: not opted in");

        _accountabilityOptIn[msg.sender] = false;

        emit AccountabilityOptOut(msg.sender);
    }

    // ─── View Functions ──────────────────────────────────────────────────────────

    /// @notice Returns whether a driver has opted into accountability data sharing.
    /// @param driver The driver's address.
    /// @return True if the driver is opted in.
    function isAccountabilityOptedIn(address driver) external view returns (bool) {
        return _accountabilityOptIn[driver];
    }
}
