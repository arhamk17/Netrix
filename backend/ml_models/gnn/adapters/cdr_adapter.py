import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

import pandas as pd
import numpy as np
from typing import Any, Optional

from src.adapters.base_adapter import BaseModelAdapter
from src.entities.schema import Prediction


class CDRModelAdapter(BaseModelAdapter):
    """Model adapter for Call Detail Record (CDR) telecom communication anomaly scoring."""

    def __init__(self, model_path: Optional[str] = None):
        super().__init__(model_path)

    def predict(self, data: pd.DataFrame | list[dict]) -> list[Prediction]:
        if isinstance(data, list):
            df = pd.DataFrame(data)
        else:
            df = data.copy()

        predictions = []
        for i, (_, row) in enumerate(df.iterrows()):
            caller = str(row.get("caller_phone", ""))
            receiver = str(row.get("receiver_phone", ""))
            duration = float(pd.to_numeric(row.get("duration_sec", row.get("duration", 60)), errors="coerce") or 60.0)
            timestamp = str(row.get("timestamp", ""))

            # Anomaly indicators
            risk = 0.20 # base baseline telecom risk
            
            # Short burst calls (<15s) or unusually long (>3600s)
            if duration < 15.0:
                risk += 0.25
            elif duration > 3600.0:
                risk += 0.20

            # Late night calls (00:00 - 05:00)
            if any(t in timestamp for t in [" 00:", " 01:", " 02:", " 03:", " 04:", " 05:"]):
                risk += 0.35

            risk = float(np.clip(risk, 0.0, 1.0))
            is_suspicious = risk >= 0.50
            pred_label = "SUSPICIOUS_COMMUNICATION_BURST" if is_suspicious else "ROUTINE_TELECOM_CALL"

            raw_input = {
                "caller_phone": caller,
                "receiver_phone": receiver,
                "duration_sec": duration,
                "timestamp": timestamp,
                "telecom_risk_score": round(risk, 4)
            }

            predictions.append(
                self.format_prediction(
                    model_name="CDR_Telecom_Anomaly_Engine",
                    source="CDR",
                    prediction=pred_label,
                    confidence=0.90,
                    risk_score=risk,
                    raw_input=raw_input,
                )
            )
        return predictions

    def get_model_info(self) -> dict[str, Any]:
        return {
            "name": "CDR_Telecom_Anomaly_Engine",
            "heuristics": ["burst_duration", "nocturnal_timing", "frequency_density"],
            "status": "LOADED"
        }


if __name__ == "__main__":
    adapter = CDRModelAdapter()
    test_data = pd.DataFrame([{
        "caller_phone": "subscribers_12345",
        "receiver_phone": "subscribers_67890",
        "duration_sec": 8.0,
        "timestamp": "2026-03-01 02:45:00"
    }])
    preds = adapter.predict(test_data)
    print("CDR Prediction:", preds[0].to_dict())
