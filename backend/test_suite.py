import json
import sqlite3
import uuid
from datetime import datetime
from unittest.mock import patch, MagicMock

# Allow SQLite to adapt list and dict for fast in-memory unit tests
sqlite3.register_adapter(list, json.dumps)
sqlite3.register_adapter(dict, json.dumps)

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.dialects.sqlite.base import SQLiteTypeCompiler

# Allow SQLite to compile PostgreSQL ARRAY and JSON as TEXT for fast in-memory unit tests
SQLiteTypeCompiler.visit_ARRAY = lambda self, type_, **kw: "TEXT"


from database import Base

import models
from models import User, Case, Evidence, Entity, Relationship, AnalyticsResult, IPSResult
import schemas
import auth
from auth import require_roles
import ingestion
import nlp_pipeline
import analytics
import ai_assistant
from config import settings



def setup_in_memory_db():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    return TestingSessionLocal()


def test_models_and_tables():
    """Requirement 3 & 4: Relationship and AnalyticsResult models exist and have valid columns."""
    assert hasattr(models, "Relationship")
    assert hasattr(models, "AnalyticsResult")

    db = setup_in_memory_db()

    # Create dummy case and entities
    case_id = uuid.uuid4()
    ent1_id = uuid.uuid4()
    ent2_id = uuid.uuid4()

    case = Case(id=case_id, case_number="CASE-001", title="Test Case")
    ent1 = Entity(id=ent1_id, case_id=case_id, entity_type="PERSON", canonical_name="Alice Smith")
    ent2 = Entity(id=ent2_id, case_id=case_id, entity_type="PHONE", canonical_name="9876543210")
    db.add_all([case, ent1, ent2])
    db.commit()

    # Test Relationship ORM
    rel = Relationship(
        case_id=case_id,
        source_entity_id=ent1_id,
        target_entity_id=ent2_id,
        relationship_type="USES",
        confidence=0.9,
        provenance_type="OBSERVED",
        attributes={"source": "test"},
    )
    db.add(rel)
    db.commit()

    fetched_rel = db.query(Relationship).filter(Relationship.case_id == case_id).first()
    assert fetched_rel is not None
    assert fetched_rel.relationship_type == "USES"
    assert fetched_rel.confidence == 0.9

    # Test AnalyticsResult ORM
    res = AnalyticsResult(
        case_id=case_id,
        entity_id=ent1_id,
        metric_type="pagerank",
        metric_value=0.85,
        meta_data={"rank": 1},
    )
    db.add(res)
    db.commit()

    fetched_res = db.query(AnalyticsResult).filter(AnalyticsResult.case_id == case_id).first()
    assert fetched_res is not None
    assert fetched_res.metric_type == "pagerank"
    assert fetched_res.metric_value == 0.85
    assert fetched_res.meta_data == {"rank": 1}

    # Test Event ORM (real-world incident/event timestamp)
    event_time = datetime(2026, 9, 8, 12, 0, 0)
    ev_record = models.Event(
        case_id=case_id,
        event_type="CYBER_INCIDENT",
        title="Unauthorized Database Dump",
        description="Data exfiltration observed on port 443",
        timestamp=event_time,
        location="Frankfurt Data Center",
    )
    db.add(ev_record)
    db.commit()

    fetched_ev = db.query(models.Event).filter(models.Event.case_id == case_id).first()
    assert fetched_ev is not None
    assert fetched_ev.event_type == "CYBER_INCIDENT"
    assert fetched_ev.timestamp == event_time

    db.close()
    print("[PASS] test_models_and_tables passed")


def test_role_enforcement():
    """Requirement 8: require_roles allows permitted roles and raises 403 for unauthorized roles."""
    investigator_user = User(id=uuid.uuid4(), username="inv", role="investigator")
    analyst_user = User(id=uuid.uuid4(), username="ana", role="analyst")
    admin_user = User(id=uuid.uuid4(), username="adm", role="admin")

    checker = require_roles("investigator", "supervisor", "admin")

    # Authorized roles
    assert checker(current_user=investigator_user) == investigator_user
    assert checker(current_user=admin_user) == admin_user

    # Unauthorized role raises 403
    unauthorized_caught = False
    try:
        checker(current_user=analyst_user)
    except HTTPException as exc_info:
        if exc_info.status_code == 403:
            unauthorized_caught = True
    assert unauthorized_caught, "Expected 403 Forbidden for analyst role"
    print("[PASS] test_role_enforcement passed")


def test_global_entity_resolution():
    """Requirement 2: resolve_entities_global matches, merges aliases/evidence_ids, avoids duplicates."""
    db = setup_in_memory_db()
    case_id = uuid.uuid4()
    case = Case(id=case_id, case_number="CASE-002", title="Resolution Case")
    db.add(case)
    db.commit()

    # Initial batch of entities
    batch1 = [
        {"text": "Johnathan Doe", "label": "PERSON", "confidence": 0.8, "evidence_id": "ev-1"},
        {"text": "9876543210", "label": "PHONE", "confidence": 0.9, "evidence_id": "ev-1"},
    ]
    canonical_1 = nlp_pipeline.resolve_entities_global(str(case_id), batch1, db)
    assert len(canonical_1) == 2
    assert db.query(Entity).filter(Entity.case_id == case_id).count() == 2

    # Second batch with fuzzy match for Person and exact match for Phone
    batch2 = [
        {"text": "Johnathan Doe", "label": "PERSON", "confidence": 0.95, "evidence_id": "ev-2"},
        {"text": "9876543210", "label": "PHONE", "confidence": 0.9, "evidence_id": "ev-2"},
        {"text": "Jane Smith", "label": "PERSON", "confidence": 0.85, "evidence_id": "ev-2"},
    ]
    with patch("database.get_neo4j_session") as mock_neo:
        mock_session = MagicMock()
        mock_neo.return_value.__enter__.return_value = mock_session
        canonical_2 = nlp_pipeline.resolve_entities_global(str(case_id), batch2, db)


    # Total entities in DB should now be 3 (Johnathan Doe, 9876543210, Jane Smith) - NOT duplicated
    all_ents = db.query(Entity).filter(Entity.case_id == case_id).all()
    assert len(all_ents) == 3

    # Check that Johnathan Doe's evidence_ids merged 'ev-1' and 'ev-2'
    john = db.query(Entity).filter(Entity.case_id == case_id, Entity.canonical_name == "Johnathan Doe").first()
    assert set(john.source_evidence_ids) == {"ev-1", "ev-2"}
    assert john.confidence == 0.95

    # Check phone evidence_ids merged
    phone = db.query(Entity).filter(Entity.case_id == case_id, Entity.canonical_name == "9876543210").first()
    assert set(phone.source_evidence_ids) == {"ev-1", "ev-2"}

    db.close()
    print("[PASS] test_global_entity_resolution passed")


def test_relationship_persistence():
    """Requirement 3: Persisting relationships with canonical entity IDs and deduplication."""
    db = setup_in_memory_db()
    case_id = uuid.uuid4()
    case = Case(id=case_id, case_number="CASE-003", title="Rel Case")
    db.add(case)

    p1 = Entity(case_id=case_id, entity_type="PERSON", canonical_name="Alice Smith", aliases=["Alice S."])
    p2 = Entity(case_id=case_id, entity_type="PHONE", canonical_name="9876543210")
    db.add_all([p1, p2])
    db.commit()

    ev_id = str(uuid.uuid4())
    relations = [
        {
            "subject": "Alice S.",
            "subject_label": "PERSON",
            "predicate": "USES",
            "object": "9876543210",
            "object_label": "PHONE",
            "confidence": 0.85,
            "evidence_id": ev_id,
            "timestamp": "2024-01-01T12:00:00Z",
            "attributes": {"call_count": 5},
        }
    ]

    canonical_entities = [p1, p2]
    persisted = nlp_pipeline.persist_relationships(str(case_id), relations, canonical_entities, ev_id, db)
    assert len(persisted) == 1
    assert persisted[0].source_entity_id == p1.id
    assert persisted[0].target_entity_id == p2.id
    assert persisted[0].relationship_type == "USES"

    # Persisting same relationship again should update without creating duplicate
    relations[0]["confidence"] = 0.95
    relations[0]["attributes"] = {"call_count": 10}
    persisted_again = nlp_pipeline.persist_relationships(str(case_id), relations, canonical_entities, ev_id, db)

    assert len(persisted_again) == 1
    assert db.query(Relationship).filter(Relationship.case_id == case_id).count() == 1
    assert persisted_again[0].confidence == 0.95
    assert persisted_again[0].attributes.get("call_count") == 10

    db.close()
    print("[PASS] test_relationship_persistence passed")


def test_analytics_upsert():
    """Requirement 4: AnalyticsResult upsert logic does not duplicate rows."""
    db = setup_in_memory_db()
    case_id = str(uuid.uuid4())
    ent_id = uuid.uuid4()

    # 1. First upsert
    res1 = analytics.upsert_analytics_result(
        db=db,
        case_id=case_id,
        metric_type="degree",
        metric_value=5.0,
        entity_id=ent_id,
        metadata={"entity_name": "Alice"},
    )
    db.commit()
    assert db.query(AnalyticsResult).count() == 1
    assert res1.metric_value == 5.0

    # 2. Repeated upsert with updated value
    res2 = analytics.upsert_analytics_result(
        db=db,
        case_id=case_id,
        metric_type="degree",
        metric_value=8.0,
        entity_id=ent_id,
        metadata={"entity_name": "Alice", "updated": True},
    )
    db.commit()
    assert db.query(AnalyticsResult).count() == 1
    assert res2.id == res1.id
    assert res2.metric_value == 8.0
    assert res2.meta_data.get("updated") is True

    db.close()
    print("[PASS] test_analytics_upsert passed")


def test_local_ai_model_priority():
    """Requirement 7: ask_network tries local AI model first, falls back to Gemini / heuristic."""
    # 1. Local model URL configured -> calls local model
    with patch("ai_assistant.settings") as mock_settings:
        mock_settings.LOCAL_MODEL_URL = "http://localhost:8000"
        mock_settings.GEMINI_API_KEY = "test-key"

        with patch("ai_assistant.call_inference_model", return_value="Local AI Answer") as mock_call:
            with patch("ai_assistant.build_graph_context", return_value="Node A -> Node B"):
                ans = ai_assistant.ask_network("Who is connected?", "case-1", [])
                assert ans["answer"] == "Local AI Answer"
                mock_call.assert_called_once()

    # 2. Local model fails -> falls back to Gemini
    with patch("ai_assistant.settings") as mock_settings:
        mock_settings.LOCAL_MODEL_URL = "http://localhost:8000"
        mock_settings.GEMINI_API_KEY = "test-key"

        with patch("ai_assistant.call_inference_model", side_effect=Exception("Connection refused")):
            with patch("ai_assistant.build_graph_context", return_value="Node A -> Node B"):
                with patch("ai_assistant._get_gemini_client") as mock_gemini:
                    mock_resp = MagicMock()
                    mock_resp.text = "Gemini AI Answer"
                    mock_gemini.return_value.models.generate_content.return_value = mock_resp

                    ans = ai_assistant.ask_network("Who is connected?", "case-1", [])
                    assert ans["answer"] == "Gemini AI Answer"

    # 3. Neither configured -> fallback heuristic
    with patch("ai_assistant.settings") as mock_settings:
        mock_settings.LOCAL_MODEL_URL = ""
        mock_settings.GEMINI_API_KEY = ""

        with patch("ai_assistant.build_graph_context", return_value="[Person] Alice --[CALLS]--> [Person] Bob"):
            ans = ai_assistant.ask_network("Alice", "case-1", [])
            assert "Rule-based lookup" in ans["answer"]

    print("[PASS] test_local_ai_model_priority passed")


def test_evidence_sha256_verify():
    """Requirement 6: Evidence SHA-256 computation and verification."""
    data = b"criminal intelligence evidence report content"
    hash_val = ingestion.compute_sha256(data)
    assert len(hash_val) == 64
    assert hash_val == ingestion.compute_sha256(data)
    print("[PASS] test_evidence_sha256_verify passed")


if __name__ == "__main__":
    test_models_and_tables()
    test_role_enforcement()
    test_global_entity_resolution()
    test_relationship_persistence()
    test_analytics_upsert()
    test_local_ai_model_priority()
    test_evidence_sha256_verify()
    print("\n==========================================")
    print("ALL TESTS PASSED SUCCESSFULLY!")
    print("==========================================")
