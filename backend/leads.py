import logging
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from auth import get_current_user, require_roles, assert_case_access
from database import get_db
from models import AnalyticsResult, Case, Entity, LeadResult, Relationship, User
import schemas

logger = logging.getLogger(__name__)

leads_router = APIRouter(prefix="/leads", tags=["leads"])

MANDATORY_DISCLAIMER = "⚠️ This is an investigative lead, not a determination of guilt or criminal involvement."


def _to_uuid(val: Any) -> Optional[uuid.UUID]:
    if val is None or isinstance(val, uuid.UUID):
        return val
    try:
        return uuid.UUID(str(val))
    except (ValueError, TypeError):
        return None


def generate_leads_for_case(case_id: str, db: Session) -> List[LeadResult]:
    """
    Generate investigative leads by reading existing persisted AnalyticsResult
    and Relationship records from the database.
    DOES NOT recompute graph analytics.
    """
    c_uuid = _to_uuid(case_id)
    if not c_uuid:
        raise HTTPException(status_code=400, detail="Invalid case_id UUID format")

    case = db.query(Case).filter(Case.id == c_uuid).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    # Fetch all existing persisted analytics and relationships for this case
    analytics_records = db.query(AnalyticsResult).filter(AnalyticsResult.case_id == c_uuid).all()
    relationships = db.query(Relationship).filter(Relationship.case_id == c_uuid).all()
    entities = db.query(Entity).filter(Entity.case_id == c_uuid).all()
    entity_map = {e.id: e.canonical_name for e in entities}

    new_leads: List[LeadResult] = []

    # -------------------------------------------------------------------------
    # 1. NETWORK_HUB Leads: High PageRank + High Betweenness
    # -------------------------------------------------------------------------
    pagerank_records = {
        r.entity_id: r for r in analytics_records if r.metric_type == "pagerank" and r.entity_id
    }
    betweenness_records = {
        r.entity_id: r for r in analytics_records if r.metric_type == "betweenness" and r.entity_id
    }

    # Find intersection of entities having both metrics
    for ent_id, pr_res in pagerank_records.items():
        if ent_id in betweenness_records:
            bw_res = betweenness_records[ent_id]
            pr_val = pr_res.metric_value or 0.0
            bw_val = bw_res.metric_value or 0.0

            # Significant hub condition (e.g. non-zero betweenness and substantial PageRank)
            if pr_val > 0.05 and bw_val > 0.05:
                ent_name = entity_map.get(ent_id, str(ent_id))
                confidence = min(0.95, round(0.5 + (pr_val + bw_val) / 2.0, 2))
                explanation = (
                    f"Entity '{ent_name}' exhibits significant structural centrality in the network with "
                    f"PageRank score {pr_val:.3f} and Betweenness centrality {bw_val:.3f}, serving as a key "
                    f"communication or transaction intermediary. {MANDATORY_DISCLAIMER}"
                )
                new_leads.append(
                    LeadResult(
                        case_id=c_uuid,
                        lead_type="NETWORK_HUB",
                        entities_involved=[ent_name],
                        severity="CRITICAL" if (pr_val > 0.2 and bw_val > 0.2) else "HIGH",
                        confidence=confidence,
                        explanation=explanation,
                        evidence_ids=[],
                        contributing_signals={
                            "pagerank": pr_val,
                            "betweenness": bw_val,
                            "entity_id": str(ent_id),
                        },
                    )
                )

    # -------------------------------------------------------------------------
    # 2. HIDDEN_CONNECTION Leads: High link prediction score
    # -------------------------------------------------------------------------
    link_preds = [r for r in analytics_records if r.metric_type == "link_prediction"]
    for lp in link_preds:
        score = lp.metric_value or (lp.meta_data.get("score") if isinstance(lp.meta_data, dict) else 0.0) or 0.0
        if score >= 0.70:
            meta = lp.meta_data or {}
            ent_a = meta.get("entity_a", {}).get("name", "Unknown Entity A")
            ent_b = meta.get("entity_b", {}).get("name", "Unknown Entity B")
            algorithm = meta.get("algorithm", "LinkPrediction")

            explanation = (
                f"Predictive graph link modeling detected a potential unobserved association between "
                f"'{ent_a}' and '{ent_b}' with predictive score {score:.2f} via {algorithm}. "
                f"{MANDATORY_DISCLAIMER}"
            )
            new_leads.append(
                LeadResult(
                    case_id=c_uuid,
                    lead_type="HIDDEN_CONNECTION",
                    entities_involved=[ent_a, ent_b],
                    severity="HIGH" if score >= 0.85 else "MEDIUM",
                    confidence=round(score, 2),
                    explanation=explanation,
                    evidence_ids=[],
                    contributing_signals={
                        "score": score,
                        "algorithm": algorithm,
                        "entity_a": ent_a,
                        "entity_b": ent_b,
                    },
                )
            )

    # -------------------------------------------------------------------------
    # 3. TEMPORAL_ANOMALY Leads: Burst Calling or Dormancy Spike
    # -------------------------------------------------------------------------
    anomaly_records = [
        r for r in analytics_records if r.metric_type in ("anomaly_score", "temporal_anomaly", "burst_calling")
    ]
    for anom in anomaly_records:
        meta = anom.meta_data or {}
        flag = str(meta.get("flag", "")).upper()
        desc = meta.get("description", "Unusual temporal or communication pattern detected")
        score = anom.metric_value or meta.get("anomaly_score", 0.75)
        ent_name = meta.get("name") or entity_map.get(anom.entity_id, "Target Entity")

        lead_subtype = "BURST_CALLING" if "BURST" in flag or "CALL" in flag else "DORMANCY_SPIKE"
        explanation = (
            f"Temporal anomaly pattern ({lead_subtype}) identified for '{ent_name}': {desc}. "
            f"{MANDATORY_DISCLAIMER}"
        )
        new_leads.append(
            LeadResult(
                case_id=c_uuid,
                lead_type="TEMPORAL_ANOMALY",
                entities_involved=[ent_name],
                severity="HIGH" if score > 0.8 else "MEDIUM",
                confidence=round(min(0.95, score), 2),
                explanation=explanation,
                evidence_ids=[],
                contributing_signals={
                    "pattern": lead_subtype,
                    "anomaly_score": score,
                    "flag": flag,
                    "details": desc,
                },
            )
        )

    # -------------------------------------------------------------------------
    # 4. BEHAVIORAL_SHIFT Leads: Pre/Post event communication shift
    # -------------------------------------------------------------------------
    behavior_records = [
        r for r in analytics_records if r.metric_type in ("behavioral_shift", "pre_post_event_shift")
    ]
    for beh in behavior_records:
        meta = beh.meta_data or {}
        ent_name = meta.get("name") or entity_map.get(beh.entity_id, "Target Entity")
        shift_type = meta.get("shift_type", "PRE_POST_EVENT_SHIFT")
        score = beh.metric_value or 0.80

        explanation = (
            f"Significant behavioral deviation ({shift_type}) observed for '{ent_name}' surrounding "
            f"incident timeline. {MANDATORY_DISCLAIMER}"
        )
        new_leads.append(
            LeadResult(
                case_id=c_uuid,
                lead_type="BEHAVIORAL_SHIFT",
                entities_involved=[ent_name],
                severity="HIGH",
                confidence=round(score, 2),
                explanation=explanation,
                evidence_ids=[],
                contributing_signals=meta,
            )
        )

    # -------------------------------------------------------------------------
    # 5. HIGH_VALUE_TRANSFER Leads: Transfers > 500,000 INR
    # -------------------------------------------------------------------------
    for rel in relationships:
        if rel.relationship_type.upper() in ("TRANSFERRED", "PAYMENT", "TRANSACTION"):
            attrs = rel.attributes or {}
            amount = float(attrs.get("amount", 0.0) or 0.0)
            is_high_value = bool(attrs.get("high_value", False)) or amount > 500000.0

            if is_high_value or amount > 500000.0:
                src_name = entity_map.get(rel.source_entity_id, str(rel.source_entity_id))
                tgt_name = entity_map.get(rel.target_entity_id, str(rel.target_entity_id))
                curr = attrs.get("currency", "INR")
                ev_id_str = str(rel.evidence_id) if rel.evidence_id else None

                explanation = (
                    f"High-value financial transaction of {curr} {amount:,.2f} recorded from '{src_name}' "
                    f"to '{tgt_name}'. {MANDATORY_DISCLAIMER}"
                )
                new_leads.append(
                    LeadResult(
                        case_id=c_uuid,
                        lead_type="HIGH_VALUE_TRANSFER",
                        entities_involved=[src_name, tgt_name],
                        severity="CRITICAL" if amount >= 2000000 else "HIGH",
                        confidence=0.95,
                        explanation=explanation,
                        evidence_ids=[ev_id_str] if ev_id_str else [],
                        contributing_signals={
                            "amount": amount,
                            "currency": curr,
                            "source_entity": src_name,
                            "target_entity": tgt_name,
                            "relationship_id": str(rel.id),
                        },
                    )
                )

    # -------------------------------------------------------------------------
    # 6. COORDINATED_ACTIVITY Leads: Coordinated timing across clusters
    # -------------------------------------------------------------------------
    coord_records = [
        r for r in analytics_records if r.metric_type in ("coordinated_activity", "coordinated_timing", "louvain_community")
    ]
    for coord in coord_records:
        meta = coord.meta_data or {}
        # Identify dense/synchronized cluster activity
        if meta.get("coordinated") or coord.metric_type == "coordinated_timing":
            participants = meta.get("participants", [])
            score = coord.metric_value or 0.85
            explanation = (
                f"Coordinated temporal cluster activity detected among {len(participants)} entities. "
                f"{MANDATORY_DISCLAIMER}"
            )
            new_leads.append(
                LeadResult(
                    case_id=c_uuid,
                    lead_type="COORDINATED_ACTIVITY",
                    entities_involved=participants,
                    severity="HIGH",
                    confidence=round(score, 2),
                    explanation=explanation,
                    evidence_ids=[],
                    contributing_signals=meta,
                )
            )

    # Persist all newly generated leads to the database
    if new_leads:
        db.add_all(new_leads)
        db.commit()
        for l in new_leads:
            db.refresh(l)

    logger.info("Generated %d investigative leads for case %s", len(new_leads), case_id)
    return new_leads


# ---------------------------------------------------------------------------
# API Routes
# ---------------------------------------------------------------------------
@leads_router.post("/generate", response_model=schemas.LeadGenerateResponse)
def generate_leads_endpoint(
    case_id: str = Query(..., description="Target Case UUID"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("investigator", "supervisor", "admin", "analyst")),
):
    """Generate investigative leads for a case based on existing persisted analytics."""
    c_uuid = _to_uuid(case_id)
    case = db.query(Case).filter(Case.id == c_uuid).first() if c_uuid else None
    assert_case_access(case, current_user)

    leads = generate_leads_for_case(case_id, db)
    return schemas.LeadGenerateResponse(
        case_id=case_id,
        leads_generated=len(leads),
        leads=leads,
    )


@leads_router.get("", response_model=List[schemas.LeadResponse])
def get_case_leads(
    case_id: str = Query(..., description="Target Case UUID"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieve all generated investigative leads for a case with case isolation."""
    c_uuid = _to_uuid(case_id)
    if not c_uuid:
        raise HTTPException(status_code=400, detail="Invalid case_id UUID format")

    case = db.query(Case).filter(Case.id == c_uuid).first()
    assert_case_access(case, current_user)

    return db.query(LeadResult).filter(LeadResult.case_id == c_uuid).order_by(LeadResult.generated_at.desc()).all()


@leads_router.get("/{lead_id}", response_model=schemas.LeadResponse)
def get_lead_by_id(
    lead_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieve details for a single investigative lead."""
    l_uuid = _to_uuid(lead_id)
    if not l_uuid:
        raise HTTPException(status_code=400, detail="Invalid lead_id UUID format")

    lead = db.query(LeadResult).filter(LeadResult.id == l_uuid).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Investigative lead not found")

    case = db.query(Case).filter(Case.id == lead.case_id).first()
    assert_case_access(case, current_user)

    return lead

