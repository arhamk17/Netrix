// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title EvidenceIntegrity
/// @notice Registers and verifies cryptographic hashes of digital forensic evidence.
/// @dev This contract stores ONLY evidence metadata and hashes for integrity/provenance
///      purposes. It never stores raw evidence files, PII, PDFs, images, or any other
///      raw evidence content on-chain.
contract EvidenceIntegrity {
    /// @notice On-chain record proving an evidence hash existed at a specific time.
    struct EvidenceRecord {
        bytes32 evidenceId;    // Unique identifier for the evidence item
        bytes32 evidenceHash;  // Cryptographic hash (e.g. SHA-256) of the off-chain evidence
        bytes32 caseId;        // Identifier of the case the evidence belongs to
        uint256 timestamp;     // Block timestamp at registration
        address registeredBy;  // Address that submitted the registration
    }

    /// @notice On-chain record representing an immutable chain-of-custody event.
    struct CustodyEvent {
        bytes32 evidenceId;    // Unique identifier for the evidence item
        string action;         // Custody action name (e.g. "REGISTERED", "VERIFIED", "ANALYZED", "REVIEWED")
        uint256 timestamp;     // Block timestamp when action was performed
        address performedBy;   // Address that performed the action
    }

    /// @dev Maps an evidenceId to its registered evidence record.
    mapping(bytes32 => EvidenceRecord) private evidenceRecords;

    /// @dev Tracks whether an evidenceId has already been registered.
    mapping(bytes32 => bool) private isRegistered;

    /// @dev Maps an evidenceId to its chronological list of custody events.
    mapping(bytes32 => CustodyEvent[]) private custodyHistory;

    /// @notice Emitted when a new evidence record is permanently registered.
    event EvidenceRegistered(
        bytes32 indexed evidenceId,
        bytes32 evidenceHash,
        bytes32 indexed caseId,
        uint256 timestamp,
        address indexed registeredBy
    );

    /// @notice Emitted when a chain-of-custody event is recorded.
    event CustodyEventRecorded(
        bytes32 indexed evidenceId,
        string action,
        uint256 timestamp,
        address indexed performedBy
    );

    /// @notice Permanently registers the hash of an evidence item on-chain.
    /// @dev Reverts if the evidenceId has already been registered, ensuring
    ///      evidence records cannot be overwritten or duplicated.
    ///      Automatically records the initial "REGISTERED" custody event.
    /// @param evidenceId Unique identifier for the evidence item.
    /// @param evidenceHash Cryptographic hash of the off-chain evidence content.
    /// @param caseId Identifier of the case the evidence belongs to.
    function registerEvidence(
        bytes32 evidenceId,
        bytes32 evidenceHash,
        bytes32 caseId
    ) external {
        require(!isRegistered[evidenceId], "EvidenceIntegrity: evidence already registered");

        evidenceRecords[evidenceId] = EvidenceRecord({
            evidenceId: evidenceId,
            evidenceHash: evidenceHash,
            caseId: caseId,
            timestamp: block.timestamp,
            registeredBy: msg.sender
        });
        isRegistered[evidenceId] = true;

        emit EvidenceRegistered(evidenceId, evidenceHash, caseId, block.timestamp, msg.sender);

        // Record the initial "REGISTERED" custody event in the same transaction
        custodyHistory[evidenceId].push(CustodyEvent({
            evidenceId: evidenceId,
            action: "REGISTERED",
            timestamp: block.timestamp,
            performedBy: msg.sender
        }));

        emit CustodyEventRecorded(evidenceId, "REGISTERED", block.timestamp, msg.sender);
    }

    /// @notice Records a new chain-of-custody event for an existing evidence item.
    /// @param evidenceId Unique identifier for the evidence item.
    /// @param action The custody action name (e.g. "VERIFIED", "ANALYZED", "REVIEWED", "EXPORTED").
    function recordCustodyEvent(bytes32 evidenceId, string calldata action) external {
        require(isRegistered[evidenceId], "EvidenceIntegrity: evidence not registered");
        require(bytes(action).length > 0, "EvidenceIntegrity: action cannot be empty");

        custodyHistory[evidenceId].push(CustodyEvent({
            evidenceId: evidenceId,
            action: action,
            timestamp: block.timestamp,
            performedBy: msg.sender
        }));

        emit CustodyEventRecorded(evidenceId, action, block.timestamp, msg.sender);
    }

    /// @notice Verifies whether a supplied hash matches the hash stored on-chain.
    /// @param evidenceId Unique identifier for the evidence item.
    /// @param currentHash Hash computed from the current state of the off-chain evidence.
    /// @return matches True if currentHash equals the originally registered hash.
    function verifyEvidence(bytes32 evidenceId, bytes32 currentHash) external view returns (bool matches) {
        require(isRegistered[evidenceId], "EvidenceIntegrity: evidence not registered");
        return evidenceRecords[evidenceId].evidenceHash == currentHash;
    }

    /// @notice Retrieves the full evidence record for a given evidenceId.
    /// @param evidenceId Unique identifier for the evidence item.
    /// @return record The stored EvidenceRecord.
    function getEvidenceRecord(bytes32 evidenceId) external view returns (EvidenceRecord memory record) {
        require(isRegistered[evidenceId], "EvidenceIntegrity: evidence not registered");
        return evidenceRecords[evidenceId];
    }

    /// @notice Retrieves the chronological chain-of-custody history for a given evidenceId.
    /// @param evidenceId Unique identifier for the evidence item.
    /// @return history The array of CustodyEvent structs.
    function getCustodyHistory(bytes32 evidenceId) external view returns (CustodyEvent[] memory history) {
        require(isRegistered[evidenceId], "EvidenceIntegrity: evidence not registered");
        return custodyHistory[evidenceId];
    }
}
