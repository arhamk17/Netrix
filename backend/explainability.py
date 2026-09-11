import hashlib
import logging
import os
import uuid
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from auth import get_current_user, assert_case_access
from database import get_db
from models import Case, Entity, Evidence, LeadResult, Relationship, User
import schemas

logger = logging.getLogger(__name__)

explain_router = APIRouter(tags=["explainability"])


def _to_uuid(val: Any) -> Optional[uuid.UUID]:
    if val is None or isinstance(val, uuid.UUID):
        return val
    try:
        return uuid.UUID(str(val))
    except (ValueError, TypeError):
        return None


def verify_evidence_sha256(evidence: Evidence) -> tuple[bool, str]:
    """
    Recalculate SHA-256 hash from physical evidence storage file
    and compare against stored database hash.
    """
    if not evidence.storage_path or not os.path.exists(evidence.storage_path):
        return False, ""

    try:
        with open(evidence.storage_path, "rb") as f:
            computed_hash = hashlib.sha256(f.read()).hexdigest()
        stored_hash = evidence.sha256_hash or ""
        is_valid = computed_hash.lower() == stored_hash.lower()
        return is_valid, computed_hash
    except Exception as exc:
        logger.exception("Failed calculating SHA-256 for evidence %s: %s", evidence.id, exc)
        return False, ""


def explain_lead(lead_id: str, db: Session) -> Dict[str, Any]:
    """
    Build traceable reasoning chain for an investigative lead:
    Lead -> Contributing signal -> Reason/features -> Graph relationship/event -> Evidence ID -> SHA-256 verification.
    """
    l_uuid = _to_uuid(lead_id)
    if not l_uuid:
        raise HTTPException(status_code=400, detail="Invalid lead_id UUID format")

    lead = db.query(LeadResult).filter(LeadResult.id == l_uuid).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Investigative lead not found")

    reasoning_chain: List[Dict[str, Any]] = []
    unverified_evidence_ids: List[str] = []
    all_evidence_ids: List[str] = list(lead.evidence_ids or [])

    # Fetch associated entities in this case
    entities_involved = lead.entities_involved or []
    db_entities = (
        db.query(Entity)
        .filter(Entity.case_id == lead.case_id, Entity.canonical_name.in_(entities_involved))
        .all()
    )
    ent_id_map = {e.canonical_name: e.id for e in db_entities}
    ent_evidence_map: Dict[str, List[str]] = {}
    for e in db_entities:
        if e.source_evidence_ids:
            ent_evidence_map[e.canonical_name] = e.source_evidence_ids
            all_evidence_ids.extend(e.source_evidence_ids)

    # -------------------------------------------------------------------------
    # Step 1: Contributing Signal & Primary Detection
    # -------------------------------------------------------------------------
    signals = lead.contributing_signals or {}
    reasoning_chain.append({
        "step": 1,
        "signal_type": lead.lead_type,
        "description": f"Triggered by analytical pattern '{lead.lead_type}' with severity {lead.severity} and confidence {lead.confidence:.2f}.",
        "entities": entities_involved,
        "relationships": [],
        "evidence_ids": [str(ev_id) for ev_id in lead.evidence_ids or []],
        "sha256_hashes": [],
    })

    # -------------------------------------------------------------------------
    # Step 2: Feature / Behavioral Factors
    # -------------------------------------------------------------------------
    feature_desc_parts = []
    for k, v in signals.items():
        if k not in ("entity_id", "relationship_id"):
            feature_desc_parts.append(f"{k}: {v}")
    feature_desc = ", ".join(feature_desc_parts) if feature_desc_parts else "Analytical signals from graph models."

    reasoning_chain.append({
        "step": 2,
        "signal_type": "FEATURE_CORRELATION",
        "description": f"Observed feature values: {feature_desc}",
        "entities": entities_involved,
        "relationships": [],
        "evidence_ids": [],
        "sha256_hashes": [],
    })

    # -------------------------------------------------------------------------
    # Step 3: Graph Relationships and Events Linked
    # -------------------------------------------------------------------------
    rel_id_str = signals.get("relationship_id")
    rel_uuid = _to_uuid(rel_id_str) if rel_id_str else None
    matched_relationships = []

    if rel_uuid:
        rel = db.query(Relationship).filter(Relationship.id == rel_uuid).first()
        if rel:
            matched_relationships.append({
                "id": str(rel.id),
                "type": rel.relationship_type,
                "confidence": rel.confidence,
                "timestamp": str(rel.timestamp) if rel.timestamp else None,
                "attributes": rel.attributes or {},
            })
            if rel.evidence_id:
                all_evidence_ids.append(str(rel.evidence_id))
    elif len(entities_involved) >= 2:
        # Check relationships between involved entities
        ent_ids = [ent_id_map[name] for name in entities_involved if name in ent_id_map]
        if len(ent_ids) >= 2:
            rels = (
                db.query(Relationship)
                .filter(
                    Relationship.case_id == lead.case_id,
                    Relationship.source_entity_id.in_(ent_ids),
                    Relationship.target_entity_id.in_(ent_ids),
                )
                .all()
            )
            for r in rels:
                matched_relationships.append({
                    "id": str(r.id),
                    "type": r.relationship_type,
                    "confidence": r.confidence,
                    "timestamp": str(r.timestamp) if r.timestamp else None,
                    "attributes": r.attributes or {},
                })
                if r.evidence_id:
                    all_evidence_ids.append(str(r.evidence_id))

    reasoning_chain.append({
        "step": 3,
        "signal_type": "GRAPH_CORROBORATION",
        "description": f"Corroborated across {len(matched_relationships)} graph relationships and entities in case network.",
        "entities": entities_involved,
        "relationships": matched_relationships,
        "evidence_ids": [str(ev) for ev in list(set(all_evidence_ids)) if ev],
        "sha256_hashes": [],
    })

    # -------------------------------------------------------------------------
    # Step 4: Physical Evidence Integrity Verification
    # -------------------------------------------------------------------------
    unique_ev_ids = list(set([_to_uuid(ev_id) for ev_id in all_evidence_ids if _to_uuid(ev_id)]))
    verified_hashes: List[str] = []

    if unique_ev_ids:
        evidence_records = db.query(Evidence).filter(Evidence.id.in_(unique_ev_ids)).all()
        for ev in evidence_records:
            is_valid, computed_hash = verify_evidence_sha256(ev)
            if is_valid:
                verified_hashes.append(computed_hash)
            else:
                unverified_evidence_ids.append(str(ev.id))

    all_verified = len(unverified_evidence_ids) == 0

    reasoning_chain.append({
        "step": 4,
        "signal_type": "EVIDENCE_INTEGRITY",
        "description": f"Audited {len(unique_ev_ids)} source evidence files: {len(verified_hashes)} verified via physical SHA-256 match.",
        "entities": entities_involved,
        "relationships": [],
        "evidence_ids": [str(ev_id) for ev_id in unique_ev_ids],
        "sha256_hashes": verified_hashes,
    })

    return {
        "lead_id": str(lead.id),
        "explanation": lead.explanation,
        "reasoning_chain": reasoning_chain,
        "integrity_check": {
            "all_evidence_verified": all_verified,
            "unverified_evidence_ids": unverified_evidence_ids,
        },
    }


# ---------------------------------------------------------------------------
# API Route
# ---------------------------------------------------------------------------
@explain_router.get("/leads/{lead_id}/explain", response_model=schemas.ExplainLeadResponse)
def get_lead_explanation_endpoint(
    lead_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieve explainability chain and cryptographic evidence verification for a lead."""
    l_uuid = _to_uuid(lead_id)
    if not l_uuid:
        raise HTTPException(status_code=400, detail="Invalid lead_id UUID format")
    lead = db.query(LeadResult).filter(LeadResult.id == l_uuid).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Investigative lead not found")
    case = db.query(Case).filter(Case.id == lead.case_id).first()
    assert_case_access(case, current_user)
    return explain_lead(lead_id, db)
