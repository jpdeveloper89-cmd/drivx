// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./IDVXToken.sol";

/**
 * @title GovernanceTimelock
 * @notice 48-hour timelock for parameter changes to the SafeDrive Protocol.
 *
 * Rules:
 * - DVX stakers vote on governance proposals
 * - 48-hour delay between approval and execution
 * - Stakers can unstake and exit during the 48-hour window before changes take effect
 * - Supported parameters: min distribution threshold, distribution frequency,
 *   incentive pool withdrawal address
 *
 * Requirements: 3.13, 4.10
 */
contract GovernanceTimelock is ReentrancyGuard {
    /// @notice Delay between proposal approval and execution
    uint256 public constant TIMELOCK_DELAY = 48 hours;

    /// @notice Minimum voting period
    uint256 public constant VOTING_PERIOD = 3 days;

    /// @notice Minimum quorum: 1% of total staked DVX
    uint256 public constant QUORUM_BPS = 100; // 1%

    uint256 public constant BPS_DENOMINATOR = 10000;

    // ─── Proposal types ───────────────────────────────────────────────────────
    enum ProposalType {
        SET_MIN_DISTRIBUTION_THRESHOLD,
        SET_DISTRIBUTION_FREQUENCY,
        SET_INCENTIVE_POOL_WITHDRAWAL_ADDRESS
    }

    enum ProposalState {
        Pending,    // voting in progress
        Approved,   // passed vote, waiting for timelock
        Queued,     // timelock started
        Executed,   // executed
        Defeated,   // failed vote
        Cancelled   // cancelled by proposer
    }

    struct Proposal {
        uint256 id;
        address proposer;
        ProposalType proposalType;
        bytes callData;           // encoded parameter value
        uint256 votesFor;
        uint256 votesAgainst;
        uint256 votingEndsAt;
        uint256 executableAt;     // votingEndsAt + TIMELOCK_DELAY
        ProposalState state;
        string description;
    }

    // ─── State ────────────────────────────────────────────────────────────────
    IDVXToken public immutable dvxToken;
    address public immutable stakingContract;

    uint256 public proposalCount;
    mapping(uint256 => Proposal) public proposals;
    mapping(uint256 => mapping(address => bool)) public hasVoted;
    mapping(uint256 => mapping(address => uint256)) public voteWeight;

    // ─── Events ───────────────────────────────────────────────────────────────
    event ProposalCreated(
        uint256 indexed proposalId,
        address indexed proposer,
        ProposalType proposalType,
        string description,
        uint256 votingEndsAt
    );
    event VoteCast(
        uint256 indexed proposalId,
        address indexed voter,
        bool support,
        uint256 weight
    );
    event ProposalQueued(uint256 indexed proposalId, uint256 executableAt);
    event ProposalExecuted(uint256 indexed proposalId);
    event ProposalDefeated(uint256 indexed proposalId);
    event ProposalCancelled(uint256 indexed proposalId);

    constructor(address _dvxToken, address _stakingContract) {
        require(_dvxToken != address(0), "GovernanceTimelock: zero dvx");
        require(_stakingContract != address(0), "GovernanceTimelock: zero staking");
        dvxToken = IDVXToken(_dvxToken);
        stakingContract = _stakingContract;
    }

    /**
     * @notice Create a new governance proposal.
     * @param proposalType The type of parameter change
     * @param callData ABI-encoded new parameter value
     * @param description Human-readable description
     */
    function propose(
        ProposalType proposalType,
        bytes calldata callData,
        string calldata description
    ) external nonReentrant returns (uint256 proposalId) {
        // Proposer must have staked DVX
        uint256 stakedBalance = _getStakedBalance(msg.sender);
        require(stakedBalance > 0, "GovernanceTimelock: must have staked DVX to propose");

        proposalId = ++proposalCount;
        uint256 votingEndsAt = block.timestamp + VOTING_PERIOD;

        proposals[proposalId] = Proposal({
            id: proposalId,
            proposer: msg.sender,
            proposalType: proposalType,
            callData: callData,
            votesFor: 0,
            votesAgainst: 0,
            votingEndsAt: votingEndsAt,
            executableAt: votingEndsAt + TIMELOCK_DELAY,
            state: ProposalState.Pending,
            description: description
        });

        emit ProposalCreated(proposalId, msg.sender, proposalType, description, votingEndsAt);
    }

    /**
     * @notice Cast a vote on a proposal.
     * @dev Vote weight = staked DVX balance at time of voting.
     * @param proposalId The proposal to vote on
     * @param support True = vote for, False = vote against
     */
    function castVote(uint256 proposalId, bool support) external nonReentrant {
        Proposal storage proposal = proposals[proposalId];
        require(proposal.id != 0, "GovernanceTimelock: proposal does not exist");
        require(proposal.state == ProposalState.Pending, "GovernanceTimelock: voting not active");
        require(block.timestamp < proposal.votingEndsAt, "GovernanceTimelock: voting period ended");
        require(!hasVoted[proposalId][msg.sender], "GovernanceTimelock: already voted");

        uint256 weight = _getStakedBalance(msg.sender);
        require(weight > 0, "GovernanceTimelock: no staked DVX");

        hasVoted[proposalId][msg.sender] = true;
        voteWeight[proposalId][msg.sender] = weight;

        if (support) {
            proposal.votesFor += weight;
        } else {
            proposal.votesAgainst += weight;
        }

        emit VoteCast(proposalId, msg.sender, support, weight);
    }

    /**
     * @notice Finalize voting and queue the proposal if it passed.
     * @dev Can be called by anyone after voting period ends.
     *      Starts the 48-hour timelock window — stakers can exit during this time.
     */
    function queueOrDefeat(uint256 proposalId) external nonReentrant {
        Proposal storage proposal = proposals[proposalId];
        require(proposal.id != 0, "GovernanceTimelock: proposal does not exist");
        require(proposal.state == ProposalState.Pending, "GovernanceTimelock: not pending");
        require(block.timestamp >= proposal.votingEndsAt, "GovernanceTimelock: voting still active");

        uint256 totalStaked = _getTotalStaked();
        uint256 quorum = (totalStaked * QUORUM_BPS) / BPS_DENOMINATOR;

        bool quorumReached = (proposal.votesFor + proposal.votesAgainst) >= quorum;
        bool majorityFor = proposal.votesFor > proposal.votesAgainst;

        if (quorumReached && majorityFor) {
            proposal.state = ProposalState.Queued;
            emit ProposalQueued(proposalId, proposal.executableAt);
        } else {
            proposal.state = ProposalState.Defeated;
            emit ProposalDefeated(proposalId);
        }
    }

    /**
     * @notice Execute a queued proposal after the 48-hour timelock.
     * @dev Anyone can execute once the timelock has elapsed.
     */
    function execute(uint256 proposalId) external nonReentrant {
        Proposal storage proposal = proposals[proposalId];
        require(proposal.id != 0, "GovernanceTimelock: proposal does not exist");
        require(proposal.state == ProposalState.Queued, "GovernanceTimelock: not queued");
        require(
            block.timestamp >= proposal.executableAt,
            "GovernanceTimelock: timelock not elapsed"
        );

        proposal.state = ProposalState.Executed;

        // Execute the parameter change
        _executeProposal(proposal);

        emit ProposalExecuted(proposalId);
    }

    /**
     * @notice Cancel a proposal. Only callable by the proposer before execution.
     */
    function cancel(uint256 proposalId) external nonReentrant {
        Proposal storage proposal = proposals[proposalId];
        require(proposal.id != 0, "GovernanceTimelock: proposal does not exist");
        require(proposal.proposer == msg.sender, "GovernanceTimelock: not proposer");
        require(
            proposal.state == ProposalState.Pending || proposal.state == ProposalState.Queued,
            "GovernanceTimelock: cannot cancel"
        );

        proposal.state = ProposalState.Cancelled;
        emit ProposalCancelled(proposalId);
    }

    /**
     * @notice Get the current state of a proposal.
     */
    function getProposalState(uint256 proposalId) external view returns (ProposalState) {
        return proposals[proposalId].state;
    }

    /**
     * @notice Get time remaining until a queued proposal can be executed.
     * @return seconds remaining (0 if executable now)
     */
    function getTimelockRemaining(uint256 proposalId) external view returns (uint256) {
        Proposal storage proposal = proposals[proposalId];
        if (proposal.state != ProposalState.Queued) return 0;
        if (block.timestamp >= proposal.executableAt) return 0;
        return proposal.executableAt - block.timestamp;
    }

    // ─── Internal helpers ─────────────────────────────────────────────────────

    function _executeProposal(Proposal storage proposal) internal {
        // In production: call the target contract with the encoded callData
        // Each ProposalType maps to a specific contract function call
        // e.g., ProposalType.SET_MIN_DISTRIBUTION_THRESHOLD →
        //       revenueDistributor.setMinThreshold(abi.decode(callData, (uint256)))
        // Placeholder: emit event with callData for off-chain execution
        // Full wiring happens in Phase 4 integration task (29.1)
    }

    function _getStakedBalance(address staker) internal view returns (uint256) {
        // Call StakingContract.getStakeInfo(staker).amount
        (bool success, bytes memory data) = stakingContract.staticcall(
            abi.encodeWithSignature("getStakeInfo(address)", staker)
        );
        if (!success || data.length == 0) return 0;
        // StakeInfo struct: amount, stakedAt, unstakeRequestedAt, cooldownEndsAt
        (uint256 amount,,,) = abi.decode(data, (uint256, uint256, uint256, uint256));
        return amount;
    }

    function _getTotalStaked() internal view returns (uint256) {
        (bool success, bytes memory data) = stakingContract.staticcall(
            abi.encodeWithSignature("totalStaked()")
        );
        if (!success || data.length == 0) return 0;
        return abi.decode(data, (uint256));
    }
}
