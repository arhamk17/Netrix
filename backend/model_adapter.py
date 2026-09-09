import json
import logging
import re
from typing import Any, Callable, Dict, List, Optional, Union

import httpx
import pandas as pd

from config import settings
import nlp_pipeline
from preprocessing import ModelInput, preprocess

logger = logging.getLogger(__name__)

# Global registry for teammate's local in-memory Python model
_LOCAL_PYTHON_MODEL: Optional[Callable[[ModelInput], Dict[str, Any]]] = None


def register_local_python_model(model_fn: Callable[[ModelInput], Dict[str, Any]]) -> None:
    """
    Register teammate's local Python model callable.
    Must accept a ModelInput object and return a dict with entities/relationships/events.
    """
    global _LOCAL_PYTHON_MODEL
    _LOCAL_PYTHON_MODEL = model_fn
    logger.info("Successfully registered local Python inference model.")


def get_registered_python_model() -> Optional[Callable[[ModelInput], Dict[str, Any]]]:
    return _LOCAL_PYTHON_MODEL


# Common crime / intelligence event keywords for rule-based event extraction fallback
INCIDENT_KEYWORDS = {
    "ROBBERY": ["robbery", "robbed", "looting", "stole", "theft", "burglary"],
    "CYBER_ATTACK": ["cyber attack", "data breach", "ransomware", "ddos", "hacked", "phishing", "malware"],
    "MURDER": ["murder", "homicide", "killed", "assassination", "shot dead"],
    "EXTORTION": ["extortion", "blackmail", "ransom", "threatened"],
    "NARCOTICS": ["drug seizure", "narcotics", "contraband", "smuggling", "heroin", "cocaine"],
    "MEETING": ["meeting", "met with", "conspiracy", "rendezvous", "gathered at"],
    "TRANSACTION": ["transferred", "wire transfer", "payment of", "hawala", "deposited"],
}


def _normalize_extracted_output(raw_output: Any, text: str = "") -> Dict[str, Any]:
    """
    Ensure the output strictly conforms to the unified schema:
    {
      "entities": [{"text": str, "label": str, "confidence": float, "start_char": int | None, "end_char": int | None}],
      "relationships": [{"subject": str, "subject_label": str, "predicate": str, "object": str, "object_label": str, "confidence": float, "timestamp": str | None, "attributes": dict}],
      "events": [{"event_type": str, "participants": list[str], "timestamp": str | None, "location": str | None, "description": str, "confidence": float}]
    }
    """
    if not isinstance(raw_output, dict):
        raw_output = {}

    normalized_entities: List[Dict[str, Any]] = []
    for ent in raw_output.get("entities", []):
        if not isinstance(ent, dict):
            continue
        ent_text = str(ent.get("text", "")).strip()
        if not ent_text:
            continue
        
        # Calculate character offsets if missing
        start_char = ent.get("start_char")
        end_char = ent.get("end_char")
        if (start_char is None or end_char is None) and text and ent_text in text:
            idx = text.find(ent_text)
            if idx != -1:
                start_char = idx
                end_char = idx + len(ent_text)

        normalized_entities.append({
            "text": ent_text,
            "label": str(ent.get("label", "UNKNOWN")).upper(),
            "confidence": float(ent.get("confidence", 0.5)),
            "start_char": start_char if isinstance(start_char, int) else None,
            "end_char": end_char if isinstance(end_char, int) else None,
        })

    normalized_relationships: List[Dict[str, Any]] = []
    # Support both 'relationships' and 'relations' keys
    raw_rels = raw_output.get("relationships") or raw_output.get("relations") or []
    for rel in raw_rels:
        if not isinstance(rel, dict):
            continue
        sub = str(rel.get("subject", "")).strip()
        obj = str(rel.get("object", "")).strip()
        if not sub or not obj:
            continue

        attrs = rel.get("attributes", {})
        if not isinstance(attrs, dict):
            attrs = {}

        normalized_relationships.append({
            "subject": sub,
            "subject_label": str(rel.get("subject_label", "ENTITY")).upper(),
            "predicate": str(rel.get("predicate", "RELATED_TO")).upper(),
            "object": obj,
            "object_label": str(rel.get("object_label", "ENTITY")).upper(),
            "confidence": float(rel.get("confidence", 0.5)),
            "timestamp": str(rel.get("timestamp")) if rel.get("timestamp") else None,
            "attributes": attrs,
        })

    normalized_events: List[Dict[str, Any]] = []
    for ev in raw_output.get("events", []):
        if not isinstance(ev, dict):
            continue
        ev_type = str(ev.get("event_type", "INCIDENT")).upper()
        participants = ev.get("participants", [])
        if not isinstance(participants, list):
            participants = [str(participants)] if participants else []

        normalized_events.append({
            "event_type": ev_type,
            "participants": [str(p).strip() for p in participants if p],
            "timestamp": str(ev.get("timestamp")) if ev.get("timestamp") else None,
            "location": str(ev.get("location")) if ev.get("location") else None,
            "description": str(ev.get("description", "")),
            "confidence": float(ev.get("confidence", 0.6)),
        })

    return {
        "entities": normalized_entities,
        "relationships": normalized_relationships,
        "events": normalized_events,
    }


def _extract_events_from_nlp(
    doc_text: str,
    entities: List[Dict[str, Any]],
    relationships: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """Rule-based incident/event extractor for NLP fallback."""
    events: List[Dict[str, Any]] = []
    text_lower = doc_text.lower()

    persons = [e["text"] for e in entities if e["label"] == "PERSON"]
    locations = [e["text"] for e in entities if e["label"] in ("GPE", "LOC")]
    dates = [e["text"] for e in entities if e["label"] == "DATE"]

    default_location = locations[0] if locations else None
    default_date = dates[0] if dates else None

    for ev_type, keywords in INCIDENT_KEYWORDS.items():
        for kw in keywords:
            if kw in text_lower:
                events.append({
                    "event_type": ev_type,
                    "participants": persons[:4],
                    "timestamp": default_date,
                    "location": default_location,
                    "description": f"Extracted incident matching '{kw}'",
                    "confidence": 0.75,
                })
                break  # match once per category

    return events


class ModelAdapter:
    """
    3-Tier Inference Adapter:
    1. Local In-Memory Python Model (Registered callable)
    2. Local HTTP Model (Inference Server via settings.LOCAL_MODEL_URL)
    3. NLP Pipeline Fallback (Spacy, regex, relations, and rule-based events)
    """

    def __init__(self, timeout_seconds: float = 15.0):
        self.timeout_seconds = timeout_seconds

    def call_local_python_model(self, model_input: ModelInput) -> Optional[Dict[str, Any]]:
        """Tier 1: Execute registered Python model."""
        py_model = get_registered_python_model()
        if py_model is None:
            return None

        try:
            logger.info("Executing Tier 1: In-process Local Python Model...")
            raw_res = py_model(model_input)
            if raw_res and isinstance(raw_res, dict):
                return _normalize_extracted_output(raw_res, model_input.cleaned_text)
        except Exception as exc:
            logger.exception("Tier 1 Local Python Model execution failed: %s", exc)

        return None

    def call_local_http_model(self, model_input: ModelInput) -> Optional[Dict[str, Any]]:
        """Tier 2: Query Local HTTP Inference Server (Ollama / vLLM / custom microservice)."""
        url = getattr(settings, "LOCAL_MODEL_URL", None)
        if not url:
            return None

        try:
            logger.info("Executing Tier 2: Local HTTP Model at %s...", url)
            payload = {
                "text": model_input.cleaned_text,
                "source_type": model_input.source_type,
                "filename": model_input.filename,
                "metadata": model_input.metadata,
                "structured_records": model_input.structured_records,
                "normalized_phones": model_input.normalized_phones,
                "normalized_vehicles": model_input.normalized_vehicles,
            }

            with httpx.Client(timeout=self.timeout_seconds) as client:
                resp = client.post(url, json=payload)
                if resp.status_code == 200:
                    data = resp.json()
                    # Handle OpenAI chat completions format or direct JSON dict
                    if "choices" in data and len(data["choices"]) > 0:
                        content_str = data["choices"][0].get("message", {}).get("content", "")
                        try:
                            parsed_content = json.loads(content_str)
                            return _normalize_extracted_output(parsed_content, model_input.cleaned_text)
                        except Exception:
                            logger.warning("Could not parse JSON from HTTP model choices: %s", content_str[:200])
                    elif isinstance(data, dict):
                        return _normalize_extracted_output(data, model_input.cleaned_text)
                else:
                    logger.warning("Local HTTP Model returned non-200 status: %s", resp.status_code)
        except Exception as exc:
            logger.exception("Tier 2 Local HTTP Model failed: %s", exc)

        return None

    def call_nlp_fallback(self, model_input: ModelInput) -> Dict[str, Any]:
        """Tier 3: Fall back to existing NLP Pipeline (Spacy, regex, tabular parsers)."""
        logger.info("Executing Tier 3: Existing NLP Pipeline Fallback...")
        evidence_id = model_input.metadata.get("evidence_id", "")

        # 1. Handle structured records if present
        if model_input.source_type == "csv" and model_input.structured_records:
            df = pd.DataFrame(model_input.structured_records)
            fn_lower = (model_input.filename or "").lower()
            if "cdr" in fn_lower or any("caller" in col.lower() for col in df.columns):
                raw = nlp_pipeline.extract_from_cdr(df, evidence_id)
            elif "trans" in fn_lower or any("amount" in col.lower() for col in df.columns):
                raw = nlp_pipeline.extract_from_transactions(df, evidence_id)
            elif "vehicle" in fn_lower or any("registration" in col.lower() for col in df.columns):
                raw = nlp_pipeline.extract_from_vehicles(df, evidence_id)
            elif "location" in fn_lower or any("latitude" in col.lower() for col in df.columns):
                raw = nlp_pipeline.extract_from_locations(df, evidence_id)
            else:
                raw = nlp_pipeline.extract_from_text(model_input.cleaned_text, evidence_id)
        else:
            raw = nlp_pipeline.extract_from_text(model_input.cleaned_text, evidence_id)

        normalized = _normalize_extracted_output(raw, model_input.cleaned_text)

        # 2. Extract events from text
        events = _extract_events_from_nlp(
            model_input.cleaned_text,
            normalized["entities"],
            normalized["relationships"],
        )
        normalized["events"] = events

        return normalized

    def extract(
        self,
        content_or_input: Union[ModelInput, str, bytes],
        filename: str = "",
        source_type: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Execute full inference pipeline with 3-tier cascade:
        Local Python Model -> Local HTTP Model -> NLP Pipeline Fallback.
        Always returns a consistent output dict.
        """
        if isinstance(content_or_input, ModelInput):
            model_input = content_or_input
        else:
            model_input = preprocess(content_or_input, filename=filename, source_type=source_type)

        # Tier 1: Local Python Model
        result = self.call_local_python_model(model_input)
        if result is not None:
            return result

        # Tier 2: Local HTTP Model
        result = self.call_local_http_model(model_input)
        if result is not None:
            return result

        # Tier 3: NLP Pipeline Fallback
        return self.call_nlp_fallback(model_input)


# Default singleton instance
model_adapter = ModelAdapter()


def extract_intelligence(
    content_or_input: Union[ModelInput, str, bytes],
    filename: str = "",
    source_type: Optional[str] = None,
) -> Dict[str, Any]:
    """Convenience helper function for extraction via model adapter."""
    return model_adapter.extract(content_or_input, filename=filename, source_type=source_type)
