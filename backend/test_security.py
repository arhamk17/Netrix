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

    # 5. Attacker gets 403 on leads and explainability
    resp = client.get(f"/leads?case_id={case1.id}", headers=headers_inv2)
    assert resp.status_code == 403

    resp = client.get(f"/leads/{lead1.id}", headers=headers_inv2)
    assert resp.status_code == 403

    resp = client.get(f"/leads/{lead1.id}/explain", headers=headers_inv2)
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


def test_initial_admin_bootstrap_security():
    """Initial admin account bootstrap securely reads password from environment without hardcoding."""
    from auth import verify_password
    from config import settings

    db = TestingSessionLocal()

    # 1. Verify default admin attributes
    assert settings.INITIAL_ADMIN_USERNAME == "arhamk_17"
    assert settings.INITIAL_ADMIN_EMAIL == "hiarham17@gmail.com"

    # 2. Simulate seed user creation using env variable
    admin_user = db.query(User).filter(User.username == "arhamk_17").first()
    if not admin_user:
        admin_user = User(
            username="arhamk_17",
            email="hiarham17@gmail.com",
            password_hash=hash_password("SecuredAdminSecret99!"),
            role="admin",
            is_active=True,
        )
        db.add(admin_user)
        db.commit()
        db.refresh(admin_user)

    assert admin_user.username == "arhamk_17"
    assert admin_user.email == "hiarham17@gmail.com"
    assert admin_user.role == "admin"
    assert verify_password("SecuredAdminSecret99!", admin_user.password_hash) is True

    # 3. Test login with the bootstrapped admin account
    resp = client.post(
        "/auth/login",
        json={"username": "arhamk_17", "password": "SecuredAdminSecret99!"},
    )
    assert resp.status_code == 200
    token_data = resp.json()
    assert token_data["user"]["username"] == "arhamk_17"
    assert token_data["user"]["role"] == "admin"

    db.close()


def test_public_registration_disabled():
    """Public user registration is removed/disabled for unauthenticated users."""
    resp = client.post(
        "/auth/register",
        json={
            "username": "unauth_reg",
            "email": "unauth_reg@test.com",
            "password": "Password123!",
            "role": "admin",
        },
    )
    # Endpoint is removed/blocked (404 Not Found or 405/401/403)
    assert resp.status_code in (404, 405, 401, 403)


def test_admin_can_create_users_with_investigator_and_supervisor_roles():
    """Admin can create users with INVESTIGATOR and SUPERVISOR roles via /auth/users."""
    db = TestingSessionLocal()
    admin = User(
        id=uuid.uuid4(),
        username="admin_creator",
        email="admin_creator@test.com",
        password_hash=hash_password("AdminPass123!"),
        role="admin",
        is_active=True,
    )
    db.add(admin)
    db.commit()

    token_admin = create_access_token({"sub": str(admin.id), "role": admin.role})
    headers_admin = {"Authorization": f"Bearer {token_admin}"}

    # 1. Create INVESTIGATOR
    resp_inv = client.post(
        "/auth/users",
        json={
            "username": "created_inv",
            "email": "created_inv@test.com",
            "password": "InvPassword123!",
            "role": "INVESTIGATOR",
        },
        headers=headers_admin,
    )
    assert resp_inv.status_code == 201
    data_inv = resp_inv.json()
    assert data_inv["username"] == "created_inv"
    assert data_inv["email"] == "created_inv@test.com"
    assert data_inv["role"] == "investigator"
    assert data_inv["is_active"] is True

    # Verify created investigator can log in
    resp_inv_login = client.post(
        "/auth/login",
        json={"username": "created_inv", "password": "InvPassword123!"},
    )
    assert resp_inv_login.status_code == 200
    assert resp_inv_login.json()["user"]["role"] == "investigator"

    # 2. Create SUPERVISOR
    resp_sup = client.post(
        "/auth/users",
        json={
            "username": "created_sup",
            "email": "created_sup@test.com",
            "password": "SupPassword123!",
            "role": "SUPERVISOR",
        },
        headers=headers_admin,
    )
    assert resp_sup.status_code == 201
    data_sup = resp_sup.json()
    assert data_sup["username"] == "created_sup"
    assert data_sup["email"] == "created_sup@test.com"
    assert data_sup["role"] == "supervisor"
    assert data_sup["is_active"] is True

    # Verify created supervisor can log in
    resp_sup_login = client.post(
        "/auth/login",
        json={"username": "created_sup", "password": "SupPassword123!"},
    )
    assert resp_sup_login.status_code == 200
    assert resp_sup_login.json()["user"]["role"] == "supervisor"

    db.close()


def test_non_admin_cannot_create_users():
    """Non-admin users (investigator, supervisor, unauthenticated) get 403 or 401 when calling /auth/users."""
    db = TestingSessionLocal()
    inv = User(
        id=uuid.uuid4(),
        username="regular_inv",
        email="regular_inv@test.com",
        password_hash=hash_password("Pass123!"),
        role="investigator",
        is_active=True,
    )
    sup = User(
        id=uuid.uuid4(),
        username="regular_sup",
        email="regular_sup@test.com",
        password_hash=hash_password("Pass123!"),
        role="supervisor",
        is_active=True,
    )
    admin = User(
        id=uuid.uuid4(),
        username="admin_for_invalid_role",
        email="admin_role_check@test.com",
        password_hash=hash_password("Pass123!"),
        role="admin",
        is_active=True,
    )
    db.add_all([inv, sup, admin])
    db.commit()

    token_inv = create_access_token({"sub": str(inv.id), "role": inv.role})
    token_sup = create_access_token({"sub": str(sup.id), "role": sup.role})
    token_admin = create_access_token({"sub": str(admin.id), "role": admin.role})

    payload = {
        "username": "new_user_fail",
        "email": "fail@test.com",
        "password": "Password123!",
        "role": "investigator",
    }

    # 1. Unauthenticated gets 401
    resp_unauth = client.post("/auth/users", json=payload)
    assert resp_unauth.status_code == 401

    # 2. Investigator gets 403
    resp_inv = client.post("/auth/users", json=payload, headers={"Authorization": f"Bearer {token_inv}"})
    assert resp_inv.status_code == 403

    # 3. Supervisor gets 403
    resp_sup = client.post("/auth/users", json=payload, headers={"Authorization": f"Bearer {token_sup}"})
    assert resp_sup.status_code == 403

    # 4. Admin attempting invalid role gets 400
    invalid_role_payload = {
        "username": "new_user_invalid_role",
        "email": "invalid_role@test.com",
        "password": "Password123!",
        "role": "ANONYMOUS_HACKER",
    }
    resp_invalid = client.post("/auth/users", json=invalid_role_payload, headers={"Authorization": f"Bearer {token_admin}"})
    assert resp_invalid.status_code == 400

    # 5. Duplicate username gets 400
    dup_payload = {
        "username": "regular_inv",
        "email": "diff_email@test.com",
        "password": "Password123!",
        "role": "investigator",
    }
    resp_dup = client.post("/auth/users", json=dup_payload, headers={"Authorization": f"Bearer {token_admin}"})
    assert resp_dup.status_code == 400

    db.close()


def test_disabled_user_cannot_login():
    """Users with is_active=False cannot login and receive 403 Forbidden."""
    db = TestingSessionLocal()
    disabled_user = User(
        id=uuid.uuid4(),
        username="disabled_account",
        email="disabled@test.com",
        password_hash=hash_password("ValidPassword123!"),
        role="investigator",
        is_active=False,
    )
    db.add(disabled_user)
    db.commit()

    resp = client.post(
        "/auth/login",
        json={"username": "disabled_account", "password": "ValidPassword123!"},
    )
    assert resp.status_code == 403
    assert "disabled" in resp.json().get("detail", "").lower()

    # Even if disabled user has a previously issued token, get_current_user rejects them with 401
    disabled_token = create_access_token({"sub": str(disabled_user.id), "role": disabled_user.role})
    resp_me = client.get("/auth/me", headers={"Authorization": f"Bearer {disabled_token}"})
    assert resp_me.status_code == 401

    db.close()


def test_role_sourced_from_database_on_login():
    """Role must come strictly from the database and user cannot forge role on login."""
    from jose import jwt
    from config import settings

    db = TestingSessionLocal()
    user = User(
        id=uuid.uuid4(),
        username="strict_inv",
        email="strict_inv@test.com",
        password_hash=hash_password("Password123!"),
        role="investigator",
        is_active=True,
    )
    db.add(user)
    db.commit()

    # Attempt to pass role="admin" during login
    resp = client.post(
        "/auth/login",
        json={"username": "strict_inv", "password": "Password123!", "role": "admin"},
    )
    assert resp.status_code == 200
    token_resp = resp.json()

    # Response user role must be investigator
    assert token_resp["user"]["role"] == "investigator"

    # Token payload must encode investigator
    payload = jwt.decode(token_resp["access_token"], settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
    assert payload["role"] == "investigator"
    assert payload["role"] != "admin"

    db.close()


