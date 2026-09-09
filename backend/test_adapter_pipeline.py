import json
from datetime import datetime
from unittest.mock import patch, MagicMock

import preprocessing
from preprocessing import (
    clean_text,
    normalize_phone,
    normalize_vehicle,
    normalize_timestamp,
    hash_sensitive_identifier,
    protect_sensitive_data,
    preprocess,
    ModelInput,
)
import model_adapter
from model_adapter import (
    ModelAdapter,
    register_local_python_model,
    extract_intelligence,
)


def test_text_cleaning_and_normalization():
    raw = "Suspect\u200b John \u00a0Doe\r\n\r\n\r\n\r\n   was seen at  Delhi.   "
    cleaned = clean_text(raw)
    assert "John Doe" in cleaned
    assert "\u200b" not in cleaned
    assert "\u00a0" not in cleaned
    assert "\n\n\n" not in cleaned
    print("[PASS] test_text_cleaning_and_normalization passed")


def test_identifier_normalizers():
    # Phone normalization
    assert normalize_phone("+91 98765-43210") == "9876543210"
    assert normalize_phone("09876543210") == "9876543210"
    assert normalize_phone("9876543210") == "9876543210"

    # Vehicle normalization
    assert normalize_vehicle("dl-01-ab-1234") == "DL01AB1234"
    assert normalize_vehicle("MH 12 DE 1433") == "MH12DE1433"

    # Timestamp normalization
    assert normalize_timestamp("2026-09-08 14:30:00") == "2026-09-08T14:30:00Z"
    assert normalize_timestamp("08/09/2026 14:30:00") == "2026-09-08T14:30:00Z"
    assert normalize_timestamp(1700000000) is not None
    print("[PASS] test_identifier_normalizers passed")


def test_sensitive_data_protection():
    raw_text = "Suspect PAN is ABCDE1234F and Aadhaar is 1234 5678 9012 with Card 4111-2222-3333-4444."
    protected, hashes = protect_sensitive_data(raw_text)
    assert "ABCDE1234F" not in protected
    assert "1234 5678 9012" not in protected
    assert "4111-2222-3333-4444" not in protected
    assert "[PAN_HASH:" in protected
    assert "[AADHAAR_HASH:" in protected
    assert "[CARD_HASH:" in protected
    assert len(hashes) == 3
    print("[PASS] test_sensitive_data_protection passed")


def test_format_preprocessing():
    # 1. CSV
    csv_data = "caller_number,receiver_number,call_start,duration_seconds\n9876543210,9123456780,2026-09-08 10:00:00,120\n"
    csv_input = preprocess(csv_data, filename="call_logs.csv", source_type="csv")
    assert isinstance(csv_input, ModelInput)
    assert len(csv_input.structured_records) == 1
    assert "9876543210" in csv_input.normalized_phones

    # 2. JSON
    json_data = json.dumps({"suspect": "Vikram", "vehicle": "DL-01-AB-1234", "phone": "9876543210"})
    json_input = preprocess(json_data, filename="suspect.json", source_type="json")
    assert isinstance(json_input, ModelInput)
    assert "DL01AB1234" in json_input.normalized_vehicles

    # 3. Log
    log_data = "2026-09-08T12:00:00Z [AUTH] User root login failure from 192.168.1.1\n"
    log_input = preprocess(log_data, filename="auth.log", source_type="log")
    assert isinstance(log_input, ModelInput)
    assert len(log_input.structured_records) == 1

    # 4. Text / FIR
    txt_data = "FIR No 123: Vikram met with Rahul in Mumbai. Phone: +91 9876543210."
    txt_input = preprocess(txt_data, filename="fir.txt", source_type="txt")
    assert isinstance(txt_input, ModelInput)
    assert "9876543210" in txt_input.normalized_phones
    print("[PASS] test_format_preprocessing passed")


def test_model_adapter_tier1_python():
    adapter = ModelAdapter()

    # Register mock python model
    def mock_teammate_model(inp: ModelInput):
        return {
            "entities": [
                {"text": "Vikram Malhotra", "label": "PERSON", "confidence": 0.95, "start_char": 0, "end_char": 15},
                {"text": "9876543210", "label": "PHONE", "confidence": 0.99},
            ],
            "relationships": [
                {
                    "subject": "Vikram Malhotra",
                    "subject_label": "PERSON",
                    "predicate": "USES",
                    "object": "9876543210",
                    "object_label": "PHONE",
                    "confidence": 0.92,
                    "timestamp": "2026-09-08T10:00:00Z",
                    "attributes": {"call_count": 5},
                }
            ],
            "events": [
                {
                    "event_type": "CONSPIRACY_MEETING",
                    "participants": ["Vikram Malhotra"],
                    "timestamp": "2026-09-08T10:00:00Z",
                    "location": "Mumbai",
                    "description": "Met with associates",
                    "confidence": 0.88,
                }
            ],
        }

    register_local_python_model(mock_teammate_model)

    res = adapter.extract("Vikram Malhotra was seen calling 9876543210 in Mumbai.")
    assert "entities" in res
    assert "relationships" in res
    assert "events" in res

    assert len(res["entities"]) == 2
    assert res["entities"][0]["text"] == "Vikram Malhotra"
    assert res["entities"][0]["label"] == "PERSON"
    assert res["relationships"][0]["predicate"] == "USES"
    assert res["events"][0]["event_type"] == "CONSPIRACY_MEETING"
    print("[PASS] test_model_adapter_tier1_python passed")


def test_model_adapter_tier2_http():
    adapter = ModelAdapter()

    # Unregister python model to force Tier 2
    register_local_python_model(None)

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "entities": [{"text": "Alice", "label": "PERSON", "confidence": 0.9}],
        "relationships": [{"subject": "Alice", "predicate": "WORKS_FOR", "object": "Acme Corp"}],
        "events": [{"event_type": "ROBBERY", "participants": ["Alice"], "description": "Bank robbery"}],
    }

    with patch("httpx.Client.post", return_value=mock_resp):
        with patch.object(model_adapter.settings, "LOCAL_MODEL_URL", "http://localhost:8001/v1/extract"):
            res = adapter.extract("Alice works for Acme Corp.")
            assert len(res["entities"]) == 1
            assert res["entities"][0]["text"] == "Alice"
            assert res["relationships"][0]["predicate"] == "WORKS_FOR"
            assert res["events"][0]["event_type"] == "ROBBERY"
    print("[PASS] test_model_adapter_tier2_http passed")


def test_model_adapter_tier3_nlp_fallback():
    adapter = ModelAdapter()
    register_local_python_model(None)

    # Make HTTP URL empty to force Tier 3 fallback
    with patch.object(model_adapter.settings, "LOCAL_MODEL_URL", ""):
        res = adapter.extract("Suspect Vikram called 9876543210 after the robbery in Delhi on 2026-09-08.")
        assert "entities" in res
        assert "relationships" in res
        assert "events" in res

        # Check entity presence
        labels = [e["label"] for e in res["entities"]]
        assert "PHONE" in labels or "PERSON" in labels or "GPE" in labels

        # Check event extraction
        ev_types = [ev["event_type"] for ev in res["events"]]
        assert "ROBBERY" in ev_types
        print("[PASS] test_model_adapter_tier3_nlp_fallback passed")


if __name__ == "__main__":
    test_text_cleaning_and_normalization()
    test_identifier_normalizers()
    test_sensitive_data_protection()
    test_format_preprocessing()
    test_model_adapter_tier1_python()
    test_model_adapter_tier2_http()
    test_model_adapter_tier3_nlp_fallback()
    print("\n=======================================================")
    print("ALL PREPROCESSING & MODEL ADAPTER TESTS PASSED 100%!")
    print("=======================================================")
