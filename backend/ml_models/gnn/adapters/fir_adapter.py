import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

import pandas as pd
from typing import Any, Optional

from src.adapters.base_adapter import BaseModelAdapter
from src.entities.schema import Prediction


class FIRModelAdapter(BaseModelAdapter):
    """Model adapter for structured First Information Report (FIR) statutory severity scoring."""

    def __init__(self, model_path: Optional[str] = None):
        super().__init__(model_path)
        self.severity_weights = {
            "Cyber Crime / Electronic Fraud": 0.90,
            "Financial Fraud / Cheating": 0.85,
            "Organized Gang Robbery / Dacoity": 0.92,
            "Crimes Against Women / Stalking": 0.80,
            "Theft / Property Crime": 0.65,
            "Public Safety / Regulation Violation": 0.50,
            "Traffic / Rash Driving": 0.35,
            "General Penal Offence": 0.60
        }

    def predict(self, data: pd.DataFrame | list[dict]) -> list[Prediction]:
        if isinstance(data, list):
            df = pd.DataFrame(data)
        else:
            df = data.copy()

        predictions = []
        for i, (_, row) in enumerate(df.iterrows()):
            category = str(row.get("inferred_crime_category", "General Penal Offence"))
            statutes = str(row.get("statutes", ""))
            ps = str(row.get("police_station", ""))

            base_severity = self.severity_weights.get(category, 0.60)
            
            # Statute boost
            if "66" in statutes or "IT Act" in statutes:
                base_severity = min(1.0, base_severity + 0.08)
            if "120B" in statutes: # Criminal Conspiracy
                base_severity = min(1.0, base_severity + 0.05)
            if "420" in statutes: # Cheating
                base_severity = min(1.0, base_severity + 0.05)

            if base_severity >= 0.80:
                pred_label = "CRITICAL_LEGAL_SEVERITY"
            elif base_severity >= 0.65:
                pred_label = "HIGH_LEGAL_SEVERITY"
            elif base_severity >= 0.45:
                pred_label = "MODERATE_LEGAL_SEVERITY"
            else:
                pred_label = "LOW_LEGAL_SEVERITY"

            raw_input = {
                "fir_id": str(row.get("fir_id", f"FIR_{i}")),
                "police_station": ps,
                "inferred_crime_category": category,
                "statutes": statutes,
                "legal_severity_score": round(base_severity, 4)
            }

            predictions.append(
                self.format_prediction(
                    model_name="FIR_Legal_Severity_Engine",
                    source="FIR",
                    prediction=pred_label,
                    confidence=0.95,
                    risk_score=base_severity,
                    raw_input=raw_input,
                )
            )
        return predictions

    def get_model_info(self) -> dict[str, Any]:
        return {
            "name": "FIR_Legal_Severity_Engine",
            "statute_categories": list(self.severity_weights.keys()),
            "status": "LOADED"
        }


if __name__ == "__main__":
    adapter = FIRModelAdapter()
    test_data = pd.DataFrame([{
        "fir_id": "FIR_2023_042",
        "police_station": "Cyber Crime Cell Mumbai",
        "inferred_crime_category": "Cyber Crime / Electronic Fraud",
        "statutes": "Sec 66, 66D IT Act r/w 420, 120B IPC"
    }])
    preds = adapter.predict(test_data)
    print("FIR Prediction:", preds[0].to_dict())
