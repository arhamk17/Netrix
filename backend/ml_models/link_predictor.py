"""
link_predictor.py
Random Forest (default) or XGBoost link-prediction classifier.
Train once, persist to disk, load at inference time.
"""
from __future__ import annotations

import os
from pathlib import Path
from typing import Literal

import joblib
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    roc_auc_score, precision_score, recall_score, f1_score,
    average_precision_score,
)
from sklearn.model_selection import train_test_split

_SAVE_DIR = Path(__file__).parent / "saved"
_SAVE_PATH = _SAVE_DIR / "link_predictor.joblib"

# Feature names (must match feature_engineering.get_candidate_pairs order)
FEATURE_NAMES = [
    "common_neighbors",
    "jaccard",
    "adamic_adar",
    "pref_attachment",
    "resource_allocation",
]


class LinkPredictor:
    """
    Wraps a scikit-learn RandomForest (or XGBoost) classifier for
    binary link-prediction on graph node-pairs.

    Usage
    -----
    predictor = LinkPredictor()
    predictor.train(X_train, y_train)   # returns metrics dict
    scores = predictor.predict_proba(X) # shape (N,), probability of link
    predictor.save()
    predictor.load()
    """

    def __init__(
        self,
        algorithm: Literal["random_forest", "xgboost"] = "random_forest",
        n_estimators: int = 200,
        max_depth: int = 8,
        random_state: int = 42,
        k_precision: int = 10,
    ):
        self.algorithm = algorithm
        self.random_state = random_state
        self.k_precision = k_precision
        self._model = self._build_model(algorithm, n_estimators, max_depth, random_state)
        self.feature_importances_: dict[str, float] = {}
        self.metrics_: dict = {}

    # ------------------------------------------------------------------
    def _build_model(self, algorithm, n_estimators, max_depth, random_state):
        if algorithm == "xgboost":
            try:
                from xgboost import XGBClassifier  # type: ignore
                return XGBClassifier(
                    n_estimators=n_estimators,
                    max_depth=max_depth,
                    use_label_encoder=False,
                    eval_metric="logloss",
                    random_state=random_state,
                    n_jobs=-1,
                )
            except ImportError as e:
                raise ImportError(
                    "xgboost is not installed. Install it with: pip install xgboost"
                ) from e
        else:
            return RandomForestClassifier(
                n_estimators=n_estimators,
                max_depth=max_depth,
                class_weight="balanced",
                random_state=random_state,
                n_jobs=-1,
            )

    # ------------------------------------------------------------------
    def train(
        self,
        X: np.ndarray,
        y: np.ndarray,
        test_size: float = 0.25,
    ) -> dict:
        """
        Train the model and evaluate on a held-out test split.

        Returns a dict with:
            roc_auc, precision, recall, f1, precision_at_k,
            train_samples, test_samples, feature_importances
        """
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=test_size, stratify=y, random_state=self.random_state
        )
        self._model.fit(X_train, y_train)

        y_prob = self._model.predict_proba(X_test)[:, 1]
        y_pred = (y_prob >= 0.5).astype(int)

        # Precision@K
        k = min(self.k_precision, len(y_test))
        top_k_idx = np.argsort(y_prob)[::-1][:k]
        prec_at_k = float(y_test[top_k_idx].mean())

        metrics = {
            "roc_auc":       round(float(roc_auc_score(y_test, y_prob)), 4),
            "precision":     round(float(precision_score(y_test, y_pred, zero_division=0)), 4),
            "recall":        round(float(recall_score(y_test, y_pred, zero_division=0)), 4),
            "f1":            round(float(f1_score(y_test, y_pred, zero_division=0)), 4),
            "avg_precision": round(float(average_precision_score(y_test, y_prob)), 4),
            f"precision_at_{k}": round(prec_at_k, 4),
            "train_samples": int(len(X_train)),
            "test_samples":  int(len(X_test)),
            "algorithm":     self.algorithm,
        }

        # Feature importances
        if hasattr(self._model, "feature_importances_"):
            self.feature_importances_ = {
                name: round(float(imp), 4)
                for name, imp in zip(FEATURE_NAMES, self._model.feature_importances_)
            }
            metrics["feature_importances"] = self.feature_importances_

        self.metrics_ = metrics
        return metrics

    # ------------------------------------------------------------------
    def predict_proba(self, X: np.ndarray) -> np.ndarray:
        """Return probability of a link existing for each row in X. Shape (N,)."""
        if len(X) == 0:
            return np.array([])
        return self._model.predict_proba(X)[:, 1]

    # ------------------------------------------------------------------
    def save(self, path: str | Path | None = None) -> Path:
        p = Path(path) if path else _SAVE_PATH
        p.parent.mkdir(parents=True, exist_ok=True)
        joblib.dump({"model": self._model, "algorithm": self.algorithm,
                     "feature_importances": self.feature_importances_,
                     "metrics": self.metrics_}, p)
        return p

    @classmethod
    def load(cls, path: str | Path | None = None) -> "LinkPredictor":
        p = Path(path) if path else _SAVE_PATH
        if not p.exists():
            raise FileNotFoundError(
                f"No trained LinkPredictor found at {p}. "
                "Run: python ml_models/train.py --synthetic"
            )
        data = joblib.load(p)
        obj = cls.__new__(cls)
        obj._model = data["model"]
        obj.algorithm = data.get("algorithm", "random_forest")
        obj.feature_importances_ = data.get("feature_importances", {})
        obj.metrics_ = data.get("metrics", {})
        obj.k_precision = 10
        obj.random_state = 42
        return obj

    @staticmethod
    def is_trained() -> bool:
        return _SAVE_PATH.exists()
