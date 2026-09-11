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

def get_node_features(case_id: str, db=None) -> tuple[list[str], np.ndarray]:
    """
    Pull per-node feature vectors in milliseconds using in-memory graph representation.

    Features (6):
        0  degree              - total edge count
        1  in_degree           - incoming edges
        2  out_degree          - outgoing edges
        3  confidence          - extraction confidence
        4  neighbor_type_count - number of distinct neighbor node-label types
        5  triangle_count      - number of triangles (common-neighbor pairs)
    """
    from ml_models.gnn.gnn_service import GNNService
    
    try:
        svc = GNNService.get_instance()
        g = svc.extract_case_graph(case_id, db=db)
    except Exception:
        return [], np.empty((0, 6), dtype=np.float32)

    # Flatten nodes
    all_nodes: dict[str, dict] = {}
    for ntype, nlist in g.get("nodes", {}).items():
        for n in nlist:
            name = n.get("name")
            if name:
                all_nodes[name] = {"type": ntype, "confidence": float(n.get("confidence", 0.85))}

    if not all_nodes:
        return [], np.empty((0, 6), dtype=np.float32)

    # Build adjacency
    in_edges: dict[str, list[str]] = {n: [] for n in all_nodes}
    out_edges: dict[str, list[str]] = {n: [] for n in all_nodes}
    undirected_adj: dict[str, set[str]] = {n: set() for n in all_nodes}

    for rel in g.get("relationships", []):
        src, dst = rel.get("src"), rel.get("dst")
        if src in all_nodes and dst in all_nodes:
            out_edges[src].append(dst)
            in_edges[dst].append(src)
            undirected_adj[src].add(dst)
            undirected_adj[dst].add(src)

    names, features = [], []
    for name, ninfo in all_nodes.items():
        nb_set = undirected_adj[name]
        out_d = len(out_edges[name])
        in_d = len(in_edges[name])
        tot_d = out_d + in_d
        conf = ninfo["confidence"]
        
        # distinct neighbor types
        distinct_types = len({all_nodes[nb]["type"] for nb in nb_set if nb in all_nodes})
        
        # triangle count
        tri = 0
        nb_list = list(nb_set)
        for i in range(len(nb_list)):
            for j in range(i + 1, len(nb_list)):
                if nb_list[j] in undirected_adj[nb_list[i]]:
                    tri += 1

        names.append(name)
        features.append([
            float(tot_d),
            float(in_d),
            float(out_d),
            float(conf),
            float(distinct_types),
            float(tri),
        ])

    return names, np.array(features, dtype=np.float32)


def get_candidate_pairs(case_id: str, max_pairs: int = 200, db=None) -> tuple[list[dict], np.ndarray]:
    """
    Build candidate node-pairs that do NOT currently have a direct edge,
    and extract link-prediction features in-memory.
    """
    from ml_models.gnn.gnn_service import GNNService
    
    try:
        svc = GNNService.get_instance()
        g = svc.extract_case_graph(case_id, db=db)
    except Exception:
        return [], np.empty((0, 5), dtype=np.float32)

    all_nodes: dict[str, dict] = {}
    for ntype, nlist in g.get("nodes", {}).items():
        for n in nlist:
            name = n.get("name")
            if name:
                all_nodes[name] = {"type": ntype, "confidence": float(n.get("confidence", 0.85))}

    undirected_adj: dict[str, set[str]] = {n: set() for n in all_nodes}
    direct_edges: set[tuple[str, str]] = set()

    for rel in g.get("relationships", []):
        src, dst = rel.get("src"), rel.get("dst")
        if src in all_nodes and dst in all_nodes:
            undirected_adj[src].add(dst)
            undirected_adj[dst].add(src)
            direct_edges.add((min(src, dst), max(src, dst)))

    degrees = {n: len(adj) for n, adj in undirected_adj.items()}
    node_names = sorted(list(all_nodes.keys()))

    candidate_list = []
    for i in range(len(node_names)):
        u = node_names[i]
        adj_u = undirected_adj[u]
        for j in range(i + 1, len(node_names)):
            v = node_names[j]
            if (u, v) in direct_edges:
                continue
            common = list(adj_u.intersection(undirected_adj[v]))
            if common:
                candidate_list.append((u, v, common))

    candidate_list.sort(key=lambda item: len(item[2]), reverse=True)
    candidate_list = candidate_list[:max_pairs]

    pairs, features = [], []
    for u, v, commons in candidate_list:
        cn = len(commons)
        da = max(degrees.get(u, 1), 1)
        db_ = max(degrees.get(v, 1), 1)
        union = da + db_ - cn
        jaccard = cn / union if union > 0 else 0.0
        aa = sum(1.0 / math.log(max(degrees.get(w, 2), 2) + 1) for w in commons)
        ra = sum(1.0 / max(degrees.get(w, 1), 1) for w in commons)
        pa = da * db_

        features.append([float(cn), jaccard, aa, float(pa), ra])
        pairs.append({
            "name_a": u, "type_a": all_nodes[u]["type"],
            "name_b": v, "type_b": all_nodes[v]["type"],
            "common_names": commons,
        })

    return pairs, np.array(features, dtype=np.float32)


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
