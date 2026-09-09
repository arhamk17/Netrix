import re
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session

from database import get_neo4j_session, get_db
from models import Case, IPSResult, User
from auth import get_current_user, assert_case_access
import schemas

graph_router = APIRouter()

LABEL_MAP = {
    "PERSON": "Person",
    "ORG": "Organization",
    "GPE": "Location",
    "LOC": "Location",
    "PHONE": "Phone",
    "VEHICLE": "Vehicle",
    "BANK_ACCOUNT": "BankAccount",
    "MONEY": "Value",
}

ALLOWED_REL_TYPES = {
    "CALLS", "COMMUNICATES_WITH", "TRANSFERS_MONEY_TO", "LOCATED_AT",
    "ASSOCIATE_OF", "MEMBER_OF", "OWNS", "USES", "OPERATES",
    "RELATED_TO", "MEETS_WITH", "EMPLOYED_BY", "AFFILIATED_WITH",
    "SUSPECT_IN", "PARTICIPATED_IN", "TRANSACTS_WITH", "CONTACTED",
    "KNOWS", "COLLABORATES_WITH", "CO_OCCURS_WITH",
}


def _to_uuid(val):
    if isinstance(val, uuid.UUID):
        return val
    try:
        return uuid.UUID(str(val))
    except (ValueError, TypeError):
        return None


def _label(raw_label: str) -> str:
    if not raw_label:
        return "Entity"
    return LABEL_MAP.get(str(raw_label).strip().upper(), "Entity")


def _sanitize_rel_type(raw_type: str) -> str:
    """Strictly sanitize and allowlist relationship type to prevent Cypher injection."""
    if not raw_type:
        return "RELATED_TO"
    normalized = re.sub(r"[^A-Z0-9_]", "_", str(raw_type).strip().upper())
    normalized = re.sub(r"_+", "_", normalized).strip("_")
    if normalized in ALLOWED_REL_TYPES:
        return normalized
    return "RELATED_TO"


def write_to_graph(case_id: str, entities: list[dict], relations: list[dict], evidence_id: str):
    with get_neo4j_session() as session:
        for ent in entities:
            label = _label(ent.get("label", ""))
            session.run(
                f"""
                MERGE (n:{label} {{name: $name, case_id: $case_id}})
                SET n.confidence = $confidence,
                    n.evidence_id = $evidence_id,
                    n.updated_at = datetime()
                """,
                name=ent["text"], case_id=case_id,
                confidence=ent.get("confidence", 0.5), evidence_id=evidence_id,
            )

        for rel in relations:
            subj_label = _label(rel.get("subject_label", ""))
            obj_label = _label(rel.get("object_label", ""))
            rel_type = _sanitize_rel_type(rel.get("predicate", ""))
            session.run(
                f"""
                MERGE (a:{subj_label} {{name: $subj, case_id: $case_id}})
                MERGE (b:{obj_label} {{name: $obj, case_id: $case_id}})
                MERGE (a)-[r:{rel_type}]->(b)
                SET r.confidence = $confidence,
                    r.evidence_id = $evidence_id,
                    r.timestamp = $timestamp,
                    r.provenance_type = 'OBSERVED'
                """,
                subj=rel["subject"], obj=rel["object"], case_id=case_id,
                confidence=rel.get("confidence", 0.5),
                evidence_id=rel.get("evidence_id", evidence_id),
                timestamp=rel.get("timestamp"),
            )


def get_graph_for_case(case_id: str, db: Session = None) -> dict:
    nodes_by_id: dict[str, dict] = {}
    edges: list[dict] = []

    ips_lookup: dict[str, float] = {}
    if db is not None:
        for row in db.query(IPSResult).filter(IPSResult.case_id == case_id).all():
            ips_lookup[row.entity_name] = row.ips_score

    with get_neo4j_session() as session:
        result = session.run(
            """
            MATCH (n {case_id: $case_id})-[r]-(m {case_id: $case_id})
            RETURN n, r, m LIMIT 500
            """,
            case_id=case_id,
        )
        for record in result:
            n, r, m = record["n"], record["r"], record["m"]
            for node in (n, m):
                node_id = str(node.element_id)
                if node_id not in nodes_by_id:
                    nodes_by_id[node_id] = {
                        "id": node_id,
                        "label": list(node.labels)[0] if node.labels else "Entity",
                        "name": node.get("name"),
                        "confidence": node.get("confidence"),
                        "ips_score": ips_lookup.get(node.get("name")),
                    }
            edges.append({
                "source": str(n.element_id),
                "target": str(m.element_id),
                "type": r.type,
                "confidence": r.get("confidence"),
                "provenance_type": r.get("provenance_type"),
                "evidence_id": r.get("evidence_id"),
                "timestamp": r.get("timestamp"),
            })

    return {"nodes": list(nodes_by_id.values()), "edges": edges}


def get_entity_neighbors(entity_name: str, case_id: str) -> list[dict]:
    with get_neo4j_session() as session:
        result = session.run(
            """
            MATCH (n {name: $name, case_id: $case_id})-[r]-(m)
            RETURN m.name AS neighbor, labels(m)[0] AS type,
                   type(r) AS relationship, r.evidence_id AS evidence_id,
                   r.timestamp AS timestamp
            ORDER BY r.timestamp DESC
            """,
            name=entity_name, case_id=case_id,
        )
        return [dict(record) for record in result]


def get_shortest_path(from_name: str, to_name: str, case_id: str) -> list[dict]:
    with get_neo4j_session() as session:
        result = session.run(
            """
            MATCH path = shortestPath(
                (a {name: $from_name, case_id: $case_id})-[*..6]-(b {name: $to_name, case_id: $case_id})
            )
            RETURN [n IN nodes(path) | n.name] AS names,
                   [n IN nodes(path) | labels(n)[0]] AS types,
                   [rel IN relationships(path) | type(rel)] AS rel_types
            """,
            from_name=from_name, to_name=to_name, case_id=case_id,
        )
        record = result.single()
        if not record:
            return []
        names, types, rel_types = record["names"], record["types"], record["rel_types"]
        return [{"name": n, "type": t} for n, t in zip(names, types)] + [{"relationships": rel_types}]


def get_timeline_for_case(case_id: str) -> list[dict]:
    with get_neo4j_session() as session:
        result = session.run(
            """
            MATCH (n {case_id: $case_id})-[r]-(m)
            WHERE r.timestamp IS NOT NULL AND r.timestamp <> ''
            RETURN n.name AS from_entity, labels(n)[0] AS from_type,
                   type(r) AS event_type, m.name AS to_entity,
                   r.timestamp AS timestamp, r.evidence_id AS evidence_id,
                   r.confidence AS confidence
            ORDER BY r.timestamp ASC
            LIMIT 200
            """,
            case_id=case_id,
        )
        return [dict(record) for record in result]


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
@graph_router.get("/graph/case/{case_id}", response_model=schemas.GraphResponse)
def route_get_graph(case_id: str, db: Session = Depends(get_db),
                     current_user: User = Depends(get_current_user)):
    c_uuid = _to_uuid(case_id)
    case = db.query(Case).filter(Case.id == c_uuid).first() if c_uuid else None
    assert_case_access(case, current_user)
    return get_graph_for_case(case_id, db)


@graph_router.get("/graph/path")
def route_get_path(case_id: str = Query(...), from_: str = Query(..., alias="from"),
                    to: str = Query(...), db: Session = Depends(get_db),
                    current_user: User = Depends(get_current_user)):
    c_uuid = _to_uuid(case_id)
    case = db.query(Case).filter(Case.id == c_uuid).first() if c_uuid else None
    assert_case_access(case, current_user)
    return get_shortest_path(from_, to, case_id)


@graph_router.get("/graph/entity/{name}")
def route_get_neighbors(name: str, case_id: str = Query(...),
                         db: Session = Depends(get_db),
                         current_user: User = Depends(get_current_user)):
    c_uuid = _to_uuid(case_id)
    case = db.query(Case).filter(Case.id == c_uuid).first() if c_uuid else None
    assert_case_access(case, current_user)
    return get_entity_neighbors(name, case_id)


@graph_router.get("/timeline/{case_id}")
def route_get_timeline(case_id: str, db: Session = Depends(get_db),
                       current_user: User = Depends(get_current_user)):
    c_uuid = _to_uuid(case_id)
    case = db.query(Case).filter(Case.id == c_uuid).first() if c_uuid else None
    assert_case_access(case, current_user)
    return get_timeline_for_case(case_id)

