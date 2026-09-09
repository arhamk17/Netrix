import io
import json
import os
import sqlite3
import tempfile
import time
import uuid
from unittest.mock import patch, MagicMock

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from sqlalchemy.dialects.sqlite.base import SQLiteTypeCompiler

# SQLite adaptation for JSON / Arrays
sqlite3.register_adapter(list, json.dumps)
sqlite3.register_adapter(dict, json.dumps)
SQLiteTypeCompiler.visit_ARRAY = lambda self, type_, **kw: "TEXT"

from database import Base, get_db
import main
from main import app
from models import User, Case, Evidence, Entity, Relationship, AnalyticsResult, LeadResult, AuditLog
from auth import (
    create_access_token, hash_password, _login_attempts, _attempts_lock,
    assert_case_access, get_client_ip
)
import graph_service
from graph_service import _sanitize_rel_type, ALLOWED_REL_TYPES
import ingestion
from ingestion import _sanitize_filename, MAX_UPLOAD_BYTES
import blockchain_service


# Test in-memory DB setup
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


@pytest.fixture(autouse=True)
def clean_db():
    app.dependency_overrides[get_db] = override_get_db
    db = TestingSessionLocal()
    with _attempts_lock:
        _login_attempts.clear()
    yield db
    db.close()


def test_fix_1_idor_case_authorization():
    """Fix 1: Case-level authorization prevents IDOR across all case/evidence endpoints."""
    db = TestingSessionLocal()
    inv1 = User(
        id=uuid.uuid4(),
        username="inv_owner",
        email="owner@test.com",
        password_hash=hash_password("Pass123!"),
        role="investigator",
        is_active=True,
    )
    inv2 = User(
        id=uuid.uuid4(),
        username="inv_attacker",
        email="attacker@test.com",
        password_hash=hash_password("Pass123!"),
        role="investigator",
        is_active=True,
    )
    admin = User(
        id=uuid.uuid4(),
        username="admin_user",
        email="admin@test.com",
        password_hash=hash_password("Pass123!"),
        role="admin",
        is_active=True,
    )
    db.add_all([inv1, inv2, admin])
    db.commit()

    case1 = Case(
        id=uuid.uuid4(),
        case_number="CASE-IDOR-001",
        title="Owner Case",
        created_by=inv1.id,
        assigned_to=inv1.id,
    )
    db.add(case1)
    db.commit()

    ev1 = Evidence(
        id=uuid.uuid4(),
        case_id=case1.id,
        filename="evidence.txt",
        original_filename="evidence.txt",
        file_type="text/plain",
        file_size_bytes=100,
        sha256_hash="deadbeef",
        storage_path="./data/test_ev.txt",
        source_type="report",
        uploaded_by=inv1.id,
        processing_status="completed",
    )
    lead1 = LeadResult(
        id=uuid.uuid4(),
        case_id=case1.id,
        lead_type="SUSPECT_LEAD",
        explanation="Test explanation",
    )
    db.add_all([ev1, lead1])
    db.commit()

    token_inv1 = create_access_token({"sub": str(inv1.id), "role": inv1.role})
    token_inv2 = create_access_token({"sub": str(inv2.id), "role": inv2.role})
    token_admin = create_access_token({"sub": str(admin.id), "role": admin.role})

    headers_inv1 = {"Authorization": f"Bearer {token_inv1}"}
    headers_inv2 = {"Authorization": f"Bearer {token_inv2}"}
    headers_admin = {"Authorization": f"Bearer {token_admin}"}

    # 1. Owner can access case
    resp = client.get(f"/cases/{case1.id}", headers=headers_inv1)
    assert resp.status_code == 200

    # 2. Attacker gets 403 on case endpoints
    resp = client.get(f"/cases/{case1.id}", headers=headers_inv2)
    assert resp.status_code == 403

    resp = client.get(f"/cases/{case1.id}/entities", headers=headers_inv2)
    assert resp.status_code == 403

    resp = client.get(f"/cases/{case1.id}/relationships", headers=headers_inv2)
    assert resp.status_code == 403

    resp = client.get(f"/cases/{case1.id}/evidence", headers=headers_inv2)
    assert resp.status_code == 403

    # 3. Attacker gets 403 on evidence endpoints
    resp = client.get(f"/evidence/{ev1.id}", headers=headers_inv2)
    assert resp.status_code == 403

    resp = client.get(f"/evidence/{ev1.id}/status", headers=headers_inv2)
    assert resp.status_code == 403

    resp = client.get(f"/evidence/{ev1.id}/blockchain", headers=headers_inv2)
    assert resp.status_code == 403

    resp = client.get(f"/evidence/{ev1.id}/blockchain/history", headers=headers_inv2)
    assert resp.status_code == 403

    # 4. Attacker gets 403 on graph and analytics
    resp = client.get(f"/graph/case/{case1.id}", headers=headers_inv2)
    assert resp.status_code == 403

    resp = client.get(f"/analytics/ips?case_id={case1.id}", headers=headers_inv2)
    assert resp.status_code == 403

    # 5. Attacker gets 403 on leads
    resp = client.get(f"/leads?case_id={case1.id}", headers=headers_inv2)
    assert resp.status_code == 403

    resp = client.get(f"/leads/{lead1.id}", headers=headers_inv2)
    assert resp.status_code == 403

    # 6. Admin has authorized access
    resp = client.get(f"/cases/{case1.id}", headers=headers_admin)
    assert resp.status_code == 200
    db.close()


def test_fix_2_cypher_injection_allowlist():
    """Fix 2: Cypher injection in relationship types is strictly blocked by allowlist."""
    # Valid allowed relationships
    assert _sanitize_rel_type("calls") == "CALLS"
    assert _sanitize_rel_type("TRANSFERS_MONEY_TO") == "TRANSFERS_MONEY_TO"
    assert _sanitize_rel_type("communicates_with") == "COMMUNICATES_WITH"

    # Malicious injection payloads
    malicious_payloads = [
        "CALLS]->(b) DELETE n//",
        "KNOWS; MATCH (n) DETACH DELETE n;",
        "OWNS} RETURN 1 UNION MATCH (n) RETURN n; //",
        "<script>alert(1)</script>",
        "UNKNOWN_CUSTOM_RELATIONSHIP",
        "'; DROP TABLE users; --",
    ]
    for payload in malicious_payloads:
        sanitized = _sanitize_rel_type(payload)
        assert sanitized in ALLOWED_REL_TYPES
        assert sanitized == "RELATED_TO"


def test_fix_3_path_traversal_sanitization():
    """Fix 3: Path traversal characters are sanitized from upload filenames."""
    assert _sanitize_filename("../../../etc/passwd") == "passwd"
    assert _sanitize_filename("..\\..\\windows\\system32\\cmd.exe") == "cmd.exe"
    assert _sanitize_filename("valid_report.pdf") == "valid_report.pdf"
    assert _sanitize_filename("..hidden.txt") == "hidden.txt"
    assert _sanitize_filename("") == "evidence_file.bin"


def test_fix_4_read_only_evidence_verification():
    """Fix 4: Evidence verification on GET does not record duplicate on-chain custody events."""
    db = TestingSessionLocal()
    user = User(
        id=uuid.uuid4(),
        username="inv_verify",
        email="verify@test.com",
        password_hash=hash_password("Pass123!"),
        role="investigator",
        is_active=True,
    )
    db.add(user)
    db.commit()

    case = Case(
        id=uuid.uuid4(),
        case_number="CASE-VERIFY-001",
        title="Verify Case",
        created_by=user.id,
        assigned_to=user.id,
    )
    db.add(case)
    db.commit()

    # Create temporary evidence file
    temp_dir = tempfile.mkdtemp()
    temp_file = os.path.join(temp_dir, "ev.txt")
    with open(temp_file, "wb") as f:
        f.write(b"evidence verification payload")

    from ingestion import compute_sha256
    sha = compute_sha256(b"evidence verification payload")

    ev = Evidence(
        id=uuid.uuid4(),
        case_id=case.id,
        filename="ev.txt",
        original_filename="ev.txt",
        file_type="text/plain",
        file_size_bytes=len(b"evidence verification payload"),
        sha256_hash=sha,
        storage_path=temp_file,
        source_type="report",
        uploaded_by=user.id,
        processing_status="completed",
    )
    db.add(ev)
    db.commit()

    token = create_access_token({"sub": str(user.id), "role": user.role})
    headers = {"Authorization": f"Bearer {token}"}

    with patch("blockchain_service.get_evidence_record") as mock_rec, \
         patch("blockchain_service.verify_evidence") as mock_ver, \
         patch("blockchain_service.get_custody_history") as mock_hist, \
         patch("blockchain_service.record_custody_event") as mock_record_event:

        mock_rec.return_value = {"evidence_hash": sha, "case_id": str(case.id)}
        mock_ver.return_value = True
        mock_hist.return_value = []

        resp = client.get(f"/evidence/{ev.id}/verify", headers=headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["match"] is True
        assert data["blockchain_verified"] is True

        # Assert record_custody_event was NEVER called during GET
        assert mock_record_event.call_count == 0

    # Cleanup
    if os.path.exists(temp_file):
        os.remove(temp_file)
    if os.path.exists(temp_dir):
        os.rmdir(temp_dir)
    db.close()


def test_fix_5_and_10_blockchain_logging_and_resilience():
    """Fix 5 & 10: Blockchain RPC errors are logged with warning and handled gracefully."""
    from unittest.mock import PropertyMock
    with patch.object(blockchain_service.BlockchainService, "contract", new_callable=PropertyMock) as mock_contract_prop:
        mock_contract = MagicMock()
        mock_contract_prop.return_value = mock_contract
        mock_contract.functions.getCustodyHistory.return_value.call.side_effect = Exception("RPC Network Timeout")
        mock_contract.functions.verifyEvidence.return_value.call.side_effect = Exception("Connection Refused")
        mock_contract.functions.getEvidenceRecord.return_value.call.side_effect = Exception("Contract Revert")

        # None of these should raise unhandled exceptions
        history = blockchain_service.get_custody_history("test_ev")
        assert history == []

        verified = blockchain_service.verify_evidence("test_ev", "test_hash")
        assert verified is False

        record = blockchain_service.get_evidence_record("test_ev")
        assert record is None


def test_fix_6_upload_validation_size_and_type():
    """Fix 6: File upload enforces allowed extensions and size limits."""
    db = TestingSessionLocal()
    user = User(
        id=uuid.uuid4(),
        username="inv_upload_test",
        email="upload@test.com",
        password_hash=hash_password("Pass123!"),
        role="investigator",
        is_active=True,
    )
    case = Case(
        id=uuid.uuid4(),
        case_number="CASE-UPLOAD-001",
        title="Upload Validation Case",
        created_by=user.id,
        assigned_to=user.id,
    )
    db.add_all([user, case])
    db.commit()

    token = create_access_token({"sub": str(user.id), "role": user.role})
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Disallowed file type
    disallowed_file = io.BytesIO(b"MZ\x90\x00executable binary")
    resp = client.post(
        "/evidence/upload",
        data={"case_id": str(case.id), "source_type": "report"},
        files={"file": ("malicious.exe", disallowed_file, "application/x-msdownload")},
        headers=headers,
    )
    assert resp.status_code == 415

    # 2. Exceeding max file size (simulated with mock or chunk test)
    with patch("ingestion.MAX_UPLOAD_BYTES", 50):
        large_file = io.BytesIO(b"A" * 100)
        resp = client.post(
            "/evidence/upload",
            data={"case_id": str(case.id), "source_type": "report"},
            files={"file": ("large_doc.txt", large_file, "text/plain")},
            headers=headers,
        )
        assert resp.status_code == 413
    db.close()


def test_fix_7_login_rate_limiting():
    """Fix 7: Brute-force protection limits failed login attempts per username."""
    db = TestingSessionLocal()
    user = User(
        id=uuid.uuid4(),
        username="target_victim",
        email="victim@test.com",
        password_hash=hash_password("CorrectPassword123!"),
        role="investigator",
        is_active=True,
    )
    db.add(user)
    db.commit()

    # Perform 5 failed login attempts
    for i in range(5):
        resp = client.post(
            "/auth/login",
            json={"username": "target_victim", "password": f"WrongPass{i}"},
        )
        assert resp.status_code == 401

    # 6th attempt should be blocked with 429
    resp_blocked = client.post(
        "/auth/login",
        json={"username": "target_victim", "password": "WrongPass6"},
    )
    assert resp_blocked.status_code == 429
    assert "Retry-After" in resp_blocked.headers

    # Another user is not locked out
    resp_other = client.post(
        "/auth/login",
        json={"username": "unrelated_user", "password": "WrongPassword"},
    )
    assert resp_other.status_code == 401  # Normal 401, not 429

    db.close()


def test_fix_8_cors_configuration():
    """Fix 8: CORS is restricted to explicit allowed origins rather than wildcard with credentials."""
    from fastapi.middleware.cors import CORSMiddleware
    cors_middleware = None
    for middleware in app.user_middleware:
        if middleware.cls == CORSMiddleware:
            cors_middleware = middleware
            break
    assert cors_middleware is not None
    allowed_origins = cors_middleware.kwargs.get("allow_origins", [])
    assert "*" not in allowed_origins
    assert "http://localhost:3000" in allowed_origins

    # Test preflight CORS response for allowed origin
    resp = client.options(
        "/health",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert resp.status_code == 200
    assert resp.headers.get("access-control-allow-origin") == "http://localhost:3000"



def test_fix_9_audit_log_ip_tracking():
    """Fix 9: Audit log records the caller IP address."""
    db = TestingSessionLocal()
    user = User(
        id=uuid.uuid4(),
        username="inv_ip_test",
        email="ip@test.com",
        password_hash=hash_password("Pass123!"),
        role="investigator",
        is_active=True,
    )
    db.add(user)
    db.commit()

    # Login with X-Forwarded-For
    resp = client.post(
        "/auth/login",
        json={"username": "inv_ip_test", "password": "Pass123!"},
        headers={"X-Forwarded-For": "203.0.113.195"},
    )
    assert resp.status_code == 200

    # Query audit log entry for this login
    audit_entry = (
        db.query(AuditLog)
        .filter(AuditLog.user_id == user.id, AuditLog.action == "login")
        .order_by(AuditLog.created_at.desc())
        .first()
    )
    assert audit_entry is not None
    assert audit_entry.ip_address == "203.0.113.195"
    db.close()
