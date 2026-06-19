// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/**
 * @title ISafetyRegistry
 * @notice Interface for the SafeDrive Protocol Safety Registry contract.
 */
interface ISafetyRegistry {
    struct DrivingIdentity {
        uint256 safetyScore; // 0-1000
        uint256 totalTrips;
        uint256 totalKilometers;
        uint256 tenureStartDate;
        uint256 lastUpdated;
        bytes32 categoryBreakdown; // Encoded: commute, delivery, rideshare, long-distance
        bool isVerified; // true after 10 trips / 100 km
    }

    struct DeliveryProfile {
        uint256 totalDeliveries;
        uint256 onTimeRate; // basis points (0-10000)
        uint256 avgCompletionTime; // seconds
        uint256 merchantRating; // 1-5 scaled to 100-500
        uint256 recipientRating; // 1-5 scaled to 100-500
        bytes32 specializations; // Encoded categories
    }

    function updateSafetyScore(address driver, uint256 newScore, uint256 tripCount, uint256 km) external;
    function getDrivingIdentity(address driver) external view returns (DrivingIdentity memory);
    function getDeliveryProfile(address driver) external view returns (DeliveryProfile memory);
    function verifyIdentity(address driver) external view returns (uint256 score, bool verified);
    function generateCredential(address driver) external returns (bytes memory signedCredential);
    function batchVerify(address[] calldata drivers) external view returns (uint256[] memory scores);

    event ScoreUpdated(address indexed driver, uint256 newScore, uint256 tripCount);
    event IdentityVerified(address indexed driver);
    event CredentialGenerated(address indexed driver, bytes32 credentialHash);
}

/**
 * @title SafetyRegistry
 * @notice Stores and manages verified Driver Safety_Score records and driving identity.
 * @dev Implements ISafetyRegistry. Only authorized backend oracle can update scores.
 *      Drivers start as "Provisional" until 10 trips / 100 km threshold is met.
 */
contract SafetyRegistry is ISafetyRegistry, Ownable {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    /// @notice Maximum safety score value
    uint256 public constant MAX_SCORE = 1000;

    /// @notice Minimum trips required for verified status
    uint256 public constant MIN_TRIPS_FOR_VERIFICATION = 10;

    /// @notice Minimum kilometers required for verified status
    uint256 public constant MIN_KM_FOR_VERIFICATION = 100;

    /// @notice Maximum addresses allowed in a single batchVerify call
    uint256 public constant MAX_BATCH_SIZE = 1000;

    /// @notice Credential validity duration (30 days)
    uint256 public constant CREDENTIAL_VALIDITY = 30 days;

    /// @notice Authorized backend oracle address that can update scores
    address public oracle;

    /// @notice Signer address used for generating credentials
    address public credentialSigner;

    /// @notice Private key holder for credential signing (stored off-chain, this is the signer address)
    /// @dev The actual signing happens via the signer's private key off-chain or via this contract

    /// @notice Mapping of driver address to their DrivingIdentity
    mapping(address => DrivingIdentity) private _identities;

    /// @notice Mapping of driver address to their DeliveryProfile
    mapping(address => DeliveryProfile) private _deliveryProfiles;

    /// @notice Nonce for credential generation to ensure uniqueness
    mapping(address => uint256) private _credentialNonces;

    /// @notice Modifier to restrict access to the authorized oracle
    modifier onlyOracle() {
        require(msg.sender == oracle, "SafetyRegistry: caller is not the oracle");
        _;
    }

    /**
     * @notice Initializes the SafetyRegistry contract.
     * @param _oracle The authorized backend oracle address.
     * @param _credentialSigner The address used for signing credentials.
     */
    constructor(address _oracle, address _credentialSigner) Ownable(msg.sender) {
        require(_oracle != address(0), "SafetyRegistry: oracle is zero address");
        require(_credentialSigner != address(0), "SafetyRegistry: signer is zero address");
        oracle = _oracle;
        credentialSigner = _credentialSigner;
    }

    /**
     * @notice Updates the oracle address. Only callable by the owner.
     * @param _newOracle The new oracle address.
     */
    function setOracle(address _newOracle) external onlyOwner {
        require(_newOracle != address(0), "SafetyRegistry: oracle is zero address");
        oracle = _newOracle;
    }

    /**
     * @notice Updates the credential signer address. Only callable by the owner.
     * @param _newSigner The new credential signer address.
     */
    function setCredentialSigner(address _newSigner) external onlyOwner {
        require(_newSigner != address(0), "SafetyRegistry: signer is zero address");
        credentialSigner = _newSigner;
    }

    /**
     * @notice Updates a driver's safety score. Only callable by the authorized oracle.
     * @param driver The driver's wallet address.
     * @param newScore The new safety score (0-1000).
     * @param tripCount The updated total trip count.
     * @param km The updated total kilometers driven.
     */
    function updateSafetyScore(
        address driver,
        uint256 newScore,
        uint256 tripCount,
        uint256 km
    ) external onlyOracle {
        require(driver != address(0), "SafetyRegistry: driver is zero address");
        require(newScore <= MAX_SCORE, "SafetyRegistry: score exceeds maximum");

        DrivingIdentity storage identity = _identities[driver];

        // Set tenure start date on first update
        if (identity.tenureStartDate == 0) {
            identity.tenureStartDate = block.timestamp;
        }

        identity.safetyScore = newScore;
        identity.totalTrips = tripCount;
        identity.totalKilometers = km;
        identity.lastUpdated = block.timestamp;

        // Check verification threshold: 10 trips AND 100 km
        bool wasVerified = identity.isVerified;
        if (!wasVerified && tripCount >= MIN_TRIPS_FOR_VERIFICATION && km >= MIN_KM_FOR_VERIFICATION) {
            identity.isVerified = true;
            emit IdentityVerified(driver);
        }

        emit ScoreUpdated(driver, newScore, tripCount);
    }

    /**
     * @notice Retrieves the full DrivingIdentity for a driver.
     * @param driver The driver's wallet address.
     * @return The DrivingIdentity struct for the driver.
     */
    function getDrivingIdentity(address driver) external view returns (DrivingIdentity memory) {
        return _identities[driver];
    }

    /**
     * @notice Retrieves the DeliveryProfile for a driver.
     * @param driver The driver's wallet address.
     * @return The DeliveryProfile struct for the driver.
     */
    function getDeliveryProfile(address driver) external view returns (DeliveryProfile memory) {
        return _deliveryProfiles[driver];
    }

    /**
     * @notice Verifies a driver's identity, returning their score and verification status.
     * @param driver The driver's wallet address.
     * @return score The driver's current safety score.
     * @return verified Whether the driver has met the verification threshold.
     */
    function verifyIdentity(address driver) external view returns (uint256 score, bool verified) {
        DrivingIdentity storage identity = _identities[driver];
        return (identity.safetyScore, identity.isVerified);
    }

    /**
     * @notice Generates a signed credential attestation for a driver, valid for 30 days.
     * @dev The credential contains the driver's address, score, trips, tenure, and expiry.
     *      The credential is signed using the contract's credentialSigner.
     * @param driver The driver's wallet address.
     * @return signedCredential The ABI-encoded credential data with signature placeholder.
     */
    function generateCredential(address driver) external returns (bytes memory signedCredential) {
        DrivingIdentity storage identity = _identities[driver];
        require(identity.tenureStartDate != 0, "SafetyRegistry: identity not found");

        uint256 nonce = _credentialNonces[driver];
        _credentialNonces[driver] = nonce + 1;

        uint256 issuedAt = block.timestamp;
        uint256 expiresAt = issuedAt + CREDENTIAL_VALIDITY;

        // Encode the credential data
        bytes memory credentialData = abi.encode(
            driver,
            identity.safetyScore,
            identity.totalTrips,
            identity.totalKilometers,
            identity.tenureStartDate,
            identity.isVerified,
            issuedAt,
            expiresAt,
            nonce
        );

        bytes32 credentialHash = keccak256(credentialData);

        emit CredentialGenerated(driver, credentialHash);

        // Return the credential data (signing happens off-chain by credentialSigner)
        signedCredential = abi.encode(credentialData, credentialHash, credentialSigner, expiresAt);
    }

    /**
     * @notice Batch verifies multiple drivers, returning their safety scores.
     * @dev Supports up to 1000 addresses per call.
     * @param drivers Array of driver wallet addresses to verify.
     * @return scores Array of safety scores corresponding to each driver.
     */
    function batchVerify(address[] calldata drivers) external view returns (uint256[] memory scores) {
        require(drivers.length <= MAX_BATCH_SIZE, "SafetyRegistry: batch size exceeds maximum");

        scores = new uint256[](drivers.length);
        for (uint256 i = 0; i < drivers.length; i++) {
            scores[i] = _identities[drivers[i]].safetyScore;
        }
    }

    /**
     * @notice Updates a driver's category breakdown. Only callable by the oracle.
     * @param driver The driver's wallet address.
     * @param categoryBreakdown Encoded category data (commute, delivery, rideshare, long-distance).
     */
    function updateCategoryBreakdown(address driver, bytes32 categoryBreakdown) external onlyOracle {
        require(driver != address(0), "SafetyRegistry: driver is zero address");
        _identities[driver].categoryBreakdown = categoryBreakdown;
    }

    /**
     * @notice Updates a driver's delivery profile. Only callable by the oracle.
     * @param driver The driver's wallet address.
     * @param totalDeliveries Total number of verified deliveries.
     * @param onTimeRate On-time delivery rate in basis points (0-10000).
     * @param avgCompletionTime Average completion time in seconds.
     * @param merchantRating Merchant rating scaled to 100-500.
     * @param recipientRating Recipient rating scaled to 100-500.
     * @param specializations Encoded delivery category specializations.
     */
    function updateDeliveryProfile(
        address driver,
        uint256 totalDeliveries,
        uint256 onTimeRate,
        uint256 avgCompletionTime,
        uint256 merchantRating,
        uint256 recipientRating,
        bytes32 specializations
    ) external onlyOracle {
        require(driver != address(0), "SafetyRegistry: driver is zero address");
        require(onTimeRate <= 10000, "SafetyRegistry: onTimeRate exceeds basis points max");
        require(merchantRating >= 100 && merchantRating <= 500, "SafetyRegistry: invalid merchant rating");
        require(recipientRating >= 100 && recipientRating <= 500, "SafetyRegistry: invalid recipient rating");

        DeliveryProfile storage profile = _deliveryProfiles[driver];
        profile.totalDeliveries = totalDeliveries;
        profile.onTimeRate = onTimeRate;
        profile.avgCompletionTime = avgCompletionTime;
        profile.merchantRating = merchantRating;
        profile.recipientRating = recipientRating;
        profile.specializations = specializations;
    }
}
