import json
import sqlite3
import uuid
from unittest.mock import patch, MagicMock

sqlite3.register_adapter(list, json.dumps)
sqlite3.register_adapter(dict, json.dumps)

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.dialects.sqlite.base import SQLiteTypeCompiler

SQLiteTypeCompiler.visit_ARRAY = lambda self, type_, **kw: "TEXT"

from database import Base, get_db
import main
from main import app
from models import User, Case, Evidence, Entity, Relationship, AnalyticsResult
from auth import create_access_token

from sqlalchemy.pool import StaticPool

test_engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
Base.metadata.create_all(bind=test_engine)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)


def test_api_routes():
    db = TestingSessionLocal()
    # Create test user
    inv_user = User(
        id=uuid.uuid4(),
        username="investigator1",
        email="inv@test.com",
        password_hash="hash",
        role="investigator",
        is_active=True,
    )
    analyst_user = User(
        id=uuid.uuid4(),
        username="analyst1",
        email="ana@test.com",
        password_hash="hash",
        role="analyst",
        is_active=True,
    )
    case_id = uuid.uuid4()
    test_case = Case(
        id=case_id,
        case_number="CASE-API-001",
        title="API Test Case",
        created_by=inv_user.id,
        assigned_to=inv_user.id,
    )
    ent_id = uuid.uuid4()
    test_ent = Entity(
        id=ent_id,
        case_id=case_id,
        entity_type="PERSON",
        canonical_name="Target Suspect",
        aliases=["Suspect X"],
        confidence=0.9,
    )
    rel_id = uuid.uuid4()
    test_rel = Relationship(
        id=rel_id,
        case_id=case_id,
        source_entity_id=ent_id,
        target_entity_id=ent_id,
        relationship_type="SELF",
        confidence=0.9,
        provenance_type="OBSERVED",
    )
    ev_id = uuid.uuid4()
    test_ev = Evidence(
        id=ev_id,
        case_id=case_id,
        filename="test.txt",
        original_filename="test.txt",
        file_type="text/plain",
        file_size_bytes=10,
        sha256_hash="abc",
        storage_path="./test.txt",
        source_type="report",
        uploaded_by=inv_user.id,
        processing_status="completed",
    )
    db.add_all([inv_user, analyst_user, test_case, test_ent, test_rel, test_ev])
    inv_token = create_access_token({"sub": str(inv_user.id), "role": inv_user.role})
    inv_headers = {"Authorization": f"Bearer {inv_token}"}

    ana_token = create_access_token({"sub": str(analyst_user.id), "role": analyst_user.role})
    ana_headers = {"Authorization": f"Bearer {ana_token}"}

    db.commit()
    db.close()

    # 1. Health check
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"
    print("[PASS] GET /health passed")

    # 2. GET /cases/{case_id}/entities
    resp = client.get(f"/cases/{case_id}/entities", headers=inv_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["canonical_name"] == "Target Suspect"
    print("[PASS] GET /cases/{case_id}/entities passed")

    # 3. GET /cases/{case_id}/relationships
    resp = client.get(f"/cases/{case_id}/relationships", headers=inv_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["relationship_type"] == "SELF"
    print("[PASS] GET /cases/{case_id}/relationships passed")

    # 4. GET /evidence/{id}/status
    resp = client.get(f"/evidence/{ev_id}/status", headers=inv_headers)
    assert resp.status_code == 200
    assert resp.json()["processing_status"] == "completed"
    print("[PASS] GET /evidence/{id}/status passed")

    # 5. Role test: Analyst cannot create case
    resp = client.post(
        "/cases",
        json={"case_number": "CASE-FORBIDDEN", "title": "Unauthorized"},
        headers=ana_headers,
    )
    assert resp.status_code == 403
    print("[PASS] Role enforcement (Analyst denied POST /cases) passed")

    # 6. Role test: Investigator can create case
    resp = client.post(
        "/cases",
        json={"case_number": "CASE-ALLOWED", "title": "Authorized"},
        headers=inv_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["case_number"] == "CASE-ALLOWED"
    print("[PASS] Role enforcement (Investigator allowed POST /cases) passed")

    # 7. GET /analytics/centrality
    with patch("analytics.get_neo4j_session") as mock_neo:
        mock_session = MagicMock()
        mock_neo.return_value.__enter__.return_value = mock_session
        mock_session.run.return_value = [
            {"name": "Target Suspect", "type": "PERSON", "degree": 3, "betweenness": 0.5, "pagerank": 0.25}
        ]
        resp = client.get(f"/analytics/centrality?case_id={case_id}", headers=ana_headers)
        assert resp.status_code == 200
        print("[PASS] GET /analytics/centrality passed")


if __name__ == "__main__":
    test_api_routes()
    print("\n==========================================")
    print("ALL API ROUTE TESTS PASSED SUCCESSFULLY!")
    print("==========================================")
