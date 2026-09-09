"""
train.py — Standalone ML model training script.

Usage
-----
# Train on synthetic data (reproducible, no live DB needed):
    python ml_models/train.py --synthetic

# Train on real data from a specific case in Neo4j:
    python ml_models/train.py --case-id <UUID>

# Train on real data from ALL cases:
    python ml_models/train.py --all-cases

Outputs
-------
- ml_models/saved/link_predictor.joblib
- ml_models/saved/anomaly_detector.joblib
- Metric table printed to stdout
"""
from __future__ import annotations

import argparse
import sys
import os
from pathlib import Path

# Allow running as: python ml_models/train.py from the backend/ directory
sys.path.insert(0, str(Path(__file__).parent.parent))

import numpy as np

from ml_models.link_predictor import LinkPredictor
from ml_models.anomaly_detector import AnomalyDetector
from ml_models.feature_engineering import (
    generate_synthetic_link_features,
    generate_synthetic_node_features,
    get_candidate_pairs,
    get_node_features,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _print_metrics(title: str, metrics: dict) -> None:
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}")
    for k, v in metrics.items():
        if isinstance(v, dict):
            print(f"  {k}:")
            for kk, vv in v.items():
                print(f"      {kk}: {vv}")
        else:
            print(f"  {k:<30} {v}")
    print()


def _get_all_case_ids() -> list[str]:
    """Fetch all case UUIDs from PostgreSQL."""
    from database import SessionLocal
    from models import Case
    db = SessionLocal()
    try:
        return [str(c.id) for c in db.query(Case).all()]
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Training routines
# ---------------------------------------------------------------------------

def train_on_synthetic() -> None:
    print("\n[train.py] Generating synthetic training data ...")

    # ----- Link Predictor -----
    X_link, y_link = generate_synthetic_link_features(
        n_positive=300, n_negative=700, random_state=42
    )
    predictor = LinkPredictor(algorithm="random_forest", n_estimators=200, random_state=42)
    metrics_link = predictor.train(X_link, y_link)
    path = predictor.save()
    _print_metrics("LinkPredictor (Random Forest) - Synthetic Data", metrics_link)
    print(f"  Saved -> {path}")

    # ----- Anomaly Detector -----
    X_node, y_node = generate_synthetic_node_features(
        n_normal=400, n_anomaly=80, random_state=42
    )
    detector = AnomalyDetector(contamination=0.12, n_estimators=200, random_state=42)
    metrics_anom = detector.train(X_node, y_eval=y_node)
    path = detector.save()
    _print_metrics("AnomalyDetector (Isolation Forest) - Synthetic Data", metrics_anom)
    print(f"  Saved -> {path}")


def train_on_case(case_ids: list[str]) -> None:
    print(f"\n[train.py] Pulling graph features for {len(case_ids)} case(s) from Neo4j ...")

    all_link_X, all_link_pairs = [], []
    all_node_X, all_node_names = [], []

    for cid in case_ids:
        print(f"  Case {cid} ...")
        pairs, X_pairs = get_candidate_pairs(cid, max_pairs=200)
        if len(X_pairs) > 0:
            all_link_X.append(X_pairs)
            all_link_pairs.extend(pairs)

        names, X_nodes = get_node_features(cid)
        if len(X_nodes) > 0:
            all_node_X.append(X_nodes)
            all_node_names.extend(names)

    # ----- Link Predictor -----
    if all_link_X:
        X_link = np.vstack(all_link_X)
        # We have no ground-truth labels from the graph for pairs.
        # Use a score-threshold heuristic: pairs with common_neighbors >= 3 -> positive.
        y_link = (X_link[:, 0] >= 3).astype(int)
        if y_link.sum() < 5:
            print("  WARNING: Very few positive link examples found. "
                  "Augmenting with synthetic data.")
            X_syn, y_syn = generate_synthetic_link_features(150, 350, random_state=1)
            X_link = np.vstack([X_link, X_syn])
            y_link = np.hstack([y_link, y_syn])

        predictor = LinkPredictor(algorithm="random_forest", n_estimators=200, random_state=42)
        metrics_link = predictor.train(X_link, y_link)
        path = predictor.save()
        _print_metrics("LinkPredictor (Random Forest) - Real Case Data", metrics_link)
        print(f"  Saved -> {path}")
    else:
        print("  No candidate pairs found in Neo4j. Falling back to synthetic training.")
        train_on_synthetic()
        return

    # ----- Anomaly Detector -----
    if all_node_X:
        X_nodes = np.vstack(all_node_X)
        # For evaluation labels: flag top-10% by degree as synthetic "anomaly"
        degrees = X_nodes[:, 0]
        threshold = np.percentile(degrees, 90)
        y_eval = (degrees >= threshold).astype(int)

        detector = AnomalyDetector(contamination=0.12, n_estimators=200, random_state=42)
        metrics_anom = detector.train(X_nodes, y_eval=y_eval)
        path = detector.save()
        _print_metrics("AnomalyDetector (Isolation Forest) - Real Case Data", metrics_anom)
        print(f"  Saved -> {path}")
    else:
        print("  No nodes found in Neo4j. Anomaly detector trained on synthetic data.")
        X_node, y_node = generate_synthetic_node_features(400, 80, random_state=42)
        detector = AnomalyDetector(contamination=0.12, n_estimators=200, random_state=42)
        metrics_anom = detector.train(X_node, y_eval=y_node)
        path = detector.save()
        _print_metrics("AnomalyDetector (Isolation Forest) - Synthetic Fallback", metrics_anom)
        print(f"  Saved -> {path}")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Train ML models for the Criminal Intelligence System."
    )
    group = parser.add_mutually_exclusive_group()
    group.add_argument(
        "--synthetic", action="store_true",
        help="Train on synthetic demo data (no DB required, default)."
    )
    group.add_argument(
        "--case-id", metavar="UUID",
        help="Train on a specific case from Neo4j."
    )
    group.add_argument(
        "--all-cases", action="store_true",
        help="Train on all cases found in PostgreSQL + Neo4j."
    )

    args = parser.parse_args()

    if args.case_id:
        train_on_case([args.case_id])
    elif args.all_cases:
        case_ids = _get_all_case_ids()
        if not case_ids:
            print("No cases found in DB. Falling back to synthetic training.")
            train_on_synthetic()
        else:
            train_on_case(case_ids)
    else:
        # Default: synthetic
        train_on_synthetic()

    print("\n[OK] Training complete. Models saved to ml_models/saved/")
    print("     Start the server with: uvicorn main:app --reload --port 8000\n")


if __name__ == "__main__":
    main()
