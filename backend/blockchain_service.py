"""
Blockchain Service for EvidenceIntegrity Smart Contract.

Uses Web3.py 8.x to interface with the deployed EvidenceIntegrity contract
for registering, verifying cryptographic hashes, and tracking immutable
chain-of-custody events for digital forensic evidence.
"""

from __future__ import annotations

import hashlib
import logging
import uuid
from typing import Any

from web3 import Web3

from config import settings

logger = logging.getLogger(__name__)


# ABI for EvidenceIntegrity contract
EVIDENCE_INTEGRITY_ABI = [
    {
        "anonymous": False,
        "inputs": [
            {"indexed": True, "internalType": "bytes32", "name": "evidenceId", "type": "bytes32"},
            {"indexed": False, "internalType": "string", "name": "action", "type": "string"},
            {"indexed": False, "internalType": "uint256", "name": "timestamp", "type": "uint256"},
            {"indexed": True, "internalType": "address", "name": "performedBy", "type": "address"},
        ],
        "name": "CustodyEventRecorded",
        "type": "event",
    },
    {
        "anonymous": False,
        "inputs": [
            {"indexed": True, "internalType": "bytes32", "name": "evidenceId", "type": "bytes32"},
            {"indexed": False, "internalType": "bytes32", "name": "evidenceHash", "type": "bytes32"},
            {"indexed": True, "internalType": "bytes32", "name": "caseId", "type": "bytes32"},
            {"indexed": False, "internalType": "uint256", "name": "timestamp", "type": "uint256"},
            {"indexed": True, "internalType": "address", "name": "registeredBy", "type": "address"},
        ],
        "name": "EvidenceRegistered",
        "type": "event",
    },
    {
        "inputs": [
            {"internalType": "bytes32", "name": "evidenceId", "type": "bytes32"}
        ],
        "name": "getCustodyHistory",
        "outputs": [
            {
                "components": [
                    {"internalType": "bytes32", "name": "evidenceId", "type": "bytes32"},
                    {"internalType": "string", "name": "action", "type": "string"},
                    {"internalType": "uint256", "name": "timestamp", "type": "uint256"},
                    {"internalType": "address", "name": "performedBy", "type": "address"},
                ],
                "internalType": "struct EvidenceIntegrity.CustodyEvent[]",
                "name": "history",
                "type": "tuple[]",
            }
        ],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [
            {"internalType": "bytes32", "name": "evidenceId", "type": "bytes32"}
        ],
        "name": "getEvidenceRecord",
        "outputs": [
            {
                "components": [
                    {"internalType": "bytes32", "name": "evidenceId", "type": "bytes32"},
                    {"internalType": "bytes32", "name": "evidenceHash", "type": "bytes32"},
                    {"internalType": "bytes32", "name": "caseId", "type": "bytes32"},
                    {"internalType": "uint256", "name": "timestamp", "type": "uint256"},
                    {"internalType": "address", "name": "registeredBy", "type": "address"},
                ],
                "internalType": "struct EvidenceIntegrity.EvidenceRecord",
                "name": "record",
                "type": "tuple",
            }
        ],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [
            {"internalType": "bytes32", "name": "evidenceId", "type": "bytes32"},
            {"internalType": "string", "name": "action", "type": "string"},
        ],
        "name": "recordCustodyEvent",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function",
    },
    {
        "inputs": [
            {"internalType": "bytes32", "name": "evidenceId", "type": "bytes32"},
            {"internalType": "bytes32", "name": "evidenceHash", "type": "bytes32"},
            {"internalType": "bytes32", "name": "caseId", "type": "bytes32"},
        ],
        "name": "registerEvidence",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function",
    },
    {
        "inputs": [
            {"internalType": "bytes32", "name": "evidenceId", "type": "bytes32"},
            {"internalType": "bytes32", "name": "currentHash", "type": "bytes32"},
        ],
        "name": "verifyEvidence",
        "outputs": [
            {"internalType": "bool", "name": "matches", "type": "bool"}
        ],
        "stateMutability": "view",
        "type": "function",
    },
]


def to_bytes32(val: Any) -> bytes:
    """
    Convert an input identifier, hash, UUID, integer, or raw bytes into a 32-byte bytes32 format.
    """
    if isinstance(val, (bytes, bytearray)):
        if len(val) == 32:
            return bytes(val)
        if len(val) < 32:
            return bytes(val).rjust(32, b"\x00")
        return bytes(val)[:32]

    if isinstance(val, uuid.UUID):
        return val.bytes.rjust(32, b"\x00")

    if isinstance(val, int):
        return val.to_bytes(32, byteorder="big")

    if isinstance(val, str):
        cleaned = val.strip()
        if cleaned.startswith("0x") or cleaned.startswith("0X"):
            hex_part = cleaned[2:]
            if len(hex_part) <= 64:
                return bytes.fromhex(hex_part.zfill(64))
        if len(cleaned) == 64:
            try:
                return bytes.fromhex(cleaned)
            except ValueError:
                pass
        try:
            parsed_uuid = uuid.UUID(cleaned)
            return parsed_uuid.bytes.rjust(32, b"\x00")
        except (ValueError, AttributeError):
            pass
        if cleaned.isdigit():
            return int(cleaned).to_bytes(32, byteorder="big")

        encoded = cleaned.encode("utf-8")
        if len(encoded) <= 32:
            return encoded.ljust(32, b"\x00")
        return hashlib.sha256(encoded).digest()

    raise ValueError(f"Cannot convert value of type {type(val)} to bytes32: {val}")


class BlockchainService:
    """Service wrapper for interacting with the EvidenceIntegrity smart contract via Web3.py."""

    def __init__(
        self,
        rpc_url: str | None = None,
        contract_address: str | None = None,
        private_key: str | None = None,
    ):
        self.rpc_url = rpc_url or settings.BLOCKCHAIN_RPC_URL
        self.contract_address = contract_address or settings.BLOCKCHAIN_CONTRACT_ADDRESS
        self.private_key = private_key or settings.BLOCKCHAIN_PRIVATE_KEY
        self.w3 = Web3(Web3.HTTPProvider(self.rpc_url))
        self.abi = EVIDENCE_INTEGRITY_ABI

    @property
    def contract(self):
        """Load the EvidenceIntegrity contract using its configured address and ABI."""
        address = self.contract_address or settings.BLOCKCHAIN_CONTRACT_ADDRESS
        if not address:
            raise ValueError("BLOCKCHAIN_CONTRACT_ADDRESS is not configured in settings.")
        checksum_address = Web3.to_checksum_address(address)
        return self.w3.eth.contract(address=checksum_address, abi=self.abi)

    def is_connected(self) -> bool:
        """Check if Web3 is successfully connected to the blockchain RPC endpoint."""
        try:
            return bool(self.w3.is_connected())
        except Exception:
            return False

    def register_evidence(
        self,
        evidence_id: Any,
        evidence_hash: Any,
        case_id: Any,
    ) -> dict[str, Any]:
        """
        Permanently register an evidence hash on-chain.
        Also automatically records the initial 'REGISTERED' custody event.

        - Converts evidence_id, evidence_hash, and case_id to bytes32.
        - Signs transaction using BLOCKCHAIN_PRIVATE_KEY.
        - Sends raw transaction and waits for receipt.
        - Returns dict with transaction hash, receipt status, and block number.
        """
        private_key = self.private_key or settings.BLOCKCHAIN_PRIVATE_KEY
        if not private_key:
            raise ValueError("BLOCKCHAIN_PRIVATE_KEY is not configured in settings.")

        account = self.w3.eth.account.from_key(private_key)
        ev_id_b32 = to_bytes32(evidence_id)
        ev_hash_b32 = to_bytes32(evidence_hash)
        case_id_b32 = to_bytes32(case_id)

        contract = self.contract
        nonce = self.w3.eth.get_transaction_count(account.address)

        tx = contract.functions.registerEvidence(
            ev_id_b32,
            ev_hash_b32,
            case_id_b32,
        ).build_transaction({
            "from": account.address,
            "nonce": nonce,
            "gasPrice": self.w3.eth.gas_price,
        })

        if "gas" not in tx:
            try:
                tx["gas"] = self.w3.eth.estimate_gas(tx)
            except Exception:
                tx["gas"] = 300000

        signed_tx = account.sign_transaction(tx)
        raw_tx = getattr(signed_tx, "raw_transaction", getattr(signed_tx, "rawTransaction", None))

        tx_hash_bytes = self.w3.eth.send_raw_transaction(raw_tx)
        receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash_bytes)

        tx_hash_hex = tx_hash_bytes.hex()
        if not tx_hash_hex.startswith("0x"):
            tx_hash_hex = f"0x{tx_hash_hex}"

        return {
            "tx_hash": tx_hash_hex,
            "status": receipt.status,
            "block_number": receipt.blockNumber,
        }

    def record_custody_event(
        self,
        evidence_id: Any,
        action: str,
    ) -> dict[str, Any]:
        """
        Record an immutable chain-of-custody event on-chain for an existing evidence item.

        - Converts evidence_id to bytes32.
        - Signs transaction using BLOCKCHAIN_PRIVATE_KEY.
        - Sends raw transaction and waits for receipt.
        - Returns dict with transaction hash, receipt status, block number, action, and performed_by.
        """
        private_key = self.private_key or settings.BLOCKCHAIN_PRIVATE_KEY
        if not private_key:
            raise ValueError("BLOCKCHAIN_PRIVATE_KEY is not configured in settings.")

        account = self.w3.eth.account.from_key(private_key)
        ev_id_b32 = to_bytes32(evidence_id)

        contract = self.contract
        nonce = self.w3.eth.get_transaction_count(account.address)

        tx = contract.functions.recordCustodyEvent(
            ev_id_b32,
            action,
        ).build_transaction({
            "from": account.address,
            "nonce": nonce,
            "gasPrice": self.w3.eth.gas_price,
        })

        if "gas" not in tx:
            try:
                tx["gas"] = self.w3.eth.estimate_gas(tx)
            except Exception:
                tx["gas"] = 300000

        signed_tx = account.sign_transaction(tx)
        raw_tx = getattr(signed_tx, "raw_transaction", getattr(signed_tx, "rawTransaction", None))

        tx_hash_bytes = self.w3.eth.send_raw_transaction(raw_tx)
        receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash_bytes)

        tx_hash_hex = tx_hash_bytes.hex()
        if not tx_hash_hex.startswith("0x"):
            tx_hash_hex = f"0x{tx_hash_hex}"

        return {
            "tx_hash": tx_hash_hex,
            "status": receipt.status,
            "block_number": receipt.blockNumber,
            "action": action,
            "performed_by": account.address,
        }

    def get_custody_history(self, evidence_id: Any) -> list[dict[str, Any]]:
        """
        Retrieve the chronological chain-of-custody history for evidence_id from the blockchain.
        """
        ev_id_b32 = to_bytes32(evidence_id)
        try:
            history_tuples = self.contract.functions.getCustodyHistory(ev_id_b32).call()
            return [
                {
                    "evidence_id": "0x" + item[0].hex() if isinstance(item[0], (bytes, bytearray)) else item[0],
                    "action": item[1],
                    "timestamp": item[2],
                    "performed_by": item[3],
                }
                for item in history_tuples
            ]
        except Exception as exc:
            logger.warning("Failed to retrieve custody history for evidence %s: %s", evidence_id, exc)
            return []

    def verify_evidence(self, evidence_id: Any, current_hash: Any) -> bool:
        """
        Verify whether current_hash matches the registered hash on-chain for evidence_id.
        """
        ev_id_b32 = to_bytes32(evidence_id)
        curr_hash_b32 = to_bytes32(current_hash)

        try:
            return bool(self.contract.functions.verifyEvidence(ev_id_b32, curr_hash_b32).call())
        except Exception as exc:
            logger.warning("Failed to verify evidence %s on blockchain: %s", evidence_id, exc)
            return False

    def get_evidence_record(self, evidence_id: Any) -> dict[str, Any] | None:
        """
        Retrieve the on-chain EvidenceRecord for evidence_id.
        """
        ev_id_b32 = to_bytes32(evidence_id)
        try:
            record = self.contract.functions.getEvidenceRecord(ev_id_b32).call()
            return {
                "evidence_id": "0x" + record[0].hex() if isinstance(record[0], (bytes, bytearray)) else record[0],
                "evidence_hash": "0x" + record[1].hex() if isinstance(record[1], (bytes, bytearray)) else record[1],
                "case_id": "0x" + record[2].hex() if isinstance(record[2], (bytes, bytearray)) else record[2],
                "timestamp": record[3],
                "registered_by": record[4],
            }
        except Exception as exc:
            logger.warning("Failed to retrieve evidence record for %s from blockchain: %s", evidence_id, exc)
            return None



# Default singleton instance
blockchain_service = BlockchainService()


def is_connected() -> bool:
    """Check if Web3 is connected to the RPC endpoint."""
    return blockchain_service.is_connected()


def register_evidence(evidence_id: Any, evidence_hash: Any, case_id: Any) -> dict[str, Any]:
    """Register evidence on-chain using the default blockchain_service."""
    return blockchain_service.register_evidence(evidence_id, evidence_hash, case_id)


def record_custody_event(evidence_id: Any, action: str) -> dict[str, Any]:
    """Record a custody event on-chain using the default blockchain_service."""
    return blockchain_service.record_custody_event(evidence_id, action)


def get_custody_history(evidence_id: Any) -> list[dict[str, Any]]:
    """Retrieve custody history from the blockchain using the default blockchain_service."""
    return blockchain_service.get_custody_history(evidence_id)


def verify_evidence(evidence_id: Any, current_hash: Any) -> bool:
    """Verify evidence on-chain using the default blockchain_service."""
    return blockchain_service.verify_evidence(evidence_id, current_hash)


def get_evidence_record(evidence_id: Any) -> dict[str, Any] | None:
    """Retrieve evidence record from the blockchain using the default blockchain_service."""
    return blockchain_service.get_evidence_record(evidence_id)
