import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from abc import ABC, abstractmethod
from typing import Any, Optional
from datetime import datetime

from src.entities.schema import Prediction


class BaseModelAdapter(ABC):
    """Abstract base class for all model adapters."""

    def __init__(self, model_path: Optional[str] = None):
        self.model_path = model_path

    @abstractmethod
    def predict(self, data: Any) -> list[Prediction]:
        """Run model inference on input data and return a list of Prediction objects."""
        pass

    @abstractmethod
    def get_model_info(self) -> dict[str, Any]:
        """Return metadata about the underlying model."""
        pass

    def format_prediction(
        self,
        model_name: str,
        source: str,
        prediction: str,
        confidence: float,
        risk_score: float,
        raw_input: Optional[dict[str, Any]] = None,
        timestamp: Optional[str] = None,
    ) -> Prediction:
        if timestamp is None:
            timestamp = datetime.utcnow().isoformat() + "Z"
        return Prediction(
            model_name=model_name,
            source=source,
            prediction=prediction,
            confidence=float(confidence),
            risk_score=float(risk_score),
            raw_input=raw_input,
            timestamp=timestamp,
        )


if __name__ == "__main__":
    print("BaseModelAdapter initialized successfully.")
