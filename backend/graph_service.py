import re
import time
import uuid
from collections import deque
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session

from database import get_neo4j_session, get_db
from models import Case, Entity, Relationship, Event, IPSResult, AnalyticsResult, User
from auth import get_current_user, assert_case_access
import schemas

graph_router = APIRouter()

LABEL_MAP = {
    "PERSON": "Person",
    "ORG": "Organization",
    "ORGANIZATION": "Organization",
    "GPE": "Location",
    "LOC": "Location",
    "LOCATION": "Location",
    "PHONE": "Phone",
    "VEHICLE": "Vehicle",
    "BANK_ACCOUNT": "BankAccount",
    "ACCOUNT": "BankAccount",
    "MONEY": "Value",
    "TRANSACTION": "Transaction",
    "EMAIL": "Email",
    "CRYPTO_WALLET": "CryptoWallet",
    "SERVER_IP": "ServerIP",
    "IP": "ServerIP",
    "DEVICE": "Device",
    "DOMAIN": "Domain",
}

ALLOWED_REL_TYPES = {
    "CALLS", "COMMUNICATES_WITH", "TRANSFERS_MONEY_TO", "LOCATED_AT",
    "ASSOCIATE_OF", "MEMBER_OF", "OWNS", "USES", "OPERATES",
    "RELATED_TO", "MEETS_WITH", "EMPLOYED_BY", "AFFILIATED_WITH",
    "SUSPECT_IN", "PARTICIPATED_IN", "TRANSACTS_WITH", "CONTACTED",
    "KNOWS", "COLLABORATES_WITH", "CO_OCCURS_WITH", "PREDICTED_LINK",
}

_NEO4J_FAILED_UNTIL = 0.0


def _is_neo4j_available() -> bool:
    if time.time() < _NEO4J_FAILED_UNTIL:
        return False
    try:
        from database import is_neo4j_online
        return is_neo4j_online()
    except Exception:
        return False


def _mark_neo4j_failed(cooldown_seconds: float = 60.0):
    global _NEO4J_FAILED_UNTIL
    _NEO4J_FAILED_UNTIL = time.time() + cooldown_seconds


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
    return LABEL_MAP.get(str(raw_label).strip().upper(), str(raw_label).strip().title() or "Entity")


def _norm_ips(val) -> float:
    if val is None:
        return 0.5
    try:
        s = float(val)
        if s > 1.0:
            return round(min(1.0, max(0.0, s / 100.0)), 4)
        return round(min(1.0, max(0.0, s)), 4)
    except (ValueError, TypeError):
        return 0.5


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
    if not _is_neo4j_available():
        return
    try:
        with get_neo4j_session() as session:
            # 1. Batch insert entities
            if entities:
                ent_rows = [
                    {
                        "name": ent["text"],
                        "label": _label(ent.get("label", "")),
                        "confidence": float(ent.get("confidence", 0.5)),
                        "evidence_id": evidence_id,
                    }
                    for ent in entities if ent.get("text")
                ]
                session.run(
                    """
                    UNWIND $ents AS e
                    MERGE (n {name: e.name, case_id: $case_id})
                    SET n.confidence = e.confidence,
                        n.evidence_id = e.evidence_id,
                        n.entity_type = e.label,
                        n.updated_at = datetime()
                    """,
                    ents=ent_rows,
                    case_id=case_id,
                )

            # 2. Batch insert relations
            if relations:
                rel_rows = [
                    {
                        "subj": rel["subject"],
                        "obj": rel["object"],
                        "rel_type": _sanitize_rel_type(rel.get("predicate", "")),
                        "confidence": float(rel.get("confidence", 0.5)),
                        "evidence_id": rel.get("evidence_id", evidence_id),
                        "timestamp": str(rel.get("timestamp")) if rel.get("timestamp") else None,
                    }
                    for rel in relations if rel.get("subject") and rel.get("object")
                ]
                by_type = {}
                for r in rel_rows:
                    by_type.setdefault(r["rel_type"], []).append(r)

                for rtype, batch in by_type.items():
                    sanitized_type = _sanitize_rel_type(rtype)
                    session.run(
                        f"""
                        UNWIND $batch AS r
                        MERGE (a {{name: r.subj, case_id: $case_id}})
                        MERGE (b {{name: r.obj, case_id: $case_id}})
                        MERGE (a)-[rel:{sanitized_type}]->(b)
                        SET rel.confidence = r.confidence,
                            rel.evidence_id = r.evidence_id,
                            rel.timestamp = r.timestamp,
                            rel.provenance_type = 'OBSERVED'
                        """,
                        batch=batch,
                        case_id=case_id,
                    )
    except Exception as exc:
        _mark_neo4j_failed()
        print(f"[Graph Service] write_to_graph error: {exc}")


def get_graph_for_case(case_id: str, db: Session = None) -> dict:
    nodes_by_id: dict[str, dict] = {}
    edges: list[dict] = []
    c_uuid = _to_uuid(case_id)

    # 1. Fetch IPS scores from PostgreSQL for normalized threat index overlay
    ips_lookup: dict[str, float] = {}
    if db is not None and c_uuid:
        try:
            for row in db.query(IPSResult).filter(IPSResult.case_id == c_uuid).all():
                if row.entity_name:
                    ips_lookup[row.entity_name] = _norm_ips(row.ips_score)
                    ips_lookup[row.entity_name.lower()] = _norm_ips(row.ips_score)
        except Exception as err:
            print(f"[Graph] Error querying IPS results: {err}")

    # 2. Try Neo4j first (if circuit breaker is open)
    if _is_neo4j_available():
        try:
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
                        node_name = str(node.get("name") or node_id)
                        if node_id not in nodes_by_id:
                            conf = node.get("confidence")
                            try:
                                conf_float = float(conf) if conf is not None else 0.85
                            except (ValueError, TypeError):
                                conf_float = 0.85

                            nodes_by_id[node_id] = {
                                "id": node_id,
                                "label": list(node.labels)[0] if node.labels else "Entity",
                                "name": node_name,
                                "confidence": conf_float,
                                "ips_score": ips_lookup.get(node_name, ips_lookup.get(node_name.lower(), 0.5)),
                            }

                    r_conf = r.get("confidence")
                    try:
                        r_conf_float = float(r_conf) if r_conf is not None else 0.85
                    except (ValueError, TypeError):
                        r_conf_float = 0.85

                    r_ts = r.get("timestamp")
                    ts_str = str(r_ts) if r_ts is not None else None

                    edges.append({
                        "source": str(n.element_id),
                        "target": str(m.element_id),
                        "type": str(r.type or "RELATED_TO"),
                        "confidence": r_conf_float,
                        "provenance_type": str(r.get("provenance_type") or "OBSERVED"),
                        "evidence_id": str(r.get("evidence_id")) if r.get("evidence_id") else None,
                        "timestamp": ts_str,
                    })

                # Also fetch any isolated nodes for this case
                iso_result = session.run(
                    """
                    MATCH (n {case_id: $case_id})
                    RETURN n LIMIT 200
                    """,
                    case_id=case_id,
                )
                for rec in iso_result:
                    node = rec["n"]
                    node_id = str(node.element_id)
                    node_name = str(node.get("name") or node_id)
                    if node_id not in nodes_by_id:
                        conf = node.get("confidence")
                        try:
                            conf_float = float(conf) if conf is not None else 0.85
                        except (ValueError, TypeError):
                            conf_float = 0.85

                        nodes_by_id[node_id] = {
                            "id": node_id,
                            "label": list(node.labels)[0] if node.labels else "Entity",
                            "name": node_name,
                            "confidence": conf_float,
                            "ips_score": ips_lookup.get(node_name, ips_lookup.get(node_name.lower(), 0.5)),
                        }
        except Exception as exc:
            _mark_neo4j_failed()
            print(f"[Graph Service] Neo4j query failed, bypassing to PostgreSQL: {exc}")

    # 3. If Neo4j has 0 nodes or failed, build directly from PostgreSQL tables
    if not nodes_by_id and db is not None and c_uuid:
        try:
            name_to_id = {}
            db_entities = db.query(Entity).filter(Entity.case_id == c_uuid).all()
            for ent in db_entities:
                eid = str(ent.id)
                name = ent.canonical_name or eid
                name_to_id[name.lower()] = eid
                nodes_by_id[eid] = {
                    "id": eid,
                    "label": ent.entity_type or "Entity",
                    "name": name,
                    "confidence": float(ent.confidence) if ent.confidence is not None else 0.85,
                    "ips_score": ips_lookup.get(name, ips_lookup.get(name.lower(), 0.5)),
                }

            db_rels = db.query(Relationship).filter(Relationship.case_id == c_uuid).all()
            for rel in db_rels:
                src_id = str(rel.source_entity_id)
                tgt_id = str(rel.target_entity_id)
                edges.append({
                    "source": src_id,
                    "target": tgt_id,
                    "type": str(rel.relationship_type or "RELATED_TO"),
                    "confidence": float(rel.confidence) if rel.confidence is not None else 0.85,
                    "provenance_type": str(rel.provenance_type or "OBSERVED"),
                    "evidence_id": str(rel.evidence_id) if rel.evidence_id else None,
                    "timestamp": str(rel.timestamp) if rel.timestamp else None,
                })

            # Append predicted links from GNN AnalyticsResult
            preds = db.query(AnalyticsResult).filter(
                AnalyticsResult.case_id == c_uuid,
                AnalyticsResult.metric_type == "link_prediction"
            ).all()
            for p in preds:
                meta = p.meta_data or {}
                ea = meta.get("entity_a", {})
                eb = meta.get("entity_b", {})
                name_a = (ea.get("name") or ea.get("canonical_name") or "").strip().lower()
                name_b = (eb.get("name") or eb.get("canonical_name") or "").strip().lower()
                src_id = name_to_id.get(name_a)
                tgt_id = name_to_id.get(name_b)
                if src_id and tgt_id and src_id != tgt_id:
                    edges.append({
                        "source": src_id,
                        "target": tgt_id,
                        "type": "PREDICTED_LINK",
                        "confidence": float(p.metric_value or 0.75),
                        "provenance_type": "PREDICTED",
                        "evidence_id": None,
                        "timestamp": str(p.computed_at) if p.computed_at else None,
                    })
        except Exception as dberr:
            print(f"[Graph Service] PostgreSQL fallback error: {dberr}")

    return {"nodes": list(nodes_by_id.values()), "edges": edges}


def get_entity_neighbors(entity_name: str, case_id: str, db: Session = None) -> list[dict]:
    # 1. Try Neo4j
    if _is_neo4j_available():
        try:
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
                records = result.data()
                if records:
                    return records
        except Exception as exc:
            _mark_neo4j_failed()
            print(f"[Neighbor Service] Neo4j error: {exc}")

    # 2. Fallback to PostgreSQL
    if db is not None:
        try:
            c_uuid = _to_uuid(case_id)
            if c_uuid:
                target_ent = db.query(Entity).filter(
                    Entity.case_id == c_uuid,
                    Entity.canonical_name.ilike(entity_name.strip())
                ).first()
                if target_ent:
                    rels = db.query(Relationship).filter(
                        Relationship.case_id == c_uuid,
                        (Relationship.source_entity_id == target_ent.id) | (Relationship.target_entity_id == target_ent.id)
                    ).all()
                    ent_cache = {e.id: e for e in db.query(Entity).filter(Entity.case_id == c_uuid).all()}
                    neighbors = []
                    for r in rels:
                        other_id = r.target_entity_id if r.source_entity_id == target_ent.id else r.source_entity_id
                        other_ent = ent_cache.get(other_id)
                        if other_ent:
                            neighbors.append({
                                "neighbor": other_ent.canonical_name,
                                "type": other_ent.entity_type or "Entity",
                                "relationship": r.relationship_type or "RELATED_TO",
                                "evidence_id": str(r.evidence_id) if r.evidence_id else None,
                                "timestamp": str(r.timestamp) if r.timestamp else None,
                            })
                    return neighbors
        except Exception as dberr:
            print(f"[Neighbor Service] PostgreSQL fallback error: {dberr}")

    return []


def get_shortest_path(from_name: str, to_name: str, case_id: str, db: Session = None) -> list[dict]:
    # 1. Try Neo4j
    if _is_neo4j_available():
        try:
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
                if record:
                    names, types, rel_types = record["names"], record["types"], record["rel_types"]
                    return [{"name": n, "type": t} for n, t in zip(names, types)] + [{"relationships": rel_types}]
        except Exception as exc:
            _mark_neo4j_failed()
            print(f"[Shortest Path] Neo4j error: {exc}")

    # 2. Fallback to BFS over PostgreSQL graph
    if db is not None:
        try:
            c_uuid = _to_uuid(case_id)
            if c_uuid:
                ents = db.query(Entity).filter(Entity.case_id == c_uuid).all()
                name_map = {e.canonical_name.strip().lower(): e for e in ents}
                id_map = {e.id: e for e in ents}

                src_ent = name_map.get(from_name.strip().lower())
                tgt_ent = name_map.get(to_name.strip().lower())
                if src_ent and tgt_ent:
                    rels = db.query(Relationship).filter(Relationship.case_id == c_uuid).all()
                    adj = {}
                    rel_type_map = {}
                    for r in rels:
                        u, v = r.source_entity_id, r.target_entity_id
                        adj.setdefault(u, []).append(v)
                        adj.setdefault(v, []).append(u)
                        rel_type_map[(u, v)] = r.relationship_type or "RELATED_TO"
                        rel_type_map[(v, u)] = r.relationship_type or "RELATED_TO"

                    queue = deque([[src_ent.id]])
                    visited = {src_ent.id}
                    found_path = None
                    while queue:
                        curr = queue.popleft()
                        last = curr[-1]
                        if last == tgt_ent.id:
                            found_path = curr
                            break
                        for nxt in adj.get(last, []):
                            if nxt not in visited:
                                visited.add(nxt)
                                queue.append(curr + [nxt])

                    if found_path:
                        names = [id_map[nid].canonical_name for nid in found_path]
                        types = [id_map[nid].entity_type or "Entity" for nid in found_path]
                        rel_types = [rel_type_map.get((found_path[i], found_path[i+1]), "RELATED_TO") for i in range(len(found_path)-1)]
                        return [{"name": n, "type": t} for n, t in zip(names, types)] + [{"relationships": rel_types}]
        except Exception as dberr:
            print(f"[Shortest Path] PostgreSQL fallback error: {dberr}")

    return []


def get_timeline_for_case(case_id: str, db: Session = None) -> list[dict]:
    # 1. Try Neo4j
    if _is_neo4j_available():
        try:
            with get_neo4j_session() as session:
                result = session.run(
                    """
                    MATCH (n {case_id: $case_id})-[r]-(m)
                    WHERE r.timestamp IS NOT NULL
                    RETURN n.name AS from_entity, labels(n)[0] AS from_type,
                           type(r) AS event_type, m.name AS to_entity,
                           toString(r.timestamp) AS timestamp, r.evidence_id AS evidence_id,
                           r.confidence AS confidence
                    ORDER BY r.timestamp ASC
                    LIMIT 200
                    """,
                    case_id=case_id,
                )
                records = result.data()
                if records:
                    return records
        except Exception as exc:
            _mark_neo4j_failed()
            print(f"[Timeline Service] Neo4j error: {exc}")

    # 2. Fallback to PostgreSQL Relationships & Events
    if db is not None:
        try:
            c_uuid = _to_uuid(case_id)
            if c_uuid:
                timeline = []
                # Fetch dated relationships
                rels = db.query(Relationship).filter(
                    Relationship.case_id == c_uuid,
                    Relationship.timestamp.isnot(None)
                ).order_by(Relationship.timestamp.asc()).all()

                ent_cache = {e.id: e for e in db.query(Entity).filter(Entity.case_id == c_uuid).all()}
                for r in rels:
                    s_ent = ent_cache.get(r.source_entity_id)
                    t_ent = ent_cache.get(r.target_entity_id)
                    timeline.append({
                        "from_entity": s_ent.canonical_name if s_ent else str(r.source_entity_id),
                        "from_type": s_ent.entity_type if s_ent else "Entity",
                        "event_type": r.relationship_type or "RELATED_TO",
                        "to_entity": t_ent.canonical_name if t_ent else str(r.target_entity_id),
                        "timestamp": str(r.timestamp),
                        "evidence_id": str(r.evidence_id) if r.evidence_id else None,
                        "confidence": float(r.confidence) if r.confidence is not None else 0.85,
                    })

                # Fetch dated Events
                events = db.query(Event).filter(
                    Event.case_id == c_uuid,
                    Event.timestamp.isnot(None)
                ).order_by(Event.timestamp.asc()).all()
                for ev in events:
                    timeline.append({
                        "from_entity": ev.title,
                        "from_type": "EVENT",
                        "event_type": ev.event_type,
                        "to_entity": ev.location or "Location",
                        "timestamp": str(ev.timestamp),
                        "evidence_id": str(ev.evidence_id) if ev.evidence_id else None,
                        "confidence": 0.95,
                    })

                timeline.sort(key=lambda x: str(x.get("timestamp") or ""))
                return timeline
        except Exception as dberr:
            print(f"[Timeline Service] PostgreSQL fallback error: {dberr}")

    return []


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
    return get_shortest_path(from_, to, case_id, db)


@graph_router.get("/graph/entity/{name}")
def route_get_neighbors(name: str, case_id: str = Query(...),
                         db: Session = Depends(get_db),
                         current_user: User = Depends(get_current_user)):
    c_uuid = _to_uuid(case_id)
    case = db.query(Case).filter(Case.id == c_uuid).first() if c_uuid else None
    assert_case_access(case, current_user)
    return get_entity_neighbors(name, case_id, db)


@graph_router.get("/timeline/{case_id}")
def route_get_timeline(case_id: str, db: Session = Depends(get_db),
                       current_user: User = Depends(get_current_user)):
    c_uuid = _to_uuid(case_id)
    case = db.query(Case).filter(Case.id == c_uuid).first() if c_uuid else None
    assert_case_access(case, current_user)
    return get_timeline_for_case(case_id, db)
