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

from database import get_neo4j_session, get_db
from models import IPSResult, Entity, AnalyticsResult, User, Case
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



def _get_case_node_stats(case_id: str) -> list[dict]:
    """Pull basic per-node stats from Neo4j (kept for IPS + heuristic fallback)."""
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
        return [dict(r) for r in result]


def _write_predicted_links_to_neo4j(case_id: str, predictions: list[dict]) -> None:
    """Write PREDICTED_LINK edges back to Neo4j for graph visualisation."""
    if not predictions:
        return
    with get_neo4j_session() as session:
        for p in predictions:
            session.run(
                """
                MERGE (a {name: $name_a, case_id: $case_id})
                MERGE (b {name: $name_b, case_id: $case_id})
                MERGE (a)-[r:PREDICTED_LINK]->(b)
                SET r.score        = $score,
                    r.algorithm    = $algorithm,
                    r.provenance_type = 'PREDICTED',
                    r.computed_at  = datetime()
                """,
                name_a=p["entity_a"]["name"],
                name_b=p["entity_b"]["name"],
                case_id=case_id,
                score=p["score"],
                algorithm=p["algorithm"],
            )


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
# Link Prediction  (RF model → heuristic fallback)
# ---------------------------------------------------------------------------

def compute_link_predictions(case_id: str | uuid.UUID, db: Session | None = None) -> list[dict]:
    """
    Return scored node-pair link predictions.

    Primary path  → RandomForest trained on graph features (ml_models/).
    Fallback path → common-neighbour heuristic (original logic).
    """
    predictions: list[dict] = []
    # --- Try ML path ---
    try:
        from ml_models.link_predictor import LinkPredictor
        from ml_models.feature_engineering import get_candidate_pairs

        if LinkPredictor.is_trained():
            pairs, X = get_candidate_pairs(str(case_id), max_pairs=200)
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
                predictions.sort(key=lambda p: p["score"], reverse=True)
                predictions = predictions[:15]
                _write_predicted_links_to_neo4j(str(case_id), predictions)
    except Exception as exc:  # noqa: BLE001
        logger.warning("ML link prediction failed, using heuristic fallback: %s", exc)

    if not predictions:
        predictions = _heuristic_link_predictions(str(case_id))

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
    with get_neo4j_session() as session:
        result = session.run(
            """
            MATCH (a {case_id: $case_id})-[]-(common)-[]-(b {case_id: $case_id})
            WHERE id(a) < id(b) AND NOT (a)-[]-(b)
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

    predictions = []
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

    _write_predicted_links_to_neo4j(case_id, predictions)
    return predictions


# ---------------------------------------------------------------------------
# Anomaly Detection  (Isolation Forest model → heuristic fallback)
# ---------------------------------------------------------------------------

def compute_anomaly_scores(case_id: str | uuid.UUID, db: Session | None = None) -> list[dict]:
    """
    Return anomaly-scored nodes.

    Primary path  → persisted Isolation Forest with 6-feature vectors.
    Fallback path → live 2-feature Isolation Forest (original logic).
    """
    results: list[dict] = []
    # --- Try ML path ---
    try:
        from ml_models.anomaly_detector import AnomalyDetector
        from ml_models.feature_engineering import get_node_features

        if AnomalyDetector.is_trained():
            names, X = get_node_features(str(case_id))
            if len(X) >= 5:
                detector = AnomalyDetector.load()
                scores = detector.predict(X)   # shape (N,), [0,1]
                nodes = _get_case_node_stats(str(case_id))
                degree_map = {n["name"]: (n["degree"] or 0) for n in nodes}

                for name, score in zip(names, scores):
                    score_f = float(score)
                    if score_f <= 0.55:
                        continue
                    results.append({
                        "name":         name,
                        "entity_type":  "Entity",
                        "anomaly_score": round(score_f, 3),
                        "degree":       degree_map.get(name, 0),
                        "flag":         "HIGH" if score_f > 0.8 else "MEDIUM",
                        "description":  (
                            f"ML anomaly score {score_f:.2f}. "
                            f"Connected to {degree_map.get(name, 0)} entities."
                        ),
                        "model": "IsolationForest",
                    })
                results.sort(key=lambda r: r["anomaly_score"], reverse=True)
    except Exception as exc:  # noqa: BLE001
        logger.warning("ML anomaly detection failed, using fallback: %s", exc)

    if not results:
        results = _heuristic_anomaly_scores(str(case_id))

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
                    "model": r.get("model", "IsolationForest"),
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
# IPS  (composite scoring with persistence)
# ---------------------------------------------------------------------------

def compute_ips(case_id: str | uuid.UUID, db: Session) -> list[dict]:
    str_case_id = str(case_id)
    case_uuid = _to_uuid(case_id)
    nodes = _get_case_node_stats(str_case_id)
    if not nodes:
        return []

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

        explanation_parts = [
            f"Top contributing factor: {top_factor} ({factors[top_factor]:.1f}/100).",
            f"Connected to {degree} other entities.",
        ]
        if anomaly_score_pct > 60:
            explanation_parts.append("Flagged as a network anomaly.")
        if link_pred_score > 50:
            explanation_parts.append("Involved in a predicted (unconfirmed) link.")
        explanation_parts.append(
            "⚠️ IPS is an investigative priority indicator, not a guilt score."
        )
        explanation = " ".join(explanation_parts)

        results.append({
            "entity_name":          name,
            "entity_type":          node["type"],
            "ips_score":            round(ips, 2),
            "contributing_factors": factors,
            "explanation":          explanation,
        })

    results.sort(key=lambda r: r["ips_score"], reverse=True)
    top = results[:20]

    # Map entity canonical names/aliases to DB entity IDs
    entity_records = db.query(Entity).filter(Entity.case_id == case_uuid).all()
    entity_id_map = {e.canonical_name: e.id for e in entity_records}
    for e in entity_records:
        for alias in (e.aliases or []):
            if alias and alias not in entity_id_map:
                entity_id_map[alias] = e.id

    for r in top:
        ent_id = entity_id_map.get(r["entity_name"])
        existing = (
            db.query(IPSResult)
            .filter(IPSResult.case_id == case_uuid, IPSResult.entity_name == r["entity_name"])
            .first()
        )
        if existing:
            existing.ips_score            = r["ips_score"]
            existing.contributing_factors = r["contributing_factors"]
            existing.explanation          = r["explanation"]
            if ent_id and not existing.entity_id:
                existing.entity_id = ent_id
        else:
            db.add(IPSResult(
                case_id=case_uuid,
                entity_id=ent_id,
                entity_name=r["entity_name"],
                entity_type=r["entity_type"],
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
                "entity_type": r["entity_type"],
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

        if not results_map:
            return []

        gds_success = False
        try:
            try:
                session.run("CALL gds.graph.drop($proj, false)", proj=proj_name)
            except Exception:
                pass

            session.run(
                """
                CALL gds.graph.project.cypher(
                    $proj,
                    'MATCH (n {case_id: $case_id}) RETURN id(n) AS id',
                    'MATCH (n {case_id: $case_id})-[r]-(m {case_id: $case_id}) RETURN id(n) AS source, id(m) AS target',
                    {parameters: {case_id: $case_id}}
                )
                """,
                case_id=str_case_id,
                proj=proj_name,
            )

            # Degree Centrality
            deg_res = session.run(
                """
                CALL gds.degree.stream($proj)
                YIELD nodeId, score
                RETURN gds.util.asNode(nodeId).name AS name, score AS degree
                """,
                proj=proj_name,
            )
            for r in deg_res:
                if r["name"] in results_map:
                    results_map[r["name"]]["degree"] = round(float(r["degree"]), 3)

            # Betweenness Centrality
            bet_res = session.run(
                """
                CALL gds.betweenness.stream($proj)
                YIELD nodeId, score
                RETURN gds.util.asNode(nodeId).name AS name, score AS betweenness
                """,
                proj=proj_name,
            )
            for r in bet_res:
                if r["name"] in results_map:
                    results_map[r["name"]]["betweenness"] = round(float(r["betweenness"]), 4)

            # PageRank
            pr_res = session.run(
                """
                CALL gds.pageRank.stream($proj)
                YIELD nodeId, score
                RETURN gds.util.asNode(nodeId).name AS name, score AS pagerank
                """,
                proj=proj_name,
            )
            for r in pr_res:
                if r["name"] in results_map:
                    results_map[r["name"]]["pagerank"] = round(float(r["pagerank"]), 4)

            gds_success = True

        except Exception as exc:
            logger.warning("GDS Centrality calculation failed or GDS not available, falling back to degree-only: %s", exc)
        finally:
            try:
                session.run("CALL gds.graph.drop($proj, false)", proj=proj_name)
            except Exception:
                pass

        if not gds_success:
            try:
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
                    if name in results_map:
                        results_map[name]["degree"] = float(r["degree"] or 0)
                        results_map[name]["betweenness"] = 0.0
                        results_map[name]["pagerank"] = 0.0
            except Exception as exc:
                logger.exception("Degree-only fallback encountered an error: %s", exc)

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

