"""
anomaly_detector.py
Isolation Forest anomaly detector with richer 6-feature vectors.
Train once, persist to disk, load at inference time.
"""
from __future__ import annotations

from pathlib import Path

import joblib
import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.metrics import roc_auc_score
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler

_SAVE_DIR = Path(__file__).parent / "saved"
_SAVE_PATH = _SAVE_DIR / "anomaly_detector.joblib"

# Feature names (must match feature_engineering.get_node_features order)
FEATURE_NAMES = [
    "degree",
    "in_degree",
    "out_degree",
    "confidence",
    "neighbor_type_count",
    "triangle_count",
]


class AnomalyDetector:
    """
    Wraps sklearn IsolationForest for node-level anomaly detection.

    Improvements over the original:
    - 6 features instead of 2
    - StandardScaler preprocessing
    - Persisted model so it is not re-fitted on every API request
    - ROC-AUC evaluation on synthetic held-out anomalies at training time

    Usage
    -----
    detector = AnomalyDetector()
    metrics  = detector.train(X)        # X shape (N, 6)
    scores   = detector.predict(X)      # shape (N,), higher = more anomalous [0,1]
    detector.save()
    detector.load()
    """

    def __init__(
        self,
        contamination: float = 0.12,
        n_estimators: int = 200,
        random_state: int = 42,
    ):
        self.contamination = contamination
        self.n_estimators = n_estimators
        self.random_state = random_state
        self._model: IsolationForest | None = None
        self._scaler: StandardScaler = StandardScaler()
        self.metrics_: dict = {}

    # ------------------------------------------------------------------
    def train(self, X: np.ndarray, y_eval: np.ndarray | None = None) -> dict:
        """
        Fit the detector on X (unsupervised).

        If y_eval is provided (0=normal, 1=anomaly labels for evaluation),
        compute ROC-AUC on a held-out split.

        Returns metrics dict.
        """
        X_scaled = self._scaler.fit_transform(X)

        self._model = IsolationForest(
            n_estimators=self.n_estimators,
            contamination=self.contamination,
            random_state=self.random_state,
            n_jobs=-1,
        )
        self._model.fit(X_scaled)

        metrics: dict = {
            "n_samples": int(len(X)),
            "contamination": self.contamination,
            "n_estimators": self.n_estimators,
        }

        # If we have labels, compute ROC-AUC on 25% held-out split
        if y_eval is not None and len(np.unique(y_eval)) > 1:
            _, X_test, _, y_test = train_test_split(
                X_scaled, y_eval,
                test_size=0.25,
                stratify=y_eval,
                random_state=self.random_state,
            )
            # IsolationForest decision_function: lower = more anomalous
            raw = self._model.decision_function(X_test)
            # Flip so higher = more anomalous for ROC-AUC
            scores_test = -raw
            roc_auc = roc_auc_score(y_test, scores_test)
            metrics["roc_auc"] = round(float(roc_auc), 4)

            # Threshold at median to get binary preds
            threshold = float(np.median(scores_test))
            y_pred = (scores_test >= threshold).astype(int)
            from sklearn.metrics import precision_score, recall_score, f1_score
            metrics["precision"] = round(float(precision_score(y_test, y_pred, zero_division=0)), 4)
            metrics["recall"]    = round(float(recall_score(y_test, y_pred, zero_division=0)), 4)
            metrics["f1"]        = round(float(f1_score(y_test, y_pred, zero_division=0)), 4)

        self.metrics_ = metrics
        return metrics

    # ------------------------------------------------------------------
    def predict(self, X: np.ndarray) -> np.ndarray:
        """
        Returns anomaly scores in [0, 1], where 1 = most anomalous.
        Shape (N,).
        """
        if self._model is None:
            raise RuntimeError("AnomalyDetector has not been trained yet.")
        if len(X) == 0:
            return np.array([])

        X_scaled = self._scaler.transform(X)
        raw = self._model.decision_function(X_scaled)  # lower = more anomalous

        # Normalize to [0, 1]: flip sign then min-max scale
        flipped = -raw
        min_s, max_s = flipped.min(), flipped.max()
        span = (max_s - min_s) or 1.0
        return ((flipped - min_s) / span).astype(np.float32)

    # ------------------------------------------------------------------
    def save(self, path: str | Path | None = None) -> Path:
        p = Path(path) if path else _SAVE_PATH
        p.parent.mkdir(parents=True, exist_ok=True)
        joblib.dump({
            "model":         self._model,
            "scaler":        self._scaler,
            "contamination": self.contamination,
            "n_estimators":  self.n_estimators,
            "metrics":       self.metrics_,
        }, p)
        return p

    @classmethod
    def load(cls, path: str | Path | None = None) -> "AnomalyDetector":
        p = Path(path) if path else _SAVE_PATH
        if not p.exists():
            raise FileNotFoundError(
                f"No trained AnomalyDetector found at {p}. "
                "Run: python ml_models/train.py --synthetic"
            )
        data = joblib.load(p)
        obj = cls.__new__(cls)
        obj._model       = data["model"]
        obj._scaler      = data["scaler"]
        obj.contamination = data.get("contamination", 0.12)
        obj.n_estimators  = data.get("n_estimators", 200)
        obj.metrics_      = data.get("metrics", {})
        obj.random_state  = 42
        return obj

    @staticmethod
    def is_trained() -> bool:
        return _SAVE_PATH.exists()
