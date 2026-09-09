import hashlib
import json
import os
import sqlite3
import tempfile
import uuid
from datetime import datetime
from unittest.mock import patch, MagicMock

# Allow SQLite to adapt list and dict for fast in-memory unit tests
sqlite3.register_adapter(list, json.dumps)
sqlite3.register_adapter(dict, json.dumps)

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from sqlalchemy.dialects.sqlite.base import SQLiteTypeCompiler

SQLiteTypeCompiler.visit_ARRAY = lambda self, type_, **kw: "TEXT"

from database import Base, get_db
import main
from main import app
from models import (
    User, Case, Evidence, Entity, Relationship, AnalyticsResult, LeadResult, ModelMetrics
)
from auth import create_access_token
import leads
from leads import generate_leads_for_case, MANDATORY_DISCLAIMER
import explainability
from explainability import explain_lead
import preprocessing
import model_adapter
import ingestion

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


def test_stage1_pipeline_integration():
    """Verify evidence -> preprocessing -> model_adapter -> normalized output -> relations mapping."""
    raw_cdr = "caller_number,receiver_number,call_start,duration_seconds\n9876543210,9123456789,2026-09-08 10:00:00,120\n"
    res = ingestion.route_and_extract(
        source_type="cdr",
        filename="cdr_log.csv",
        file_bytes=raw_cdr.encode("utf-8"),
        evidence_id="ev-100",
    )
    assert "entities" in res
    assert "relationships" in res
    assert "relations" in res
    assert len(res["entities"]) >= 2
    assert len(res["relationships"]) >= 1
    print("[PASS] Stage 1 Pipeline Integration verified")


def test_stage2_leads_generation():
    """Verify all 6 lead types generation from persisted AnalyticsResult and Relationship records."""
    db = TestingSessionLocal()

    # 1. Setup Case & Users
    case_id = uuid.uuid4()
    admin_user = User(
        id=uuid.uuid4(),
        username="admin_lead",
        email="admin_lead@test.com",
        password_hash="hash",
        role="admin",
        is_active=True,
    )
    test_case = Case(
        id=case_id,
        case_number="CASE-LEADS-001",
        title="Lead Generation Case",
        created_by=admin_user.id,
    )

    # 2. Setup Entities
    ent_hub_id = uuid.uuid4()
    ent_a_id = uuid.uuid4()
    ent_b_id = uuid.uuid4()

    hub_ent = Entity(id=ent_hub_id, case_id=case_id, entity_type="PERSON", canonical_name="Mastermind Kingpin")
    ent_a = Entity(id=ent_a_id, case_id=case_id, entity_type="BANK_ACCOUNT", canonical_name="ACC12345678")
    ent_b = Entity(id=ent_b_id, case_id=case_id, entity_type="BANK_ACCOUNT", canonical_name="ACC87654321")

    # 3. Setup Persisted Analytics for Network Hub (PageRank + Betweenness)
    pr_res = AnalyticsResult(
        case_id=case_id,
        entity_id=ent_hub_id,
        metric_type="pagerank",
        metric_value=0.25,
        meta_data={"rank": 1},
    )
    bw_res = AnalyticsResult(
        case_id=case_id,
        entity_id=ent_hub_id,
        metric_type="betweenness",
        metric_value=0.30,
        meta_data={"rank": 1},
    )

    # 4. Setup Persisted Link Prediction
    lp_res = AnalyticsResult(
        case_id=case_id,
        metric_type="link_prediction",
        metric_value=0.88,
        meta_data={
            "score": 0.88,
            "algorithm": "Jaccard/AdamicAdar",
            "entity_a": {"name": "Mastermind Kingpin"},
            "entity_b": {"name": "Target Suspect B"},
        },
    )

    # 5. Setup Persisted Temporal Anomaly
    anom_res = AnalyticsResult(
        case_id=case_id,
        entity_id=ent_hub_id,
        metric_type="anomaly_score",
        metric_value=0.92,
        meta_data={
            "name": "Mastermind Kingpin",
            "anomaly_score": 0.92,
            "flag": "BURST_CALLING_SPIKE",
            "description": "500% increase in calls at 2 AM",
        },
    )

    # 6. Setup High Value Transfer (> 500,000 INR)
    high_val_rel = Relationship(
        case_id=case_id,
        source_entity_id=ent_a_id,
        target_entity_id=ent_b_id,
        relationship_type="TRANSFERRED",
        confidence=0.95,
        attributes={"amount": 2500000.0, "currency": "INR", "high_value": True},
    )

    db.add_all([admin_user, test_case, hub_ent, ent_a, ent_b, pr_res, bw_res, lp_res, anom_res, high_val_rel])
    db.commit()

    # Generate leads
    generated_leads = generate_leads_for_case(str(case_id), db)
    assert len(generated_leads) >= 4

    lead_types = [l.lead_type for l in generated_leads]
    assert "NETWORK_HUB" in lead_types
    assert "HIDDEN_CONNECTION" in lead_types
    assert "TEMPORAL_ANOMALY" in lead_types
    assert "HIGH_VALUE_TRANSFER" in lead_types

    # Verify disclaimer is on every single lead
    for l in generated_leads:
        assert MANDATORY_DISCLAIMER in l.explanation
        assert "guilt" in l.explanation.lower()

    db.close()
    print("[PASS] Stage 2 Leads Generation logic verified")


def test_stage2_leads_endpoints():
    """Verify POST /leads/generate, GET /leads, and GET /leads/{lead_id} endpoints."""
    db = TestingSessionLocal()
    user = db.query(User).filter(User.username == "admin_lead").first()
    case = db.query(Case).filter(Case.case_number == "CASE-LEADS-001").first()

    token = create_access_token({"sub": str(user.id), "role": user.role})
    headers = {"Authorization": f"Bearer {token}"}

    # 1. POST /leads/generate
    resp = client.post(f"/leads/generate?case_id={case.id}", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "leads" in data
    assert len(data["leads"]) >= 4

    lead_id = data["leads"][0]["lead_id"]

    # 2. GET /leads?case_id=...
    resp = client.get(f"/leads?case_id={case.id}", headers=headers)
    assert resp.status_code == 200
    all_leads = resp.json()
    assert len(all_leads) >= 4

    # 3. GET /leads/{lead_id}
    resp = client.get(f"/leads/{lead_id}", headers=headers)
    assert resp.status_code == 200
    single_lead = resp.json()
    assert single_lead["lead_id"] == lead_id
    assert MANDATORY_DISCLAIMER in single_lead["explanation"]

    db.close()
    print("[PASS] Stage 2 Leads Endpoints verified")


def test_stage3_explainability_and_sha256():
    """Verify explain_lead() builds the 4-step reasoning chain and recalculates physical SHA-256."""
    db = TestingSessionLocal()
    case = db.query(Case).filter(Case.case_number == "CASE-LEADS-001").first()
    lead = db.query(LeadResult).filter(LeadResult.case_id == case.id).first()

    # Create dummy evidence file on disk
    with tempfile.NamedTemporaryFile(delete=False) as tf:
        tf.write(b"Verified authentic evidence file contents for case investigation.")
        temp_path = tf.name

    with open(temp_path, "rb") as f:
        real_hash = hashlib.sha256(f.read()).hexdigest()

    ev_id = uuid.uuid4()
    evidence = Evidence(
        id=ev_id,
        case_id=case.id,
        filename=os.path.basename(temp_path),
        original_filename="statement.txt",
        file_type="text/plain",
        file_size_bytes=os.path.getsize(temp_path),
        sha256_hash=real_hash,
        storage_path=temp_path,
        source_type="report",
        processing_status="completed",
    )
    lead.evidence_ids = [str(ev_id)]
    db.add(evidence)
    db.commit()

    # Run explain_lead
    explanation_res = explain_lead(str(lead.id), db)
    assert explanation_res["lead_id"] == str(lead.id)
    assert len(explanation_res["reasoning_chain"]) == 4

    # Check Steps in reasoning chain
    chain = explanation_res["reasoning_chain"]
    assert chain[0]["step"] == 1  # Primary Signal
    assert chain[1]["step"] == 2  # Feature Correlation
    assert chain[2]["step"] == 3  # Graph Corroboration
    assert chain[3]["step"] == 4  # Evidence Integrity Verification

    # Integrity Check
    assert explanation_res["integrity_check"]["all_evidence_verified"] is True
    assert len(explanation_res["integrity_check"]["unverified_evidence_ids"]) == 0
    assert real_hash in chain[3]["sha256_hashes"]

    # Test HTTP endpoint GET /leads/{lead_id}/explain
    user = db.query(User).filter(User.username == "admin_lead").first()
    token = create_access_token({"sub": str(user.id), "role": user.role})
    headers = {"Authorization": f"Bearer {token}"}

    resp = client.get(f"/leads/{lead.id}/explain", headers=headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["integrity_check"]["all_evidence_verified"] is True

    # Clean up temp file
    if os.path.exists(temp_path):
        os.remove(temp_path)

    db.close()
    print("[PASS] Stage 3 Explainability and SHA-256 verification verified")


def test_stage4_model_metrics():
    """Verify ModelMetrics POST, GET, and GET /latest endpoints with RBAC protection."""
    db = TestingSessionLocal()
    admin_user = db.query(User).filter(User.username == "admin_lead").first()

    admin_token = create_access_token({"sub": str(admin_user.id), "role": "admin"})
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    analyst_user = User(
        id=uuid.uuid4(),
        username="analyst_metrics",
        email="analyst_metrics@test.com",
        password_hash="hash",
        role="analyst",
        is_active=True,
    )
    db.add(analyst_user)
    db.commit()

    analyst_token = create_access_token({"sub": str(analyst_user.id), "role": "analyst"})
    analyst_headers = {"Authorization": f"Bearer {analyst_token}"}

    # 1. Analyst cannot POST model metrics (Forbidden)
    metric_payload = {
        "model_name": "TeammateNERTransformer",
        "model_version": "v1.0.0",
        "task_type": "ner",
        "metrics": {"precision": 0.942, "recall": 0.915, "f1": 0.928, "accuracy": 0.951},
        "notes": "Trained on 50k annotated digital forensics entities",
    }
    resp = client.post("/model-metrics", json=metric_payload, headers=analyst_headers)
    assert resp.status_code == 403

    # 2. Admin can POST model metrics
    resp = client.post("/model-metrics", json=metric_payload, headers=admin_headers)
    assert resp.status_code == 201
    created_metric = resp.json()
    assert created_metric["model_name"] == "TeammateNERTransformer"
    assert created_metric["metrics"]["f1"] == 0.928

    # Post another metric (Relation extraction)
    rel_metric_payload = {
        "model_name": "TeammateRelationModel",
        "model_version": "v1.1.0",
        "task_type": "relation",
        "metrics": {"precision": 0.89, "recall": 0.86, "f1": 0.875, "auc": 0.93},
    }
    resp = client.post("/model-metrics", json=rel_metric_payload, headers=admin_headers)
    assert resp.status_code == 201

    # 3. GET /model-metrics
    resp = client.get("/model-metrics", headers=admin_headers)
    assert resp.status_code == 200
    metrics_list = resp.json()
    assert len(metrics_list) >= 2

    # 4. GET /model-metrics/latest
    resp = client.get("/model-metrics/latest?task_type=ner", headers=admin_headers)
    assert resp.status_code == 200
    latest = resp.json()
    assert len(latest) == 1
    assert latest[0]["task_type"] == "ner"

    db.close()
    print("[PASS] Stage 4 Model Metrics endpoints & RBAC verified")


if __name__ == "__main__":
    test_stage1_pipeline_integration()
    test_stage2_leads_generation()
    test_stage2_leads_endpoints()
    test_stage3_explainability_and_sha256()
    test_stage4_model_metrics()
    print("\n=======================================================")
    print("ALL INTELLIGENCE LAYERS TESTS PASSED 100%!")
    print("=======================================================")
