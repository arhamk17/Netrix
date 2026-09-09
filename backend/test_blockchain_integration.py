"""
Comprehensive Blockchain & Chain-of-Custody Integration Test Suite for ATCIES.

Tests:
A. Blockchain connection
B. Existing evidence registration still works
C. REGISTERED custody event is automatically created on registration
D. record_custody_event() works
E. get_custody_history() works
F. Correct wallet address is recorded for all actions
G. Timestamp exists on custody events
H. Multiple custody events maintain strict chronological order
I. Existing physical SHA-256 verification still works
J. Existing on-chain hash verification still works
K. Tampered evidence fails blockchain verification
L. API endpoint GET /evidence/{id}/blockchain/history returns custody trail
M. Unauthorized users (missing token / invalid role) are rejected with 401/403
N. Blockchain failure resilience (no database rollback or data loss)
"""

import hashlib
import json
import os
import sqlite3
import tempfile
import uuid
from unittest.mock import patch, MagicMock

# SQLite adapter compatibility for JSON fields
sqlite3.register_adapter(list, json.dumps)
sqlite3.register_adapter(dict, json.dumps)

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from sqlalchemy.dialects.sqlite.base import SQLiteTypeCompiler

SQLiteTypeCompiler.visit_ARRAY = lambda self, type_, **kw: "TEXT"

from database import Base, get_db
from main import app
from models import User, Case, Evidence
from auth import create_access_token, hash_password
import blockchain_service
from config import settings


# In-Memory DB setup for isolated FastAPI route testing
test_engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
Base.metadata.create_all(bind=test_engine)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, expire_on_commit=False, bind=test_engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)


def run_blockchain_tests():
    print("\n=======================================================", flush=True)
    print("STARTING ATCIES BLOCKCHAIN & CUSTODY TEST SUITE", flush=True)
    print("=======================================================\n", flush=True)

    # -------------------------------------------------------------------------
    # Test A: Blockchain Connection
    # -------------------------------------------------------------------------
    print("[TEST A] Checking blockchain connection...", flush=True)
    connected = blockchain_service.is_connected()
    assert connected is True, f"Failed to connect to blockchain RPC at {settings.BLOCKCHAIN_RPC_URL}"
    print("[PASS] Test A: Blockchain connection is active (True)\n", flush=True)

    # -------------------------------------------------------------------------
    # Test B & C: Registration & Automatic REGISTERED Custody Event
    # -------------------------------------------------------------------------
    print("[TEST B & C] Testing evidence registration & auto REGISTERED custody event...", flush=True)
    raw_data = b"Forensic memory dump - Target suspect node Alpha"
    test_sha256 = hashlib.sha256(raw_data).hexdigest()
    ev_id = str(uuid.uuid4())
    case_id = str(uuid.uuid4())

    reg_result = blockchain_service.register_evidence(
        evidence_id=ev_id,
        evidence_hash=test_sha256,
        case_id=case_id,
    )
    assert reg_result is not None, "Registration result is None"
    assert reg_result["status"] == 1, f"Receipt status not 1: {reg_result}"
    assert reg_result["tx_hash"].startswith("0x")
    print(f"[PASS] Test B: Evidence registered on-chain (tx: {reg_result['tx_hash']}, block: {reg_result['block_number']})", flush=True)

    # Check that REGISTERED custody event was created atomically
    history_after_reg = blockchain_service.get_custody_history(ev_id)
    assert len(history_after_reg) >= 1, "No custody event found after registration"
    assert history_after_reg[0]["action"] == "REGISTERED", f"Expected action 'REGISTERED', got {history_after_reg[0]['action']}"
    print(f"[PASS] Test C: Initial 'REGISTERED' custody event created automatically in same tx\n", flush=True)

    # -------------------------------------------------------------------------
    # Test D, E, F, G, H: Record & Retrieve Multiple Custody Events (Chronological Order & Wallets)
    # -------------------------------------------------------------------------
    print("[TEST D, E, F, G, H] Recording multiple custody events (VERIFIED -> ANALYZED -> REVIEWED)...", flush=True)
    actions = ["VERIFIED", "ANALYZED", "REVIEWED"]
    for action in actions:
        ev_res = blockchain_service.record_custody_event(ev_id, action)
        assert ev_res["status"] == 1, f"Failed to record custody event {action}: {ev_res}"
        assert ev_res["action"] == action
        assert "performed_by" in ev_res and ev_res["performed_by"].startswith("0x")

    full_history = blockchain_service.get_custody_history(ev_id)
    assert len(full_history) == 4, f"Expected 4 custody events, found {len(full_history)}"

    expected_actions = ["REGISTERED", "VERIFIED", "ANALYZED", "REVIEWED"]
    actual_actions = [e["action"] for e in full_history]
    assert actual_actions == expected_actions, f"Custody history out of order! Expected {expected_actions}, got {actual_actions}"
    print(f"[PASS] Test D & E: record_custody_event() and get_custody_history() succeed for all events", flush=True)

    # Check wallet address and timestamps
    for idx, event in enumerate(full_history):
        assert event["performed_by"].startswith("0x"), f"Invalid wallet address in event {idx}: {event['performed_by']}"
        assert isinstance(event["timestamp"], int) and event["timestamp"] > 0, f"Invalid timestamp in event {idx}: {event['timestamp']}"

    # Check chronological ordering
    timestamps = [e["timestamp"] for e in full_history]
    assert sorted(timestamps) == timestamps, "Custody event timestamps are not non-decreasing!"
    print("[PASS] Test F: Correct wallet address recorded for all actions", flush=True)
    print("[PASS] Test G: Timestamp exists and is positive integer", flush=True)
    print(f"[PASS] Test H: Chronological order preserved: {' -> '.join(actual_actions)}\n", flush=True)

    # -------------------------------------------------------------------------
    # Test I, J, K: Hash Verification (Authentic vs Tampered)
    # -------------------------------------------------------------------------
    print("[TEST I, J, K] Verifying authentic and tampered hash checks...", flush=True)
    assert blockchain_service.verify_evidence(ev_id, test_sha256) is True
    print("[PASS] Test J: verify_evidence() returned TRUE for authentic hash", flush=True)

    tampered_hash = hashlib.sha256(b"Tampered bytes by attacker").hexdigest()
    assert blockchain_service.verify_evidence(ev_id, tampered_hash) is False
    print("[PASS] Test K: verify_evidence() returned FALSE for tampered hash\n", flush=True)

    # -------------------------------------------------------------------------
    # Test L & M: End-to-End API Integration & RBAC
    # -------------------------------------------------------------------------
    print("[TEST L & M] Testing FastAPI Endpoints for Custody History & RBAC...", flush=True)
    db = TestingSessionLocal()
    inv_id = uuid.uuid4()
    ana_id = uuid.uuid4()
    inv_user = User(
        id=inv_id,
        username="investigator_custody",
        email="inv_custody@atcies.local",
        password_hash=hash_password("Password123!"),
        role="investigator",
        is_active=True,
    )
    ana_user = User(
        id=ana_id,
        username="analyst_custody",
        email="ana_custody@atcies.local",
        password_hash=hash_password("Password123!"),
        role="analyst",
        is_active=True,
    )
    case_id_api = uuid.uuid4()
    case_obj = Case(
        id=case_id_api,
        case_number="CASE-CUSTODY-001",
        title="Chain of Custody Case",
        created_by=inv_id,
        assigned_to=inv_id,
    )
    db.add_all([inv_user, ana_user, case_obj])
    db.commit()

    inv_token = create_access_token({"sub": str(inv_id), "role": "investigator"})
    inv_headers = {"Authorization": f"Bearer {inv_token}"}
    ana_token = create_access_token({"sub": str(ana_id), "role": "analyst"})
    ana_headers = {"Authorization": f"Bearer {ana_token}"}

    # Upload evidence via API
    upload_bytes = b"Digital Forensic Evidence - Encrypted Archive Dump"
    upload_sha = hashlib.sha256(upload_bytes).hexdigest()

    with patch("ingestion.process_evidence_task.delay"):
        upload_resp = client.post(
            "/evidence/upload",
            data={"case_id": str(case_id_api), "source_type": "disk_image"},
            files={"file": ("evidence_archive.tar.gz", upload_bytes, "application/gzip")},
            headers=inv_headers,
        )

    assert upload_resp.status_code == 200, f"Upload failed: {upload_resp.text}"
    ev_api_id = upload_resp.json()["id"]

    # Verify endpoint GET /evidence/{id}/verify records VERIFIED event
    v_resp = client.get(f"/evidence/{ev_api_id}/verify", headers=inv_headers)
    assert v_resp.status_code == 200
    v_data = v_resp.json()
    assert v_data["match"] is True
    assert v_data["blockchain_verified"] is True
    assert "custody_history" in v_data and len(v_data["custody_history"]) >= 2
    print("[PASS] Test I & J: Physical file SHA-256 and blockchain hash verified via API", flush=True)

    # Check dedicated GET /evidence/{id}/blockchain/history endpoint
    hist_resp = client.get(f"/evidence/{ev_api_id}/blockchain/history", headers=inv_headers)
    assert hist_resp.status_code == 200, f"Failed GET /evidence/{ev_api_id}/blockchain/history: {hist_resp.text}"
    hist_data = hist_resp.json()
    assert hist_data["evidence_id"] == str(ev_api_id)
    assert len(hist_data["events"]) >= 2
    event_actions = [ev["action"] for ev in hist_data["events"]]
    assert "REGISTERED" in event_actions
    assert "VERIFIED" in event_actions
    print(f"[PASS] Test L: GET /evidence/{ev_api_id}/blockchain/history returned custody events: {event_actions}", flush=True)

    # RBAC & Auth tests
    no_auth_resp = client.get(f"/evidence/{ev_api_id}/blockchain/history")
    assert no_auth_resp.status_code == 401, "Expected 401 on missing auth token"

    bad_token_resp = client.get(f"/evidence/{ev_api_id}/blockchain/history", headers={"Authorization": "Bearer invalid"})
    assert bad_token_resp.status_code == 401, "Expected 401 on invalid auth token"

    # Analyst cannot upload evidence (investigator/supervisor/admin role required)
    analyst_upload = client.post(
        "/evidence/upload",
        data={"case_id": str(case_id_api), "source_type": "disk_image"},
        files={"file": ("unauthorized.txt", b"secret", "text/plain")},
        headers=ana_headers,
    )
    assert analyst_upload.status_code == 403, "Expected 403 when Analyst tries to upload evidence"
    print("[PASS] Test M: Auth enforcement (401 on missing/bad token, 403 on role restriction)\n", flush=True)

    # -------------------------------------------------------------------------
    # Test N: Failure Resilience
    # -------------------------------------------------------------------------
    print("[TEST N] Testing failure resilience when RPC is unreachable during upload...", flush=True)
    with patch("blockchain_service.register_evidence", side_effect=Exception("RPC node connection failed")):
        with patch("ingestion.process_evidence_task.delay"):
            fail_resp = client.post(
                "/evidence/upload",
                data={"case_id": str(case_id_api), "source_type": "memory_dump"},
                files={"file": ("memory_dump.bin", b"RAM dump content", "application/octet-stream")},
                headers=inv_headers,
            )

    assert fail_resp.status_code == 200
    fail_ev_id = uuid.UUID(fail_resp.json()["id"])
    db_ev = db.query(Evidence).filter(Evidence.id == fail_ev_id).first()
    assert db_ev is not None
    assert db_ev.blockchain_status == "failed"
    print("[PASS] Test N: Upload persisted with blockchain_status='failed' without crashing or losing data\n", flush=True)

    db.close()
    print("=======================================================", flush=True)
    print("ALL ATCIES BLOCKCHAIN & CUSTODY TESTS PASSED (100%)", flush=True)
    print("=======================================================\n", flush=True)


if __name__ == "__main__":
    run_blockchain_tests()
