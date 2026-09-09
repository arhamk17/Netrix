"""
feature_engineering.py
Extracts graph-based features from Neo4j for ML model training and inference.
All functions return numpy arrays or lists of dicts ready for sklearn.
"""
from __future__ import annotations

import math
from typing import TYPE_CHECKING

import numpy as np

if TYPE_CHECKING:
    pass


# ---------------------------------------------------------------------------
# Node-level features (for Anomaly Detection)
# ---------------------------------------------------------------------------

def get_node_features(case_id: str) -> tuple[list[str], np.ndarray]:
    """
    Pull per-node feature vectors from Neo4j.

    Features (6):
        0  degree              - total edge count
        1  in_degree           - incoming edges
        2  out_degree          - outgoing edges
        3  confidence          - extraction confidence
        4  neighbor_type_count - number of distinct neighbor node-label types
        5  triangle_count      - number of triangles (common-neighbor pairs)

    Returns
    -------
    names : list[str]
        Node canonical names in the same row order as X.
    X : np.ndarray, shape (N, 6)
    """
    from database import get_neo4j_session  # local import to avoid circular

    with get_neo4j_session() as session:
        result = session.run(
            """
            MATCH (n {case_id: $case_id})
            OPTIONAL MATCH (n)-[r_out]->(nb_out {case_id: $case_id})
            OPTIONAL MATCH (nb_in {case_id: $case_id})-[r_in]->(n)
            WITH n,
                 count(DISTINCT r_out) AS out_degree,
                 count(DISTINCT r_in)  AS in_degree,
                 collect(DISTINCT nb_out) + collect(DISTINCT nb_in) AS all_neighbors
            WITH n, out_degree, in_degree, all_neighbors,
                 [nb IN all_neighbors | labels(nb)[0]] AS nb_labels
            RETURN
                n.name          AS name,
                n.confidence    AS confidence,
                out_degree,
                in_degree,
                out_degree + in_degree                          AS degree,
                size(apoc.coll.toSet(nb_labels))               AS neighbor_type_count
            """,
            case_id=case_id,
        )
        rows = [dict(r) for r in result]

    if not rows:
        return [], np.empty((0, 6))

    # Compute triangle count (common neighbors between each node and its neighbors)
    names, features = [], []
    for row in rows:
        tri = _compute_triangle_count(case_id, row["name"])
        features.append([
            float(row["degree"] or 0),
            float(row["in_degree"] or 0),
            float(row["out_degree"] or 0),
            float(row["confidence"] or 0.5),
            float(row["neighbor_type_count"] or 0),
            float(tri),
        ])
        names.append(row["name"])

    return names, np.array(features, dtype=np.float32)


def _compute_triangle_count(case_id: str, node_name: str) -> int:
    """Count triangles involving this node (cheap approximation via common-neighbor pairs)."""
    from database import get_neo4j_session
    with get_neo4j_session() as session:
        result = session.run(
            """
            MATCH (n {name: $name, case_id: $case_id})-[]-(nb1 {case_id: $case_id})
            MATCH (n)-[]-(nb2 {case_id: $case_id})
            WHERE id(nb1) < id(nb2) AND (nb1)-[]-(nb2)
            RETURN count(*) AS triangles
            """,
            name=node_name, case_id=case_id,
        )
        rec = result.single()
        return int(rec["triangles"]) if rec else 0


# ---------------------------------------------------------------------------
# Edge-level features (for Link Prediction)
# ---------------------------------------------------------------------------

def get_candidate_pairs(case_id: str, max_pairs: int = 200) -> tuple[list[dict], np.ndarray]:
    """
    Build candidate node-pairs that do NOT currently have a direct edge,
    and extract link-prediction features for each.

    Features (5):
        0  common_neighbors   - count of shared neighbors
        1  jaccard            - |N(u) ∩ N(v)| / |N(u) ∪ N(v)|
        2  adamic_adar        - sum of 1/log(deg(w)) for common w
        3  pref_attachment    - deg(u) * deg(v)
        4  resource_alloc     - sum of 1/deg(w) for common w

    Returns
    -------
    pairs : list[dict]  {"name_a", "name_b", "type_a", "type_b"}
    X     : np.ndarray  shape (M, 5)
    """
    from database import get_neo4j_session

    with get_neo4j_session() as session:
        result = session.run(
            """
            MATCH (a {case_id: $case_id})-[]-(common)-[]-(b {case_id: $case_id})
            WHERE id(a) < id(b) AND NOT (a)-[]-(b)
            WITH a, b, collect(DISTINCT common) AS commons
            WHERE size(commons) >= 1
            RETURN
                a.name AS name_a, labels(a)[0] AS type_a,
                b.name AS name_b, labels(b)[0] AS type_b,
                [c IN commons | c.name] AS common_names,
                size(commons) AS cn_count
            ORDER BY cn_count DESC
            LIMIT $max_pairs
            """,
            case_id=case_id,
            max_pairs=max_pairs,
        )
        raw_pairs = [dict(r) for r in result]

    if not raw_pairs:
        return [], np.empty((0, 5))

    # Build degree lookup
    degrees = _get_degree_map(case_id)

    pairs, features = [], []
    for row in raw_pairs:
        cn = row["cn_count"]
        commons = row["common_names"]
        da = degrees.get(row["name_a"], 1)
        db_ = degrees.get(row["name_b"], 1)
        union = da + db_ - cn
        jaccard = cn / union if union > 0 else 0.0
        aa = sum(1.0 / math.log(degrees.get(w, 2) + 1) for w in commons)
        ra = sum(1.0 / degrees.get(w, 1) for w in commons)
        pa = da * db_
        features.append([float(cn), jaccard, aa, float(pa), ra])
        pairs.append({
            "name_a": row["name_a"], "type_a": row["type_a"],
            "name_b": row["name_b"], "type_b": row["type_b"],
            "common_names": commons,
        })

    return pairs, np.array(features, dtype=np.float32)


def _get_degree_map(case_id: str) -> dict[str, int]:
    from database import get_neo4j_session
    with get_neo4j_session() as session:
        result = session.run(
            """
            MATCH (n {case_id: $case_id})
            RETURN n.name AS name, size([(n)-[]-() | 1]) AS degree
            """,
            case_id=case_id,
        )
        return {r["name"]: int(r["degree"] or 1) for r in result}


# ---------------------------------------------------------------------------
# Synthetic data generators (used when no real labelled data exists)
# ---------------------------------------------------------------------------

def generate_synthetic_link_features(
    n_positive: int = 300,
    n_negative: int = 700,
    random_state: int = 42,
) -> tuple[np.ndarray, np.ndarray]:
    """
    Generates realistic synthetic link-prediction training data.

    Positives (real links)  → high common_neighbors, high Jaccard
    Negatives (non-links)   → low common_neighbors, low Jaccard
    """
    rng = np.random.RandomState(random_state)

    # Positive class: connected pairs tend to share 2-10 neighbors
    cn_pos  = rng.randint(2, 15, n_positive).astype(float)
    deg_pos = rng.randint(3, 20, n_positive).astype(float)
    jac_pos = cn_pos / (2 * deg_pos - cn_pos + 1e-6)
    jac_pos = np.clip(jac_pos, 0, 1)
    aa_pos  = rng.uniform(0.5, 3.0, n_positive)
    pa_pos  = deg_pos * rng.randint(3, 20, n_positive).astype(float)
    ra_pos  = rng.uniform(0.1, 1.5, n_positive)

    # Negative class: non-connected pairs share 0-1 neighbor
    cn_neg  = rng.choice([0, 1], n_negative, p=[0.7, 0.3]).astype(float)
    deg_neg = rng.randint(1, 8, n_negative).astype(float)
    jac_neg = cn_neg / (2 * deg_neg - cn_neg + 1e-6)
    jac_neg = np.clip(jac_neg, 0, 1)
    aa_neg  = rng.uniform(0.0, 0.5, n_negative)
    pa_neg  = deg_neg * rng.randint(1, 8, n_negative).astype(float)
    ra_neg  = rng.uniform(0.0, 0.2, n_negative)

    X_pos = np.column_stack([cn_pos, jac_pos, aa_pos, pa_pos, ra_pos])
    X_neg = np.column_stack([cn_neg, jac_neg, aa_neg, pa_neg, ra_neg])

    X = np.vstack([X_pos, X_neg]).astype(np.float32)
    y = np.hstack([np.ones(n_positive), np.zeros(n_negative)]).astype(np.int32)

    # Shuffle
    idx = rng.permutation(len(y))
    return X[idx], y[idx]


def generate_synthetic_node_features(
    n_normal: int = 400,
    n_anomaly: int = 80,
    random_state: int = 42,
) -> tuple[np.ndarray, np.ndarray]:
    """
    Generates synthetic node feature vectors for anomaly detection evaluation.
    Labels: 0 = normal, 1 = anomaly (only used for held-out ROC-AUC reporting).
    """
    rng = np.random.RandomState(random_state)

    # Normal nodes: moderate degree, high confidence, few triangle types
    deg_n   = rng.randint(1, 10, n_normal).astype(float)
    in_n    = (deg_n * rng.uniform(0.3, 0.7, n_normal)).astype(float)
    out_n   = deg_n - in_n
    conf_n  = rng.uniform(0.6, 1.0, n_normal)
    ntc_n   = rng.randint(1, 4, n_normal).astype(float)
    tri_n   = rng.randint(0, 5, n_normal).astype(float)

    # Anomaly nodes: very high degree, low confidence, many type connections
    deg_a   = rng.randint(15, 50, n_anomaly).astype(float)
    in_a    = (deg_a * rng.uniform(0.1, 0.9, n_anomaly)).astype(float)
    out_a   = deg_a - in_a
    conf_a  = rng.uniform(0.1, 0.5, n_anomaly)
    ntc_a   = rng.randint(4, 8, n_anomaly).astype(float)
    tri_a   = rng.randint(10, 40, n_anomaly).astype(float)

    X_norm  = np.column_stack([deg_n, in_n, out_n, conf_n, ntc_n, tri_n])
    X_anom  = np.column_stack([deg_a, in_a, out_a, conf_a, ntc_a, tri_a])

    X = np.vstack([X_norm, X_anom]).astype(np.float32)
    y = np.hstack([np.zeros(n_normal), np.ones(n_anomaly)]).astype(np.int32)

    idx = rng.permutation(len(y))
    return X[idx], y[idx]
