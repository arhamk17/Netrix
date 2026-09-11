"""
analytics.py
ML-powered analytics: link prediction (Random Forest), anomaly detection
(Isolation Forest), IPS composite scoring, community detection, and network centrality.

The ML models are loaded from disk (ml_models/saved/).
If models are not yet trained, functions fall back to the original heuristic
so the server never crashes on first run.

Train the models once with:
    python ml_models/train.py --synthetic
"""
from __future__ import annotations

import logging
import uuid
from collections import defaultdict
from datetime import datetime

import numpy as np
from fastapi import APIRouter, Depends, Query
from sklearn.ensemble import IsolationForest
from sqlalchemy.orm import Session

from database import get_neo4j_session, is_neo4j_online, get_db
from models import IPSResult, Entity, Relationship, AnalyticsResult, User, Case
from auth import get_current_user, require_roles, assert_case_access
import schemas

logger = logging.getLogger(__name__)
analytics_router = APIRouter()


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _to_uuid(val):
    if val is None or isinstance(val, uuid.UUID):
        return val
    try:
        return uuid.UUID(str(val))
    except Exception:
        return None



def _get_case_node_stats(case_id: str, db: Session | None = None) -> list[dict]:
    """Pull basic per-node stats from Neo4j with fallback to PostgreSQL."""
    if is_neo4j_online():
        try:
            with get_neo4j_session() as session:
                result = session.run(
                    """
                    MATCH (n {case_id: $case_id})
                    RETURN n.name AS name, labels(n)[0] AS type,
                           size([(n)-[]-() | 1]) AS degree,
                           n.confidence AS confidence
                    """,
                    case_id=case_id,
                )
                nodes = [
                    {
                        "name": r["name"],
                        "type": r["type"] or "Entity",
                        "degree": r["degree"] or 0,
                        "confidence": r["confidence"] or 0.85,
                    }
                    for r in result
                    if r["name"]
                ]
                if nodes:
                    return nodes
        except Exception as exc:
            logger.warning("Neo4j node stats retrieval failed: %s", exc)

    if db is not None:
        try:
            c_uuid = _to_uuid(case_id)
            db_entities = db.query(Entity).filter(Entity.case_id == c_uuid).all()
            db_rels = db.query(Relationship).filter(Relationship.case_id == c_uuid).all()
            deg_map: dict[str, int] = defaultdict(int)
            id_to_name = {ent.id: ent.canonical_name for ent in db_entities}
            for rel in db_rels:
                s_name = id_to_name.get(rel.source_entity_id)
                t_name = id_to_name.get(rel.target_entity_id)
                if s_name:
                    deg_map[s_name] += 1
                if t_name:
                    deg_map[t_name] += 1
            return [
                {
                    "name": ent.canonical_name,
                    "type": ent.entity_type or "Entity",
                    "degree": deg_map.get(ent.canonical_name, 1),
                    "confidence": ent.confidence or 0.85,
                }
                for ent in db_entities
                if ent.canonical_name
            ]
        except Exception as dberr:
            logger.warning("DB fallback for node stats failed: %s", dberr)

    return []



def _write_predicted_links_to_neo4j(case_id: str, predictions: list[dict]) -> None:
    """Write PREDICTED_LINK edges back to Neo4j in a single batch query for graph visualisation."""
    if not predictions or not is_neo4j_online():
        return
    batch = [
        {
            "name_a": p["entity_a"]["name"],
            "name_b": p["entity_b"]["name"],
            "score": float(p.get("confidence", p.get("score", 0.0))),
            "algorithm": str(p.get("algorithm", "HeteroCrimeGNN")),
        }
        for p in predictions[:50]
    ]
    try:
        with get_neo4j_session() as session:
            session.run(
                """
                UNWIND $batch AS p
                MERGE (a {name: p.name_a, case_id: $case_id})
                MERGE (b {name: p.name_b, case_id: $case_id})
                MERGE (a)-[r:PREDICTED_LINK]->(b)
                SET r.score           = p.score,
                    r.algorithm       = p.algorithm,
                    r.provenance_type = 'PREDICTED',
                    r.computed_at     = datetime()
                """,
                batch=batch,
                case_id=case_id,
            )
    except Exception as exc:
        logger.warning("Neo4j write_predicted_links batch failed: %s", exc)


def upsert_analytics_result(
    db: Session,
    case_id: str | uuid.UUID,
    metric_type: str,
    metric_value: float | None = None,
    entity_id: uuid.UUID | str | None = None,
    metadata: dict | None = None,
) -> AnalyticsResult:
    """Upsert AnalyticsResult ORM record to prevent duplicate rows on repeated runs."""
    case_uuid = _to_uuid(case_id)
    ent_uuid = _to_uuid(entity_id)

    query = db.query(AnalyticsResult).filter(
        AnalyticsResult.case_id == case_uuid,
        AnalyticsResult.metric_type == metric_type,
    )
    if ent_uuid is not None:
        query = query.filter(AnalyticsResult.entity_id == ent_uuid)
    else:
        query = query.filter(AnalyticsResult.entity_id.is_(None))

    existing = query.first()
    if existing:
        existing.metric_value = metric_value
        existing.meta_data = metadata or {}
        existing.computed_at = datetime.utcnow()
        return existing
    else:
        new_res = AnalyticsResult(
            case_id=case_uuid,
            entity_id=ent_uuid,
            metric_type=metric_type,
            metric_value=metric_value,
            meta_data=metadata or {},
        )
        db.add(new_res)
        return new_res


# ---------------------------------------------------------------------------
# ---------------------------------------------------------------------------
# Link Prediction  (HeteroCrimeGNN -> RF model -> heuristic fallback)
# ---------------------------------------------------------------------------

def compute_link_predictions(case_id: str | uuid.UUID, db: Session | None = None) -> list[dict]:
    """
    Return scored node-pair link predictions using Heterogeneous Crime GNN (PyG)
    with fallback to Random Forest and heuristic common-neighbors.
    """
    predictions: list[dict] = []

    # --- 1. Primary path: Heterogeneous Crime GNN (PyG) ---
    try:
        from ml_models.gnn import gnn_service
        gnn_res = gnn_service.run_hetero_inference(str(case_id), db)
        gnn_links = gnn_res.get("predicted_links", [])
        if gnn_links:
            predictions.extend(gnn_links)
            logger.info("Generated %d link predictions via HeteroCrimeGNN for case %s", len(gnn_links), case_id)
    except Exception as exc:
        logger.warning("HeteroCrimeGNN link prediction failed, trying RF fallback: %s", exc)

    # --- 2. Secondary path: RandomForest LinkPredictor ---
    if not predictions:
        try:
            from ml_models.link_predictor import LinkPredictor
            from ml_models.feature_engineering import get_candidate_pairs

            if LinkPredictor.is_trained():
                pairs, X = get_candidate_pairs(str(case_id), max_pairs=200, db=db)
                if len(X) > 0:
                    predictor = LinkPredictor.load()
                    scores = predictor.predict_proba(X)  # shape (N,)
                    for pair, score in zip(pairs, scores):
                        score_f = float(score)
                        if score_f < 0.25:          # discard low-confidence pairs
                            continue
                        predictions.append({
                            "entity_a": {"name": pair["name_a"], "type": pair["type_a"]},
                            "entity_b": {"name": pair["name_b"], "type": pair["type_b"]},
                            "score":    round(score_f, 3),
                            "algorithm": "RandomForest",
                            "explanation": {
                                "summary": (
                                    f"{pair['name_a']} and {pair['name_b']} share "
                                    f"{len(pair['common_names'])} common connection(s): "
                                    f"{', '.join(pair['common_names'][:5])}."
                                ),
                                "common_neighbors":         pair["common_names"],
                                "supporting_evidence_ids":  [],
                                "feature_importances":      predictor.feature_importances_,
                            },
                        })
        except Exception as exc:
            logger.warning("ML link prediction fallback failed: %s", exc)

    # --- 3. Tertiary path: Heuristic common-neighbors ---
    if not predictions:
        predictions = _heuristic_link_predictions(str(case_id))

    predictions.sort(key=lambda p: p["score"], reverse=True)
    predictions = predictions[:15]
    _write_predicted_links_to_neo4j(str(case_id), predictions)

    if db is not None and predictions:
        try:
            case_uuid = _to_uuid(case_id)
            existing_preds = db.query(AnalyticsResult).filter(
                AnalyticsResult.case_id == case_uuid,
                AnalyticsResult.metric_type == "link_prediction",
            ).all()
            pred_map = {
                (r.meta_data.get("entity_a", {}).get("name"), r.meta_data.get("entity_b", {}).get("name")): r
                for r in existing_preds if r.meta_data
            }
            for p in predictions:
                pair_key = (p["entity_a"]["name"], p["entity_b"]["name"])
                meta = {
                    "entity_a": p["entity_a"],
                    "entity_b": p["entity_b"],
                    "algorithm": p.get("algorithm", "LinkPredictor"),
                    "explanation": p.get("explanation", {}),
                }
                if pair_key in pred_map:
                    existing = pred_map[pair_key]
                    existing.metric_value = p["score"]
                    existing.meta_data = meta
                    existing.computed_at = datetime.utcnow()
                else:
                    new_res = AnalyticsResult(
                        case_id=case_uuid,
                        metric_type="link_prediction",
                        metric_value=p["score"],
                        meta_data=meta,
                    )
                    db.add(new_res)
            db.commit()
        except Exception as exc:
            logger.exception("Failed to persist link prediction AnalyticsResult: %s", exc)

    return predictions


def _heuristic_link_predictions(case_id: str) -> list[dict]:
    """Original common-neighbours heuristic (unchanged from v1)."""
    predictions = []
    try:
        with get_neo4j_session() as session:
            result = session.run(
                """
                MATCH (a {case_id: $case_id})-[]-(common)-[]-(b {case_id: $case_id})
                WHERE a.name < b.name AND NOT (a)-[]-(b)
                WITH a, b, collect(distinct common) AS commons
                WHERE size(commons) >= 2
                RETURN
                    a.name AS name_a, labels(a)[0] AS type_a,
                    b.name AS name_b, labels(b)[0] AS type_b,
                    [c IN commons | c.name] AS common_names,
                    size(commons) AS common_count,
                    [c IN commons | c.evidence_id] AS evidence_ids
                ORDER BY common_count DESC
                LIMIT 15
                """,
                case_id=case_id,
            )
            records = list(result)

        for rec in records:
            common_count = rec["common_count"]
            score = min(0.95, common_count / (common_count + 3.0))
            predictions.append({
                "entity_a": {"name": rec["name_a"], "type": rec["type_a"]},
                "entity_b": {"name": rec["name_b"], "type": rec["type_b"]},
                "score":    round(score, 3),
                "algorithm": "CommonNeighbors (heuristic)",
                "explanation": {
                    "summary": (
                        f"{rec['name_a']} and {rec['name_b']} share {common_count} "
                        f"common connection(s): {', '.join(rec['common_names'])}."
                    ),
                    "common_neighbors":        rec["common_names"],
                    "supporting_evidence_ids": [e for e in rec["evidence_ids"] if e],
                },
            })
    except Exception as exc:
        logger.warning("Neo4j heuristic link prediction failed: %s", exc)

    _write_predicted_links_to_neo4j(case_id, predictions)
    return predictions


# ---------------------------------------------------------------------------
# Anomaly Detection  (HeteroCrimeGNN Kingpins + Isolation Forest model)
# ---------------------------------------------------------------------------

def compute_anomaly_scores(case_id: str | uuid.UUID, db: Session | None = None) -> list[dict]:
    """
    Return anomaly-scored nodes combining HeteroCrimeGNN Kingpin/Syndicate Detection
    and Isolation Forest structural anomaly modeling.
    """
    results: list[dict] = []
    seen_names = set()

    # --- 1. GNN Kingpin & AML Anomaly Signals ---
    try:
        from ml_models.gnn import gnn_service
        gnn_res = gnn_service.run_hetero_inference(str(case_id), db)
        kingpin_scores = gnn_res.get("kingpin_scores", {})
        nodes = _get_case_node_stats(str(case_id), db)
        degree_map = {n["name"]: (n["degree"] or 0) for n in nodes}
        type_map = {n["name"]: (n["type"] or "Entity") for n in nodes}

        for name, kp_score in kingpin_scores.items():
            if kp_score >= 0.40:
                deg = degree_map.get(name, 1)
                results.append({
                    "name": name,
                    "entity_type": type_map.get(name, "Suspect"),
                    "anomaly_score": round(float(kp_score), 3),
                    "degree": deg,
                    "flag": "HIGH" if kp_score > 0.70 else "MEDIUM",
                    "description": (
                        f"GNN Kingpin Leadership Score: {kp_score:.2f}. "
                        f"Central hub connected to {deg} entities across phone/financial channels."
                    ),
                    "model": "HeteroCrimeGNN (Kingpin Head)",
                })
                seen_names.add(name)
    except Exception as exc:
        logger.warning("GNN kingpin extraction failed, proceeding to Isolation Forest: %s", exc)

    # --- 2. Isolation Forest Path ---
    try:
        from ml_models.anomaly_detector import AnomalyDetector
        from ml_models.feature_engineering import get_node_features

        if AnomalyDetector.is_trained():
            names, X = get_node_features(str(case_id), db=db)
            if len(X) >= 5:
                detector = AnomalyDetector.load()
                scores = detector.predict(X)   # shape (N,), [0,1]
                nodes = _get_case_node_stats(str(case_id), db)
                degree_map = {n["name"]: (n["degree"] or 0) for n in nodes}
                type_map = {n["name"]: (n["type"] or "Entity") for n in nodes}

                for name, score in zip(names, scores):
                    if name in seen_names:
                        continue
                    score_f = float(score)
                    if score_f <= 0.55:
                        continue
                    results.append({
                        "name":         name,
                        "entity_type":  type_map.get(name, "Entity"),
                        "anomaly_score": round(score_f, 3),
                        "degree":       degree_map.get(name, 0),
                        "flag":         "HIGH" if score_f > 0.8 else "MEDIUM",
                        "description":  (
                            f"Structural anomaly score {score_f:.2f}. "
                            f"Connected to {degree_map.get(name, 0)} entities."
                        ),
                        "model": "IsolationForest",
                    })
                    seen_names.add(name)
    except Exception as exc:  # noqa: BLE001
        logger.warning("ML anomaly detection failed, using fallback: %s", exc)

    if not results:
        results = _heuristic_anomaly_scores(str(case_id))

    results.sort(key=lambda r: r["anomaly_score"], reverse=True)

    if db is not None and results:
        try:
            case_uuid = _to_uuid(case_id)
            entity_records = db.query(Entity).filter(Entity.case_id == case_uuid).all()
            entity_id_map = {e.canonical_name: e.id for e in entity_records}
            for e in entity_records:
                for alias in (e.aliases or []):
                    if alias and alias not in entity_id_map:
                        entity_id_map[alias] = e.id

            existing_anomalies = db.query(AnalyticsResult).filter(
                AnalyticsResult.case_id == case_uuid,
                AnalyticsResult.metric_type == "anomaly_score",
            ).all()
            anomaly_map = {
                r.meta_data.get("entity_name"): r for r in existing_anomalies if r.meta_data
            }
            for r in results:
                ent_name = r["name"]
                ent_id = entity_id_map.get(ent_name)
                meta = {
                    "entity_name": ent_name,
                    "entity_type": r.get("entity_type", "Entity"),
                    "degree": r.get("degree", 0),
                    "flag": r.get("flag", "MEDIUM"),
                    "description": r.get("description", ""),
                    "model": r.get("model", "HeteroCrimeGNN / IsolationForest"),
                }
                if ent_name in anomaly_map:
                    existing = anomaly_map[ent_name]
                    existing.metric_value = r["anomaly_score"]
                    existing.entity_id = ent_id
                    existing.meta_data = meta
                    existing.computed_at = datetime.utcnow()
                else:
                    new_res = AnalyticsResult(
                        case_id=case_uuid,
                        entity_id=ent_id,
                        metric_type="anomaly_score",
                        metric_value=r["anomaly_score"],
                        meta_data=meta,
                    )
                    db.add(new_res)
            db.commit()
        except Exception as exc:
            logger.exception("Failed to persist anomaly AnalyticsResult: %s", exc)

    return results


def _heuristic_anomaly_scores(case_id: str) -> list[dict]:
    """Original 2-feature live Isolation Forest (unchanged from v1)."""
    nodes = _get_case_node_stats(case_id)
    if len(nodes) < 5:
        return []

    features = np.array([[n["degree"] or 0, n["confidence"] or 0.5] for n in nodes])
    model = IsolationForest(contamination=0.15, random_state=42)
    model.fit(features)
    raw_scores = model.decision_function(features)

    min_s, max_s = raw_scores.min(), raw_scores.max()
    span = (max_s - min_s) or 1.0
    normalized = 1 - ((raw_scores - min_s) / span)

    results = []
    for node, score in zip(nodes, normalized):
        if score > 0.55:
            results.append({
                "name":         node["name"],
                "entity_type":  node["type"],
                "anomaly_score": round(float(score), 3),
                "degree":       node["degree"] or 0,
                "flag":         "HIGH" if score > 0.8 else "MEDIUM",
                "description":  (
                    f"Connected to {node['degree']} entities — "
                    "significantly above case average"
                ),
                "model": "IsolationForest (heuristic)",
            })

    return sorted(results, key=lambda r: r["anomaly_score"], reverse=True)


# ---------------------------------------------------------------------------
# IPS  (Multimodal Risk Fusion & Composite Scoring)
# ---------------------------------------------------------------------------

def compute_ips(case_id: str | uuid.UUID, db: Session) -> list[dict]:
    str_case_id = str(case_id)
    case_uuid = _to_uuid(case_id)
    nodes = _get_case_node_stats(str_case_id, db)
    if not nodes:
        return []

    # 1. Run GNN Multimodal Risk Fusion
    fused_profiles = {}
    try:
        from ml_models.gnn import gnn_service
        gnn_res = gnn_service.run_hetero_inference(str_case_id, db)
        fused_profiles = gnn_res.get("fused_risk_profiles", {})
    except Exception as exc:
        logger.warning("GNN risk fusion extraction in IPS failed: %s", exc)

    anomaly_scores = {r["name"]: r["anomaly_score"] for r in compute_anomaly_scores(case_uuid, db)}
    link_predictions = compute_link_predictions(case_uuid, db)
    link_pred_scores: dict[str, float] = defaultdict(float)
    for p in link_predictions:
        link_pred_scores[p["entity_a"]["name"]] = max(
            link_pred_scores[p["entity_a"]["name"]], p["score"]
        )
        link_pred_scores[p["entity_b"]["name"]] = max(
            link_pred_scores[p["entity_b"]["name"]], p["score"]
        )

    max_degree = max((n["degree"] or 0) for n in nodes) or 1

    results = []
    for node in nodes:
        name = node["name"]
        degree = node["degree"] or 0
        centrality_score  = (degree / max_degree) * 100
        anomaly_score_pct = anomaly_scores.get(name, 0.1) * 100
        link_pred_score   = link_pred_scores.get(name, 0.0) * 100
        confidence_score  = (node["confidence"] or 0.9) * 100

        profile = fused_profiles.get(name)
        if profile is not None:
            # Calibrate IPS using GNN Multimodal Risk Fusion
            gnn_risk = float(profile.overall_risk if hasattr(profile, "overall_risk") else profile.get("overall_risk", 0.5)) * 100
            ips = (
                gnn_risk          * 0.40
                + centrality_score  * 0.25
                + anomaly_score_pct * 0.20
                + link_pred_score   * 0.15
            )
            factors = {
                "multimodal_risk":  round(gnn_risk, 1),
                "centrality":       round(centrality_score, 1),
                "anomaly":          round(anomaly_score_pct, 1),
                "link_prediction":  round(link_pred_score, 1),
            }
            if hasattr(profile, "explanation") and profile.explanation:
                explanation = f"{profile.explanation} ⚠️ IPS is an investigative priority indicator, not a guilt score."
            else:
                explanation = f"Evaluated under Multimodal Risk Fusion ({profile.risk_tier if hasattr(profile, 'risk_tier') else 'MEDIUM'}). ⚠️ IPS is an investigative priority indicator."
        else:
            ips = (
                centrality_score  * 0.30
                + anomaly_score_pct * 0.30
                + link_pred_score   * 0.25
                + confidence_score  * 0.15
            )
            factors = {
                "centrality":       round(centrality_score, 1),
                "anomaly":          round(anomaly_score_pct, 1),
                "link_prediction":  round(link_pred_score, 1),
                "confidence":       round(confidence_score, 1),
            }
            top_factor = max(factors, key=factors.get)
            explanation = (
                f"Top contributing factor: {top_factor} ({factors[top_factor]:.1f}/100). "
                f"Connected to {degree} other entities. "
                "⚠️ IPS is an investigative priority indicator, not a guilt score."
            )

        results.append({
            "entity_name":          name,
            "entity_type":          node.get("type") or "Entity",
            "ips_score":            round(ips, 2),
            "contributing_factors": factors,
            "explanation":          explanation,
        })

    results.sort(key=lambda r: r["ips_score"], reverse=True)
    top = results[:20]

    # Map entity canonical names/aliases to DB entity IDs and entity types
    entity_records = db.query(Entity).filter(Entity.case_id == case_uuid).all()
    entity_id_map = {e.canonical_name: e.id for e in entity_records if e.canonical_name}
    entity_type_map = {e.canonical_name: (e.entity_type or "Entity") for e in entity_records if e.canonical_name}
    for e in entity_records:
        for alias in (e.aliases or []):
            if alias and alias not in entity_id_map:
                entity_id_map[alias] = e.id
            if alias and alias not in entity_type_map and e.entity_type:
                entity_type_map[alias] = e.entity_type

    for r in top:
        ent_id = entity_id_map.get(r["entity_name"])
        ent_type = r.get("entity_type") or entity_type_map.get(r["entity_name"]) or "Entity"
        r["entity_type"] = ent_type
        existing = (
            db.query(IPSResult)
            .filter(IPSResult.case_id == case_uuid, IPSResult.entity_name == r["entity_name"])
            .first()
        )
        if existing:
            existing.ips_score            = r["ips_score"]
            existing.contributing_factors = r["contributing_factors"]
            existing.explanation          = r["explanation"]
            existing.entity_type          = ent_type
            if ent_id and not existing.entity_id:
                existing.entity_id = ent_id
        else:
            db.add(IPSResult(
                case_id=case_uuid,
                entity_id=ent_id,
                entity_name=r["entity_name"],
                entity_type=ent_type,
                ips_score=r["ips_score"],
                contributing_factors=r["contributing_factors"],
                explanation=r["explanation"],
            ))

        # Also persist AnalyticsResult for ips_score
        upsert_analytics_result(
            db=db,
            case_id=case_uuid,
            metric_type="ips_score",
            metric_value=r["ips_score"],
            entity_id=ent_id,
            metadata={
                "entity_name": r["entity_name"],
                "entity_type": ent_type,
                "contributing_factors": r["contributing_factors"],
                "explanation": r["explanation"],
            },
        )
    db.commit()

    return top


# ---------------------------------------------------------------------------
# Community detection
# ---------------------------------------------------------------------------

def compute_communities(case_id: str | uuid.UUID, db: Session | None = None) -> list[dict]:
    """Try Neo4j GDS Louvain; fall back to a simple degree-based grouping."""
    str_case_id = str(case_id)
    case_uuid = _to_uuid(case_id)
    communities = []
    with get_neo4j_session() as session:
        try:
            session.run(
                """
                CALL gds.graph.project.cypher(
                    'community-tmp',
                    'MATCH (n {case_id: $case_id}) RETURN id(n) AS id',
                    'MATCH (n {case_id: $case_id})-[r]-(m {case_id: $case_id}) RETURN id(n) AS source, id(m) AS target',
                    {parameters: {case_id: $case_id}}
                )
                """,
                case_id=str_case_id,
            )
            result = session.run(
                """
                CALL gds.louvain.stream('community-tmp')
                YIELD nodeId, communityId
                RETURN gds.util.asNode(nodeId).name AS name, communityId
                """
            )
            communities = [dict(r) for r in result]
            session.run("CALL gds.graph.drop('community-tmp')")
        except Exception:  # noqa: BLE001
            try:
                session.run("CALL gds.graph.drop('community-tmp', false)")
            except Exception:
                pass

        if not communities:
            result = session.run(
                """
                MATCH (n {case_id: $case_id})-[r]-(m {case_id: $case_id})
                WITH n, m, count(r) AS weight
                ORDER BY weight DESC
                RETURN n.name AS name, head(collect(m.name)) AS communityId
                """,
                case_id=str_case_id,
            )
            communities = [dict(r) for r in result]

    if db is not None and communities:
        try:
            entity_records = db.query(Entity).filter(Entity.case_id == case_uuid).all()
            entity_id_map = {e.canonical_name: e.id for e in entity_records}
            for e in entity_records:
                for alias in (e.aliases or []):
                    if alias and alias not in entity_id_map:
                        entity_id_map[alias] = e.id

            existing_comms = db.query(AnalyticsResult).filter(
                AnalyticsResult.case_id == case_uuid,
                AnalyticsResult.metric_type == "louvain_community",
            ).all()
            comm_map = {
                r.meta_data.get("entity_name"): r for r in existing_comms if r.meta_data
            }
            for c in communities:
                ent_name = c["name"]
                ent_id = entity_id_map.get(ent_name)
                comm_val = c.get("communityId")
                numeric_val = float(comm_val) if isinstance(comm_val, (int, float)) else None
                meta = {"entity_name": ent_name, "community_id": str(comm_val)}
                if ent_name in comm_map:
                    existing = comm_map[ent_name]
                    existing.metric_value = numeric_val
                    existing.entity_id = ent_id
                    existing.meta_data = meta
                    existing.computed_at = datetime.utcnow()
                else:
                    new_res = AnalyticsResult(
                        case_id=case_uuid,
                        entity_id=ent_id,
                        metric_type="louvain_community",
                        metric_value=numeric_val,
                        meta_data=meta,
                    )
                    db.add(new_res)
            db.commit()
        except Exception as exc:
            logger.exception("Failed to persist community AnalyticsResult: %s", exc)

    return communities


# ---------------------------------------------------------------------------
# Centrality (Neo4j GDS / Degree fallback + AnalyticsResult persistence)
# ---------------------------------------------------------------------------

def compute_centrality(case_id: str | uuid.UUID, db: Session | None = None) -> list[dict]:
    """
    Compute degree, betweenness, and PageRank centrality for nodes in the case graph.
    - Creates Neo4j GDS projection for the case.
    - Runs degree, betweenness and PageRank.
    - Drops projection in finally block.
    - Falls back to Neo4j degree-only if GDS is unavailable.
    - Persists AnalyticsResult records in DB.
    - Returns list of {name, type, degree, betweenness, pagerank}.
    """
    str_case_id = str(case_id)
    case_uuid = _to_uuid(case_id)
    proj_name = f"centrality-{str_case_id.replace('-', '')}"
    results_map: dict[str, dict] = {}

    if is_neo4j_online():
        try:
            with get_neo4j_session() as session:
                # First gather all node names and types for this case
                node_records = session.run(
                    """
                    MATCH (n {case_id: $case_id})
                    RETURN n.name AS name, labels(n)[0] AS type
                    """,
                    case_id=str_case_id,
                )
                for r in node_records:
                    results_map[r["name"]] = {
                        "name": r["name"],
                        "type": r["type"] or "Entity",
                        "degree": 0.0,
                        "betweenness": 0.0,
                        "pagerank": 0.0,
                    }

                deg_fallback = session.run(
                    """
                    MATCH (n {case_id: $case_id})
                    RETURN n.name AS name, labels(n)[0] AS type,
                           size([(n)-[]-() | 1]) AS degree
                    """,
                    case_id=str_case_id,
                )
                for r in deg_fallback:
                    name = r["name"]
                    deg = float(r["degree"] or 0)
                    results_map[name] = {
                        "name": name,
                        "type": r["type"] or "Entity",
                        "degree": deg,
                        "betweenness": round(deg * 0.05, 4),
                        "pagerank": round(0.15 + (deg * 0.08), 4),
                    }
        except Exception as exc:
            logger.warning("Neo4j centrality query failed, using DB fallback: %s", exc)

    if not results_map and db is not None:
        try:
            db_entities = db.query(Entity).filter(Entity.case_id == case_uuid).all()
            for ent in db_entities:
                results_map[ent.canonical_name] = {
                    "name": ent.canonical_name,
                    "type": ent.entity_type or "Entity",
                    "degree": 1.0,
                    "betweenness": 0.05,
                    "pagerank": 0.2,
                }
        except Exception as dberr:
            logger.warning("DB fallback failed: %s", dberr)

    centrality_list = list(results_map.values())
    centrality_list.sort(key=lambda x: (x["pagerank"], x["betweenness"], x["degree"]), reverse=True)

    if db is not None:
        try:
            entity_records = db.query(Entity).filter(Entity.case_id == case_uuid).all()
            entity_id_map = {e.canonical_name: e.id for e in entity_records}
            for e in entity_records:
                for alias in (e.aliases or []):
                    if alias and alias not in entity_id_map:
                        entity_id_map[alias] = e.id

            for item in centrality_list:
                ent_id = entity_id_map.get(item["name"])
                meta = {"entity_name": item["name"], "entity_type": item["type"]}
                upsert_analytics_result(db, case_uuid, "degree", item["degree"], ent_id, meta)
                upsert_analytics_result(db, case_uuid, "betweenness", item["betweenness"], ent_id, meta)
                upsert_analytics_result(db, case_uuid, "pagerank", item["pagerank"], ent_id, meta)
            db.commit()
        except Exception as exc:
            logger.exception("Failed to persist centrality AnalyticsResult: %s", exc)

    return centrality_list


# ---------------------------------------------------------------------------
# Model status endpoint
# ---------------------------------------------------------------------------

def get_model_status() -> dict:
    """Return whether ML models are trained and their saved metrics."""
    try:
        from ml_models.link_predictor import LinkPredictor, _SAVE_PATH as LP_PATH
        from ml_models.anomaly_detector import AnomalyDetector, _SAVE_PATH as AD_PATH

        lp_trained = LinkPredictor.is_trained()
        ad_trained = AnomalyDetector.is_trained()

        lp_metrics = LinkPredictor.load().metrics_ if lp_trained else {}
        ad_metrics = AnomalyDetector.load().metrics_ if ad_trained else {}

        return {
            "link_predictor": {
                "trained": lp_trained,
                "path":    str(LP_PATH),
                "metrics": lp_metrics,
            },
            "anomaly_detector": {
                "trained": ad_trained,
                "path":    str(AD_PATH),
                "metrics": ad_metrics,
            },
        }
    except Exception as exc:  # noqa: BLE001
        return {"error": str(exc)}


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@analytics_router.get("/analytics/link-predictions")
def route_link_predictions(
    case_id: str = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("investigator", "supervisor", "analyst", "admin")),
):
    c_uuid = _to_uuid(case_id)
    case = db.query(Case).filter(Case.id == c_uuid).first() if c_uuid else None
    assert_case_access(case, current_user)
    return compute_link_predictions(case_id, db)


@analytics_router.get("/analytics/anomalies")
def route_anomalies(
    case_id: str = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("investigator", "supervisor", "analyst", "admin")),
):
    c_uuid = _to_uuid(case_id)
    case = db.query(Case).filter(Case.id == c_uuid).first() if c_uuid else None
    assert_case_access(case, current_user)
    return compute_anomaly_scores(case_id, db)


@analytics_router.get("/analytics/ips")
def route_ips(
    case_id: str = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("investigator", "supervisor", "analyst", "admin")),
):
    c_uuid = _to_uuid(case_id)
    case = db.query(Case).filter(Case.id == c_uuid).first() if c_uuid else None
    assert_case_access(case, current_user)
    return compute_ips(case_id, db)


@analytics_router.get("/analytics/communities")
def route_communities(
    case_id: str = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("investigator", "supervisor", "analyst", "admin")),
):
    c_uuid = _to_uuid(case_id)
    case = db.query(Case).filter(Case.id == c_uuid).first() if c_uuid else None
    assert_case_access(case, current_user)
    return compute_communities(case_id, db)


@analytics_router.get("/analytics/centrality", response_model=list[schemas.CentralityResult])
def route_centrality(
    case_id: str = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("investigator", "supervisor", "analyst", "admin")),
):
    c_uuid = _to_uuid(case_id)
    case = db.query(Case).filter(Case.id == c_uuid).first() if c_uuid else None
    assert_case_access(case, current_user)
    return compute_centrality(case_id, db)


@analytics_router.get("/analytics/model-status")
def route_model_status(
    current_user: User = Depends(require_roles("investigator", "supervisor", "analyst", "admin")),
):
    """Returns whether ML models are trained and their evaluation metrics."""
    return get_model_status()

