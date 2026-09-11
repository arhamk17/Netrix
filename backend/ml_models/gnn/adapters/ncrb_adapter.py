import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

import hashlib
import numpy as np
import torch
from typing import Any, Optional

from src.adapters.base_adapter import BaseModelAdapter
from src.entities.schema import Prediction


class NCRBModelAdapter(BaseModelAdapter):
    """Model adapter for Statutory Legal Calibration and Contextual Threat Scoring using NCRB 2023 data."""

    def __init__(self, model_path: Optional[str] = None):
        super().__init__(model_path)
        self.model_dir = Path(__file__).resolve().parent.parent.parent / "models"
        self.statutory_mapping = {}
        self.city_weights = {}
        self.avg_city_weight = 0.0526
        self._load_model()

    def _load_model(self) -> None:
        model_file = self.model_dir / "ncrb_threat_model.pt"
        if model_file.exists():
            try:
                data = torch.load(model_file, weights_only=False)
                self.statutory_mapping = data.get("statutory_mapping", {})
                self.city_weights = data.get("city_weights", {})
                self.avg_city_weight = float(data.get("avg_city_weight", 0.0526))
            except Exception as e:
                print(f"Error loading NCRB threat model: {e}")

    def enrich_prediction(
        self,
        gnn_prob: float,
        detected_type: str = "ransomware",
        origin_city: Optional[str] = None
    ) -> dict[str, Any]:
        """Calculates contextual threat score and statutory evidence dossier."""
        stat_info = self.statutory_mapping.get(detected_type.lower(), {
            "statutory_act": "Information Technology Act, 2000 & IPC",
            "primary_sections": ["IT Act Sec. 66", "Sec. 420 IPC"],
            "ncrb_category": "Computer Related Offences",
            "severity_weight": 0.70,
            "investigative_guidance": "Examine digital forensics artifacts and server logs."
        })

        severity = float(stat_info.get("severity_weight", 0.70))
        city_factor = self.city_weights.get(origin_city, self.avg_city_weight) if origin_city else self.avg_city_weight

        # Contextual risk formula
        alpha = 0.70
        contextual_risk = (alpha * gnn_prob) + ((1.0 - alpha) * severity * min(1.0, 0.8 + 2.0 * city_factor))
        contextual_risk = float(np.clip(contextual_risk, 0.0, 1.0))

        if contextual_risk >= 0.80:
            tier = "CRITICAL"
        elif contextual_risk >= 0.60:
            tier = "HIGH"
        elif contextual_risk >= 0.40:
            tier = "MEDIUM"
        else:
            tier = "LOW"

        # Evidence SHA-256 integrity hash
        sections_str = ",".join(stat_info.get("primary_sections", []))
        payload = f"{detected_type}:{gnn_prob:.6f}:{sections_str}:{origin_city or 'DEFAULT'}"
        evidence_hash = hashlib.sha256(payload.encode("utf-8")).hexdigest()

        return {
            "gnn_attack_probability": round(gnn_prob, 4),
            "contextual_threat_score": round(contextual_risk, 4),
            "threat_tier": tier,
            "attack_type": detected_type,
            "statutory_act": stat_info.get("statutory_act", ""),
            "applicable_sections": stat_info.get("primary_sections", []),
            "ncrb_classification": stat_info.get("ncrb_category", ""),
            "severity_index": severity,
            "investigative_guidance": stat_info.get("investigative_guidance", ""),
            "evidence_integrity_hash": evidence_hash
        }

    def predict(self, data: list[dict]) -> list[Prediction]:
        predictions = []
        for item in data:
            gnn_prob = float(item.get("gnn_prob", 0.75))
            atk_type = str(item.get("attack_type", "ransomware"))
            city = item.get("city", "Mumbai")

            dossier = self.enrich_prediction(gnn_prob, atk_type, city)
            predictions.append(
                self.format_prediction(
                    model_name="NCRB_Statutory_Threat_Engine",
                    source="NCRB",
                    prediction=dossier["threat_tier"],
                    confidence=gnn_prob,
                    risk_score=dossier["contextual_threat_score"],
                    raw_input=dossier,
                )
            )
        return predictions

    def get_model_info(self) -> dict[str, Any]:
        return {
            "name": "NCRB_Statutory_Threat_Engine",
            "statutory_classes": list(self.statutory_mapping.keys()),
            "monitored_cities": len(self.city_weights),
            "status": "LOADED" if self.statutory_mapping else "NOT_FOUND"
        }


if __name__ == "__main__":
    adapter = NCRBModelAdapter()
    dossier = adapter.enrich_prediction(0.92, "ransomware", "Bengaluru")
    print("Enrichment Dossier:", dossier)
