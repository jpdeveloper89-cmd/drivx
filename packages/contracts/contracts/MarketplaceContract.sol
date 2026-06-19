// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./IDVXToken.sol";

/**
 * @title IMarketplaceContract
 * @notice Interface for the DrivX delivery marketplace.
 * Requirements: 6.3, 6.5, 6.6, 6.7
 */
interface IMarketplaceContract {
    struct Job {
        uint256 id;
        address business;
        address driver;
        string pickupLocation;
        string deliveryLocation;
        uint256 compensation; // in USDC (6 decimals)
        uint256 protocolFee; // 2–5% of compensation
        uint256 timeWindow; // delivery deadline (timestamp)
        uint256 gracePeriod; // 30 minutes after timeWindow
        JobStatus status;
        uint256 createdAt;
        uint256 acceptedAt;
        uint256 completedAt;
    }

    enum JobStatus {
        Open,
        Accepted,
        Completed,
        Cancelled,
        TimedOut
    }

    function postJob(string calldata pickup, string calldata delivery, uint256 compensation, uint256 timeWindow) external returns (uint256 jobId);
    function acceptJob(uint256 jobId) external;
    function completeDelivery(uint256 jobId) external;
    function cancelJob(uint256 jobId) external;

    event JobPosted(uint256 indexed jobId, address indexed business, uint256 compensation, uint256 timeWindow);
    event JobAccepted(uint256 indexed jobId, address indexed driver, uint256 timestamp);
    event DeliveryCompleted(uint256 indexed jobId, address indexed driver, uint256 compensation, uint256 protocolFee);
    event JobCancelled(uint256 indexed jobId, address indexed business);
    event JobTimedOut(uint256 indexed jobId, address indexed business, uint256 refundAmount);
}

/**
 * @title MarketplaceContract
 * @notice Delivery marketplace with escrow and protocol fee routing.
 *
 * Rules:
 * - Business posts job with compensation in USDC
 * - 2-5% protocol fee added (sent to Revenue Distributor)
 * - Driver accepts → job locked, escrow created
 * - Once accepted, no other driver can accept
 * - completeDelivery() releases payment to driver
 * - cancelJob() only before acceptance — releases escrow to business
 * - Timeout: if delivery not completed within timeWindow + 30 min grace → refund business
 * - Incomplete deliveries recorded on driver's profile
 *
 * Requirements: 6.3, 6.5, 6.6, 6.7
 */
contract MarketplaceContract is IMarketplaceContract, ReentrancyGuard {
    uint256 public constant GRACE_PERIOD = 30 minutes;
    uint256 public constant PROTOCOL_FEE_BPS = 300; // 3%
    uint256 public constant BPS_DENOMINATOR = 10000;

    address public immutable usdc;
    address public immutable revenueDistributor;

    uint256 public nextJobId = 1;
    mapping(uint256 => Job) public jobs;
    mapping(address => uint256) public incompleteDeliveries; // driver → count

    constructor(address _usdc, address _revenueDistributor) {
        require(_usdc != address(0), "Marketplace: zero usdc");
        require(_revenueDistributor != address(0), "Marketplace: zero distributor");
        usdc = _usdc;
        revenueDistributor = _revenueDistributor;
    }

    /**
     * @notice Post a new delivery job.
     * @dev Business must approve (compensation + protocolFee) in USDC to this contract first.
     */
    function postJob(
        string calldata pickup,
        string calldata delivery,
        uint256 compensation,
        uint256 timeWindow
    ) external nonReentrant returns (uint256 jobId) {
        require(compensation > 0, "Marketplace: compensation must be > 0");
        require(timeWindow > block.timestamp, "Marketplace: timeWindow must be in future");

        uint256 fee = (compensation * PROTOCOL_FEE_BPS) / BPS_DENOMINATOR;
        uint256 total = compensation + fee;

        // Transfer USDC from business to this contract (escrow)
        _safeTransferFromERC20(usdc, msg.sender, address(this), total);

        jobId = nextJobId++;
        jobs[jobId] = Job({
            id: jobId,
            business: msg.sender,
            driver: address(0),
            pickupLocation: pickup,
            deliveryLocation: delivery,
            compensation: compensation,
            protocolFee: fee,
            timeWindow: timeWindow,
            gracePeriod: GRACE_PERIOD,
            status: JobStatus.Open,
            createdAt: block.timestamp,
            acceptedAt: 0,
            completedAt: 0
        });

        emit JobPosted(jobId, msg.sender, compensation, timeWindow);
    }

    /**
     * @notice Accept a job. Locks it to this driver.
     * @dev Once accepted, no other driver can accept. Rejects if already accepted.
     */
    function acceptJob(uint256 jobId) external nonReentrant {
        Job storage job = jobs[jobId];
        require(job.id != 0, "Marketplace: job does not exist");
        require(job.status == JobStatus.Open, "Marketplace: job not open");
        require(msg.sender != job.business, "Marketplace: business cannot accept own job");

        job.driver = msg.sender;
        job.status = JobStatus.Accepted;
        job.acceptedAt = block.timestamp;

        emit JobAccepted(jobId, msg.sender, block.timestamp);
    }

    /**
     * @notice Complete delivery. Releases payment to driver, fee to Revenue Distributor.
     * @dev Only the assigned driver or the business (confirming receipt) can call.
     */
    function completeDelivery(uint256 jobId) external nonReentrant {
        Job storage job = jobs[jobId];
        require(job.id != 0, "Marketplace: job does not exist");
        require(job.status == JobStatus.Accepted, "Marketplace: job not accepted");
        require(
            msg.sender == job.driver || msg.sender == job.business,
            "Marketplace: caller not authorized"
        );

        job.status = JobStatus.Completed;
        job.completedAt = block.timestamp;

        // Pay driver
        _safeTransferERC20(usdc, job.driver, job.compensation);

        // Route protocol fee to Revenue Distributor
        _safeTransferERC20(usdc, revenueDistributor, job.protocolFee);

        emit DeliveryCompleted(jobId, job.driver, job.compensation, job.protocolFee);
    }

    /**
     * @notice Cancel a job. Only before acceptance. Refunds escrow to business.
     */
    function cancelJob(uint256 jobId) external nonReentrant {
        Job storage job = jobs[jobId];
        require(job.id != 0, "Marketplace: job does not exist");
        require(job.status == JobStatus.Open, "Marketplace: can only cancel open jobs");
        require(msg.sender == job.business, "Marketplace: only business can cancel");

        job.status = JobStatus.Cancelled;

        // Refund full escrow (compensation + fee)
        uint256 refund = job.compensation + job.protocolFee;
        _safeTransferERC20(usdc, job.business, refund);

        emit JobCancelled(jobId, msg.sender);
    }

    /**
     * @notice Claim timeout. If delivery not completed within timeWindow + grace period.
     * @dev Anyone can call. Refunds business and records incomplete on driver profile.
     */
    function claimTimeout(uint256 jobId) external nonReentrant {
        Job storage job = jobs[jobId];
        require(job.id != 0, "Marketplace: job does not exist");
        require(job.status == JobStatus.Accepted, "Marketplace: job not accepted");
        require(
            block.timestamp > job.timeWindow + job.gracePeriod,
            "Marketplace: deadline + grace not passed"
        );

        job.status = JobStatus.TimedOut;

        // Refund full escrow to business
        uint256 refund = job.compensation + job.protocolFee;
        _safeTransferERC20(usdc, job.business, refund);

        // Record incomplete delivery on driver's profile
        incompleteDeliveries[job.driver]++;

        emit JobTimedOut(jobId, job.business, refund);
    }

    /**
     * @notice Get job details.
     */
    function getJob(uint256 jobId) external view returns (Job memory) {
        return jobs[jobId];
    }

    // ─── Internal helpers ─────────────────────────────────────────────────────

    function _safeTransferERC20(address token, address to, uint256 amount) internal {
        (bool success, bytes memory data) = token.call(
            abi.encodeWithSignature("transfer(address,uint256)", to, amount)
        );
        require(success && (data.length == 0 || abi.decode(data, (bool))), "Marketplace: transfer failed");
    }

    function _safeTransferFromERC20(address token, address from, address to, uint256 amount) internal {
        (bool success, bytes memory data) = token.call(
            abi.encodeWithSignature("transferFrom(address,address,uint256)", from, to, amount)
        );
        require(success && (data.length == 0 || abi.decode(data, (bool))), "Marketplace: transferFrom failed");
    }
}
